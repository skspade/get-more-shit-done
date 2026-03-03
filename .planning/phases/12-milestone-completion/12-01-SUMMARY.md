---
phase: 12-milestone-completion
plan: "01"
subsystem: infra
tags: [bash, autopilot, milestone-completion, archival]

requires:
  - phase: 11-gap-closure-loop
    provides: gap closure loop function and audit routing
provides:
  - run_milestone_completion function in autopilot.sh
  - autonomous milestone archival after audit passes
affects: []

tech-stack:
  added: []
  patterns: [milestone-completion-via-claude-p, run-step-with-retry-for-workflows]

key-files:
  created: []
  modified:
    - get-shit-done/scripts/autopilot.sh

key-decisions:
  - "DRY function called from all four exit paths rather than duplicating invocation logic"
  - "Version extracted from STATE.md frontmatter and v-prefix stripped before passing to complete-milestone"
  - "Auto-approve directive included in prompt text for autonomous execution in yolo mode"

patterns-established:
  - "Milestone completion pattern: extract version from STATE.md, invoke complete-milestone via run_step_with_retry"

requirements-completed:
  - COMP-01
  - COMP-02

duration: 5min
completed: 2026-03-03
---

# Phase 12: Milestone Completion Summary

**Autopilot invokes complete-milestone autonomously after audit passes, with version extraction from STATE.md and retry resilience**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `run_milestone_completion` function that extracts milestone version from STATE.md, invokes `/gsd:complete-milestone` via `run_step_with_retry`, and handles success/failure with proper banners and halt reports
- Wired all four `exit 0` paths (startup audit-passed, startup gap-closure-succeeded, main loop audit-passed, main loop gap-closure-succeeded) to call `run_milestone_completion` before exiting
- Auto-approve directive in completion prompt ensures autonomous execution without interactive blocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Add run_milestone_completion function** - `f572fc6` (feat)
2. **Task 2: Wire audit trigger points to milestone completion** - `45121d2` (feat)

## Files Created/Modified
- `get-shit-done/scripts/autopilot.sh` - Added run_milestone_completion function (47 lines) and wired 4 exit-0 paths

## Decisions Made
- Used DRY pattern: single `run_milestone_completion` function called from all four exit paths
- Version extracted via `gsd_tools frontmatter get .planning/STATE.md --field milestone --raw` with v-prefix stripping
- Included auto-approve directive directly in the completion prompt text for autonomous execution
- Used `run_step_with_retry` for resilience (same pattern as audit and gap-planning invocations)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 12 is the final phase of v1.2 milestone
- Autopilot loop is now complete: phases execute, audit runs, gaps close, milestone completes
- No further phases needed

---
*Phase: 12-milestone-completion*
*Completed: 2026-03-03*
