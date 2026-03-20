# Test Steward Consolidation Bridge — Design

**Date:** 2026-03-20
**Approach:** Extend plan-milestone-gaps

## Audit-Milestone Signal Change

The `audit-milestone.md` workflow needs a small adjustment so that when requirements/integration/flows all pass but the steward has consolidation proposals, the audit status reflects that work remains.

**Current behavior:** `test_health` is recorded in the audit frontmatter but doesn't influence the audit `status` field. A milestone with 0 requirement gaps but consolidation proposals gets `passed`.

**Change:** Add a new status check after step 5e. If all requirements are satisfied and no integration/flow gaps exist, but `test_health.consolidation_proposals > 0`, set status to `tech_debt` instead of `passed`. This routes to the tech_debt path in step 7, which already offers `/gsd:plan-milestone-gaps` as an option.

**What stays the same:** Consolidation proposals never force `gaps_found` — they're tech debt, not blockers. The user can always choose to complete the milestone and accept the debt.

**Frontmatter addition:** Add a `gaps.test_consolidation` array to the audit frontmatter alongside the existing `gaps.requirements`, `gaps.integration`, `gaps.flows`:

```yaml
gaps:
  requirements: [...]
  integration: [...]
  flows: [...]
  test_consolidation:   # NEW — from steward
    - strategy: "prune"
      source: "tests/stale-auth.test.cjs"
      action: "Remove — references deleted auth module"
      reduction: 3
    - strategy: "parameterize"
      source: "tests/validation.test.cjs:L12-L45"
      action: "Combine 5 near-identical tests into test.each"
      reduction: 4
```

This is the key structural change — by putting consolidation proposals into the `gaps` object, `plan-milestone-gaps` can consume them the same way it consumes every other gap type.

## Plan-Milestone-Gaps Extension

The `plan-milestone-gaps.md` workflow gets extended in three steps:

**Step 1 (Load Audit Results) — add test_consolidation parsing:**

Currently parses `gaps.requirements`, `gaps.integration`, `gaps.flows`. Add `gaps.test_consolidation` to the list. Each entry has: `strategy`, `source`, `action`, `reduction`.

**Step 3 (Group Gaps into Phases) — add test consolidation grouping:**

All test consolidation proposals are grouped into a single phase called "Test Suite Consolidation". Unlike requirement gaps which get clustered by subsystem, test proposals are already logically grouped by the steward — they all go into one phase.

**Grouping rule addition:**
- Test consolidation proposals -> always one phase, always last in the gap closure sequence

**Phase template:**
```markdown
### Phase {highest + N}: Test Suite Consolidation
**Goal:** Reduce test suite redundancy and remove stale tests per steward proposals
**Gap Closure:** Closes test_consolidation gaps from audit
**Strategies:**
- Prune: {N} stale tests -> remove
- Parameterize: {N} near-duplicates -> combine into test.each
- Promote: {N} unit tests subsumed by integration tests -> remove
- Merge: {N} file consolidations -> reorganize

**Estimated reduction:** {sum of all proposal reductions} tests
```

**Step 5 (Present Gap Closure Plan) — include test consolidation:**

The consolidation phase appears in the presentation as the last proposed phase, with its proposals listed as tasks.

**No changes to steps 4, 6, 7, 8, 9, 10** — phase numbering, ROADMAP updates, directory creation, commits, and next-step routing all work generically with the new phase.

## Proposal-to-Task Mapping

When the consolidation phase gets planned (via `/gsd:plan-phase`), the steward's proposals need to translate into executable tasks. This section defines how each strategy maps to plan tasks.

**Prune -> Delete task:**
```yaml
- name: "Remove stale tests in {file}"
  files: ["{test file}"]
  action: "Delete test cases that reference {missing module/function}. Run test suite to confirm no regressions."
```

**Parameterize -> Refactor task:**
```yaml
- name: "Parameterize {N} tests in {file}"
  files: ["{test file}"]
  action: "Replace {N} individual test cases with a single data-driven test using test.each (or equivalent). Inputs: [{list from proposal}]. Expected outputs unchanged."
```

**Promote -> Delete + verify task:**
```yaml
- name: "Remove unit tests subsumed by {integration test}"
  files: ["{unit test file(s)}"]
  action: "Delete {N} unit tests. Verify {integration test file} still covers the same assertions. Run test suite."
```

**Merge -> Reorganize task:**
```yaml
- name: "Consolidate {N} test files into {target}"
  files: ["{source files}", "{target file}"]
  action: "Move test cases from {source files} into {target file}, organized by describe block. Delete empty source files. Test count unchanged."
```

**Key constraint:** Every task includes "Run test suite" as the final step. The executor must verify tests still pass after each consolidation action. This is already enforced by the hard test gate in `execute-phase`, so no new mechanism is needed.

**CONTEXT.md seeding:** When plan-phase runs for the consolidation phase, it should include the steward's full proposals in the CONTEXT.md so the planner has exact file paths, line numbers, and rationale. The gap closure plan from plan-milestone-gaps provides this via the `gaps.test_consolidation` entries.

## Edge Cases and No-Op Behavior

**No consolidation proposals:** If the steward runs but produces no proposals (all metrics within thresholds), `gaps.test_consolidation` is an empty array. `plan-milestone-gaps` skips creating a consolidation phase. No output difference from today.

**Steward disabled or skipped:** If `test.steward` is false or no test files exist, the audit has no `test_health` section. `plan-milestone-gaps` checks for `gaps.test_consolidation` — if missing or empty, skips. No error.

**Only test gaps, no other gaps:** If requirements/integration/flows all pass but consolidation proposals exist, `plan-milestone-gaps` creates just the test consolidation phase. The "Gap Closure Plan" presentation shows only this phase. This is the scenario that currently dead-ends — after this change, it works.

**Autopilot flow:** In autopilot mode, the audit-fix-reaudit loop handles this naturally. Audit detects `tech_debt` status -> autopilot routes to `plan-milestone-gaps` -> consolidation phase gets created -> planned -> executed -> re-audit. No special autopilot changes needed.

**Budget still over after consolidation:** If the steward's proposals don't bring the budget under threshold after execution, the next audit will produce new findings. This is the existing audit-fix loop — no special handling needed. The user can always `/gsd:complete-milestone` to accept remaining debt.
