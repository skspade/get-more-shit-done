# Project Research Summary

**Project:** GSD (Get Shit Done) v1.6 -- Dual-Layer Test Architecture
**Domain:** Test infrastructure integration into autonomous AI agent orchestration framework
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

The v1.6 milestone adds a dual-layer test architecture to GSD's autonomous coding pipeline: Layer 1 (human-owned acceptance tests in Given/When/Then format) and Layer 2 (AI-managed unit/regression tests with hard gates). The entire capability requires zero new npm dependencies -- it is built with Node.js built-ins, shell grep, and the existing `gsd-tools.cjs` extension pattern. The primary code artifact is a new `testing.cjs` module (~200-300 LOC), a new `gsd-test-steward` agent (markdown), and targeted edits to five existing workflows. This follows established GSD patterns exactly: lib module for data, workflow markdown for control, agent markdown for analysis.

The recommended approach is dependency-driven phasing: config schema and test counting first (everything reads config), then the hard test gate in execute-plan (highest immediate value -- prevents regressions during autonomous execution), then the acceptance test lifecycle (discuss-phase gathering, verify-phase execution), and finally the test steward for long-term suite health. The hard gate is the single most impactful feature -- without it, the AI can silently break existing tests while implementing new features. The acceptance test layer is the governance innovation -- it gives humans an executable contract that the AI works against, preventing the "AI tests its own work" trust problem.

The critical risks are operational, not technical. Four pitfalls demand attention during the hard gate implementation: (1) pre-existing test failures will block all execution on day one unless a baseline mechanism captures known failures before activation, (2) flaky tests will cause debug spirals unless the gate retries before invoking the debugger, (3) TDD RED-phase commits will trigger false gate failures unless the gate is commit-convention-aware, and (4) full test suite output after every task commit will consume executor context budgets unless output is summarized. All four must be addressed in the gate's initial implementation -- they are not "nice to have" refinements but fundamental design requirements.

## Key Findings

### Recommended Stack

Zero new npm dependencies. The v1.6 capabilities are implemented entirely with existing infrastructure.

**Core technologies:**
- **Node.js built-ins** (`child_process.spawnSync`, `fs.readdirSync` recursive): acceptance test execution, test file discovery -- no external packages needed
- **Shell grep** (`grep -r -c "it(\|test("`): test case counting across Jest, Vitest, Mocha, and node:test -- fast, framework-agnostic, sufficient for advisory budget counts
- **`gsd-tools.cjs` dispatcher**: four new subcommands (`test-count`, `test-detect`, `test-budget`, `test-acceptance`) plug into the existing switch/case router pattern
- **Agent-as-markdown**: test steward follows the identical pattern as gsd-researcher, gsd-verifier, etc. -- read-only analysis agent spawned by audit orchestrator

**What NOT to add:** `@babel/parser` for AST counting (grep is sufficient), `cucumber` for BDD (one `eval` call replaces an entire BDD framework), `jscpd` for duplication (AI semantic analysis is better than syntactic matching), any test runner adapter (a single `eval "$TEST_CMD"` is the abstraction).

### Expected Features

**Must have (table stakes):**
- Hard test gate after each task commit during execute-plan (regression prevention, highest-value feature)
- Given/When/Then acceptance tests in CONTEXT.md with executable `Verify` commands
- Human ownership rule -- AI cannot add/modify/remove acceptance tests after discuss-phase
- Test command discovery from `test.command` config with graceful degradation when absent
- Backward compatibility -- all gates skip silently when config is missing or `test.command` is null
- Full regression suite run (not just current test) after each task commit
- TDD RED-GREEN-REFACTOR preservation with existing `tdd="true"` task flow

**Should have (differentiators):**
- Dual ownership model (human specs, AI implementation) -- unique governance pattern for autonomous AI execution
- Budget-aware planning -- planner sees test count before generating `<tests>` blocks
- Test steward agent with consolidation proposals (detect-only in v1, proposals in v2)
- Progressive opt-in across project lifecycle (no big-bang adoption)
- Acceptance tests as verification truths (eliminates AI interpretation of "what did the user want")

**Defer (v2+):**
- Coverage percentage targets (vanity metric for AI-generated code; budget model is better)
- Auto-consolidation of tests without human approval
- Runtime test isolation / sandboxing
- Flaky test detection and quarantine (fix flaky tests, do not quarantine them)
- Visual test reports / dashboards (GSD is markdown-native)
- Per-file or per-function test mapping (run full suite instead)
- Mandatory test generation for all tasks (many tasks are not meaningfully testable)

