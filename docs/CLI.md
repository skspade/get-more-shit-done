# GSD CLI Reference

The `gsd` standalone command-line tool provides project status, todo management, health checks, and configuration from any terminal. It works independently of Claude Code, OpenCode, Gemini CLI, or Codex -- no runtime session required.

This is distinct from the `/gsd:*` commands used inside runtime sessions. For those, see the [README](../README.md#commands).

---

## Installation

The CLI is included when you install GSD:

```bash
npx get-shit-done-cc@latest
```

After installation, the `gsd` binary is available from `node_modules/.bin/gsd` (or globally if installed with `-g`). The binary entry point is `get-shit-done/bin/gsd-cli.cjs`.

The CLI requires a `.planning/` directory in or above the current working directory. If not found, it exits with an error. The `help` command is the exception and works without a project root.

---

## Global Options

All commands accept these output format flags:

| Flag | Description |
|------|-------------|
| `--json` | Output as structured JSON (useful for scripting and piping to `jq`) |
| `--plain` | Output as plain text with ANSI color codes stripped (useful for log files) |

The default output mode is rich text with ANSI colors and icons.

---

## Commands

### gsd progress

Show milestone progress and status.

```
gsd progress [--json] [--plain]
```

Displays the current milestone name, version, and status. Lists all phases with completion indicators, plan counts, a progress bar, and a suggested next action.

**Rich output status icons:**

| Icon | Meaning |
|------|---------|
| `✓` (green) | Phase complete |
| `▶` (yellow) | Phase in progress |
| `○` (cyan) | Phase planned (has plans, none executed) |
| `-` (dim) | Phase not started (no plans yet) |

**Example (rich mode):**

```
CLI Utilities v1.3 (complete)

Phases:
  ✓ Phase 14: cli scaffolding  2/2 plans
  ✓ Phase 15: progress command  1/1 plans
  ✓ Phase 16: todos command  2/2 plans
  ✓ Phase 17: health command  1/1 plans
  ✓ Phase 18: settings command  2/2 plans
  ✓ Phase 19: testing  1/1 plans

Progress: [████████████████████] 9/9 plans (100%)

Next: All phases complete -- milestone done
```

**JSON output fields:**

| Field | Description |
|-------|-------------|
| `milestone.name` | Milestone name |
| `milestone.version` | Milestone version string |
| `milestone.status` | `active` or `complete` |
| `phases[]` | Array of phase objects |
| `phases[].number` | Phase number |
| `phases[].name` | Phase name |
| `phases[].status_indicator` | `complete`, `in_progress`, `planned`, or `not_started` |
| `phases[].plan_counts` | Human-readable plan count (e.g., `2/3 plans`) |
| `progress.percent` | Completion percentage (0-100) |
| `progress.completed_plans` | Number of completed plans |
| `progress.total_plans` | Total number of plans |
| `progress.bar` | Text progress bar |
| `current_position.phase` | Current phase number, or `null` if all complete |
| `next_action` | Suggested next command to run |

---

### gsd todos

List and inspect pending todos.

```
gsd todos [<id>] [--area=<area>] [--json] [--plain]
```

Operates in two modes:

**List mode** (default): Shows the count and list of all pending todos with their ID, area tag, and title.

```
gsd todos
```

```
3 pending todos

  fix-login-bug     [bugfix]   Fix login button not responding on Safari
  add-dark-mode     [feature]  Add dark mode toggle to settings page
  update-deps       [chore]    Update outdated npm dependencies
```

**Detail mode** (when ID provided): Shows full information for a single todo including ID, area, created date, file path, and body content.

```
gsd todos fix-login-bug
```

```
Fix login button not responding on Safari
ID:      fix-login-bug
Area:    bugfix
Created: 2026-03-01
Path:    .planning/todos/pending/fix-login-bug.md

The login button does not trigger the auth flow on mobile Safari.
Likely related to the click event handler not firing on iOS.
```

**Filtering by area:**

```
gsd todos --area=bugfix
```

Returns only todos matching the specified area tag.

---

### gsd health

Validate `.planning/` directory integrity.

```
gsd health [--json] [--plain]
```

Runs a series of checks against the project structure and reports the overall health status.

**Checks performed:**

| Category | What is checked |
|----------|-----------------|
| Required files | `.planning/`, `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `phases/` |
| Config validity | JSON parses correctly, `model_profile` is a valid value, no unknown keys |
| State consistency | Phase references in STATE.md match directories on disk, STATE.md current phase agrees with ROADMAP.md completion status |

**Status levels:**

| Status | Meaning |
|--------|---------|
| `healthy` | No issues found |
| `degraded` | Warnings present but no errors |
| `broken` | One or more errors detected |

**Error and warning codes:**

| Code | Severity | Description |
|------|----------|-------------|
| `E001` | Error | `.planning/` directory not found |
| `E002` | Error | `PROJECT.md` not found |
| `E003` | Error | `ROADMAP.md` not found |
| `E004` | Error | `STATE.md` not found |
| `E005` | Error | `config.json` JSON parse error |
| `W001` | Warning | `PROJECT.md` missing required section |
| `W002` | Warning | `STATE.md` references a phase with no matching directory |
| `W003` | Warning | `config.json` not found |
| `W004` | Warning | `config.json` has invalid `model_profile` value |
| `W005` | Warning | `STATE.md` current phase disagrees with ROADMAP.md |
| `I001` | Info | `config.json` contains unknown key (may be a custom extension) |

**Example (rich mode):**

```
Health Check  Healthy

Files:
  ✓ .planning/
  ✓ PROJECT.md
  ✓ ROADMAP.md
  ✓ STATE.md
  ✓ config.json
  ✓ phases/

No issues found
```

**Example with issues:**

```
Health Check  Degraded

Files:
  ✓ .planning/
  ✓ PROJECT.md
  ✓ ROADMAP.md
  ✓ STATE.md
  ✗ config.json  File not found
  ✓ phases/

Warnings:
  W003 config.json not found
       Fix: Run /gsd:health --repair to create with defaults

1 warning
```

---

### gsd settings

View and update project configuration.

```
gsd settings [set <key> <value>] [--json] [--plain]
```

Operates in two modes:

**View mode** (default): Displays all settings from `.planning/config.json` in dot-notation key=value format.

```
gsd settings
```

```
Settings (.planning/config.json)

  model_profile = balanced
  commit_docs = true
  search_gitignored = false
  branching_strategy = none
  workflow.research = true
  workflow.plan_check = true
  workflow.verifier = true
  workflow.auto_advance = false
```

**Set mode**: Updates a configuration value with validation.

```
gsd settings set <key> <value>
```

Use dot notation for nested keys:

```
gsd settings set model_profile quality
gsd settings set workflow.research false
gsd settings set autopilot.circuit_breaker_threshold 5
```

**Validation rules:**

| Key | Allowed values |
|-----|---------------|
| `model_profile` | `quality`, `balanced`, `budget` |
| `branching_strategy` | `none`, `phase`, `milestone` |
| `commit_docs`, `search_gitignored`, `parallelization`, `workflow.research`, `workflow.plan_check`, `workflow.verifier`, `workflow.auto_advance` | `true`, `false` |
| `autopilot.circuit_breaker_threshold` | Positive integer |

Setting an unrecognized key is allowed (for custom extensions) but produces a note in the output.

---

### gsd help

Show available commands and usage.

```
gsd help [<command>]
```

**Overview mode** (no arguments): Lists all available commands with brief descriptions.

```
gsd help
```

```
gsd - GSD CLI Utilities

Usage: gsd <command> [options]

Commands:
  progress    Show milestone progress and status
  todos       List and inspect pending todos
  health      Validate .planning/ directory integrity
  settings    View and update configuration
  help        Show available commands and usage

Options:
  --json      Output as JSON
  --plain     Output as plain text (no colors)
```

**Detail mode** (with command name): Shows usage, description, flags, and examples for a specific command.

```
gsd help progress
```

```
gsd progress [--json] [--plain]

Show milestone progress and status. Displays the current milestone name,
version, phase list with completion status, plan counts, progress bar,
and suggested next action.

Arguments and flags:
  --json                Output as JSON
  --plain               Output as plain text (no colors)

Examples:
  gsd progress
  gsd progress --json
```

---

## Project Root Discovery

The CLI walks up from the current working directory looking for a `.planning/` directory. The first directory containing `.planning/` is treated as the project root. If no `.planning/` directory is found anywhere up to the filesystem root, the CLI exits with:

```
Error: Not a GSD project (no .planning/ directory found).
Run this command from within a GSD project directory.
```

The `help` command is the exception -- it works without a project root so you can always check available commands.

---

## Output Formats

All commands support three output formats:

| Format | Flag | Best for |
|--------|------|----------|
| Rich (default) | *(none)* | Interactive terminal use -- ANSI colors, icons, formatted layout |
| Plain | `--plain` | Log files, piping to other tools -- same layout with colors stripped |
| JSON | `--json` | Scripting, automation, piping to `jq` -- structured data object |

**Examples:**

```bash
# Pretty terminal output
gsd progress

# Strip colors for a log file
gsd progress --plain >> build.log

# Pipe structured data to jq
gsd progress --json | jq '.progress.percent'

# Use in a shell script
if [ "$(gsd health --json | jq -r '.status')" = "healthy" ]; then
  echo "Project is healthy"
fi
```

---

## See Also

- [README](../README.md) -- Project overview and `/gsd:*` runtime commands
- [User Guide](USER-GUIDE.md) -- Configuration reference, workflow diagrams, troubleshooting
