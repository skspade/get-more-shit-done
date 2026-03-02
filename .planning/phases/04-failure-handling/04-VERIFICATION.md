---
phase: 04-failure-handling
verified: 2026-03-02T16:55:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 4: Failure Handling Verification Report

**Phase Goal:** When execution or verification fails, the autopilot automatically diagnoses and attempts fixes before escalating to the human, with full failure context preserved in state
**Verified:** 2026-03-02
**Status:** passed
**Re-verification:** No -- initial verification (Phase 6 retroactive verification)

## Goal Achievement

### Observable Truths

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | When a step fails, autopilot spawns gsd-debugger via claude -p to diagnose and fix, rather than halting immediately | 04-01 | VERIFIED | `run_step_with_retry` (line 398) calls `construct_debug_prompt` (line 440) then spawns `claude -p --dangerously-skip-permissions` (line 448) on step failure. The loop re-runs the step after each debug attempt. |
| 2 | The debug-retry loop attempts up to N fixes (default 3, configurable via autopilot.max_debug_retries) before escalating | 04-01 | VERIFIED | `MAX_DEBUG_RETRIES` initialized to 3 (line 116), then loaded from config at line 862: `MAX_DEBUG_RETRIES=$(get_config "autopilot.max_debug_retries" "3")`. Loop exits when `retry_count -gt $MAX_DEBUG_RETRIES` (line 419). config.cjs has `max_debug_retries: 3` at line 63. |
| 3 | Each debug retry is a fresh claude -p invocation with failure context from the captured output | 04-01 | VERIFIED | `construct_debug_prompt` (line 200) receives `error_context` parameter (last 100 lines from output, line 433). Each retry spawns a new `claude -p` process (line 448) -- not a resume. Debug prompt includes step name, exit code, error context, phase files. |
| 4 | After each debug attempt, the failed step is re-run to check if the fix worked | 04-01 | VERIFIED | `run_step_with_retry` is a `while true` loop (line 403). After debugger spawns (line 448), the loop continues (line 452 comment), re-running `run_step_captured` on the next iteration. |
| 5 | Debug retry counter resets when the phase advances to a new step | 04-01 | VERIFIED | `retry_count` is a local variable within `run_step_with_retry` (line 401) and `run_verify_with_debug_retry` (line 458). Each function call starts with `retry_count=0`. When the main loop moves to a new step, a new function call resets the counter. |
| 6 | Stdout/stderr from step execution is captured to a temp file while still piped to the user in real-time | 04-01 | VERIFIED | `run_step_captured` (line 369) uses `tee -a "$output_file"` at line 388: output goes to both terminal and temp file simultaneously. `set -uo pipefail` at line 11 ensures the exit code comes from claude, not tee. |
| 7 | After retries are exhausted, autopilot stops cleanly with a human-readable summary of what failed, what was tried, and why it could not be fixed | 04-02 | VERIFIED | `run_step_with_retry` calls `write_failure_state` + `write_failure_report` on exhaustion (lines 422-423) then returns the exit code. Main loop (line 907-909) calls `print_halt_report` which displays: reason, phase, step, exit code, iterations, debug session paths (lines 147-185). |
| 8 | The halt report includes failure type, retry attempts with outcomes, debug session paths, and a resume command | 04-02 | VERIFIED | `print_halt_report` (line 147) shows: reason, phase, step, exit code, total iterations, no-progress count. Lines 166-171 list debug session paths (`autopilot-*.md`). Line 183 provides resume command. `write_failure_report` (line 291) generates FAILURE.md with failure type, retries, error output, debug sessions, resume. |
| 9 | A FAILURE.md file is written to the phase directory with the full failure report | 04-02 | VERIFIED | `write_failure_report` (line 291) constructs `failure_file="$PROJECT_DIR/$phase_dir/${padded_phase}-FAILURE.md"` (line 303). Report includes: failure type, step, exit code, retries, last error output (50 lines), debug sessions list, resume command. Written via heredoc at line 327. |
| 10 | Failure state is written to STATE.md with failure_type, retry_count, max_retries, last_error, affected_step, and debug_sessions | 04-02 | VERIFIED | `write_failure_state` (line 255) constructs blocker text at line 273: `[Phase N FAILURE]: type=$failure_type | step=$step_name | retries=$retry_count/$max_retries | exit_code=$exit_code | debug_sessions=$debug_sessions`. Calls `gsd_tools state add-blocker` (line 274). |
| 11 | Failure state is cleared from STATE.md when the step succeeds after a retry | 04-02 | VERIFIED | `clear_failure_state` (line 279) greps for `Phase $CURRENT_PHASE FAILURE` in blockers (line 284), then calls `gsd_tools state resolve-blocker` (line 287). Called from `run_step_with_retry` on success (line 414) and `run_verify_with_debug_retry` on gap-free verification (line 505). |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `~/.claude/get-shit-done/scripts/autopilot.sh` | Debug-retry loop, output capture, debug prompt construction, failure state/report | VERIFIED | 946 lines; all 8 Phase 4 functions present and substantive; `bash -n` passes; no stubs/TODOs |
| `~/.claude/get-shit-done/bin/lib/config.cjs` | Default config for autopilot.max_debug_retries | VERIFIED | `max_debug_retries: 3` at line 63 in hardcoded autopilot defaults |

