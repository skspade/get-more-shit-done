# Architecture Research

**Domain:** Test Steward Consolidation Bridge — GSD Autopilot Gap Closure Integration
**Researched:** 2026-03-20
**Confidence:** HIGH

## The Problem: Dead-End Data Flow

The test steward runs during `audit-milestone` (step 3.5) and produces consolidation proposals. Those proposals are written into `MILESTONE-AUDIT.md` as `test_health` frontmatter and a markdown report section. They go no further.

`plan-milestone-gaps.md` reads `MILESTONE-AUDIT.md` frontmatter but only consumes three arrays:

```
gaps.requirements
gaps.integration
gaps.flows
```

`test_health.consolidation_proposals` is visible to humans reading the audit file but is never routed into gap closure phases. This milestone closes that gap by adding a fourth array:

```
gaps.test_consolidation    ← NEW
```

...and teaching `plan-milestone-gaps.md` to create phases from it, exactly like it does for the existing three gap types.

## Existing Architecture (What We're Extending)

```
audit-milestone.md (step 3.5)
    │
    ├── Task(gsd-test-steward) → steward_report
    │
    └── Step 6: Write MILESTONE-AUDIT.md
        ├── YAML frontmatter:
        │   ├── gaps.requirements: [...]
        │   ├── gaps.integration: [...]
        │   ├── gaps.flows: [...]
        │   └── test_health:           ← proposals recorded here (summary only)
        │       ├── budget_status
        │       ├── redundant_tests: N
        │       ├── stale_tests: N
        │       └── consolidation_proposals: N    ← count only, no detail
        └── Markdown body:
            └── ## Test Suite Health        ← full steward report (free text)

plan-milestone-gaps.md (step 1)
    │
    └── Parse YAML frontmatter:
        ├── gaps.requirements → phases
        ├── gaps.integration → phases
        ├── gaps.flows → phases
        └── test_health → (IGNORED — not consumed)
```

The bridge requires two coordinated changes — one write-side (audit-milestone produces structured proposals) and one read-side (plan-milestone-gaps consumes them).

## New Architecture: v2.8 Changes

```
audit-milestone.md (step 3.5) — MODIFIED
    │
    ├── Task(gsd-test-steward) → steward_report
    │
    └── Step 6: Write MILESTONE-AUDIT.md — MODIFIED
        ├── YAML frontmatter:
        │   ├── gaps.requirements: [...]
        │   ├── gaps.integration: [...]
        │   ├── gaps.flows: [...]
        │   ├── gaps.test_consolidation: [...]    ← NEW: structured proposals
        │   └── test_health:
        │       ├── budget_status
        │       ├── redundant_tests: N
        │       ├── stale_tests: N
        │       └── consolidation_proposals: N
        └── Markdown body: (unchanged)

plan-milestone-gaps.md (step 1) — MODIFIED
    │
    └── Parse YAML frontmatter:
        ├── gaps.requirements → phases (unchanged)
        ├── gaps.integration → phases (unchanged)
        ├── gaps.flows → phases (unchanged)
        └── gaps.test_consolidation → phases    ← NEW: consumed
```

## Component Boundaries: New vs Modified

| Component | Action | Why |
|-----------|--------|-----|
| `workflows/audit-milestone.md` | **MODIFY** | Step 6 must map steward proposals into `gaps.test_consolidation` array. New extraction logic + schema addition. |
| `workflows/plan-milestone-gaps.md` | **MODIFY** | Step 1 must parse `gaps.test_consolidation`. Step 3 must group proposals into phases. Steps 6-10 are unchanged (they handle any gap type). |
| `agents/gsd-test-steward.md` | **NO CHANGE** | Read-only agent; output format is already structured markdown. Audit-milestone extracts from it. |
| `scripts/autopilot.mjs` | **NO CHANGE** | Calls `plan-milestone-gaps --auto` generically; the workflow handles the new gap type transparently. |
| `bin/gsd-tools.cjs` | **NO CHANGE** | Frontmatter parsing via `frontmatter get` already handles arbitrary fields. No new dispatch cases needed. |
| `bin/lib/frontmatter.cjs` | **NO CHANGE** | General-purpose YAML frontmatter; `gaps.test_consolidation` is just another array. |

