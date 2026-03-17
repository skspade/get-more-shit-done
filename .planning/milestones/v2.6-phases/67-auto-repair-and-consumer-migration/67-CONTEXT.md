# Phase 67: Auto-Repair and Consumer Migration - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Implement auto-repair for trivially fixable state drift (stale STATE.md counts, missing phase directories) and migrate all three consumers -- `gsd health` CLI, autopilot pre-flight, and `gsd-tools.cjs validate` -- to delegate to `validation.cjs`. Old duplicate code in `cli.cjs` (`gatherHealthData()`) and `verify.cjs` (`cmdValidateHealth()`) is removed after migration. This is the integration phase that wires the validation module built in Phases 64-66 into all consumer surfaces.

</domain>

<decisions>
## Implementation Decisions

### Auto-Repair Logic (REPAIR-01 through REPAIR-04)

- Auto-repair is triggered by `validateProjectHealth(cwd, { autoRepair: true })` option -- separated from validation, not coupled to individual checks (from REQUIREMENTS.md REPAIR-01)
- Repairable issues: STATE.md `completed_phases` count, STATE.md `total_phases` count, STATE.md `status` field, missing phase directories (from REQUIREMENTS.md REPAIR-02)
- Each repair is attempted independently -- a failure in one does not block others (from REQUIREMENTS.md REPAIR-04)
- Repairs are reported in the `repairs` array on `ValidationResult`: `{ checkId, action, success, detail }` (from Phase 64 result type contract)
- Repair functions are attached to check registry entries via the existing `repair?` field on checks that support repair (from Phase 64 VAL-02 registry pattern)
- STATE.md count repairs use `countRoadmapPhases()` to compute correct values, then update the STATE.md frontmatter via `extractFrontmatter()`/`reconstructFrontmatter()` and `fs.writeFileSync()` (Claude's Decision: direct frontmatter manipulation is simpler than importing writeStateMd which carries side-effects like session log appending)
- Missing phase directory repair creates the directory with `fs.mkdirSync()` using the phase name from ROADMAP.md (Claude's Decision: directory creation is idempotent and safe -- matches existing `cmdPhaseStatus` scaffold pattern)
- Repair execution happens in `validateProjectHealth()` after all checks complete -- iterate failed repairable checks and call their repair functions (Claude's Decision: post-check repair avoids interleaving mutation with detection)

### CLI Consumer Migration (INT-01, INT-02, INT-06)

- `gsd health` CLI command (`handleHealth()` in cli.cjs) delegates to `validateProjectHealth()` instead of calling `gatherHealthData()` (from REQUIREMENTS.md INT-01)
- Output format must remain backward-compatible: `{ status, checks, errors, warnings, info, message }` shape with same error codes E001-E005, W001-W009 (from REQUIREMENTS.md INT-06)
- The `handleHealth()` function maps `ValidationResult` fields to the existing output shape (Claude's Decision: a thin adapter in handleHealth keeps formatting logic in cli.cjs while data comes from validation.cjs)
- Map validation check IDs to legacy codes: STRUCT-01a->E001, STRUCT-01b->E002, STRUCT-01c->E003, STRUCT-01d->E004, STRUCT-02 parse error->E005, STRUCT-01e->W003, STRUCT-02 invalid profile->W004, STRUCT-02 unknown keys->I001 (from REQUIREMENTS.md INT-06 and existing cli.cjs codes)
- `gsd health --fix` flag triggers `validateProjectHealth(cwd, { autoRepair: true })` and reports repairs in the output (from REQUIREMENTS.md INT-02)
- The `--fix` flag is parsed in `parseArgs()` and passed through `routeCommand()` to `handleHealth()` (Claude's Decision: follows existing CLI arg-passing pattern through routeCommand)

### Autopilot Pre-Flight Migration (INT-03)

- Autopilot pre-flight in `autopilot.mjs` replaces the ad-hoc `.planning/` existence check (lines 74-78) with `validateProjectHealth(cwd, { autoRepair: true })` (from REQUIREMENTS.md INT-03)
- Import validation.cjs via `createRequire` matching existing CJS import pattern in autopilot.mjs (from autopilot.mjs line 26-30 pattern)
- If validation returns `healthy: false` with errors, autopilot logs the errors and exits with code 1 (Claude's Decision: non-zero exit matches existing error handling pattern in autopilot.mjs)
- If validation returns repairs, autopilot logs what was repaired before proceeding (Claude's Decision: visibility into auto-repairs helps debugging without blocking execution)
- The `nextPhase` and `phaseStep` from validation result can inform the phase loop start, replacing the separate `findFirstIncompletePhase()` call (Claude's Decision: avoids duplicate phase.cjs calls -- validation already computed this)

### gsd-tools.cjs Dispatch Migration (INT-04)

- `gsd-tools.cjs` `validate health` case routes to `validation.cjs validateProjectHealth()` instead of `verify.cmdValidateHealth()` (from REQUIREMENTS.md INT-04)
- The `--repair` flag maps to `{ autoRepair: true }` option (from existing gsd-tools.cjs line 513-514 pattern)
- Output format remains JSON via `output()` for workflow consumption (from gsd-tools.cjs established pattern)

### Dead Code Removal (INT-05)

- `gatherHealthData()` function removed from cli.cjs after handleHealth migration (from REQUIREMENTS.md INT-05)
- `cmdValidateHealth()` function removed from verify.cjs after gsd-tools migration (from REQUIREMENTS.md INT-05)
- `cmdValidateHealth` removed from verify.cjs `module.exports` (from REQUIREMENTS.md INT-05)
- Helper functions used only by removed code (e.g., `extractPhasesFromContent` if only used by `cmdValidateHealth`) are also removed (Claude's Decision: no dead code per CLAUDE.md rule)

### Error Code Backward Compatibility (INT-06)

- Legacy error codes (E001-E006, W001-W009, I001) are preserved in the output of `gsd health` and `gsd-tools validate health` (from REQUIREMENTS.md INT-06)
- The mapping layer in `handleHealth()` translates validation check IDs to legacy codes (Claude's Decision: mapping in the consumer keeps validation.cjs clean with semantic IDs while preserving backward compatibility)
- New checks from Phases 65-66 that have no legacy code equivalent are included in output without legacy code mapping -- they use their check ID as the code (Claude's Decision: no existing consumers depend on these codes since they are new functionality)

### Claude's Discretion
- Internal structure of the adapter function that maps ValidationResult to legacy output shape
- Exact log message wording in autopilot.mjs for repair reporting
- Whether to create a shared mapping constant for check-ID-to-legacy-code or inline it
- Order of repair attempts within the repair execution loop
- Whether `handleHealth` calls validation with all categories or specific ones

</decisions>

<specifics>
## Specific Ideas

- The existing `cmdValidateHealth()` in verify.cjs (lines 535-871) contains repair logic for `createConfig`, `resetConfig`, and `regenerateState` -- these repair implementations should inform the new repair functions on validation.cjs check entries
- `gatherHealthData()` in cli.cjs (lines 409-595) returns `{ status, checks, errors, warnings, info }` -- the `handleHealth()` adapter must produce this exact shape from `ValidationResult`
- The `status` field uses three values: `'healthy'`, `'degraded'`, `'broken'` -- this maps to validation's `healthy: true` (healthy), errors=0 + warnings>0 (degraded), errors>0 (broken)
- `handleHealth()` (lines 597-655) formats rich ANSI output from the data -- this formatting code stays, only the data source changes
- The `gsd-tools.cjs validate health --repair` flag (line 513) currently calls `verify.cmdValidateHealth(cwd, { repair: repairFlag }, raw)` -- reroute to `validation.validateProjectHealth(cwd, { autoRepair: repairFlag })` with `output()` wrapper
- Autopilot.mjs lines 74-83 have 4 ad-hoc prerequisite checks (claude CLI, node, .planning/, gsd-tools.cjs) -- only the `.planning/` check and GSD_TOOLS check are replaceable by validation; the CLI binary checks are environment checks that stay
- Success criterion 2 explicitly requires "same error codes, same field structure" for backward compatibility

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validation.cjs`: Full check registry with STRUCT, STATE, NAV, READY checks and `validateProjectHealth()` entry point -- the module this phase wires into consumers
- `frontmatter.cjs`: `extractFrontmatter()` and `reconstructFrontmatter()` for STATE.md frontmatter read/write in repair logic
- `state.cjs`: `writeStateMd()` for STATE.md writes (available but may be heavier than needed for simple count fixes)
- `core.cjs`: `getMilestoneInfo()` for repair operations that need milestone context, `output()` for gsd-tools JSON output

### Established Patterns
- `handleHealth()` in cli.cjs returns `{ command: 'health', ...data, message }` -- the `message` field contains ANSI-formatted string
- `cmdValidateHealth()` in verify.cjs uses `output(result, raw)` for JSON output to workflows
- Autopilot.mjs uses `createRequire` for CJS imports: `const { fn } = require('../bin/lib/module.cjs')`
- Repair pattern in verify.cjs: try/catch per repair, push `{ action, success, path/error }` to results array
- `gsd-tools.cjs` dispatch uses switch/case with `args[1]` subcommand routing

### Integration Points
- `cli.cjs` `handleHealth()` (line 597): replace `gatherHealthData()` call with `validateProjectHealth()` + adapter
- `cli.cjs` `gatherHealthData()` (lines 409-595): remove entirely after migration
- `cli.cjs` `parseArgs()`: add `--fix` flag parsing
- `gsd-tools.cjs` `validate health` case (lines 508-514): reroute to validation.cjs
- `verify.cjs` `cmdValidateHealth()` (lines 535-871): remove entirely after migration
- `verify.cjs` `module.exports` (line 952): remove `cmdValidateHealth` export
- `autopilot.mjs` lines 74-83: replace `.planning/` check with `validateProjectHealth()` call
- `autopilot.mjs` line 27-30: add validation.cjs import

</code_context>

<deferred>
## Deferred Ideas

- Test suite for auto-repair logic and consumer migration (Phase 68 -- TEST-01, TEST-02, TEST-03)
- Net-zero test count migration of existing health tests (Phase 68 -- TEST-04)
- Deterministic step detection in `gsd health` output (future -- DIAG-01)
- Health check suggestions with specific fix commands (future -- DIAG-02)
- `cmdValidateConsistency()` migration to validation.cjs (not in scope -- only `cmdValidateHealth` per INT-05)

</deferred>

---

*Phase: 67-auto-repair-and-consumer-migration*
*Context gathered: 2026-03-16 via auto-context*
