# Domain Pitfalls: Dual-Layer Test Architecture for GSD Autopilot

**Domain:** Adding test-first enforcement and test management to an existing autonomous AI agent orchestration system
**Researched:** 2026-03-05
**Overall confidence:** HIGH (grounded in existing codebase analysis, design doc review, and industry research on agentic test gates)

---

## Critical Pitfalls

Mistakes that cause rewrites, stall autonomous execution, or undermine the value of the test architecture.

---

### Pitfall 1: Pre-Existing Test Failures Block the Hard Gate on Day One

**What goes wrong:**
The hard gate design says "full suite must pass after each task commit." The GSD codebase has 2 known pre-existing test failures (codex-config.test.cjs and config.test.cjs, documented in PROJECT.md). The moment the hard gate activates, every single task commit triggers a test failure, sends the executor into Rule 1 deviation handling, spawns the debugger, and either (a) the debugger "fixes" the pre-existing failures by changing tests to match current behavior (silently modifying test semantics), or (b) the debugger exhausts retries and escalates to human every single task. The entire autonomous execution pipeline grinds to a halt on the first task of the first phase.

**Why it happens:**
The design doc assumes `test.command` runs clean (exit 0) on the current codebase. But any real project accumulated before test gates existed will have broken, skipped, or flaky tests. The design's backward compatibility says "projects without test.command: test gates skipped." But once `test.command` is set, there is no concept of a baseline -- every failure is treated as a regression.

**Consequences:**
- Autonomous execution completely stalled on every task
- Debug-retry loop burns through retries on unfixable pre-existing failures
- If debugger "fixes" pre-existing failures, it modifies test semantics without understanding the original intent
- Users who enable the hard gate immediately lose trust when it blocks on problems they already know about

**Prevention:**
1. **Baseline snapshot on first activation.** When `test.command` is first configured (or hard gate first enabled), run the suite once and record the baseline failure set: test names and their failure signatures. Store in `config.json` under `test.baseline_failures` or a separate `.planning/test-baseline.json`.
2. **Gate logic compares against baseline.** The hard gate fails only when NEW failures appear (failures not in the baseline). Pre-existing failures are logged as warnings but do not block.
3. **Baseline cleanup as explicit action.** Provide a `gsd test-baseline --refresh` CLI command so users can update the baseline after fixing pre-existing failures. The test steward should also flag baseline failures as tech debt during audit.
4. **First activation validation.** When `test.command` is first set via settings, immediately run it and report: "Found N passing, M failing tests. M failures will be baselined. Hard gate will block only on NEW failures."

**Detection (warning signs):**
- Hard gate triggers on the very first task commit after enabling
- Debug-retry immediately exhausts retries on test failures
- Executor SUMMARY.md shows deviation rules firing for "test suite regression" that existed before the phase started
- Users disable the hard gate within one phase because it "doesn't work"

**Phase to address:** Phase 1 (hard gate in execute-plan). This is the foundation -- if the gate blocks on pre-existing failures, nothing downstream works. Baseline capture must ship with the gate itself.

**Confidence:** HIGH -- directly observed: the current codebase has 2 failing tests (config key count assertion, default value assertion). Any hard gate implementation will hit this immediately.

---

### Pitfall 2: Hard Gate Creates Infinite Debug-Retry Loops on Flaky or Environment-Dependent Tests

**What goes wrong:**
The hard gate runs `npm test` after every task commit. Some tests are flaky (pass 80% of the time) or environment-dependent (pass on CI but fail locally, or vice versa). The executor commits a task, runs the suite, a flaky test fails, the executor enters Rule 1 deviation handling, the debugger investigates, finds no code-related cause, "fixes" something unrelated, retries, the flaky test passes this time, execution continues. Next task commit: the same flaky test fails again. Another debug cycle. This compounds per task -- if a phase has 8 tasks and a test is flaky at 20% failure rate, statistically 1-2 tasks per phase will trigger unnecessary debug cycles.

Worse: the debugger may "fix" the flaky test by adding retries, sleep delays, or weakening assertions -- silently degrading test quality.

**Why it happens:**
Meta's 2026 research on JiT Testing identifies this exact scaling problem: "Agentic development dramatically increases the pace of code change, straining test development burden and scaling the cost of false positives and test maintenance to breaking point." The hard gate converts every flaky failure into a blocking event with a debug cycle cost of 2-5 minutes per incident. With per-task gating, the blast radius is multiplied by task count.

The current execute-plan workflow (see deviation Rule 1) treats all test failures as bugs to fix. There is no concept of "this failure is transient, retry the test suite without changing code."

**Consequences:**
- Autonomous execution time inflates 2-5x from debug cycles on non-issues
- Debugger introduces unnecessary "fixes" that degrade test reliability
- Trust in the hard gate erodes ("it always fails, then passes on retry")
- Context budget consumed by debug prompts instead of actual implementation

