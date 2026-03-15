# Phase 64: Module Foundation and Check Registry - Research

**Researched:** 2026-03-15
**Domain:** CJS module architecture, check registry pattern, validation result types
**Confidence:** HIGH

## Summary

Phase 64 creates `validation.cjs` as a new CJS module following the exact same patterns as the 13 existing `lib/*.cjs` modules. The domain is entirely internal -- no external libraries, no new frameworks, no npm dependencies. The primary challenge is getting the API contract right (check registry shape, result type, category filtering) since all subsequent v2.6 phases build on this foundation.

The existing `gatherHealthData()` in `cli.cjs` (lines 409-595) provides a working reference for the health check pattern this module will eventually replace. The new module must return structured data without any console output or ANSI formatting, following the architecture's separation of validation logic from presentation.

**Primary recommendation:** Follow existing module patterns exactly (CJS, `(cwd, options)` signatures, named exports), implement the check registry as a simple array with `filter()` for category selection, and include one concrete stub check (STRUCT-01: `.planning/` exists) to prove the pipeline end-to-end.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Module lives at `get-shit-done/bin/lib/validation.cjs` (CJS format)
- Zero new dependencies -- Node.js built-ins and existing internal module imports only
- `validateProjectHealth(cwd, options)` as primary entry point
- Named function exports via `module.exports = { ... }` -- no default exports, no classes
- Check registry as module-level array of `{ id, category, severity, check, repair? }` objects
- Check IDs use category prefix format: `STRUCT-01`, `STATE-01`, `NAV-01`, `READY-01`
- Categories: `structure`, `state`, `navigation`, `readiness`
- `ValidationResult` with fields: `healthy`, `checks`, `errors`, `warnings`, `repairs`, `nextPhase`, `phaseStep`
- Three-tier severity: `error`, `warning`, `info`
- `healthy: false` when any error exists, `true` when only warnings/info
- `runChecks({ categories: ['readiness'] })` filters to matching checks; no categories = all checks
- validation.cjs imports FROM: `phase.cjs`, `core.cjs`, `frontmatter.cjs`, `config.cjs`
- validation.cjs must NOT be imported by: `phase.cjs`, `core.cjs`, `verify.cjs`
- `state.cjs` import lazy (inside repair function only)
- Returns structured data only -- no ANSI colors, no console output
- No auto-repair implementation this phase (repair field defined but not wired)
- No consumer migration this phase

### Claude's Discretion
- Internal variable naming within check functions
- Exact JSDoc comment style and depth on exported functions
- Whether to use a helper function for aggregating check results or inline the logic
- Order of checks within the registry array
- Whether stub checks return `{ passed: true }` or are skipped entirely

### Deferred Ideas (OUT OF SCOPE)
- Actual check implementations for STRUCT, STATE, NAV, READY categories (Phase 65-66)
- Auto-repair execution logic (Phase 67)
- Consumer migration: cli.cjs, autopilot.mjs, gsd-tools.cjs delegation (Phase 67)
- Dead code removal from verify.cjs and cli.cjs (Phase 67)
- Test suite for all check categories (Phase 68)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VAL-01 | validation.cjs module at `lib/validation.cjs` with `validateProjectHealth()` entry point | Existing module pattern: `const fs = require('fs'); const path = require('path');` header, `(cwd, options)` signature, `module.exports = { ... }` at bottom |
| VAL-02 | Check registry pattern -- checks as `{ id, category, severity, check, repair? }` array | Module-level `const checks = [...]` array; `check` is a function `(cwd) => CheckResult`; `repair` is optional function |
| VAL-03 | Structured `ValidationResult` return type with all specified fields | Aggregate from check execution: `healthy` (boolean), `checks` (array), `errors`/`warnings` (filtered by severity), `repairs` (empty array this phase), `nextPhase`/`phaseStep` (null this phase) |
| VAL-04 | Three-tier severity model (error/warning/info) | Each check has `severity` in registry entry; results partitioned by severity for `errors`/`warnings` arrays |
| VAL-05 | Category-filtered check execution via `runChecks({ categories })` | `checks.filter(c => categories.includes(c.category))` before execution; no categories = run all |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | built-in | File existence checks, reading config | All existing lib modules use synchronous `fs` |
| Node.js `path` | built-in | Path joining for `cwd`-relative paths | Every lib module uses `path.join(cwd, ...)` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `./core.cjs` | internal | `safeReadFile()`, `findPhaseInternal()`, `getMilestoneInfo()` | Reading project state files safely |
| `./config.cjs` | internal | `CONFIG_DEFAULTS` for known-keys validation | Future READY checks (not this phase) |
| `./phase.cjs` | internal | `computePhaseStatus()`, `findFirstIncompletePhase()` | Future NAV/READY checks (not this phase) |
| `./frontmatter.cjs` | internal | `extractFrontmatter()` for STATE.md parsing | Future STATE checks (not this phase) |

