---
phase: 54-core-streaming-function
plan: 01
subsystem: infra
tags: [streaming, ndjson, zx, readline, stall-detection]

requires:
  - phase: 53
    provides: "zx autopilot core with claude -p invocations"
provides:
  - "runClaudeStreaming() function for NDJSON streaming"
  - "displayStreamEvent() for real-time output dispatch"
  - "--quiet flag for buffered JSON fallback"
  - "Stall detection timer with repeating warnings"
affects: [55-step-function-integration, 56-debug-retry-integration, 57-config-schema]

tech-stack:
  added: []
  patterns: [ndjson-stream-parsing, readline-async-iteration, stall-timer-rearm]

key-files:
  created: []
  modified: [get-shit-done/scripts/autopilot.mjs]

key-decisions:
  - "Used named function expression (onStall) for timer re-arm instead of arguments.callee to avoid strict mode issues"
  - "Placed streaming functions after config loading section to access getConfig and logMsg"

patterns-established:
  - "NDJSON streaming: createInterface wrapping proc.stdout for async line iteration"
  - "Stall timer: setTimeout with .unref() and try/finally cleanup"
  - "Event dispatch: pure displayStreamEvent function with switch on event.type"

requirements-completed: [STREAM-01, STREAM-02, STREAM-03, STREAM-04, STREAM-05, STREAM-06, STALL-01, STALL-02, STALL-03, STALL-04, CLI-01, CLI-05]

duration: 3min
completed: 2026-03-12
---

# Phase 54: Core Streaming Function — Plan 01 Summary

**runClaudeStreaming() and displayStreamEvent() added to autopilot.mjs with NDJSON parsing, stall detection, --quiet fallback, and stdin redirect preservation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12
- **Completed:** 2026-03-12
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `runClaudeStreaming()` function that spawns claude with `--output-format stream-json` and reads NDJSON lines via readline async iterator
- Added `displayStreamEvent()` pure function that writes assistant text to stdout and tool call indicators to stderr
- Implemented stall detection timer with configurable 5-minute default, repeating re-arm, `.unref()`, and try/finally cleanup
- Added `--quiet` flag to knownFlags and `QUIET` constant for buffered JSON fallback
- Preserved `< /dev/null` stdin redirect on both streaming and quiet code paths

## Task Commits

1. **Task 1: Add --quiet flag and streaming functions** - `d3838fb` (feat)

## Files Created/Modified
- `get-shit-done/scripts/autopilot.mjs` - Added QUIET constant, displayStreamEvent(), runClaudeStreaming() functions

## Decisions Made
- Used named function expression `onStall` for the stall timer callback instead of `arguments.callee` to avoid strict mode compatibility issues
- Placed streaming functions after the Config Loading section (after `MAX_DEBUG_RETRIES`) since `runClaudeStreaming` depends on `getConfig` and `logMsg`

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `runClaudeStreaming()` and `displayStreamEvent()` are ready for Phase 55 to wire into `runStep()` and `runStepCaptured()`
- `--quiet` flag is ready for Phase 57 config schema integration

---
*Phase: 54-core-streaming-function*
*Completed: 2026-03-12*
