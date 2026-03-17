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

## Milestone: v2.0 — README Rewrite

**Shipped:** 2026-03-06
**Phases:** 2 | **Plans:** 2 | **Commits:** 14

### What Was Built
- Replaced 746-line upstream README with 97-line fork-branded quick start guide
- Added core workflow quick start (install, new-project, 4-command loop, complete-milestone, quick tasks)
- Added 10-command reference table with links to User Guide and CLI Reference
- Created formal verification artifact for Phase 36 and checked all 15 requirement checkboxes

### What Worked
- Brainstorm-first approach: design doc provided exact section content, reducing execution to mechanical copy
- Complete rewrite (not edit) guaranteed zero upstream residue — no partial branding cleanup needed
- Smallest milestone yet (2 phases, 2 plans) — well-defined scope with clear deliverable
- Gap closure (Phase 37) was trivially fast — only VERIFICATION.md creation and checkbox updates

### What Was Inefficient
- Phase 36 did not create VERIFICATION.md during execution — same recurring gap requiring Phase 37 (6th milestone in a row with this pattern)
- Audit found 15 orphaned requirements due to missing verification artifact — could have been avoided entirely

### Patterns Established
- Brainstorm-to-README pipeline: design doc sections map directly to README sections
- Docs-only phases produce no tests (appropriate — confirmed by audit)

### Key Lessons
1. VERIFICATION.md gap persists through v2.0 — 6th consecutive milestone; this pattern is now a known systemic issue rather than an oversight
2. Brainstorm design docs are effective content blueprints — execution becomes mechanical when design is complete
3. Complete rewrites are faster than incremental edits for branding changes — no risk of residual content

### Cost Observations
- Model mix: quality profile (opus primary)
- Sessions: 2 plan executions across 2 phases
- Notable: fastest milestone ever — docs-only scope with brainstorm design doc as blueprint

---

## Milestone: v2.1 — Autopilot Result Parsing

**Shipped:** 2026-03-06
**Phases:** 2 | **Plans:** 2 | **Commits:** 16

### What Was Built
- `format_json_output()` bash function with jq pretty-printing and raw fallback for non-JSON
- All 5 Claude CLI invocation sites in autopilot.sh piped through formatter
- 14 tests covering JSON pretty-printing, non-JSON passthrough, structural wiring, and output capture integration

### What Worked
- TDD approach: failing tests written first, then implementation — both plans executed in 3 minutes each
- sed-based function extraction for testing: avoids sourcing entire autopilot.sh with its env var dependencies
- Structural grep tests for wiring verification: confirms all 5 call sites without requiring live Claude CLI invocations
- No gap closure needed — first milestone where the audit passed clean on first attempt (no missing VERIFICATION.md, no missing frontmatter)
- Brainstorm-first approach carried over from v2.0 — design doc provided exact function specification

### What Was Inefficient
- Nothing significant — smallest feature scope yet (single function + 5 pipe insertions)

### Patterns Established
- Bash function testing pattern: sed extraction + env var passing + stdin-based script injection via execSync
- Pipe-chain formatting: all Claude CLI output flows through format_json_output before reaching tee or error handlers

### Key Lessons
1. Clean audit pass is achievable — v2.1 is the first milestone with zero gap closure phases, likely due to well-scoped 2-phase design
2. sed-based function extraction is a viable pattern for testing individual bash functions in isolation
3. Structural grep tests provide strong wiring verification without integration test overhead

### Cost Observations
- Model mix: quality profile (opus primary)
- Sessions: 2 plan executions across 2 phases
- Notable: fastest milestone — 6 minutes total execution time for both plans, zero gap closure

---

## Milestone: v2.2 — PR Review Integration

**Shipped:** 2026-03-09
**Phases:** 7 | **Plans:** 8 | **Commits:** 48

### What Was Built
- `/gsd:pr-review` command — fresh review execution or ingest mode for pre-existing reviews
- File-proximity deduplication with transitive merging — groups findings within 20 lines of each other
- Hybrid scoring heuristic (+2 critical, +1 important, +1 per 5 files) routing to quick or milestone paths
- Quick route: one task per file-region group with sequential execution and STATE.md tracking
- Milestone route: MILESTONE-CONTEXT.md generation from findings, delegation to new-milestone workflow
- `init pr-review` subcommand added to gsd-tools.cjs for quick route initialization
- Full documentation in help.md, USER-GUIDE.md, and README.md

