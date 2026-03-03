---
phase: 19
plan: 2
title: "Add TODO-02 Area Flag Integration Test"
status: complete
started: 2026-03-03
completed: 2026-03-03
requirements-completed:
  - TODO-02
---

# Plan 19-02 Summary: Add TODO-02 Area Flag Integration Test

## What Was Built

Added an integration test in `tests/cli.test.cjs` that exercises the `--area` flag on the `gsd todos` CLI command end-to-end:

1. **Test**: `todos --area filters by area (TODO-02)` in the `gsd-cli binary` integration test suite
2. **Approach**: Creates temp directory with two controlled todo fixtures (bugfix and feature areas), calls CLI binary with `todos --area=bugfix --json`, asserts filtered JSON output contains only matching todos
3. **Coverage**: This is the only automated test that exercises the `--area` flag parsing from `process.argv` through the full CLI binary path

## Requirements Addressed

- TODO-02: Filter todos by area (`gsd todos --area=feature`) - now has automated integration test

## Self-Check: PASSED

- [x] Task executed
- [x] Task committed
- [x] All 86 tests pass (85 existing + 1 new)
- [x] No existing tests broken
