# Architecture Research

**Domain:** Unified validation module integration into existing CJS module ecosystem
**Researched:** 2026-03-15
**Confidence:** HIGH

## System Overview -- Current Architecture

```
                          CONSUMERS
  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │   gsd-cli.cjs      │  │   autopilot.mjs      │  │   gsd-tools.cjs      │
  │  (CLI binary)      │  │  (ESM/zx outer loop) │  │  (workflow dispatch)  │
  │                    │  │  createRequire()      │  │                      │
  └────────┬───────────┘  └───────┬──────────────┘  └──────────┬───────────┘
           │                      │                             │
           │ routeCommand()       │ direct CJS import           │ switch/case
           ▼                      ▼                             ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                         bin/lib/ CJS MODULES                            │
  ├─────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
  │ cli.cjs │phase.cjs │verify.cjs│ core.cjs │config.cjs│ state.cjs  ...  │
  └─────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘
```

### Current Health/Validation Split (the problem)

Today, validation logic lives in three disconnected places:

1. **cli.cjs `gatherHealthData()`** (lines 409-595) -- Uses regex on STATE.md to find phase references, checks file existence, validates config JSON syntax. Returns `{ status, checks, errors, warnings, info }`.

2. **verify.cjs `cmdValidateHealth()`** (lines 535-871) -- More thorough: `.completed` marker checks, ROADMAP checkbox/disk phase sync, stale STATE.md detection, autopilot phase detection via `findFirstIncompletePhase()`. Supports `--repair`. Returns `{ status, errors, warnings, info, repairable_count }`.

3. **autopilot.mjs** (line 74, 450, 1053-1065) -- Does its own ad-hoc pre-flight: checks `.planning/` exists, then uses `findPhaseInternal()` + `computePhaseStatus()` to determine lifecycle step. No unified readiness check.

**Result:** Three consumers each do partial validation with different approaches. `gsd health` (via cli.cjs) misses things that `validate health` (via verify.cjs) catches, and autopilot has no pre-flight validation at all.

## Recommended Architecture -- validation.cjs Integration

```
                          CONSUMERS
  ┌────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │   gsd-cli.cjs      │  │   autopilot.mjs      │  │   gsd-tools.cjs      │
  │  handleHealth()    │  │  preFlight()         │  │  validate dispatch   │
  │  delegates to      │  │  calls validation    │  │  routes to           │
  │  validation.cjs    │  │  + auto-repair       │  │  validation.cjs      │
  └────────┬───────────┘  └───────┬──────────────┘  └──────────┬───────────┘
           │                      │                             │
           ▼                      ▼                             ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                    validation.cjs (NEW)                                  │
  │                                                                         │
  │  runChecks(cwd, options)        -> { status, checks, errors, warnings } │
  │  checkStateConsistency(cwd)     -> { errors, warnings }                 │
  │  checkAutopilotReadiness(cwd)   -> { ready, step, phase, errors }       │
  │  autoRepair(cwd, issues)        -> { repairs[] }                        │
  │                                                                         │
  │  IMPORTS FROM (reads only):                                             │
  │    phase.cjs  -- findFirstIncompletePhase, computePhaseStatus            │
  │    core.cjs   -- findPhaseInternal, getMilestoneInfo                     │
  │    verify.cjs -- getVerificationStatus (optional, for enrichment)        │
  │    config.cjs -- CONFIG_DEFAULTS                                         │
  │    state.cjs  -- writeStateMd (repair only)                              │
  │    frontmatter.cjs -- extractFrontmatter                                 │
  └──────────────────────────────────────────────────────────────────────────┘
           │
           ▼ (uses but does NOT modify)
  ┌──────────────────────────────────────────────────────────────────────────┐
  │    phase.cjs    core.cjs    verify.cjs    config.cjs    state.cjs       │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Changes for v2.6 |
|-----------|----------------|-------------------|
| **validation.cjs** (NEW) | All structural/consistency checks, autopilot readiness, auto-repair | New module |
| **cli.cjs** | CLI formatting, command routing, `handleHealth()` presentation | `gatherHealthData()` replaced by `validation.runChecks()` delegation |
| **verify.cjs** | Plan/summary/artifact verification, VERIFICATION.md parsing | `cmdValidateHealth()` replaced by `validation.runChecks()` delegation |
| **autopilot.mjs** | Outer loop orchestration | Adds pre-flight call to `validation.checkAutopilotReadiness()` |
| **gsd-tools.cjs** | CLI dispatch for workflows | Adds `validate` entries routing to `validation.cjs` |
| **phase.cjs** | Phase CRUD and lifecycle status | No changes (consumed by validation.cjs) |
| **core.cjs** | Shared utilities | No changes (consumed by validation.cjs) |
| **config.cjs** | Config CRUD and defaults | No changes (consumed by validation.cjs) |

## Module Boundary and Export Surface

### validation.cjs -- Proposed Exports

```javascript
module.exports = {
  // Primary entry point -- runs all checks, returns unified result
  runChecks,           // (cwd, { repair?: boolean }) => ValidationResult

  // Granular check functions (composable building blocks)
  checkStructure,      // (cwd) => { checks[], errors[], warnings[] }
  checkStateConsistency, // (cwd) => { errors[], warnings[] }
  checkConfig,         // (cwd) => { errors[], warnings[] }
  checkPhaseSync,      // (cwd) => { errors[], warnings[] }
  checkAutopilotReadiness, // (cwd) => AutopilotReadiness

  // Repair
  autoRepair,          // (cwd, issues[]) => { repairs[] }
};
```

### Return Type Contracts

```javascript
// ValidationResult -- returned by runChecks()
{
  status: 'healthy' | 'degraded' | 'broken',
  checks: [{ name, path, passed, detail }],
  errors: [{ code, message, fix, repairable }],
  warnings: [{ code, message, fix, repairable }],
  info: [{ code, message, fix }],
  repairable_count: number,
  repairs_performed: [{ action, success, path?, error? }] | undefined,
}

