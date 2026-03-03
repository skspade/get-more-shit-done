---
phase: 12
status: passed
verified: 2026-03-03
requirements_verified:
  - COMP-01
  - COMP-02
---

# Phase 12: Milestone Completion -- Verification

## Phase Goal

Autopilot automatically completes the milestone when the audit passes, performing archival and PROJECT.md evolution without human intervention.

## Success Criteria Verification

### 1. When audit returns "passed", autopilot automatically invokes complete-milestone without waiting for human input

**Status: PASSED**

- `run_milestone_completion` function defined at line 415 of `autopilot.sh`
- Function invokes `/gsd:complete-milestone` via `run_step_with_retry` (line 444), which wraps `claude -p --dangerously-skip-permissions` with debug-retry logic
- Four call sites, all preceding `exit 0`:
  1. **Startup audit-passed** (line 1141): `run_milestone_completion` called when `AUDIT_RESULT -eq 0` after `run_milestone_audit`
  2. **Startup gap-closure-succeeded** (line 1147): `run_milestone_completion` called after `run_gap_closure_loop` returns 0
  3. **Main loop audit-passed** (line 1220): `run_milestone_completion` called when `AUDIT_RESULT -eq 0` in `complete)` case
  4. **Main loop gap-closure-succeeded** (line 1226): `run_milestone_completion` called after `run_gap_closure_loop` returns 0
- All four paths call `run_milestone_completion` before `exit 0` -- no human input required

### 2. Milestone completion runs fully autonomously -- archival, PROJECT.md evolution, and commit all happen without prompts

**Status: PASSED**

- Auto-approve directive in completion prompt (lines 437-441):
  ```
  IMPORTANT: This is running in autopilot mode. Auto-approve ALL interactive confirmations including:
  - Milestone readiness verification
  - Phase directory archival
  - Any other confirmation prompts
  Do not wait for human input at any step.
  ```
- Config mode `"yolo"` (set in `.planning/config.json`) triggers auto-approve in complete-milestone's `verify_readiness` step
- The combination of prompt directive + yolo config ensures complete-milestone runs without interactive blocks

### 3. After milestone completion, autopilot exits cleanly with a success status

**Status: PASSED**

- **Success path:** `print_banner "MILESTONE COMPLETE"` (line 452) prints completion banner, then `return 0` (line 457) returns to caller, which executes `exit 0` (lines 1142, 1148, 1221, 1227)
- **Failure path (completion fails after retries):** `print_halt_report` (line 448) formats halt output, then `exit 1` (line 449) terminates immediately
- **Failure path (version extraction):** `print_halt_report` (line 425) formats error, then `exit 1` (line 426) terminates immediately
- Exit code contract preserved: 0 for success, 1 for failure -- no false exit 0 possible after failed completion

## Requirement Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| COMP-01 | PASSED | `run_milestone_completion` function (line 415) invokes `/gsd:complete-milestone` via `run_step_with_retry` (line 444); called from all four audit-passed/gap-closure exit paths (lines 1141, 1147, 1220, 1226) |
| COMP-02 | PASSED | Auto-approve directive in prompt text (lines 437-441) ensures autonomous execution; config mode "yolo" auto-approves verify_readiness; no interactive prompts block execution |

## Must-Haves Check

| Must-Have | Status | Evidence |
|-----------|--------|---------|
| `run_milestone_completion` function exists encapsulating complete-milestone invocation | PASSED | Defined at line 415, called from all four exit paths |
| Function extracts milestone version from STATE.md via `gsd_tools frontmatter get` and strips "v" prefix | PASSED | `version_raw` extracted at line 420, "v" prefix stripped at line 430: `local version="${version_raw#v}"` |
| Empty version extraction prints error and exits 1 | PASSED | Guard at lines 422-427: empty check, error messages, `print_halt_report`, `exit 1` |
| Function invokes complete-milestone via `run_step_with_retry` with auto-approve directive | PASSED | Prompt at lines 435-441, `run_step_with_retry` at line 444 |
| Failed `run_step_with_retry` calls `print_halt_report` and exits 1 | PASSED | Lines 446-449: check `completion_exit -ne 0`, print error, halt report, `exit 1` |
| Success prints "MILESTONE COMPLETE" banner and returns 0 | PASSED | `print_banner "MILESTONE COMPLETE"` at line 452, `return 0` at line 457 |
| All four exit-0 paths replaced with `run_milestone_completion` before `exit 0` | PASSED | Lines 1141-1142, 1147-1148, 1220-1221, 1226-1227 |
| Startup audit-passed path calls `run_milestone_completion` | PASSED | Line 1141 |
| Startup gap-closure-succeeded path calls `run_milestone_completion` | PASSED | Line 1147 |
| Main loop audit-passed path calls `run_milestone_completion` | PASSED | Line 1220 |
| Main loop gap-closure-succeeded path calls `run_milestone_completion` | PASSED | Line 1226 |
| Milestone completion runs fully autonomously -- no interactive prompts | PASSED | Auto-approve directive at lines 437-441, yolo config mode |

## Score

**2/2 requirements verified. All 3 success criteria passed. 12/12 must-haves verified.**

---
*Phase: 12-milestone-completion*
*Verified: 2026-03-03*
