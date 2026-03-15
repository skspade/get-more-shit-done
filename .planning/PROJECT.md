# GSD Autopilot

## What This Is

An autonomous orchestrator command (`/gsd:autopilot`) for a fork of the GSD framework that drives milestones from start to completion — or resumes mid-milestone — without human intervention. A zx-based Node.js script (`autopilot.mjs`) reinvokes Claude Code with fresh context per phase, importing CJS modules directly for phase navigation, verification status, and config defaults — eliminating the JSON serialization boundary of the original bash implementation. Real-time streaming output via `--output-format stream-json` replaces buffered JSON — `runClaudeStreaming()` consolidates all Claude CLI invocations with NDJSON parsing, live assistant text to stdout, tool call indicators to stderr, configurable stall detection (default 5 min with repeating warnings), and `--quiet` fallback for CI/scripted use. An auto-context agent replaces interactive discuss, verification gates pause for human review via TTY, debug-retry handles failures automatically, and a milestone audit loop automatically verifies requirements coverage and closes gaps before completing the milestone. Linear issue integration (`/gsd:linear`) enables issue-driven workflows — fetching issues via MCP, routing to quick or milestone based on complexity scoring, and posting summary comments back. Brainstorming integration (`/gsd:brainstorm`) bridges idea exploration to execution — running collaborative design sessions that produce design docs and auto-route into GSD milestone/project creation. PR review integration (`/gsd:pr-review`) captures PR review toolkit findings, deduplicates via file-region grouping, scores complexity, and routes to quick task or milestone for stateful resolution. Dual-layer test architecture provides a hard test gate during execution (baseline comparison, TDD awareness, output summarization), human-owned acceptance tests in Given/When/Then/Verify format, and a test steward agent for suite health (redundancy detection, budget enforcement, consolidation proposals). README rewritten as a minimal 97-line quick start guide with fork branding, core workflow, and command reference. Legacy bash autopilot preserved as `autopilot-legacy.sh` with `--legacy` flag fallback.

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
- ✓ Acceptance test layer in CONTEXT.md with Given/When/Then/Verify format, human-owned — v1.6
- ✓ Hard test gate in execute-plan: full suite must pass after each task commit — v1.6
- ✓ Test steward agent for suite health: redundancy detection, budget enforcement, consolidation proposals — v1.6
- ✓ Test budget management: per-phase (50) and project (800) limits with configurable thresholds — v1.6
- ✓ Workflow integration: discuss-phase, plan-phase, execute-plan, verify-phase, audit-milestone — v1.6
- ✓ Configuration schema with progressive opt-in and zero-config degradation — v1.6
- ✓ Documentation in help.md, USER-GUIDE.md, README.md, CLI.md for test architecture — v1.6
- ✓ Replace upstream README with minimal quick start guide reflecting fork identity — v2.0
- ✓ Strip upstream branding (TÂCHES, $GSD token, star history, Discord) — v2.0
- ✓ Present core workflow (discuss → plan → execute → verify) as quick start — v2.0
- ✓ Include minimal command table (10 core commands) with links to User Guide and CLI Reference — v2.0
- ✓ Pretty-print JSON output from Claude CLI invocations in autopilot.sh — v2.1
- ✓ Add `format_json_output()` helper function with jq + cat fallback — v2.1
- ✓ Apply formatting to all 5 direct Claude invocation sites — v2.1
- ✓ `/gsd:pr-review` command spec with argument parsing (--ingest, --quick, --milestone, --full, aspect passthrough) — v2.2
- ✓ Run or ingest PR review: execute toolkit fresh or accept pasted review summary — v2.2
- ✓ Parse findings into structured format (severity, agent, description, file, line, fix suggestion) — v2.2
- ✓ File-region deduplication: group findings by file proximity (20-line threshold), merge overlapping groups — v2.2
- ✓ Permanent review report written to `.planning/reviews/YYYY-MM-DD-pr-review.md` — v2.2
- ✓ Hybrid scoring heuristic: +2 critical, +1 important, +1 per 5 files; score >= 5 → milestone — v2.2
- ✓ Quick route: single task with one plan task per file-region group, sequential execution — v2.2
- ✓ Milestone route: MILESTONE-CONTEXT.md from findings, delegate to new-milestone workflow — v2.2
- ✓ Temporary review-context.md for routing state, deleted after completion — v2.2
- ✓ Documentation in help.md, USER-GUIDE.md, README.md — v2.2
- ✓ Rewrite autopilot.sh as zx-based Node.js script (autopilot.mjs) — v2.3
- ✓ Add findFirstIncompletePhase/nextIncompletePhase to phase.cjs — v2.3
- ✓ Add getVerificationStatus/getGapsSummary to verify.cjs — v2.3
- ✓ Add CONFIG_DEFAULTS with fallback to cli.cjs config-get — v2.3
- ✓ Add gsd-tools dispatch entries: phase find-next, verify status, verify gaps — v2.3
- ✓ Rename autopilot.sh to autopilot-legacy.sh with --legacy flag fallback — v2.3
- ✓ Add zx runtime dependency — v2.3
- ✓ Real-time streaming output via `--output-format stream-json` replacing buffered JSON — v2.4
- ✓ Core `runClaudeStreaming()` function consolidating all Claude CLI invocation sites — v2.4
- ✓ Stream event display: assistant text to stdout, tool calls as compact indicators to stderr — v2.4
- ✓ Configurable stall detection timer with repeated warnings when no output received — v2.4
- ✓ `--quiet` CLI flag restoring original JSON behavior for CI/scripted use — v2.4
- ✓ `--auto` flag for `/gsd:new-milestone` — skip all confirmation questions when creating milestones — v2.5
- ✓ Hybrid flag + config pattern (mirrors discuss-phase/plan-phase `--auto` behavior) — v2.5
- ✓ Auto-resolve milestone context from MILESTONE-CONTEXT.md, @file, or inline text — v2.5
- ✓ Auto-accept version, always research, auto-approve requirements and roadmap — v2.5
- ✓ Auto-chain to `/gsd:discuss-phase {N} --auto` after roadmap creation — v2.5
- ✓ Simplify brainstorm.md milestone routing to use `/gsd:new-milestone --auto` — v2.5

