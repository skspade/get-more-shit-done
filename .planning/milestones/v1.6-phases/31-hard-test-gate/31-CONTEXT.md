# Phase 31: Hard Test Gate - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Every task commit during execute-plan is verified against the full test suite so regressions are caught immediately. The gate is TDD-aware (skipping regression checks on intentional RED commits), baseline-aware (only blocking on NEW failures), and context-friendly (summarizing output to pass/fail counts and failure details only). This phase modifies the execute-plan workflow and adds test-running capabilities to testing.cjs.

</domain>

<decisions>
## Implementation Decisions

### Gate Placement and Trigger
- Gate runs after each task commit during execute-plan, between the `task_commit` step and the next task (from ROADMAP success criteria 1)
- Gate is controlled by the `test.hard_gate` config key, defaulting to true (from Phase 30 config schema)
- When hard_gate is false or no test command is detected, the gate is silently skipped -- execute-plan proceeds as before (from REQUIREMENTS.md zero-config degradation pattern)
- Gate is a workflow-level instruction in execute-plan.md, not a git hook or external script (Claude's Decision: workflow instructions are how GSD controls executor behavior -- consistent with existing architecture)

### Test Execution
- Add a `cmdTestRun` function to testing.cjs that executes the configured test command and returns structured results (Claude's Decision: centralizes test execution in the same module that handles counting and config)
- Test command resolution: use `test.command` from config if set, otherwise auto-detect via `getTestConfig()` which already resolves framework to command (from Phase 30 testing.cjs pattern)
- Capture stdout/stderr from test process but do NOT stream raw output -- only the summarized result is returned (from REQUIREMENTS.md GATE-05)
- Use `child_process.execSync` or `execFileSync` with captured output, matching the pattern in run-tests.cjs (Claude's Decision: synchronous execution is correct since gate must block before next task)

### TDD RED Commit Detection (GATE-03)
- Gate recognizes TDD RED commits by the commit message convention: `test({phase}-{plan}): add failing test for [feature]` (from execute-plan.md TDD execution section and tdd.md reference)
- Detection checks the most recent commit message for the `test(` prefix commit type (Claude's Decision: commit message convention is already established and enforced -- simplest reliable signal)
- When a TDD RED commit is detected, the gate skips regression checking entirely and logs "TDD RED commit detected -- gate skipped" (from ROADMAP success criteria 3)

### Baseline Capture and Comparison (GATE-04)
- Capture a test baseline at the start of plan execution (before any tasks run) by running the test suite once and recording the result (from ROADMAP success criteria 4)
- Baseline stores: total tests, pass count, fail count, and list of failing test names/identifiers (Claude's Decision: failing test names are needed to distinguish pre-existing from new failures)
- After each task commit, compare current failures against baseline failures -- only NEW failures (not in baseline) trigger the gate block (from REQUIREMENTS.md GATE-04)
- Baseline is stored in-memory during executor context -- it does not persist to disk between sessions (Claude's Decision: baseline is only meaningful within a single plan execution; disk persistence would add stale-state risk)
- If baseline capture itself fails (no test command, test framework not found), the gate is disabled for this plan execution with a warning (Claude's Decision: graceful degradation matches project-wide error handling philosophy)

### Failure Handling (GATE-02)
- When the gate detects new test failures, the executor follows existing deviation Rule 1 (Bug: Fix -> test -> verify -> track) (from ROADMAP success criteria 2 and execute-plan.md deviation rules)
- The gate presents the failure summary to the executor with the instruction to debug and fix before proceeding (Claude's Decision: aligns with existing deviation rule auto-fix pattern)
- After a fix attempt, the gate re-runs the test suite to verify the fix resolved the new failures (Claude's Decision: gate must verify the fix actually works before allowing next task)
- If retries are exhausted within the executor context, escalation follows the existing autopilot debug-retry pattern in autopilot.sh (from ROADMAP success criteria 2 referencing "escalates to human after retries exhausted")
- Gate retry limit uses the same configurable max from autopilot (default 3) (Claude's Decision: consistent retry semantics across the system)

### Output Summarization (GATE-05)
- Test output is summarized to: total tests, passed count, failed count, and for failures only: test name + first line of error message (from ROADMAP success criteria 5)
- Raw test output (potentially hundreds of lines) is never shown to the executor (from REQUIREMENTS.md GATE-05 "preventing context window bloat")
- Summary format is a structured object from cmdTestRun, formatted as a short text block for the executor prompt (Claude's Decision: structured data enables both JSON and human-readable output)
- Parse test output using framework-specific result parsing where possible, falling back to exit-code-only summary (Claude's Decision: exit code 0 = all pass is universal; detailed parsing is best-effort)

### Workflow Integration
- Modify execute-plan.md to add a `<test_gate>` section after `<task_commit>` that instructs the executor to run the gate (Claude's Decision: new workflow section keeps gate logic co-located with commit protocol)
- The gate instruction tells the executor to call `gsd-tools.cjs test-run` and evaluate the result (Claude's Decision: gsd-tools dispatch is the established pattern for executor-to-tooling communication)
- Add `test-run` command to gsd-tools.cjs dispatcher routing to testing.cjs (Claude's Decision: follows existing test-count/test-config routing pattern)

### Claude's Discretion
- Exact regex or parsing approach for extracting failure details from test runner output
- Internal structure of the baseline comparison logic
- Exact wording of gate pass/fail messages shown to executor
- Whether baseline is a simple object or a class instance
- Order of checks in the gate (config check, TDD check, baseline comparison)

</decisions>

<specifics>
## Specific Ideas

- TDD RED commit convention is already established: `test({phase}-{plan}): add failing test for [feature]` -- the gate must recognize this exact pattern
- Deviation Rule 1 (Bug) is the existing auto-fix mechanism: "Fix -> test -> verify -> track `[Rule 1 - Bug]`" -- the gate failure should trigger this same flow
- The executor spawns as a subagent in Pattern A (most common) -- gate instructions must work within the subagent context, not just main context
- `getDefaultCommand()` in testing.cjs already maps framework to command string (vitest -> `npx vitest run`, jest -> `npx jest`, etc.) -- test-run should reuse this
- The project uses `node:test` framework with `scripts/run-tests.cjs` as the wrapper -- this is also the test setup the gate will validate against

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `testing.cjs`: Already has `getTestConfig()` which resolves test command and framework -- test-run builds on this
- `testing.cjs`: `detectFramework()` and `getDefaultCommand()` provide test command resolution
- `run-tests.cjs`: Reference implementation showing how this project runs its own tests (node --test with file discovery)
- `core.cjs`: `output()`/`error()` for consistent CLI output formatting
- `gsd-tools.cjs`: Dispatcher pattern for routing `test-run` command

### Established Patterns
- `gatherXData`/`handleX` pattern for CLI commands -- test-run follows this
- `cmdTestCount`/`cmdTestDetectFramework`/`cmdTestConfig` exported function naming -- `cmdTestRun` follows
- Config defaults with zero-config degradation -- gate disabled when no test command available
- execute-plan.md uses XML sections for protocol steps (`<task_commit>`, `<deviation_rules>`, `<tdd_plan_execution>`)

### Integration Points
- `execute-plan.md`: New `<test_gate>` section inserted after `<task_commit>` section
- `gsd-tools.cjs`: Add `test-run` case to dispatcher switch statement (line ~601 area, near existing test-* cases)
- `testing.cjs`: Add `cmdTestRun` function and supporting test execution/parsing logic
- `config.cjs`: test.hard_gate default already exists (line 62) -- no config changes needed

</code_context>

<deferred>
## Deferred Ideas

- Framework-specific output parsers for structured failure extraction (TAP, JUnit XML) -- exit-code-based summary is sufficient for v1.6
- Persistent baseline across sessions (disk-based) -- in-memory per-plan-execution is simpler and avoids stale state
- Configurable gate retry limit separate from autopilot debug retries -- single retry semantic is cleaner
- Parallel test execution or test subset running -- full suite is the gate requirement
- Test result caching to avoid redundant runs -- each commit needs a fresh run

</deferred>

---

*Phase: 31-hard-test-gate*
*Context gathered: 2026-03-05 via auto-context*