// AutopilotReadiness -- returned by checkAutopilotReadiness()
{
  ready: boolean,
  phase: string | null,       // first incomplete phase number
  step: string | null,        // 'discuss' | 'plan' | 'execute' | 'verify'
  errors: string[],           // blocking issues
  warnings: string[],         // non-blocking issues
  repaired: string[],         // auto-repairs performed
}
```

## Dependency Direction (Critical)

```
validation.cjs IMPORTS FROM:
  ├── phase.cjs        (findFirstIncompletePhase, computePhaseStatus, extractPhaseNumbers)
  ├── core.cjs         (findPhaseInternal, getMilestoneInfo, safeReadFile)
  ├── verify.cjs       (getVerificationStatus -- for enrichment only)
  ├── config.cjs       (CONFIG_DEFAULTS)
  ├── state.cjs        (writeStateMd -- repair path only)
  └── frontmatter.cjs  (extractFrontmatter)

validation.cjs IS IMPORTED BY:
  ├── cli.cjs          (gatherHealthData delegation)
  ├── autopilot.mjs    (pre-flight readiness check)
  ├── gsd-tools.cjs    (validate dispatch)
  └── verify.cjs       (cmdValidateHealth delegation) -- SEE BELOW
```

**Circular dependency risk:** `validation.cjs` imports from `verify.cjs` AND `verify.cjs` would import from `validation.cjs`. This is a real concern.

**Resolution:** Move `cmdValidateHealth()` out of `verify.cjs` entirely. The `validate health` dispatch in `gsd-tools.cjs` routes directly to `validation.cjs` instead. `verify.cjs` keeps its verification-specific functions (`getVerificationStatus`, `getGapsSummary`, etc.) and does NOT import from `validation.cjs`. The dependency is one-way: `validation.cjs` -> `verify.cjs`, never reverse.

```
AFTER REFACTOR:

verify.cjs exports: cmdVerifySummary, cmdVerifyPlanStructure, cmdVerifyPhaseCompleteness,
                     cmdVerifyReferences, cmdVerifyCommits, cmdVerifyArtifacts, cmdVerifyKeyLinks,
                     cmdValidateConsistency, getVerificationStatus, getGapsSummary
                     (cmdValidateHealth REMOVED)

validation.cjs exports: runChecks, checkStructure, checkStateConsistency, checkConfig,
                         checkPhaseSync, checkAutopilotReadiness, autoRepair

gsd-tools.cjs validate dispatch:
  'health' -> validation.runChecks()     (was verify.cmdValidateHealth)
  'readiness' -> validation.checkAutopilotReadiness()   (new)
  'consistency' -> verify.cmdValidateConsistency()      (unchanged)
