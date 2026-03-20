# Pitfalls Research

**Domain:** Adding a new gap type to an existing gap-closure workflow; bridging read-only analysis agent output into executable phases (GSD v2.8)
**Researched:** 2026-03-20
**Confidence:** HIGH (direct codebase analysis of every touchpoint)

## Critical Pitfalls

### Pitfall 1: Frontmatter Schema Extended in One Place, Parsed in Another

**What goes wrong:**
`gaps.test_consolidation` is added to the YAML frontmatter written by `audit-milestone.md` but the only consumer of that frontmatter is `plan-milestone-gaps.md` (and `autopilot.mjs`, which reads `status` via `gsd-tools frontmatter get`). If the schema change is made in `audit-milestone.md` without simultaneously updating `plan-milestone-gaps.md`'s parsing step, the new gap type is silently ignored. The workflow reads `gaps.requirements`, `gaps.integration`, and `gaps.flows` by name — a new fourth key that nobody reads produces no error and no consolidation phases. The milestone passes the audit loop unchanged.

**Why it happens:**
The YAML frontmatter parsing in `plan-milestone-gaps.md` uses explicit field enumeration: "Parse YAML frontmatter to extract structured gaps: `gaps.requirements` — `gaps.integration` — `gaps.flows`." There is no generic "iterate all gap types" loop. Adding a new key to the schema at write time without touching the read side is a classic two-phase schema change mistake where tests don't catch it because the audit still exits 0.

**How to avoid:**
Treat the audit-write side and the plan-gaps-read side as a single atomic change. Phase 1 of the roadmap must touch both files in the same plan, not in separate phases. Add an explicit check to the plan-milestone-gaps success criteria: verify that all four gap types are parsed, not just the original three.

**Warning signs:**
- `plan-milestone-gaps` output says "N requirements, M integration, K flows gaps" but never mentions consolidation proposals even when MILESTONE-AUDIT.md has `gaps.test_consolidation` with items
- Milestone completes without a consolidation phase being created despite `consolidation_proposals: 2` in audit frontmatter
- `gsd-tools frontmatter get` on the audit file shows the key exists but no phase was created for it

**Phase to address:**
Phase 1 (schema extension + parsing update) — both the audit write and the plan-gaps read must be in the same implementation phase. Split them and you will merge broken.

---

### Pitfall 2: Confusing `test_health` Aggregation Key with `gaps.test_consolidation` Gap Key

**What goes wrong:**
The MILESTONE-AUDIT.md frontmatter already has a `test_health` top-level key (not nested under `gaps`). The new feature adds `gaps.test_consolidation`. These are structurally different: `test_health` is informational metadata from the steward; `gaps.test_consolidation` is actionable data that triggers phase creation. If the implementation places consolidation proposals under `test_health.consolidation_proposals` (an array of proposal objects) instead of under `gaps.test_consolidation` (the new key), `plan-milestone-gaps` will not find them when it reads the `gaps` section.

The current `test_health` schema is:
```yaml
test_health:
  budget_status: "Over Budget"
  redundant_tests: 3
  stale_tests: 0
  consolidation_proposals: 2  # ← integer count only, not proposal objects
```

The `consolidation_proposals` field is a count, not the proposals themselves. The actual proposals are only in the markdown body of the steward's report.

**Why it happens:**
The steward returns a markdown report as its output, not structured YAML. The `consolidation_proposals: 2` in `test_health` is a count extracted by `audit-milestone.md` when it writes the audit file. The actual proposal objects (strategy, source files, action, estimated reduction) exist only in the steward's free-form markdown. To populate `gaps.test_consolidation`, `audit-milestone.md` must parse the steward report markdown to extract structured proposal data — something it does not currently do.

**How to avoid:**
Define the `gaps.test_consolidation` schema explicitly before writing the audit step. Each item needs: `strategy`, `source_files`, `action`, `estimated_reduction`. The audit workflow must extract this from the steward's structured `#### Proposal N` sections (which have a known format per the steward agent spec). Do not rely on counting — extract the full structured data.

**Warning signs:**
- `test_health.consolidation_proposals` is `2` but `gaps.test_consolidation` is empty or missing
- Audit file has consolidation proposals described in prose but no machine-readable list under `gaps`
- `plan-milestone-gaps` does not create consolidation phases even when steward found proposals

**Phase to address:**
Phase 1 (schema design and audit write) — the shape of `gaps.test_consolidation` must be fully specified before writing either `audit-milestone.md` changes or `plan-milestone-gaps.md` changes.

---

### Pitfall 3: Autopilot Gap Closure Loop Treats Consolidation Phases as Blocking

