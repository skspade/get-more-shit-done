# Phase 17: Health Command - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can validate their .planning/ directory is complete and consistent without manually inspecting files. This phase replaces the `handleHealth` stub in `cli.cjs` with a real implementation that runs pass/fail checks on required files, validates config.json structure and values, checks STATE.md vs ROADMAP.md consistency, and reports errors/warnings with clear descriptions. It does NOT touch other commands (settings, help) -- those remain stubs for Phase 18.

</domain>

<decisions>
## Implementation Decisions

### Data Access
- Reuse `cmdValidateHealth()` from `verify.cjs` as the core validation engine -- it already checks .planning/ existence, PROJECT.md sections, ROADMAP.md existence, STATE.md phase references, config.json validity, phase directory naming, orphaned plans, and ROADMAP/disk phase consistency (from PROJECT.md: "gsd-tools.cjs already handles state parsing (`validate health`)")
- `cmdValidateHealth()` calls `output()` internally which writes to stdout -- the handler needs raw data instead, so extract the validation logic into a separate data-gathering function or call the internal checks directly (Claude's Decision: same pattern used in Phase 15 where `gatherProgressData` was extracted from `handleProgress` to separate data from side effects)
- Read STATE.md frontmatter for current phase position using `extractFrontmatter()` and compare against ROADMAP.md phase checkbox status for consistency check (from HLTH-03)

### Health Checks (HLTH-01: Required File Checks)
- Check existence of required `.planning/` files: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `config.json`, and the `phases/` directory
- Each check reports pass or fail with a description of what is wrong and which file is affected (from HLTH-04)
- Additional structural checks on PROJECT.md: verify required sections exist (`## What This Is`, `## Core Value`, `## Requirements`)

### Config Validation (HLTH-02: Config Structure and Values)
- Validate config.json is parseable JSON
- Validate known keys against allowed values: `model_profile` must be one of `quality`, `balanced`, `budget` (from existing `cmdValidateHealth` logic)
- Report unknown top-level keys as info-level notices, not errors (Claude's Decision: config may contain user-added keys for future features; treating unknowns as errors would be too strict)

### State Consistency (HLTH-03: STATE.md vs ROADMAP.md)
- Compare STATE.md frontmatter `milestone` field against the active milestone in ROADMAP.md
- Check that STATE.md phase references point to phases that exist on disk
- Detect when STATE.md reports a phase as current but ROADMAP.md shows it already completed (or vice versa) (Claude's Decision: this is the most actionable consistency check -- catches stale state after manual edits or interrupted runs)

### Error and Warning Reporting (HLTH-04)
- Three severity levels: `error` (broken, blocks operation), `warning` (degraded, may cause issues), `info` (informational, no action needed)
- Each issue includes: `code` (e.g., E001), `message` (human-readable description), and `fix` (suggested remediation)
- Overall status: `healthy` (no errors or warnings), `degraded` (warnings only), `broken` (errors present)
- Issue codes match the existing `cmdValidateHealth` convention (E001-E005 for errors, W001-W007 for warnings, I001 for info)

### Output Structure
- `handleHealth(projectRoot, args, mode)` returns a structured data object with fields: `command`, `status`, `checks`, `errors`, `warnings`, `info`, and `message` (rich-formatted string)
- The `checks` array contains one entry per required file with `name`, `path`, `passed`, and `detail` (from HLTH-01: "pass/fail check for each required file")
- The `errors`, `warnings`, and `info` arrays contain issue objects with `code`, `message`, and `fix` fields (from HLTH-04)
- The `status` field is one of `healthy`, `degraded`, or `broken` (from existing `cmdValidateHealth` pattern)

### Rich Terminal Rendering
- Header line showing overall status with color: green for healthy, yellow for degraded, red for broken (Claude's Decision: traffic-light convention consistent with Phase 15 progress command)
- File checks section: one line per required file with pass/fail icon prefix -- checkmark for pass, cross for fail (from HLTH-01)
- Config validation section: shows config.json parse status and any invalid values (from HLTH-02)
- State consistency section: shows STATE.md vs ROADMAP.md comparison results (from HLTH-03)
- Issues section: lists errors first, then warnings, each with code, description, and fix suggestion (from HLTH-04)
- Summary line: count of errors, warnings, and info items
- Color scheme: green for pass, red for errors, yellow for warnings, dim for info -- consistent with Phase 15/16 color conventions

### JSON Output Mode
- `--json` flag returns the structured data object directly via `formatOutput()` (from CLI-04, already wired in Phase 14)
- JSON structure includes `status`, `checks` array, `errors` array, `warnings` array, `info` array

### Plain Output Mode
- `--plain` flag strips ANSI codes from rich output via existing `formatOutput()` (from CLI-05, already wired in Phase 14)

### Integration with CLI Framework
- Replace `handleHealth` stub in `cli.cjs` with the real implementation
- Handler receives `(projectRoot, args, mode)` from the existing router -- same signature as the stub (from Phase 14 architecture)
- Implementation lives inside `cli.cjs` alongside `handleProgress` and `handleTodos` (Claude's Decision: consistent with Phase 15 and 16 pattern; all CLI handlers in one module)
- No `--repair` flag for the CLI health command -- repair is an internal concern for `gsd-tools.cjs validate health --repair`, the user-facing CLI is read-only (Claude's Decision: CLI is read-only per v1.3 requirements; repair actions belong to the internal gsd-tools interface, not the user-facing CLI)

### Claude's Discretion
- Exact ANSI escape code sequences and unicode characters for pass/fail icons
- Spacing and alignment within the health report layout
- Exact wording of fix suggestion strings
- Internal helper function decomposition within the handler
- Whether to group checks by category (files, config, consistency) or show as a flat list
- Order of checks within each category

</decisions>

<specifics>
## Specific Ideas

- PROJECT.md states: "Existing CLI infrastructure: `gsd-tools.cjs` already handles state parsing (`state-snapshot`, `roadmap analyze`, `progress bar`, `validate health`). The new `gsd` CLI builds on this parsing layer."
- REQUIREMENTS.md scopes HLTH-01, HLTH-02, HLTH-03, and HLTH-04 to this phase
- ROADMAP success criteria explicitly require: pass/fail check for each required .planning/ file, config.json validated for correct structure and known key values, consistency check between STATE.md phase position and ROADMAP.md phase status, and error/warning descriptions naming the affected file
- The existing `cmdValidateHealth()` in `verify.cjs` already performs 8 categories of checks (E001-E005 errors, W001-W007 warnings, I001 info) -- the health handler reshapes this data into a CLI-friendly format with pass/fail checks per file
- Config validation already checks `model_profile` against `['quality', 'balanced', 'budget']` in `cmdValidateHealth()`
- The existing function uses `addIssue(severity, code, message, fix, repairable)` -- the `repairable` flag and `--repair` behavior are internal to gsd-tools and not exposed in the CLI
- REQUIREMENTS.md explicitly excludes interactive prompts -- keep CLI read-only for v1.3

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/verify.cjs` > `cmdValidateHealth(cwd, options, raw)`: The core health validation engine. Performs 8 check categories covering file existence, section validation, config parsing, state references, phase naming, orphaned plans, and ROADMAP/disk consistency. Returns structured data with `status`, `errors`, `warnings`, `info`, and `repairable_count`. However, it calls `output()` internally (side effect), so the handler needs to extract the check logic into a standalone data-gathering function.
- `get-shit-done/bin/lib/verify.cjs` > `cmdValidateConsistency(cwd, raw)`: Separate consistency checker for ROADMAP vs disk phases, sequential numbering, plan numbering, and orphan detection. Some of its checks overlap with `cmdValidateHealth` (checks 6-8), but `cmdValidateHealth` is the more comprehensive superset.
- `get-shit-done/bin/lib/cli.cjs` > `handleHealth()`: Current stub returning `{ command: 'health', message: '...' }`. Will be replaced with real implementation.
- `get-shit-done/bin/lib/cli.cjs` > `formatOutput(data, mode)`: Handles JSON/plain/rich mode formatting. Already wired into the router.
- `get-shit-done/bin/lib/cli.cjs` > `handleProgress(projectRoot)` and `handleTodos(projectRoot, args)`: Reference implementations showing the established pattern: gather data via a separate function, build rich-mode formatted string, return `{ command, ...data, message }`.
- `get-shit-done/bin/lib/core.cjs` > `getMilestoneInfo(cwd)`: Returns `{ version, name }` from ROADMAP.md. Useful for state consistency checks.
- `get-shit-done/bin/lib/frontmatter.cjs` > `extractFrontmatter()`: Parses YAML frontmatter from STATE.md for milestone/status fields.
- `tests/cli.test.cjs`: Existing test with stub assertion `routes health to handler` that will need updating to verify real data.

### Established Patterns
- CJS module pattern: `require()` / `module.exports`, no ESM
- Handler signature: `function handleX(projectRoot, args, mode)` returning a data object
- `formatOutput(data, mode)` in the CLI entry point handles rendering: JSON mode stringifies, plain mode strips ANSI, rich mode uses `message` property
- For rich mode, handlers return an object with a `message` string property containing the formatted output
- `gatherProgressData()` and `gatherTodosData()` extracted as separate data-gathering functions -- data gathering separated from rendering
- ANSI color constants: `BOLD`, `RESET`, `GREEN`, `YELLOW`, `CYAN`, `DIM` defined as escape sequences in handler functions
- Tests use `node:test` describe/test blocks with temp directories, `beforeEach`/`afterEach` cleanup
- The `addIssue(severity, code, message, fix, repairable)` pattern in `cmdValidateHealth` for structured issue reporting

### Integration Points
- `get-shit-done/bin/lib/cli.cjs`: Replace `handleHealth` stub with real implementation
- `get-shit-done/bin/gsd-cli.cjs`: No changes needed -- already routes `health` to handler
- `tests/cli.test.cjs`: Existing stub test for health route needs updating. New tests needed for: file existence checks, config validation, state consistency, error/warning reporting, empty/degraded/broken status, and JSON output.
- `.planning/config.json`: Read and validated by the health command. Known keys: `model_profile`, `commit_docs`, `search_gitignored`, `branching_strategy`, `workflow` (nested), `parallelization`, `autopilot` (nested).
- `.planning/STATE.md`: Read for frontmatter fields (`milestone`, `milestone_name`, `status`, `progress`).
- `.planning/ROADMAP.md`: Read for milestone and phase completion status.

</code_context>

<deferred>
## Deferred Ideas

- Settings command implementation -- Phase 18
- Help command enhancements -- Phase 18
- `--repair` flag for CLI health command -- not in requirements; repair actions are internal to `gsd-tools.cjs validate health --repair`
- Config schema evolution (validating new keys added in future milestones) -- future concern
- Health check for `.planning/REQUIREMENTS.md` existence -- not in current required file list but could be added later
- Shell completions -- explicitly out of scope for v1.3

</deferred>

---

*Phase: 17-health-command*
*Context gathered: 2026-03-03 via auto-context*
