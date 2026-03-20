# Project Research Summary

**Project:** GSD Test Steward Consolidation Bridge (v2.8)
**Domain:** Autonomous gap-closure workflow extension — routing read-only analysis agent output into executable phases
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

GSD v2.8 is a targeted bridge milestone — not a new system, but a missing connection between two already-working systems. The test steward agent already analyzes the test suite and produces structured consolidation proposals. The gap-closure workflow already turns frontmatter gaps into executable phases. The gap between them is exactly one missing data route: steward proposals exist in free-text markdown but are never written into the `gaps.*` frontmatter that `plan-milestone-gaps.md` consumes. This milestone closes that route by adding `gaps.test_consolidation` as a fourth gap type alongside the existing requirements, integration, and flows arrays.

The recommended approach is minimal and additive: two workflow markdown files require targeted extensions, zero new modules or npm packages are needed, and the existing `frontmatter.cjs` parser handles the new array-of-objects structure without change. The implementation has a strict build order — the write side (`audit-milestone.md` step 6) must be completed and verified before the read side (`plan-milestone-gaps.md` step 1) can be tested end-to-end.

The single critical risk is autopilot status routing. If `gaps.test_consolidation` data causes the audit to return `gaps_found` instead of `tech_debt`, the autopilot will enter an infinite fix loop trying to auto-apply test modifications that the system's own policy prohibits (`auto_consolidate: false`). This must be resolved in Phase 1 before any implementation proceeds, not discovered during execution.

## Key Findings

### Recommended Stack

This milestone requires no new dependencies. The existing Node.js CJS module stack — `frontmatter.cjs`, `gsd-tools.cjs`, `audit-milestone.md`, and `plan-milestone-gaps.md` — already has every capability needed. The `extractFrontmatter()` function handles arrays of flat objects at two-level nesting, which is exactly the structure of `gaps.test_consolidation` items. This was verified directly against the existing `gaps.integration` array, which is structurally identical to the proposed new type.

See `.planning/research/STACK.md` for full stack details.

**Core technologies (all unchanged):**
- `frontmatter.cjs` (in-repo): YAML frontmatter read/write — `extractFrontmatter()` already handles the new schema at lines 60-82; no parser changes needed
- `audit-milestone.md`: workflow file — receives a text extension to step 6 to populate `gaps.test_consolidation` from steward proposals
- `plan-milestone-gaps.md`: workflow file — receives text extensions to steps 1, 3, and 5 to parse and create phases from the new gap type

**Explicitly avoided:**
- `js-yaml` and `gray-matter` npm packages — adds supply-chain surface with zero functional gain over the existing custom parser
- New `gsd-tools` dispatch commands — no programmatic consumer of `gaps.test_consolidation` exists or is planned for v2.8
- Changes to `autopilot.mjs` — the existing audit-fix-reaudit loop handles the `tech_debt` status path without modification

### Expected Features

The feature set is well-defined because the existing system determines exactly what the bridge must do. All v2.8 features are P1 (must have for launch). Post-launch additions are informational, not functional.

See `.planning/research/FEATURES.md` for the full feature analysis with priority matrix and dependency graph.

**Must have (table stakes):**
- `gaps.test_consolidation` frontmatter field in MILESTONE-AUDIT.md — structured proposal data that `plan-milestone-gaps` can consume
- `audit-milestone` step 6 populates the new field from steward proposals when steward is enabled and proposals exist
- `plan-milestone-gaps` parses `gaps.test_consolidation` and creates a cleanup phase with one task per proposal
- Proposal-to-task mapping for all four strategies: prune, parameterize, promote, merge — each producing concrete, actionable task descriptions
- Budget threshold gate: consolidation phase only created when `test_health.budget_status` is Warning or Over Budget
- Graceful skip when steward is disabled, no proposals exist, or the field is absent
- Correct status routing: audit with only consolidation proposals returns `tech_debt`, not `gaps_found`

