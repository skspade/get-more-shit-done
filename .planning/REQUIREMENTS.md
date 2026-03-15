# Requirements: GSD Autopilot

**Defined:** 2026-03-15
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v2.6 Requirements

Requirements for Unified Validation Module milestone. Each maps to roadmap phases.

### Validation Module

- [ ] **VAL-01**: validation.cjs module exists at `get-shit-done/bin/lib/validation.cjs` with `validateProjectHealth()` as primary entry point
- [ ] **VAL-02**: Check registry pattern — checks defined as array of `{ id, category, severity, check, repair? }` objects
- [ ] **VAL-03**: Structured `ValidationResult` return type with `healthy`, `checks`, `errors`, `warnings`, `repairs`, `nextPhase`, `phaseStep` fields
- [ ] **VAL-04**: Three-tier severity model (error/warning/info) with aggregate status derived from highest severity
- [ ] **VAL-05**: Category-filtered check execution — `runChecks({ categories: ['readiness'] })` for targeted validation

### Structure Checks

- [ ] **STRUCT-01**: File existence checks migrated from `gatherHealthData()` — `.planning/`, PROJECT.md, ROADMAP.md, STATE.md, config.json, `phases/`
- [ ] **STRUCT-02**: Config JSON validation — parse validity, model_profile enum, unknown key detection
- [ ] **STRUCT-03**: Phase directory naming validation — directories match `NN-name` format
- [ ] **STRUCT-04**: Orphaned plan detection — PLAN.md without corresponding SUMMARY.md

### State Consistency Checks

- [ ] **STATE-01**: STATE.md milestone name matches ROADMAP.md active milestone
- [ ] **STATE-02**: STATE.md `completed_phases` count matches ROADMAP.md `[x]` count for current milestone
- [ ] **STATE-03**: STATE.md `total_phases` matches ROADMAP.md phase count for current milestone
- [ ] **STATE-04**: STATE.md status consistency — `completed` only when all phases checked, `active` when unchecked phases remain

### Phase Navigation Checks

- [ ] **NAV-01**: Phase status via `computePhaseStatus()` instead of regex — use artifact-based inspection as single source of truth
- [ ] **NAV-02**: `findFirstIncompletePhase()` returns a result when milestone status is not `completed`
- [ ] **NAV-03**: Each incomplete phase has a deterministic lifecycle step (discuss/plan/execute/verify)
- [ ] **NAV-04**: Disk vs ROADMAP phase sync — no orphan directories, no missing directories for roadmap phases

### Autopilot Readiness Checks

- [ ] **READY-01**: At least one incomplete phase exists when milestone is active
- [ ] **READY-02**: Next incomplete phase has a deterministic step (no ambiguous artifact state)
- [ ] **READY-03**: No truncated/empty artifacts that could confuse autopilot step inference
- [ ] **READY-04**: Config has valid autopilot settings (validates against `KNOWN_SETTINGS_KEYS`)

### Auto-Repair

- [ ] **REPAIR-01**: Auto-repair separated from validation — `autoRepair` option on `validateProjectHealth()`, not coupled to checks
- [ ] **REPAIR-02**: Repairable issues: STATE.md phase counts, total phases, status field, missing phase directories
- [ ] **REPAIR-03**: Repair report in results — `repairs` array documenting what was changed
- [ ] **REPAIR-04**: Repairs are atomic — each attempted independently, failures don't block others

### Integration

- [ ] **INT-01**: `gsd health` CLI delegates to `validateProjectHealth()` with backward-compatible output format
- [ ] **INT-02**: `gsd health --fix` flag enables auto-repair via validation module
- [ ] **INT-03**: Autopilot pre-flight calls `validateProjectHealth({ autoRepair: true })` at startup before phase loop
- [ ] **INT-04**: `gsd-tools.cjs` `validate` dispatch entry for workflow access
- [ ] **INT-05**: Old `gatherHealthData()` and `cmdValidateHealth()` code removed after migration
- [ ] **INT-06**: Check IDs backward-compatible — existing E001-E005, W001-W005 codes preserved or mapped

### Testing

- [ ] **TEST-01**: Tests for each check category (STRUCT, STATE, NAV, READY) with mock filesystem
- [ ] **TEST-02**: Tests for auto-repair logic — verify repairs and re-validation
- [ ] **TEST-03**: Autopilot pre-flight integration tests (mock validation results)
- [ ] **TEST-04**: Test count net-zero migration — migrate existing health tests, don't add to budget

## Future Requirements

### Enhanced Diagnostics

- **DIAG-01**: Deterministic step detection in health output ("Phase 64: ready for execute")
- **DIAG-02**: Health check suggestions with specific fix commands

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive repair prompts | PROJECT.md constraint: CLI is read-only, no inquirer-style prompts |
| Deep content validation of markdown | Structure and consistency only, not content quality |
| Network-dependent checks | Environment checks add latency and failure modes |
| Watch mode / continuous monitoring | Over-engineering for on-demand CLI tool |
| Plugin/extensible check system | Zero demand signal, hard-code checks in validation.cjs |
| HTML/dashboard health reports | CLI output + `--json` covers all use cases |
| Repair history / audit log | Git diff covers audit; single-invocation report is sufficient |
| Auto-repair of non-trivial issues | ROADMAP inconsistencies require human judgment |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAL-01 | — | Pending |
| VAL-02 | — | Pending |
| VAL-03 | — | Pending |
| VAL-04 | — | Pending |
| VAL-05 | — | Pending |
| STRUCT-01 | — | Pending |
| STRUCT-02 | — | Pending |
| STRUCT-03 | — | Pending |
| STRUCT-04 | — | Pending |
| STATE-01 | — | Pending |
| STATE-02 | — | Pending |
| STATE-03 | — | Pending |
| STATE-04 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| NAV-04 | — | Pending |
| READY-01 | — | Pending |
| READY-02 | — | Pending |
| READY-03 | — | Pending |
| READY-04 | — | Pending |
| REPAIR-01 | — | Pending |
| REPAIR-02 | — | Pending |
| REPAIR-03 | — | Pending |
| REPAIR-04 | — | Pending |
| INT-01 | — | Pending |
| INT-02 | — | Pending |
| INT-03 | — | Pending |
| INT-04 | — | Pending |
| INT-05 | — | Pending |
| INT-06 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |

**Coverage:**
- v2.6 requirements: 34 total
- Mapped to phases: 0
- Unmapped: 34 ⚠️

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after initial definition*
