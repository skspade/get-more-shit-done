# Phase 66: Phase Navigation and Autopilot Readiness - Research

**Researched:** 2026-03-15
**Status:** Complete

## Research Summary

Phase 66 adds two new check categories (NAV and READY) to the validation.cjs check registry. The pattern is well-established from Phase 65's STRUCT and STATE checks.

## Key Findings

### Existing Functions to Delegate To

All NAV and READY checks delegate to functions already in `phase.cjs`:

- `computePhaseStatus(cwd, phaseInfo)` — Returns `{ step, has_context, has_plans, plan_count, summary_count, all_plans_have_summaries, has_verification, phase_complete }`. The `step` field is one of: `'discuss'`, `'plan'`, `'execute'`, `'verify'`, `'complete'`.
- `findFirstIncompletePhase(cwd)` — Returns phase number string or null. Iterates all roadmap phases, calls `computePhaseStatus` on each, returns first where `phase_complete` is false.
- `extractPhaseNumbers(content)` — Returns sorted array of phase number strings from ROADMAP.md content.

These are already exported from `phase.cjs`.

### Existing Helpers in validation.cjs

- `countRoadmapPhases(cwd)` — Strips `<details>` blocks and counts checked/unchecked phases. Already used by STATE checks. NAV-04 needs similar `<details>` stripping.
- `PHASE_DIR_REGEX` (`/^\d{2}(?:\.\d+)*-[\w-]+$/`) — Already defined for STRUCT-03.
- `KNOWN_SETTINGS_KEYS` — Already defined for STRUCT-02.

### Config Validation (READY-04)

`CONFIG_DEFAULTS` in `config.cjs` has these autopilot keys:
- `autopilot.circuit_breaker_threshold` (default: 3)
- `autopilot.max_debug_retries` (default: 3)
- `autopilot.max_audit_fix_iterations` (default: 3)
- `autopilot.auto_accept_tech_debt` (default: true)
- `autopilot.stall_timeout_ms` (default: 300000)

The `autopilot` subkeys to validate against: `circuit_breaker_threshold`, `max_debug_retries`, `max_audit_fix_iterations`, `auto_accept_tech_debt`, `stall_timeout_ms`.

### NAV-01 Design Decision

NAV-01 is a design constraint ("use artifact-based inspection"), not a standalone check. It's satisfied by NAV-02 and NAV-03 calling `computePhaseStatus()` instead of regex. No separate check entry needed, but should register a check that verifies `computePhaseStatus` is callable (confirms the function exists and returns valid data for the current project).

### Truncated Artifact Detection (READY-03)

- CONTEXT.md: check file size > 50 bytes
- PLAN.md: check for `<task` tag or `## Task` heading (same pattern as `cmdPhasePlanIndex`)
- Only check artifacts in the next incomplete phase

### ValidationResult Population

`validateProjectHealth()` currently returns `{ healthy, checks, errors, warnings, repairs, nextPhase: null, phaseStep: null }`. After READY checks run, `nextPhase` and `phaseStep` should be populated. This requires a small change to `validateProjectHealth` to aggregate these from check results.

Approach: READY checks can return extra fields (`nextPhase`, `phaseStep`) in their result objects. The `runChecks` function already passes through all result properties. `validateProjectHealth` can extract these from the first check result that provides them.

### Test Budget

Project: 809/800 tests (over budget). Phase budget: 50 per phase. Tests should be kept minimal -- focus on behavior, not exhaustive combinations. This phase follows the same TDD pattern as Phase 65.

## Check Implementation Plan

| Check ID | Category | Severity | What it validates |
|----------|----------|----------|-------------------|
| NAV-01 | navigation | info | computePhaseStatus returns valid data for current project |
| NAV-02 | navigation | warning | findFirstIncompletePhase returns result when milestone active |
| NAV-03 | navigation | error | Each incomplete phase has deterministic step |
| NAV-04 | navigation | warning | Disk vs ROADMAP phase sync |
| READY-01 | readiness | info | At least one incomplete phase exists |
| READY-02 | readiness | error | Next phase has deterministic step |
| READY-03 | readiness | error | No truncated artifacts in next phase |
| READY-04 | readiness | warning | Config autopilot settings valid |

## Integration Points

- Import `computePhaseStatus`, `findFirstIncompletePhase`, `extractPhaseNumbers` from `phase.cjs`
- Import `CONFIG_DEFAULTS` from `config.cjs`
- Import `findPhaseInternal` from `core.cjs` (already imported via `getMilestoneInfo`)
- Append NAV and READY checks to the existing `checks` array
- Modify `validateProjectHealth` to populate `nextPhase` and `phaseStep` from check results

## RESEARCH COMPLETE