**Should have (competitive):**
- Estimated reduction surfaced in task descriptions — "this removes N tests, bringing budget from 101% to 99.1%"
- Single cleanup phase grouping all proposals (not N micro-phases) — cleaner roadmap, consistent with industry standard for batch cleanup work

**Defer (post-v2.8):**
- `gsd health` reporting on pending consolidation proposals
- Per-proposal estimated budget projection in gap plan presentation
- Partial proposal acceptance via frontmatter flags (task-skip in execute phase is sufficient for v2.8)
- `steward.auto_consolidate` opt-in mode (requires correctness confidence that current heuristics do not provide)

### Architecture Approach

The architecture is a two-point write/read extension to an existing data pipeline. The test steward already writes free-text proposals. `audit-milestone.md` step 6 must now extract structured data from those proposals and write it into `gaps.test_consolidation`. `plan-milestone-gaps.md` step 1 must then read that field and route proposals through the existing phase-creation machinery. Steps 4-10 of `plan-milestone-gaps` are unchanged — they operate generically on whatever phases get created.

See `.planning/research/ARCHITECTURE.md` for full component responsibility table, data flow diagrams, and edge case analysis.

**Major components:**
1. `audit-milestone.md` step 6 (MODIFY) — parse steward report `#### Proposal N:` blocks, map to `gaps.test_consolidation` schema, assign priority from `budget_status`, write to YAML frontmatter
2. `plan-milestone-gaps.md` steps 1, 3, 5 (MODIFY) — parse `gaps.test_consolidation`, apply priority filter, group by strategy into at most 2 phases, create proposal-to-task mapping using verbatim steward data
3. All other components (NO CHANGE) — `gsd-test-steward.md`, `autopilot.mjs`, `frontmatter.cjs`, `gsd-tools.cjs`

**Key data flow:**
```
steward report (free text) → audit-milestone step 6 (extraction + structuring)
  → gaps.test_consolidation in MILESTONE-AUDIT.md frontmatter
    → plan-milestone-gaps step 1 (parse) → step 3 (group) → phase creation machinery
```

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all six critical pitfalls with full prevention strategies and phase-to-prevention mapping.

1. **Frontmatter written in one file, parsed in another** — the schema addition to `audit-milestone.md` and the parsing update to `plan-milestone-gaps.md` must be treated as a single atomic change in Phase 1. Split them and the new gap type is silently ignored with no error.

2. **Autopilot loops on consolidation-only gaps** — if `gaps.test_consolidation` triggers `gaps_found` instead of `tech_debt`, the autopilot enters an infinite gap-closure loop attempting to auto-apply test modifications that policy prohibits. The status routing decision must be locked before any implementation.

3. **Confusing `test_health.consolidation_proposals` (integer count) with `gaps.test_consolidation` (structured array)** — the current `test_health` block holds a count only. The actual proposal objects exist only in the steward's free-text markdown and must be parsed from `#### Proposal N:` blocks.

4. **Fragile markdown extraction from steward report** — the steward is an LLM; its output format can vary. Extraction must target labeled fields (`**Strategy:**`, `**Source:**`, `**Action:**`, `**Estimated reduction:**`) within proposal blocks. Malformed proposals must be skipped with a warning, not propagated as null items.

5. **Missing null guard on `test_consolidation` key in `plan-milestone-gaps`** — when steward is disabled or produced no proposals, the key is absent from frontmatter. The guard `const consolidationGaps = gaps.test_consolidation || [];` is mandatory in the first implementation pass.

6. **Task descriptions must use verbatim steward data** — consolidation tasks require exact source file paths and test names from the steward. `plan-milestone-gaps` must not re-interpret or generalize them. Invented specifics cause executors to target the wrong tests.

## Implications for Roadmap

The three-phase build order is driven directly by dependencies. The write side must precede the read side, and both must exist before edge cases can be validated end-to-end.