**What goes wrong:**
The autopilot gap closure loop (`runGapClosureLoop()` in `autopilot.mjs`) iterates until `auditStatus === 'passed'`. If `gaps.test_consolidation` causes the audit to return `gaps_found` rather than `tech_debt`, the autopilot will treat consolidation as a blocker and loop until it either creates and executes consolidation phases or exhausts `max_audit_fix_iterations`. Consolidation phases involve pruning, parameterizing, or merging tests — risky changes that the system's own design says "require human approval" (`auto_consolidate` is explicitly false). The autopilot cannot approve its own consolidation proposals.

**Why it happens:**
`runMilestoneAudit()` routes on three statuses: `passed` (exit 0), `gaps_found` (exit 10), `tech_debt` (exit 0 if `auto_accept_tech_debt=true`). If `test_consolidation` gaps force `gaps_found`, the autopilot enters the fix loop. The fix loop calls `/gsd:plan-milestone-gaps --auto`. If `plan-milestone-gaps` creates consolidation phases, the autopilot executes them. If those phases modify test files, `auto_consolidate: false` is violated.

**How to avoid:**
`gaps.test_consolidation` must map to `tech_debt` audit status, not `gaps_found`. When only consolidation proposals exist (no requirement gaps, no integration gaps, no flow gaps), the audit status must be `tech_debt`. The autopilot's `auto_accept_tech_debt: true` default then routes to completion without triggering the gap closure loop. This is the correct semantic: consolidation is recommended cleanup, not a correctness blocker.

Additionally: `plan-milestone-gaps` must distinguish between consolidation phases (advisory, human-approved) and requirement/integration fix phases (mandatory). The `--auto` flag in the autopilot invocation should skip consolidation phases — they are not auto-plannable.

**Warning signs:**
- Autopilot entering `GAP CLOSURE: Iteration N` loop when the only gaps are test consolidation proposals
- Autopilot creating and executing consolidation phases without human review
- `max_audit_fix_iterations` exhausted with audit still showing `gaps_found` because consolidation is circular (execute → re-audit → still gaps → loop)

**Phase to address:**
Phase 1 (schema and status routing) — the `gaps_found` vs `tech_debt` decision logic must explicitly account for consolidation-only gap states before any code is written.

---

### Pitfall 4: Read-Only Agent Output Lacks Machine-Readable Structure for Phase Generation

**What goes wrong:**
The test steward produces a markdown report. The `#### Proposal N: {strategy} -- {title}` sections have a consistent format, but markdown parsing is fragile. If the steward's output deviates from the template (extra blank lines, different heading level, different capitalization), the regex or string parsing in `audit-milestone.md` produces empty or malformed proposal data. The `gaps.test_consolidation` list is populated with `null` entries or mismatched fields, and the consolidation phase created by `plan-milestone-gaps` has garbled task descriptions.

**Why it happens:**
The steward agent is instructed to produce a specific markdown format but is an LLM — its output can vary between runs. The bridge between read-only analysis output and structured YAML data is a parsing step that is not tested independently. The first time it fails will be in a real milestone audit where the output is slightly different from the test case.

**How to avoid:**
Build the extraction as defensively as possible. For each proposal, extract: strategy (from "**Strategy:** {value}" line), source files (from "**Source:** {value}" line), action (from "**Action:** {value}" line), estimated reduction (from "**Estimated reduction:** N test(s)" line). If any required field is missing, skip that proposal and log a warning rather than creating a malformed phase. Add a `proposals_extracted` count to the audit frontmatter and compare it against `consolidation_proposals` count — if they differ, flag it in the audit report.

Prefer extracting from the structured markdown body over post-processing the steward's raw return. The `STEWARD COMPLETE` block has known field names.

**Warning signs:**
- `gaps.test_consolidation` items have empty `strategy` or `action` fields
- Consolidation phase name says "undefined -- undefined" instead of "prune -- stale test removal"
- Count in `test_health.consolidation_proposals` differs from count of items in `gaps.test_consolidation`

**Phase to address:**
Phase 2 (audit write implementation) — the proposal extraction logic needs to be explicit and tested with a sample steward report before being wired into the audit workflow.

---

### Pitfall 5: `plan-milestone-gaps` Proposal-to-Task Mapping Invents Implementation Details

**What goes wrong:**
When `plan-milestone-gaps` converts a consolidation proposal into a task, it must translate a steward proposal (which names test files and describes an action) into a concrete task (which names files, action, verification, done criteria). For a `parameterize` proposal, the task is "convert N test cases in `file.test.ts` to `test.each(...)` pattern." For a `prune` proposal, the task is "delete N lines from `file.test.ts` referencing `deletedFunction`." If the proposal data extracted from the steward report is vague, `plan-milestone-gaps` fills in the gaps with invented specifics — wrong line numbers, wrong function names, wrong test names — and the executor deletes the wrong tests.