### Architecture Approach

The architecture adds test concerns to five existing workflows as additive steps (never replacing existing steps), introduces one read-only analysis agent, and extends gsd-tools with test-counting commands. The critical constraint is that subagents cannot spawn subagents: the hard gate runs inline in the executor context (not as a subagent), and the test steward is spawned by the audit-milestone orchestrator (not by another agent). Every integration point has a "when absent" fallback -- backward compatibility is a hard architectural invariant.

**Major components:**
1. **`testing.cjs` module** -- data layer: test framework detection, grep-based counting, acceptance test parsing, budget calculation (9 exports, ~200-300 LOC)
2. **Workflow integrations** -- control layer: discuss-phase (AT gathering), plan-phase (budget context), execute-plan (hard gate), verify-phase (AT execution), audit-milestone (steward spawning)
3. **`gsd-test-steward` agent** -- analysis layer: read-only agent that counts tests, detects redundancy, identifies stale tests, produces consolidation proposals during milestone audit
4. **Config schema (`test.*`)** -- configuration layer: 10 keys under `test.*` with zero-config degradation; everything reads config to decide whether to activate

**Six architectural invariants:**
1. No phase completes without all existing tests passing (hard gate)
2. No acceptance test is added/modified/removed by AI (ownership boundary)
3. No test is deleted without human approval (steward proposes, human approves)
4. Backward compatible (all gates degrade when config absent)
5. No subagent spawns subagent (inline gate, orchestrator-spawned steward)
6. Existing phase lifecycle unchanged (additive steps only)

### Critical Pitfalls

1. **Pre-existing test failures block the hard gate on day one** -- GSD has 2 known failing tests. The gate must capture a baseline of known failures before activation and exclude them from regression detection. Without this, every task commit triggers a debug spiral on unfixable pre-existing failures. *Phase: Foundation (config/gate setup).*

2. **Flaky tests cause debug spirals under per-task gating** -- The gate must retry failing tests (2x) before invoking the debugger. If tests pass on retry, log as flaky and continue. Without retry-before-debug, a 20% failure rate test triggers unnecessary debug cycles on 1-2 tasks per phase. *Phase: Hard gate implementation.*

3. **TDD RED-phase commits conflict with the hard gate** -- The gate interprets intentional RED-phase failures as regressions. The gate must be commit-convention-aware: skip or exempt RED-phase commits (identified by `test(...)` commit prefix), run gate only on GREEN/REFACTOR commits. *Phase: Hard gate implementation.*

4. **Full test suite output causes context budget death spiral** -- Running 200 tests after every task generates thousands of lines of output in the executor's context window. The gate must summarize output as structured data (pass/fail count, failing test names, first failure message only) and cap raw output at ~50 lines. *Phase: Hard gate implementation.*

5. **Acceptance test Verify commands are brittle shell one-liners** -- Verify commands encode implementation details (exact file paths, string content) that break on refactors. Use pattern-based verification (globs, content patterns) and consider a verification helper library in gsd-tools. Validate Verify commands during discuss-phase before any implementation begins. *Phase: Acceptance test layer.*

## Implications for Roadmap

Based on research, suggested phase structure (4 phases):

### Phase 30: Foundation -- Config Schema + Test Counting + Framework Detection

**Rationale:** Every other feature reads config to decide whether to activate. Test counting is consumed by budget display, planner prompt, and steward analysis. These are zero-risk, zero-dependency foundations.
**Delivers:** `test.*` config schema with defaults and zero-config degradation, `testing.cjs` module with detection/counting/budget functions, `test-count`/`test-detect`/`test-budget` CLI commands in gsd-tools, `gsd settings` test display section.
**Addresses features:** Test command discovery, test count tracking, budget status visibility, configuration schema.
**Avoids pitfalls:** Pitfall 4 (budget thresholds) -- use adaptive defaults calibrated from existing test count, not fixed 200. Pitfall 9 (config complexity) -- expose only `test.command` initially, use profile-based presets for other values. Pitfall 1 (pre-existing failures) -- baseline capture mechanism designed here even if gate is built in next phase.

### Phase 31: Hard Test Gate in Execute-Plan