### What Worked
- Pattern reuse from `/gsd:linear`: single workflow file, inline delegation, complexity scoring heuristic, dual-path routing — adapted quickly
- File-proximity deduplication is genuinely useful — reduces noise from multiple findings in the same code region
- Gap closure phases (45, 46) caught a real runtime integration bug: `init pr-review` subcommand was missing from gsd-tools dispatch
- Milestone audit validated all 30 requirements with 3-source cross-reference (VERIFICATION, SUMMARY, REQUIREMENTS)
- All 7 phases completed in a single day

### What Was Inefficient
- Phase 45 was needed because `init pr-review` wasn't wired during Phase 42 — the quick route was untestable end-to-end until gap closure
- Phase 46 gap closure was entirely metadata: missing VERIFICATION.md files, missing SUMMARY frontmatter, unchecked REQUIREMENTS boxes
- ROADMAP progress table had inconsistent formatting for phases 40-43 and 45-46 (missing milestone column)

### Patterns Established
- PR review workflow mirrors Linear workflow: capture → dedup → score → route (quick or milestone)
- Generic Source column in STATE.md quick tasks table accommodates multiple input sources (Linear, pr-review)
- Review findings as XML blocks for planner context: structured data per file-region group

### Key Lessons
1. Runtime integration gaps (missing dispatch cases) need E2E testing during initial phase, not gap closure
2. Metadata completeness (VERIFICATION.md, SUMMARY frontmatter) continues to be the systemic gap — 8th milestone with this pattern
3. Pattern reuse from previous milestones (v1.4 Linear) dramatically accelerates development of similar features
4. File-proximity deduplication is a reusable pattern for any tool that processes multi-file findings

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker/verifier)
- Sessions: 8 plan executions across 7 phases
- Notable: pattern reuse from v1.4 made workflow development very fast; gap closure was mechanical

---

## Milestone: v2.3 — Autopilot CJS Consolidation

**Shipped:** 2026-03-10
**Phases:** 7 | **Plans:** 16 | **Commits:** 49

### What Was Built
- CJS module extensions: `findFirstIncompletePhase`, `nextIncompletePhase`, `getVerificationStatus`, `getGapsSummary`, `CONFIG_DEFAULTS` with dispatch wiring
- `autopilot.mjs` zx script — full state machine (discuss→plan→execute→verify→complete) with direct CJS imports via `createRequire`
- Debug retry loops, TTY verification gate (approve/fix/abort), milestone audit/gap closure loop in zx
- Entrypoint routing: `bin/gsd-autopilot` → `autopilot.mjs` by default, `--legacy` → `autopilot-legacy.sh`
- 35 new tests covering phase navigation, verification status, config defaults, dispatch, and `--dry-run`
- Integration bug fixes: npx zx invocation, `phaseInfo.directory` property resolution

### What Worked
- Direct CJS imports via `createRequire` eliminated the JSON serialization boundary — no more `gsd_tools ... | parse` chains
- Single-file autopilot implementation: all 1100+ lines in one `autopilot.mjs` — easy to trace, debug, and modify
- Phases 47-49 progressed linearly (CJS foundations → core loop → advanced features) with clean separation of concerns
- Gap closure phases (52, 53) caught real integration bugs: `node` vs `npx zx` invocation and `.dir` vs `.directory` property mismatch
- All 28 requirements satisfied with 7/7 phases passing verification
- Entire milestone completed in 1 day (autopilot-driven) including 2 gap closure phases

### What Was Inefficient
- Phase 50 and 51 SUMMARY files initially lacked `requirements-completed` frontmatter — same recurring metadata gap
- 2 integration bugs (entrypoint invocation, property name) not caught until audit — could have been caught with a simple `--dry-run` test earlier
- Phase 52 SUMMARY also missing `requirements-completed` frontmatter — 3 phases with same metadata gap

### Patterns Established
- `createRequire` pattern for CJS-in-ESM imports — standard Node.js approach, avoids dual-package hazard
- zx `$` with `.nothrow()` for subprocess management — captures exit codes without throwing
- Entrypoint routing with `--legacy` flag — zero-risk migration with escape hatch
- `CONFIG_DEFAULTS` pattern: module-level defaults with config.json override via `getConfig(key, default)`