## New Schema: gaps.test_consolidation

The steward report (free text markdown) must be parsed by audit-milestone into structured objects. Each object maps one consolidation proposal to the schema that plan-milestone-gaps can consume:

```yaml
gaps:
  test_consolidation:
    - id: "TC-01"
      strategy: "parameterize"          # parameterize | promote | prune | merge
      title: "Parameterize validation checks in phase.test.cjs"
      source_files:
        - "tests/phase.test.cjs"
      action: "Combine 4 near-duplicate tests into test.each array"
      rationale: "Tests differ only in input values; parameterize reduces 4→1 plus data array"
      estimated_reduction: 3
      priority: "should"               # must | should | nice
```

**Priority mapping from steward findings:**

| Steward Condition | Priority |
|-------------------|----------|
| Project budget Over Budget | `must` |
| Project budget Warning AND consolidation triggered | `should` |
| Individual finding, no budget pressure | `nice` |

The `priority` field lets plan-milestone-gaps apply its existing prioritization logic (step 2) to test consolidation just like requirement gaps.

## Data Flow: Proposal-to-Phase Mapping

```
gsd-test-steward output (free text):

    #### Proposal 1: parameterize — Consolidate phase navigation tests
    - Strategy: parameterize
    - Source: tests/phase.test.cjs lines 45-89
    - Action: Combine 4 near-duplicate describe blocks into test.each
    - Estimated reduction: 3 tests

audit-milestone.md step 6 (extraction):

    Parse steward_report for "#### Proposal N:" blocks
    → map each to gaps.test_consolidation[] item
    → assign id: "TC-{N}"
    → assign priority based on budget_status

MILESTONE-AUDIT.md frontmatter:

    gaps:
      test_consolidation:
        - id: "TC-01"
          strategy: parameterize
          title: "Consolidate phase navigation tests"
          source_files: ["tests/phase.test.cjs"]
          action: "Combine 4 near-duplicate describe blocks into test.each"
          estimated_reduction: 3
          priority: "must"             # Over Budget → must

plan-milestone-gaps.md step 1 (consumption):

    Parse gaps.test_consolidation array
    → each item is a gap with strategy, source, action

plan-milestone-gaps.md step 3 (grouping):

    Group test_consolidation gaps by strategy or affected file area:
    - All prune gaps → one phase "Prune Stale Tests"
    - All parameterize + merge gaps → one phase "Consolidate Test Parameterization"
    - promote gaps → one phase "Promote Unit Tests to Integration Coverage"
    (Override: if only 1-2 proposals total, put them all in one phase)

plan-milestone-gaps.md steps 4-10 (unchanged):

    Create phases, update ROADMAP.md, create directories, commit
```

## Proposal-to-Task Mapping by Strategy

This is the core translation logic. Plan-milestone-gaps uses this mapping to create specific, actionable tasks from each proposal:

### Strategy: prune

```
gap: prune stale test referencing deleted function
→ phase: "Remove Stale Tests"
   task: "Remove stale test block"
     files: [source_files[0]]
     action: "Delete it('...') block at line N that references <missing module>"
```

One task per file containing stale tests. Group multiple stale tests in the same file into one task.

### Strategy: parameterize

```
gap: parameterize near-duplicate tests
→ phase: "Parameterize Redundant Tests"
   task: "Convert to test.each"
     files: [source_files[0]]
     action: "Replace N test(...) blocks with single test.each([...cases]) pattern"
```

One task per test file. If multiple parameterize proposals in one file, merge into one task.

### Strategy: promote

```
gap: unit tests subsumed by integration test
→ phase: "Remove Redundant Unit Tests"
   task: "Remove unit tests covered by integration test"
     files: [source_files[0]]
     action: "Delete N unit test blocks — coverage provided by integration test at <source_files[1]>"
```

