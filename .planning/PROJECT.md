# GSD Autopilot

## What This Is

An autonomous orchestrator command (`/gsd:autopilot`) for a fork of the GSD framework that drives milestones from start to completion — or resumes mid-milestone — without human intervention. A zx-based Node.js script (`autopilot.mjs`) reinvokes Claude Code with fresh context per phase, importing CJS modules directly for phase navigation, verification status, and config defaults — eliminating the JSON serialization boundary of the original bash implementation. Real-time streaming output via `--output-format stream-json` replaces buffered JSON — `runClaudeStreaming()` consolidates all Claude CLI invocations with NDJSON parsing, live assistant text to stdout, tool call indicators to stderr, configurable stall detection (default 5 min with repeating warnings), and `--quiet` fallback for CI/scripted use. An auto-context agent replaces interactive discuss, verification gates pause for human review via TTY, debug-retry handles failures automatically, and a milestone audit loop automatically verifies requirements coverage and closes gaps before completing the milestone. Automated UAT via `/gsd:uat-auto` — Chrome MCP (primary) and Playwright headless (fallback) browser engines discover tests from UAT.md files or generate scenarios from SUMMARY.md, execute against a live web app, capture screenshots to `.planning/uat-evidence/`, and write MILESTONE-UAT.md with gap-compatible schema; `runAutomatedUAT()` in autopilot.mjs triggers after milestone audit passes and routes results into completion or gap closure. A unified `validation.cjs` module provides 21 health checks across 4 categories (structure, state, navigation, readiness) with a check registry pattern, structured `ValidationResult` return type, category-filtered execution, and atomic auto-repair for STATE.md drift — consumed by CLI (`gsd health`), autopilot pre-flight, and `gsd-tools validate`. Linear issue integration (`/gsd:linear`) enables issue-driven workflows — fetching issues via MCP, running an always-on interview phase (3-5 adaptive questions) that replaces the numeric scoring heuristic, routing to quick or milestone based on complexity signal, posting pre-execution interview summaries and post-execution completion comments back to Linear. Brainstorming integration (`/gsd:brainstorm`) bridges idea exploration to execution — running collaborative design sessions that produce design docs and auto-route into GSD milestone/project creation. PR review integration (`/gsd:pr-review`) captures PR review toolkit findings, deduplicates via file-region grouping, scores complexity, and routes to quick task or milestone for stateful resolution. Dual-layer test architecture provides a hard test gate during execution (baseline comparison, TDD awareness, output summarization), human-owned acceptance tests in Given/When/Then/Verify format, and a test steward agent for suite health (redundancy detection, budget enforcement, consolidation proposals). Test steward consolidation bridge wires steward proposals into actionable gap closure phases — `gaps.test_consolidation` schema in MILESTONE-AUDIT.md frontmatter, budget-gated phase creation, and four strategy-to-task mapping templates (prune→delete, parameterize→refactor, promote→delete-and-verify, merge→reorganize). On-demand Playwright E2E testing via `/gsd:ui-test` command and `gsd-playwright` agent — three-tier detection, scaffolding, phase-aware test generation from acceptance criteria, execution with failure categorization, and integration into the `add-tests` workflow. README rewritten as a minimal 97-line quick start guide with fork branding, core workflow, and command reference. Legacy bash autopilot preserved as `autopilot-legacy.sh` with `--legacy` flag fallback.

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
- ✓ Unified validation module (`validation.cjs`) with 21 checks across 4 categories and check registry pattern — v2.6
- ✓ State consistency checks (STATE.md ↔ ROADMAP.md milestone name, phase counts, status) — v2.6
- ✓ Phase navigation checks using `computePhaseStatus()` artifact inspection replacing regex parsing — v2.6
- ✓ Autopilot readiness checks (incomplete phases, deterministic step, truncated artifacts, valid config) — v2.6
- ✓ Atomic auto-repair for STATE.md drift (counts, status, missing phase directories) — v2.6
- ✓ `gsd health` refactored to delegate to `validation.cjs` with backward-compatible legacy codes, `--fix` for auto-repair — v2.6
- ✓ Autopilot pre-flight calls `validateProjectHealth({ autoRepair: true })` before phase loop — v2.6
- ✓ `gsd-tools validate health` dispatch with `--repair` flag — v2.6
- ✓ Test suite consolidated from 822 to 796 via parameterization (within 800 budget) — v2.6
- ✓ `/gsd:ui-test` command with argument parsing (phase, URL, free-text), flags (--scaffold, --run-only, --headed), Playwright detection/scaffolding, test generation, and execution — v2.7
- ✓ `gsd-playwright` agent with five-step lifecycle (detect, scaffold, generate, execute, report) and structured results — v2.7
- ✓ Enhanced `add-tests` workflow E2E path with Playwright detection gate, scaffolding prompt, `.spec.ts` generation, and RED-GREEN execution pattern — v2.7
- ✓ Three-tier Playwright detection (`detectPlaywright()`) and `parseTestOutput('playwright')` for line reporter format — v2.7
- ✓ E2E test budget exclusion (`e2e/` in EXCLUDE_DIRS) preventing Playwright specs from counting against project budget — v2.7
- ✓ `gaps.test_consolidation` schema in MILESTONE-AUDIT.md YAML frontmatter with strategy/source/action/estimated_reduction fields — v2.8
- ✓ Consolidation-aware status routing: consolidation-only audits return `tech_debt`, mixed audits preserve `gaps_found` — v2.8
- ✓ Budget gating for test consolidation phase creation (OK skips, Warning/Over Budget proceeds) — v2.8
- ✓ Four strategy-to-task mapping templates (prune→delete, parameterize→refactor, promote→delete-and-verify, merge→reorganize) — v2.8
- ✓ 19 edge case tests for consolidation bridge (empty proposals, steward-disabled, consolidation-only, autopilot compatibility) — v2.8
- ✓ `/gsd:test-review` command spec with argument parsing and `--report-only` flag — v2.9
- ✓ `gsd-test-reviewer` read-only agent with 6-step diff-aware analysis (coverage gaps, staleness, consolidation) — v2.9
- ✓ Structured markdown report output to `.planning/reviews/YYYY-MM-DD-test-review.md` — v2.9
- ✓ User-choice routing after report: quick task, milestone, or done — v2.9
- ✓ Documentation in help.md, USER-GUIDE.md, README.md — v2.9
- ✓ `/gsd:linear` interview phase — 3-5 adaptive questions after ticket fetch, replacing complexity scoring heuristic — v3.0
- ✓ Interview-driven routing — complexity signal question determines quick/milestone route — v3.0
- ✓ Hybrid output — quick route confirmation summary with re-ask, milestone route approach proposals — v3.0
- ✓ Pre-execution comment-back — interview summary posted to Linear via MCP before execution starts — v3.0
- ✓ Enriched downstream context — interview data in linear-context.md, task descriptions, MILESTONE-CONTEXT.md — v3.0
- ✓ Command spec and documentation updated for interview-driven routing — v3.0
- ✓ `uat-config.yaml` schema with base_url, startup_command, browser, fallback_browser, timeout_minutes — v3.1
- ✓ Silent UAT skip when no uat-config.yaml exists (non-web projects proceed to completion) — v3.1
- ✓ MILESTONE-UAT.md format with YAML frontmatter and gap-compatible schema — v3.1
- ✓ Test discovery from UAT.md files (primary) and SUMMARY.md generation (fallback) — v3.1
- ✓ Chrome MCP execution engine — navigate, interact, screenshot, DOM-first pass/fail judgment — v3.1
- ✓ Chrome MCP availability probe with automatic Playwright fallback on failure — v3.1
- ✓ Playwright fallback with ephemeral inline scripts, Chromium auto-install, identical output format — v3.1
- ✓ `/gsd:uat-auto` workflow — autonomous test execution with configurable timeout (default 10 min) — v3.1
- ✓ `runAutomatedUAT()` in autopilot.mjs — triggered after audit passes, routes to completion or gap closure — v3.1
- ✓ Evidence screenshots saved to `.planning/uat-evidence/{milestone}/` with observed vs expected descriptions — v3.1
- ✓ `plan-milestone-gaps` recognizes MILESTONE-UAT.md as gap source alongside MILESTONE-AUDIT.md — v3.1
- ✓ Documentation in help.md, USER-GUIDE.md, README.md for /gsd:uat-auto — v3.1

