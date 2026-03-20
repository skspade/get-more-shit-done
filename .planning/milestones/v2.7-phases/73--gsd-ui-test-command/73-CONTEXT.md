# Phase 73: /gsd:ui-test Command - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can invoke `/gsd:ui-test` with a phase number to generate and run Playwright tests against their application. This phase delivers a single new command file (`commands/gsd/ui-test.md`) that parses arguments and flags, displays a GSD banner, spawns the Phase 72 `gsd-playwright` agent via `Task()`, and presents structured results. No workflow file needed — this is a direct agent spawn following the `audit-tests.md` pattern.

</domain>

<decisions>
## Implementation Decisions

### Command File and Structure (CMD-01, CMD-05)

- New command file at `commands/gsd/ui-test.md` with YAML frontmatter (name, description, argument-hint, allowed-tools) followed by `<objective>`, `<execution_context>`, `<context>`, `<process>` XML sections (from ARCHITECTURE.md command pattern)
- `argument-hint: "[phase] [url] [--scaffold] [--run-only] [--headed]"` (from REQUIREMENTS.md CMD-01)
- `allowed-tools: [Read, Glob, Grep, Bash, Task]` — no Write or Edit needed since the command only reads context and spawns the agent (Claude's Decision: command is read-only orchestrator; all file modifications happen in the agent)
- Command is self-contained with no separate workflow file — direct agent spawn following `audit-tests.md` pattern (from ARCHITECTURE.md "The command is a thin wrapper. All logic lives in the agent")
- `<execution_context>` is "No workflow file needed -- this is a direct agent spawn." (from ARCHITECTURE.md anti-pattern analysis)

### Argument Parsing (CMD-01)

- Parse `$ARGUMENTS` for: phase number (first numeric token) as `$PHASE_ARG`, URL (token matching `http://` or `https://`) as `$BASE_URL`, and flag tokens (from REQUIREMENTS.md CMD-01)
- Phase number is optional — when omitted, command operates without phase context and free-text instructions guide generation (from REQUIREMENTS.md CMD-01 "phase number, URL, free-text instructions")
- URL defaults to `http://localhost:3000` when not provided (from ARCHITECTURE.md input spec)
- Free-text tokens (not phase, URL, or flags) collected as `$INSTRUCTIONS` and passed to agent (from REQUIREMENTS.md CMD-01)

### Flag Parsing (CMD-02, CMD-03, CMD-04)

- `--scaffold` flag sets `$FORCE_SCAFFOLD` (true/false) — forces Playwright scaffolding even when already detected (from REQUIREMENTS.md CMD-02)
- `--run-only` flag sets `$RUN_ONLY` (true/false) — skips test generation and runs existing tests only (from REQUIREMENTS.md CMD-03)
- `--headed` flag sets `$HEADED_MODE` (true/false) — opens a visible browser during test execution (from REQUIREMENTS.md CMD-04)
- `--scaffold` and `--run-only` are mutually exclusive — error if both present (Claude's Decision: scaffolding without running contradicts run-only semantics; matches pr-review's --quick/--milestone mutual exclusion pattern)

### Phase Resolution

- When `$PHASE_ARG` is provided, call `gsd-tools.cjs init phase-op ${PHASE_ARG}` to resolve phase directory and metadata (from ARCHITECTURE.md step 2)
- When `$PHASE_ARG` is omitted, skip init and pass `phase_dir: null` to the agent (Claude's Decision: allows running against existing e2e tests without phase context)

### Playwright Detection

- Call `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" playwright-detect --raw` to get detection status before spawning agent (from ARCHITECTURE.md step 3)
- Detection result displayed in banner context line (Claude's Decision: user sees Playwright state before agent runs, matching audit-tests pattern of showing pre-flight info)

### Banner Display (CMD-05)

- GSD banner format with phase context when available (from REQUIREMENTS.md CMD-05, ui-brand.md stage banner pattern):
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► UI TEST — Phase {N}: {name}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ```
- When no phase is specified, banner omits phase info: `GSD ► UI TEST` (Claude's Decision: clean fallback when running without phase context)
- Completion banner: `GSD ► UI TEST COMPLETE ✓` or `GSD ► UI TEST FAILED ✗` based on agent result status (Claude's Decision: matches audit-tests completion banner pattern)

### Agent Spawning (CMD-05)

- Spawn `gsd-playwright` agent via `Task()` with `<playwright_input>` block containing mode, phase_dir, base_url, and flags (from ARCHITECTURE.md step 5)
- Mode determined by flags: `--scaffold` alone sends `mode=scaffold`; `--run-only` sends `mode=ui-test` with run-only flag; default sends `mode=ui-test` (from ARCHITECTURE.md mode handling)
- Agent model resolved via `gsd-tools.cjs resolve-model gsd-playwright --raw` (Claude's Decision: follows audit-tests pattern of per-agent model resolution)
- Task prompt includes `First, read agents/gsd-playwright.md for your role and instructions.` preamble (from audit-tests.md Task() pattern)

### Results Presentation (CMD-05)

- Parse the agent's `## PLAYWRIGHT COMPLETE` structured return block for status (GREEN/RED/BLOCKED) and test counts
- Display results summary between completion banners with pass/fail/skipped counts
- On RED status, display failure details table from agent output
- On BLOCKED status, display blocker reason from agent output

### Claude's Discretion
- Exact wording of status-line items between banner and agent spawn
- Whether to display Playwright detection status as a bullet point or inline text
- Formatting of the results summary (table vs bullet list)
- Exact error message wording for missing phase or mutual exclusion violations

</decisions>

<specifics>
## Specific Ideas

- The `commands/gsd/audit-tests.md` file is the structural template — it is also a direct agent spawn with no workflow file, uses `gsd-tools.cjs` for pre-flight data, displays a GSD banner, spawns an agent via `Task()`, and presents results
- The `commands/gsd/pr-review.md` YAML frontmatter with `argument-hint` is the pattern for commands that accept flags
- The `agents/gsd-playwright.md` `<input>` section documents the exact `<playwright_input>` block format the command must produce
- The `gsd-tools.cjs init phase-op` call resolves `phase_dir`, `phase_number`, `phase_name` — standard GSD phase resolution used by all phase-scoped commands
- Playwright detection via `gsd-tools.cjs playwright-detect --raw` returns JSON with `{ status, config_path }` — built in Phase 71
- The ui-brand.md stage banner format uses `━` (U+2501) box-drawing characters at 53-character width

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commands/gsd/audit-tests.md`: direct structural template — command that parses no args, calls gsd-tools for pre-flight, displays banner, spawns agent, presents report
- `commands/gsd/pr-review.md`: YAML frontmatter with `argument-hint` and flag parsing pattern
- `agents/gsd-playwright.md`: the agent this command spawns — defines `<playwright_input>` block format and `## PLAYWRIGHT COMPLETE` return structure
- `get-shit-done/references/ui-brand.md`: GSD banner format specification
- `get-shit-done/references/phase-argument-parsing.md`: standard phase argument parsing reference

### Established Patterns
- Command files use YAML frontmatter (name, description, argument-hint, allowed-tools) followed by `<objective>`, `<execution_context>`, `<context>`, `<process>` XML sections
- Direct agent spawn commands (no workflow) set `<execution_context>` to "No workflow file needed -- this is a direct agent spawn."
- `Task()` calls include `First, read {agent-path} for your role and instructions.` preamble
- Agent model resolution via `gsd-tools.cjs resolve-model {agent-name} --raw`
- GSD banner format: `━━━` lines with `GSD ► {STAGE}` centered

### Integration Points
- `commands/gsd/ui-test.md`: new file — the sole deliverable of this phase
- `agents/gsd-playwright.md`: Phase 72 agent spawned by this command
- `gsd-tools.cjs playwright-detect`: Phase 71 dispatch command for detection pre-flight
- `gsd-tools.cjs init phase-op`: existing phase resolution for phase-scoped commands
- `gsd-tools.cjs resolve-model`: existing model resolution for agent spawning
- `get-shit-done/workflows/help.md`: needs `/gsd:ui-test` entry added for discoverability

</code_context>

<deferred>
## Deferred Ideas

- `add-tests.md` workflow E2E path enhancement with Playwright detection and gsd-playwright spawning — deferred to Phase 74
- Help documentation updates in `help.md`, `USER-GUIDE.md`, `README.md` — part of Phase 74 or milestone audit
- `--reporter` flag for choosing Playwright reporter format — not in current requirements
- `--project` flag for specifying browser project (firefox, webkit) — deferred per REQUIREMENTS.md (MBROW-01)
- `--config` flag for pointing to custom playwright.config path — not in current requirements
- Pipeline integration (wiring `/gsd:ui-test` into the autonomous execution pipeline) — explicitly out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 73--gsd-ui-test-command*
*Context gathered: 2026-03-20 via auto-context*
