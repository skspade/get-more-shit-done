---
phase: 01-core-loop-infrastructure
plan: 02
subsystem: infra
tags: [bash, autopilot, circuit-breaker, claude-cli, state-machine]

requires:
  - phase: 01-core-loop-infrastructure
    provides: "phase-status gsd-tools command"
provides:
  - "autopilot.sh bash outer loop engine"
  - "Circuit breaker with configurable threshold"
  - "Progress snapshot comparison"
  - "SIGINT clean shutdown with resume instructions"
affects: [autopilot-workflow, ci-automation]

tech-stack:
  added: []
  patterns: [stateless-process-orchestration, artifact-based-state-inference, progress-snapshot-comparison]

key-files:
  created:
    - ".claude/get-shit-done/scripts/autopilot.sh"
  modified: []

key-decisions:
  - "Each step invoked as separate claude -p process (never -c or --resume)"
  - "Progress tracked via git commit count + artifact file count snapshots"
  - "Circuit breaker resets on phase advancement"
  - "Non-zero exit with artifact changes treated as partial success (continue)"
  - "SIGINT trapped for clean shutdown with resume instructions"

patterns-established:
  - "Stateless orchestration: bash script only queries state, never caches"
  - "Progress snapshot: before/after comparison of commits+artifacts per invocation"
  - "Circuit breaker: configurable consecutive no-progress threshold"

requirements-completed: [LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07, LOOP-08, SAFE-01, SAFE-02, SAFE-03]

duration: 12min
completed: 2026-03-01
---

# Phase 1: Core Loop Infrastructure - Plan 02 Summary

**Created autopilot.sh bash engine that drives GSD phases autonomously with fresh context windows and circuit-breaks on 3 consecutive stalls.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2/2 completed
- **Files created:** 1 (autopilot.sh, ~280 lines)

## Accomplishments

1. Created autopilot.sh with main loop that reads phase-status, routes to discuss/plan/execute/verify steps, and advances through phases
2. Each step invoked as fresh `claude -p --dangerously-skip-permissions --output-format json` process
3. Implemented circuit breaker with configurable threshold (default 3) using progress snapshot comparison
4. Progress signals: git commit count + artifact file count in .planning/phases/
5. SIGINT/SIGTERM trapped for clean shutdown with resume instructions
6. Dry-run mode for routing verification without executing claude
7. Prerequisite validation: checks claude, jq, node, .planning/ exist
8. Structured halt report showing iterations, progress signals, and resume command

## Verification

- `bash -n autopilot.sh` passes syntax check
- Script is executable (chmod +x)
- `autopilot.sh --dry-run` shows correct routing (Phase 1 > execute)
- Circuit breaker triggers after 3 dry-run iterations with structured halt report
- SIGINT produces clean shutdown message with resume instructions
- Script correctly detects Phase 1 as starting phase from roadmap

## Self-Check: PASSED