### Active

- Unified validation module (`validation.cjs`) with shared checks for health CLI and autopilot — v2.6
- State consistency checks (STATE.md ↔ ROADMAP.md milestone name, phase counts, status) — v2.6
- Phase navigation checks using `phase.cjs` functions (`findFirstIncompletePhase`, `computePhaseStatus`) — v2.6
- Autopilot readiness checks (incomplete phases exist, deterministic step, valid config) — v2.6
- Auto-repair for trivially fixable state drift (stale STATE.md counts, missing phase directories) — v2.6
- `gsd health` refactored to delegate to `validation.cjs`, `--fix` flag for auto-repair — v2.6
- Autopilot pre-flight validation with auto-repair at startup — v2.6
- `gsd-tools.cjs` `validate` dispatch entry for workflow access — v2.6

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
- Auto-consolidation without human approval — steward.auto_consolidate remains false
- Code coverage percentage targets — budget system handles growth; coverage % is a different concern
- Visual test reports (HTML/dashboard) — CLI output is sufficient
- Test mutation analysis (Stryker) — AI-driven redundancy detection is simpler and sufficient
- Flaky test quarantine — retry-before-debug handles transient failures
- Modifying the PR review toolkit itself — this workflow consumes its output, doesn't change it
- Automatic re-review after fixes — user can re-run manually
- PR comment posting (like Linear comment-back) — no GitHub PR integration for v2.2
- Cross-PR review aggregation — each invocation handles one review session
- Token-level streaming UI (spinners, progress bars) — assistant text passthrough is sufficient
- Interactive stream controls (pause/resume) — adds complexity without clear value
- Automatic process kill on stall — warning-only; auto-kill adds risk of killing slow-but-working steps

## Constraints

