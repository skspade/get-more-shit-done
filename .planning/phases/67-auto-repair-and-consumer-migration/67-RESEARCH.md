# Phase 67: Auto-Repair and Consumer Migration - Research

**Researched:** 2026-03-16
**Domain:** CJS module integration, CLI migration, auto-repair logic
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-repair triggered by `validateProjectHealth(cwd, { autoRepair: true })` option
- Repairable issues: STATE.md `completed_phases` count, `total_phases` count, `status` field, missing phase directories
- Each repair attempted independently; failure in one does not block others
- Repairs reported in `repairs` array: `{ checkId, action, success, detail }`
- Repair functions attached to check registry entries via existing `repair?` field
- STATE.md count repairs use `countRoadmapPhases()` + `extractFrontmatter()`/`reconstructFrontmatter()` + `fs.writeFileSync()`
- Missing phase directory repair uses `fs.mkdirSync()` with phase name from ROADMAP.md
- Repair execution happens in `validateProjectHealth()` after all checks complete
- `gsd health` CLI delegates to `validateProjectHealth()` with backward-compatible output
- Output shape preserved: `{ status, checks, errors, warnings, info, message }`
- Legacy error codes E001-E005, W001-W009, I001 preserved via mapping
- `gsd health --fix` triggers auto-repair
- `--fix` parsed in `parseArgs()` and passed through `routeCommand()`
- Autopilot pre-flight replaces `.planning/` existence check with `validateProjectHealth(cwd, { autoRepair: true })`
- Autopilot imports via `createRequire` matching existing CJS import pattern
- `gsd-tools.cjs validate health` routes to `validation.cjs`
- `gatherHealthData()` removed from cli.cjs after migration
- `cmdValidateHealth()` removed from verify.cjs after migration

### Claude's Discretion
- Internal structure of the adapter function mapping ValidationResult to legacy output shape
- Exact log message wording in autopilot.mjs for repair reporting
- Whether to create a shared mapping constant for check-ID-to-legacy-code or inline it
- Order of repair attempts within the repair execution loop
- Whether `handleHealth` calls validation with all categories or specific ones

### Deferred Ideas (OUT OF SCOPE)
- Test suite for auto-repair logic and consumer migration (Phase 68)
- Net-zero test count migration of existing health tests (Phase 68)
- Deterministic step detection in `gsd health` output (future)
- Health check suggestions with specific fix commands (future)
- `cmdValidateConsistency()` migration to validation.cjs (not in scope)
</user_constraints>

## Summary

Phase 67 wires the validation module (built in Phases 64-66) into its three consumer surfaces: the `gsd health` CLI command, the autopilot pre-flight check, and the `gsd-tools.cjs validate` dispatcher. It also adds auto-repair logic to fix trivially detectable state drift (stale phase counts, missing directories).

The codebase is well-structured for this migration. `validation.cjs` already exports `validateProjectHealth()` with the full check registry (STRUCT, STATE, NAV, READY checks). The check entries already have the `repair?` field pattern in `runChecks()` (line 635: `repairable: typeof entry.repair === 'function'`), but no checks currently define repair functions. The three consumer integration points are clearly identified in the code.

**Primary recommendation:** Implement in three waves: (1) add repair functions to validation.cjs check entries + repair execution in validateProjectHealth, (2) migrate CLI and gsd-tools consumers, (3) migrate autopilot and remove dead code.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fs (Node built-in) | N/A | File system operations for repair (writeFileSync, mkdirSync) | Already used throughout validation.cjs |
| path (Node built-in) | N/A | Path construction for phase directories | Already used throughout |
| frontmatter.cjs | Local | `extractFrontmatter()` / `reconstructFrontmatter()` for STATE.md repair | Already imported in validation.cjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| core.cjs | Local | `getMilestoneInfo()`, `findPhaseInternal()`, `output()` | Already imported in validation.cjs; `output()` needed for gsd-tools dispatch |
| phase.cjs | Local | `extractPhaseNumbers()` for NAV-04 repair (missing dirs) | Already imported in validation.cjs |
| config.cjs | Local | `CONFIG_DEFAULTS` for READY-04 check | Already imported in validation.cjs |

