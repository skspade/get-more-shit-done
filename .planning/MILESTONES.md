# Milestones

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