**Artifacts:** 2/2 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| autopilot.sh:run_step_with_retry | claude -p (gsd-debugger) | construct_debug_prompt function | WIRED | Line 440: `debug_prompt=$(construct_debug_prompt ...)`, line 448: `claude -p ... "$debug_prompt"`. Pattern matches `claude.*-p.*dangerously-skip-permissions`. |
| autopilot.sh:run_step_with_retry | run_step_captured | tee-based output capture | WIRED | Line 410: `run_step_captured "$prompt" "$step_name" "$output_file"`. run_step_captured uses `tee -a "$output_file"` at line 388. |
| autopilot.sh:write_failure_state | STATE.md | gsd-tools state add-blocker | WIRED | Line 274: `gsd_tools state add-blocker --text "$blocker_text"`. Pattern matches `gsd_tools.*state.*add-blocker`. |
| autopilot.sh:write_failure_report | FAILURE.md | cat > failure_file heredoc | WIRED | Line 303: `failure_file="...$phase_dir/${padded_phase}-FAILURE.md"`. Line 327: `cat > "$failure_file" <<FAILEOF`. Pattern matches `FAILURE.md`. |
| autopilot.sh:clear_failure_state | STATE.md | gsd-tools state resolve-blocker | WIRED | Line 287: `gsd_tools state resolve-blocker --text "$blocker_text"`. Resolves phase-specific failure blockers. |
| autopilot.sh main loop execute case | run_step_with_retry | direct call | WIRED | Line 905: `run_step_with_retry "/gsd:execute-phase $CURRENT_PHASE" "execute"`. |
| autopilot.sh main loop verify case | run_verify_with_debug_retry | direct call | WIRED | Line 913: `run_verify_with_debug_retry "$CURRENT_PHASE"`. |

