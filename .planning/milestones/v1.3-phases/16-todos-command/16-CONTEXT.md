# Phase 16: Todos Command - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can list, filter, and inspect pending todos without opening the .planning/todos directory manually. This phase replaces the `handleTodos` stub in `cli.cjs` with a real implementation that reads `.planning/todos/pending/`, lists todos with ID/title/area, supports `--area=<value>` filtering, and displays full todo contents when given a specific ID. It does NOT touch other commands (health, settings) -- those remain stubs for Phases 17-18.

</domain>

<decisions>
## Implementation Decisions

### Data Access
- Reuse `cmdListTodos()` from `commands.cjs` for reading `.planning/todos/pending/`, parsing frontmatter fields (title, area, created), and filtering by area -- it already does all of this (from PROJECT.md: "gsd-tools.cjs already handles state parsing")
- Todo ID is the filename without `.md` extension (from existing `cmdListTodos` pattern where `file` field is the filename)
- For single-todo detail view (`gsd todos <id>`), read the full file content from `.planning/todos/pending/<id>.md` and return it alongside the parsed frontmatter fields (from TODO-03)

### Flag Parsing
- `--area=<value>` flag parsed in `handleTodos` from the raw argv, not in the global `parseArgs` (Claude's Decision: keeps `parseArgs` generic and avoids adding command-specific logic to the shared parser; `handleTodos` receives `args` and `mode` and can extract `--area` from `process.argv` or the full argv slice)
- Support both `--area=feature` and `--area feature` styles (Claude's Decision: both are standard CLI conventions and trivial to support)

### Command Modes
- `gsd todos` (no args): list all pending todos showing ID, title, and area for each (from TODO-01)
- `gsd todos --area=<value>`: list only todos matching the given area (from TODO-02)
- `gsd todos <id>`: display full contents of the specified todo file (from TODO-03)
- When an ID is provided that does not match any pending todo file, return an error message listing the ID and suggesting `gsd todos` to see available IDs (Claude's Decision: actionable error better than silent failure)

### Output Structure
- `handleTodos(projectRoot, args, mode)` returns a structured data object with fields: `command`, `todos` (array), `count`, and `message` (rich-formatted string)
- List mode: each todo in the array includes `id` (filename sans `.md`), `title`, `area`, and `created`
- Detail mode: returns a single-item structure with `id`, `title`, `area`, `created`, `content` (full markdown body below frontmatter), and `path`
- The `message` field contains the rich-mode formatted string for display (from established `handleProgress` pattern)

### Rich Terminal Rendering
- List mode renders a table-like layout: one line per todo with columns for ID, area, and title (Claude's Decision: tabular format is scannable and matches CLI dashboard conventions established in Phase 15)
- Header line showing count: e.g., "3 pending todos" or "1 pending todo (area: feature)"
- ID column left-aligned, area column fixed-width, title fills remaining space
- Area shown in parentheses or brackets to visually separate from title (Claude's Decision: lightweight visual grouping without heavy table borders)
- Detail mode renders frontmatter fields at top followed by full body content, with the title in bold (Claude's Decision: mirrors how users would read the raw file but with formatting)
- Empty state: when no todos match, show "No pending todos" (or "No pending todos matching area '<value>'") (Claude's Decision: clear empty state message avoids confusion)
- Color scheme: dim for ID, cyan for area, default for title -- consistent with Phase 15 color conventions

### JSON Output Mode
- `--json` flag returns the structured data object directly via `formatOutput()` (from CLI-04, already wired in Phase 14)
- List mode JSON: `{ command: "todos", count: N, todos: [...] }`
- Detail mode JSON: `{ command: "todos", todo: { id, title, area, created, content, path } }`

### Plain Output Mode
- `--plain` flag strips ANSI codes from rich output via existing `formatOutput()` (from CLI-05, already wired in Phase 14)

### Integration with CLI Framework
- Replace `handleTodos` stub in `cli.cjs` with the real implementation
- Handler receives `(projectRoot, args, mode)` from the existing router -- same signature as the stub (from Phase 14 architecture)
- Implementation lives inside `cli.cjs` alongside `handleProgress` (Claude's Decision: consistent with Phase 15 pattern; all CLI handlers in one module)
- Import `cmdListTodos` from `commands.cjs` for data access, or inline the logic if calling `cmdListTodos` directly is awkward due to its `output()` side effect (Claude's Decision: `cmdListTodos` calls `output()` internally which writes to stdout -- handler needs raw data instead, so either extract the logic or call the internal parts directly)

### Claude's Discretion
- Exact column widths and spacing in the list layout
- Exact ANSI escape code sequences for colors
- Whether to truncate long titles in list mode
- Internal helper function decomposition within the handler
- Exact wording of error messages for missing todo IDs
- Whether `--area` matching is case-sensitive or case-insensitive

</decisions>

<specifics>
## Specific Ideas

- PROJECT.md states: "Existing CLI infrastructure: `gsd-tools.cjs` already handles state parsing (`state-snapshot`, `roadmap analyze`, `progress bar`, `validate health`). The new `gsd` CLI builds on this parsing layer."
- REQUIREMENTS.md scopes TODO-01, TODO-02, and TODO-03 to this phase
- ROADMAP success criteria explicitly require: all pending todos with ID/title/area, area filtering with `--area=feature`, and full contents of a specific todo via `gsd todos <id>`
- The existing `cmdListTodos()` in `commands.cjs` already parses todo files using regex on frontmatter lines (`title:`, `area:`, `created:`), filters by area, and returns `{ count, todos }` -- this is the core data access layer
- Todo files use a simple frontmatter format (not YAML-fenced) with `created:`, `title:`, `area:`, `files:` fields, followed by markdown body content
- REQUIREMENTS.md explicitly excludes interactive prompts -- keep CLI read-only for v1.3
- The actual todo file seen in `.planning/todos/pending/` uses `---` fenced YAML frontmatter with `created`, `title`, `area`, and `files` fields

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/commands.cjs` > `cmdListTodos(cwd, area, raw)`: Reads `.planning/todos/pending/`, parses title/area/created from each `.md` file, filters by area, returns `{ count, todos }`. Core data access for TODO-01 and TODO-02. However, it calls `output()` internally (side effect), so the handler may need to extract the parsing logic or read files directly.
- `get-shit-done/bin/lib/cli.cjs` > `handleTodos()`: Current stub returning `{ command: 'todos', message: '...' }`. Will be replaced with real implementation.
- `get-shit-done/bin/lib/cli.cjs` > `formatOutput(data, mode)`: Handles JSON/plain/rich mode formatting. Already wired into the router.
- `get-shit-done/bin/lib/cli.cjs` > `handleProgress(projectRoot)`: Reference implementation showing the pattern: gather data, build rich-mode formatted string, return `{ command, ...data, message }`.
- `tests/cli.test.cjs`: Existing test with stub assertion `routes todos to handler` that will need updating to verify real data.

### Established Patterns
- CJS module pattern: `require()` / `module.exports`, no ESM
- Handler signature: `function handleX(projectRoot, args, mode)` returning a data object
- `formatOutput(data, mode)` in the CLI entry point handles rendering: JSON mode stringifies, plain mode strips ANSI, rich mode uses `message` property
- For rich mode, handlers return an object with a `message` string property containing the formatted output
- `gatherProgressData()` extracted as a separate function from `handleProgress()` -- data gathering separated from rendering
- ANSI color constants: `BOLD`, `RESET`, `GREEN`, `YELLOW`, `CYAN`, `DIM` defined as escape sequences in handler functions
- Tests use `node:test` describe/test blocks with temp directories, `beforeEach`/`afterEach` cleanup

### Integration Points
- `get-shit-done/bin/lib/cli.cjs`: Replace `handleTodos` stub with real implementation
- `get-shit-done/bin/gsd-cli.cjs`: No changes needed -- already routes `todos` to handler
- `get-shit-done/bin/lib/cli.cjs` > `parseArgs()`: Currently drops all `--` prefixed args except `--json`/`--plain`. The `--area=value` flag needs to be handled -- either by extending `parseArgs` to collect unknown flags, or by parsing `--area` within the handler from the original argv.
- `tests/cli.test.cjs`: Existing stub test for todos route needs updating. New tests needed for list mode, area filtering, detail mode, empty state, and missing ID error.
- `.planning/todos/pending/`: The directory containing todo files. Currently has one file with `---` fenced YAML frontmatter.

</code_context>

<deferred>
## Deferred Ideas

- Health command implementation -- Phase 17
- Settings and help command enhancements -- Phase 18
- Todo completion/archival from CLI (`gsd todos complete <id>`) -- not in requirements, `cmdTodoComplete` exists in `commands.cjs` but is not exposed via CLI
- Todo creation from CLI -- not in requirements, CLI is read-only for v1.3
- Sorting todos by created date or area -- not in requirements
- Shell completions for todo IDs -- explicitly out of scope for v1.3

</deferred>

---

*Phase: 16-todos-command*
*Context gathered: 2026-03-03 via auto-context*
