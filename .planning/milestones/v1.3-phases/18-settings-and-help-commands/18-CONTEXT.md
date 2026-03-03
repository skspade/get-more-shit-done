# Phase 18: Settings and Help Commands - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can view and update config values and access command reference documentation from the CLI. This phase replaces the `handleSettings` and `handleHelp` stubs in `cli.cjs` with real implementations: `gsd settings` displays all config.json key-value pairs, `gsd settings set <key> <value>` writes validated values, and `gsd help` / `gsd help <command>` provides a command reference. This is the final phase in the v1.3 CLI Utilities milestone.

</domain>

<decisions>
## Implementation Decisions

### Settings Command - View Mode (SETT-01)
- `gsd settings` reads `.planning/config.json` and displays all current key-value pairs
- Nested objects (e.g., `workflow`, `autopilot`) are flattened to dot-notation for display: `workflow.research = false`, `workflow.plan_check = true` (Claude's Decision: dot-notation matches the existing `cmdConfigSet`/`cmdConfigGet` key path convention and is immediately usable as input to `gsd settings set`)
- If `config.json` does not exist, display an error message directing the user to run `/gsd:health --repair` to create defaults (Claude's Decision: consistent with health command's W003 fix suggestion for missing config)

### Settings Command - Set Mode (SETT-02)
- `gsd settings set <key> <value>` writes the value to `.planning/config.json` after validation
- Key path uses dot notation for nested values (e.g., `workflow.research`, `autopilot.circuit_breaker_threshold`) matching the existing `cmdConfigSet` convention from `config.cjs`
- Value parsing: `true`/`false` become booleans, numeric strings become numbers, everything else stays a string -- matching the existing `cmdConfigSet` parsing logic from `config.cjs`
- On success, display the updated key-value pair as confirmation (Claude's Decision: immediate feedback confirms the write happened and shows the parsed value type)

### Settings Command - Validation (SETT-03)
- Validate `model_profile` against allowed values: `quality`, `balanced`, `budget` (from existing `cmdValidateHealth` logic in `gatherHealthData`)
- Validate `commit_docs`, `search_gitignored`, `parallelization` are boolean values (Claude's Decision: these are boolean flags in every observed config.json; rejecting non-boolean prevents silent misconfigurations)
- Validate `branching_strategy` against allowed values: `none`, `phase`, `milestone` (Claude's Decision: these are the three strategies the config supports based on the `phase_branch_template` and `milestone_branch_template` fields in `cmdConfigEnsureSection`)
- Validate nested workflow boolean keys (`workflow.research`, `workflow.plan_check`, `workflow.verifier`, `workflow.auto_advance`) are boolean values (Claude's Decision: these control feature toggles; non-boolean values would cause truthy/falsy ambiguity)
- Validate `autopilot.circuit_breaker_threshold` is a positive integer (Claude's Decision: zero or negative thresholds would disable the circuit breaker safety mechanism)
- Unknown keys are allowed but trigger an info-level notice rather than blocking the write (Claude's Decision: users may add custom keys for extensions; blocking unknown keys would be too restrictive per the health command's existing I001 treatment of unknown keys)
- On validation failure, display the error message and do not write to disk (from SETT-03 success criteria)

### Settings Command - Argument Parsing
- `gsd settings` (no additional args): view all settings
- `gsd settings set <key> <value>`: set a value
- The `set` subcommand, key, and value are extracted from the `args` array passed by `routeCommand` (Claude's Decision: `parseArgs` already collects non-flag positional args, so `args[0]` is `set`, `args[1]` is the key, `args[2]` is the value -- no need to re-parse `process.argv`)

### Help Command - Command List (HELP-01)
- `gsd help` displays all available commands with one-line descriptions
- Command names and descriptions sourced from the existing `COMMANDS` registry object in `cli.cjs`
- Include the global `--json` and `--plain` flags in the help output
- The existing `handleHelp` stub already renders the command list and options -- extend it rather than rewriting (Claude's Decision: the stub already has the correct structure; adding per-command detail is the only gap)

### Help Command - Per-Command Detail (HELP-02)
- `gsd help <command>` displays detailed usage, flags, and examples for that command
- Each command's detail includes: usage line, description, available flags/arguments, and 1-2 usage examples
- Command detail data stored as a static registry object within `cli.cjs` alongside `COMMANDS` (Claude's Decision: keeps all command metadata co-located; a separate file is not warranted for 5 commands)
- Unknown command in `gsd help <unknown>` shows an error listing available commands (Claude's Decision: consistent with the unknown-command routing error in `gsd-cli.cjs`)

### Output Structure
- `handleSettings(projectRoot, args, mode)` returns a structured data object with `command`, `settings` (key-value object or flattened array), and `message` (rich-formatted string)
- For set mode, returns `command`, `updated` (boolean), `key`, `value`, and `message`
- For validation errors, returns `command`, `error` (true), `key`, `value`, `message` with the validation error description
- `handleHelp(projectRoot, args, mode)` returns `command`, `message`, and optionally `detail` (object with `usage`, `description`, `flags`, `examples` for per-command help)

### Rich Terminal Rendering
- Settings view: header line "Settings (.planning/config.json)", then one line per setting showing `key = value` with dim key and bold value (Claude's Decision: key-value alignment is scannable and matches `handleTodos` detail layout)
- Settings set success: confirmation line showing `key = value (updated)` in green
- Settings set error: error message in red with the valid values listed
- Help overview: same as existing stub output (usage, commands table, options)
- Help per-command: usage line in bold, description, flags/args list, and example invocations in dim (Claude's Decision: mirrors standard man-page convention -- synopsis, description, options, examples)
- Color scheme: consistent with existing handlers -- green for success, red for error, dim for secondary text, bold for emphasis

### JSON and Plain Output Modes
- `--json` returns the structured data objects directly via `formatOutput()` (from CLI-04)
- `--plain` strips ANSI codes from rich output via `formatOutput()` (from CLI-05)

### Integration with CLI Framework
- Replace `handleSettings` stub in `cli.cjs` with real implementation
- Extend `handleHelp` in `cli.cjs` to support per-command detail via `args[0]`
- Both handlers receive `(projectRoot, args, mode)` from the existing router (from Phase 14 architecture)
- `handleHelp` in `gsd-cli.cjs` is called without `projectRoot` (it passes `null`) -- this remains unchanged since help does not need project context
- Settings command reads and writes `.planning/config.json` directly using `fs` -- no need to import `config.cjs` functions since they call `output()` internally (Claude's Decision: same pattern as Phases 15-17 where handlers implement their own data gathering to avoid side-effect-producing gsd-tools functions)
- Add `gatherSettingsData(projectRoot)` function following the established `gatherProgressData`/`gatherTodosData`/`gatherHealthData` pattern (Claude's Decision: consistent data-gathering pattern across all handlers)

### Claude's Discretion
- Exact column alignment and spacing in settings display
- Exact ANSI escape code sequences for colors
- Exact wording of help examples
- Internal helper function decomposition
- Whether to sort settings alphabetically or preserve config.json key order
- Exact wording of validation error messages

</decisions>

<specifics>
## Specific Ideas

- PROJECT.md states: "Existing CLI infrastructure: `gsd-tools.cjs` already handles state parsing (`state-snapshot`, `roadmap analyze`, `progress bar`, `validate health`). The new `gsd` CLI builds on this parsing layer."
- REQUIREMENTS.md scopes SETT-01, SETT-02, SETT-03, HELP-01, and HELP-02 to this phase
- REQUIREMENTS.md explicitly excludes interactive prompts -- keep CLI read-only for v1.3 except for the `settings set` write operation which is explicitly required
- ROADMAP success criteria explicitly require: viewing all config key-value pairs, setting values after validation, validation errors with no file write, all commands listed with descriptions, and per-command detailed help
- The existing `handleHelp` stub already renders the command list from the `COMMANDS` registry -- it just needs per-command detail support via `args[0]`
- The existing `config.cjs` module has `cmdConfigSet` and `cmdConfigGet` with dot-notation key path traversal, boolean/number parsing, and JSON file read/write -- the handler reimplements this inline to avoid the `output()` side effect
- Config validation already exists in `gatherHealthData()` for `model_profile` values -- the settings command reuses the same allowed-values list
- The actual config.json in this project contains keys: `mode`, `depth`, `parallelization`, `commit_docs`, `model_profile`, `workflow` (nested), `autopilot` (nested) -- the validation rules cover the known keys while allowing unknown ones

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/cli.cjs` > `handleSettings()`: Current stub returning `{ command: 'settings', message: '...' }`. Will be replaced with real implementation.
- `get-shit-done/bin/lib/cli.cjs` > `handleHelp()`: Current implementation renders command list from `COMMANDS` registry. Will be extended with per-command detail support.
- `get-shit-done/bin/lib/cli.cjs` > `COMMANDS` registry: Contains all five command entries with `description` and `handler` -- the help command reads this for the command list.
- `get-shit-done/bin/lib/cli.cjs` > `formatOutput(data, mode)`: Handles JSON/plain/rich mode formatting. Already wired into the router.
- `get-shit-done/bin/lib/cli.cjs` > `gatherProgressData()`, `gatherTodosData()`, `gatherHealthData()`: Established data-gathering pattern to follow for `gatherSettingsData()`.
- `get-shit-done/bin/lib/config.cjs` > `cmdConfigSet(cwd, keyPath, value, raw)`: Dot-notation key traversal, boolean/number parsing, and JSON write. Reference implementation for the settings set logic (but calls `output()` internally).
- `get-shit-done/bin/lib/config.cjs` > `cmdConfigGet(cwd, keyPath, raw)`: Dot-notation key traversal and JSON read. Reference for value retrieval.
- `get-shit-done/bin/lib/config.cjs` > `cmdConfigEnsureSection(cwd, raw)`: Contains the default config structure including all known keys and default values -- useful as a reference for what keys exist and their types.
- `tests/cli.test.cjs`: Existing stub tests for settings and help routes that will need updating. Established test patterns with temp directories, `beforeEach`/`afterEach` cleanup.

### Established Patterns
- CJS module pattern: `require()` / `module.exports`, no ESM
- Handler signature: `function handleX(projectRoot, args, mode)` returning a data object
- `formatOutput(data, mode)` in the CLI entry point handles rendering: JSON mode stringifies, plain mode strips ANSI, rich mode uses `message` property
- For rich mode, handlers return an object with a `message` string property containing the formatted output
- Data-gathering functions extracted as `gatherXData()` -- data gathering separated from rendering
- ANSI color constants: `BOLD`, `RESET`, `GREEN`, `YELLOW`, `CYAN`, `DIM`, `RED` defined as escape sequences in handler functions
- Tests use `node:test` describe/test blocks with temp directories, `beforeEach`/`afterEach` cleanup
- `parseArgs()` drops all `--` prefixed args except `--json`/`--plain` -- the `set` subcommand and key/value are positional args captured in `args`

### Integration Points
- `get-shit-done/bin/lib/cli.cjs`: Replace `handleSettings` stub and extend `handleHelp` with per-command detail
- `get-shit-done/bin/gsd-cli.cjs`: No changes needed -- already routes `settings` and `help` to handlers. Help is already handled specially (no projectRoot required).
- `tests/cli.test.cjs`: Existing stub test `routes settings to handler` needs updating. New tests needed for: settings view, settings set with validation, settings set with valid value, validation error for invalid value, help overview, help per-command detail, help for unknown command.
- `.planning/config.json`: Read by settings view and written by settings set.

</code_context>

<deferred>
## Deferred Ideas

- Interactive config editing with prompts -- explicitly out of scope per REQUIREMENTS.md ("Keep CLI read-only for v1.3; interactive editing adds complexity"); `settings set` is a direct write, not interactive
- Config schema versioning or migration -- future concern when config structure evolves
- `gsd settings reset` to restore defaults -- not in requirements
- `gsd settings delete <key>` to remove a key -- not in requirements
- Man page or external documentation generation from help data -- not in requirements
- Shell completions for settings keys or command names -- explicitly out of scope for v1.3
- `gsd resume` and `gsd roadmap` commands -- tracked as future requirements (RESM-01, RESM-02, ROAD-01)

</deferred>

---

*Phase: 18-settings-and-help-commands*
*Context gathered: 2026-03-03 via auto-context*
