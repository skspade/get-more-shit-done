---
phase: 73--gsd-ui-test-command
plan: 01
subsystem: commands
tags: [playwright, ui-test, command, e2e]

requires: [agents/gsd-playwright.md, gsd-tools.cjs playwright-detect]
provides:
  - /gsd:ui-test command for generating and running Playwright E2E tests
affects: [phase-74-add-tests-workflow]

tech-stack:
  added: []
  patterns: ["direct agent spawn command (no workflow file)"]

key-files:
  created:
    - commands/gsd/ui-test.md
  modified: []

key-decisions:
  - "Command follows audit-tests.md direct spawn pattern — no workflow file needed"
  - "Phase number is optional — command works with or without phase context"
  - "--scaffold and --run-only are mutually exclusive with explicit error"
  - "find-phase used for phase resolution instead of init phase-op for consistency"

patterns-established:
  - "Flag-based command with mutual exclusion validation"

requirements-completed: [CMD-01, CMD-02, CMD-03, CMD-04, CMD-05]

duration: 2min
completed: 2026-03-20
---

# Phase 73, Plan 01: Create /gsd:ui-test Command Summary

## What Was Built

Created `commands/gsd/ui-test.md` — the `/gsd:ui-test` command that orchestrates Playwright E2E testing. The command parses arguments (phase number, URL, free-text instructions) and flags (`--scaffold`, `--run-only`, `--headed`), detects Playwright state, displays a GSD banner, spawns the `gsd-playwright` agent via `Task()`, and presents structured results.

## Self-Check: PASSED

- [x] File `commands/gsd/ui-test.md` exists with valid YAML frontmatter
- [x] YAML has `name: gsd:ui-test`, `argument-hint` with all flags, `allowed-tools` includes Task
- [x] Process has 6 steps: parse args, resolve phase, detect playwright, banner, spawn agent, display results
- [x] `--scaffold` and `--run-only` mutual exclusion enforced with error message
- [x] Agent spawned with correct `<playwright_input>` block matching `agents/gsd-playwright.md` input spec
- [x] Phase number is optional — command works with or without it
- [x] Banner follows `ui-brand.md` format with `━` characters
- [x] Results parsing handles GREEN, RED, and BLOCKED statuses
- [x] Model resolved via `gsd-tools.cjs resolve-model gsd-playwright --raw`
- [x] Task() includes `First, read agents/gsd-playwright.md` preamble
