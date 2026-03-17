---
phase: 67-auto-repair-and-consumer-migration
plan: 01
subsystem: validation
tags: [node:test, auto-repair, tdd, validation]
requires:
  - phase: 66-phase-navigation-and-autopilot-readiness
    provides: validation.cjs with check registry
provides:
  - Auto-repair functions for STATE-02, STATE-03, STATE-04, NAV-04
affects: []
tech-stack:
  added: []
  patterns: [tdd-red-green-refactor]
key-files:
  created: []
  modified: [get-shit-done/bin/lib/validation.cjs, tests/validation.test.cjs]
key-decisions:
  - "Repair functions added to existing check registry entries, not separate"
  - "Independent try/catch per repair for atomic isolation"
patterns-established:
  - "Auto-repair pattern: check.repair() called only when autoRepair flag and check failed"
requirements-completed: [REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04]
duration: 5min
completed: 2026-03-16
---

# Plan 67-01 Summary: Auto-Repair TDD

**Status:** Complete
**Duration:** ~5 min
**Type:** TDD (red-green-refactor)

## What Was Built

Added auto-repair capability to validation.cjs. Four check registry entries now have `repair` functions:

- **STATE-02**: Repairs stale `completed_phases` count by reading ROADMAP.md checked phase count
- **STATE-03**: Repairs stale `total_phases` count by reading ROADMAP.md total phase count
- **STATE-04**: Repairs status from "completed" to "active" when unchecked phases remain
- **NAV-04**: Creates missing phase directories that are in ROADMAP but not on disk (does NOT delete orphans)

The `validateProjectHealth()` function now accepts `{ autoRepair: true }` option. After running all checks, it iterates failed repairable checks and calls their repair functions with independent try/catch isolation.

## TDD Cycle

### RED
- 8 tests added to validation.test.cjs covering all repair scenarios
- 6 tests failed as expected (repair not yet implemented)
- 2 tests passed (no-repair-without-flag, no-orphan-deletion)

### GREEN
- Added `reconstructFrontmatter` import from frontmatter.cjs
- Added repair functions to STATE-02, STATE-03, STATE-04, NAV-04
- Added repair execution loop in validateProjectHealth
- Fixed frontmatter reconstruction newline handling
- All 104 tests pass

## Key Files

| File | Action |
|------|--------|
| `get-shit-done/bin/lib/validation.cjs` | Modified — added repair functions and execution loop |
| `tests/validation.test.cjs` | Modified — added 8 auto-repair tests |

## Commits

| Hash | Description |
|------|-------------|
| 837b8ed | test(67-01): add failing tests for auto-repair |
| a9430e6 | feat(67-01): implement auto-repair functions and repair execution |

## Self-Check

- [x] REPAIR-01: autoRepair option controls repair execution
- [x] REPAIR-02: STATE.md counts, status, and missing dirs are repairable
- [x] REPAIR-03: repairs array documents what was changed
- [x] REPAIR-04: each repair attempted independently with try/catch
- [x] All 104 tests pass
