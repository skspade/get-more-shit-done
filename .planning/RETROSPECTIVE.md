# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — GSD Autopilot

**Shipped:** 2026-03-02
**Phases:** 7 | **Plans:** 12 | **Commits:** 52

### What Was Built
- Bash outer loop engine (`autopilot.sh`) — stateless orchestrator reinvoking Claude Code per phase step
- Auto-context agent (`gsd-auto-context`) — autonomous CONTEXT.md generation with layered decision sourcing
- Verification gates — human checkpoint with approve/fix/abort controls after each phase
- Debug-retry failure handling — spawns gsd-debugger, retries with configurable limits, persists failure state
- Phase status inference via artifact file presence (CONTEXT, PLAN, SUMMARY, VERIFICATION)

### What Worked
- Artifact-based state inference: no in-memory state, survives context resets, stateless process model
- Phase-per-capability decomposition: each of the 4 core phases (loop, context, gates, failure) was independently testable
- Gap closure cycle: audit found real issues (verify step unreachable, fix_desc not passed), closure phases fixed them systematically
- Thin orchestrator pattern: autopilot.sh delegates all substantive work to Claude Code processes, keeping itself simple

### What Was Inefficient
- Phase 6 was verification-only (produce 04-VERIFICATION.md) — could have been folded into Phase 4 execution if verification was done at the time
- Three audit cycles needed to reach clean state — first audit found gaps, second found integration bugs, third confirmed clean
- ROADMAP.md plan checkboxes never updated during execution for Phases 1-3 (showed as `[ ] TBD` despite being complete)
- Phase 6 not checked off in ROADMAP.md — a cosmetic oversight that persisted through multiple audits

### Patterns Established
- Artifact-based lifecycle: step = f(files present in phase directory)
- Gate-then-complete: verification gate blocks, then `phase complete` marks done
- ROADMAP checkbox-based completion detection over section parsing
- Dual file pattern fallback (VERIFICATION then UAT) for verification output
- `-- Human fix request:` separator convention for passing context to skill prompts

### Key Lessons
1. Wire verification into phase execution from the start — retrofitting it (Phase 6) costs an entire extra phase
2. Gap closure phases are cheap and effective — the audit-plan-fix cycle found real bugs that manual review missed
3. Bash is viable for orchestration when the contract is simple (invoke CLI, check exit code, read files)
4. Dead imports and config scaffold gaps accumulate when multiple phases modify the same files — worth a lint pass

### Cost Observations
- Model mix: predominantly opus (quality profile), with sonnet/haiku for sub-agents
- Sessions: ~12 plan executions across 7 phases
- Notable: gap closure phases (5-7) were much faster than core phases (1-4) — smaller scope, clearer requirements

---

## Milestone: v1.1 — Remove Git Tagging

**Shipped:** 2026-03-03
**Phases:** 2 | **Plans:** 3 | **Commits:** 15

### What Was Built
- Removed entire `git_tag` step from complete-milestone workflow (tag creation, push prompt, push logic)
- Cleaned all tag references from command spec, workflow purpose, and success criteria
- Updated help.md, README.md, and USER-GUIDE.md to remove automated tagging claims
- Fixed residual tag references in workflow output template and USER-GUIDE.md examples

### What Worked
- Audit-driven gap closure: first pass (Phase 8) caught the main targets, audit found 2 residual references, Phase 9 closed them cleanly
- Scope discipline: correctly preserved `Bash(git tag:*)` permissions example as out-of-scope (generic Claude Code snippet, not a GSD feature claim)
- Fast turnaround: entire milestone completed in ~1.5 hours with 15 commits

### What Was Inefficient
- Phase 8 missed 2 residual references (offer_next output template, USER-GUIDE.md inline comments) that required a gap closure phase — a more thorough grep sweep in Phase 8 could have caught these
- ROADMAP.md phase checkboxes and plan counts were not updated during Phase 8/9 execution (showed `0/0` and `[ ] TBD`)

### Patterns Established
- Removal milestones: focused removal of a feature can be completed very quickly with audit verification
- Gap closure as standard practice: expecting an audit-then-fix cycle produces better quality than trying to get it right in one pass

### Key Lessons
1. For removal tasks, grep for all variations early — "tag", "Tag", "tagged", "tagging", inline comments — reduces gap closure phases
2. ROADMAP checkbox/plan count updates should happen during execution, not just at milestone completion

### Cost Observations
- Model mix: quality profile (opus primary)
- Sessions: 3 plan executions across 2 phases
- Notable: removal milestones are very fast — clear scope, no design decisions, mechanical edits

---

## Milestone: v1.2 — Add Milestone Audit Loop

**Shipped:** 2026-03-03
**Phases:** 4 | **Plans:** 4 | **Commits:** 29