**Why it happens:**
The gap-to-task mapping for consolidation is semantically richer than requirement gaps. A requirement gap says "REQ-01 unsatisfied — Dashboard doesn't fetch" and the task is "add fetch call." A consolidation proposal says "parameterize 4 near-duplicate tests in `validation.test.ts` lines 45-89" and the task is "refactor those specific tests into one `test.each` block." The specificity requirement is much higher, and the information only comes from the steward's analysis — it cannot be re-derived from scratch.

**How to avoid:**
The `gaps.test_consolidation` items must carry the full steward proposal data verbatim: the exact source file paths and test names cited by the steward. `plan-milestone-gaps` must use this data directly when creating task descriptions, not re-interpret or paraphrase it. Add a rule to the gap-to-task mapping for consolidation: "Source and action fields come verbatim from the steward proposal. Do not modify or generalize them."

For the `estimated_reduction` field: include it in the phase description so the executor knows how many tests the phase is expected to remove. Include it in the phase's success criteria ("test count decreases by N after this phase").

**Warning signs:**
- Consolidation task descriptions reference test names not present in the source files
- Executor reports "test not found" when trying to apply consolidation
- Phase success criteria says "reduce tests by 5" but steward proposal estimated 2

**Phase to address:**
Phase 2 (plan-milestone-gaps consolidation task template) — the task template for consolidation must be specified before implementation, not derived during execution.

---

### Pitfall 6: Steward Disabled / No Proposals — Guard Missing in Gap Parser

**What goes wrong:**
`plan-milestone-gaps` adds handling for `gaps.test_consolidation` but does not guard against the case where the field is absent (steward disabled) or is an empty list (no proposals). If the code assumes the key exists and tries to iterate it without a null check, the entire `plan-milestone-gaps` command errors out — blocking gap closure for all gap types including requirements and integration gaps that do have entries.

**Why it happens:**
YAML frontmatter parsing returns `undefined` for missing keys. JavaScript iterating `undefined` throws. This is a straightforward null guard omission, but it is easy to miss when the feature is developed against a test case where the steward always runs and always produces proposals.

**How to avoid:**
All gap type handlers in `plan-milestone-gaps` must treat missing keys as empty arrays. Add explicit guard: `const consolidationGaps = gaps.test_consolidation || [];`. Test the workflow with an audit file that has no `test_consolidation` key at all, with an empty list, and with a populated list. All three must produce valid output.

**Warning signs:**
- `plan-milestone-gaps` errors on an audit file where steward was disabled or produced no proposals
- Error message like "Cannot read properties of undefined (reading 'forEach')" in the gap planning step
- Autopilot halts with debug retries exhausted on a milestone where the only gaps are requirements