**Prevention:**
1. **Test retry before debug.** Before invoking the debugger, re-run the failing tests (not the full suite -- just the failures) up to 2 times. If they pass on retry, log as "flaky: [test name]" and continue. Do NOT enter deviation handling for transient failures.
2. **Flaky test tracking.** Maintain a flaky test log (`.planning/test-flaky.json`) that records tests that passed on retry. The test steward should surface these during audit as reliability issues requiring investigation.
3. **Environment guard.** Before the first hard gate invocation in a phase, verify the test environment is stable: run the suite once as a pre-flight check. If it fails before any code changes, the failures are environment-dependent, not regressions.
4. **Differentiate test failure from code failure.** If the failing tests have zero overlap with files modified in the current task (checked via `git diff --name-only`), classify as "unrelated test failure" and apply a lighter-weight response (warn, log, continue) rather than full debug-retry.

**Detection (warning signs):**
- Same test fails intermittently across different task commits
- Debug-retry fixes involve `setTimeout`, `retry`, or weakened assertions rather than real code fixes
- A phase that should take 30 minutes takes 2+ hours due to test-related debug cycles
- Flaky test log grows faster than the test suite itself

**Phase to address:** Phase 1 (hard gate in execute-plan). The retry-before-debug logic must be part of the gate implementation, not bolted on after users complain. This is a design decision for the gate itself.

**Confidence:** HIGH -- flaky test problems are well-documented across the industry. Meta's JiT Testing paper, JetBrains' flaky test research, and the agentic CI community all identify per-commit test gates as a flakiness amplifier.

---

### Pitfall 3: Acceptance Test Verify Commands Are Brittle Shell One-Liners

**What goes wrong:**
The design specifies acceptance tests with a `Verify` line containing a shell command:
```
- Verify: `test -f .planning/PROJECT.md && grep -q "Core Value" .planning/PROJECT.md`
```
These shell one-liners are fragile. They break on: path changes, content reformatting, OS differences (macOS grep vs GNU grep flags), timing issues (file not flushed yet), encoding differences, and whitespace sensitivity. A refactor that moves a file from `src/utils.js` to `src/lib/utils.js` causes acceptance tests to fail despite the feature working correctly. The verify-phase then reports `gaps_found`, triggering gap-closure cycles for a non-issue.

The failure mode is especially insidious in autonomous execution: the autopilot sees an acceptance test failure, runs gap closure, the gap closure planner reads the acceptance test literally ("file must be at src/utils.js"), creates a plan to move the file back, execution moves the file, but now the actual implementation references from `src/lib/utils.js` break. The system oscillates between fixing the acceptance test and fixing the imports.

**Why it happens:**
Shell commands encode implementation details (file paths, string content, command flags) into what should be behavioral specifications. The Given/When/Then describes behavior; the Verify line hardcodes implementation. When the implementation evolves during execution (deviation rules, refactoring), the Verify command breaks even though the behavior is correct.

The discuss-phase generates these Verify commands at the start of the phase, before execution reveals the actual file structure and naming patterns the executor will use.

**Consequences:**
- Acceptance tests fail on refactors that do not change behavior
- Gap-closure loops triggered for false verification failures
- Oscillating fixes between acceptance test expectations and actual implementation
- Human loses trust in acceptance test layer ("it keeps failing on things that work")
- In autopilot mode, gap closure cycles burn time and context on non-issues

**Prevention:**
1. **Pattern-based verification over path-literal verification.** Verify commands should use glob patterns and content patterns rather than exact paths: `find .planning -name "PROJECT.md" | xargs grep -q "Core Value"` instead of `test -f .planning/PROJECT.md && grep -q "Core Value" .planning/PROJECT.md`.
2. **Verification helper library.** Instead of raw shell commands, provide a small set of reusable verification functions in gsd-tools.cjs: `gsd-tools verify file-contains --pattern "*.PROJECT.md" --content "Core Value"`, `gsd-tools verify command-succeeds --cmd "npm test"`, `gsd-tools verify endpoint-responds --url "/api/health" --status 200`. These absorb path resolution, retry logic, and cross-platform differences.
3. **Verify command validation during discuss-phase.** When writing acceptance tests to CONTEXT.md, actually run each Verify command to confirm it establishes a correct baseline. If it fails before any implementation, it is already wrong.
4. **Late-binding verification.** Allow the executor to update Verify commands during execution when file paths or structures change, with a documented reason. The acceptance test Given/When/Then remains human-owned, but the Verify line is an implementation detail that can adapt.

**Detection (warning signs):**
- Acceptance tests fail on phases where the executor reports "all tasks complete, all deviations documented"
- Verify command failures reference specific file paths that moved during execution
- Gap-closure plans involve moving files or renaming things to match acceptance test expectations
- Multiple acceptance tests fail simultaneously after a refactoring deviation

**Phase to address:** Phase 2 (acceptance test layer in discuss-phase) for the format design and verification helper library. Phase 3 (verify-phase integration) for the execution-time validation and late-binding mechanism.

**Confidence:** HIGH -- this is a first-principles analysis of the design doc's acceptance test format. Shell command brittleness is a well-known problem in integration testing.

---

### Pitfall 4: Test Budget Thresholds Are Wrong in Practice -- 30 Per Phase / 200 Total