### What Was Built
- `run_milestone_audit` function — auto-triggers audit after all phases complete, routes on passed/gaps_found/tech_debt
- `run_gap_closure_loop` — iterative audit-fix cycles with configurable max iterations and `print_escalation_report`
- `run_milestone_completion` — DRY function called from all 4 audit-passed paths for autonomous archival
- Phase 13 gap closure — formal VERIFICATION.md for Phase 12 closing orphaned COMP-01/COMP-02

### What Worked
- DRY function pattern: `run_milestone_completion` called from all 4 exit paths instead of duplicating logic
- Gap closure reusing existing phase lifecycle: fix phases use identical discuss/plan/execute/verify as normal phases
- Config-driven behavior: `auto_accept_tech_debt` and `max_audit_fix_iterations` keep the loop adaptable
- Rapid iteration: 4 phases planned and executed in a single session

### What Was Inefficient
- Phase 12 skipped creating VERIFICATION.md, requiring Phase 13 as a gap closure phase — formal verification should be part of every phase
- Audit file remained stale (`gaps_found`) after Phase 13 closed the gaps — no re-audit step was run
- `run_gap_closure_loop` return value unchecked at call sites — safe but fragile to future changes

### Patterns Established
- Milestone completion pattern: extract version from STATE.md frontmatter, invoke complete-milestone via `run_step_with_retry`
- Gap closure verification pattern: create VERIFICATION.md for the implementation phase, update REQUIREMENTS.md traceability
- Three-function decomposition for audit loop: audit, gap closure, completion — each independently testable

### Key Lessons
1. Always create VERIFICATION.md during phase execution — retrofitting costs an extra gap closure phase (same lesson as v1.0 Phase 6)
2. The audit-gap-closure cycle is now automated end-to-end — the manual overhead is effectively zero
3. DRY function patterns for common exit paths prevent divergence when multiple code paths need the same behavior

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker)
- Sessions: 4 plan executions across 4 phases
- Notable: gap closure (Phase 13) was trivially fast — writing VERIFICATION.md and updating traceability checkboxes

---

## Milestone: v1.3 — CLI Utilities

**Shipped:** 2026-03-03
**Phases:** 6 | **Plans:** 9 | **Commits:** 49

### What Was Built
- Standalone `gsd` CLI binary with project auto-discovery and 5-command routing
- `gsd progress` — milestone status dashboard with phase breakdown and progress bar
- `gsd todos` — todo listing with `--area` filtering and detail view
- `gsd health` — .planning/ directory validation, config integrity, state consistency checks
- `gsd settings` — config view (dot-notation) and set (with validation rules)
- `gsd help` — overview listing and per-command detailed help (usage, flags, examples)
- 86 CLI tests across 11 suites with `--json` and `--plain` output modes

### What Worked
- Building on existing gsd-tools.cjs parsing layer: no duplication, consistent data
- gatherXData/handleX pattern: consistent architecture across all 5 commands, easy to test
- Parallel phase execution: Phases 15-18 all depended only on Phase 14, enabling fast iteration
- Audit gap closure (Phase 19): caught 15 documentation gaps (missing frontmatter, missing VERIFICATION.md, missing test) and closed all in a single phase
- All 6 phases completed in a single day with clean audit on second pass

### What Was Inefficient
- First audit found 15 documentation-level gaps — SUMMARY frontmatter should have been included during initial phase execution
- Phase 19 gap closure was entirely documentation/test debt — could have been avoided with stricter execution-time checks
- Some phases (14, 18) had inconsistent ROADMAP progress table formatting (missing milestone column)

### Patterns Established
- CLI handler pattern: gatherXData reads state, handleX formats response, formatOutput renders mode-appropriate output
- Inline data gathering over calling existing commands: avoids output() side-effects from existing functions
- Read-only CLI design: all commands are pure reads except `settings set`
- Per-command detailed help: COMMAND_DETAILS registry with usage, description, flags, examples

### Key Lessons
1. Include requirements-completed frontmatter in SUMMARY.md during execution, not after audit finds it missing
2. CLI commands benefit from a consistent handler pattern — makes adding new commands mechanical
3. Documentation gaps are the most common audit finding — a pre-commit check for SUMMARY frontmatter would prevent gap closure phases
4. Rich terminal output (ANSI) with `--plain` and `--json` alternatives should be the default pattern for any CLI tool

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker/verifier)
- Sessions: 9 plan executions across 6 phases
- Notable: entire milestone completed in ~1.5 hours — deterministic CLI work is very fast with established patterns

---

## Milestone: v1.4 — Linear Integration

**Shipped:** 2026-03-03
**Phases:** 5 | **Plans:** 5 | **Commits:** 29

