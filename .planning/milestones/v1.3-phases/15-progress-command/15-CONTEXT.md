# Phase 15: Progress Command - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can see the full milestone status at a glance -- name, phases, plan counts, progress bar, and what to do next. This phase replaces the `handleProgress` stub in `cli.cjs` with a real implementation that reads `.planning/` state and renders a rich dashboard. It does NOT touch other commands (todos, health, settings, help) -- those remain stubs for Phases 16-18.

</domain>

<decisions>
## Implementation Decisions

### Data Access
- Reuse `cmdProgressRender()` from `commands.cjs` for phase/plan counting and progress percentage -- it already reads `.planning/phases/`, counts PLANs vs SUMMARYs, and computes percent (from PROJECT.md: "gsd-tools.cjs already handles state parsing")
- Reuse `getMilestoneInfo()` from `core.cjs` for milestone name and version
- Reuse `cmdRoadmapAnalyze()` from `roadmap.cjs` for ROADMAP checkbox completion status and current/next phase detection (Claude's Decision: roadmapAnalyze already computes disk_status, roadmap_complete, current_phase, next_phase -- avoids duplicating this logic)
- Read `.planning/STATE.md` frontmatter for milestone active/complete status via `extractFrontmatter()` (Claude's Decision: STATE.md frontmatter already contains normalized status field, simpler than re-parsing markdown body)

### Output Structure
- `handleProgress(projectRoot, args, mode)` returns a structured data object with fields: `milestone`, `phases`, `progress`, `current_position`, `next_action`
- The `milestone` field includes `name`, `version`, and `status` (active or complete) (from PROG-01)
- The `phases` array includes each phase with `number`, `name`, `status_indicator` (complete/in_progress/not_started), and `plan_counts` string like "2/3 plans" (from PROG-02, PROG-03)
- The `progress` field includes `percent`, `completed_plans`, `total_plans`, and `bar` string (from PROG-04)
- The `current_position` field includes `phase` and `plan` identifying where execution currently is (from PROG-05)
- The `next_action` field is a human-readable string suggesting what to do next (from PROG-05)

### Rich Terminal Rendering
- Rich mode renders a multi-line dashboard with ANSI colors and unicode symbols
- Milestone header line: bold milestone name and version, with status indicator (Claude's Decision: header-first layout matches standard CLI dashboard conventions)
- Phase list: each phase on its own line with a status icon prefix -- checkmark for complete, arrow for in-progress, dash for not started (Claude's Decision: simple icon set is universally readable in any terminal font)
- Plan counts shown inline with each phase: e.g., "2/3 plans" (from PROG-03)
- Progress bar: filled/empty block characters matching the existing `cmdProgressRender` bar style (from existing codebase pattern)
- Current position and next action displayed below the progress bar (from PROG-05)
- Color scheme: green for complete, yellow for in-progress, dim/gray for not started (Claude's Decision: standard traffic-light convention, accessible and intuitive)

### Status Detection Logic
- Phase status derived from disk: complete when summaries >= plans and plans > 0, in-progress when summaries > 0 but < plans, not started otherwise (from existing `cmdProgressRender` pattern)
- Milestone status: "active" when any phase is incomplete, "complete" when all phases have summaries >= plans (Claude's Decision: derived from disk state for deterministic output, consistent with existing progress logic)
- Current position: first phase with in-progress status, or first not-started phase if none in progress (from existing `cmdRoadmapAnalyze` current_phase logic)
- Next action suggestions: "Run discuss-phase {N}" if current phase has no context, "Run plan {N}" if context exists but no plans, "Execute plan {N}-{P}" if plans exist but incomplete, "Run verify {N}" if all plans complete but no verification, "All phases complete" if milestone done (Claude's Decision: maps lifecycle steps to actionable suggestions, mirrors autopilot's own state detection)

### JSON Output Mode
- `--json` flag returns the structured data object directly via `formatOutput()` -- no rendering needed (from CLI-04, already wired in Phase 14)
- JSON structure mirrors the rich output sections: milestone info, phases array, progress stats, current position, next action

### Plain Output Mode
- `--plain` flag strips ANSI codes from rich output via existing `formatOutput()` (from CLI-05, already wired in Phase 14)

### Integration with CLI Framework
- Replace `handleProgress` stub in `cli.cjs` with the real implementation
- Handler receives `(projectRoot, args, mode)` from the existing router -- same signature as the stub (from Phase 14 architecture)
- Implementation lives inside `cli.cjs` alongside the other handlers (Claude's Decision: keeps all CLI handler code in one module, consistent with Phase 14 stub pattern; separate module not warranted until handlers grow complex)

### Claude's Discretion
- Exact ANSI escape code sequences used for colors
- Exact unicode characters chosen for status icons (any recognizable checkmark/arrow/dash)
- Spacing and alignment within the dashboard layout
- Exact wording of next-action suggestion strings
- Whether progress bar width is 20 or 30 characters
- Internal helper function decomposition within the handler

</decisions>

<specifics>
## Specific Ideas

- PROJECT.md states: "Existing CLI infrastructure: `gsd-tools.cjs` already handles state parsing (`state-snapshot`, `roadmap analyze`, `progress bar`, `validate health`). The new `gsd` CLI builds on this parsing layer."
- REQUIREMENTS.md explicitly scopes PROG-01 through PROG-05 to this phase
- ROADMAP success criteria explicitly require: milestone name/version/status, phase list with visual indicators, plan completion counts, progress bar, current position and suggested next action
- The existing `cmdProgressRender()` in `commands.cjs` already computes all the raw data (phases array, plan/summary counts, percent, progress bar) -- the progress handler needs to reshape this data and add status detection + next-action logic
- `cmdRoadmapAnalyze()` provides `disk_status` per phase and `current_phase`/`next_phase` -- richer than `cmdProgressRender` for determining lifecycle position
- STATE.md frontmatter contains `milestone`, `milestone_name`, `status` fields

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/commands.cjs` > `cmdProgressRender()`: Reads `.planning/phases/`, builds phases array with plan/summary counts, computes percent, renders progress bar. Can be called internally or its logic extracted.
- `get-shit-done/bin/lib/core.cjs` > `getMilestoneInfo()`: Returns `{ version, name }` from ROADMAP.md. Used for milestone header.
- `get-shit-done/bin/lib/core.cjs` > `comparePhaseNum()`: Phase number sorting. Already used by `cmdProgressRender`.
- `get-shit-done/bin/lib/roadmap.cjs` > `cmdRoadmapAnalyze()`: Returns phases with `disk_status`, `roadmap_complete`, `plan_count`, `summary_count`, `has_context`, `has_research`, `current_phase`, `next_phase`. Richest data source for the progress dashboard.
- `get-shit-done/bin/lib/frontmatter.cjs` > `extractFrontmatter()`: Parses YAML frontmatter from STATE.md for milestone status.
- `get-shit-done/bin/lib/cli.cjs` > `handleProgress()`: Current stub that returns `{ command: 'progress', message: '...' }`. Will be replaced with real implementation.
- `get-shit-done/bin/lib/cli.cjs` > `formatOutput()`: Handles JSON/plain/rich mode formatting. Already wired into the router.

### Established Patterns
- CJS module pattern: `require()` / `module.exports`, no ESM
- Handler signature: `function handleX(projectRoot, args, mode)` returning a data object
- `formatOutput(data, mode)` in the CLI entry point handles rendering: JSON mode stringifies, plain mode strips ANSI, rich mode passes through
- For rich mode, handlers return an object with a `message` string property containing the formatted output (see `handleHelp` pattern)
- Progress bar rendering: `'\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled)` pattern established in `cmdProgressRender` and `cmdStateUpdateProgress`
- `output(result, raw, rawValue)` pattern in gsd-tools commands -- but CLI handlers use `formatOutput` instead, so the handler returns data rather than calling `output()` directly
- Tests in `tests/cli.test.cjs` using `node:test`, `node:assert`, temp directories with `beforeEach`/`afterEach` cleanup

### Integration Points
- `get-shit-done/bin/lib/cli.cjs`: Replace `handleProgress` stub with real implementation
- `get-shit-done/bin/gsd-cli.cjs`: No changes needed -- already routes `progress` to handler
- `tests/cli.test.cjs`: Existing integration tests assert `progress --json` returns valid JSON and `progress --plain` has no ANSI -- these tests will need updating to verify real data instead of stub response
- The handler imports from `./lib/core.cjs`, `./lib/commands.cjs`, `./lib/roadmap.cjs` for data access -- same modules `gsd-tools.cjs` already uses

</code_context>

<deferred>
## Deferred Ideas

- Todos command implementation -- Phase 16
- Health command implementation -- Phase 17
- Settings and help command enhancements -- Phase 18
- Historical milestone progress (showing archived milestone stats) -- not in requirements
- Phase timing/velocity metrics in dashboard -- not in requirements, tracked in STATE.md separately
- Shell completions -- explicitly out of scope for v1.3

</deferred>

---

*Phase: 15-progress-command*
*Context gathered: 2026-03-03 via auto-context*