**What goes wrong:**
The design proposes `max_tests_per_phase: 30` and `max_total_tests: 200`. These numbers will be wrong for GSD specifically. The existing codebase already has 16 test files. A back-of-envelope count of `it()` / `test()` blocks in those files likely puts the current test count above 100. Adding test gates means every new phase adds tests. With the v1.6 milestone alone having 6+ planned phases, and each generating unit tests for testable tasks, the 200-test project budget could be reached by the third or fourth milestone after adoption.

When the budget is hit: the planner receives "Warning: 200/200 tests used" and must either consolidate before adding new tests or justify overage. In autonomous mode, this creates a blocking decision point. The planner either (a) skips writing tests to stay within budget (defeating the purpose), (b) generates a consolidation plan inline (scope creep within the planning phase), or (c) exceeds the budget and flags a warning that nobody addresses because there is no human in the loop until verification.

**Why it happens:**
The budget numbers are intuitive guesses, not empirically derived. The 30-per-phase limit assumes phases are roughly equal in complexity. But GSD phases vary enormously: a phase that adds a CLI command with 5 subcommands might genuinely need 40+ tests, while a documentation phase needs 0. The 200-total limit assumes a project lifecycle of roughly 7 milestones with 30 tests each, but large projects (like GSD itself at 29 phases across 6 milestones) will blow past this.

**Consequences:**
- Budget warnings appear constantly, becoming noise that is ignored
- Planner generates fewer tests to stay within budget, reducing coverage
- Test steward consolidation proposals pile up without human review (in autopilot mode)
- Budget enforcement creates perverse incentives: parameterized tests to game the count rather than genuinely consolidate

**Prevention:**
1. **Calibrate defaults from actual codebase.** On first activation, count existing tests and set the project budget to `existing_count * 3` (room to triple the test suite) with per-phase at `existing_count * 0.3` (any single phase can add up to 30% of the current suite). This gives adaptive defaults.
2. **Soft warnings over hard limits.** The budget should NEVER block test creation. It should warn during planning and flag during audit. A hard test budget creates perverse incentives; a soft budget creates awareness. The planner can exceed with justification; the steward reviews at audit.
3. **Phase-type-aware budgets.** Infrastructure phases get higher budgets (they introduce frameworks and foundation code). Feature phases get standard budgets. Documentation and config phases get lower budgets. The per-phase budget should be a function of phase type, not a flat number.
4. **Count method precision.** The design's grep-based counting (`grep -r -c "it(\|test("`) will miscount: it catches test helper functions named `testHelper(`, string literals containing `test(`, and TypeScript generics like `function test<T>(`. Use AST-aware counting or at minimum filter to test files only (already partially addressed with `--include` patterns).

**Detection (warning signs):**
- Budget warning appears in the first milestone after adoption
- Planner starts writing parameterized tests primarily to reduce count rather than improve design
- Per-phase budget is hit on phases with genuinely complex logic
- Test steward consolidation proposals consistently recommend "merge N tests into 1 parameterized" with no real quality gain

**Phase to address:** Phase 4 (test steward / budget enforcement). The steward implementation should calibrate defaults dynamically. But the config schema design in Phase 1 should establish soft-limit semantics from the start.

