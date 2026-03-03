# Phase 14: CLI Infrastructure - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can invoke a standalone `gsd` binary from any directory within a GSD project, and the CLI routes to the correct subcommand. This phase delivers the entry point, project discovery, command routing, output format flags (`--json`, `--plain`), and error handling. It does NOT implement individual command logic (progress, todos, health, settings, help) -- those are Phases 15-18.

</domain>

<decisions>
## Implementation Decisions

### Binary Entry Point
- Standalone `gsd` binary invocable from any directory within a GSD project (from CLI-01)
- Node.js CJS script with `#!/usr/bin/env node` shebang, matching existing `gsd-tools.cjs` convention (Claude's Decision: project is Node.js CJS throughout, no reason to diverge)
- Entry point file at `get-shit-done/bin/gsd-cli.cjs` alongside existing `gsd-tools.cjs` (Claude's Decision: co-locate with existing bin scripts for discoverability and consistency)
- Add `"gsd": "get-shit-done/bin/gsd-cli.cjs"` to package.json `bin` field (Claude's Decision: standard npm bin pattern enables `npx gsd` and local `./node_modules/.bin/gsd` without global install)
- Symlink or `npm link` for local development; no global install required (Claude's Decision: matches existing install-fork workflow)

### Project Discovery (CLI-02)
- Auto-discover `.planning/` directory by walking up from `cwd` to filesystem root
- Stop at first directory containing a `.planning/` subdirectory
- Return the project root path (parent of `.planning/`) for use by all subcommands
- Display clear error when `.planning/` is not found in any ancestor directory (from CLI-06)

### Command Routing (CLI-03)
- Route subcommands: `progress`, `todos`, `health`, `settings`, `help`
- Each subcommand maps to a handler module that this phase stubs out with placeholder responses (Claude's Decision: stubs allow routing verification without implementing full commands yet)
- Unknown subcommands print a "command not found" message listing available commands
- Running `gsd` with no subcommand shows usage summary identical to `gsd help` output (Claude's Decision: standard CLI convention -- bare invocation shows help)

### Output Flags (CLI-04, CLI-05)
- `--json` flag: all output rendered as valid JSON to stdout
- `--plain` flag: all output rendered as ANSI-free plain text to stdout
- Default output (no flag): rich terminal output with ANSI colors and unicode characters
- Output mode determined once at entry point and passed as context to handler (Claude's Decision: single parse point avoids each command re-parsing flags)
- Output formatting utility module that handlers call with structured data, letting the formatter decide rendering based on mode (Claude's Decision: separates data from presentation cleanly)

### Error Handling (CLI-06)
- Running outside a GSD project: clear error message naming `.planning/` and suggesting where to run
- Unknown subcommand: list available commands
- Exit code 0 for success, exit code 1 for errors (Claude's Decision: standard POSIX convention, no custom exit codes needed at this layer)
- Errors written to stderr, normal output to stdout (Claude's Decision: standard Unix convention enables piping)

### Architecture
- Thin entry point that parses args, discovers project, resolves output mode, and dispatches to handler
- Handlers import from existing `gsd-tools.cjs` lib modules (`core.cjs`, `commands.cjs`, `verify.cjs`, `config.cjs`) for all data access (Claude's Decision: reuse existing parsing layer rather than duplicating logic)
- No new dependencies -- pure Node.js stdlib only, matching existing `gsd-tools.cjs` approach (Claude's Decision: zero-dependency policy consistent with project)

### Claude's Discretion
- Internal argument parsing approach (manual argv parsing vs lightweight helper)
- Exact error message wording
- Whether stub handlers return static strings or minimal structured data
- Internal file/module naming within the handler directory
- Color palette selection for rich output mode

</decisions>

<specifics>
## Specific Ideas

- PROJECT.md states: "Existing CLI infrastructure: `gsd-tools.cjs` already handles state parsing (`state-snapshot`, `roadmap analyze`, `progress bar`, `validate health`). The new `gsd` CLI builds on this parsing layer."
- REQUIREMENTS.md explicitly excludes interactive prompts (inquirer-style) -- keep CLI read-only for v1.3
- REQUIREMENTS.md excludes `gsd init` (requires LLM), `gsd run` (requires LLM), npm publish (future), and shell completions (future)
- Out of scope table confirms: "Interactive prompts: Keep CLI read-only for v1.3; interactive editing adds complexity"
- The `gsd-tools.cjs` already has a `--cwd` override pattern and `--raw` flag for machine-readable output -- the new CLI's `--json` flag serves a similar purpose but with richer formatting

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/core.cjs`: `loadConfig()`, `getMilestoneInfo()`, `findPhaseInternal()`, `output()`, `error()` -- all data access utilities the CLI handlers will call
- `get-shit-done/bin/lib/commands.cjs`: `cmdProgressRender()` already produces progress data in JSON, table, and bar formats; `cmdListTodos()` already parses todos with area filtering
- `get-shit-done/bin/lib/verify.cjs`: `cmdValidateHealth()` already validates `.planning/` integrity with errors/warnings
- `get-shit-done/bin/lib/config.cjs`: `cmdConfigEnsureSection()`, `cmdConfigSet()`, `cmdConfigGet()` already handle config CRUD
- `tests/` directory: existing test files for every lib module (`commands.test.cjs`, `core.test.cjs`, etc.) using the project's custom test runner (`scripts/run-tests.cjs`)

### Established Patterns
- CJS module pattern: `require()` / `module.exports`, no ESM
- `output(result, raw, rawValue)` convention: JSON by default, raw string when `--raw` flag present
- `error(message)` convention: writes to stderr and exits with code 1
- `cwd` passed as first argument to every command function
- Each lib module exports named `cmd*` functions that the router dispatches to
- Tests use `node scripts/run-tests.cjs` with c8 coverage

### Integration Points
- `package.json` `bin` field: needs new `"gsd"` entry pointing to the CLI entry point
- Existing `gsd-tools.cjs` router: the new `gsd` CLI is a separate entry point, not a modification of `gsd-tools.cjs`
- The CLI handlers will import from `./lib/*.cjs` -- same modules `gsd-tools.cjs` uses
- `.planning/config.json`: read by `loadConfig()` for project configuration

</code_context>

<deferred>
## Deferred Ideas

- Individual command implementations (progress, todos, health, settings, help) -- Phases 15-18
- Shell completions (bash/zsh) -- explicitly out of scope for v1.3
- npm package distribution -- explicitly out of scope for v1.3
- `gsd init` and `gsd run` -- require LLM, out of scope
- Interactive prompts -- out of scope for v1.3
- `gsd resume` and `gsd roadmap` commands -- tracked as future requirements (RESM-01, RESM-02, ROAD-01)

</deferred>

---

*Phase: 14-cli-infrastructure*
*Context gathered: 2026-03-03 via auto-context*
