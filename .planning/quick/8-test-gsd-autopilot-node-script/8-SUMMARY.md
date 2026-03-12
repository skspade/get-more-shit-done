---
phase: quick-8
plan: 01
subsystem: testing
tags: [regression-test, static-analysis, stdin, zx, autopilot]

provides:
  - "Regression tests for VoidStream stdin bug in autopilot.mjs"
  - "Static source analysis tests for claude -p invocations"
  - "Argument validation tests for autopilot CLI"
affects: [autopilot, testing]

tech-stack:
  added: []
  patterns: [static-source-analysis-testing]

key-files:
  created: []
  modified: [tests/autopilot.test.cjs]

key-decisions:
  - "Used static source analysis (regex on file content) rather than runtime testing to detect missing < /dev/null redirects"
  - "Hardcoded expected count of 5 shell invocations as a guard against adding new ones without the fix"

requirements-completed: []

duration: 2min
completed: 2026-03-12
---

# Quick Task 8: Autopilot stdin redirect regression tests Summary

**Static analysis regression tests catching zx v8 VoidStream stdin bug plus argument validation tests for autopilot.mjs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T17:13:55Z
- **Completed:** 2026-03-12T17:16:04Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- 4 static analysis tests verify all 5 `claude -p` shell invocations include `< /dev/null` redirect
- Regression protection: removing `< /dev/null` from any invocation causes 2 test failures (confirmed manually)
- 2 argument validation tests confirm unknown positional args and flags are rejected with exit code 1
- Comment and console.log lines correctly excluded from shell invocation detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Add stdin redirect regression tests and source analysis tests** - `8db1a94` (test)

## Files Created/Modified
- `tests/autopilot.test.cjs` - Added 2 new describe blocks: stdin redirect regression (4 tests) and argument validation (2 tests)

## Decisions Made
- Used static source analysis (reading autopilot.mjs as text and filtering lines with regex) instead of runtime testing to detect the `< /dev/null` redirect. This approach needs no `claude` binary, no temp dirs, no network, and runs in <1ms.
- Hardcoded the expected count of 5 shell invocations as an assertion. This guards against adding a 6th invocation without the redirect fix.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing uncommitted changes found in working tree: `autopilot.mjs` had the `< /dev/null` fix applied but not committed, and `package.json` had a version bump to 2.3.1. These are not related to this task and were not committed. Two pre-existing test failures in `roadmap.test.cjs` and `verify-health.test.cjs` were also observed -- unrelated to this task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Regression test suite is in place and will catch future stdin redirect regressions
- The uncommitted `< /dev/null` fix in autopilot.mjs should be committed separately

## Self-Check: PASSED

- FOUND: tests/autopilot.test.cjs
- FOUND: 8-SUMMARY.md
- FOUND: commit 8db1a94

---
*Quick Task: 8-test-gsd-autopilot-node-script*
*Completed: 2026-03-12*