### Strategy: merge

```
gap: >5 test files for related functionality
→ phase: "Consolidate Test Files"
   task: "Merge related test files"
     files: [source_files...]
     action: "Consolidate N files into <target file> organized by feature"
```

Merge generates zero estimated_reduction (no test removal, just reorganization). One task per consolidation group.

## Edge Cases

### No consolidation proposals

If steward produces no proposals (all metrics within thresholds):

- `gaps.test_consolidation` is an empty array `[]`
- `plan-milestone-gaps.md` detects empty array — no phases created, no user prompt about test consolidation
- Behavior is identical to a milestone with no integration gaps

### Steward skipped (disabled or no test files)

If steward was skipped:

- `test_health` frontmatter is absent from MILESTONE-AUDIT.md
- `gaps.test_consolidation` key is absent (not present, not empty array)
- `plan-milestone-gaps.md` treats absent key same as empty array — skip silently

Implementation: `const testConsolidation = gaps.test_consolidation || [];`

### Only test consolidation gaps (no requirement/integration/flow gaps)

If the audit passes on requirements but has test consolidation gaps:

- Audit status remains `tech_debt` (not `gaps_found`) — consolidation is cleanup, not a blocker
- `plan-milestone-gaps.md` is invoked via the `tech_debt` path (option B in offer_next)
- The workflow reads `test_consolidation` and creates cleanup phases
- This path is reachable both manually and via autopilot (autopilot already handles `tech_debt` status)

### Autopilot flow

Autopilot calls `plan-milestone-gaps --auto`. The `--auto` flag suppresses the "Create these N phases? (yes / adjust / defer all optional)" prompt in step 5. The new test consolidation phases are created without human confirmation — same behavior as requirement gap phases.

However: test consolidation proposals with priority `nice` should be **skipped in autopilot mode** (deferred). Only `must` and `should` proposals auto-create phases. This mirrors the existing nice-to-have deferral logic for requirement gaps.

## Integration Points

### audit-milestone.md: Two Changes

**Change 1 — Step 3.5 (spawn steward):** No change to the Task() call. The steward already produces proposal blocks. The caller just needs to extract them.

**Change 2 — Step 6 (frontmatter schema):** Add `gaps.test_consolidation` to the YAML template. The extraction logic parses `steward_report` for `#### Proposal N:` blocks and maps them to the structured schema. Location: the section that already writes `test_health` fields.

```yaml
# Existing schema (unchanged)
test_health:
  budget_status: "{OK | Warning | Over Budget}"
  redundant_tests: N
  stale_tests: N
  consolidation_proposals: N

# New: add to gaps block
gaps:
  requirements: [...]
  integration: [...]
  flows: [...]
  test_consolidation:    # ← ADD THIS
    - id: "TC-01"
      strategy: "..."
      title: "..."
      source_files: [...]
      action: "..."
      estimated_reduction: N
      priority: "..."
```

### plan-milestone-gaps.md: Three Changes

**Change 1 — Step 1 (load audit results):** Add `gaps.test_consolidation` to the frontmatter extraction. Same frontmatter parse, one more field.

**Change 2 — Step 2 (prioritize):** Apply existing priority logic (`must`/`should`/`nice`) to `test_consolidation` items — the `priority` field is already populated by audit-milestone, no inference needed.

**Change 3 — Step 3 (grouping):** Add grouping rule for test consolidation: cluster by strategy type into at most 2 phases (prune/promote together, parameterize/merge together). If ≤2 total proposals, combine into one phase.

Steps 4 through 10 of plan-milestone-gaps require no changes — they work on "phases with goals and tasks" regardless of gap source.

### No New Files Required

This milestone adds no new commands, agents, workflow files, or CJS modules. Both changes are in-place modifications to existing workflow markdown files.

## Suggested Build Order

Dependencies drive the order. The write-side (audit) must be built and validated before the read-side (plan-gaps) can be tested end-to-end.