**Confidence:** MEDIUM -- the budget numbers are specifically called out as "conservative defaults" in the design doc, suggesting the author already suspects they may need adjustment. The directional analysis (too low for GSD's scale) is HIGH confidence based on the existing 16 test files.

---

### Pitfall 5: Test Redundancy Detection Produces False Positives That Erode Trust

**What goes wrong:**
The test steward's redundancy detection analyzes test files for "duplicate assertions (same function, same inputs, different test names)" and "overlapping coverage." Research on automated test redundancy detection shows that coverage-based approaches produce false positives approximately 50% of the time -- detecting non-redundant tests as redundant. In the GSD context, two tests might call the same function with similar inputs but test fundamentally different behavioral properties (one tests the return value, the other tests a side effect). The steward flags them as redundant, proposes consolidation, and if the human approves without careful review (likely in a long audit report), a real test is removed.

This is especially dangerous because the steward runs during milestone audit, which is a high-cognitive-load review point. The human is reviewing requirements coverage, integration checks, and test health simultaneously. Consolidation proposals buried in a long audit report get rubber-stamped.

**Why it happens:**
The design's redundancy detection uses surface-level heuristics: same function calls, same inputs, similar test names. But tests that look similar at the syntax level may test different behavioral contracts. Academic research (Koochakzadeh 2010, van Beek 2023) confirms that "the fact that two test cases may cover the same part of a system according to one coverage criterion but not the other causes impreciseness in detection."

The design's 0.15 redundancy threshold (flag when 15%+ of tests overlap) amplifies this: a false positive rate of even 30% on the detection means nearly half the consolidation proposals are wrong.

**Consequences:**
- Valid tests removed based on false redundancy detection
- Coverage decreases silently (the removed test was protecting a real behavior)
- Human stops reviewing consolidation proposals carefully ("the steward's always wrong")
- Eventually a regression ships because the protective test was "consolidated away"

**Prevention:**
1. **Conservative default: detection only, no proposals.** The steward's first version should ONLY report potential redundancy metrics, not propose specific consolidations. Let it build a track record. Proposals come in v2 after the detection accuracy is validated.
2. **Require behavioral justification, not just syntactic similarity.** Redundancy detection should require that two tests have the same inputs AND the same assertions AND test the same module. If any of these differ, they are not redundant regardless of how similar the code looks.
3. **Never consolidate across test files.** Two tests in different files, even if they look similar, likely test different integration paths. Redundancy detection should be scoped to within a single test file.
4. **Present proposals separately from the audit report.** Do not bury consolidation proposals in the milestone audit. Create a separate test health report that requires explicit review. This prevents rubber-stamping during a cognitively loaded audit process.
5. **Track consolidation outcomes.** If a consolidated test set later produces a regression (a test that was removed would have caught the bug), log it as a steward false positive. Use this feedback to tune detection thresholds.

**Detection (warning signs):**
- Steward proposes consolidating tests that have different assertion types (one uses `assert.equal`, another uses `assert.throws`)
- Consolidation proposals consistently target the newest tests (they look similar to existing tests because they test similar-but-different behaviors in new code)
- Human approves all proposals without individual review
- Regressions appear in areas where tests were recently consolidated

**Phase to address:** Phase 4 (test steward). The steward implementation must start conservative (report metrics, not proposals) and only graduate to proposals after the detection accuracy is validated across at least one full milestone.

**Confidence:** HIGH -- the 50% false positive rate for coverage-based redundancy detection is from peer-reviewed research (Koochakzadeh & Garousi, 2010). The design's heuristic-based approach will perform similarly or worse.

---

### Pitfall 6: Hard Gate + Autonomous Execution = Context Budget Death Spiral

**What goes wrong:**
The execute-plan workflow spawns subagent executors with fresh context per plan. The hard gate adds a test suite run after every task commit. When a test fails, the executor enters Rule 1 deviation handling, which reads error output, analyzes it, attempts a fix, and re-runs. Each debug cycle consumes context: the test output (potentially thousands of lines for a full suite run), the analysis, the fix attempt, the re-run output. A plan with 6 tasks and 2 test failures burns through context on test diagnosis rather than implementation.

The design says the executor should run the "full project test suite" after each task. If the project has 200 tests and a 30-second runtime, that is 6 tasks x 30 seconds = 3 minutes of test output per plan. But in the context budget, test output is TEXT -- potentially 500+ lines per run. Six runs = 3000+ lines of test output in the executor's context window, displacing the actual plan instructions and implementation context.

**Why it happens:**
The execute-plan workflow was designed with per-task commits but no per-task test suite runs. Adding a full suite run after every task is a linear multiplier on context consumption. The deviation handling was designed for occasional bugs, not systematic test-gate integration where failures are expected (flaky tests, pre-existing failures, or tests for future tasks that have not been implemented yet).

**Consequences:**
- Executor context fills with test output, degrading implementation quality in later tasks
- Tasks near the end of a long plan receive worse implementation because the executor has less context headroom
- Debug cycles for test failures compound: each cycle adds more test output to context
- In extreme cases, the executor hits context limits and fails mid-plan

**Prevention:**
1. **Summarize test output, do not include raw output.** The hard gate should capture test results as structured data (pass/fail count, list of failing test names, first failure message only) rather than piping raw test runner output into the executor's context. A `gsd-tools test-run --summary` command that runs tests and returns JSON (`{"passed": 195, "failed": 2, "failures": [{"name": "...", "message": "..."}]}`) keeps context minimal.
2. **Run only affected tests per task, not the full suite.** After each task commit, run tests in files that are related to the changed files (same directory, same module, or explicitly mapped). Run the full suite only at plan completion (the regression gate) or at phase verification. This dramatically reduces per-task test execution time and context consumption.
3. **Separate test-failure context from implementation context.** If a test failure requires debugging, spawn a separate debug agent (the existing gsd-debugger) with the test failure context. Do not load test failure details into the executor's context. The executor should see only "test gate: PASS" or "test gate: FAIL -- debug agent spawned."
4. **Budget test output explicitly.** Cap test output included in context at N lines (e.g., 50). Truncate with "... [N more failures, see full output at path]." This prevents a 200-test suite failure from consuming the entire context window.

**Detection (warning signs):**
- Executor tasks near the end of a plan have lower quality than tasks at the start
- SUMMARY.md shows increasing deviation counts for later tasks in a plan
- Executor context usage (if measurable) grows linearly with task count
- Plans with many tasks fail more often than plans with few tasks, independent of complexity

**Phase to address:** Phase 1 (hard gate in execute-plan). The test output summarization and scoped test running must be designed into the gate from the start. Bolting on output management later means every early adopter hits context death spiral.

**Confidence:** HIGH -- direct analysis of execute-plan.md context flow. The current workflow already manages context carefully (fresh context per subagent, 15% orchestrator budget). Adding full suite output after every task breaks this budget model.

---

## Moderate Pitfalls

Issues that cause friction, wasted effort, or suboptimal outcomes but do not block the system entirely.

---

### Pitfall 7: Acceptance Test Gathering Stalls Autonomous Discuss-Phase

**What goes wrong:**
The design adds a new question pass to discuss-phase: "For each requirement, ask: What observable behavior proves this works?" In interactive mode, this is a productive conversation. In autopilot mode (`--auto`), the auto-context agent must generate acceptance tests without human input. The agent either (a) generates trivially obvious acceptance tests that add no verification value ("Given: config exists, When: read config, Then: config is read"), or (b) tries to be thorough and generates acceptance tests that encode implementation assumptions before any planning has occurred.

When running in autopilot, the discuss-phase already uses the auto-context agent (see v1.0 Pitfall 2). Adding acceptance test generation to auto-context multiplies the shallow-decision problem: now the agent must auto-decide not just context/decisions but also verification criteria.

**Why it happens:**
Acceptance tests are most valuable when they encode human expectations: "I expect the CLI to show a progress bar." An auto-context agent has no human expectations to encode. It can only infer expectations from PROJECT.md requirements, which are already captured elsewhere. The auto-generated acceptance tests become a noisy restatement of requirements rather than genuine behavioral specifications.

**Prevention:**
1. **Skip acceptance test generation in auto mode.** When discuss-phase runs with `--auto`, skip the acceptance test gathering pass entirely. The verify-phase already has its own verification logic (grep/file-existence). Acceptance tests are valuable specifically because they encode human judgment; auto-generating them defeats the purpose.
2. **Fallback to requirement-derived checks.** In auto mode, instead of formal acceptance tests, have the auto-context agent generate lightweight "auto-checks" derived directly from REQUIREMENTS.md entries. These are explicitly marked as machine-generated and carry lower authority than human-written acceptance tests.
3. **Make acceptance tests opt-in for auto mode.** The `test.acceptance_tests` config key should have three states: `true` (always), `interactive-only` (default), `false` (never). In `interactive-only` mode, acceptance tests are gathered during interactive discuss but skipped during auto-discuss.

**Detection (warning signs):**
- Auto-generated acceptance tests are trivial restatements of requirements
- Every acceptance test passes on the first verification run (too easy to pass = no verification value)
- Acceptance tests never catch real gaps (they were too shallow to test anything meaningful)

**Phase to address:** Phase 2 (acceptance test layer in discuss-phase). The auto-mode behavior must be designed alongside the interactive behavior, not assumed to work the same way.

**Confidence:** HIGH -- this follows directly from v1.0 Pitfall 2 (shallow auto-decisions). The same root cause applies with worse consequences because acceptance tests encode expectations, not just decisions.

---

### Pitfall 8: Test Steward at Audit Time Creates a Bottleneck

**What goes wrong:**
The design says the test steward runs "during audit-milestone, after phase verifications are collected and before the final audit report." The audit-milestone workflow already spawns the integration-checker agent and aggregates verification data from all phases. Adding the test steward as another agent spawn increases audit time and complexity. In autopilot mode, the audit is on the critical path to milestone completion -- every minute added to audit delays the gap-closure loop or completion flow.

If the test steward finds issues (budget exceeded, redundancy detected, stale tests), it produces consolidation proposals. In autopilot mode, these proposals cannot be reviewed by a human (the audit is autonomous). They either get auto-approved (dangerous -- see Pitfall 5) or deferred as tech debt (noise that accumulates). Neither outcome is good.

**Why it happens:**
The audit workflow was designed as a final verification gate. Adding test health analysis to it conflates two concerns: "did we build the right thing?" (audit) and "is our test suite healthy?" (steward). These have different cadences and different audiences.

**Prevention:**
1. **Decouple steward from audit.** The test steward should run as a separate post-audit step, not embedded within the audit workflow. The audit produces the milestone audit report. The steward produces a separate test health report. In autopilot, the steward's findings are logged as tech debt items and do not block milestone completion.
2. **Make steward advisory-only in autopilot.** When running autonomously, the steward collects metrics and writes a report. Consolidation proposals are deferred to the next interactive session. This prevents autonomous consolidation without human review.
3. **Run steward incrementally.** Instead of analyzing the entire test suite at audit time, run lightweight steward checks after each phase's tests are written (during execute-plan). At audit time, aggregate the per-phase reports. This distributes the cost and catches issues earlier.

**Detection (warning signs):**
- Audit time increases significantly after steward integration
- Steward consolidation proposals pile up across milestones without review
- Autopilot completes milestones with growing lists of unreviewed test health items
- In interactive mode, the audit report becomes too long for productive human review

**Phase to address:** Phase 4 (test steward). The steward should be designed as a standalone agent with audit integration, not as audit-embedded logic. The interface between steward and audit should be a report file, not inline execution.

**Confidence:** MEDIUM -- based on analysis of the audit-milestone workflow structure and the design doc's description of steward timing. The performance impact depends on test suite size, which varies.

---

### Pitfall 9: Configuration Complexity Prevents Adoption

**What goes wrong:**
The design adds 10 new configuration keys under `test.*`:
```json
{
  "test.command": null,
  "test.framework": "auto",
  "test.hard_gate": true,
  "test.acceptance_tests": true,
  "test.budget.max_tests_per_phase": 30,
  "test.budget.max_total_tests": 200,
  "test.budget.warn_at_percentage": 80,
  "test.steward.enabled": true,
  "test.steward.redundancy_threshold": 0.15,
  "test.steward.stale_threshold": 0.05,
  "test.steward.auto_consolidate": false
}
```
The zero-config story says "set test.command and everything else has sensible defaults." In practice, users will need to tune hard_gate (too aggressive?), budget limits (too low?), and steward thresholds (too many false positives?). Each configuration interaction pulls the user away from building features and into tuning test infrastructure. This is particularly harmful for the GSD value proposition: "a single command that takes a milestone from zero to done."

**Why it happens:**
Each config key solves a real problem. But the aggregate effect is a configuration surface that requires test engineering expertise to tune. The defaults will be wrong for some percentage of projects (see Pitfall 4 on budget thresholds), forcing early configuration before users understand what the values mean.

**Consequences:**
- Users with no test engineering background get overwhelmed by options
- Wrong defaults cause bad first experience (hard gate too aggressive, budget too low)
- Users disable features wholesale rather than tune them (set `test.hard_gate: false` instead of configuring baseline)
- Configuration drift between projects as users copy-paste config without understanding

**Prevention:**
1. **Progressive disclosure via experience levels.** Expose only `test.command` at first. Everything else uses defaults. Add a `test.profile` key with values `"relaxed"` (soft gate, high budget, steward off), `"standard"` (hard gate, standard budget, steward advisory), and `"strict"` (hard gate, low budget, steward active). Individual keys override the profile for power users.
2. **Validation and guidance.** When `test.command` is set, run immediate validation and report: "Test suite found: N tests passing, M failing. Recommended profile: standard. Hard gate: enabled. Budget: N*3 (adaptive). Type `/gsd:settings test` to customize."
3. **Delay steward config until it is needed.** Do not expose steward configuration until the first time the steward runs and finds something. "The test steward found 3 potentially redundant tests. Configure thresholds with `/gsd:settings test.steward`."
4. **Document config as recipes, not references.** Instead of documenting each key individually, document scenarios: "My tests are slow" -> set hard_gate_scope to "affected". "I have flaky tests" -> set test.retry to 2. "My test count is too high" -> review steward proposals.

**Detection (warning signs):**
- Users ask "what should I set this to?" for config values
- Most projects run with identical copied configurations
- Users disable entire subsystems rather than tune individual values
- config.json test section grows beyond what `gsd settings` can display cleanly

**Phase to address:** Phase 5 (configuration and settings integration). The config schema is defined early (Phase 1), but the UX of configuration (profiles, progressive disclosure, validation) should be designed in the settings integration phase.

**Confidence:** MEDIUM -- based on design doc review and general software configuration complexity patterns. The specific impact depends on user base sophistication.

---

### Pitfall 10: TDD RED Phase Fails Because Tests Reference Not-Yet-Implemented Code

**What goes wrong:**
The execute-plan TDD flow is: RED (write test, must fail) -> GREEN (implement, must pass). The planner generates `<tests>` blocks in PLAN.md before any implementation exists. When the executor writes the RED test, it imports functions/modules that do not exist yet. The test does not "fail" in the TDD sense (assertion fails because behavior is wrong); it ERRORS (cannot import, module not found, TypeError). The executor sees an error, enters deviation Rule 3 (blocking issue: missing dependency), and "fixes" the import by creating a stub file -- but now the test might PASS against the stub (if the stub returns a default value matching the assertion), breaking the RED-GREEN cycle.

**Why it happens:**
The current TDD execution in execute-plan already handles this (the tdd_plan_execution section says "RED: write test -> run -> MUST fail"). But the hard gate amplifies the problem: after writing the RED test, the executor commits it (per task commit protocol), then the hard gate runs the FULL suite including the new failing test. The hard gate sees a failure, enters debug handling, tries to fix it. The RED phase failure is EXPECTED, but the hard gate does not know that.

**Consequences:**
- Hard gate triggers on intentional RED-phase test failures
- Debug-retry loop activated for expected failures
- Executor creates stubs or partial implementations to "fix" the RED test, then the GREEN phase has nothing to do
- TDD cycle integrity is broken: the test was never genuinely RED

**Prevention:**
1. **Exempt RED-phase commits from the hard gate.** When the executor is in TDD RED phase (committed with `test(...)` prefix), skip the hard gate for that commit. The hard gate applies only to GREEN and REFACTOR commits. The commit message convention (`test(...)` vs `feat(...)`) provides the signal.
2. **Run hard gate against test suite excluding the current RED test.** If the executor just wrote a new failing test, exclude that specific test file from the regression run. This catches real regressions without being confused by the intentional failure.
3. **TDD-aware gate mode.** Add a `test.hard_gate_tdd_aware: true` config (defaulting to true) that makes the gate understand the RED-GREEN-REFACTOR cycle. In RED phase, the gate checks: "did the test fail for the right reason (assertion failure, not import error)?" A proper RED failure (assertion fails) is expected and passes the gate. An error (import fails, syntax error) is a real problem and triggers debug.

**Detection (warning signs):**
- Every TDD task triggers a debug cycle after the RED commit
- Executor creates stub files during the RED phase (should not happen -- RED tests import from not-yet-existing modules)
- GREEN phase commits do not show the test transitioning from fail to pass (it was already passing against stubs)
- TDD tasks take 3x longer than non-TDD tasks despite similar complexity

**Phase to address:** Phase 1 (hard gate in execute-plan). The gate must be TDD-aware from the start, since TDD is an existing pattern in execute-plan. Retrofitting TDD awareness into an already-deployed hard gate requires re-testing all gate logic.

**Confidence:** HIGH -- directly derived from reading both the TDD execution flow in execute-plan.md and the hard gate design. These two patterns conflict mechanically; the gate interprets intentional failures as regressions.

---

## Minor Pitfalls

Issues that cause inconvenience or minor quality degradation.

---

### Pitfall 11: Test Count Attribution by Commit Is Unreliable

**What goes wrong:**
The design proposes per-phase test counting "by commit attribution" (`gsd-tools test-count --phase 5`). This requires tracing which commits introduced which tests, then mapping commits to phases. Commits can be amended, squashed, cherry-picked, or made by debug-retry fixes that span multiple phases. A test added by a debugger fixing a Phase 3 gap gets attributed to whatever phase the debugger was invoked from, which may be the audit phase, not Phase 3.

**Prevention:**
Use directory-based attribution (test files in `tests/phase-XX/`) or naming-convention-based attribution (`XX-YY-feature.test.cjs`) instead of git history. Simpler, deterministic, and survives git operations.

**Phase to address:** Phase 4 (test steward / budget enforcement). Test counting is a steward function.

---

### Pitfall 12: Plan-Checker Cannot Validate Test Coverage Claims

**What goes wrong:**
The design says "Plan-checker verifies that acceptance tests are covered by plan tasks." The plan-checker is a verification agent that reads plan structure. It cannot actually determine whether a task's implementation will satisfy an acceptance test's Verify command -- that requires understanding the code that will be written, which does not exist yet.

**Prevention:**
Scope plan-checker's test coverage check to structural completeness: "every acceptance test AT-XX is referenced by at least one task." Do not claim behavioral coverage at plan time. Behavioral verification belongs in verify-phase.

**Phase to address:** Phase 2 (plan-phase integration). Plan-checker's test-related checks must be scoped appropriately.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| Hard gate in execute-plan | Pre-existing failures block all execution (Pitfall 1) | Baseline capture on first activation | CRITICAL |
| Hard gate in execute-plan | Flaky tests cause debug spirals (Pitfall 2) | Retry-before-debug, affected-tests-only | CRITICAL |
| Hard gate in execute-plan | TDD RED conflicts with gate (Pitfall 10) | Commit-convention-aware gate, TDD exemption | CRITICAL |
| Hard gate in execute-plan | Context death spiral from test output (Pitfall 6) | Summarized output, scoped runs | CRITICAL |
| Acceptance tests in discuss-phase | Brittle Verify commands (Pitfall 3) | Verification helpers, pattern-based checks | HIGH |
| Acceptance tests in discuss-phase | Auto-mode generates shallow tests (Pitfall 7) | Skip in auto, interactive-only default | MODERATE |
| Verify-phase integration | Acceptance test failures from refactors, not bugs | Late-binding verification, pattern matching | HIGH |
| Test steward / budget | Budget thresholds wrong (Pitfall 4) | Adaptive defaults, soft limits | MODERATE |
| Test steward / redundancy | False positive consolidation (Pitfall 5) | Conservative default, detect-only v1 | HIGH |
| Test steward / audit | Bottleneck at audit time (Pitfall 8) | Decouple steward from audit, run incrementally | MODERATE |
| Configuration / settings | Config complexity (Pitfall 9) | Profiles, progressive disclosure | MODERATE |
| Plan-phase integration | Test count attribution unreliable (Pitfall 11) | Directory/naming-based attribution | LOW |
| Plan-phase integration | Coverage claims at plan time (Pitfall 12) | Structural-only validation | LOW |

## Integration-Specific Pitfalls

These are NOT generic testing pitfalls. They are specific to integrating test gates into GSD's existing autonomous workflow.

| Existing Component | Integration Risk | Why It Is Specific to GSD |
|-------------------|------------------|--------------------------|
| Deviation Rule 1 (Bug) | Hard gate test failures get routed through bug handling, but they may not be bugs -- they may be pre-existing, flaky, or TDD-intentional | GSD's deviation rules were designed for implementation bugs, not test infrastructure issues. The rule system has no concept of "expected failure" |
| Debug-retry loop | Test gate failures trigger debug cycles that consume retry budget on non-code issues | GSD's debug-retry was designed for execution failures. Test failures at the gate level are a new failure class that the debugger does not understand |
| Circuit breaker | Test gate failures + debug retries create state changes (debug files, retry counts) that fool the circuit breaker into thinking progress is being made | GSD's circuit breaker checks artifacts. Debug artifacts from test failures look like progress but are not |
| Auto-context agent | Adding acceptance test generation to auto-context increases the agent's scope and error surface | GSD's auto-context already handles decisions. Adding test generation overloads a component designed for a different purpose |
| Subagent executor context budget | Full test suite output after every task consumes context allocated for implementation | GSD's executor was context-budgeted for code, not test output. The design's "100% fresh per subagent" is undermined by test output accumulation within a plan execution |
| Verify-work (interactive UAT) | Acceptance tests from CONTEXT.md may conflict with UAT tests from verify-work | GSD has two verification paths: interactive UAT and acceptance tests. They need to be reconciled, not layered independently |

## "Looks Done But Isn't" Checklist for v1.6

- [ ] **Hard gate:** Passes when test suite passes -- but does it handle pre-existing failures? Run with the current 2 failing tests and verify it does not block
- [ ] **Hard gate:** Blocks on new failures -- but does it retry before debugging? Introduce a flaky test (fails 50% of runs) and verify retry logic activates before debugger
- [ ] **Hard gate:** Runs after TDD RED commit -- but does it exempt intentional failures? Execute a TDD task and verify RED commit does not trigger debug cycle
- [ ] **Acceptance tests:** Verify commands work -- but do they survive refactoring? Move a key file and verify the acceptance test uses patterns, not literal paths
- [ ] **Budget:** Counts tests accurately -- but does it handle the existing test suite? Run count against current 16 test files and verify number is plausible
- [ ] **Steward:** Detects redundancy -- but does it produce false positives? Run against current test suite and manually verify each detected "redundancy"
- [ ] **Config:** Zero-config works -- but does it handle the cold start? Delete test config, run a phase, verify graceful degradation with clear messaging
- [ ] **Auto-mode:** Tests work in interactive mode -- but does autopilot handle acceptance tests? Run full autopilot and verify it does not stall on acceptance test generation
- [ ] **Context budget:** Gate runs in executor -- but does test output fit? Run a plan with 8 tasks against a 200-test suite and measure context consumption
- [ ] **Integration:** Gate works standalone -- but does it interact with deviation rules correctly? Trigger a test failure that overlaps with a Rule 1 bug and verify the executor does not double-handle it

## Sources

- [Meta Engineering: The Death of Traditional Testing -- JiT Testing](https://engineering.fb.com/2026/02/11/developer-tools/the-death-of-traditional-testing-agentic-development-jit-testing-revival/) -- HIGH confidence (Meta Engineering blog, directly addresses test scaling in agentic development)
- [Agentic CI: Test and Gate AI Agents](https://dev.to/kowshik_jallipalli_a7e0a5/agentic-ci-how-i-test-and-gate-ai-agents-before-they-touch-real-users-2p2n) -- MEDIUM confidence (practitioner experience, specific to agentic CI patterns)
- [TDD Guard for Claude Code](https://github.com/nizos/tdd-guard) -- MEDIUM confidence (open source tool, directly relevant TDD enforcement patterns)
- [Forcing Claude Code to TDD: Agentic Red-Green-Refactor](https://alexop.dev/posts/custom-tdd-workflow-claude-code-vue/) -- HIGH confidence (detailed practitioner experience with context pollution and phase gate problems)
- [Koochakzadeh & Garousi: Tester-Assisted Methodology for Test Redundancy Detection (2010)](https://onlinelibrary.wiley.com/doi/10.1155/2010/932686) -- HIGH confidence (peer-reviewed academic research, 50% false positive finding)
- [van Beek: Automatically Detecting Redundant Tests (2023)](https://lakitna.medium.com/automatically-detecting-redundant-tests-be9151fdd855) -- MEDIUM confidence (practitioner with research backing)
- [JetBrains: How to Tame Flaky Tests (2025)](https://blog.jetbrains.com/teamcity/2025/12/how-to-tame-flaky-tests/) -- MEDIUM confidence (vendor blog, well-sourced)
- [Mike Mason: AI Coding Agents -- Coherence Through Orchestration (2026)](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) -- MEDIUM confidence (DORA Report data on AI adoption and bug rates)
- [Steve Kinney: TDD with Claude Code](https://stevekinney.com/courses/ai-development/test-driven-development-with-claude) -- MEDIUM confidence (practitioner education)
- GSD v1.22.1 codebase analysis (execute-plan.md, gsd-executor.md, autopilot.sh, discuss-phase.md, verify-work.md, existing test suite) -- HIGH confidence (primary source, direct examination)
- GSD v1.6 design doc (2026-03-05-dual-layer-test-architecture-design.md) -- HIGH confidence (primary source, the design being analyzed)

---
*Pitfalls research for: GSD v1.6 Dual-Layer Test Architecture*
*Researched: 2026-03-05*
*Previous pitfalls (v1.0 autopilot) archived -- this document supersedes for v1.6 scope*