### Alternatives Considered
None -- zero new dependencies is a locked decision. All functionality built with Node.js built-ins and existing internal modules.

## Architecture Patterns

### Module Structure
```
get-shit-done/bin/lib/
├── validation.cjs    # NEW — check registry + validateProjectHealth()
├── core.cjs          # Shared utilities (safeReadFile, findPhaseInternal)
├── phase.cjs         # Phase lifecycle (computePhaseStatus)
├── config.cjs        # Config CRUD (CONFIG_DEFAULTS)
├── frontmatter.cjs   # YAML frontmatter parsing
├── state.cjs         # STATE.md read/write (lazy import only)
├── verify.cjs        # Existing verification (NOT imported by validation.cjs)
└── cli.cjs           # CLI formatting (gatherHealthData to be replaced later)
```

### Pattern 1: CJS Module Convention
**What:** Every lib module follows the same structure
**When to use:** Always for new modules in this project
```javascript
/**
 * ModuleName — One-line description
 */

const fs = require('fs');
const path = require('path');
const { needed } = require('./core.cjs');

// ─── Internal helpers ────────────────────────────────────────────────────

function internalHelper() { ... }

// ─── Exported functions ──────────────────────────────────────────────────

function publicFunction(cwd, options) { ... }

module.exports = { publicFunction };
```
**Source:** Observed in all 13 existing lib/*.cjs files

### Pattern 2: Check Registry as Plain Array
**What:** Checks are plain objects in a module-level array, not a class or event system
**When to use:** For the check registry
```javascript
const checks = [
  {
    id: 'STRUCT-01',
    category: 'structure',
    severity: 'error',
    check: (cwd) => { /* returns { passed, message } */ },
    // repair: (cwd) => { /* optional */ },
  },
];
```
**Source:** Matches project convention of plain objects over classes (CLAUDE.md simplicity rule)

### Pattern 3: Category Filtering via Array.filter
**What:** Simple `filter()` before execution, no framework needed
```javascript
function runChecks(cwd, options = {}) {
  const { categories } = options;
  const toRun = categories
    ? checks.filter(c => categories.includes(c.category))
    : checks;
  // execute toRun...
}
```

### Anti-Patterns to Avoid
- **Class-based registry:** No `new CheckRegistry()` -- use plain array and functions
- **Event-based checks:** No EventEmitter for check lifecycle -- synchronous execution
- **Console output in validation:** No `console.log`, no ANSI codes -- return data only
- **Importing from verify.cjs:** One-way dependency only; validation.cjs does NOT import verify.cjs
- **Eager imports of state.cjs:** Only import inside repair functions (Phase 67), not at module top

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File reading with error handling | Custom try/catch wrappers | `safeReadFile()` from core.cjs | Already handles encoding, missing files |
| Phase directory lookup | Custom glob/readdir logic | `findPhaseInternal()` from core.cjs | Handles decimal phases, archives |
| Frontmatter parsing | Custom YAML parser | `extractFrontmatter()` from frontmatter.cjs | Already handles nested objects, arrays |
| Milestone info extraction | Regex over ROADMAP.md | `getMilestoneInfo()` from core.cjs | Canonical parsing logic |

**Key insight:** The existing lib modules already solve the hard parsing problems. validation.cjs should import and reuse, not duplicate.

## Common Pitfalls

### Pitfall 1: Circular Dependency
**What goes wrong:** validation.cjs imports phase.cjs, which imports state.cjs, which might import validation.cjs
**Why it happens:** CJS circular requires return partially-initialized modules
**How to avoid:** validation.cjs imports FROM other modules; no other module imports FROM validation.cjs (until Phase 67 consumer migration). Keep state.cjs imports lazy.
**Warning signs:** `Cannot read property of undefined` at require time

### Pitfall 2: Mixing Validation with Presentation
**What goes wrong:** Adding ANSI formatting or `console.log` in validation functions
**Why it happens:** The existing `gatherHealthData()` in cli.cjs mixes data gathering with formatting
**How to avoid:** validation.cjs returns plain objects only. Formatting stays in cli.cjs `handleHealth()`
**Warning signs:** Any `\x1b[` escape codes or `console.*` calls in validation.cjs

### Pitfall 3: Over-Engineering the Registry
**What goes wrong:** Building a plugin system, event hooks, or dynamic registration
**Why it happens:** "Future flexibility" thinking
**How to avoid:** Module-level array of plain objects. `checks.push()` is the registration mechanism. CLAUDE.md says NO PREOPTIMIZATIONS.
**Warning signs:** Classes, EventEmitter, `register()` methods, dynamic imports

### Pitfall 4: Coupling Check Results to Repair Logic
**What goes wrong:** Check functions that also attempt repairs
**Why it happens:** Seems efficient to fix issues as you find them
**How to avoid:** `check` function returns result data; `repair` is a separate optional function. Phase 64 defines `repair` in the type but does not wire it.
**Warning signs:** Check functions calling `fs.writeFileSync` or `writeStateMd`

## Code Examples

### Module Skeleton
```javascript
/**
 * Validation — Project health check registry and validation engine
 */

const fs = require('fs');
const path = require('path');

// ─── Check Registry ──────────────────────────────────────────────────────

const checks = [
  {
    id: 'STRUCT-01',
    category: 'structure',
    severity: 'error',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning'));
      return {
        passed: exists,
        message: exists ? '.planning/ directory exists' : '.planning/ directory not found',
      };
    },
  },
];