**Rationale:** The single highest-value feature. Prevents regressions during autonomous execution. Independent of acceptance tests -- can ship immediately after foundation. This phase carries the most pitfall density (4 critical pitfalls) and must address all of them in the initial implementation.
**Delivers:** Post-commit test suite gate in execute-plan/gsd-executor, Rule 1 deviation routing on failure, TDD-aware gate mode (RED exemption), retry-before-debug logic, test output summarization, graceful degradation when no test command.
**Addresses features:** Hard test gate after each task commit, regression suite run, TDD RED-GREEN-REFACTOR preservation.
**Avoids pitfalls:** Pitfall 1 (pre-existing failures -- baseline exclusion), Pitfall 2 (flaky tests -- retry before debug), Pitfall 10 (TDD RED conflicts -- commit-convention awareness), Pitfall 6 (context death spiral -- summarized output, capped at ~50 lines).

### Phase 32: Acceptance Test Layer -- Discuss/Plan/Verify Integration

**Rationale:** The governance innovation. Gives humans an executable contract for what "done" means. Requires the foundation (config, counting) but not the hard gate. Three workflow modifications that form a complete lifecycle: gather ATs in discuss, reference ATs in plan, execute ATs in verify.
**Delivers:** `gather_acceptance_tests` step in discuss-phase (interactive mode), auto-context AT generation from success criteria (auto mode -- `interactive-only` default), `<acceptance_tests>` XML section in CONTEXT.md, `<tests>` blocks in PLAN.md tasks, plan-checker AT coverage dimension (Dimension 9), verify-phase AT execution with truth mapping, fallback to current behavior when ATs absent.
**Addresses features:** Acceptance test format, human ownership rule, AT execution during verify-phase, auto-context generation, plan-phase budget awareness, plan-checker AT coverage.
**Avoids pitfalls:** Pitfall 3 (brittle Verify commands -- pattern-based verification, discuss-time validation), Pitfall 7 (auto-mode shallow tests -- `interactive-only` default, skip AT generation in auto unless explicitly enabled), Pitfall 12 (plan-checker overclaims -- structural coverage check only, not behavioral).

### Phase 33: Test Steward Agent + Audit Integration

**Rationale:** Long-term suite health management. Depends on counting, detection, and budget from Phase 30. Least urgent -- matters at milestone audit time, not during day-to-day execution. Start conservative (detection and metrics only, no consolidation proposals in v1).
**Delivers:** `gsd-test-steward.md` agent file (read-only, no Write/Edit tools), audit-milestone spawning integration, `/gsd:audit-tests` command spec, test health section in MILESTONE-AUDIT.md, redundancy metrics, stale test identification, budget status per phase.
**Addresses features:** Test steward agent, audit-milestone integration, `add-tests` evolution as "fill gaps" command.
**Avoids pitfalls:** Pitfall 5 (false positive consolidation -- v1 is detect-only, proposals deferred to v2 after accuracy validated), Pitfall 8 (audit bottleneck -- steward runs as separate post-audit step, advisory-only in autopilot, findings logged as tech debt not blocking).

### Phase Ordering Rationale

- **Config/counting must precede everything** -- every workflow checks `config-get test.*` to decide activation; counting is consumed by planner and steward.
- **Hard gate before acceptance tests** -- the gate is independent and delivers the highest immediate value (regression prevention). Acceptance tests require more workflow surface area and can ship after the gate is proven.
- **Acceptance test lifecycle is one cohesive unit** -- discuss (gather), plan (reference), verify (execute) form a pipeline. Splitting them across phases would require incomplete integration points. Ship together for a complete lifecycle.
- **Steward last** -- depends on all prior work, least urgent, and the implementation benefits from real test data accumulated during prior phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 31 (Hard gate):** Most pitfall-dense phase. The interaction between retry-before-debug, TDD-aware exemption, baseline exclusion, and existing deviation Rule 1 handling is complex. Recommend `/gsd:research-phase` to map exact executor flow with gate inserted.
- **Phase 32 (Acceptance tests):** The discuss-phase interactive UX for gathering acceptance tests needs careful design. The auto-mode behavior (skip vs generate-from-criteria) affects autopilot reliability. Recommend `/gsd:research-phase` for discuss-phase integration specifically.

