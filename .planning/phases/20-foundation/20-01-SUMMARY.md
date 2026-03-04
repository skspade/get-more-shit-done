---
phase: 20-foundation
plan: 01
subsystem: cli
tags: [gsd-tools, init, linear, mcp, command-spec]

# Dependency graph
requires:
  - phase: none
    provides: greenfield — first phase of v1.4 milestone
provides:
  - cmdInitLinear function returning JSON context for linear workflow
  - /gsd:linear command spec discoverable by Claude Code
  - init linear routing in gsd-tools.cjs
affects: [21-workflow, 22-scoring, 23-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns: [init-subcommand-pattern]

key-files:
  created:
    - commands/gsd/linear.md
  modified:
    - get-shit-done/bin/lib/init.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/init.test.cjs

key-decisions:
  - "No Linear-specific data in init output — MCP tool names and issue ID formats belong in the workflow (Phase 21), not init"

patterns-established:
  - "Init subcommand pattern: cmdInitLinear follows cmdInitQuick structure for consistency"

requirements-completed: [INIT-01, CMD-01]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 20 Plan 01: CLI Init Linear + Command Spec Summary

**cmdInitLinear function with JSON context (models, paths, quick numbering) and /gsd:linear command spec with Linear MCP tools**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T03:49:08Z
- **Completed:** 2026-03-04T03:51:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- cmdInitLinear function returning JSON context for the linear workflow (models, config, quick task numbering, paths, existence flags)
- /gsd:linear command spec with Linear MCP tools (get_issue, list_comments, create_comment, list_issues) in allowed-tools
- Full test coverage for cmdInitLinear (7 tests covering models, config, numbering, timestamps, paths, existence)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for cmdInitLinear** - `f63412e` (test)
2. **Task 1 (GREEN): Implement cmdInitLinear and register in gsd-tools** - `aa006a0` (feat)
3. **Task 2: Create /gsd:linear command spec** - `6ea92ce` (feat)

## Files Created/Modified
- `commands/gsd/linear.md` - /gsd:linear command spec with Linear MCP tools in allowed-tools
- `get-shit-done/bin/lib/init.cjs` - cmdInitLinear function added and exported
- `get-shit-done/bin/gsd-tools.cjs` - 'linear' case added to init switch/case
- `tests/init.test.cjs` - 7 tests for cmdInitLinear covering all required fields

## Decisions Made
- No Linear-specific data in init output — MCP tool names and issue ID formats belong in the workflow (Phase 21), not init. Init focuses on GSD project state (paths, config, numbering).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 20 complete, ready for transition to Phase 21 (Workflow)
- cmdInitLinear provides the JSON context Phase 21's linear.md workflow will consume
- /gsd:linear command spec references workflows/linear.md which Phase 21 creates

---
*Phase: 20-foundation*
*Completed: 2026-03-04*
