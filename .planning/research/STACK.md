# Stack Research

**Domain:** Unified validation module for CJS-based CLI tooling
**Researched:** 2026-03-15
**Confidence:** HIGH

## Scope

This research covers ONLY what's needed for the unified validation module (`validation.cjs`). The existing validated stack (CJS modules, gsd-tools.cjs dispatcher, gsd-cli.cjs binary, autopilot.mjs with createRequire, node:test suite with 750 tests) is NOT re-evaluated.

## Verdict: No New Dependencies

This milestone requires zero new libraries, frameworks, or tools. All implementation uses existing patterns, Node.js built-ins, and internal CJS module imports. The work is a refactoring of scattered validation logic into a single canonical module.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js (CJS) | >=16.7.0 | Module format for validation.cjs | Matches all existing lib/ modules (phase.cjs, verify.cjs, cli.cjs, core.cjs). No ESM conversion needed. CJS `require()` gives synchronous loading which is correct for validation checks that run at startup. |
| node:fs (sync) | built-in | File I/O for state inspection and repair | Every existing module uses `fs.readFileSync`/`fs.writeFileSync`/`fs.existsSync`. Async fs is unnecessary -- validation runs sequentially before autopilot starts, and `gsd health` is synchronous. |
| node:path | built-in | Path resolution for .planning/ structure | Standard across all modules. No alternatives to consider. |
| node:test | built-in | Test runner | Already used for all 750 tests. `describe`/`test`/`beforeEach`/`afterEach` from `node:test`, `assert` from `node:assert`. |

### Internal Module Dependencies

| Module | Imports Used | Purpose |
|--------|-------------|---------|
| core.cjs | `findPhaseInternal`, `getMilestoneInfo`, `safeReadFile`, `output`, `error` | Phase directory lookup, milestone metadata, safe file reads, output formatting |
| phase.cjs | `computePhaseStatus`, `findFirstIncompletePhase`, `extractPhaseNumbers` | Canonical phase lifecycle checks -- validation.cjs must call these, not reimplement them |
| frontmatter.cjs | `extractFrontmatter` | Parsing STATE.md and config frontmatter for consistency checks |
| state.cjs | `writeStateMd` | State repair operations that preserve frontmatter hashing |
| config.cjs | `CONFIG_DEFAULTS` | Validating config values against known defaults |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| node:test runner | Test execution | Via `node scripts/run-tests.cjs`. No Jest -- project uses built-in runner. |
| c8 | Coverage reporting | Already in devDependencies at ^11.0.0. `--include 'get-shit-done/bin/lib/*.cjs'` automatically picks up validation.cjs. |

## Installation

```bash
# No new packages needed.
# validation.cjs uses only Node.js built-ins and existing internal modules.
```

## Existing Patterns to Follow

### Result Type Pattern

Every check function returns a plain object. No classes, no Zod schemas. Matches `gatherHealthData` in cli.cjs and `cmdValidateHealth` in verify.cjs.

```javascript
// Individual check result
{ passed: true, code: 'HLTH-01', message: '.planning/ directory exists', fix: null, repairable: false }

// Aggregate result
{ status: 'healthy'|'degraded'|'broken', checks: [], errors: [], warnings: [], info: [] }
```

### Module Export Pattern

