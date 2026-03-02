# GSD Autopilot

## What This Is

An autonomous orchestrator command (`/gsd:autopilot`) for a fork of the GSD framework that drives milestones from start to completion — or resumes mid-milestone — without human intervention. A bash outer loop reinvokes Claude Code with fresh context per phase, an auto-context agent replaces interactive discuss, verification gates pause for human review, and debug-retry handles failures automatically.

## Core Value

A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## Requirements

### Validated

- Autonomous phase loop that reads STATE.md and drives the next phase forward — v1.0
- Auto-context generation replacing interactive discuss (layered decision sourcing with documented reasoning) — v1.0
- Auto-approval of planning and execution phases (no human gates) — v1.0
- Human checkpoint at verification — pause for review of what was built — v1.0
- Cold-start capability: invoke on a new milestone and run from initialization through completion — v1.0
- Resume capability: invoke mid-milestone and pick up from current STATE.md position — v1.0
- Debug-first failure handling: spawn gsd-debugger on failures, attempt fixes, retry — v1.0
- Human escalation after debug retries exhausted (configurable, default 3 attempts) — v1.0
- Progress circuit breaker: pause after N consecutive iterations with no state change (configurable, default 3) — v1.0
- Native GSD implementation using workflows, agents, and commands — not an external wrapper — v1.0
- Bash helpers where native GSD patterns are insufficient (outer loop, state polling) — v1.0

### Active

- [ ] Remove git tag creation from complete-milestone workflow
- [ ] Remove git tag push from complete-milestone workflow
- [ ] Update documentation references to git tagging

### Out of Scope

- Claude Agent SDK harness — native-first approach, SDK is a future option
- Agent Teams integration — phases are sequential, peer-to-peer coordination unnecessary
- Budget/cost caps — progress circuit breaker handles runaway, no token budget enforcement
- Interactive discuss mode — always auto-decide, never prompt during autonomous execution
- Upstream contribution — this is a fork, not a PR to gsd-build/get-shit-done

## Context

Shipped v1.0 with ~19,626 LOC across shell scripts (autopilot.sh), Node.js tooling (gsd-tools.cjs, phase.cjs, config.cjs), and markdown workflows/agents.

**Architecture:**
- `autopilot.sh` — bash outer loop, ~900 lines, reinvokes `claude -p` per phase step
- `gsd-auto-context` agent — autonomous CONTEXT.md generation with layered decision sourcing
- `autopilot.md` workflow — entry point that launches autopilot.sh
- Verification gate — blocks for human approve/fix/abort at each phase
- Debug-retry — spawns gsd-debugger on failures, retries up to N times

**Tech stack:** Bash, Node.js (cjs), Claude Code CLI, markdown-based state
**Known tech debt:** 7 cosmetic items (dead import, missing config scaffold key, Phase 6 ROADMAP status — see v1.0 audit)

## Constraints

- **Architecture**: Must use GSD's native command/workflow/agent pattern — not an external orchestration layer
- **Subagent limitation**: Subagents cannot spawn subagents — the orchestrator must be the top-level spawner
- **Context windows**: Each phase execution needs a fresh context window to prevent context rot
- **State continuity**: All cross-session state must live in `.planning/` markdown files — no in-memory state
- **GSD compatibility**: Must work with existing GSD project structures (`.planning/` layout, STATE.md format, ROADMAP.md format)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Native GSD extension over external wrapper | Leverages existing agent/workflow patterns, avoids maintaining separate orchestration layer | Good — seamless integration with existing commands |
| Fork over upstream contribution | Need freedom to modify core workflows without PR review cycles | Good — enabled rapid iteration on autopilot.sh |
| Always auto-decide discuss phase | The whole point is autonomous execution; human input at discuss defeats the purpose | Good — auto-context produces usable CONTEXT.md |
| Human checkpoint at verification only | Verification is where you see what was actually built — the one place human judgment adds the most value | Good — right balance of autonomy and oversight |
| Debug-first failure handling | gsd-debugger already exists and is purpose-built for diagnosing execution failures | Good — reuses existing infrastructure |
| Progress circuit breaker over budget cap | Stuck detection is more meaningful than token counting for preventing runaway | Good — catches semantic stalls, not arbitrary limits |
| Layered decision approach for context generation | Front-loading from PROJECT.md eliminates obvious ambiguities; Claude handles the rest with documented reasoning | Good — domain adaptation works across phase types |
| Artifact-based state inference | Phase lifecycle step determined by file presence (CONTEXT, PLAN, SUMMARY, VERIFICATION) | Good — stateless, survives context resets |
| ROADMAP checkbox completion detection | Use ROADMAP checkbox line for completion status instead of section parsing | Good — simpler and more reliable |

## Current Milestone: v1.1 Remove Git Tagging

**Goal:** Strip the automated git tag mechanism from this fork — tags should not be created or pushed during milestone completion.

**Target features:**
- Remove git tag creation step from complete-milestone workflow
- Remove git tag push logic
- Update all documentation referencing automated tagging

---
*Last updated: 2026-03-02 after v1.1 milestone started*
