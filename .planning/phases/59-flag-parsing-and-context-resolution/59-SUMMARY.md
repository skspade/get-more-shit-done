---
phase: 59-flag-parsing-and-context-resolution
plan: combined
subsystem: infra
tags: [workflow, auto-mode, milestone, init, context-resolution]

requires:
  - phase: none (first phase of v2.5)
provides:
  - auto_mode field in init new-milestone output
  - auto_advance in loadConfig return
  - auto_mode detection block in new-milestone.md
  - context_resolution block in new-milestone.md
affects: [new-milestone, init, core]

tech-stack:
  added: []
  patterns: [auto-mode-detection, context-resolution-priority]

key-files:
  created: []
  modified: [get-shit-done/bin/lib/core.cjs, get-shit-done/bin/lib/init.cjs, get-shit-done/workflows/new-milestone.md, tests/init.test.cjs]

key-decisions:
  - "Context resolution priority: MILESTONE-CONTEXT.md > @file > inline > error"
  - "auto_advance uses nested config section via get() helper"

patterns-established:
  - "Auto-mode detection: flag + config fallback + persist pattern"
  - "Context resolution: ordered priority with early error exit"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, INT-03]

completed: 2026-03-14
---

# Phase 59: Flag Parsing and Context Resolution Summary

**Added --auto flag parsing, config fallback, and context resolution to the new-milestone workflow, plus auto_mode plumbing in init/core.**

## Performance

- **Plans:** 2 (59-01, 59-02)
- **Files modified:** 4

## Accomplishments

- Added `auto_advance` field to `loadConfig` return in core.cjs (default false, reads `workflow.auto_advance` from config)
- Added `auto_mode` field to `cmdInitNewMilestone` output in init.cjs (reflects config.auto_advance)
- Added `auto_mode` detection block to new-milestone.md (--auto flag + config-get fallback + config-set persist)
- Added `context_resolution` block to new-milestone.md (priority: MILESTONE-CONTEXT.md > @file > inline > error with usage message)
- Updated step 2 to use resolved context in auto mode, skipping interactive questioning
- Added tests for auto_mode field in init.test.cjs (field exists, defaults to false, reflects config true)

## Task Commits

1. **Plan 59-01:** `9153b4d` feat(59): add auto_mode to init new-milestone and loadConfig
2. **Plan 59-02:** `5e2d2ed` feat(59): add auto mode and context resolution to new-milestone workflow

## Files Created/Modified

- `get-shit-done/bin/lib/core.cjs` -- Added auto_advance to loadConfig return (line 116)
- `get-shit-done/bin/lib/init.cjs` -- Added auto_mode to cmdInitNewMilestone (line 234)
- `get-shit-done/workflows/new-milestone.md` -- Added auto_mode block (lines 13-34), context_resolution block (lines 36-65), step 2 auto-mode conditional (line 79)
- `tests/init.test.cjs` -- Added auto_mode field assertion (line 819), config reflection test (lines 822-835)

## Deviations from Plan

None

## Issues Encountered

None

---
*Phase: 59-flag-parsing-and-context-resolution*
*Completed: 2026-03-14*
