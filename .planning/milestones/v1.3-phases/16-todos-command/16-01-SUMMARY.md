---
phase: 16-todos-command
plan: 01
subsystem: cli
tags: [cli, todos, frontmatter-parsing, ansi]

requires:
  - phase: 14-cli-infrastructure
    provides: CLI framework with routing, output formatting, project discovery
provides:
  - handleTodos command with list, filter, and detail modes
  - gatherTodosData helper for structured todo data access
  - getTodoDetail helper for single todo file reading
affects: [17-health-command, 18-settings-help]

tech-stack:
  added: []
  patterns: [todo-data-gathering-pattern]

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/cli.cjs
    - tests/cli.test.cjs

key-decisions:
  - "Replicated cmdListTodos file-reading logic inline rather than calling it: avoids output() side effect"
  - "Parsed --area flag from process.argv directly: parseArgs drops unknown -- flags by design"
  - "Used regex matching on frontmatter fields: consistent with existing cmdListTodos pattern"
  - "Extracted body content by finding second --- fence: handles YAML frontmatter correctly"

patterns-established:
  - "Data gathering helper pattern: gatherTodosData(projectRoot, area) separates data access from rendering"
  - "Detail helper pattern: getTodoDetail(projectRoot, id) returns null for missing files"
  - "Command-specific flag parsing: handler parses own flags from process.argv when parseArgs drops them"

requirements-completed:
  - TODO-01
  - TODO-02
  - TODO-03

duration: 8min
completed: 2026-03-03
---

# Phase 16: Todos Command Summary

**CLI todos command with list, area-filter, and detail modes reading .planning/todos/pending/**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced handleTodos stub with full implementation supporting list, filter, and detail modes
- List mode returns all pending todos with ID, title, area, and created date
- Area filtering via --area=value and --area value flags parsed from process.argv
- Detail mode returns full todo content including markdown body below frontmatter
- Rich mode renders colored output with DIM IDs, CYAN area tags, and BOLD headers
- Error handling for non-existent todo IDs with actionable suggestion
- Empty state messages for no todos and no matching area
- 7 new unit tests and 1 new integration test covering all TODO requirements

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement handleTodos in cli.cjs** - `dfc2504` (feat)
2. **Task 2: Update and add tests for todos command** - `12016db` (test)

## Files Created/Modified
- `get-shit-done/bin/lib/cli.cjs` - Added gatherTodosData, getTodoDetail, and handleTodos functions
- `tests/cli.test.cjs` - Updated existing stub test, added handleTodos test suite and integration test

## Decisions Made
- Replicated file-reading logic from cmdListTodos rather than importing it to avoid stdout side effects
- Parsed --area from process.argv since parseArgs intentionally drops unknown flags
- Used separate gatherTodosData and getTodoDetail helpers following the gatherProgressData pattern

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- CLI framework pattern established for remaining commands
- Health command (Phase 17) can follow same handler pattern
- Settings/help commands (Phase 18) can follow same pattern

---
*Phase: 16-todos-command*
*Completed: 2026-03-03*
