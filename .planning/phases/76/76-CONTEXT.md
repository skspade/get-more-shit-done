# Phase 76: Proposal Extraction and Task Mapping - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Parse steward free-text proposals from `gaps.test_consolidation` frontmatter into structured task objects, map each of the four strategies (prune, parameterize, promote, merge) to concrete task types, gate consolidation phase creation on budget status, and group all proposals into a single "Test Suite Consolidation" phase positioned last in the gap closure sequence. This phase modifies `plan-milestone-gaps.md` only -- the audit-milestone write side was completed in Phase 75.

</domain>

<decisions>
## Implementation Decisions

### Gap Parsing (PARSE-01, PARSE-02, PARSE-03)
- `plan-milestone-gaps.md` step 1 already enumerates `gaps.test_consolidation` with guard clause `const consolidationGaps = gaps.test_consolidation || [];` (added in Phase 75)
- When `gaps.test_consolidation` is absent or empty, skip consolidation with no error -- the guard clause handles this (from REQUIREMENTS.md PARSE-02)
- Consolidation phase is created only when `test_health.budget_status` is `Warning` or `Over Budget`; `OK` status defers to tech debt path without creating a consolidation phase (from REQUIREMENTS.md PARSE-03)
- Budget status check reads `test_health.budget_status` from the same MILESTONE-AUDIT.md frontmatter parsed in step 1 (Claude's Decision: budget_status is already in the frontmatter from the steward -- no second file read needed)

### Phase Creation (PHASE-01, PHASE-02, PHASE-03)
- All test consolidation proposals are grouped into a single phase named "Test Suite Consolidation" (from REQUIREMENTS.md PHASE-01)
- Consolidation phase is always the last phase in the gap closure sequence, after all requirement/integration/flow gap phases (from REQUIREMENTS.md PHASE-02)
- Phase 75 already added the grouping rule to step 3 of `plan-milestone-gaps.md`; Phase 76 adds the budget gating logic and the task-level detail (from 75-01-SUMMARY.md)
- Consolidation phase appears in the step 5 gap closure plan presentation with each proposal listed as a task (from REQUIREMENTS.md PHASE-03)

### Task Mapping (TASK-01 through TASK-05)
- Prune proposals map to delete tasks: remove stale test cases, run test suite to confirm no regressions (from REQUIREMENTS.md TASK-01, design doc)
- Parameterize proposals map to refactor tasks: replace N individual tests with a single `test.each` data-driven test (from REQUIREMENTS.md TASK-02, design doc)
- Promote proposals map to delete-and-verify tasks: remove unit tests subsumed by an integration test, verify integration test still covers the assertions (from REQUIREMENTS.md TASK-03, design doc)
- Merge proposals map to reorganize tasks: move test cases from source files into a target file organized by describe block, delete empty source files (from REQUIREMENTS.md TASK-04, design doc)
- Each task description includes the steward's `estimated_reduction` count verbatim (from REQUIREMENTS.md TASK-05)
- Each task includes verbatim steward file paths from the `source` field -- no re-interpretation or generalization (from REQUIREMENTS.md, design doc)
- Every task includes "Run test suite" as the final verification step (Claude's Decision: the hard test gate in execute-phase already enforces this, but explicit mention in task text guides the executor)

### Strategy-to-Task Type Labels
- Prune -> "delete" task (Claude's Decision: aligns with success criteria wording "delete tasks")
- Parameterize -> "refactor" task (Claude's Decision: aligns with success criteria wording "refactor tasks")
- Promote -> "delete-and-verify" task (Claude's Decision: aligns with success criteria wording "delete-and-verify tasks")
- Merge -> "reorganize" task (Claude's Decision: aligns with success criteria wording "reorganize tasks")

### Budget Gating Logic
- Parse `test_health.budget_status` from MILESTONE-AUDIT.md frontmatter alongside `gaps.test_consolidation` in step 1 (Claude's Decision: single parse pass for both fields avoids redundant file reads)
- If `budget_status` is `OK`, skip consolidation phase creation even if proposals exist -- defer to tech debt (from REQUIREMENTS.md PARSE-03)
- If `budget_status` is `Warning` or `Over Budget` and proposals exist, create the consolidation phase (from REQUIREMENTS.md PARSE-03)
- If `budget_status` is absent (steward disabled), treat as `OK` -- no consolidation phase (Claude's Decision: absent means steward didn't run, safe default is skip)

### Claude's Discretion
- Exact wording of the budget gating guard clause and log message when skipping
- Formatting of individual task entries in the step 5 presentation
- Whether to show estimated total reduction as a sum in the phase header
- Internal ordering of tasks within the consolidation phase (by strategy or by proposal order)

</decisions>

<specifics>
## Specific Ideas

- The design doc defines exact task templates per strategy with YAML examples for prune (delete), parameterize (refactor), promote (delete+verify), and merge (reorganize) at `/Users/seanspade/Documents/Source/get-more-shit-done/.planning/designs/2026-03-20-test-steward-consolidation-bridge-design.md`
- The steward agent at `agents/gsd-test-steward.md` lines 214-219 defines the proposal output format: `#### Proposal {N}: {strategy} -- {title}` with labeled fields `**Strategy:**`, `**Source:**`, `**Action:**`, `**Estimated reduction:**`
- Phase 75 already added the consolidation grouping rule to step 3 and the `gaps.test_consolidation` parsing to step 1 of `plan-milestone-gaps.md` -- Phase 76 extends with budget gating and task mapping detail
- The `test_health.budget_status` field in MILESTONE-AUDIT.md frontmatter contains one of: `OK`, `Warning`, `Over Budget` -- these are the three values the budget gating logic checks

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/plan-milestone-gaps.md`: Already has `gaps.test_consolidation` parsing (step 1) and grouping rule (step 3) from Phase 75 -- this phase extends with budget gating and task mapping
- `get-shit-done/workflows/audit-milestone.md`: Writes `gaps.test_consolidation` array and `test_health.budget_status` to frontmatter -- read-only dependency for Phase 76
- `agents/gsd-test-steward.md`: Defines the four strategy types and proposal output format that the task mapping consumes

### Established Patterns
- Gap-to-phase mapping pattern: `plan-milestone-gaps.md` `<gap_to_phase_mapping>` section shows how requirement, integration, and flow gaps become tasks -- the test consolidation mapping follows the same YAML structure
- Guard clause pattern for optional gap types: `const consolidationGaps = gaps.test_consolidation || [];` established in Phase 75
- Single-phase grouping for related items: all consolidation proposals go into one phase, paralleling how flow gaps that overlap with requirement gaps get combined

### Integration Points
- `get-shit-done/workflows/plan-milestone-gaps.md` step 1: Add `test_health.budget_status` to frontmatter field extraction
- `get-shit-done/workflows/plan-milestone-gaps.md` step 3: Add budget gating check before consolidation phase creation
- `get-shit-done/workflows/plan-milestone-gaps.md` step 5: Add consolidation phase to the gap closure plan presentation with task-level detail
- `get-shit-done/workflows/plan-milestone-gaps.md` `<gap_to_phase_mapping>`: Add test consolidation mapping section with strategy-to-task templates

</code_context>

<deferred>
## Deferred Ideas

- Edge case validation for empty proposals, steward disabled, consolidation-only gaps, and autopilot flow (Phase 77)
- Regression testing that existing gap types remain unaffected (Phase 77)
- `gsd health` reporting on pending consolidation proposals (post-v2.8, FUTURE-01)
- Estimated budget projection in gap plan presentation (post-v2.8, FUTURE-02)

</deferred>

---

*Phase: 76-proposal-extraction-and-task-mapping*
*Context gathered: 2026-03-20 via auto-context*
