---
phase: 67-auto-repair-and-consumer-migration
plan: 02
subsystem: cli
tags: [cli, gsd-tools, migration, backward-compat]
requires:
  - phase: 67-auto-repair-and-consumer-migration
    provides: Auto-repair functions in validation.cjs
provides:
  - CLI health command delegating to validation.cjs
  - gsd-tools validate health routing to validation.cjs
affects: []
tech-stack:
  added: []
  patterns: [legacy-adapter-pattern]
key-files:
  created: []
  modified: [get-shit-done/bin/lib/cli.cjs, get-shit-done/bin/gsd-tools.cjs, tests/cli.test.cjs]
key-decisions:
  - "Legacy adapter preserves E001-E005, W003-W005, I001 error codes"
  - "STRUCT-01f has no legacy mapping (tech debt for Phase 70)"
patterns-established:
  - "CHECK_ID_TO_LEGACY mapping for backward-compatible error codes"
requirements-completed: [INT-01, INT-02, INT-04, INT-06]
duration: 5min
completed: 2026-03-16
---

# Plan 67-02 Summary: CLI and gsd-tools Consumer Migration

**Status:** Complete
**Duration:** ~5 min

## What Was Built

Migrated the `gsd health` CLI command and `gsd-tools.cjs validate health` dispatch to delegate to `validateProjectHealth()` from validation.cjs.

- **handleHealth** now calls `validateProjectHealth()` and maps results through a legacy adapter that preserves error codes E001-E005, W003-W005, I001
- **--fix flag** added to CLI health command, triggers `autoRepair: true`
- **gsd-tools.cjs** validate health case routes to `validateProjectHealth()` with backward-compatible JSON output
- **gatherHealthData** is now unused (removed in Plan 67-03)

## Key Files

| File | Action |
|------|--------|
| `get-shit-done/bin/lib/cli.cjs` | Modified — handleHealth rewritten with validation adapter |
| `get-shit-done/bin/gsd-tools.cjs` | Modified — validate health dispatch uses validateProjectHealth |
| `tests/cli.test.cjs` | Modified — updated 3 tests for new validation-backed output |

## Commits

| Hash | Description |
|------|-------------|
| 83a6e1b | feat(67-02): migrate CLI health and gsd-tools to validation.cjs |

## Self-Check

- [x] INT-01: gsd health delegates to validateProjectHealth
- [x] INT-02: gsd health --fix enables auto-repair
- [x] INT-04: gsd-tools validate health routes to validation.cjs
- [x] INT-06: Legacy error codes preserved via CHECK_ID_TO_LEGACY mapping
- [x] All 220 tests pass (cli + validation + dispatcher)