### Key Lessons
1. SUMMARY frontmatter gap persists into v2.3 (9th milestone) — truly systemic; Phase 53 gap closure fixed it retroactively
2. Integration testing (`--dry-run`) should happen in the same phase as implementation, not deferred to a later test phase
3. zx is a strong fit for orchestration scripts — provides shell ergonomics (`$`, `cd`, `argv`) with Node.js power (imports, async/await)
4. Legacy fallback preservation (`--legacy` flag) reduces migration risk to near-zero

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for sub-agents)
- Sessions: 16 plan executions across 7 phases (autopilot-driven)
- Notable: largest plan count tied with v1.6 (16 plans), completed in single day via autopilot

---

## Milestone: v2.4 — Autopilot Streaming

**Shipped:** 2026-03-13
**Phases:** 5 | **Plans:** 6 | **Commits:** 45

### What Was Built
- `runClaudeStreaming()` — consolidated function for all Claude CLI invocations with NDJSON parsing via readline async iteration
- `displayStreamEvent()` — real-time dispatch of assistant text to stdout and tool call indicators to stderr
- Stall detection timer with configurable interval (default 5 min), repeating warnings, and try/finally cleanup
- `--quiet` flag for buffered JSON fallback in CI/scripted environments
- Wired `runStep()`, `runStepCaptured()`, and all 3 debug retry invocations through `runClaudeStreaming()`
- Registered `autopilot.stall_timeout_ms` in config schema (CONFIG_DEFAULTS, KNOWN_SETTINGS_KEYS, validateSetting)
- VERIFICATION.md for phases 54 and 56 with codebase line evidence

### What Worked
- Well-scoped phases: each phase (core function → step wiring → debug retry → config → verification) had clear, atomic deliverables
- Phases 55 and 56 were independent after Phase 54 — could have run in parallel (executed sequentially, but unblocked)
- Config registration followed the established 3-touch-point pattern (CONFIG_DEFAULTS, KNOWN_SETTINGS, validate) — mechanical and fast
- Gap closure phase (58) was documentation-only — created VERIFICATION.md files, no code changes needed
- Entire milestone completed in 1 day with 45 commits — autopilot-driven execution
- Milestone audit passed clean on first run: 15/15 requirements, 15/15 integration, 3/3 E2E flows

### What Was Inefficient
- Phase 54 and 56 did not create VERIFICATION.md during execution — required Phase 58 gap closure (10th milestone with this pattern)
- ROADMAP progress table had formatting inconsistency for phases 54-58 (missing milestone column in individual phase rows)
- Summary files lacked `one_liner` field, requiring manual extraction from summary header text

### Patterns Established
- NDJSON streaming: `createInterface` wrapping `proc.stdout` for async for-await line iteration
- Stall timer: `setTimeout` with `.unref()` and try/finally cleanup, named function expression for re-arm
- Event dispatch: pure `displayStreamEvent()` with switch on `event.type`
- Consolidated invocation: single `runClaudeStreaming()` replaces all direct `$` template literal Claude CLI calls

### Key Lessons
1. VERIFICATION.md gap continues (10th milestone) — truly an embedded pattern that the current system doesn't enforce during execution
2. Consolidating scattered invocations into a single function dramatically simplifies subsequent integration (3 phases touched 1 function)
3. Named function expressions (onStall) are the correct pattern for timer re-arm in strict mode — avoids arguments.callee
4. Config registration is now a 2-minute mechanical task when following the 3-touch-point pattern established in v1.6

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for sub-agents)
- Sessions: 6 plan executions across 5 phases (autopilot-driven)
- Notable: fastest per-plan execution — ~2.3 min/plan average, likely due to well-scoped atomic phases

---

## Milestone: v2.5 — New-Milestone Auto Mode

**Shipped:** 2026-03-14
**Phases:** 5 | **Plans:** 6 | **Commits:** 30

