# Milestones

## v2.7 Playwright UI Testing Integration (Shipped: 2026-03-20)

**Phases completed:** 4 phases, 5 plans, 16 tasks
**Timeline:** 1 day (2026-03-20)
**Git range:** 7a78642 → 31b1040 (33 files, +3,849/-41)

**Key accomplishments:**
- Added `detectPlaywright()` three-tier detection (configured/installed/not-detected), `parseTestOutput('playwright')` for line reporter format, and `e2e/` exclusion from test budget in testing.cjs
- Created `gsd-playwright` agent with five-step lifecycle (detect, scaffold, generate, execute, report), failure categorization (app-level vs test-level), and structured `## PLAYWRIGHT COMPLETE` return block
- Created `/gsd:ui-test` command with argument parsing (phase, URL, instructions), flags (`--scaffold`, `--run-only`, `--headed`), GSD banner, and gsd-playwright agent spawn
- Enhanced `add-tests` workflow with Playwright detection gate, scaffolding prompt (scaffold/skip/cancel), inline spec generation, and RED-GREEN execution pattern
- Added 11 infrastructure tests covering three-tier detection, CLI command, output parsing, and e2e exclusion
- Milestone audit: 24/24 requirements satisfied, 24/24 integrations wired, 2/2 E2E flows verified (tech_debt — 4 documentation/minor items)

---

## v2.6 Unified Validation Module (Shipped: 2026-03-17)

**Phases completed:** 7 phases, 12 plans
**Timeline:** 3 days (2026-03-15 → 2026-03-17)
**Git range:** 5528f97 → 8891f32 (62 files, +7,764/-1,597)

**Key accomplishments:**
- Created `validation.cjs` unified module with check registry pattern, 21 checks across 4 categories (structure, state, navigation, readiness), structured `ValidationResult` return type, and category-filtered execution
- Implemented artifact-based phase navigation via `computePhaseStatus()` and `findFirstIncompletePhase()`, replacing regex parsing of STATE.md
- Built atomic auto-repair system for STATE.md drift (completed_phases, total_phases, status field, missing phase directories) with independent try/catch per repair
- Migrated all 3 consumers (CLI `gsd health`, autopilot pre-flight, `gsd-tools validate`) to delegate to `validateProjectHealth()` with backward-compatible legacy error codes via `CHECK_ID_TO_LEGACY` mapping
- Removed legacy `gatherHealthData()` and `cmdValidateHealth()` dead code from verify.cjs (337 lines)
- Consolidated test suite from 822 to 796 tests via parameterization of skip-guard, init, and frontmatter tests (within 800 budget)
- Milestone audit passed: 35/35 requirements satisfied, 35/35 integrations wired, 4/4 E2E flows verified

---

## v2.5 New-Milestone Auto Mode (Shipped: 2026-03-14)

**Phases completed:** 5 phases, 6 plans
**Timeline:** 1 day (2026-03-14)
**Git range:** a5423c4 → c039cb9 (30 commits)
**Files modified:** 33 (3,180 insertions, 86 deletions)

**Key accomplishments:**
- Added `--auto` flag parsing with hybrid flag+config pattern and context resolution (MILESTONE-CONTEXT.md > @file > inline > error) in `new-milestone.md` and `init.cjs`
- Bypassed all 6 interactive decision points (build-next question, version, research, features, gaps, roadmap approval) with sensible defaults in auto mode
- Auto-chain from milestone creation into `/gsd:discuss-phase {N} --auto` with dynamic first phase resolution via `phase find-next`
- Simplified brainstorm.md milestone route from ~70 inline lines to SlashCommand delegation to `/gsd:new-milestone --auto`
- Closed all verification and metadata gaps: created VERIFICATION.md for phases 59/61, SUMMARY.md for phase 59, fixed traceability
- Milestone audit: 19/19 requirements satisfied, 19/19 integrations wired, 2/2 E2E flows verified (tech_debt status — 3 minor items)