### What Was Built
- `/gsd:linear` command spec with Linear MCP tool integration (get_issue, list_comments, create_comment)
- `linear.md` workflow (510 lines) — argument parsing, MCP issue fetching, 6-factor complexity scoring heuristic
- Dual-path delegation: quick route (score < 3) or milestone route (score >= 3) with flag overrides
- Comment-back loop posting route-specific summary comments to Linear issues after completion
- USER-GUIDE.md documentation (command reference, flags table, heuristic explanation, 6 usage examples)

### What Worked
- Single workflow file pattern: inline delegation avoided subagent spawning limitations while keeping all logic in one place
- Additive complexity scoring: transparent routing with 6 factors, easy to understand and adjust threshold
- MCP tool integration: get_issue with includeRelations + list_comments provided complete issue context in 2 calls
- Gap closure Phase 24 was minimal (2 edits) — only portable paths and missing frontmatter, both caught by audit
- Entire milestone completed in 1 day with 5 phases, clean audit on second pass

### What Was Inefficient
- Phase 23 SUMMARY.md missing requirements_completed frontmatter — same recurring gap as v1.3, caught by audit
- Command spec used absolute path initially — portability concern caught by audit, not during Phase 20 execution
- Phase completion dates in ROADMAP progress table had formatting inconsistency (missing milestone column for phases 20-24)

### Patterns Established
- MCP tool integration pattern: get_issue (includeRelations) + list_comments for full issue context
- Complexity scoring heuristic: additive points from multiple signals combined into single routing score
- Inline workflow delegation: execute another workflow's steps within a parent workflow, avoiding subagent spawning
- Comment-back pattern: build route-specific markdown body, iterate issues, call create_comment for each
- Warn-and-continue error handling: non-critical MCP failures display warning but don't fail the workflow

### Key Lessons
1. Portable paths (`@~/.claude/...`) should be the default for all command specs — absolute paths are a recurring defect
2. SUMMARY frontmatter completeness continues to be the #1 audit gap — needs enforcement at execution time (3rd milestone in a row)
3. Inline workflow delegation is a viable pattern when subagent spawning isn't possible — keeps control flow simple
4. MCP integration is straightforward when tool names are declared in command spec allowed-tools — no runtime discovery needed

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker/verifier)
- Sessions: 5 plan executions across 5 phases
- Notable: MCP workflow development was fast — no external API setup, Linear MCP tools just work when declared

---

## Milestone: v1.5 — GSD Brainstorming Command

**Shipped:** 2026-03-04
**Phases:** 5 | **Plans:** 5 | **Tasks:** 14

### What Was Built
- `/gsd:brainstorm` command with 10-step workflow covering context exploration through GSD routing
- Per-section design approval loop with unlimited revision rounds via AskUserQuestion
- Design doc output to `.planning/designs/YYYY-MM-DD-<topic>-design.md` with automatic git commit
- Auto-detect routing: PROJECT.md exists → new-milestone flow, else → new-project flow
- MILESTONE-CONTEXT.md bridge seeding design sections into milestone creation

### What Worked
- In-place workflow extension: single brainstorm.md file grew from 5 steps (Phase 25) to 10 steps (Phase 27) across 3 phases
- Reusing AskUserQuestion pattern for all interactions: consistent UX across topic prompt, questions, approach selection, section approval
- Gap closure (Phase 29) was minimal: 2 missing artifacts and checkbox updates, all fixed in 2 minutes
- Entire milestone completed in a single day (5 phases, 14 tasks, all 14 requirements satisfied)

### What Was Inefficient
- Phase 27 execution didn't produce SUMMARY.md or VERIFICATION.md — required Phase 29 gap closure to retroactively create them (same recurring issue)
- ROADMAP progress table had formatting inconsistencies for phases 25-26 and 28-29 (missing milestone column)
- Two audit passes needed: first found missing Phase 27 artifacts and stale checkboxes, gap closure resolved both

### Patterns Established
- Interactive design session pattern: context-first → questions → proposals → per-section approval → doc output → GSD routing
- PROJECT.md existence as routing signal: simple file test for deterministic milestone vs project routing
- MILESTONE-CONTEXT.md bridge: maps approved design sections as milestone features, replaces questioning phase

### Key Lessons
1. SUMMARY.md and VERIFICATION.md continue to be the #1 gap closure target — 4th milestone in a row (v1.0, v1.2, v1.3, v1.5)
2. Workflow extension in-place (adding steps to an existing file) is simpler than creating new files — single source of truth
3. Design-to-execution bridging requires an explicit artifact (MILESTONE-CONTEXT.md) — you can't just "pass context" between commands
4. Minimal milestones (5 phases, 1 plan each) can ship meaningful features when scope is well-defined

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for verifier)
- Sessions: 5 plan executions across 5 phases
- Notable: fastest milestone yet in terms of tasks-per-phase — focused scope with clear boundaries