### What Was Built
- `--auto` flag parsing with hybrid flag+config pattern and MILESTONE-CONTEXT.md > @file > inline > error context resolution
- Auto-skip branches at all 6 interactive decision points in new-milestone workflow (build-next, version, research, features, gaps, roadmap)
- Auto-chain from milestone creation into `/gsd:discuss-phase {N} --auto` with dynamic first phase resolution
- Brainstorm.md milestone route simplified from ~70 inline lines to SlashCommand delegation
- Gap closure: VERIFICATION.md for phases 59/61, SUMMARY.md for phase 59, fixed traceability metadata

### What Worked
- Pattern reuse from discuss-phase/plan-phase `--auto` behavior: same flag+config+persist pattern, same init integration
- Each phase had atomic, well-scoped deliverables: flag parsing → skip points → chain → brainstorm → gap closure
- SlashCommand delegation pattern for brainstorm→milestone handoff eliminated significant code duplication
- Gap closure (Phase 63) resolved all audit findings in one pass — 19/19 requirements satisfied after closure
- Milestone audit second pass promoted status from `gaps_found` → `tech_debt` (acceptable)
- Entire milestone completed in 1 day (30 commits)

### What Was Inefficient
- Phase 59 and 61 did not create VERIFICATION.md or SUMMARY.md during execution — required Phase 63 gap closure (11th milestone with this pattern)
- Phase 62 SUMMARY.md frontmatter was missing `requirements-completed` — caught by audit, fixed in Phase 63
- Two audit passes needed: first found 9 unsatisfied requirements + 4 partial; gap closure resolved all critical gaps

### Patterns Established
- Auto-mode detection pattern: flag parsing → config fallback → persist on first use (consistent with discuss/plan)
- Context resolution priority: MILESTONE-CONTEXT.md > @file > inline > error (deterministic, no ambiguity)
- Auto-chain pattern: resolve next phase dynamically via `phase find-next`, null-check, banner, SlashCommand
- SlashCommand delegation: workflow delegates to another workflow via `Exit skill and invoke SlashCommand(...)` pattern

### Key Lessons
1. VERIFICATION.md gap persists (11th of 13 milestones) — the only milestones without it are v2.1 (2 phases, TDD) and v2.4 (had it too actually); this is truly baked into the system
2. SlashCommand delegation is a powerful pattern for workflow composition — eliminates duplication and maintains single source of truth
3. The auto-mode flag+config+persist pattern is now battle-tested across 3 workflows (discuss, plan, new-milestone)
4. Context resolution priority ordering removes ambiguity from multi-source scenarios — worth establishing early for any multi-input workflow

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for sub-agents)
- Sessions: 6 plan executions across 5 phases
- Notable: workflow-only milestone (no new CJS code) — all changes were in .md workflow files and test files

---

## Milestone: v2.6 — Unified Validation Module

**Shipped:** 2026-03-17
**Phases:** 7 | **Plans:** 12

### What Was Built
- `validation.cjs` unified module with 21 checks across 4 categories (structure, state, navigation, readiness)
- Check registry pattern: `{ id, category, severity, check, repair? }` objects with category-filtered execution
- Atomic auto-repair for STATE.md drift (counts, status, missing directories) with independent try/catch per repair
- Consumer migration: CLI `gsd health`, autopilot pre-flight, and `gsd-tools validate` all delegate to `validateProjectHealth()`
- Legacy code mapping via `CHECK_ID_TO_LEGACY` preserving E001-E005, W003-W006 backward compatibility
- Test parameterization reducing 822 → 796 tests (within 800 budget)

### What Worked
- TDD workflow was effective: failing tests first, then implementation, caught shape mismatches early
- Auto-advance pipeline (discuss → plan → execute) completed phases 64-68 without manual intervention
- Check registry pattern made each phase mechanical: add checks to array, write tests, done
- Gap closure phases (69-70) cleanly resolved audit findings: verification artifacts + test budget + legacy mapping
- 3-source cross-reference (VERIFICATION + SUMMARY frontmatter + REQUIREMENTS traceability) caught all gaps systematically

### What Was Inefficient
- Phase 70 agent produced code changes but didn't create VERIFICATION.md — had to verify via self-check instead
- Phase 67 SUMMARY files initially lacked `requirements-completed` frontmatter — required Phase 69 gap closure
- Test count discrepancy: Phase 68 reported 750 but actual was 822 — caused by counting runtime tests vs static test definitions
- Auto-repair tests have 4 pre-existing failures that weren't caught before this milestone — need investigation