- **Architecture**: Must use GSD's native command/workflow/agent pattern — not an external orchestration layer
- **Subagent limitation**: Subagents cannot spawn subagents — the orchestrator must be the top-level spawner
- **Context windows**: Each phase execution needs a fresh context window to prevent context rot
- **State continuity**: All cross-session state must live in `.planning/` markdown files — no in-memory state
- **GSD compatibility**: Must work with existing GSD project structures (`.planning/` layout, STATE.md format, ROADMAP.md format)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Native GSD extension over external wrapper | Leverages existing agent/workflow patterns, avoids maintaining separate orchestration layer | ✓ Good |
| Fork over upstream contribution | Need freedom to modify core workflows without PR review cycles | ✓ Good |
| Always auto-decide discuss phase | The whole point is autonomous execution; human input at discuss defeats the purpose | ✓ Good |
| Human checkpoint at verification only | Verification is where you see what was actually built — the one place human judgment adds the most value | ✓ Good |
| Debug-first failure handling | gsd-debugger already exists and is purpose-built for diagnosing execution failures | ✓ Good |
| Progress circuit breaker over budget cap | Stuck detection is more meaningful than token counting for preventing runaway | ✓ Good |
| Layered decision approach for context generation | Front-loading from PROJECT.md eliminates obvious ambiguities; Claude handles the rest with documented reasoning | ✓ Good |
| Artifact-based state inference | Phase lifecycle step determined by file presence (CONTEXT, PLAN, SUMMARY, VERIFICATION) | ✓ Good |
| Remove git tagging entirely over making it optional | Fork doesn't need release tags; simpler to remove than add config toggles | ✓ Good |
| Exit code 10 for gaps_found | Avoid conflict with existing codes 0/1/2/130 | ✓ Good |
| DRY milestone completion function | Single function called from all 4 audit-passed paths | ✓ Good |
| CLI builds on gsd-tools.cjs parsing layer | Reuses existing state parsing rather than duplicating logic | ✓ Good |
| Single workflow file for both quick and milestone routes | Inline delegation avoids subagent spawning limitations | ✓ Good |
| Additive complexity scoring heuristic | 6 factors combined into single score for transparent routing decisions | ✓ Good |
| 10-step brainstorm workflow in single file | All brainstorm logic in one workflow file, extended in-place across phases | ✓ Good |
| MILESTONE-CONTEXT.md for design-to-milestone bridge | Maps approved design sections as milestone features, replaces questioning phase | ✓ Good |
| Framework-specific output parsing with exit-code fallback | Different test runners produce different output formats | ✓ Good |
| Baseline comparison via Set difference on failed test names | Only blocks on NEW failures, not pre-existing | ✓ Good |
| Test steward is read-only | Agent analyzes but never modifies test files | ✓ Good |
| Complete README rewrite over incremental edit | Ensures zero upstream residue | ✓ Good |
| sed extraction for bash function testing | Avoids sourcing entire autopilot.sh; tests function in isolation | ✓ Good |
| File-proximity deduplication with transitive merging | Groups findings within 20 lines, merges overlapping groups — reduces noise in PR review routing | ✓ Good |
| Hybrid scoring for quick vs milestone routing | +2 critical, +1 important, +1 per 5 files — transparent threshold with flag override | ✓ Good |
| STATE.md generic Source column for quick tasks | Accommodates both pr-review and Linear entries in same table | ✓ Good |
| Review findings as XML block for planner context | Mirrors Linear issue context pattern; one group per section gives structured review data | ✓ Good |
| zx over pure Node.js for autopilot rewrite | zx provides `$` template literals for shell commands, built-in argv parsing, and shebang support — simpler than raw child_process | ✓ Good |
| createRequire for CJS imports in ESM | Standard Node.js pattern for importing CJS from ESM; avoids dual-package hazard | ✓ Good |
| npx zx over global zx install | Avoids requiring users to globally install zx; npx resolves from local node_modules | ✓ Good |
| Legacy fallback via --legacy flag | Preserves bash autopilot as escape hatch; zero-risk migration path | ✓ Good |
| NDJSON readline async iteration for streaming | createInterface wrapping proc.stdout gives clean async for-await line parsing | ✓ Good |
| Named function expression for stall timer re-arm | Avoids arguments.callee in strict mode; setTimeout(onStall, interval) pattern | ✓ Good |
| Consolidated runClaudeStreaming() for all invocations | Single function handles streaming, stall detection, quiet mode, stdin redirect — eliminates duplication across 5 call sites | ✓ Good |
| Config registration 3-touch-point pattern | CONFIG_DEFAULTS + KNOWN_SETTINGS_KEYS + validateSetting ensures consistent config behavior | ✓ Good |
| Context resolution priority order | MILESTONE-CONTEXT.md > @file > inline > error — deterministic, no ambiguity | ✓ Good |
| Auto-mode detection: flag + config + persist | Mirrors discuss-phase/plan-phase pattern; consistent UX across all --auto commands | ✓ Good |
| SlashCommand delegation for brainstorm→milestone | Eliminates ~70 lines of inline duplication; single source of truth for milestone creation | ✓ Good |
| Dynamic first phase via phase find-next | Avoids hardcoded phase numbers; works correctly after phase insertion/renumbering | ✓ Good |

## Context

Shipped v2.5 with new-milestone auto mode. 13 milestones shipped (v1.0-v2.5) across 63 phases, 93 plans. 750 tests (budget at 93.75%). Full autonomous pipeline from brainstorm → new-milestone → discuss → plan → execute → verify → audit → complete now works without human input. v2.6 addresses disparity between `gsd health` (regex on STATE.md) and autopilot (`phase.cjs` artifact inspection) by creating unified `validation.cjs` module.

**Architecture:** zx-based autopilot (`autopilot.mjs`) with direct CJS imports for phase navigation, verification status, and config defaults. All Claude CLI invocations route through `runClaudeStreaming()` with NDJSON parsing and stall detection. Legacy bash autopilot preserved as `autopilot-legacy.sh`. `gsd` CLI binary with 6 deterministic commands. `/gsd:linear` for issue-driven workflows. `/gsd:brainstorm` for collaborative design sessions with auto-route to `/gsd:new-milestone --auto`. `/gsd:pr-review` for PR review capture, deduplication, scoring, and routing. `/gsd:audit-tests` for on-demand test health checks. Dual-layer test architecture: acceptance tests (human-owned, Given/When/Then/Verify) + hard test gate (baseline comparison, TDD awareness) + test steward agent (redundancy, budget, consolidation).
**Tech stack:** Node.js (CJS + zx/ESM), Bash (legacy), Claude Code CLI, markdown-based state, Linear MCP
**Codebase:** ~64,151 LOC (JS/CJS/MJS/Bash/MD)
**Known tech debt:** Test budget at 93.75% (750/800) — 7 redundant tests (parameterization candidate), 1 consolidation proposal; PARSE-02 config default via error suppression; INT-03 orphaned auto_mode signal in init output

---
*Last updated: 2026-03-15 after v2.6 milestone start*