Phases with standard patterns (skip research-phase):
- **Phase 30 (Foundation):** Standard Node.js module work. Config extension uses existing patterns. CLI commands follow existing dispatcher pattern. Well-documented, no unknowns.
- **Phase 33 (Steward):** Agent-as-markdown follows established GSD pattern. Read-only analysis agent with audit integration. Similar to existing gsd-integration-checker. Standard work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero-dep approach verified by direct codebase inspection. All 12 lib modules, 15 test files, package.json examined. Every proposed pattern validated against existing code. |
| Features | HIGH | Table stakes well-established in BDD/CI literature. Differentiators grounded in spec-driven development patterns. Feature dependencies mapped with critical path. Multiple primary sources (Simon Willison, Martin Fowler, Meta Engineering). |
| Architecture | HIGH | Every integration point analyzed against actual workflow files. Component map, data flow, and spawning constraints verified by direct reading of execute-plan.md, discuss-phase.md, verify-phase.md, plan-phase.md, audit-milestone.md, and all relevant agents. |
| Pitfalls | HIGH | 12 pitfalls identified with specific prevention strategies. Critical pitfalls grounded in codebase analysis (2 known failing tests, existing deviation rules, context budget model) and industry research (Meta JiT Testing, Koochakzadeh redundancy false positives, JetBrains flaky test data). |

**Overall confidence:** HIGH

### Gaps to Address

- **Pre-existing test failure resolution:** GSD has 2 known failing tests (codex-config.test.cjs, config.test.cjs). These should be fixed OR the baseline mechanism must exclude them before the hard gate activates. Decision needed during Phase 31 planning.
- **Auto-mode acceptance test policy:** The design allows auto-context to generate ATs from success criteria, but research suggests this produces shallow tests. The `interactive-only` default is recommended, but the exact auto-mode fallback behavior needs explicit definition during Phase 32 planning.
- **Test budget calibration:** The design's 30-per-phase / 200-total defaults are likely too low for GSD (already 618 test cases across 15 files). Adaptive defaults (existing count * 3) recommended, but the calibration logic needs implementation during Phase 30.
- **Verify command verification helpers:** Research recommends pattern-based verification over literal path checking, with optional gsd-tools helper commands. Whether to build helpers (adds scope) or document patterns (lower cost) is a Phase 32 planning decision.
- **Steward detection-vs-proposals scope:** Research strongly recommends v1 as detection-only (metrics, no consolidation proposals) due to 50% false positive rates in coverage-based redundancy detection. Proposals should be a v2 feature after detection accuracy is validated. This scope boundary needs explicit documentation during Phase 33 planning.

## Sources

### Primary (HIGH confidence)
- GSD codebase direct inspection: all workflows, agents, lib modules, test files, config, dispatcher (PRIMARY source for architecture and integration analysis)
- GSD v1.6 design doc (`.planning/designs/2026-03-05-dual-layer-test-architecture-design.md`) -- approved design defining all requirements
- [Simon Willison: First Run the Tests (Agentic Engineering Patterns)](https://simonwillison.net/guides/agentic-engineering-patterns/first-run-the-tests/) -- validates hard gate approach
- [Simon Willison: Agentic Engineering Patterns](https://simonwillison.net/guides/agentic-engineering-patterns/) -- broader agentic coding patterns
- [Martin Fowler: Given When Then (bliki)](https://martinfowler.com/bliki/GivenWhenThen.html) -- canonical BDD format reference
- [Meta Engineering: JiT Testing](https://engineering.fb.com/2026/02/11/developer-tools/the-death-of-traditional-testing-agentic-development-jit-testing-revival/) -- test scaling in agentic development
- [Node.js test runner API](https://nodejs.org/api/test.html) -- node:test API verification

### Secondary (MEDIUM confidence)
- [Koochakzadeh & Garousi: Test Redundancy Detection (2010)](https://onlinelibrary.wiley.com/doi/10.1155/2010/932686) -- 50% false positive rate finding for coverage-based redundancy
- [TestCollab: Spec-Driven Development](https://testcollab.com/blog/from-vibe-coding-to-spec-driven-development) -- spec-as-contract validation
- [van Beek: Automatically Detecting Redundant Tests](https://lakitna.medium.com/automatically-detecting-redundant-tests-be9151fdd855) -- redundancy detection techniques
- [TDD Guard for Claude Code](https://github.com/nizos/tdd-guard) -- TDD enforcement patterns
- [Forcing Claude Code to TDD](https://alexop.dev/posts/custom-tdd-workflow-claude-code-vue/) -- context pollution and phase gate problems
- [JetBrains: How to Tame Flaky Tests](https://blog.jetbrains.com/teamcity/2025/12/how-to-tame-flaky-tests/) -- flaky test management patterns

### Tertiary (LOW confidence)
- [Testrig: AI-Powered Test Analysis](https://testrig.medium.com/reducing-redundant-tests-using-ai-powered-test-analysis-81bacf32db37) -- clustering-based test overlap detection (single source)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