---

## Milestone: v1.6 — Dual-Layer Test Architecture

**Shipped:** 2026-03-05
**Phases:** 6 | **Plans:** 15 | **Commits:** 16 feat

### What Was Built
- `testing.cjs` module — framework detection (node:test, Jest, Vitest, Mocha), regex-based test counting, config reading, 4 CLI commands
- Hard test gate in `execute-plan` — baseline capture, Set-difference regression detection, TDD RED commit awareness, output summarization
- Acceptance test layer — discuss-phase gathering (Given/When/Then/Verify), CONTEXT.md `<acceptance_tests>` storage, plan-checker Dimension 9, ownership invariant, verify-phase execution
- `gsd-test-steward` agent — redundancy/staleness detection, budget enforcement (per-phase 50, project 800), consolidation proposals (parameterize, promote, prune, merge)
- Comprehensive documentation — help.md, USER-GUIDE.md, README.md, CLI.md all updated
- 606+ tests pass, 0 failures

### What Worked
- Well-scoped phases: 6 phases each with clear boundaries (foundation, gate, acceptance, steward, docs, gaps)
- Clean baseline from Phase 30: fixing 2 pre-existing test failures first enabled clean hard gate activation
- Config-gated features: all test features degrade gracefully when config keys absent (zero-config fallback)
- Agent pattern reuse: gsd-test-steward follows exact same pattern as other agents (gsd-verifier, gsd-debugger)
- Gap closure (Phase 35) was minimal: only missing VERIFICATION.md files and checkbox updates
- Milestone audit passed clean: 24/24 requirements, 24/24 integrations, 5/5 E2E flows

### What Was Inefficient
- Phases 31-33 did not create VERIFICATION.md files during execution — same recurring gap requiring Phase 35 gap closure (5th milestone in a row)
- ROADMAP progress table had formatting inconsistencies for phases 30-33 (missing milestone column, inconsistent column counts)
- Phase 33 ROADMAP showed "0/3" plans despite all 3 being complete — checkbox/count not updated during execution

### Patterns Established
- Dual-layer test model: human-owned acceptance tests (Layer 1) + AI-managed unit/regression tests (Layer 2)
- Config-gated feature pattern: check `test.*` config with default fallback, silently skip when disabled
- Budget injection pattern: `<test_budget>` XML tag injected into planner prompt for test-aware planning
- Baseline comparison pattern: capture existing test failures before gate activation, only block on NEW failures
- TDD RED detection: commit message regex `/^test\(/` skips regression check for intentional failures

### Key Lessons
1. SUMMARY/VERIFICATION.md gap continues to be the #1 audit finding — 5th consecutive milestone (enforcement at execution time is overdue)
2. Config-gated features with zero-config degradation enable progressive adoption without breaking existing projects
3. Agent-based analysis (steward) with read-only constraint is safe and effective — never modifies code
4. Budget system should be informational (warnings), not blocking (enforcement) — advisory approach prevents false positives

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker/verifier/test steward)
- Sessions: 15 plan executions across 6 phases
- Notable: largest milestone by plan count (15 plans), completed in 1 day — established patterns from v1.0-v1.5 made execution mechanical

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 52 | 7 | First milestone — established artifact-based state, gap closure cycle |
| v1.1 | 15 | 2 | First removal milestone — confirmed audit-gap-closure cycle works |
| v1.2 | 29 | 4 | Automated the audit-gap-closure cycle itself — now runs without human intervention |
| v1.3 | 49 | 6 | First feature milestone post-automation — CLI tooling with consistent handler pattern |
| v1.4 | 29 | 5 | First MCP integration milestone — Linear issue-driven workflows with complexity routing |
| v1.5 | ~25 | 5 | First interactive workflow milestone — brainstorm command with design-to-execution bridging |
| v1.6 | 16 | 6 | Largest milestone (15 plans) — dual-layer test architecture with config-gated progressive adoption |

### Top Lessons (Verified Across Milestones)

1. Gap closure phases are consistently valuable — found real issues in all 7 milestones (v1.0: 3 phases, v1.1-v1.6: 1 phase each)
2. SUMMARY/VERIFICATION.md completeness is the #1 recurring audit gap — hit in 6 of 7 milestones, still needs execution-time enforcement
3. Always create VERIFICATION.md during phase execution — retrofitting costs an extra gap closure phase (confirmed in 6 of 7 milestones)
4. Consistent handler patterns (gatherXData/handleX) make adding new features mechanical and fast
5. Portable paths (`@~/.claude/...`) should be the default — absolute paths are a recurring defect (v1.4)
6. In-place workflow extension (adding steps to existing file) keeps single source of truth — proven in v1.5 and v1.6
7. Config-gated features with zero-config degradation enable progressive adoption without breaking existing projects (v1.6)
