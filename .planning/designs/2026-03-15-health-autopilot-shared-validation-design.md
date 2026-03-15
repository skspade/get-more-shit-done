# Health Check / Autopilot Shared Validation — Design

**Date:** 2026-03-15
**Approach:** Unified Validation Module

## Module Structure and API

`validation.cjs` will live at `get-shit-done/bin/lib/validation.cjs` alongside the existing `phase.cjs`, `verify.cjs`, and `cli.cjs` modules.

**Exported API:**

```javascript
// Primary entry point — runs all checks, returns structured result
validateProjectHealth(cwd, { autoRepair: false }) → ValidationResult

// Individual check categories (also exported for targeted use)
validateFileStructure(cwd) → CheckResult[]
validateStateConsistency(cwd) → CheckResult[]
validatePhaseNavigation(cwd) → CheckResult[]
validateAutopilotReadiness(cwd) → CheckResult[]
```

**Return types:**

```javascript
ValidationResult = {
  healthy: boolean,           // true if no errors (warnings OK)
  checks: CheckResult[],      // all individual check results
  errors: CheckResult[],      // severity: 'error' only
  warnings: CheckResult[],    // severity: 'warning' only
  repairs: RepairResult[],    // auto-repairs attempted (if enabled)
  nextPhase: number | null,   // resolved next phase (null = none found)
  phaseStep: string | null,   // 'discuss' | 'plan' | 'execute' | 'verify' | null
}

CheckResult = {
  id: string,                 // e.g., 'STRUCT-01', 'NAV-03'
  category: string,           // 'structure' | 'state' | 'navigation' | 'readiness'
  severity: 'error' | 'warning',
  message: string,
  repairable: boolean,        // can auto-repair fix this?
  repairAction: string | null // description of what repair would do
}

RepairResult = {
  checkId: string,
  action: string,
  success: boolean,
  detail: string
}
```

**Dependencies:** Imports from `phase.cjs` (`findFirstIncompletePhase`, `computePhaseStatus`, `extractPhaseNumbers`) and `core.cjs` (`findPhaseInternal`, `normalizePhaseNum`). No new external dependencies.

## Validation Checks

The module performs four categories of checks. Each check has an ID for traceability.

**Category 1: File Structure (STRUCT-xx)**
Migrated from existing `gatherHealthData()`:
- `STRUCT-01`: `.planning/` directory exists
- `STRUCT-02`: `PROJECT.md` exists
- `STRUCT-03`: `ROADMAP.md` exists
- `STRUCT-04`: `STATE.md` exists
- `STRUCT-05`: `config.json` exists and is valid JSON
- `STRUCT-06`: `phases/` directory exists

**Category 2: State Consistency (STATE-xx)**
New checks that bridge the gap between STATE.md and ROADMAP.md:
- `STATE-01`: STATE.md milestone name matches ROADMAP.md active milestone
- `STATE-02`: STATE.md `completed_phases` count matches ROADMAP.md `[x]` count for current milestone
- `STATE-03`: STATE.md `total_phases` matches ROADMAP.md phase count for current milestone
- `STATE-04`: STATE.md status (`completed` vs `active`) is consistent with ROADMAP phase checkboxes — if all phases checked, status should be `completed`; if unchecked phases remain, status should not be `completed`

**Category 3: Phase Navigation (NAV-xx)**
Uses `phase.cjs` functions directly — the same logic autopilot uses:
- `NAV-01`: `findFirstIncompletePhase()` returns a result when milestone status is not `completed` (error if null but phases remain)
- `NAV-02`: For each incomplete phase, `computePhaseStatus()` returns a valid step (`discuss`/`plan`/`execute`/`verify`)
- `NAV-03`: Phase directory exists on disk for every phase listed in ROADMAP.md for the current milestone (warning — some may not be created yet)
- `NAV-04`: No "orphan" phase directories that aren't referenced in ROADMAP.md

**Category 4: Autopilot Readiness (READY-xx)**
Checks specific to autopilot startup:
- `READY-01`: At least one incomplete phase exists (otherwise autopilot has nothing to do)
- `READY-02`: The next incomplete phase has a deterministic step (no ambiguous artifact state)
- `READY-03`: No mid-execution state that could confuse autopilot (e.g., a PLAN.md exists but is empty/truncated)
- `READY-04`: `config.json` has no invalid settings that would cause autopilot failures (validates against `KNOWN_SETTINGS_KEYS`)

## Auto-Repair Logic

