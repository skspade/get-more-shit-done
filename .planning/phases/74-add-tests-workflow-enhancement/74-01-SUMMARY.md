---
phase: 74-add-tests-workflow-enhancement
plan: 01
subsystem: testing
tags: [playwright, e2e, add-tests, workflow]

requires:
  - phase: 71-test-infrastructure-and-detection-foundation
    provides: playwright-detect CLI command and parsePlaywrightOutput
  - phase: 72-gsd-playwright-agent
    provides: scaffolding, spec generation, and failure categorization patterns
  - phase: 73-gsd-ui-test-command
    provides: /gsd:ui-test command using gsd-playwright agent
provides:
  - Playwright-aware execute_e2e_generation step in add-tests workflow
  - Inline scaffolding with user consent prompt
  - Spec generation using gsd-playwright locator hierarchy
  - Playwright failure categorization (app-level vs test-level)
  - E2E summary row populated with real Playwright results
affects: [add-tests, e2e-testing]

tech-stack:
  added: []
  patterns:
    - "Playwright detection gate before E2E generation"
    - "AskUserQuestion three-option scaffolding prompt"
    - "Inline scaffolding mirroring gsd-playwright agent Step 2"
    - "Failure categorization: app-level vs test-level"

key-files:
  created: []
  modified:
    - get-shit-done/workflows/add-tests.md

key-decisions:
  - "Detection runs once at step entry, not per-file"
  - "Scaffolding inline in workflow, not via Task() spawn of gsd-playwright"
  - "App-level vs test-level failure distinction in summary"

patterns-established:
  - "Playwright detection gate pattern for workflow integration"
  - "Scaffolding prompt with scaffold/skip/cancel options"

requirements-completed: [WKFL-01, WKFL-02, WKFL-03, WKFL-04, WKFL-05, WKFL-06]

duration: 3min
completed: 2026-03-20
---

# Phase 74: add-tests Workflow Enhancement Summary

**Playwright detection gate, scaffolding prompt, and spec generation integrated into add-tests execute_e2e_generation step**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced generic execute_e2e_generation with Playwright-aware implementation including detection gate, scaffolding prompt, spec generation, and failure categorization
- Updated summary_and_commit step with Playwright-specific E2E result documentation
- All steps before execute_e2e_generation remain unchanged (WKFL-06 regression constraint)

## Task Commits

1. **Task 1+2: Playwright-aware execute_e2e_generation and summary updates** - `24480b4` (feat)

## Files Created/Modified
- `get-shit-done/workflows/add-tests.md` - Enhanced execute_e2e_generation with Playwright detection, scaffolding, spec generation, failure categorization; updated summary_and_commit with E2E result population guidance

## Decisions Made
- Detection gate placed at top of execute_e2e_generation, running once before any file operations
- Scaffolding uses inline steps (not Task() spawn) to avoid agent overhead for deterministic file writes
- AskUserQuestion with three options: "Scaffold Playwright and continue", "Skip E2E tests", "Cancel"
- App-level failures (ERR_CONNECTION_REFUSED, timeouts) flagged as blockers; test-level failures (locator, assertion) trigger re-run

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 74 is the final phase in v2.7 milestone
- All Playwright integration complete: infrastructure (71), agent (72), command (73), workflow (74)

---
*Phase: 74-add-tests-workflow-enhancement*
*Completed: 2026-03-20*
