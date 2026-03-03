---
phase: 18
plan: 02
title: Help Command
status: complete
started: 2026-03-03
completed: 2026-03-03
requirements-completed:
  - HELP-01
  - HELP-02
---

# Summary: Plan 18-02 — Help Command

## What Was Built

Extended the existing `handleHelp` function in `cli.cjs` with per-command detailed help:
- **Overview mode** (`gsd help`): Preserved existing behavior listing all commands with descriptions
- **Per-command detail** (`gsd help <command>`): Added `COMMAND_DETAILS` registry with usage, description, flags/arguments, and examples for all 5 commands
- **Unknown command** (`gsd help <unknown>`): Shows error with list of available commands
- Rich, plain, and JSON output modes all work correctly

## Key Files

### Created
None

### Modified
- `get-shit-done/bin/lib/cli.cjs` — Added `COMMAND_DETAILS` registry, extended `handleHelp` to accept `(projectRoot, args)` with per-command detail rendering
- `tests/cli.test.cjs` — Added 6 unit tests and 2 integration tests for help command

## Requirements Addressed
- HELP-01: See all available CLI commands with descriptions
- HELP-02: See detailed help for a specific command

## Self-Check: PASSED
All 85 tests pass with zero failures.

## Deviations
None.
