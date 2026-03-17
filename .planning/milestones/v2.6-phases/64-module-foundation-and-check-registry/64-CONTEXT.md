# Phase 64: Module Foundation and Check Registry - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Create `validation.cjs` as a new CJS module with locked API contracts that all subsequent v2.6 phases build on. This phase delivers the module skeleton, check registry pattern, result type, three-tier severity model, category filtering, and the `validateProjectHealth` entry point. No actual check implementations beyond trivial stubs -- those come in Phases 65-66.

</domain>

<decisions>
## Implementation Decisions

### Module Location and Format
- Module lives at `get-shit-done/bin/lib/validation.cjs` (from REQUIREMENTS.md VAL-01)
- CJS format with `require`/`module.exports` matching all existing `lib/*.cjs` modules (from STACK.md)
- Zero new dependencies -- Node.js built-ins and existing internal module imports only (from STACK.md)
- Synchronous file I/O via `node:fs` matching project convention (from STACK.md)

### Exported API Surface
- `validateProjectHealth(cwd, options)` as primary entry point (from REQUIREMENTS.md VAL-01, design doc)
- Individual category functions also exported: `validateFileStructure`, `validateStateConsistency`, `validatePhaseNavigation`, `validateAutopilotReadiness` (from design doc)
- Named function exports via `module.exports = { ... }` -- no default exports, no classes (from STACK.md patterns)
- Functions accept `(cwd, options)` and return plain objects (from STACK.md patterns)

### Check Registry Pattern
- Checks defined as array of `{ id, category, severity, check, repair? }` objects (from REQUIREMENTS.md VAL-02)
- Check IDs use category prefix format: `STRUCT-01`, `STATE-01`, `NAV-01`, `READY-01` (from design doc)
- Categories: `structure`, `state`, `navigation`, `readiness` (from design doc)
- `repair` field is optional function -- present only for repairable checks (from REQUIREMENTS.md VAL-02)
- Registry is a module-level array, not a class or event system (Claude's Decision: matches project's plain-object convention and avoids over-engineering per CLAUDE.md simplicity rule)