// ─── Check Execution ─────────────────────────────────────────────────────

function runChecks(cwd, options = {}) {
  const { categories } = options;
  const toRun = categories
    ? checks.filter(c => categories.includes(c.category))
    : checks;

  const results = [];
  for (const entry of toRun) {
    const result = entry.check(cwd);
    results.push({
      id: entry.id,
      category: entry.category,
      severity: entry.severity,
      passed: result.passed,
      message: result.message,
      repairable: typeof entry.repair === 'function',
      repairAction: null,
    });
  }
  return results;
}

// ─── Public API ──────────────────────────────────────────────────────────

function validateProjectHealth(cwd, options = {}) {
  const { categories, autoRepair } = options;
  const results = runChecks(cwd, { categories });

  const errors = results.filter(r => !r.passed && r.severity === 'error');
  const warnings = results.filter(r => !r.passed && r.severity === 'warning');
  const healthy = errors.length === 0;

  return {
    healthy,
    checks: results,
    errors,
    warnings,
    repairs: [],
    nextPhase: null,
    phaseStep: null,
  };
}

module.exports = { validateProjectHealth, runChecks };
```
**Source:** Derived from existing lib module patterns and CONTEXT.md decisions

### Existing Health Check Pattern (for reference)
```javascript
// From cli.cjs lines 409-595 — this is what validation.cjs will eventually replace
function gatherHealthData(projectRoot) {
  const checks = [];
  const errors = [];
  const warnings = [];
  const info = [];
  const addIssue = (severity, code, message, fix) => { ... };
  // ... inline check logic ...
  return { status, checks, errors, warnings, info };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gatherHealthData()` in cli.cjs | `validateProjectHealth()` in validation.cjs | Phase 64 (now) | Structured registry vs inline checks |
| String status (`healthy`/`degraded`/`broken`) | Boolean `healthy` + severity arrays | Phase 64 (now) | Cleaner API for autopilot consumption |
| Error codes (E001-E005, W001-W005) | Category-prefixed IDs (STRUCT-01, STATE-01) | Phase 64 (now) | Namespace supports category filtering |

## Open Questions

1. **Should `runChecks` be exported or internal-only?**
   - What we know: Success criterion 4 references `runChecks({ categories: ['readiness'] })` syntax
   - What's unclear: Whether consumers call `runChecks` directly or always go through `validateProjectHealth`
   - Recommendation: Export both. `validateProjectHealth` is the primary API; `runChecks` is lower-level for consumers that want raw check results without aggregation

2. **Info-severity results in the return type?**
   - What we know: Three-tier model is error/warning/info. Result type has `errors` and `warnings` arrays.
   - What's unclear: No explicit `info` array in the result type fields from requirements
   - Recommendation: Include info-severity results in the `checks` array (they're always there) but don't add a separate `info` field unless needed. The `checks` array is the complete record; `errors`/`warnings` are convenience filters.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `get-shit-done/bin/lib/*.cjs` (13 modules) -- module patterns, import conventions, export style
- `cli.cjs` lines 409-595 -- current `gatherHealthData()` implementation being replaced
- `core.cjs` -- shared utilities (`safeReadFile`, `findPhaseInternal`, `getMilestoneInfo`)
- `config.cjs` -- `CONFIG_DEFAULTS` object for future config validation checks
- `phase.cjs` -- `computePhaseStatus()`, `findFirstIncompletePhase()` for future nav/readiness checks

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions -- locked API contracts from discuss-phase session
- REQUIREMENTS.md VAL-01 through VAL-05 -- formal requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero external dependencies, all patterns from existing codebase
- Architecture: HIGH -- direct extension of established CJS module conventions
- Pitfalls: HIGH -- circular dependency and separation concerns are well-understood in this codebase

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable internal codebase, no external dependency churn)