### Phase 1: audit-milestone.md Schema and Extraction

**What:** Modify step 6 of `audit-milestone.md` to:
1. Parse `steward_report` for `#### Proposal N:` blocks
2. Map each block to a `gaps.test_consolidation` item with the defined schema
3. Assign priority based on `test_health.budget_status`
4. Write to YAML frontmatter

**Why first:** The MILESTONE-AUDIT.md with `gaps.test_consolidation` populated is the required input for plan-milestone-gaps. Build and validate the output schema before building the consumer.

**Verification:** Run `/gsd:audit-milestone` on this project (currently Over Budget, 2 steward proposals). Confirm `v2.8-MILESTONE-AUDIT.md` frontmatter contains a populated `gaps.test_consolidation` array with correctly mapped TC-01, TC-02 items.

### Phase 2: plan-milestone-gaps.md Consumption

**What:** Modify `plan-milestone-gaps.md` to:
1. Parse `gaps.test_consolidation` from frontmatter (step 1)
2. Apply priority filtering (step 2)
3. Group by strategy into phases (step 3, new grouping rule)
4. Create proposal-to-task mapping for all four strategies

**Why second:** Depends on Phase 1 producing well-formed `gaps.test_consolidation` data. The workflow change is purely additive — existing requirement/integration/flow gap handling is untouched.

**Verification:** With the updated audit file from Phase 1, run `/gsd:plan-milestone-gaps`. Confirm test consolidation phases are created in ROADMAP.md with correct tasks (parameterize/prune/promote/merge as applicable).

### Phase 3: Edge Case Hardening and Tests

**What:** Validate the three edge cases:
1. Empty `test_consolidation` array → no phases created
2. Absent `test_consolidation` key (steward skipped) → no error, no phases
3. Autopilot `--auto` path → nice-priority proposals deferred, must/should auto-created

**Why third:** Edge case paths cannot be tested until both workflow changes exist. Run against a synthetic audit file with each edge case condition.

**Verification:** Unit tests in `tests/plan-milestone-gaps.test.cjs` (if test file exists) or manual flow validation. Autopilot dry-run with `--dry-run` flag against a milestone with only test consolidation gaps.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Steward report format varies (proposals not always in `#### Proposal N:` format) | MEDIUM | Extraction fails silently | Extraction falls back to empty array; audit still succeeds |
| Frontmatter YAML write corrupts existing gaps fields | LOW | Breaks plan-milestone-gaps entirely | Test full roundtrip on MILESTONE-AUDIT.md after write |
| plan-milestone-gaps with mixed gap types creates duplicate phases | LOW | User sees redundant phases | Grouping rules explicitly handle test_consolidation separately from other gap types |
| Autopilot creates cleanup phases when budget is only at Warning | MEDIUM | Unnecessary work injected into autonomous pipeline | Priority mapping: Warning = `should` (creates phases) vs `nice` (deferred). Consider making Warning → nice for autopilot path. |

## Sources

All findings are HIGH confidence based on direct codebase inspection.

- `workflows/audit-milestone.md` — current step 3.5 and step 6 schema (full text read)
- `workflows/plan-milestone-gaps.md` — current step 1 frontmatter parsing and step 3 grouping logic (full text read)
- `agents/gsd-test-steward.md` — proposal output format: `#### Proposal N: {strategy} -- {title}` (full text read)
- `.planning/milestones/v2.7-MILESTONE-AUDIT.md` — live example of current `test_health` frontmatter with 2 proposals (read)
- `.planning/milestones/v2.6-MILESTONE-AUDIT.md` — live example with 3 proposals (read)
- `.planning/PROJECT.md` — v2.8 target features and constraints (read)
- `scripts/autopilot.mjs` — `runGapClosureLoop()` confirms `/gsd:plan-milestone-gaps --auto` is the autopilot call path (line 941)

---
*Architecture research for: Test Steward Consolidation Bridge (v2.8)*
*Researched: 2026-03-20*