```

## Data Flow

### Health Command Flow (gsd health)

```
User runs: gsd health [--fix]
    │
    ▼
gsd-cli.cjs -> cli.cjs handleHealth()
    │
    ▼ (delegation replaces inline logic)
validation.runChecks(projectRoot, { repair: hasFix })
    │
    ├── checkStructure()    -> file existence checks
    ├── checkConfig()       -> JSON validity, known keys
    ├── checkStateConsistency() -> STATE.md <-> ROADMAP.md sync
    ├── checkPhaseSync()    -> disk <-> roadmap phase agreement
    │
    ├── if repair: autoRepair(cwd, repairableIssues)
    │
    ▼
ValidationResult -> cli.cjs formats with ANSI -> stdout
```

### Autopilot Pre-Flight Flow

```
autopilot.mjs startup
    │
    ▼ (new, after existing .planning/ check)
validation.checkAutopilotReadiness(PROJECT_DIR)
    │
    ├── checkStructure()    -> .planning/, ROADMAP.md, STATE.md exist
    ├── checkConfig()       -> config.json valid
    ├── findFirstIncompletePhase() -> phase exists to work on
    ├── computePhaseStatus() -> deterministic lifecycle step
    │
    ├── if trivial issues: autoRepair() silently
    │
    ▼
{ ready: true, phase: '64', step: 'discuss' }
    │
    ▼
autopilot proceeds with CURRENT_PHASE = result.phase
```

### Workflow Dispatch Flow (gsd-tools validate)

```
Workflow runs: node gsd-tools.cjs validate health --repair
    │
    ▼
gsd-tools.cjs switch('validate')
    │
    ├── 'health' -> validation.runChecks(cwd, { repair })
    ├── 'readiness' -> validation.checkAutopilotReadiness(cwd)
    └── 'consistency' -> verify.cmdValidateConsistency(cwd)  (unchanged)
```

## Architectural Patterns

### Pattern 1: Check Composition

**What:** Individual check functions return `{ errors[], warnings[] }`. `runChecks()` composes them into a unified result.
**When to use:** Always -- each check is independently testable and reusable.
**Trade-offs:** Slight overhead from multiple function calls, but gains independent testability and selective use (autopilot only needs readiness, not all checks).

```javascript
function runChecks(cwd, options = {}) {
  const structure = checkStructure(cwd);
  if (structure.errors.some(e => e.code === 'E001')) {
    // .planning/ missing -- short-circuit
    return { status: 'broken', ...structure, repairable_count: 0 };
  }

  const configResult = checkConfig(cwd);
  const stateResult = checkStateConsistency(cwd);
  const phaseSyncResult = checkPhaseSync(cwd);

  const errors = [...structure.errors, ...configResult.errors,
                  ...stateResult.errors, ...phaseSyncResult.errors];
  const warnings = [...structure.warnings, ...configResult.warnings,
                    ...stateResult.warnings, ...phaseSyncResult.warnings];

  if (options.repair) {
    const repairable = [...errors, ...warnings].filter(i => i.repairable);
    if (repairable.length > 0) {
      autoRepair(cwd, repairable);
    }
  }

  return {
    status: errors.length > 0 ? 'broken' : warnings.length > 0 ? 'degraded' : 'healthy',
    checks: structure.checks,
    errors, warnings,
  };
}
```

### Pattern 2: Consumer Delegation (not duplication)

**What:** `cli.cjs handleHealth()` and `gsd-tools.cjs validate health` delegate to `validation.cjs` instead of reimplementing checks.
**When to use:** When multiple consumers need the same logic.
**Trade-offs:** Creates a dependency, but eliminates the current divergence where `gsd health` and `gsd-tools validate health` produce different results.

```javascript
// cli.cjs -- AFTER refactor
function gatherHealthData(projectRoot) {
  const validation = require('./validation.cjs');
  return validation.runChecks(projectRoot);
}

