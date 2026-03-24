---
phase: 98-core-sdk-integration
plan: 02
subsystem: infra
tags: [claude-agent-sdk, call-site-migration]

requires:
  - phase: 98-01
    provides: runAgentStep, handleMessage, buildStepHooks functions
provides:
  - "runStep() uses SDK via runAgentStep()"
  - "runStepCaptured() uses SDK via runAgentStep()"
affects: [phase-99]

tech-stack:
  added: []
  patterns: ["Primary call site migration pattern: swap inner invocation, preserve outer logic"]

key-files:
  created: []
  modified: [get-shit-done/scripts/autopilot.mjs]

key-decisions:
  - "Updated dry-run messages to show runAgentStep instead of claude CLI command"
  - "Preserved all 3 debug retry runClaudeStreaming calls for Phase 99 migration"

patterns-established:
  - "Call site migration: change inner function call, keep outer control flow (snapshots, banners, error handling)"

requirements-completed: [CALL-01]

duration: 2min
completed: 2026-03-24
---

# Phase 98: Core SDK Integration — Plan 02 Summary

**Wired runAgentStep to runStep() and runStepCaptured() primary call sites**

## What Changed

1. **`runStep()` (line ~492):** Replaced `runClaudeStreaming(prompt)` with `runAgentStep(prompt)`. Updated dry-run display to show `runAgentStep(...)` instead of the old CLI command.

2. **`runStepCaptured()` (line ~680):** Replaced `runClaudeStreaming(prompt, { outputFile })` with `runAgentStep(prompt, { outputFile })`. Updated dry-run display similarly.

3. **Preserved debug retry sites:** All 3 `runClaudeStreaming` calls in debug retry functions (`runStepWithRetry` line ~741, `runVerifyWithDebugRetry` lines ~785 and ~823) are untouched -- deferred to Phase 99 (CALL-02).

## Call Site Inventory

| Function | Calls runAgentStep | Calls runClaudeStreaming |
|----------|-------------------|------------------------|
| runStep | 1 | 0 |
| runStepCaptured | 1 | 0 |
| runStepWithRetry (debug) | 0 | 1 |
| runVerifyWithDebugRetry (crash) | 0 | 1 |
| runVerifyWithDebugRetry (gaps) | 0 | 1 |
| **Total** | **2** | **3** |

## Self-Check: PASSED

- [x] runStep calls runAgentStep (verified with grep)
- [x] runStepCaptured calls runAgentStep with outputFile (verified with grep)
- [x] Exactly 3 runClaudeStreaming calls remain (debug retry sites)
- [x] runClaudeStreaming and displayStreamEvent functions still exist
- [x] Module imports resolve without errors