### Active

(No active requirements — planning next milestone)

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
- Playwright MCP server integration — GSD's phase-context generation is the approach; MCP creates overlapping flow
- Playwright Codegen recording — record-and-replay produces verbose, fragile code; GSD generates from design artifacts
- Visual regression baselines auto-generated — baselines require manual approval; auto-generating causes first-run failures
- Pipeline integration for Playwright (autonomous gate) — on-demand only; not wired into the autonomous pipeline
- Multi-browser test matrix — Chromium-only is sufficient; cross-browser adds complexity without clear value
- Persistent .spec.ts test file generation for UAT — UAT.md files ARE the test definitions; codegen creates maintenance burden
- Visual regression baseline comparison — Claude's semantic judgment replaces pixel-diff testing
- Parallel UAT test execution — test count per milestone is small (5-20); sequential is sufficient
- Selector-based UAT test definitions — defeats natural-language-interpretation advantage
- Interactive UAT mode — contradicts fully autonomous requirement; screenshots provide post-hoc visibility
- UAT for non-web projects — CLI/API testing needs different approaches; non-web projects skip via missing config
- Phase-level UAT — deferred to future; milestone-level is sufficient for now
- UAT result trending across milestones — deferred to future

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
| Check registry pattern for validation | Checks as `{ id, category, severity, check, repair? }` objects — extensible, filterable, self-documenting | ✓ Good |
| Category-filtered check execution | `runChecks({ categories: ['readiness'] })` — consumers run only relevant checks instead of full suite | ✓ Good |
| Separated auto-repair from validation | `autoRepair` option keeps repair optional; repairs attempted independently with try/catch | ✓ Good |
| Legacy code mapping via CHECK_ID_TO_LEGACY | Preserves E001-E005, W003-W006 codes for backward compatibility while using semantic IDs internally | ✓ Good |
| Three consumers sharing one validation module | CLI, autopilot, gsd-tools all call `validateProjectHealth()` — single source of truth | ✓ Good |
| Test parameterization for budget compliance | for...of loops with case arrays vs duplicated test blocks — same coverage, fewer test count | ✓ Good |
| Three-tier Playwright detection over boolean | Configured/installed/not-detected gives richer state than installed/not-installed — enables scaffolding decisions | ✓ Good |
| Direct agent spawn command (no workflow file) for ui-test | Follows audit-tests.md pattern — command is thin argument parser that spawns agent | ✓ Good |
| Inline scaffolding in add-tests over Task() spawn | Deterministic file writes don't need agent overhead; keeps workflow self-contained | ✓ Good |
| BLOCKED status for missing acceptance_tests | Agent refuses to fabricate tests when no Given/When/Then criteria exist | ✓ Good |
| Failure categorization (app-level vs test-level) | Connection refused / timeout are infrastructure issues; locator / assertion failures are test issues — different remediation paths | ✓ Good |
| Consolidation proposals route to tech_debt only | They're optional cleanup, not blockers — never force gaps_found status | ✓ Good |
| Omit gaps.test_consolidation when no proposals | Cleaner backward compatibility than writing an empty array | ✓ Good |
| Budget gating before consolidation phase creation | OK budget skips consolidation entirely — prevents unnecessary cleanup when tests are within budget | ✓ Good |
| Source-text structural validation for autopilot tests | autopilot.mjs uses ESM/zx which can't be required in CJS tests — read and assert on source content | ✓ Good |
| Direct agent spawn pattern for test-review (no workflow file) | Follows audit-tests.md pattern — command IS the orchestrator, spawns agent via Task() | ✓ Good |
| User-choice routing over auto-scoring for test review | Test findings are too subjective for numeric scoring — user chooses quick task, milestone, or done | ✓ Good |
| Dual-signal test mapping (naming + imports) | Naming conventions alone miss aliased imports; import tracing catches indirect test relationships | ✓ Good |
| Interview-first routing over numeric scoring | Adaptive questions capture richer context than 6-factor heuristic; complexity signal is one of 5 dimensions | ✓ Good |
| Two-comment pattern for Linear tickets | Pre-execution summary + post-execution completion gives full lifecycle visibility without modifying existing comment | ✓ Good |
| Dimension-based re-ask over full restart | "No, let me clarify" routes to specific dimension picker — avoids re-answering all questions | ✓ Good |
| Chrome MCP primary with Playwright fallback | Chrome MCP gives Claude direct browser control; Playwright covers headless/CI where Chrome MCP unavailable | ✓ Good |
| DOM-first assertion protocol over pixel comparison | DOM text content is deterministic and precise; screenshots supplement but don't drive pass/fail judgment | ✓ Good |
| Test discovery from UAT.md with SUMMARY.md fallback | UAT.md files are explicit test definitions; SUMMARY.md generation covers projects without UAT artifacts | ✓ Good |
| Ephemeral inline Playwright scripts over persistent specs | No maintenance burden; each test run generates fresh scripts from test descriptions | ✓ Good |
| Full round-trip probe for Chrome MCP availability | Simple tab check was unreliable; actual navigate+read probe confirms real capability | ✓ Good |
| MILESTONE-UAT.md gaps using same schema as MILESTONE-AUDIT.md | Unified gap format means plan-milestone-gaps handles both sources identically | ✓ Good |
| Silent skip on missing uat-config.yaml | Non-web projects shouldn't fail or block; absence means "not applicable" | ✓ Good |

