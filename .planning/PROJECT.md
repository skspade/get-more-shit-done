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

- ✓ Remove git tag creation from complete-milestone workflow — v1.1
- ✓ Remove git tag push from complete-milestone workflow — v1.1
- ✓ Update all documentation references to git tagging — v1.1

### Active

(None — planning next milestone)

### Out of Scope

- Claude Agent SDK harness — native-first approach, SDK is a future option
- Agent Teams integration — phases are sequential, peer-to-peer coordination unnecessary
- Budget/cost caps — progress circuit breaker handles runaway, no token budget enforcement
- Interactive discuss mode — always auto-decide, never prompt during autonomous execution
- Upstream contribution — this is a fork, not a PR to gsd-build/get-shit-done
- CHANGELOG link updates — historical links to upstream tags, leave as-is

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
| Remove git tagging entirely over making it optional | Fork doesn't need release tags; simpler to remove than add config toggles | Good — clean removal, no dead code |
| Preserve README Bash(git tag:*) permissions example | Generic Claude Code permissions snippet, not a GSD feature claim | Good — correct scope boundary |

## Context

Shipped v1.1 with git tagging fully removed from the complete-milestone workflow and all documentation. ~19,626 LOC unchanged (v1.1 was a removal milestone — net deletion).

**Architecture:** Unchanged from v1.0.
**Tech stack:** Bash, Node.js (cjs), Claude Code CLI, markdown-based state
**Known tech debt:** 7 cosmetic items from v1.0 audit + 1 from v1.1 audit (`audit-milestone.md` line 197 "archive and tag" stale wording)

---
*Last updated: 2026-03-03 after v1.1 milestone*
