# Phase 73: /gsd:ui-test Command - Research

**Researched:** 2026-03-20
**Status:** Complete

## Phase Goal

Users can invoke `/gsd:ui-test` with a phase number to generate and run Playwright tests against their application.

## What Exists

### Structural Template: `commands/gsd/audit-tests.md`

This is the direct pattern to follow. It is a command file that:
- Has YAML frontmatter with `name`, `description`, `argument-hint`, `allowed-tools`
- Uses `<objective>`, `<execution_context>`, `<context>`, `<process>` XML sections
- Sets `<execution_context>` to "No workflow file needed -- this is a direct agent spawn."
- Calls `gsd-tools.cjs` for pre-flight data gathering
- Displays a GSD banner
- Spawns an agent via `Task()` with `First, read {agent-path} for your role and instructions.` preamble
- Presents structured results from agent return

### Agent: `agents/gsd-playwright.md`

The agent this command spawns. Key integration points:
- Expects a `<playwright_input>` block with: `mode`, `phase_dir`, `base_url`, `flags`
- Modes: `ui-test` (full lifecycle), `generate` (skip detect/scaffold), `scaffold` (scaffold only)
- Returns `## PLAYWRIGHT COMPLETE` with structured fields: Status (GREEN/RED/BLOCKED), Mode, Scaffolded, Generated, Results
- Returns `## PLAYWRIGHT BLOCKED` on unrecoverable failure
- Failure details include Error Type (test-level/app-level), Screenshot paths, Trace paths

### Flag Pattern: `commands/gsd/pr-review.md`

Shows YAML frontmatter with `argument-hint: "[--ingest] [--quick|--milestone] [--full] [aspects...]"` pattern for commands accepting flags.

### Available gsd-tools.cjs Commands

- `playwright-detect --raw` — returns JSON `{ status, config_path }` (Phase 71)
- `init phase-op {phase}` — resolves `phase_dir`, `phase_number`, `phase_name`
- `resolve-model {agent-name} --raw` — returns model string for Task() spawning

## Implementation Analysis

### Single Deliverable

This phase creates exactly one file: `commands/gsd/ui-test.md`. No workflow file, no new agents, no tooling changes. The command is a thin orchestrator that:

1. Parses arguments and flags from `$ARGUMENTS`
2. Resolves phase metadata (optional — phase can be omitted)
3. Detects Playwright state via `gsd-tools.cjs playwright-detect`
4. Displays a GSD banner with context
5. Spawns `gsd-playwright` agent via `Task()`
6. Parses the agent's structured return
7. Displays results with completion banner

### Argument Parsing

From `$ARGUMENTS`, extract:
- Phase number: first numeric token (optional)
- URL: token matching `http://` or `https://` (defaults to `http://localhost:3000`)
- `--scaffold`: force scaffolding
- `--run-only`: skip generation, run existing tests
- `--headed`: visible browser mode
- Free-text: remaining tokens become `$INSTRUCTIONS`

Mutual exclusion: `--scaffold` and `--run-only` cannot both be present.

### Mode Mapping

| Flags | Mode sent to agent |
|-------|-------------------|
| (none) | `ui-test` |
| `--scaffold` | `scaffold` |
| `--run-only` | `ui-test` with `--run-only` in flags |
| `--headed` | `ui-test` with `--headed` in flags |

### Results Parsing

Agent returns one of:
- `## PLAYWRIGHT COMPLETE` — parse Status, Results counts, Failure Details table
- `## PLAYWRIGHT BLOCKED` — parse Reason field

Display mapping:
- GREEN: `GSD > UI TEST COMPLETE` with pass/fail/skipped counts
- RED: `GSD > UI TEST COMPLETE` with failure details table
- BLOCKED: `GSD > UI TEST BLOCKED` with reason

## Risk Assessment

**Low complexity.** This is a single command file following an established pattern (audit-tests.md). The gsd-playwright agent (Phase 72) handles all logic. The command is purely orchestration — parse args, display banner, spawn agent, display results.

**No test budget impact.** This phase creates a command spec file, not test files. Project test count (807) is not affected.

## RESEARCH COMPLETE

---

*Phase: 73--gsd-ui-test-command*
*Researched: 2026-03-20*
