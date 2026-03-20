---
phase: 76
plan: 01
subsystem: workflows
tags: [plan-milestone-gaps, test-consolidation, budget-gating, task-mapping]

requires:
  - phase: 75
    provides: "gaps.test_consolidation schema, parsing, and grouping rule"
provides:
  - "Budget gating for test consolidation (OK skips, Warning/Over Budget proceeds)"
  - "Strategy-to-task mapping templates (prune/delete, parameterize/refactor, promote/delete-and-verify, merge/reorganize)"
  - "Consolidation phase presentation in step 5 with task-level detail"
affects: [phase-77, plan-milestone-gaps]

tech-stack:
  added: []
  patterns: ["budget gating guard before consolidation phase creation", "strategy-to-task-type mapping with verbatim steward fields"]

key-files:
  created: []
  modified: [get-shit-done/workflows/plan-milestone-gaps.md]

key-decisions:
  - "Default absent budget_status to OK (steward didn't run, safe to skip consolidation)"
  - "Budget gating placed before grouping rule so proposals are never grouped when budget is OK"
  - "Task templates use verbatim steward fields without re-interpretation"
  - "Consolidation phase presentation shows estimated total reduction as sum"

patterns-established:
  - "Budget gating pattern: check budget_status before creating optional cleanup phases"
  - "Strategy-to-task mapping: each steward strategy has a named task type (delete, refactor, delete-and-verify, reorganize)"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PHASE-01, PHASE-02, PHASE-03, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05]

duration: 3min
completed: 2026-03-20
---

# Phase 76: Proposal Extraction and Task Mapping Summary

**Budget gating and four strategy-to-task mapping templates added to plan-milestone-gaps for test consolidation proposals**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `test_health.budget_status` extraction to step 1 with OK default for absent values
- Added budget gating to step 3: OK budget skips consolidation, Warning/Over Budget proceeds
- Added four strategy-to-task mapping templates in gap_to_phase_mapping section (prune->delete, parameterize->refactor, promote->delete-and-verify, merge->reorganize)
- Added consolidation phase presentation to step 5 with per-task detail and estimated total reduction

## Task Commits

Each task was committed atomically:

1. **Task 1: Add budget_status extraction and budget gating logic** - `26e5e84` (feat)
2. **Task 2: Add strategy-to-task mapping templates and step 5 presentation** - `2aabbc3` (feat)

## Files Created/Modified
- `get-shit-done/workflows/plan-milestone-gaps.md` - Added budget_status extraction (step 1), budget gating (step 3), strategy-to-task templates (gap_to_phase_mapping), and consolidation presentation (step 5)

## Decisions Made
- Default absent `budget_status` to `OK` — when steward hasn't run, skipping consolidation is the safe default
- Budget gating placed as a guard before the grouping rule, not after — prevents unnecessary grouping work
- All four task templates include "Run test suite" as final step even though execute-phase enforces it via hard test gate — explicit is better
- Consolidation presentation shows estimated total reduction as sum of all proposal reductions

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- plan-milestone-gaps.md now handles test consolidation end-to-end: parse, gate, group, map to tasks, present
- Phase 77 can verify edge cases: empty proposals, steward-disabled, consolidation-only gaps, autopilot flow

---
*Phase: 76*
*Completed: 2026-03-20*
