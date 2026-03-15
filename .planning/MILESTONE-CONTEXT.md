# Milestone Context

**Source:** Brainstorm session (Health Check / Autopilot Shared Validation)
**Design:** .planning/designs/2026-03-15-health-autopilot-shared-validation-design.md

## Milestone Goal

Eliminate the disparity between `gsd health` and autopilot by creating a unified validation module (`validation.cjs`) that both systems call. Health check currently uses regex on STATE.md while autopilot uses ROADMAP.md + artifact inspection via phase.cjs — they must use the same logic. The module also provides auto-repair for trivially fixable state drift (stale STATE.md counts, missing phase directories).

## Features

### Module Structure and API

New `validation.cjs` at `get-shit-done/bin/lib/validation.cjs` with four exported functions: `validateProjectHealth()` (primary entry), `validateFileStructure()`, `validateStateConsistency()`, `validatePhaseNavigation()`, `validateAutopilotReadiness()`. Returns structured `ValidationResult` with checks, errors, warnings, repairs, nextPhase, and phaseStep. Imports from existing `phase.cjs` and `core.cjs` — no new external dependencies.

### Validation Checks

Four check categories with IDs for traceability:
- **STRUCT-xx** (6 checks): File existence — migrated from existing `gatherHealthData()`
- **STATE-xx** (4 checks): STATE.md ↔ ROADMAP.md consistency (milestone name, phase counts, status)
- **NAV-xx** (4 checks): Phase navigation using `phase.cjs` functions directly (`findFirstIncompletePhase`, `computePhaseStatus`)
- **READY-xx** (4 checks): Autopilot-specific readiness (incomplete phases exist, deterministic step, no truncated artifacts, valid config)

### Auto-Repair Logic

When `autoRepair: true`, fixes trivially repairable issues: STATE.md phase counts, total phases, status field, missing phase directories. Non-repairable issues (missing core files, milestone name mismatch, orphan directories, truncated artifacts) are reported only. Repair workflow: run checks → filter repairable failures → attempt repairs → re-verify → return combined results.

### Integration Points

1. `gsd health` CLI: Replace `gatherHealthData()` with `validateProjectHealth()`, add `--fix` flag for auto-repair
2. Autopilot startup: Pre-flight validation with auto-repair enabled, exit on errors, use resolved `nextPhase`/`phaseStep` to seed loop
3. `gsd-tools.cjs`: New `validate` dispatch entry for workflow access
4. Backward compatible: same output format, `--json` extended with new categories

### Migration Plan

Move STRUCT checks and config validation from `cli.cjs` to `validation.cjs`. Delete regex-based phase parsing from health check. Add `createRequire` import in `autopilot.mjs`. Add `validate` command to `gsd-tools.cjs`. Update existing health tests, add new tests for STATE/NAV/READY categories and auto-repair.