// handleHealth stays the same -- it formats the result for CLI display
```

### Pattern 3: Lazy Require for Circular Avoidance

**What:** If a module is only needed in one code path, require it inside the function, not at module top.
**When to use:** When imports would create circular dependencies.
**Trade-offs:** Slightly less discoverable, but Node.js CJS handles this well.

```javascript
// validation.cjs -- state.cjs only needed for repair
function autoRepair(cwd, issues) {
  const { writeStateMd } = require('./state.cjs');  // lazy require
  // ...
}
```

## Integration Points

### Changes to Existing Files

| File | Change Type | What Changes |
|------|-------------|--------------|
| **bin/lib/validation.cjs** | NEW | All validation/check/repair logic |
| **bin/lib/cli.cjs** | MODIFY | `gatherHealthData()` delegates to `validation.runChecks()`. Add `--fix` flag parsing to `handleHealth()`. Formatting logic stays. |
| **bin/lib/verify.cjs** | MODIFY | Remove `cmdValidateHealth()`. Keep `cmdValidateConsistency()`, `getVerificationStatus()`, `getGapsSummary()`. |
| **bin/gsd-tools.cjs** | MODIFY | `validate health` routes to `validation.runChecks()` instead of `verify.cmdValidateHealth()`. Add `validate readiness` entry. Import validation.cjs. |
| **scripts/autopilot.mjs** | MODIFY | Add `createRequire` import of `validation.cjs`. Call `checkAutopilotReadiness()` after existing `.planning/` check (line 74-78). Use returned phase/step. |
| **bin/gsd-cli.cjs** | NO CHANGE | Already routes through `cli.cjs` |
| **bin/lib/phase.cjs** | NO CHANGE | Consumed by validation.cjs |
| **bin/lib/core.cjs** | NO CHANGE | Consumed by validation.cjs |
| **bin/lib/config.cjs** | NO CHANGE | Consumed by validation.cjs |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| validation.cjs -> phase.cjs | Direct CJS require, function calls | Read-only: `findFirstIncompletePhase`, `computePhaseStatus`, `extractPhaseNumbers` |
| validation.cjs -> core.cjs | Direct CJS require, function calls | Read-only: `findPhaseInternal`, `getMilestoneInfo`, `safeReadFile` |
| validation.cjs -> verify.cjs | Direct CJS require, function calls | Read-only: `getVerificationStatus` for enrichment. One-way dependency. |
| validation.cjs -> state.cjs | Lazy require in autoRepair only | Write: `writeStateMd` for STATE.md regeneration |
| cli.cjs -> validation.cjs | Direct CJS require, function calls | `gatherHealthData` delegates to `runChecks` |
| autopilot.mjs -> validation.cjs | createRequire CJS import | `checkAutopilotReadiness` called at startup |
| gsd-tools.cjs -> validation.cjs | Direct CJS require, dispatch routing | `validate health`, `validate readiness` |

## Anti-Patterns

### Anti-Pattern 1: Bidirectional Dependencies Between validation.cjs and verify.cjs

**What people do:** Have verify.cjs import from validation.cjs AND validation.cjs import from verify.cjs.
**Why it's wrong:** CJS circular requires cause subtle bugs (empty objects at import time). Even if Node resolves it, it creates a maintenance trap.
**Do this instead:** Move `cmdValidateHealth` out of verify.cjs. validation.cjs imports from verify.cjs (one-way). gsd-tools.cjs routes `validate health` to validation.cjs directly.

### Anti-Pattern 2: Duplicating Check Logic Across Consumers

**What people do:** Copy the same STATE.md parsing regex into validation.cjs, cli.cjs, and autopilot.mjs.
**Why it's wrong:** This is the exact problem v2.6 is solving. Three implementations drift apart.
**Do this instead:** Single implementation in validation.cjs. All consumers call it.

### Anti-Pattern 3: Validation Module Doing Formatting

**What people do:** Have validation.cjs produce ANSI-colored strings.
**Why it's wrong:** Breaks `--json` mode, breaks workflow consumption via gsd-tools. Mixes concerns.
**Do this instead:** validation.cjs returns structured data only. cli.cjs handles ANSI formatting. gsd-tools.cjs returns JSON.

### Anti-Pattern 4: Putting Auto-Repair in Check Functions

**What people do:** Each `check*()` function both detects AND repairs issues.
**Why it's wrong:** Makes checks non-idempotent, impossible to do a dry-run, and couples detection to mutation.
**Do this instead:** Check functions are pure (read-only, return issues). `autoRepair()` is separate, takes issues as input.

## Suggested Build Order

Based on dependency analysis, build in this order:

1. **Create `validation.cjs`** with `checkStructure()`, `checkConfig()`, `checkStateConsistency()`, `checkPhaseSync()`, `runChecks()`, and `autoRepair()`. This is pure new code with no breaking changes. Test in isolation.

2. **Add `checkAutopilotReadiness()`** to validation.cjs. Uses `findFirstIncompletePhase`, `computePhaseStatus`. Test independently.

3. **Refactor `gsd-tools.cjs` dispatch** to route `validate health` to `validation.runChecks()` and add `validate readiness`. Remove verify.cjs dependency for health validation.

4. **Refactor `cli.cjs gatherHealthData()`** to delegate to `validation.runChecks()`. Add `--fix` flag to `handleHealth()`. Keep all ANSI formatting in cli.cjs.

5. **Remove `cmdValidateHealth()` from `verify.cjs`** now that no consumer references it.

6. **Add pre-flight to `autopilot.mjs`** by importing `checkAutopilotReadiness()` via createRequire and calling it after existing prerequisites check.

**Rationale:** Steps 1-2 are additive (no existing code changes). Steps 3-5 are the refactor (swap consumers to new module, then remove old code). Step 6 is the autopilot integration. Each step can be verified independently.

## Check Consolidation Matrix

Mapping existing checks to validation.cjs functions:

| Check | Currently In | Moves To | Function |
|-------|-------------|----------|----------|
| .planning/ exists | cli.cjs, verify.cjs, autopilot.mjs | validation.cjs | `checkStructure()` |
| PROJECT.md exists + sections | cli.cjs, verify.cjs | validation.cjs | `checkStructure()` |
| ROADMAP.md exists | cli.cjs, verify.cjs | validation.cjs | `checkStructure()` |
| STATE.md exists | cli.cjs, verify.cjs | validation.cjs | `checkStructure()` |
| config.json valid JSON | cli.cjs, verify.cjs | validation.cjs | `checkConfig()` |
| config.json known keys | cli.cjs | validation.cjs | `checkConfig()` |
| STATE.md phase refs valid | cli.cjs, verify.cjs | validation.cjs | `checkStateConsistency()` |
| STATE.md current vs ROADMAP completed | cli.cjs | validation.cjs | `checkStateConsistency()` |
| STATE.md milestone name matches ROADMAP | nowhere (new) | validation.cjs | `checkStateConsistency()` |
| STATE.md phase count matches disk | nowhere (new) | validation.cjs | `checkStateConsistency()` |
| Disk phases vs ROADMAP phases | verify.cjs | validation.cjs | `checkPhaseSync()` |
| Phase directory naming | verify.cjs | validation.cjs | `checkPhaseSync()` |
| .completed vs ROADMAP checkbox | verify.cjs | validation.cjs | `checkPhaseSync()` |
| Autopilot phase detection | verify.cjs | validation.cjs | `checkAutopilotReadiness()` |
| Incomplete phases exist | autopilot.mjs (ad-hoc) | validation.cjs | `checkAutopilotReadiness()` |
| Deterministic lifecycle step | autopilot.mjs (ad-hoc) | validation.cjs | `checkAutopilotReadiness()` |
| Missing phase directories (auto-repair) | nowhere (new) | validation.cjs | `autoRepair()` |
| Stale STATE.md counts (auto-repair) | nowhere (new) | validation.cjs | `autoRepair()` |

## Sources

- Direct analysis of existing codebase (HIGH confidence):
  - `bin/lib/cli.cjs` -- `gatherHealthData()` lines 409-595, `handleHealth()` lines 597-655
  - `bin/lib/verify.cjs` -- `cmdValidateHealth()` lines 535-871, `getVerificationStatus()` lines 878-899
  - `bin/lib/phase.cjs` -- `computePhaseStatus()` lines 895-979, `findFirstIncompletePhase()` lines 1034-1055
  - `bin/gsd-tools.cjs` -- validate dispatch lines 508-519
  - `scripts/autopilot.mjs` -- CJS imports lines 27-30, pre-flight lines 60-83
  - `bin/gsd-cli.cjs` -- routing through cli.cjs
  - `bin/lib/core.cjs` -- `findPhaseInternal`, `getMilestoneInfo`
  - `.planning/PROJECT.md` -- v2.6 active requirements

---
*Architecture research for: GSD Autopilot v2.6 unified validation module*
*Researched: 2026-03-15*
