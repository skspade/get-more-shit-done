# GSD Autopilot

## What This Is

An autonomous orchestrator command (`/gsd:autopilot`) for a fork of the GSD framework that drives milestones from start to completion — or resumes mid-milestone — without human intervention. A bash outer loop reinvokes Claude Code with fresh context per phase, an auto-context agent replaces interactive discuss, verification gates pause for human review, debug-retry handles failures automatically, and a milestone audit loop automatically verifies requirements coverage and closes gaps before completing the milestone.

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
- ✓ Automatic milestone audit after all phases complete with three-way routing — v1.2
- ✓ Audit-fix-reaudit loop with configurable max iterations and escalation — v1.2
- ✓ Automatic gap planning and fix phase execution — v1.2
- ✓ Autonomous milestone completion (archival, PROJECT.md evolution, commit) on audit pass — v1.2
- ✓ Configurable tech debt handling and max audit-fix iterations — v1.2

### Active

- [ ] Standalone `gsd` CLI binary with command routing
- [ ] `gsd progress` — milestone status dashboard (phases, plans, progress bar)
- [ ] `gsd todos` — list and display pending todos
- [ ] `gsd health` — validate .planning/ directory structure and state consistency
- [ ] `gsd settings` — view and update config.json interactively
- [ ] `gsd help` — display GSD command reference
- [ ] Rich terminal output (ANSI colors, unicode formatting, tables)
- [ ] `--json` flag for machine-readable output on all commands

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
| Exit code 10 for gaps_found | Avoid conflict with existing codes 0/1/2/130 | Good — clean routing signal |
| DRY milestone completion function | Single function called from all 4 audit-passed paths | Good — eliminates duplication |
| Gap closure reuses existing phase lifecycle | Fix phases use identical discuss/plan/execute/verify cycle as normal phases | Good — no special-case code |
| Version extracted from STATE.md frontmatter | Single source of truth for milestone version | Good — consistent across invocations |

## Current Milestone: v1.3 CLI Utilities

**Goal:** Replace token-expensive LLM-powered status commands with a deterministic CLI that reads .planning/ state and presents it instantly.

**Target features:**
- Standalone `gsd` CLI with rich terminal output and `--json` flag
- `gsd progress` — milestone status dashboard
- `gsd todos` — pending todo list
- `gsd health` — planning directory validation
- `gsd settings` — config management
- `gsd help` — command reference

## Context

Shipped v1.2 with full milestone audit loop — autopilot now detects completion, audits requirements, closes gaps iteratively, and completes the milestone autonomously. 3 milestones shipped (v1.0, v1.1, v1.2) across 13 phases.

**Architecture:** Unchanged from v1.0. Three new functions in `autopilot.sh`: `run_milestone_audit`, `run_gap_closure_loop`, `run_milestone_completion`.
**Tech stack:** Bash, Node.js (cjs), Claude Code CLI, markdown-based state
**Existing CLI infrastructure:** `gsd-tools.cjs` already handles state parsing (`state-snapshot`, `roadmap analyze`, `progress bar`, `validate health`). The new `gsd` CLI builds on this parsing layer.
**Known tech debt:** `run_gap_closure_loop` return value unchecked at call sites (safe due to exit semantics), `print_escalation_report` message slightly misleading on mid-iteration vs exhaustion (cosmetic)

---
*Last updated: 2026-03-03 after v1.3 milestone start*
