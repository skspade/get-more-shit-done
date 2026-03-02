# GSD Autopilot

## What This Is

An autonomous orchestrator command (`/gsd:autopilot`) for a fork of the GSD framework that drives milestones from start to completion — or resumes mid-milestone — without human intervention. It replaces interactive discussion with AI-generated decisions, auto-approves planning and execution, and only pauses for human review at verification checkpoints.

## Core Value

A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Autonomous phase loop that reads STATE.md and drives the next phase forward
- [ ] Auto-context generation replacing interactive discuss (layered: front-load from PROJECT.md, Claude decides remaining ambiguities with documented reasoning)
- [ ] Auto-approval of planning and execution phases (no human gates)
- [ ] Human checkpoint at verification — pause for review of what was built
- [ ] Cold-start capability: invoke on a new milestone and run from initialization through completion
- [ ] Resume capability: invoke mid-milestone and pick up from current STATE.md position
- [ ] Debug-first failure handling: spawn gsd-debugger on failures, attempt fixes, retry
- [ ] Human escalation after debug retries exhausted (configurable, default 3 attempts)
- [ ] Progress circuit breaker: pause after N consecutive iterations with no state change (configurable, default 3)
- [ ] Native GSD implementation using workflows, agents, and commands — not an external wrapper
- [ ] Bash helpers where native GSD patterns are insufficient (outer loop, state polling)

### Out of Scope

- Claude Agent SDK harness — native-first approach, SDK is a future option
- Agent Teams integration — phases are sequential, peer-to-peer coordination unnecessary
- Budget/cost caps — progress circuit breaker handles runaway, no token budget enforcement
- Interactive discuss mode — always auto-decide, never prompt during autonomous execution
- Upstream contribution — this is a fork, not a PR to gsd-build/get-shit-done

## Context

GSD v1.22.0 already provides most of the building blocks:
- `auto_advance` config chains phases within a session
- `mode: "yolo"` auto-approves changes
- 9 specialized agents handle all substantive work in fresh 200k-token context windows
- File-based state (`.planning/STATE.md`, plans, summaries) survives context resets
- The thin orchestrator pattern keeps main context at ~10-15% usage

The gap is: no single command loops through the full milestone lifecycle. `auto_advance` chains within a session but doesn't survive context window exhaustion. The discuss phase requires human input. There's no debug-retry loop on verification failure.

The implementation extends GSD's existing patterns:
- New command file (`commands/gsd/autopilot.md`) — thin orchestrator, ~100-200 lines
- New workflow file (`workflows/autopilot.md`) — phase loop logic, ~300-500 lines
- New agent (`agents/gsd-auto-context.md`) — generates CONTEXT.md from milestone spec
- Modified verify workflow — adds pause-for-human gate in autopilot mode
- Bash helper script — outer loop that reinvokes Claude Code with fresh context per phase

## Constraints

- **Architecture**: Must use GSD's native command/workflow/agent pattern — not an external orchestration layer
- **Subagent limitation**: Subagents cannot spawn subagents — the orchestrator must be the top-level spawner
- **Context windows**: Each phase execution needs a fresh context window to prevent context rot
- **State continuity**: All cross-session state must live in `.planning/` markdown files — no in-memory state
- **GSD compatibility**: Must work with existing GSD project structures (`.planning/` layout, STATE.md format, ROADMAP.md format)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Native GSD extension over external wrapper | Leverages existing agent/workflow patterns, avoids maintaining separate orchestration layer | — Pending |
| Fork over upstream contribution | Need freedom to modify core workflows without PR review cycles | — Pending |
| Always auto-decide discuss phase | The whole point is autonomous execution; human input at discuss defeats the purpose | — Pending |
| Human checkpoint at verification only | Verification is where you see what was actually built — the one place human judgment adds the most value | — Pending |
| Debug-first failure handling | gsd-debugger already exists and is purpose-built for diagnosing execution failures | — Pending |
| Progress circuit breaker over budget cap | Stuck detection is more meaningful than token counting for preventing runaway | — Pending |
| Layered decision approach for context generation | Front-loading from PROJECT.md eliminates obvious ambiguities; Claude handles the rest with documented reasoning | — Pending |

---
*Last updated: 2026-03-01 after initialization*