**Phase to address:**
Phase 2 (plan-milestone-gaps implementation) — guard clause for missing/empty `test_consolidation` must be in the first implementation pass, verified with an empty-proposals test case.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Putting consolidation count in `test_health` and full proposals only in prose | Simpler audit write | `plan-milestone-gaps` cannot parse proposals without fragile markdown parsing | Never — define structured `gaps.test_consolidation` from day one |
| Letting consolidation trigger `gaps_found` instead of `tech_debt` | Simpler status logic | Autopilot loops forever; consolidation phases run without human approval | Never — consolidation is advisory, not a correctness blocker |
| Hardcoding the three gap type names in `plan-milestone-gaps` | Simpler parser | Adding a fourth type requires editing parser code, not just schema | Acceptable short-term; acceptable for v2.8 since no fifth type is planned |
| Skipping steward report parsing and manually writing proposals into audit | Avoids brittle markdown parsing | Proposals are stale the moment the test suite changes; removes automation value | Never — the automation value is in the live analysis |
| Creating consolidation phases for all proposals without priority filter | Simpler planning logic | Minor consolidation proposals (1 test, low value) get full phase overhead | Acceptable for v2.8 since current proposals are 2 known-valuable ones |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `audit-milestone.md` ↔ steward output | Extracting proposal count but not proposal objects; populating `test_health.consolidation_proposals` as integer only | Extract full proposal objects (strategy, source, action, estimated reduction) into `gaps.test_consolidation` array |
| `audit-milestone.md` ↔ `plan-milestone-gaps.md` | Changing schema in one without updating the other; different field naming conventions | Define the shared schema in a comment block in both files; use exact same key names |
| `plan-milestone-gaps.md` ↔ `autopilot.mjs` | Consolidation phases triggering the audit re-loop indefinitely | Consolidation gaps must map to `tech_debt` status; `auto_accept_tech_debt: true` handles it |
| Steward report format ↔ extraction parser | Relying on heading level or exact spacing in free-form markdown | Extract only from labeled fields (`**Strategy:**`, `**Source:**`, `**Action:**`, `**Estimated reduction:**`) within a proposal block; skip malformed proposals |
| `gaps.test_consolidation` presence ↔ `steward.enabled` config | Creating the key when steward disabled produces empty list that looks like "steward ran and found nothing" | Only add `gaps.test_consolidation` to the audit frontmatter when `STEWARD_ENABLED` is true and the steward report has proposals. When steward is disabled, omit the key entirely. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Schema round-trip verified:** Write a MILESTONE-AUDIT.md with `gaps.test_consolidation` entries, run `plan-milestone-gaps`, confirm consolidation phases are created with correct task descriptions pulled from proposal data
- [ ] **Empty proposals handled:** `plan-milestone-gaps` with an audit file that has `gaps.test_consolidation: []` completes without error and creates no consolidation phases
- [ ] **Missing key handled:** `plan-milestone-gaps` with an audit file that has no `test_consolidation` key under `gaps` completes without error
- [ ] **Steward disabled handled:** Audit run with `test.steward: false` produces an audit file without `gaps.test_consolidation` key; `plan-milestone-gaps` treats it as zero consolidation gaps
- [ ] **Status routing correct:** An audit with only consolidation proposals (no requirement/integration/flow gaps) produces `tech_debt` status, not `gaps_found`
- [ ] **Autopilot does not loop on consolidation:** Running autopilot on a milestone with only consolidation proposals completes via `auto_accept_tech_debt` path without entering the gap closure loop
- [ ] **Proposal count matches extracted items:** `test_health.consolidation_proposals` integer equals length of `gaps.test_consolidation` array in the audit frontmatter
- [ ] **Existing gap types unaffected:** `plan-milestone-gaps` run with an audit file that has only requirement gaps behaves exactly as it did before v2.8 — no regression

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Schema written in audit but not read in plan-gaps | LOW | Add parsing for `gaps.test_consolidation` to `plan-milestone-gaps`; no schema migration needed since files are generated fresh per audit |
| Consolidation wrongly triggers `gaps_found` → autopilot loops | LOW | Change status routing in `audit-milestone.md` to emit `tech_debt` when only consolidation gaps exist; re-run audit |
| Steward proposal extraction produces garbled tasks | MEDIUM | Run `/gsd:audit-milestone` fresh; steward re-analyzes and produces new proposals; re-extract with fixed parser |
| Null guard missing → `plan-milestone-gaps` errors | LOW | Add `|| []` guard; re-run; no state corruption since the workflow only reads, then creates new phases |
| Consolidation phases executed without human approval in autopilot | HIGH | Revert the test file changes via `git revert`; add the `tech_debt`-routing fix; re-run audit |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Frontmatter written but not read | Phase 1 (atomic schema + parsing change) | `plan-milestone-gaps` creates consolidation phases from a seeded audit file |
| `test_health` count vs `gaps.test_consolidation` array confusion | Phase 1 (schema design) | Audit frontmatter has both the integer count and the structured array; values agree |
| Autopilot loops on consolidation-only gaps | Phase 1 (status routing) | Audit with only consolidation proposals returns `tech_debt`; autopilot exits via `auto_accept_tech_debt` |
| Brittle markdown extraction from steward report | Phase 2 (audit write implementation) | Extraction tested with sample steward report containing all 4 strategies |
| Consolidation tasks invented rather than verbatim | Phase 2 (task template spec) | Task file/test names match steward proposal exactly; no invented specifics |
| Missing null guard on `test_consolidation` | Phase 2 (plan-milestone-gaps implementation) | Workflow succeeds with audit file missing the key entirely |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `get-shit-done/workflows/audit-milestone.md` step 3.5, step 6 — steward spawn and frontmatter schema; confirms `test_health.consolidation_proposals` is integer count only, not proposal objects
  - `get-shit-done/workflows/plan-milestone-gaps.md` step 1 — explicit enumeration of three gap types read; confirms new type will be silently ignored without update
  - `get-shit-done/scripts/autopilot.mjs` lines 862-921 (`runMilestoneAudit`), lines 924-1017 (`runGapClosureLoop`) — exact status routing logic; confirms `gaps_found` triggers loop, `tech_debt` with `auto_accept_tech_debt: true` exits cleanly
  - `agents/gsd-test-steward.md` step 5 and step 6 — proposal format template (`#### Proposal N: {strategy} -- {title}`, labeled fields) — confirms parseable but fragile
  - `.planning/milestones/v2.7-MILESTONE-AUDIT.md` — live example of `test_health` schema with `consolidation_proposals: 2` as integer; confirms no structured proposal data exists in current frontmatter
  - `.planning/PROJECT.md` v2.8 target features — confirms the four strategies (prune, parameterize, promote, merge) and the four edge cases (no proposals, steward disabled, only test gaps, autopilot flow)

---
*Pitfalls research for: GSD v2.8 test steward consolidation bridge*
*Researched: 2026-03-20*
