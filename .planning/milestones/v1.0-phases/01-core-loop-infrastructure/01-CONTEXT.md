# Phase 1: Core Loop Infrastructure - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Bash outer loop that reads state, drives phases through the GSD lifecycle (discuss → plan → execute → verify) autonomously with fresh context windows per step, and stops safely when stuck. This is the orchestration engine — auto-context generation (Phase 2), human verification gates (Phase 3), and debug-retry (Phase 4) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Invocation & CLI Design
- Dual entry points: `/gsd:autopilot` command (friendly start) + standalone bash script (engine, also usable directly for CI/automation)
- Minimal arguments: reads current milestone from STATE.md, optional `--from-phase N` to start/resume from a specific phase
- Status banner on launch showing milestone name, phase range, and starting point
- One Claude Code invocation per step — bash script calls Claude Code separately for discuss, plan, execute, verify (4 invocations per phase, maximum context freshness)

### State Machine Transitions
- No new state fields — script infers state from existing artifacts on disk (CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md presence)
- New `phase-status` command in gsd-tools.cjs that returns structured JSON for the bash script to consume (step, plans_complete, plans_total, etc.)
- On step failure (non-zero exit): halt autopilot, print which step failed and exit code. Keep simple for Phase 1 — Phase 4 adds debug-retry
- Verify step runs gsd-verifier agent (automated, non-interactive). No human gate — that's Phase 3

### Progress & Output
- Full Claude Code stdout/stderr piped through to user — transparent, useful for debugging autopilot itself
- Clear separator banners printed between each Claude Code invocation (e.g., `━━━ AUTOPILOT: Phase 1 > plan-phase ━━━`)

### Circuit Breaker
- Meaningful progress defined as: new git commits, phase advancement, or plan completion (per SAFE-02)
- One iteration = one Claude Code invocation
- 3 consecutive invocations with no progress triggers halt (default, configurable)
- Structured halt report: which phase/step, what was attempted in last 3 iterations, which progress signals were checked
- Threshold configurable via `autopilot.circuit_breaker_threshold` in .planning/config.json

### Claude's Discretion
- Whether to log output to file in addition to console
- End-of-run report format (summary table vs narrative)
- Exact banner/separator visual styling
- Bash script structure and error handling patterns

</decisions>

<specifics>
## Specific Ideas

- The bash script is the engine that the command launches — user can also invoke the script directly for automation/CI
- Each step gets its own fresh 200k-token context window — this is the key architectural property that prevents context rot across phases
- The `phase-status` gsd-tools command should return enough information for the bash script to make all routing decisions without parsing markdown

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-tools.cjs`: Comprehensive CLI utility with state management, phase operations, roadmap parsing — new `phase-status` command extends this
- `auto_advance` config: Already chains phases within a session — autopilot replaces this with cross-session orchestration
- `mode: "yolo"` config: Already auto-approves changes — autopilot uses this
- `gsd-verifier` agent: Existing automated verifier that checks success criteria from ROADMAP.md
- `gsd-tools.cjs init phase-op`: Returns phase metadata including has_context, has_plans, has_verification flags

### Established Patterns
- Thin orchestrator + subagent delegation: orchestrators coordinate, agents execute
- File-based state: all cross-session state in `.planning/` markdown files
- Phase lifecycle: discuss → plan → execute → verify → transition
- Commands in `commands/gsd/` (thin entry), workflows in `get-shit-done/workflows/` (full logic), agents in `agents/` (specialized workers)
- Config in `.planning/config.json` with `gsd-tools config-get/config-set`

### Integration Points
- New command: `commands/gsd/autopilot.md`
- New workflow: `get-shit-done/workflows/autopilot.md`
- New bash script: `scripts/autopilot.sh` (or similar location)
- Extended: `gsd-tools.cjs` with `phase-status` command
- Extended: `.planning/config.json` with `autopilot.*` settings
- Reads: STATE.md, ROADMAP.md, phase artifacts (CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-loop-infrastructure*
*Context gathered: 2026-03-01*