---

## v2.4 Autopilot Streaming (Shipped: 2026-03-13)

**Phases completed:** 5 phases, 6 plans, 9 tasks
**Timeline:** 1 day (2026-03-12)
**Git range:** 8db1a94 → 6a2b374 (45 commits)
**Files modified:** 53 (5,493 insertions, 1,446 deletions)

**Key accomplishments:**
- Created `runClaudeStreaming()` with NDJSON parsing via readline async iteration, `displayStreamEvent()` for real-time assistant text/tool call dispatch, stall detection with repeating warnings, and `--quiet` buffered JSON fallback
- Wired `runStep()` and `runStepCaptured()` to delegate to `runClaudeStreaming()` for real-time streaming output during all autopilot phase steps
- Routed all 3 debug retry `claude -p` invocations through `runClaudeStreaming()` for live streaming during failure recovery
- Registered `autopilot.stall_timeout_ms` in config schema (CONFIG_DEFAULTS, KNOWN_SETTINGS_KEYS, validateSetting) with default 300000
- Created VERIFICATION.md for phases 54 and 56 with codebase line evidence, marking all 15 requirements as verified
- Milestone audit passed: 15/15 requirements satisfied, 15/15 integrations wired, 3/3 E2E flows verified

---

## v2.3 Autopilot CJS Consolidation (Shipped: 2026-03-10)

**Phases completed:** 7 phases, 16 plans
**Timeline:** 1 day (2026-03-10)
**Git range:** 0120bbe → 48a8145 (49 commits)
**Files modified:** 66 (6,910 insertions, 274 deletions)

**Key accomplishments:**
- Added phase navigation (`findFirstIncompletePhase`, `nextIncompletePhase`), verification status/gaps, and `CONFIG_DEFAULTS` to CJS modules with dispatch wiring through gsd-tools.cjs
- Rewrote autopilot as `autopilot.mjs` zx script with direct CJS imports via `createRequire`, eliminating JSON serialization boundary between bash and Node.js
- Implemented debug retry loops, TTY verification gate (approve/fix/abort), and milestone audit/gap closure in the zx script — identical behavior to bash version
- Migrated entrypoint routing: `bin/gsd-autopilot` runs `autopilot.mjs` by default, `--legacy` falls back to renamed `autopilot-legacy.sh`
- Added 35 unit/integration tests covering phase navigation, verification, config defaults, dispatch, and `--dry-run`
- Fixed integration bugs (npx zx invocation, `phaseInfo.directory` property) and closed all verification metadata gaps
- Milestone audit passed: 28/28 requirements satisfied, 5/5 E2E flows verified, 7/7 phases passed

---

## v2.2 PR Review Integration (Shipped: 2026-03-09)

**Phases completed:** 7 phases, 8 plans, 0 tasks

**Timeline:** 1 day (2026-03-09)
**Files modified:** 47 (4,961 insertions, 24 deletions)

**Key accomplishments:**
- Created `/gsd:pr-review` command with fresh review execution and `--ingest` mode for pre-existing reviews
- Built file-proximity deduplication with transitive merging — groups findings within 20 lines of each other
- Implemented hybrid scoring heuristic (+2 critical, +1 important, +1 per 5 files) routing to quick or milestone paths
- Quick route creates one task per file-region group with sequential execution and STATE.md tracking
- Milestone route generates MILESTONE-CONTEXT.md from findings and delegates to new-milestone workflow
- Added `init pr-review` subcommand to gsd-tools.cjs for quick route initialization
- Full documentation in help.md, USER-GUIDE.md, and README.md; milestone audit passed 30/30 requirements

---

## v2.1 Autopilot Result Parsing (Shipped: 2026-03-06)

**Phases completed:** 2 phases, 2 plans, 4 tasks
**Timeline:** 1 day (2026-03-06)
**Git range:** b5d6639 → d8362a3 (16 commits)
**Files modified:** 2 code files (+223/-5 lines)