Named function exports via `module.exports = { ... }`. No default exports, no classes. Functions accept `(cwd, options)` and return plain objects. Matches every existing lib/*.cjs module.

### File I/O Pattern for Repair

- `writeStateMd(statePath, content, cwd)` for STATE.md writes (preserves frontmatter hashing)
- `fs.writeFileSync` for config.json writes (matches existing repair in `cmdValidateHealth`)
- `fs.mkdirSync({ recursive: true })` for missing phase directories (matches `cmdPhaseStatus` auto-create)
- Timestamped `.bak` files before destructive repairs (matches existing backup pattern in `cmdValidateHealth`)

### Test Pattern

- One test file: `tests/validation.test.cjs`
- `createTempProject()` from `helpers.cjs` for isolated temp directories
- `runGsdTools('validate ...')` for integration tests through the dispatcher
- Direct `require('../get-shit-done/bin/lib/validation.cjs')` for unit tests
- `beforeEach`/`afterEach` with `createTempProject()`/`cleanup()` for test isolation
- Budget constraint: 750/800 tests used. Target ~20-30 tests for validation.cjs.

### Dispatch Integration

Add `validation` require to gsd-tools.cjs and route new subcommands under the existing `validate` case. The current `validate` case routes to `verify.cmdValidateConsistency` and `verify.cmdValidateHealth` -- these will delegate to validation.cjs.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Plain object result types | Zod/io-ts runtime validation schemas | Never for this project. Adding a validation library to validate a validation module is circular complexity. The codebase uses plain objects everywhere. |
| Sync fs operations | Async fs with `fs.promises` | Never for this use case. Validation runs once at startup. No concurrent I/O benefit. Every other module is sync. |
| Single `validation.cjs` module | Split into `validation-checks.cjs` + `validation-repair.cjs` | Only if validation.cjs exceeds ~600 lines. The codebase tolerates larger modules (verify.cjs: 950 lines, cli.cjs: 1050 lines). |
| Import from core.cjs/phase.cjs | Reimplement phase inspection in validation.cjs | Never. The disparity between regex-based checks and artifact-based checks is the bug v2.6 fixes. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| External validation libraries (Zod, Joi, Ajv) | Adds dependency for file structure validation, not schema validation. Overkill. | Plain conditional checks with structured result objects |
| TypeScript / JSDoc type annotations | Project is untyped CJS. Adding types to one module creates inconsistency. | Document result shapes in code comments (matches existing pattern) |
| Class-based check architecture | Over-engineering. Existing pattern is exported functions returning plain objects. | Exported functions: `runAllChecks(cwd, opts)`, `runCheck(cwd, id)`, `repairIssue(cwd, code)` |
| async/await | No concurrent I/O benefit. Introduces complexity in a sync call chain. | Synchronous `fs.readFileSync` / `fs.existsSync` |
| Event emitters for results | Check pipeline is synchronous and sequential. Events add indirection with no benefit. | Return arrays of check results directly |
| New test framework | 750 tests use `node:test` + `node:assert`. | Continue using `node:test` with `helpers.cjs` patterns |

## Integration Points

### Where validation.cjs gets consumed:

1. **gsd-tools.cjs dispatcher** -- existing `validate` case routes to validation.cjs functions
2. **cli.cjs `handleHealth`** -- refactored to call `validation.runAllChecks(cwd)` instead of inline `gatherHealthData`
3. **autopilot.mjs** -- pre-flight validation via `createRequire` import, calls `validation.runAllChecks(cwd, { autoRepair: true })`
4. **verify.cjs `cmdValidateHealth`** -- delegates to validation.cjs (or deprecated in favor of unified module)

### What validation.cjs imports:

1. **core.cjs** -- `findPhaseInternal`, `getMilestoneInfo`, `safeReadFile`, `output`, `error`
2. **phase.cjs** -- `computePhaseStatus`, `findFirstIncompletePhase`, `extractPhaseNumbers`
3. **frontmatter.cjs** -- `extractFrontmatter`
4. **state.cjs** -- `writeStateMd`

### Circular Dependency Avoidance

- validation.cjs imports FROM core.cjs, phase.cjs, frontmatter.cjs, state.cjs (lower-level modules)
- verify.cjs and cli.cjs import FROM validation.cjs (for delegating health checks)
- validation.cjs must NOT import from verify.cjs or cli.cjs -- this would create a cycle
- Health check logic moves OUT of verify.cjs/cli.cjs INTO validation.cjs

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| validation.cjs | Node.js >=16.7.0 | Same engine requirement as package.json. Uses no APIs newer than Node 16. |
| validation.cjs | All existing lib/*.cjs | Pure CJS with `require()`. No ESM interop needed. |
| autopilot.mjs | validation.cjs | Uses `createRequire(import.meta.url)` to import CJS (established v2.3 pattern). |
| test suite | validation.test.cjs | Budget: 800 tests, current: 750 (93.75%). Target 20-30 validation tests. |

## Sources

All findings based on direct codebase inspection (HIGH confidence):

- `get-shit-done/bin/lib/cli.cjs` -- `gatherHealthData` (lines 409-595), `handleHealth`, `KNOWN_SETTINGS_KEYS`
- `get-shit-done/bin/lib/verify.cjs` -- `cmdValidateHealth` (lines 535-871), `cmdValidateConsistency`
- `get-shit-done/bin/lib/phase.cjs` -- `computePhaseStatus`, `findFirstIncompletePhase`, `extractPhaseNumbers`
- `get-shit-done/bin/lib/core.cjs` -- `output`, `error`, `findPhaseInternal`, `safeReadFile`
- `get-shit-done/bin/lib/state.cjs` -- `writeStateMd`
- `get-shit-done/bin/lib/config.cjs` -- `CONFIG_DEFAULTS`
- `get-shit-done/bin/gsd-tools.cjs` -- dispatcher routing, `validate` case (lines 508-519)
- `tests/helpers.cjs` -- `runGsdTools`, `createTempProject`, `cleanup`
- `tests/verify-health.test.cjs` -- test patterns for health validation
- `package.json` -- dependencies (zx only), devDeps (c8, esbuild), engine >=16.7.0

---
*Stack research for: unified validation module (validation.cjs)*
*Researched: 2026-03-15*