When `autoRepair: true` is passed, the module attempts to fix trivially repairable issues before reporting. Repairs are atomic — each repair is attempted independently, and failures don't block other repairs.

**Repairable issues:**

| Check | Repair Action |
|-------|---------------|
| `STATE-02` (phase count mismatch) | Update STATE.md `completed_phases` to match actual ROADMAP `[x]` count |
| `STATE-03` (total phases mismatch) | Update STATE.md `total_phases` to match ROADMAP phase count for current milestone |
| `STATE-04` (status inconsistency) | Update STATE.md `status` field to match ROADMAP reality (`active` if unchecked phases remain) |
| `NAV-03` (missing phase directory) | Create the phase directory under `.planning/phases/` |

**Non-repairable issues (report only):**

| Check | Why not repairable |
|-------|-------------------|
| `STRUCT-*` (missing core files) | Project structure requires human setup |
| `STATE-01` (milestone name mismatch) | Ambiguous which is correct — STATE or ROADMAP |
| `NAV-01` (no next phase found) | Could indicate milestone complete or ROADMAP corruption |
| `NAV-04` (orphan directories) | May be intentional or in-progress work |
| `READY-03` (truncated artifacts) | Need human judgment on whether to delete or regenerate |

**Repair workflow:**
1. Run all checks first, collecting results
2. Filter for `repairable: true` checks that failed
3. Attempt each repair, recording `RepairResult`
4. Re-run the specific repaired checks to confirm fix
5. Return combined results (original failures + repair outcomes)

## Integration Points

**1. `gsd health` CLI command (`cli.cjs`)**

Refactor `handleHealth()` to delegate to `validation.cjs`:

```javascript
const { validateProjectHealth } = require('./lib/validation.cjs');

function handleHealth(args) {
  const result = validateProjectHealth(cwd, { autoRepair: args.includes('--fix') });
  // Format and display result using existing ANSI formatting
  // Preserve existing --json output format, extended with new check categories
}
```

The existing `gatherHealthData()` function is replaced — its STRUCT-* checks move into `validation.cjs`, and its regex-based phase parsing is removed entirely in favor of `phase.cjs` calls. The `--fix` flag enables auto-repair.

**2. Autopilot startup (`autopilot.mjs`)**

Add a pre-flight validation call before entering the phase loop:

```javascript
const { validateProjectHealth } = createRequire(import.meta.url)('./bin/lib/validation.cjs');

// Before phase loop
const health = validateProjectHealth(cwd, { autoRepair: true });
if (!health.healthy) {
  log('error', 'Pre-flight validation failed:');
  health.errors.forEach(e => log('error', `  ${e.id}: ${e.message}`));
  process.exit(1);
}
// Use health.nextPhase and health.phaseStep to seed the loop
```

Auto-repair is enabled by default in autopilot — it should self-heal trivial state drift before failing.

**3. `gsd-tools.cjs` dispatch**

Add a new dispatch entry so workflows can call validation:

```
node gsd-tools.cjs validate          → runs validateProjectHealth, outputs JSON
node gsd-tools.cjs validate --fix    → runs with autoRepair: true
```

**4. Backward compatibility**

- `gsd health` output format stays the same (pass/fail with details), just with more checks
- `--json` flag continues to work, extended with new check categories
- Autopilot behavior unchanged if project is healthy — pre-flight is invisible on success

## Migration Plan

**What moves out of `cli.cjs`:**
- File existence checks (STRUCT-01 through STRUCT-06) → `validation.cjs`
- Config validation logic → `validation.cjs`
- `gatherHealthData()` function → replaced by `validateProjectHealth()`
- Phase regex parsing (`/Phase:\s*(\d+)\s+of\s+\d+/`) → deleted, replaced by `phase.cjs` calls

**What stays in `cli.cjs`:**
- `handleHealth()` — the CLI command handler that formats/displays results
- ANSI formatting and `--json` output logic
- All other CLI commands (progress, todos, settings, help)

**What changes in `autopilot.mjs`:**
- Add `createRequire` import of `validation.cjs`
- Add pre-flight call before phase loop entry
- Use `health.nextPhase` as initial phase instead of calling `findFirstIncompletePhase` separately (it's already resolved during validation)

**What changes in `gsd-tools.cjs`:**
- Add `validate` command dispatch entry

**Test impact:**
- Existing health check tests need updating to test via `validation.cjs` API
- New tests for each check category (STATE-*, NAV-*, READY-*)
- New tests for auto-repair logic
- Autopilot pre-flight tests (mock validation results)