### Phase 1: Schema Design and Status Routing

**Rationale:** Two architectural decisions must be locked before any implementation: the exact `gaps.test_consolidation` schema (shared contract between audit write and plan-gaps read) and the `tech_debt` vs `gaps_found` status routing rule. Getting either wrong after implementation requires undoing both workflow files simultaneously. Both workflow files must be modified atomically in this phase — not split across phases.

**Delivers:** Documented `gaps.test_consolidation` schema with all required fields (`id`, `strategy`, `title`, `source_files`, `action`, `estimated_reduction`, `priority`); confirmed status routing rule (`tech_debt` for consolidation-only audits); both workflow files modified atomically to write and parse the new field; basic end-to-end round-trip verified with a seeded audit file.

**Addresses:** `gaps.test_consolidation` frontmatter field (P1), `audit-milestone` field population (P1), `plan-milestone-gaps` parsing (P1), correct status routing (P1).

**Avoids:** Pitfall 1 (atomic schema + parsing), Pitfall 2 (autopilot loop), Pitfall 3 (`test_health` count vs structured array confusion).

### Phase 2: Proposal Extraction and Task Mapping

**Rationale:** With the schema contract established, Phase 2 implements the harder parts: parsing steward free-text into structured objects (fragile, must be defensive) and defining the proposal-to-task translation templates for all four strategies (must be explicit before execution).

**Delivers:** Defensive extraction logic in `audit-milestone.md` step 6 targeting labeled steward fields; proposal-to-task mapping templates for prune, parameterize, promote, and merge strategies using verbatim steward data; budget threshold gate (Warning/Over Budget creates phases, OK defers to tech debt section); single cleanup phase grouping all proposals by strategy (at most 2 phases); null guard for missing/empty key.

**Addresses:** Budget threshold gate (P1), proposal-to-task mapping all four strategies (P1), single cleanup phase grouping (P1), estimated reduction in task descriptions (P2 differentiator).

**Avoids:** Pitfall 4 (fragile markdown extraction), Pitfall 5 (null guard), Pitfall 6 (verbatim data in tasks).

### Phase 3: Edge Case Hardening and Validation

**Rationale:** Edge cases cannot be validated until both workflow changes exist. Three paths must be explicitly tested because they are the ones autopilot will hit in production. Regression confirmation for existing gap types is mandatory before calling v2.8 complete.

**Delivers:** Verified behavior for all three edge cases: empty `test_consolidation` array (no phases, no error), absent key (no error, no phases), autopilot `--auto` path (nice-priority proposals deferred, must/should auto-created). Regression confirmation that existing gap types (requirements, integration, flows) are unaffected.

**Addresses:** Graceful skip (P1), autopilot transparency (differentiator), "only-test-gaps" audit path (P1).

**Avoids:** All six pitfalls validated via explicit test scenarios; regression against existing gap types confirmed.

### Phase Ordering Rationale

- Schema must be designed before either file is modified — it is the shared contract that prevents the write/read mismatch causing silent data loss
- Write side and read side modified atomically in Phase 1 — splitting them produces a broken intermediate state with no warning
- Status routing locked in Phase 1, not Phase 3 — the autopilot loop risk is catastrophic if discovered late; recovery requires git revert of test file changes
- Proposal extraction and task mapping in Phase 2 — both require the schema contract from Phase 1 to be final
- Edge case hardening last — logically requires both workflow changes to exist before they can be exercised

### Research Flags

Phases with well-documented patterns (skip research-phase):
- **Phase 1:** Standard YAML frontmatter extension with a proven existing parser — all questions resolved by direct codebase inspection with HIGH confidence; `gaps.integration` is a working structural proof-of-concept for the new type
- **Phase 2:** Defensive labeled-field string parsing — established pattern well-documented in the steward agent spec; no new algorithmic territory
- **Phase 3:** Null guard and empty-array handling — trivially standard JavaScript; standard edge case for any optional frontmatter field

