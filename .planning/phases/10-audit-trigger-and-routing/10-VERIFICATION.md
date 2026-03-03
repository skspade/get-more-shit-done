---
phase: 10
status: passed
verified: 2026-03-02
requirements_verified:
  - AUDIT-01
  - AUDIT-02
  - CONF-02
---

# Phase 10: Audit Trigger and Routing — Verification

## Phase Goal

Autopilot detects when all planned phases are complete and automatically runs the milestone audit, then routes to the correct next action based on audit outcome.

## Success Criteria Verification

### 1. When all roadmap phases show complete, autopilot automatically invokes the milestone audit without human intervention

**Status: PASSED**

- Main loop path (autopilot.sh lines 1009-1030): When `next_incomplete_phase` returns empty in the `complete)` case, `run_milestone_audit` is called automatically
- Startup path (autopilot.sh lines 939-954): When `find_first_incomplete_phase` returns empty, `run_milestone_audit` is called automatically
- Both paths use `run_step_with_retry` which invokes `claude -p` -- no human intervention required

### 2. Autopilot correctly distinguishes between "passed", "gaps_found", and "tech_debt" audit outcomes and takes a different action for each

**Status: PASSED**

- `run_milestone_audit` function (autopilot.sh lines 200-265) has explicit `case` statement handling all three statuses
- `passed` -> "MILESTONE AUDIT PASSED" banner, return 0
- `gaps_found` -> "MILESTONE AUDIT: GAPS FOUND" banner, return 10
- `tech_debt` -> conditional routing based on config (see SC3)
- Unknown status -> error message, return 1
- Each outcome produces a distinct banner and return code

### 3. When `auto_accept_tech_debt` is true, tech-debt-only audit results are treated as passing; when false, they are treated as gaps

**Status: PASSED**

- Config read: `get_config "autopilot.auto_accept_tech_debt" "true"` (default true)
- When `true`: "PASSED (tech debt accepted)" banner, return 0
- When `false`: "GAPS FOUND (tech debt rejected)" banner, return 10
- Config follows existing `autopilot.*` namespace convention

### 4. Audit trigger and routing logic is reachable from the existing autopilot phase loop (no dead code path)

**Status: PASSED**

- Main loop: `while true` -> `complete)` case -> `next_incomplete_phase` returns empty -> `run_milestone_audit` -- natural flow when phases complete sequentially
- Startup: `find_first_incomplete_phase` returns empty -> `run_milestone_audit` -- reachable when script restarts after all phases complete
- Function defined (line 200) before first call (line 945)
- `bash -n autopilot.sh` confirms no syntax errors

## Requirement Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| AUDIT-01 | Verified | `run_milestone_audit` invokes `/gsd:audit-milestone` via `run_step_with_retry` at both all-complete detection points |
| AUDIT-02 | Verified | Three-way status parsing from MILESTONE-AUDIT.md frontmatter with distinct routing per outcome |
| CONF-02 | Verified | `auto_accept_tech_debt` read via `get_config` with default `true`; tech_debt routes based on config |

## Must-Haves Check

| Must-Have | Status |
|-----------|--------|
| When `next_incomplete_phase` returns empty, autopilot invokes `/gsd:audit-milestone` instead of exiting | PASSED |
| Audit result status is parsed from MILESTONE-AUDIT.md frontmatter using `gsd-tools frontmatter get` | PASSED |
| Three-way routing: `passed` -> exit 0, `gaps_found` -> exit 10, `tech_debt` -> conditional | PASSED |
| `auto_accept_tech_debt` config read via `get_config` with default `true` | PASSED |
| When config true, tech_debt treated as passed (exit 0) | PASSED |
| When config false, tech_debt treated as gaps_found (exit 10) | PASSED |
| Audit invocation uses `run_step_with_retry` for resilience | PASSED |
| All new code reachable from existing main loop (no dead code paths) | PASSED |

## Score

**8/8 must-haves verified. All 4 success criteria passed. All 3 requirements covered.**

---
*Phase: 10-audit-trigger-and-routing*
*Verified: 2026-03-02*
