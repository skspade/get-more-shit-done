---
phase: 04-failure-handling
plan: 01
subsystem: infra
tags: [bash, autopilot, debug-retry, output-capture, gsd-debugger, tee]

requires:
  - phase: 03-verification-gates
    provides: "autopilot.sh with verification gate, run_step, get_phase_dir"
provides:
  - "Debug-retry loop that auto-spawns gsd-debugger when steps fail"
  - "Output capture via tee for debugger context"
  - "construct_debug_prompt for building debugger invocations"
  - "run_verify_with_debug_retry for verification gap retries"
  - "Configurable MAX_DEBUG_RETRIES via autopilot.max_debug_retries"
affects: [autopilot, debug-retry, failure-handling]

tech-stack:
  added: []
  patterns: [tee-output-capture, debug-retry-loop, subagent-spawning, temp-file-cleanup]

key-files:
  created: []
  modified:
    - "~/.claude/get-shit-done/scripts/autopilot.sh"
    - "~/.claude/get-shit-done/bin/lib/config.cjs"

key-decisions:
  - "Output captured via tee -a to temp file while still streaming to user in real-time"
  - "pipefail (already set) ensures tee pipeline returns claude's exit code, not tee's"
  - "Existing run_step preserved for run_fix_cycle; new run_step_captured and run_step_with_retry added alongside"
  - "Debug retries use fresh claude -p invocations with symptoms_prefilled and find_and_fix mode"
  - "Debugger failures are non-fatal -- WARNING logged but loop continues to re-run step"
  - "Verification gap retry returns 0 on exhaustion so human gate still presents"

patterns-established:
  - "Debug-retry loop: while true + retry_count + MAX check + spawn debugger + re-run step"
  - "Output capture: run_step_captured with tee -a to temp file"
  - "Temp file lifecycle: mktemp -> TEMP_FILES array -> cleanup_temp on EXIT trap"

requirements-completed: [FAIL-01, FAIL-02]

duration: 8min
completed: 2026-03-02
---

# Phase 4: Failure Handling - Plan 01 Summary

**Added debug-retry loop and output capture to autopilot.sh, spawning gsd-debugger up to N times when steps fail before escalating.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (autopilot.sh 557 -> 934 lines, config.cjs +1 line)

## Accomplishments

1. Added 5 new functions to autopilot.sh:
   - `construct_debug_prompt()` - builds debugger spawn prompt with step name, exit code, error context, phase files
   - `run_step_captured()` - variant of run_step using tee for output capture to temp file
   - `run_step_with_retry()` - wraps run_step_captured with debug-retry loop up to MAX_DEBUG_RETRIES
   - `run_verify_with_debug_retry()` - handles verify step with both crash retry and gaps_found retry
   - `cleanup_temp()` - removes temp files tracked in TEMP_FILES array
2. Updated main loop: execute case uses run_step_with_retry, verify case uses run_verify_with_debug_retry
3. Added MAX_DEBUG_RETRIES config loading from autopilot.max_debug_retries (default 3)
4. Added max_debug_retries: 3 to config.cjs hardcoded autopilot defaults
5. Added EXIT trap for temp file cleanup

## Verification

- `bash -n autopilot.sh` passes syntax check
- 34 references to new functions/variables (grep count)
- MAX_DEBUG_RETRIES loaded from config with default 3
- Existing run_step function preserved for run_fix_cycle
- config.cjs module loads without errors
- Debug retries display in startup banner

## Deviations from Plan

### Auto-fixed Issues

**1. Removed `local` keyword from main loop case variables**
- **Found during:** main loop update
- **Issue:** Plan used `local exec_exit=$?` and `local verify_exit=$?` in the main loop case statement, which is outside any function
- **Fix:** Changed to plain variable assignment `exec_exit=$?` and `verify_exit=$?`
- **Verification:** bash -n passes

---

**Total deviations:** 1 auto-fixed
**Impact on plan:** Necessary correctness fix. No scope creep.

## Self-Check: PASSED