**Wiring:** 7/7 connections verified

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| FAIL-01 | On execution or verification failure, orchestrator spawns gsd-debugger to diagnose and attempt fix | SATISFIED | `run_step_with_retry` (line 398) wraps execution with retry loop. On failure: extracts error context (line 433), calls `construct_debug_prompt` (line 440), spawns `claude -p` (line 448). `run_verify_with_debug_retry` (line 456) does the same for verify crashes (line 486-493) and verification gaps (line 532-539). Main loop uses both: execute case (line 905), verify case (line 913). |
| FAIL-02 | Debug-retry loop attempts up to N fixes (default 3, configurable) before giving up | SATISFIED | `MAX_DEBUG_RETRIES` loaded from config with default 3 (line 862). Loop counter increments and exits at threshold in: `run_step_with_retry` (line 418-419), `run_verify_with_debug_retry` crash path (line 471-472), and gap path (line 510-511). `config.cjs` has `max_debug_retries: 3` in hardcoded defaults (line 63). Displayed in startup banner (line 887). |
| FAIL-03 | After retries exhausted, orchestrator stops cleanly with human-readable summary | SATISFIED | On exhaustion: `write_failure_report` generates FAILURE.md (line 423/475/515) with failure type, error output, debug sessions, resume command. `print_halt_report` (line 147) shows extended halt box with debug sessions (lines 166-171). Main loop exits with halt report on non-zero return (lines 907-909, 915-917). |
| FAIL-04 | Failure state is written to STATE.md so human can understand and resume | SATISFIED | `write_failure_state` (line 255) calls `gsd_tools state add-blocker` with structured fields: type, step, retries, exit_code, debug_sessions (line 273). Called on exhaustion in all three paths (lines 422, 474, 514). `clear_failure_state` (line 279) removes blockers via `gsd_tools state resolve-blocker` on success (lines 414, 505). |

**Coverage:** 4/4 requirements satisfied

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| autopilot.sh | 406, 463 | `mktemp "/tmp/gsd-autopilot-XXXXXX.log"` | Info | Temp files in /tmp -- acceptable for output capture; cleaned up via cleanup_temp on EXIT trap |

No blocking anti-patterns found:
- All 8 functions are substantive (multi-line implementations with parameters, control flow, and error handling)
- No TODO, FIXME, PLACEHOLDER, or STUB markers found
- All functions are both defined AND called (verified: construct_debug_prompt has 3 call sites, write_failure_state has 3, write_failure_report has 3, clear_failure_state has 2)
- MAX_DEBUG_RETRIES is loaded from config (line 862), not hardcoded in logic (initial declaration at line 116 is overwritten at line 862)
- Existing `run_step` function preserved at line 545 (used by `run_fix_cycle` for human-initiated fix path)

### Phase 4 vs Phase 5 Distinction

Phase 4 (this verification) added 8 functions: `construct_debug_prompt`, `run_step_captured`, `run_step_with_retry`, `run_verify_with_debug_retry`, `cleanup_temp`, `write_failure_state`, `clear_failure_state`, `write_failure_report`.

Phase 5 subsequently modified `extract_verification_status` (lines 673-695) and `extract_gaps_summary` (lines 697-711) to add UAT.md fallback patterns. Phase 5 also fixed `cmdPhaseStatus` in phase.cjs. These Phase 5 changes are NOT credited to Phase 4.

## Human Verification Required

None -- all must-haves are verifiable through code inspection and static analysis.

The one item that would benefit from a live autopilot run:
- **E2E Failure Recovery Test:** Trigger an actual step failure during autopilot and confirm the debugger spawns, retries, and eventually generates FAILURE.md and failure state in STATE.md.
- Why human: Cannot induce real claude -p failures in static analysis.

This is not blocking -- code inspection confirms all wiring is correct and all functions are substantive.

## Gaps Summary

**No gaps found.** Phase 4 goal achieved. All 11 observable truths verified against actual code. All 4 FAIL-xx requirements satisfied with code-level evidence. All 7 key links wired. All 8 Phase 4 functions exist, are substantive, and are called from the appropriate locations.

## Verification Metadata

**Verification approach:** Goal-backward from PLAN.md must_haves
**Must-haves source:** 04-01-PLAN.md frontmatter (6 truths) + 04-02-PLAN.md frontmatter (5 truths)
**Automated checks:** `bash -n` syntax check passed; function existence check 8/8; `gsd-tools frontmatter get` extracted must_haves successfully; `gsd-tools verify artifacts/key-links` failed on tilde path resolution (expected, manual verification performed)
**Human checks required:** 0 (optional E2E test noted above)
**Total verification time:** ~3 min

---
*Verified: 2026-03-02*
*Verifier: Claude (Phase 6 retroactive verification)*