## Context

Shipped v3.1 with automated UAT session. 19 milestones shipped (v1.0-v3.1) across 97 phases, 139 plans. 817 tests (budget at 102.1% — slightly over). Full autonomous pipeline from brainstorm → new-milestone → discuss → plan → execute → verify → audit → **UAT** → complete works without human input. `/gsd:uat-auto` adds browser-based acceptance testing — Chrome MCP (primary) or Playwright (fallback) executes discovered tests against a live web app, writes MILESTONE-UAT.md with gap-compatible results, and feeds failures into gap closure.

**Architecture:** zx-based autopilot (`autopilot.mjs`) with direct CJS imports for phase navigation, verification status, and config defaults. All Claude CLI invocations route through `runClaudeStreaming()` with NDJSON parsing and stall detection. Legacy bash autopilot preserved as `autopilot-legacy.sh`. `gsd` CLI binary with 6 deterministic commands. Unified `validation.cjs` with 21 checks across 4 categories (structure, state, navigation, readiness), auto-repair, and 3 consumer paths (CLI, autopilot, gsd-tools). `/gsd:uat-auto` for automated browser-based UAT — dual-engine (Chrome MCP + Playwright fallback), test discovery from UAT.md/SUMMARY.md, evidence screenshots, MILESTONE-UAT.md with gap schema, autopilot integration via `runAutomatedUAT()`. `/gsd:linear` for issue-driven workflows with interview-first routing (10-step workflow: fetch → interview → route → hybrid output → comment-back → execute → complete). `/gsd:brainstorm` for collaborative design sessions with auto-route to `/gsd:new-milestone --auto`. `/gsd:pr-review` for PR review capture, deduplication, scoring, and routing. `/gsd:test-review` for PR diff-aware test analysis with `gsd-test-reviewer` agent and user-choice routing. `/gsd:audit-tests` for on-demand test health checks. Dual-layer test architecture: acceptance tests (human-owned, Given/When/Then/Verify) + hard test gate (baseline comparison, TDD awareness) + test steward agent (redundancy, budget, consolidation). Test steward consolidation bridge: `gaps.test_consolidation` schema → budget gating → strategy-to-task mapping → gap closure phase creation. `/gsd:ui-test` for on-demand Playwright E2E testing with `gsd-playwright` agent lifecycle.
**Tech stack:** Node.js (CJS + zx/ESM), Bash (legacy), Claude Code CLI, markdown-based state, Linear MCP, Playwright (E2E), js-yaml, Chrome MCP
**Codebase:** ~9,200 LOC across core modules (validation.cjs, cli.cjs, phase.cjs, gsd-tools.cjs, autopilot.mjs, testing.cjs, init.cjs, core.cjs, uat.cjs, etc.)
**Known tech debt:** Test budget at 102.1% (817/800); `extractFrontmatter` does not parse nested YAML array-of-objects (gaps.test_consolidation entries parsed as strings, not objects — LLM path unaffected); `playwright-detect --raw` documented as JSON in 3 consumers but returns plain string; SUMMARY frontmatter references non-existent `parsePlaywrightOutput()` (actual: `parseTestOutput` with 'playwright' arg); scaffolding templates omit `webServer` block; KNOWN_SETTINGS_KEYS duplicated between validation.cjs (15 keys) and cli.cjs (33 keys); Phase 82 missing VERIFICATION.md and SUMMARY.md (documentation gap, functionally complete); v3.0 SUMMARY frontmatter gaps (phases 87, 89 missing `requirements-completed`); 1 dispatcher routing smoke test subsumed by roadmap.test.cjs

---
*Last updated: 2026-03-22 after v3.1 milestone*
