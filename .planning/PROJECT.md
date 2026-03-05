# GSD Autopilot

## What This Is

An autonomous orchestrator command (`/gsd:autopilot`) for a fork of the GSD framework that drives milestones from start to completion — or resumes mid-milestone — without human intervention. A bash outer loop reinvokes Claude Code with fresh context per phase, an auto-context agent replaces interactive discuss, verification gates pause for human review, debug-retry handles failures automatically, and a milestone audit loop automatically verifies requirements coverage and closes gaps before completing the milestone. Linear issue integration (`/gsd:linear`) enables issue-driven workflows — fetching issues via MCP, routing to quick or milestone based on complexity scoring, and posting summary comments back. Brainstorming integration (`/gsd:brainstorm`) bridges idea exploration to execution — running collaborative design sessions that produce design docs and auto-route into GSD milestone/project creation.

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
- ✓ Standalone `gsd` CLI binary with command routing — v1.3
- ✓ `gsd progress` — milestone status dashboard (phases, plans, progress bar) — v1.3
- ✓ `gsd todos` — list and display pending todos — v1.3
- ✓ `gsd health` — validate .planning/ directory structure and state consistency — v1.3
- ✓ `gsd settings` — view and update config.json interactively — v1.3
- ✓ `gsd help` — display GSD command reference — v1.3
- ✓ Rich terminal output (ANSI colors, unicode formatting, tables) — v1.3
- ✓ `--json` flag for machine-readable output on all commands — v1.3
- ✓ `init linear` CLI command providing initialization data for Linear workflow — v1.4
- ✓ `/gsd:linear` command spec with Linear MCP tools (get_issue, list_comments, create_comment) — v1.4
- ✓ `linear.md` workflow — parse args, fetch issues via MCP, complexity scoring heuristic, dual-path delegation, comment-back — v1.4
- ✓ STATE.md Linear issue ID column for quick task table — v1.4
- ✓ USER-GUIDE.md and README.md documentation for `/gsd:linear` — v1.4
- ✓ `/gsd:brainstorm` command spec with 10-step workflow — v1.5
- ✓ Brainstorming process (context exploration, clarifying questions, approach proposals, design presentation with per-section approval) — v1.5
- ✓ Design doc output to `.planning/designs/YYYY-MM-DD-<topic>-design.md` with git commit — v1.5
- ✓ Auto-detect routing: PROJECT.md exists → new-milestone, else → new-project — v1.5
- ✓ Design context seeding into milestone/project creation via MILESTONE-CONTEXT.md — v1.5
- ✓ Documentation in help.md, USER-GUIDE.md, README.md — v1.5

### Active

- Acceptance test layer in CONTEXT.md with Given/When/Then/Verify format, human-owned — v1.6
- Unit/regression test layer in PLAN.md with `<tests>` blocks, AI-generated TDD — v1.6
- Hard test gate in execute-plan: full suite must pass after each task commit — v1.6
- Test steward agent for suite health: redundancy detection, budget enforcement, consolidation proposals — v1.6
- Test budget management: per-phase (30) and project (200) limits with configurable thresholds — v1.6
- Workflow integration: discuss-phase, plan-phase, execute-plan, verify-phase, audit-milestone — v1.6
- Configuration schema with progressive opt-in and zero-config degradation — v1.6

### Out of Scope

- Claude Agent SDK harness — native-first approach, SDK is a future option
- Agent Teams integration — phases are sequential, peer-to-peer coordination unnecessary
- Budget/cost caps — progress circuit breaker handles runaway, no token budget enforcement
- Interactive discuss mode — always auto-decide, never prompt during autonomous execution
- Upstream contribution — this is a fork, not a PR to gsd-build/get-shit-done
- CHANGELOG link updates — historical links to upstream tags, leave as-is
- Interactive prompts (inquirer-style) — CLI is read-only for v1.3; interactive editing adds complexity
- Package manager distribution (npm publish) — focus on local install first
- Shell completions (bash/zsh) — nice-to-have, deferred
- Linear issue creation from GSD — read-only integration for v1.4; creating issues adds write-side complexity
- Linear project/cycle mapping — focus on individual issue routing, not project-level sync
- Webhook-driven automation — MCP-based pull model is simpler and sufficient
- Linear issue status updates — comment-back is sufficient; status transitions managed in Linear
- Autopilot-compatible brainstorm mode — auto-approve design sections for fully autonomous brainstorming (future)
- Resume previous brainstorming sessions — design docs are markdown; re-run or edit manually
- Design templates per domain — single design format is sufficient
- Modifying upstream superpowers:brainstorming skill — fork maintains its own commands independently

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
| CLI builds on gsd-tools.cjs parsing layer | Reuses existing state parsing rather than duplicating logic | Good — consistent data, no divergence |
| Inline data gathering over calling existing commands | Avoids output() side-effects from existing functions | Good — clean separation of concerns |
| gatherXData/handleX pattern for all commands | Consistent handler architecture across progress, todos, health, settings, help | Good — predictable, testable |
| Read-only CLI except settings set | Minimizes risk; deterministic reads are the primary use case | Good — simple and safe |
| Single workflow file for both quick and milestone routes | Inline delegation avoids subagent spawning limitations | Good — simpler control flow |
| Additive complexity scoring heuristic | 6 factors (issue count, sub-issues, description length, labels, relations) combined into single score | Good — transparent routing decisions |
| Error on conflicting flags (--quick + --milestone) | Explicit error vs first-wins prevents ambiguous intent | Good — clear UX |
| MCP failures warn-and-continue for comment-back | Primary work already committed; non-critical MCP failures shouldn't fail the workflow | Good — resilient completion |
| No Linear-specific data in init output | MCP tool names and issue ID formats belong in workflow, not init | Good — clean separation of concerns |
| 10-step brainstorm workflow in single file | All brainstorm logic in one workflow file, extended in-place across phases 25-27 | Good — single source of truth, easy to follow |
| AskUserQuestion for all brainstorm interactions | Consistent with GSD interactive patterns (topic prompt, questions, approach selection, section approval) | Good — familiar UX pattern |
| Per-section design approval with unlimited revisions | User controls quality; no artificial limits on revision rounds | Good — flexibility without complexity |
| MILESTONE-CONTEXT.md for design-to-milestone bridge | Maps approved design sections as milestone features, replaces questioning phase | Good — seamless handoff |
| New-project route delegates to user command | Cannot execute new-project inline due to command context requirements | Good — honest about constraints |
| PROJECT.md existence as routing signal | Simple file test determines milestone vs project route | Good — stateless, deterministic |

## Context

Shipped v1.5 with brainstorming command. 6 milestones shipped (v1.0-v1.5) across 29 phases, 38 plans. Starting v1.6 to add dual-layer test architecture based on agentic engineering patterns.

**Architecture:** Core autopilot loop unchanged. `gsd` CLI binary with 5 deterministic commands. `/gsd:linear` for issue-driven workflows. `/gsd:brainstorm` for collaborative design sessions with auto-routing to GSD creation flows.
**Tech stack:** Bash, Node.js (cjs), Claude Code CLI, markdown-based state, Linear MCP
**Codebase:** ~21,058 LOC JavaScript/CJS
**Known tech debt:** 2 pre-existing test failures in unrelated modules (codex-config, config); handler function signature mismatch (mode param silently discarded — cosmetic); `run_gap_closure_loop` return value unchecked (safe due to exit semantics); brainstorm step 10 inline reference to new-milestone steps could become stale

---
*Last updated: 2026-03-05 after v1.6 milestone start*
