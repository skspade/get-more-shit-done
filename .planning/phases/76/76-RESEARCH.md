# Phase 76: Proposal Extraction and Task Mapping - Research

**Researched:** 2026-03-20
**Domain:** Workflow markdown extension (plan-milestone-gaps.md)
**Confidence:** HIGH

## Summary

Phase 76 extends `plan-milestone-gaps.md` with three capabilities: (1) budget gating that checks `test_health.budget_status` to decide whether consolidation proposals create a phase, (2) strategy-to-task mapping that translates steward proposals into concrete executable tasks, and (3) step 5 presentation of the consolidation phase with task-level detail.

Phase 75 already completed the structural foundation: `gaps.test_consolidation` is parsed in step 1, and the grouping rule in step 3 creates a single "Test Suite Consolidation" phase positioned last. Phase 76 adds the budget gating guard and the task-level specifics that make the consolidation phase actionable.

**Primary recommendation:** Extend plan-milestone-gaps.md in three surgical locations: step 1 (add budget_status extraction), step 3 (add budget gating before consolidation phase creation), and gap_to_phase_mapping section (add strategy-to-task templates). Then update step 5 presentation to show consolidation tasks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `plan-milestone-gaps.md` step 1 already enumerates `gaps.test_consolidation` with guard clause (Phase 75)
- Budget status check reads `test_health.budget_status` from the same MILESTONE-AUDIT.md frontmatter parsed in step 1
- If `budget_status` is `OK`, skip consolidation phase even if proposals exist
- If `budget_status` is `Warning` or `Over Budget` and proposals exist, create consolidation phase
- If `budget_status` is absent, treat as `OK` (steward didn't run, safe default is skip)
- Prune -> "delete" task, Parameterize -> "refactor" task, Promote -> "delete-and-verify" task, Merge -> "reorganize" task
- Each task includes verbatim steward file paths from the `source` field
- Each task includes the steward's `estimated_reduction` count
- Each task includes "Run test suite" as the final verification step
- All proposals grouped into single "Test Suite Consolidation" phase positioned last

### Claude's Discretion
- Exact wording of the budget gating guard clause and log message when skipping
- Formatting of individual task entries in the step 5 presentation
- Whether to show estimated total reduction as a sum in the phase header
- Internal ordering of tasks within the consolidation phase (by strategy or by proposal order)

### Deferred Ideas (OUT OF SCOPE)
- Edge case validation for empty proposals, steward disabled, consolidation-only gaps, and autopilot flow (Phase 77)
- Regression testing that existing gap types remain unaffected (Phase 77)
- `gsd health` reporting on pending consolidation proposals (post-v2.8, FUTURE-01)
- Estimated budget projection in gap plan presentation (post-v2.8, FUTURE-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-01 | plan-milestone-gaps parses `gaps.test_consolidation` from frontmatter alongside existing gap types | Already done in Phase 75; Phase 76 extends with budget_status extraction |
| PARSE-02 | When `gaps.test_consolidation` is absent or empty, skip with no error | Already done in Phase 75 guard clause; Phase 76 inherits this |
| PARSE-03 | Consolidation phase created only when budget_status is Warning or Over Budget | Budget gating logic added to step 3 |
| PHASE-01 | All proposals grouped into single "Test Suite Consolidation" phase | Already done in Phase 75 grouping rule; Phase 76 adds task detail |
| PHASE-02 | Consolidation phase is always last in gap closure sequence | Already done in Phase 75 grouping rule |
| PHASE-03 | Consolidation phase appears in gap closure plan presentation with tasks | Step 5 presentation extension |
| TASK-01 | Prune -> delete tasks with source file paths and test suite verification | Strategy mapping in gap_to_phase_mapping section |
| TASK-02 | Parameterize -> refactor tasks specifying test.each conversion | Strategy mapping in gap_to_phase_mapping section |
| TASK-03 | Promote -> delete-and-verify tasks referencing subsuming test | Strategy mapping in gap_to_phase_mapping section |
| TASK-04 | Merge -> reorganize tasks specifying source and target files | Strategy mapping in gap_to_phase_mapping section |
| TASK-05 | Each task includes steward's estimated_reduction count | Included in all four task templates |
</phase_requirements>

## Standard Stack

Not applicable. This phase modifies a markdown workflow file (`plan-milestone-gaps.md`). No libraries, no code, no dependencies.

## Architecture Patterns

### Pattern: Workflow Markdown Extension
**What:** Add instructions to an existing `.md` workflow file that an LLM orchestrator reads and follows.
**When to use:** When extending GSD workflow capabilities.
**Confidence:** HIGH (established pattern from Phase 75)

### Pattern: Guard Clause for Optional Fields
**What:** `const x = field || default;` with early-return when field is absent.
**Established in:** Phase 75 (`const consolidationGaps = gaps.test_consolidation || [];`)
**Phase 76 addition:** Same pattern for `test_health.budget_status` with default to `OK` when absent.

### Pattern: Gap-to-Phase Mapping Templates
**What:** YAML task templates in the `<gap_to_phase_mapping>` section that show how gaps translate to tasks.
**Established in:** Existing requirement/integration/flow gap templates in plan-milestone-gaps.md.
**Phase 76 addition:** Four new templates (prune/parameterize/promote/merge) following the same structure.

## Don't Hand-Roll

Not applicable. Pure workflow markdown extension.

## Common Pitfalls

### Pitfall 1: Budget Status Case Sensitivity
**What goes wrong:** Budget status values are exact strings from the steward ("OK", "Warning", "Over Budget"). Case mismatch causes gating to always skip.
**How to avoid:** Match exact strings from steward output.

### Pitfall 2: Forgetting Absent Budget Status
**What goes wrong:** If `test_health.budget_status` is absent (steward disabled), code crashes or creates consolidation phase when it shouldn't.
**How to avoid:** Default absent to "OK" — no consolidation.

### Pitfall 3: Modifying Phase 75's Existing Work
**What goes wrong:** Accidentally rewriting the guard clause or grouping rule already added in Phase 75.
**How to avoid:** Phase 76 additions are surgical — add budget gating, task templates, and presentation detail. Don't touch the step 1 parsing or step 3 grouping rule from Phase 75.

## Integration Points

All changes are within `get-shit-done/workflows/plan-milestone-gaps.md`:
1. **Step 1** — Add `test_health.budget_status` to frontmatter field extraction list
2. **Step 3** — Add budget gating before consolidation phase creation (between the existing grouping rule and the example)
3. **`<gap_to_phase_mapping>`** — Add test consolidation mapping section with four strategy templates
4. **Step 5** — Add consolidation phase to presentation with task-level detail

## Sources

### Primary (HIGH confidence)
- Phase 75 SUMMARY (75-01-SUMMARY.md) — documents what was implemented
- Design doc (2026-03-20-test-steward-consolidation-bridge-design.md) — full specification
- plan-milestone-gaps.md (current state) — target file for modifications
- CONTEXT.md (76-CONTEXT.md) — locked decisions

## Metadata

**Confidence breakdown:**
- Architecture: HIGH — follows established Phase 75 pattern
- Integration points: HIGH — exact locations identified in the file
- Task mapping: HIGH — design doc provides verbatim YAML templates

**Research date:** 2026-03-20
**Valid until:** N/A (internal workflow, not version-dependent)
