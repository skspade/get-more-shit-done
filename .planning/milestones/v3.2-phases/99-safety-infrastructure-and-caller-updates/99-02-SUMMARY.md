---
phase: 99-safety-infrastructure-and-caller-updates
plan: 02
subsystem: infra
tags: [sdk, debug-retry, legacy-cleanup]

requires:
  - phase: 99-safety-infrastructure-and-caller-updates
    provides: getMaxTurns, subtype in runAgentStep return, stepType plumbing
provides:
  - All 3 debug retry call sites migrated to runAgentStep
  - Debug retry narrowed to error_during_execution only
  - Legacy runClaudeStreaming and displayStreamEvent deleted
affects: [phase-100]

tech-stack:
  added: []
  patterns: [subtype-gated retry, non-retryable error early-exit]

key-files:
  created: []
  modified:
    - get-shit-done/scripts/autopilot.mjs

key-decisions:
  - "runStepCaptured returns full result object (not just exitCode) for subtype inspection"
  - "Non-retryable errors write failure state with retryCount=0 to indicate no retries attempted"
  - "DRY_RUN path in runStepCaptured returns result object matching runAgentStep shape"

patterns-established:
  - "Non-retryable check: if subtype !== error_during_execution, skip retry and report immediately"
  - "All step callers pass explicit stepType for TURNS_CONFIG resolution"

requirements-completed: [CALL-02, CALL-03, CLN-01]

duration: 5min
completed: 2026-03-24
---

# Phase 99 Plan 02: Debug Retry Migration and Legacy Deletion Summary

**All 3 debug retry call sites migrated to runAgentStep, retry narrowed to error_during_execution only, runClaudeStreaming/displayStreamEvent deleted**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24
- **Completed:** 2026-03-24
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced runClaudeStreaming at all 3 debug retry call sites with runAgentStep + getMaxTurns('debug')
- Added subtype-gated retry: only error_during_execution triggers debug retry
- error_max_turns and error_max_budget_usd now skip retry and report failure immediately
- Updated runStepCaptured to return full result object for subtype inspection
- Deleted 69 lines of legacy code (displayStreamEvent + runClaudeStreaming)
- Updated all 6 runStepWithRetry callers to pass stepType

## Task Commits

Each task was committed atomically:

1. **Task 1: Debug retry migration and retry narrowing** - `080ef18` (feat)
2. **Task 2: Delete legacy functions** - `f41a12a` (feat)

## Files Created/Modified
- `get-shit-done/scripts/autopilot.mjs` - Debug retry migration, subtype checks, legacy deletion

## Decisions Made
- runStepCaptured now returns the full result object (breaking internal API change from integer to object) -- only callers are runStepWithRetry and runVerifyWithDebugRetry, both updated
- DRY_RUN path returns `{ exitCode: 0, stdout: '', costUsd: 0, subtype: 'success' }` for API consistency

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Claude invocations now go through runAgentStep
- No legacy CLI subprocess code remains
- Ready for Phase 100: MCP Configuration and Observability

---
*Phase: 99-safety-infrastructure-and-caller-updates*
*Completed: 2026-03-24*