## Architecture Patterns

### Pattern 1: Repair Function on Check Registry Entry
**What:** Each repairable check gets a `repair(cwd)` function on its registry entry that returns `{ checkId, action, success, detail }`.
**When to use:** For STATE-02, STATE-03, STATE-04 (count/status fixes), and NAV-04 (missing directories).
**Example:**
```javascript
{
  id: 'STATE-02',
  category: 'state',
  severity: 'warning',
  check: (cwd) => { /* existing check logic */ },
  repair: (cwd) => {
    const counts = countRoadmapPhases(cwd);
    const statePath = path.join(cwd, '.planning', 'STATE.md');
    const content = fs.readFileSync(statePath, 'utf-8');
    const fm = extractFrontmatter(content);
    fm.progress.completed_phases = counts.checked;
    const yamlStr = reconstructFrontmatter(fm);
    const body = content.slice(content.indexOf('---', 3) + 3);
    fs.writeFileSync(statePath, `---\n${yamlStr}---${body}`);
    return { checkId: 'STATE-02', action: 'Updated completed_phases count', success: true, detail: `Set to ${counts.checked}` };
  },
},
```

### Pattern 2: Post-Check Repair Execution
**What:** After all checks run, iterate failed repairable checks and call their repair functions.
**When to use:** In `validateProjectHealth()` when `autoRepair: true`.
**Example:**
```javascript
function validateProjectHealth(cwd, options = {}) {
  const { categories, autoRepair } = options;
  const results = runChecks(cwd, { categories });
  const repairs = [];
  if (autoRepair) {
    for (const r of results) {
      if (!r.passed && r.repairable) {
        const entry = checks.find(c => c.id === r.id);
        if (entry && typeof entry.repair === 'function') {
          try {
            const repairResult = entry.repair(cwd);
            repairs.push(repairResult);
          } catch (err) {
            repairs.push({ checkId: r.id, action: 'repair', success: false, detail: err.message });
          }
        }
      }
    }
  }
  // ... build result with repairs
}
```

### Pattern 3: Legacy Code Mapping Adapter
**What:** Thin adapter in `handleHealth()` that maps `ValidationResult` to the existing `{ status, checks, errors, warnings, info }` shape with legacy error codes.
**When to use:** In cli.cjs `handleHealth()` to maintain backward compatibility.

### Anti-Patterns to Avoid
- **Coupling repair to check execution:** Repairs must happen after all checks complete, not inline during check iteration. Otherwise a repair could affect subsequent check results in unpredictable ways.
- **Importing writeStateMd for count fixes:** `writeStateMd()` appends session log entries and has side effects. Direct frontmatter manipulation via `extractFrontmatter()`/`reconstructFrontmatter()` is simpler for count fixes.
- **Changing validation.cjs check IDs:** The semantic IDs (STRUCT-01a, STATE-02, etc.) are the source of truth. Legacy codes exist only in the CLI adapter layer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex | `extractFrontmatter()` from frontmatter.cjs | Handles edge cases, already battle-tested |
| YAML frontmatter writing | String concatenation | `reconstructFrontmatter()` from frontmatter.cjs | Preserves nested structure correctly |
| Phase counting | Manual regex | `countRoadmapPhases()` already in validation.cjs | Already handles `<details>` tag stripping |
| Phase name lookup | File system scan | `findPhaseInternal()` from core.cjs | Already handles normalization and padding |

## Common Pitfalls

### Pitfall 1: Frontmatter Reconstruction Destroys Body Content
**What goes wrong:** Using `reconstructFrontmatter()` on the full file content instead of just the frontmatter object, or losing the body content after the closing `---`.
**Why it happens:** The frontmatter is between the first two `---` delimiters; the body is everything after.
**How to avoid:** Extract frontmatter object, modify it, reconstruct just the YAML, then concatenate with the preserved body content.
**Warning signs:** STATE.md loses its markdown content sections after repair.

