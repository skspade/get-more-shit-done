# Phase 33: Test Steward - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Long-term test suite health is actively managed through a dedicated steward agent. The steward detects redundancy, enforces budgets, proposes consolidation (never auto-applies), and feeds budget awareness to the planner. A new `/gsd:audit-tests` command provides on-demand health checks independent of milestone audits.

</domain>

<decisions>
## Implementation Decisions

### Steward Agent Architecture (STEW-01)
- `gsd-test-steward` is a new agent file in `agents/` following the existing agent pattern (name, description, tools, color frontmatter + role/process/output sections)
- During audit-milestone, the steward is spawned as a Task with subagent_type="gsd-test-steward" and its findings appear in the audit report
- Agent model uses the same tier as gsd-plan-checker and gsd-integration-checker (verification-class work)
- Agent is read-only analysis -- no file modifications, only produces a markdown report (Claude's Decision: consistent with design doc invariant "steward NEVER auto-deletes or auto-modifies tests")
- Agent receives test file paths, test budget config, and project test count data as input (Claude's Decision: these are the minimum inputs needed for all three analysis dimensions)

### Redundancy Detection (STEW-02)
- Steward identifies duplicate assertions (same function, same inputs, different test names), overlapping test coverage (integration test covering what unit tests already test), and stale tests referencing deleted code
- Stale test detection checks whether functions/files referenced in test assertions still exist in the codebase (Claude's Decision: file/function existence is the most reliable staleness signal without AST parsing)
- Redundancy analysis works by reading test file contents and comparing assertion patterns across files (Claude's Decision: regex-based comparison is consistent with testing.cjs counting approach and avoids framework-specific AST dependencies)

### Consolidation Proposals (STEW-03)
- Four specific consolidation strategies: parameterize, promote, prune, merge
- Each proposal includes: source test location(s), target action, rationale, and estimated test count reduction
- All proposals require human approval -- steward never auto-applies changes
- Proposals are written as a markdown report section, not as executable commands (Claude's Decision: markdown is reviewable and durable; executable commands risk unintended side effects)

### Budget Enforcement (STEW-04)
- Per-phase budget default: 50 tests; project budget default: 800 tests (from config.cjs TEST_CONFIG_DEFAULTS already implemented in Phase 30)
- Budget counting uses `countTestsInProject()` from testing.cjs for project totals and `countTestsInProject(cwd, { phase: N })` for per-phase counts
- Budget overruns are surfaced as warnings (not blockers) during plan-phase and audit (from ROADMAP success criteria 4)
- Warning threshold at 80% of budget (Claude's Decision: 80% matches design doc warn_at_percentage default and gives planner advance notice before hitting the limit)

### Planner Budget Integration (STEW-05)
- During plan-phase, the planner receives current budget status so it can generate test plans within the remaining allocation
- Budget status is injected into the planner prompt by the plan-phase orchestrator (Claude's Decision: orchestrator-level injection follows the existing pattern where plan-phase constructs the planner prompt with context data)
- Budget status includes: current project test count, project budget, current phase test count (if tests exist), per-phase budget, and warning/overage status (Claude's Decision: planner needs both counts and thresholds to make informed test planning decisions)
- Plan-phase calls `gsd-tools.cjs test-count` and `gsd-tools.cjs test-config` to gather budget data before spawning the planner (Claude's Decision: reuses existing CLI commands rather than adding new ones)

### Audit-Tests Command (STEW-06)
- New `/gsd:audit-tests` command spec in `commands/gsd/audit-tests.md` following existing command spec pattern (frontmatter with name, description, allowed-tools)
- Command spawns the gsd-test-steward agent directly for on-demand health checks without requiring a full milestone audit
- No arguments required -- operates on the current project's test suite (Claude's Decision: simplest UX; no phase/milestone scoping needed for a health check)
- Output is a test health report covering redundancy, staleness, and budget status

### Audit-Milestone Integration (STEW-01)
- Modify `audit-milestone.md` workflow to spawn gsd-test-steward between step 3 (integration checker) and step 4 (collect results)
- Steward findings appear in the MILESTONE-AUDIT.md report as a dedicated "Test Suite Health" section (Claude's Decision: separate section keeps test health visible without mixing into requirements/integration sections)
- Steward is only spawned when `test.steward` config key is true (default true, from Phase 30 config)
- If steward is disabled or no test files exist, the step is silently skipped (Claude's Decision: graceful degradation matches project-wide pattern)

### Config Schema
- `test.steward` key already exists as a boolean (true/false) in config.cjs and testing.cjs
- The design doc proposed a richer `steward` object with `enabled`, `redundancy_threshold`, `stale_threshold`, `auto_consolidate` sub-keys, but the implemented config uses a simple boolean (Claude's Decision: keep the simple boolean for v1.6 since auto_consolidate is explicitly deferred and threshold tuning is premature)
- `test.budget.per_phase` (50) and `test.budget.project` (800) are already in config.cjs -- no config changes needed

### Claude's Discretion
- Internal prompt structure and reasoning flow within the gsd-test-steward agent
- Exact regex patterns for detecting duplicate assertions vs similar-but-different tests
- How the steward report is formatted within the MILESTONE-AUDIT.md (table vs list vs subsections)
- Staleness detection depth (whether to check import references, function calls, or file paths)
- Agent color choice for gsd-test-steward frontmatter
- Order of analysis steps within the steward (budget check, redundancy scan, staleness scan)
- Whether budget status in planner prompt uses a structured block or inline text

</decisions>

<specifics>
## Specific Ideas

- Design doc specifies four consolidation strategies precisely: Parameterize (multiple tests with same logic, different inputs -> 1 parameterized), Promote (unit tests fully covered by integration test -> keep integration), Prune stale (references deleted code -> remove), Merge files (>5 test files for related functionality -> consolidate)
- Design doc states consolidation triggers: per-phase budget exceeded by >20%, project budget at or above 100%, redundancy ratio >15%, stale test ratio >5%
- The steward model should match plan-checker/integration-checker tier (sonnet in balanced profile, as shown in model-profiles.md)
- Budget status format from design doc: "Warning: 160/200 tests used" -- planner should see a similar concise format
- Human approval flow from design doc: "Approve all", "Cherry-pick", or "Reject" -- for v1.6 this is advisory-only (proposals in the audit report, not an interactive approval flow)
- PROJECT.md requirements mention "per-phase (30) and project (200)" but ROADMAP success criteria and config.cjs implementation use per-phase 50 and project 800 -- follow the implemented values

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `testing.cjs`: `countTestsInProject()` provides project-wide and per-phase test counts -- steward uses this for budget checking
- `testing.cjs`: `getTestConfig()` returns merged config with budget defaults -- steward reads budget thresholds from this
- `testing.cjs`: `findTestFiles()` discovers all test files in the project -- steward iterates these for redundancy/staleness analysis
- `testing.cjs`: `countTestsInFile()` provides per-file counts -- useful for identifying over-large test files
- `config.cjs`: `cmdConfigGet()` with dot-notation -- steward can read `test.steward` to check if enabled
- `core.cjs`: `output()`/`error()` for consistent CLI output formatting -- any new CLI commands use these
- `gsd-tools.cjs`: Dispatcher pattern with switch/case routing -- `audit-tests` would route here if a CLI entry point is needed

### Established Patterns
- Agent files in `agents/` with frontmatter (name, description, tools, color) + structured XML sections (role, process, output)
- Command specs in `commands/gsd/` with frontmatter (name, description, argument-hint, allowed-tools) + objective/execution_context/context/process sections
- Workflows in `get-shit-done/workflows/` contain multi-step processes that spawn agents via Task()
- Model resolution via `gsd-tools.cjs resolve-model {agent-type} --raw`
- Verification-class agents (plan-checker, integration-checker) use sonnet in balanced profile
- Audit-milestone spawns specialized agents with Task() and collects their output for the audit report

### Integration Points
- `agents/gsd-test-steward.md`: New agent file (steward agent definition)
- `commands/gsd/audit-tests.md`: New command spec for `/gsd:audit-tests`
- `get-shit-done/workflows/audit-milestone.md`: Add steward spawn step between integration checker and result collection
- `get-shit-done/workflows/plan-phase.md`: Add budget status gathering and injection into planner prompt
- `get-shit-done/references/model-profiles.md`: Add `gsd-test-steward` to the model profile table
- `get-shit-done/bin/lib/core.cjs`: Add `gsd-test-steward` to MODEL_PROFILES mapping (if model resolution is needed)

</code_context>

<deferred>
## Deferred Ideas

- Auto-consolidation without human approval (`steward.auto_consolidate` remains false) -- explicitly deferred per REQUIREMENTS.md
- Richer steward config object with `redundancy_threshold`, `stale_threshold` sub-keys -- simple boolean is sufficient for v1.6
- Interactive approval flow for consolidation proposals (approve all / cherry-pick / reject) -- proposals are advisory in the audit report for v1.6
- Coverage percentage targets and code coverage tools integration -- out of scope per REQUIREMENTS.md
- Per-file test-to-code mapping -- deferred per REQUIREMENTS.md
- Visual test reports (HTML/dashboard output) -- out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 33-test-steward*
*Context gathered: 2026-03-05 via auto-context*