No phases require deeper research before planning. All architectural decisions and implementation patterns are resolved.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection of `frontmatter.cjs`, `audit-milestone.md`, `plan-milestone-gaps.md`; no new dependencies needed; verified against `gaps.integration` as structural proof-of-concept |
| Features | HIGH | Primary sources are existing GSD codebase and agent specs; all features directly verifiable against current behavior; post-v2.8 scope explicitly gated by design document |
| Architecture | HIGH | Full text reads of all affected workflow files; live audit files (v2.6, v2.7 MILESTONE-AUDIT.md) confirmed current schema; `autopilot.mjs` line-level routing logic verified |
| Pitfalls | HIGH | Every pitfall traced to a specific code location — `plan-milestone-gaps` step 1 enumeration, `autopilot.mjs` `runGapClosureLoop` status routing, steward proposal format template in agent spec |

**Overall confidence:** HIGH

### Gaps to Address

- **Steward proposal format variability:** The `#### Proposal N: {strategy} -- {title}` format is specified in the steward agent prompt, but LLM output can vary. The extraction implementation must be tested against multiple real steward runs before Phase 2 is considered complete. Mitigation: use labeled field extraction (`**Strategy:**`, `**Source:**`, etc.) as primary target over heading structure; skip malformed proposals with warning rather than erroring.
- **Warning-threshold autopilot behavior:** ARCHITECTURE.md flags a medium-likelihood risk that Warning budget status creates `should`-priority phases that autopilot executes without human review. Acceptable for v2.8 given current proposals are two known-valuable ones; revisit if Warning-status autopilot runs produce unexpected cleanup work.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `get-shit-done/bin/lib/frontmatter.cjs` — verified `extractFrontmatter()` handles array-of-objects at 2-level nesting (lines 60-82); `reconstructFrontmatter()` within supported depth
- `get-shit-done/workflows/audit-milestone.md` — step 3.5 steward invocation; step 6 frontmatter schema; `test_health` block structure; `offer_next` routing
- `get-shit-done/workflows/plan-milestone-gaps.md` — step 1 explicit gap type enumeration; steps 3-10 generic phase machinery; confirmed no fourth gap type currently handled
- `get-shit-done/scripts/autopilot.mjs` — `runMilestoneAudit()` lines 862-921; `runGapClosureLoop()` lines 924-1017; exact `gaps_found`/`tech_debt` routing logic
- `get-shit-done/agents/gsd-test-steward.md` — proposal format: `#### Proposal N: {strategy} -- {title}` with labeled fields; four strategies (prune, parameterize, promote, merge)
- `.planning/milestones/v2.7-MILESTONE-AUDIT.md` — live `test_health` frontmatter with `consolidation_proposals: 2` as integer count only; `gaps.integration` structure confirmed isomorphic to proposed `gaps.test_consolidation`
- `.planning/milestones/v2.6-MILESTONE-AUDIT.md` — live example with 3 consolidation proposals
- `.planning/PROJECT.md` — v2.8 target features; `steward.auto_consolidate: false` constraint
- `.planning/designs/2026-03-20-test-steward-consolidation-bridge-design.md` — exact frontmatter schema; workflow extension points; autopilot no-change confirmation

### Secondary (MEDIUM confidence — industry sources)

- [Test Automation Maintenance Guide 2026](https://bugbug.io/blog/software-testing/test-automation-maintenance/) — periodic review/prune cycle is industry standard; cleanup batched in sprint cycles
- [Test Maintenance Best Practices 2026](https://bugbug.io/blog/software-testing/best-practices-of-test-maintenance/) — parameterize, prune, and refactor as canonical maintenance strategies
- [CI/CD Quality Gates](https://testrigor.com/blog/software-quality-gates/) — budget thresholds as natural gate for test consolidation work

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
