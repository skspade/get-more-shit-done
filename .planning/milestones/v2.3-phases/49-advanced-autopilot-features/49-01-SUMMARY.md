---
plan: 49-01
title: Debug Retry and Output Capture
status: complete
started: 2026-03-10
completed: 2026-03-10
requirements-completed: [REQ-14]
---

# Plan 49-01: Debug Retry and Output Capture — Summary

## What was built

Added output-capturing step execution, debug retry loops, and failure reporting to `autopilot.mjs`:

- `constructDebugPrompt` — builds XML-structured debug prompts matching the bash version
- `writeFailureState` — writes blockers to STATE.md on retry exhaustion
- `clearFailureState` — removes phase failure blockers on success
- `writeFailureReport` — writes detailed FAILURE.md with error context and resume instructions
- `runStepCaptured` — captures stdout to temp file while displaying to terminal
- `runStepWithRetry` — retries failing steps up to MAX_DEBUG_RETRIES times with fresh debugger sessions
- `runVerifyWithDebugRetry` — handles verify crashes, gaps_found, and success (three-branch logic)
- `MAX_DEBUG_RETRIES` reads from config via `getConfig('autopilot.max_debug_retries', 3)`
- Added CJS import for `getVerificationStatus` and `getGapsSummary` from verify.cjs

## key-files

### created
(none — all changes in existing file)

### modified
- get-shit-done/scripts/autopilot.mjs

## Self-Check: PASSED
All planned functions implemented with correct signatures and behavior matching bash reference.