### Patterns Established
- Check registry pattern: extensible, filterable, self-documenting — reusable for any categorized validation
- `CHECK_ID_TO_LEGACY` mapping: clean way to evolve internal IDs while preserving backward-compatible output codes
- Test parameterization via `for...of` loops: same coverage, fewer test count, cleaner test files
- Category-filtered execution: consumers run only the checks they need (`{ categories: ['readiness'] }`)

### Key Lessons
1. Static test count (regex `test()` matches) and runtime test count (actual tests executed) can diverge significantly — use the tool's count, not manual assertions
2. VERIFICATION.md should be created during execute-phase, not deferred — this is the 12th milestone to need gap closure for missing verification
3. The auto-advance pipeline works well for infrastructure phases with clear success criteria — less well for gap closure phases that need manual verification
4. `KNOWN_SETTINGS_KEYS` duplication (validation.cjs vs cli.cjs) is a maintenance hazard — should have been resolved during migration, not deferred

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for sub-agents including integration checker and test steward)
- Sessions: 7 phase executions, 2 gap closure phases
- Notable: first milestone focused entirely on internal refactoring (validation module consolidation) — no new user-facing features

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
| v2.0 | 14 | 2 | First docs-only milestone — brainstorm-to-README pipeline, smallest scope yet |
| v2.1 | 16 | 2 | First zero-gap-closure milestone — clean audit pass, TDD + sed-based bash testing |
| v2.2 | 48 | 7 | PR review integration — pattern reuse from v1.4, file-proximity dedup, dual-path routing |
| v2.3 | 49 | 7 | Autopilot CJS consolidation — zx rewrite with direct CJS imports, legacy bash preserved |
| v2.4 | 45 | 5 | Autopilot streaming — NDJSON real-time output, stall detection, consolidated invocations |
| v2.5 | 30 | 5 | New-milestone auto mode — flag+config+persist pattern, 6 skip points, auto-chain, SlashCommand delegation |
| v2.6 | ~40 | 7 | Unified validation module — check registry pattern, 3 consumer migration, auto-repair, test parameterization |

### Top Lessons (Verified Across Milestones)

1. Gap closure phases are consistently valuable — found real issues in 13 of 14 milestones (v2.1 is only clean pass)
2. SUMMARY/VERIFICATION.md completeness was the #1 recurring audit gap — hit in 12 of 14 milestones; only v2.1 avoided it
3. Always create VERIFICATION.md during phase execution — retrofitting costs an extra gap closure phase (confirmed in 12 of 14 milestones)
4. Consistent handler patterns (gatherXData/handleX) make adding new features mechanical and fast
5. Portable paths (`@~/.claude/...`) should be the default — absolute paths are a recurring defect (v1.4)
6. In-place workflow extension (adding steps to existing file) keeps single source of truth — proven in v1.5, v1.6, v2.2
7. Config-gated features with zero-config degradation enable progressive adoption without breaking existing projects (v1.6)
8. Brainstorm design docs serve as effective content blueprints — execution becomes mechanical when design is pre-approved (v2.0, v2.1)
9. TDD + structural grep tests provide strong verification for bash function wiring without requiring live CLI invocations (v2.1)
10. Pattern reuse across milestones (v1.4 → v2.2) dramatically accelerates development — similar features share scoring, routing, and delegation patterns
11. Integration testing (`--dry-run`) should happen immediately after implementation, not deferred to a later phase (v2.3 — real bugs caught only at audit time)
12. Consolidating scattered invocations into a single function simplifies subsequent integration phases — each new consumer just calls the one function (v2.4)
13. SlashCommand delegation eliminates workflow duplication — proven in v2.5 where brainstorm→milestone handoff dropped ~70 lines to 3 lines
14. Auto-mode flag+config+persist pattern is now battle-tested across 3 workflows (discuss, plan, new-milestone) — consistent UX for autonomous execution
15. Check registry pattern (`{ id, category, severity, check, repair? }`) enables extensible, filterable validation — proven in v2.6 with 21 checks across 4 categories
16. Static vs runtime test counts can diverge — always use the tooling's count, not manual assertions from execution summaries
