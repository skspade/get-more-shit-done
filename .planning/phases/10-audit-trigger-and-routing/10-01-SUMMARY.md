---
phase: 10-audit-trigger-and-routing
plan: 01
subsystem: infra
tags: [bash, autopilot, audit, routing, config]

requires:
  - phase: 08-remove-git-tagging
    provides: Clean autopilot.sh without tag-related logic
provides:
  - run_milestone_audit function in autopilot.sh
  - Audit trigger at all-phases-complete detection points
  - Three-way routing based on audit status (passed/gaps_found/tech_debt)
  - Exit code contract (0 for passed, 10 for gaps)
  - auto_accept_tech_debt config integration
affects: [phase-11-gap-closure-loop, phase-12-milestone-completion]

tech-stack:
  added: []
  patterns:
    - "Audit function with structured return codes for downstream consumption"
    - "Config-driven routing for tech_debt acceptance"

key-files:
  created: []
  modified:
    - get-shit-done/scripts/autopilot.sh

key-decisions:
  - "Exit code 10 for gaps_found to avoid conflict with existing codes 0/1/2/130"
  - "Used AUDIT_RESULT variable (not local) in top-level script scope for bash compatibility"
  - "Audit triggered at both startup all-complete path and main loop complete case"

patterns-established:
  - "Exit code contract: 0=passed, 10=gaps_found — downstream phases consume these"
  - "Config key autopilot.auto_accept_tech_debt with default true"

requirements-completed:
  - AUDIT-01
  - AUDIT-02
  - CONF-02

duration: 5min
completed: 2026-03-02
---

# Plan 10-01: Audit Trigger and Routing Summary

**Milestone audit trigger with three-way routing (passed/gaps_found/tech_debt) and configurable tech debt handling in autopilot.sh**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02
- **Completed:** 2026-03-02
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Added `run_milestone_audit` function that invokes `/gsd:audit-milestone` via `run_step_with_retry`, parses MILESTONE-AUDIT.md frontmatter status, and routes to exit codes
- Wired audit trigger into main loop `complete)` case when `next_incomplete_phase` returns empty
- Added audit trigger to startup all-complete path for resume/restart scenarios
- Integrated `auto_accept_tech_debt` config with default `true` for tech debt routing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add audit trigger and routing function** - `641d701` (feat)
2. **Task 2: Wire audit trigger into main loop** - `0972c05` (feat)
3. **Task 3: Handle startup all-complete case** - `e7e282e` (feat)

## Files Created/Modified
- `get-shit-done/scripts/autopilot.sh` - Added `run_milestone_audit` function and wired it into both the main loop complete case and the startup all-complete detection path

## Decisions Made
- Used `AUDIT_RESULT` (uppercase, no `local`) instead of `local audit_result` in top-level script scope for bash compatibility
- Preserved `print_final_report` call before audit invocation so iteration stats are still displayed
- Audit invocation goes through `run_step_with_retry` for the same resilience as execution steps

## Deviations from Plan

### Auto-fixed Issues

**1. [Bash Scope] Fixed local keyword usage in non-function scope**
- **Found during:** Task 3 (startup path implementation)
- **Issue:** Plan used `local audit_result` in top-level script scope; `local` only works inside functions in bash
- **Fix:** Changed to `AUDIT_RESULT` (global variable) in both startup and main loop paths
- **Files modified:** get-shit-done/scripts/autopilot.sh
- **Verification:** `bash -n autopilot.sh` passes syntax check
- **Committed in:** e7e282e (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for bash correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Exit code contract (0=passed, 10=gaps) is established for Phase 11 (Gap Closure Loop) to consume
- Phase 12 (Milestone Completion) can detect exit 0 to know when to invoke complete-milestone
- `autopilot.auto_accept_tech_debt` config key is live with default `true`

---
*Phase: 10-audit-trigger-and-routing*
*Completed: 2026-03-02*