### Result Type Contract
- `ValidationResult` with fields: `healthy`, `checks`, `errors`, `warnings`, `repairs`, `nextPhase`, `phaseStep` (from REQUIREMENTS.md VAL-03)
- `healthy` is boolean: `false` when any error exists, `true` when only warnings/info (from REQUIREMENTS.md VAL-04, VAL-05)
- `CheckResult` shape: `{ id, category, severity, message, repairable, repairAction }` (from design doc)
- `RepairResult` shape: `{ checkId, action, success, detail }` (from design doc)
- `nextPhase` and `phaseStep` fields populated by readiness checks, null when not computed (Claude's Decision: null defaults let consumers detect whether readiness checks ran)

### Three-Tier Severity Model
- Severities: `error`, `warning`, `info` (from REQUIREMENTS.md VAL-04)
- `healthy: false` when any error-severity check fails (from REQUIREMENTS.md VAL-05)
- `healthy: true` when only warnings and info exist (from REQUIREMENTS.md VAL-05)
- Severity is per-check metadata, not per-category (Claude's Decision: a structure check can be warning-level e.g. missing config.json, while a state check can be error-level)

### Category Filtering
- `runChecks({ categories: ['readiness'] })` filters to only matching checks (from REQUIREMENTS.md VAL-05)
- When no categories specified, all checks execute (Claude's Decision: default-to-all is the least-surprise behavior for `gsd health`)
- `validateProjectHealth` accepts `{ categories, autoRepair }` options (Claude's Decision: single options object keeps the API extensible without positional arg sprawl)

### Dependency Direction
- validation.cjs imports FROM: `phase.cjs`, `core.cjs`, `frontmatter.cjs`, `config.cjs` (from ARCHITECTURE.md)
- validation.cjs must NOT be imported by: `phase.cjs`, `core.cjs`, `verify.cjs` (from ARCHITECTURE.md circular dependency constraint)
- `state.cjs` import is lazy (inside repair function only) to avoid coupling detection to mutation (from ARCHITECTURE.md Pattern 3)
- `verify.cjs` import is optional and one-way only: validation.cjs may import from verify.cjs, never reverse (from ARCHITECTURE.md)

### Phase 64 Scope Boundaries
- This phase creates the skeleton with stub check functions that return empty results (Claude's Decision: stubs prove the API contract and registry pattern work end-to-end without coupling to check implementation)
- At least one concrete check should exist to validate the registry pipeline works (Claude's Decision: a trivial STRUCT-01 `.planning/ exists` check is the simplest proof that the full pipeline from registry to result works)
- No consumer migration in this phase -- validation.cjs is additive-only (from ROADMAP.md phase dependencies)
- No auto-repair implementation -- repair field is defined in the type but not wired (Claude's Decision: repair logic comes in Phase 67 per ROADMAP.md)

### Validation vs Formatting Separation
- validation.cjs returns structured data only -- no ANSI colors, no console output (from ARCHITECTURE.md Anti-Pattern 3)
- Formatting stays in cli.cjs `handleHealth()` (from ARCHITECTURE.md)
- `output()` and `error()` from core.cjs not used in validation.cjs (Claude's Decision: validation is a pure data module; consumers decide how to present results)

### Claude's Discretion
- Internal variable naming within check functions
- Exact JSDoc comment style and depth on exported functions
- Whether to use a helper function for aggregating check results or inline the logic
- Order of checks within the registry array
- Whether stub checks return `{ passed: true }` or are skipped entirely

</decisions>

<specifics>
## Specific Ideas

- The design doc specifies exact field names for `ValidationResult`: `healthy`, `checks`, `errors`, `warnings`, `repairs`, `nextPhase`, `phaseStep` -- use these verbatim
- Check IDs from the design doc follow the pattern `STRUCT-01`, `STATE-01`, `NAV-01`, `READY-01` -- these are the canonical IDs subsequent phases will implement
- The `autoRepair` option defaults to `false` per the design doc's `validateProjectHealth(cwd, { autoRepair: false })` signature
- Success criterion 2 specifies the exact check shape: `{ id, category, severity, check, repair? }` -- this is the registry entry format, not the result format
- Success criterion 4 uses `runChecks({ categories: ['readiness'] })` -- this implies `runChecks` is either an alias for `validateProjectHealth` or a separate internal function that `validateProjectHealth` delegates to

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config.cjs`: `CONFIG_DEFAULTS` object for validating autopilot settings against known keys
- `phase.cjs`: `computePhaseStatus()`, `findFirstIncompletePhase()`, `extractPhaseNumbers()` -- the canonical phase lifecycle functions that validation.cjs will call in later phases
- `core.cjs`: `findPhaseInternal()`, `getMilestoneInfo()`, `safeReadFile()` -- standard utilities for reading project state
- `frontmatter.cjs`: `extractFrontmatter()` for parsing STATE.md frontmatter
- `state.cjs`: `writeStateMd()` for repair operations (Phase 67)

### Established Patterns
- All lib modules use `const fs = require('fs'); const path = require('path');` at top
- Functions accept `(cwd, ...)` as first parameter for project root
- `output(result, raw, label)` pattern for JSON/text output -- but validation.cjs should NOT use this (pure data returns)
- Module header comment: `/** * ModuleName -- One-line description */`
- Named exports: `module.exports = { fn1, fn2, fn3 };` at bottom of file

### Integration Points
- `gsd-tools.cjs` line 508-519: existing `validate` dispatch case routes to `verify.cmdValidateHealth` and `verify.cmdValidateConsistency` -- Phase 67 will re-route `health` to validation.cjs
- `cli.cjs` `gatherHealthData()` lines 409-595: the regex-based health checks that Phase 65+ will replace
- `autopilot.mjs` lines 60-83: ad-hoc pre-flight checks that Phase 67 will replace with `validateProjectHealth`

</code_context>

<deferred>
## Deferred Ideas

- Actual check implementations for STRUCT, STATE, NAV, READY categories (Phase 65-66)
- Auto-repair execution logic (Phase 67)
- Consumer migration: cli.cjs, autopilot.mjs, gsd-tools.cjs delegation (Phase 67)
- Dead code removal from verify.cjs and cli.cjs (Phase 67)
- Test suite for all check categories (Phase 68)
- Deterministic step detection in `gsd health` output (future -- DIAG-01)
- Plugin/extensible check system (explicitly out of scope per REQUIREMENTS.md)

</deferred>

---

*Phase: 64-module-foundation-and-check-registry*
*Context gathered: 2026-03-15 via auto-context*
