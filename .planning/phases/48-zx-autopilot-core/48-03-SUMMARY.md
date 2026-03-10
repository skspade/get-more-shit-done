---
phase: 48
plan: "03"
title: "Main Loop: State Machine, Phase Navigation, and Startup"
status: complete
started: "2026-03-10"
completed: "2026-03-10"
---

# Plan 48-03: Main Loop and State Machine

## What Was Built

Wired the startup sequence and main loop into autopilot.mjs:

1. **Starting phase** — `findFirstIncompletePhase(PROJECT_DIR)` called directly (no shell-out); `--from-phase` overrides
2. **Phase status** — `getPhaseStep()` uses `findPhaseInternal` + `computePhaseStatus` directly from CJS
3. **Startup banner** — Matches bash format: project, phase, step, circuit breaker, dry-run, log file
4. **Main loop** — `while(true)` with switch on currentStep: discuss, plan, execute, verify, complete
5. **Phase advancement** — `nextIncompletePhase(PROJECT_DIR, CURRENT_PHASE)` called directly; no-progress counter resets
6. **Milestone audit stub** — All-phases-complete path logs stub message for Phase 49
7. **Phase complete** — Uses `gsdTools('phase', 'complete', ...)` shell-out per CONTEXT.md decision

## Key Files

- `get-shit-done/scripts/autopilot.mjs` (MODIFIED — same commit as Plans 01/02, single file)

## Commits

- `12dbbc0` feat(48): implement zx autopilot core script

## Self-Check

- [x] Main loop covers all 5 states: discuss, plan, execute, verify, complete
- [x] findFirstIncompletePhase called directly (not via shell-out)
- [x] nextIncompletePhase called directly (not via shell-out)
- [x] computePhaseStatus called directly (not via shell-out)
- [x] No-progress counter resets on phase advancement
- [x] Phase complete uses gsdTools shell-out (per CONTEXT.md)
- [x] Script executable with correct shebang