### Pitfall 2: handleHealth() Already Has Rich ANSI Formatting
**What goes wrong:** Accidentally breaking the ANSI-formatted output that existing CLI users see.
**Why it happens:** `handleHealth()` builds ANSI-colored strings. The data source changes but the formatting logic must stay.
**How to avoid:** Keep the formatting code in `handleHealth()`. Only replace the data source (from `gatherHealthData()` to `validateProjectHealth()` + adapter).
**Warning signs:** `gsd health` output looks different or loses color coding.

### Pitfall 3: Autopilot Uses Both `.planning/` Check AND GSD_TOOLS Check
**What goes wrong:** Removing the `.planning/` existence check but also removing the GSD_TOOLS file check.
**Why it happens:** Lines 74-83 have four checks: claude CLI, node, `.planning/`, GSD_TOOLS. Only `.planning/` is replaceable by validation.
**How to avoid:** Only replace the `.planning/` check (line 74). Keep the claude, node, and GSD_TOOLS checks as-is since they are environment checks, not project health checks.
**Warning signs:** Autopilot fails when GSD_TOOLS is missing with no clear error message.

### Pitfall 4: Legacy Code Map Missing New Checks
**What goes wrong:** New checks from Phases 65-66 (NAV, READY) that have no legacy code equivalent are dropped from output.
**Why it happens:** Mapping only covers E001-E005, W001-W009, I001 but not newer check IDs.
**How to avoid:** Include all check results in output. Checks without a legacy code mapping use their check ID as the code field.
**Warning signs:** `gsd health --json` shows fewer issues than `validateProjectHealth()` returns.

