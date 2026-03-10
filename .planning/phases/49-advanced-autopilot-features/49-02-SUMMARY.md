---
plan: 49-02
title: Verification Gate
status: complete
started: 2026-03-10
completed: 2026-03-10
---

# Plan 49-02: Verification Gate — Summary

## What was built

Added TTY-based verification gate to `autopilot.mjs` with approve/fix/abort routing:

- `askTTY` — readline helper reading from `/dev/tty` for piped-stdin compatibility
- `extractAutonomousDecisions` — reads CONTEXT.md, checks for auto-context markers, extracts Claude's Decision lines
- `printVerificationGate` — displays checkpoint box with status, score, gaps, and autonomous decisions
- `handleAbort` — prints state-preserved message and exits with code 2
- `runFixCycle` — prompts for description via TTY, runs plan-phase --gaps, execute-phase --gaps-only, verify-work; resets circuit breaker before/after
- `runVerificationGate` — loops until valid input, re-presents gate after fix cycles
- Input aliases: a/approve/yes/y, f/fix, x/abort/quit/q (case-insensitive, trimmed)
- Main loop verify case wired to use `runVerifyWithDebugRetry` + `runVerificationGate`
- Dry-run mode auto-approves verification gate

## key-files

### created
(none — all changes in existing file)

### modified
- get-shit-done/scripts/autopilot.mjs

## Self-Check: PASSED
All planned functions implemented with correct TTY input handling and routing behavior.