**Key accomplishments:**
- Added `format_json_output()` function to autopilot.sh with jq pretty-printing and raw fallback for non-JSON
- Wired formatting into all 5 Claude CLI invocation sites with exit code propagation via pipefail
- 14 new tests covering JSON formatting, non-JSON passthrough, structural wiring, and output capture integration
- Milestone audit passed: 5/5 requirements satisfied, 5/5 integrations wired, 3/3 E2E flows verified

---

## v2.0 README Rewrite (Shipped: 2026-03-06)

**Phases completed:** 2 phases, 2 plans, 4 tasks
**Timeline:** 1 day (2026-03-06)
**Git range:** 9941c7e → ee3cf8c (14 commits)
**Files modified:** 14 (973 insertions, 719 deletions)

**Key accomplishments:**
- Replaced 746-line upstream README with 97-line fork-branded quick start guide — zero upstream branding residue
- Added complete quick start flow: install, new-project, 4-command core loop, complete-milestone, quick tasks
- Added 10-command reference table with links to User Guide and CLI Reference
- Created Phase 36 formal verification artifact confirming all 15 requirements pass
- Milestone audit passed: 15/15 requirements satisfied, 15/15 integrations wired, 4/4 E2E flows verified

---

## v1.6 Dual-Layer Test Architecture (Shipped: 2026-03-05)

**Phases completed:** 6 phases, 15 plans
**Timeline:** 1 day (2026-03-05)
**Git range:** 4d1b94d → fca40c5 (16 feat commits)
**Files modified:** 57 (6,978 insertions, 44 deletions)

**Key accomplishments:**
- Built `testing.cjs` module with framework detection (node:test, Jest, Vitest, Mocha), test counting (regex-based `it`/`test` block counting), and 4 CLI commands (`test-count`, `test-detect-framework`, `test-config`, `test-run`)
- Implemented post-commit hard test gate in `execute-plan` with baseline comparison (Set difference on failed test names), TDD RED commit detection, and output summarization to pass/fail counts
- Added acceptance test layer: discuss-phase gathering in Given/When/Then/Verify format, CONTEXT.md `<acceptance_tests>` storage, plan-checker Dimension 9 coverage validation, ownership invariant enforcement, and verify-phase execution
- Created `gsd-test-steward` agent for suite health analysis: redundancy detection, staleness detection, budget enforcement (per-phase 50, project 800), and consolidation proposals (parameterize, promote, prune, merge) requiring human approval
- Comprehensive documentation across help.md (commands + config), USER-GUIDE.md (test architecture guide), README.md (test config section), and CLI.md (`test-count` command docs)
- 606+ tests pass, 0 failures — milestone audit: 24/24 requirements satisfied, 24/24 integrations wired, 5/5 E2E flows verified

---

## v1.5 GSD Brainstorming Command (Shipped: 2026-03-04)

**Phases completed:** 5 phases, 5 plans, 14 tasks
**Timeline:** 1 day (2026-03-04)

**Key accomplishments:**
- Created `/gsd:brainstorm` command with 10-step workflow covering context exploration, clarifying questions, approach proposals, design presentation, and GSD routing
- Per-section design approval loop with unlimited revision rounds using AskUserQuestion
- Design doc output to `.planning/designs/YYYY-MM-DD-<topic>-design.md` with automatic git commit
- Auto-detect GSD routing: PROJECT.md exists → new-milestone flow, else → new-project flow with design context seeding
- Full documentation in help.md, USER-GUIDE.md, and README.md
- Gap closure phase resolved missing Phase 27 verification artifacts and stale REQUIREMENTS.md checkboxes

---

## v1.4 Linear Integration (Shipped: 2026-03-04)

**Phases completed:** 5 phases, 5 plans, 7 tasks
**Timeline:** 1 day (2026-03-03)
**Git range:** aa006a0 → cce03d0 (29 commits)