### Pitfall 5: repair() Function Accessing Wrong `this` Context
**What goes wrong:** Repair functions can't access helper functions like `countRoadmapPhases()`.
**Why it happens:** Repair functions are defined on check objects but need module-level helpers.
**How to avoid:** Use module-level functions directly (they're closures over the module scope). No `this` needed.
**Warning signs:** "countRoadmapPhases is not a function" errors during repair.

## Code Examples

### Existing Pattern: Check Registry Entry (validation.cjs)
```javascript
// Current pattern — checks have id, category, severity, check function
// Repair adds an optional repair function
{
  id: 'STATE-02',
  category: 'state',
  severity: 'warning',
  check: (cwd) => { /* ... */ },
  repair: (cwd) => { /* returns { checkId, action, success, detail } */ },
}
```

### Existing Pattern: handleHealth() Output Shape (cli.cjs line 597-655)
```javascript
// handleHealth returns { command: 'health', status, checks, errors, warnings, info, message }
// The 'message' field contains ANSI-formatted string
// The 'checks' array contains { name, path, passed, detail } objects
// The 'errors' array contains { code, message, fix } objects
```

### Existing Pattern: gsd-tools.cjs Dispatch (line 508-518)
```javascript
case 'validate': {
  const subcommand = args[1];
  if (subcommand === 'health') {
    const repairFlag = args.includes('--repair');
    verify.cmdValidateHealth(cwd, { repair: repairFlag }, raw);
  }
}
```

### Existing Pattern: Autopilot CJS Import (autopilot.mjs line 26-30)
```javascript
const require = createRequire(import.meta.url);
const { findFirstIncompletePhase } = require('../bin/lib/phase.cjs');
const { CONFIG_DEFAULTS } = require('../bin/lib/config.cjs');
const { findPhaseInternal } = require('../bin/lib/core.cjs');
```

### Legacy Code Mapping (from CONTEXT.md + cli.cjs analysis)
```javascript
const CHECK_ID_TO_LEGACY = {
  'STRUCT-01a': 'E001',  // .planning/ not found
  'STRUCT-01b': 'E002',  // PROJECT.md not found
  'STRUCT-01c': 'E003',  // ROADMAP.md not found
  'STRUCT-01d': 'E004',  // STATE.md not found
  'STRUCT-01e': 'W003',  // config.json not found
  'STRUCT-02': null,      // Dynamic: parse error -> E005, invalid profile -> W004, unknown keys -> I001
  'STRUCT-03': 'W005',   // Phase dir naming (maps to W005 from cmdValidateHealth)
  'STRUCT-04': 'I001',   // Orphaned plans
};
// Checks without mapping use their check ID as the code
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gatherHealthData()` in cli.cjs | `validateProjectHealth()` in validation.cjs | Phase 64-66 (current milestone) | Centralized check registry replaces duplicate logic |
| `cmdValidateHealth()` in verify.cjs | `validateProjectHealth()` in validation.cjs | Phase 64-66 (current milestone) | Single source of truth for health checks |
| Ad-hoc `.planning/` check in autopilot | `validateProjectHealth()` call | This phase | Autopilot gets full project health validation |

## Open Questions

1. **STRUCT-02 Dynamic Severity Mapping**
   - What we know: STRUCT-02 returns different severities (error for parse failure, warning for invalid profile, info for unknown keys). Legacy codes are E005 (parse error), W004 (invalid profile), I001 (unknown keys).
   - What's unclear: Whether to split STRUCT-02 into multiple legacy-code entries based on the dynamic `severity` field in the result.
   - Recommendation: Map based on the result's `severity` override field. If severity is 'error', use E005. If 'warning', use W004. If 'info', use I001. This preserves backward compatibility without modifying validation.cjs.

2. **NAV-04 Repair Scope: Missing Directories Only?**
   - What we know: NAV-04 detects both orphan directories (on disk but not in ROADMAP) and missing directories (in ROADMAP but not on disk). REPAIR-02 says "missing phase directories".
   - What's unclear: Whether orphan directory cleanup is also in scope for repair.
   - Recommendation: Only repair missing directories (create them). Orphan cleanup is destructive and should remain manual. This aligns with REPAIR-02 scope.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPAIR-01 | Auto-repair separated from validation via `autoRepair` option | Pattern 2 (post-check repair execution) in validateProjectHealth |
| REPAIR-02 | Repairable issues: STATE.md counts, status, missing phase dirs | Pattern 1 (repair functions on STATE-02, STATE-03, STATE-04, NAV-04) |
| REPAIR-03 | Repair report in `repairs` array | Pattern 2 returns array of `{ checkId, action, success, detail }` |
| REPAIR-04 | Repairs are atomic, independent | Pattern 2 try/catch per repair; failure doesn't block others |
| INT-01 | `gsd health` delegates to `validateProjectHealth()` | Pattern 3 (adapter in handleHealth), replace gatherHealthData call |
| INT-02 | `gsd health --fix` enables auto-repair | Parse --fix in parseArgs, pass autoRepair to validateProjectHealth |
| INT-03 | Autopilot pre-flight calls validateProjectHealth | Replace line 74 .planning check with validation import + call |
| INT-04 | gsd-tools.cjs validate dispatch routes to validation.cjs | Replace verify.cmdValidateHealth with validation.validateProjectHealth + output() |
| INT-05 | Old gatherHealthData/cmdValidateHealth removed | Remove after migration verified working |
| INT-06 | Legacy error codes preserved | CHECK_ID_TO_LEGACY mapping in handleHealth adapter |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- validation.cjs source code — full check registry, runChecks, validateProjectHealth implementation
- cli.cjs source code — gatherHealthData (lines 409-595), handleHealth (lines 597-655), parseArgs pattern
- verify.cjs source code — cmdValidateHealth (lines 535-871), repair logic pattern, module.exports
- autopilot.mjs source code — prerequisite checks (lines 60-83), CJS import pattern (lines 26-30)
- gsd-tools.cjs source code — validate dispatch (lines 508-518)
- frontmatter.cjs — extractFrontmatter, reconstructFrontmatter exports

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all modules are internal, already inspected
- Architecture: HIGH - patterns derived directly from existing codebase
- Pitfalls: HIGH - identified from actual code structure and integration points

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable internal codebase)