**Key accomplishments:**
- Created `/gsd:linear` command with Linear MCP tool integration (get_issue, list_comments, create_comment)
- Built `linear.md` workflow (510 lines) with argument parsing, issue fetching, and 6-factor complexity scoring heuristic
- Implemented dual-path delegation — quick or milestone route based on complexity score threshold
- Added comment-back loop posting route-specific summary comments to Linear issues after workflow completion
- Documented Linear integration in USER-GUIDE.md (command reference, flags table, 6 usage examples) and README.md

---

## v1.3 CLI Utilities (Shipped: 2026-03-03)

**Phases completed:** 6 phases, 9 plans
**Timeline:** 1 day (2026-03-03)
**Git range:** 2515a59 → 4e19a98 (49 commits)

**Key accomplishments:**
- Standalone `gsd` CLI binary with project auto-discovery (walk-up .planning/ finder) and 5-command routing
- `gsd progress` milestone status dashboard with phase breakdown, plan counts, and progress bar visualization
- `gsd todos` command with listing, area filtering (`--area`), and single-todo detail view
- `gsd health` validation of .planning/ directory structure, config integrity, and STATE/ROADMAP consistency
- `gsd settings` with view mode (dot-notation flattening) and set mode (with validation rules)
- `gsd help` with overview listing and per-command detailed help (usage, flags, examples)
- 86 CLI tests across 11 suites, all passing; `--json` and `--plain` output modes on every command

---

## v1.2 Add Milestone Audit Loop (Shipped: 2026-03-03)

**Phases completed:** 4 phases, 4 plans
**Timeline:** ~1 day (2026-03-02 → 2026-03-03)
**Git range:** 9c1de87 → 623f3ff (29 commits)

**Key accomplishments:**
- Added `run_milestone_audit` function with three-way routing (passed/gaps_found/tech_debt) and configurable `auto_accept_tech_debt` setting
- Added `run_gap_closure_loop` with iterative audit-fix cycles, configurable max iterations, and `print_escalation_report` for human escalation
- Added `run_milestone_completion` function called from all 4 audit-passed paths for autonomous milestone archival
- Formal verification of all 11 requirements with line-level code evidence across 3 VERIFICATION.md files
- Full audit passed: 11/11 requirements satisfied, 11/11 integrations wired, 4/4 E2E flows verified

---

## v1.1 Remove Git Tagging (Shipped: 2026-03-03)

**Phases completed:** 2 phases, 3 plans, 6 tasks
**Timeline:** ~1.5 hours (2026-03-02 19:41 → 21:13)
**Git range:** ed47a11 → 10ec1c8 (15 commits)

**Key accomplishments:**
- Removed entire `git_tag` step (tag creation + push logic) from complete-milestone workflow
- Cleaned all tag references from command spec, workflow purpose, and success criteria
- Removed tag references from help.md, README.md, and USER-GUIDE.md documentation
- Fixed residual "Tag: v[X.Y]" in workflow output template and "Archive, tag, done" in USER-GUIDE.md examples
- Full audit passed: 6/6 requirements satisfied, 2/2 E2E flows verified

---

## v1.0 GSD Autopilot (Shipped: 2026-03-02)

**Phases completed:** 7 phases, 12 plans
**Files modified:** 241 (62,496 insertions, 7,952 deletions)
**LOC:** ~19,626 lines (sh, cjs, js, md)

**Key accomplishments:**
- Bash outer loop engine (`autopilot.sh`) driving phases with fresh context windows and circuit breaker on stalls
- Auto-context agent replacing interactive discuss with autonomous CONTEXT.md generation using layered decision sourcing
- Verification gates with human checkpoint — approve/fix/abort controls at each phase completion
- Debug-retry failure handling spawning gsd-debugger on failures with configurable retry limits and STATE.md persistence
- Three gap closure phases fixing wiring bugs (step inference, UAT file patterns), verifying Phase 4, and resolving integration issues (INT-01, INT-02)

---

