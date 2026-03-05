# Feature Landscape: Dual-Layer Test Architecture

**Domain:** AI agent test orchestration — human-owned acceptance gates + AI-managed unit/regression tests
**Researched:** 2026-03-05
**Overall confidence:** HIGH (patterns well-established in BDD/CI literature; agentic testing patterns emerging but directionally clear)

## Table Stakes

Features users expect from a dual-layer test architecture integrated into an autonomous coding orchestrator. Missing any of these makes the test architecture feel incomplete or untrustworthy.

### Acceptance Test Layer (Layer 1 — Human-Owned)

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| Given/When/Then acceptance test format in CONTEXT.md | Industry-standard BDD format (Martin Fowler's bliki, Cucumber, SpecFlow). Users already think in this structure. The format directly translates to executable verification. | LOW | `discuss-phase.md` — adds a new question pass after existing decision gathering | The `<acceptance_tests>` block in CONTEXT.md is structurally sound. Given/When/Then + `Verify` shell command is the right format because it bridges human-readable spec to machine-executable check. Confidence: HIGH (BDD is 15+ years mature). |
| Human ownership rule — AI cannot add/modify/remove acceptance tests | The whole point of Layer 1. Simon Willison's agentic engineering patterns emphasize that tests are the contract the AI works against. If the AI can modify its own acceptance criteria, the contract is meaningless. This is the "spec-driven development" principle: the spec is human-owned, the implementation is AI-owned. | LOW | `discuss-phase.md` ownership boundary; `execute-plan.md` must respect immutability | Enforcement is documentation + workflow design, not runtime enforcement. The AI is instructed never to touch `<acceptance_tests>` blocks after discuss-phase approval. No code-level lock needed — workflow instruction is sufficient for Claude. Confidence: HIGH. |
| Acceptance test execution during verify-phase | Acceptance tests that are never run are documentation, not tests. The `Verify` line must be executed as a shell command during `verify-phase`, with pass/fail mapped to verification truths. This replaces the current "derive truths from phase goal" fallback with concrete, executable checks. | MEDIUM | `verify-phase.md` — modifies `verify_truths` step to run AT Verify commands and map results | Key integration: each `AT-{NN}` Verify command runs as `eval "$VERIFY_CMD"`. Exit code 0 = VERIFIED, non-zero = FAILED. Results feed directly into existing truth status system (VERIFIED/FAILED/UNCERTAIN). Falls back to current behavior when no `<acceptance_tests>` block exists. Confidence: HIGH. |
| Graceful degradation when no acceptance tests exist | Phases planned before this architecture, or projects that don't opt in, must continue working. This is a progressive enhancement, not a breaking change. | LOW | All existing workflows — backward compatibility is a hard requirement | When `<acceptance_tests>` is absent from CONTEXT.md, verification falls back to current behavior (grep/file-existence/derived truths). When `test.acceptance_tests` is false in config, skip the acceptance test gathering pass in discuss-phase. Zero-config degradation. Confidence: HIGH. |

### Unit/Regression Test Layer (Layer 2 — AI-Owned)

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| `<tests>` blocks in PLAN.md task definitions | The planner needs to specify what tests to write alongside what code to write. TDD is already supported in GSD via `tdd="true"` tasks and `<behavior>`/`<implementation>` blocks. Adding `<tests>` blocks is a natural extension of the existing TDD plan structure. | LOW | `plan-phase.md` (planner generates plans); existing `tdd.md` reference | The `<tests>` block format in the design doc (test name, input, expected) is a lightweight test spec. It supplements, not replaces, the existing `<behavior>` block in TDD plans. For non-TDD tasks that happen to be testable, `<tests>` enables test generation without the full RED-GREEN-REFACTOR cycle. Confidence: HIGH. |
| Hard test gate after each task commit | Simon Willison's "first run the tests" pattern, applied as a hard gate: after every task commit during execute-plan, run the full project test suite. If any test fails, trigger Rule 1 (Bug) deviation handling. This is the regression prevention mechanism. | MEDIUM | `execute-plan.md` — adds a new step after task commit; `config.json` for `test.command`; existing deviation Rule 1 for failure handling | The gate runs `eval "$TEST_CMD"` after each task commit. Non-zero exit triggers existing deviation handling (debug, fix, retry, escalate). This is the single most impactful feature for code quality in autonomous execution. Without it, the AI can silently break existing tests while implementing new features. Confidence: HIGH (CI/CD hard gates are universal practice). |
| Test command discovery from config | The system must know how to run tests. `test.command` in config.json (default: null) is the explicit configuration. When null, all test gates degrade gracefully with warnings. | LOW | `config.json` schema; `gsd-tools.cjs config-get` for retrieval | Auto-detection from `package.json` scripts.test is tempting but unreliable (many projects have `"test": "echo 'no tests'"` as a placeholder). Explicit configuration via `test.command` is the right call. The `gsd settings` command surfaces the current value. Confidence: HIGH. |
| TDD RED-GREEN-REFACTOR preservation | The existing TDD workflow must continue working unchanged. The `<tests>` block is additive — tasks with `tdd="true"` still follow the full RED (write failing test) -> GREEN (implement to pass) -> REFACTOR cycle from `tdd.md`. | LOW | `execute-plan.md` TDD execution flow; `tdd.md` reference | No changes to the existing TDD cycle. The `<tests>` block provides input to the RED phase (what tests to write), but the RED-GREEN-REFACTOR discipline is unchanged. The hard gate (run full suite after GREEN) is the only addition to the TDD flow. Confidence: HIGH. |
| Regression suite run (not just current test) | Today, TDD tasks only verify their own tests pass. The hard gate runs the FULL project test suite after each task. This catches regressions where new code breaks unrelated tests. | MEDIUM | `execute-plan.md` — extends TDD execution from "run this test" to "run all tests" | This is the key behavioral change. Current flow: write test -> implement -> run test -> pass -> commit. New flow: write test -> implement -> run test -> pass -> run ALL tests -> pass -> commit. The "run ALL tests" step is the regression gate. If it fails, the executor debugs and fixes before proceeding. Confidence: HIGH (standard CI/CD pattern). |

### Test Budget and Bloat Management

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| Per-phase and project-level test count limits | AI-generated tests grow without bound. Without a budget, 6 milestones of autonomous execution could produce 500+ tests with significant redundancy. The budget model (30 per phase, 200 total) provides a ceiling that forces consolidation. | LOW | `config.json` schema for `test.budget.*`; `plan-phase.md` receives budget status | The counting mechanism (`grep -r -c "it(\|test("`) is simple and framework-agnostic for Jest/Vitest/Mocha. Budget is advisory during planning, not a hard block during execution (you cannot unwrite tests mid-execution). The planner sees "Warning: 160/200 tests used" and plans within limits. Confidence: MEDIUM (test budgeting is novel — no standard tooling exists, but the concept is sound). |
| Test count tracking via gsd-tools | A `test-count` subcommand in gsd-tools.cjs that counts test cases (individual `it`/`test` blocks, not files) project-wide and per-phase. | LOW | `gsd-tools.cjs` — new subcommand; `config.json` for framework detection | Counting by grep is sufficient for v1. More sophisticated counting (AST parsing) is over-engineering for the initial implementation. Phase attribution by commit history (`git log --all --oneline -- tests/` filtered by phase tag) enables per-phase counting. Confidence: HIGH (implementation is straightforward). |
| Budget status visible to planner during plan-phase | The planner must know the current test count and remaining budget before generating `<tests>` blocks. Without this, the planner generates tests blindly and hits the ceiling only at audit time. | LOW | `plan-phase.md` — planner prompt includes budget context | A single line in the planner prompt: "Current test budget: 145/200 (72%). Per-phase max: 30. Plan tests accordingly." The planner adjusts its test generation to stay within limits. Confidence: HIGH. |

### Workflow Integration

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| discuss-phase acceptance test gathering pass | The interactive discuss-phase must gain a new step: after gathering implementation decisions, ask "What observable behavior proves this works?" for each requirement, then structure responses into AT-{NN} format. | MEDIUM | `discuss-phase.md` — new step after existing decision gathering; CONTEXT.md template gains `<acceptance_tests>` block | This is the highest-touch workflow change. The discuss-phase must present requirements, ask for acceptance criteria, suggest Verify commands, and get human approval. In `--auto` mode, the auto-context agent generates acceptance tests from ROADMAP success criteria (no human input). Confidence: MEDIUM (the interactive UX needs careful design). |
| Auto-context acceptance test generation | When discuss-phase runs with `--auto`, the auto-context agent must generate acceptance tests from ROADMAP.md success criteria and REQUIREMENTS.md. No human input available. | MEDIUM | `gsd-auto-context` agent; ROADMAP.md success criteria | The auto-context agent reads success criteria ("User can create a new project") and generates Given/When/Then + Verify. This is feasible because success criteria are already written as observable behaviors. The Verify commands are AI-generated (no human approval in auto mode), which is a controlled deviation from the ownership rule — acceptable because the auto-context agent IS the discuss-phase replacement. Confidence: MEDIUM. |
| verify-phase acceptance test execution | verify-phase runs each AT-{NN} Verify command and maps results to truths. This replaces or augments the current truth derivation logic. | MEDIUM | `verify-phase.md` — modifies `verify_truths` step | Acceptance tests become the primary truth source when present. Each AT Verify command runs via `eval`, exit code maps to truth status. Existing artifact/wiring verification continues alongside. When ATs are absent, current behavior is unchanged. Confidence: HIGH. |
| audit-milestone test steward integration | The test steward agent runs during audit-milestone, after phase verifications and before the final audit report. It produces a test health section for the audit report. | MEDIUM | `audit-milestone.md` — new step to spawn test steward | The steward is a read-only analysis agent. It counts tests, detects redundancy, identifies stale tests, and produces a consolidation proposal. It does NOT modify any files. The audit report gains a "Test Suite Health" section. Confidence: HIGH (analysis-only is low risk). |
| Configuration schema with zero-config degradation | The `test` key in config.json with sensible defaults. Every feature degrades gracefully when config is absent or `test.command` is null. | LOW | `config.json` schema; `gsd-tools.cjs config-get/config-set`; `gsd settings` display | The design doc's config schema is complete and well-reasoned. `test.command: null` means all test gates skip with warnings. `test.hard_gate: true` is the right default (strict by default, loosen per-project). `test.steward.auto_consolidate: false` enforces human approval. Confidence: HIGH. |

## Differentiators

Features that set this test architecture apart from standard CI/CD test gates or other AI coding agent test approaches.

| Feature | Value Proposition | Complexity | Existing GSD Dependency | Notes |
|---------|-------------------|------------|------------------------|-------|
| Dual ownership model (human specs, AI implementation) | No other AI coding orchestrator cleanly separates "what to test" (human) from "how to test" (AI). Spec-driven development literature (TestCollab, GitHub Spec Kit) validates this pattern: the spec is the contract, the AI implements against it. This prevents the "AI tests its own work" trust problem. | LOW | Entire dual-layer architecture enforces this | The ownership boundary is the core innovation. Acceptance tests (Layer 1) are the human's contract. Unit tests (Layer 2) are the AI's implementation verification. Neither layer can modify the other. This is not just a testing pattern — it is a governance pattern for autonomous AI execution. Confidence: HIGH. |
| Test steward agent with consolidation proposals | No standard CI/CD tool provides an AI agent that analyzes test suite health and proposes specific consolidation actions. Tools like Stryker detect redundancy via mutation testing, but they do not propose fixes. The steward bridges detection and action while keeping human approval in the loop. | HIGH | New `gsd-test-steward` agent; `audit-milestone.md` integration | The steward combines multiple analysis techniques: grep-based duplicate detection, stale test identification (references to deleted functions), and budget tracking. The consolidation proposal format (specific file:line references, specific merge/delete recommendations) is actionable, not just a report. Confidence: MEDIUM (the analysis is feasible; the quality of proposals depends on implementation). |
| Progressive opt-in across project lifecycle | Projects can adopt the test architecture incrementally: start with no test command (gates skip), add test command (hard gate activates), start writing acceptance tests (Layer 1 activates), let the planner generate test specs (Layer 2 activates), enable the steward (audit-time analysis activates). No big-bang adoption required. | LOW | Config schema with null defaults; workflow fallbacks at every integration point | This is a design property, not a feature to build. Every integration point has a "when absent" fallback. The design doc explicitly documents each fallback. Confidence: HIGH. |
| Acceptance tests as verification truths | Acceptance tests do double duty: they are human-defined specs AND they are the verification criteria for verify-phase. This eliminates the disconnect between "what should we verify?" and "what did the user say they want?" — they are the same thing. | MEDIUM | `verify-phase.md` truth derivation system | Currently, verify-phase derives truths from phase goals or must_haves in PLAN frontmatter. With acceptance tests, truths come directly from the human's own words. This is strictly better because it eliminates the AI's interpretation of what the human wanted. Confidence: HIGH. |
| Budget-aware planning | The planner sees test budget status before generating tests. No other AI coding tool plans tests with awareness of suite-wide constraints. This is proactive bloat prevention rather than reactive cleanup. | LOW | `plan-phase.md` prompt enrichment | A single context line changes planner behavior. When the planner knows "145/200 tests used, 30 max per phase", it generates fewer, more targeted tests. This is the "shift left" principle applied to test bloat. Confidence: MEDIUM (depends on planner actually respecting the budget — needs testing). |

## Anti-Features

Features to explicitly NOT build. These are tempting but would hurt the architecture.

| Anti-Feature | Why Tempting | Why Avoid | What to Do Instead |
|--------------|-------------|-----------|-------------------|
| Coverage percentage targets | "We should aim for 80% code coverage." Feels like a measurable quality goal. | Coverage is a vanity metric for AI-generated code. An AI can trivially generate tests that hit 100% coverage without testing meaningful behavior. Coverage incentivizes quantity over quality. The budget model (count tests, not coverage) combined with the steward (detect redundancy) is strictly better. | Use test budgets (count-based) + steward redundancy detection. Quality comes from the acceptance test layer (human-defined behavior) not from coverage percentages. |
| Auto-consolidation of tests without human approval | "The steward should automatically merge redundant tests." Reduces manual overhead. | Tests are a trust artifact. If the AI deletes or modifies tests without human approval, the human loses confidence in the test suite. The "never auto-delete" principle is critical for trust. Even if the consolidation is correct, the human needs to see and approve it. | Steward produces proposals. Human reviews during milestone audit. "Approve all" / "Cherry-pick" / "Reject" flow. Config key `test.steward.auto_consolidate: false` (default) enforces this. |
| Runtime test isolation / sandboxing | "Tests should run in isolated containers to prevent side effects." Adds reliability. | Over-engineering for a CLI-based coding orchestrator. GSD runs in the developer's local environment. Adding container orchestration for test isolation introduces Docker/Podman dependencies, startup overhead, and environment parity issues. The target users are running `npm test` locally. | Run tests in the developer's existing environment. If tests have side effects, that is a test quality issue (fix the test), not an infrastructure issue (add containers). |
| AI-generated acceptance tests (Layer 1) | "Let the AI write acceptance tests too, then the human just approves." Reduces discuss-phase friction. | This inverts the ownership model. If the AI writes the acceptance criteria and the human just rubber-stamps them, the human is not actually defining what "done" means. The whole point of Layer 1 is that the HUMAN specifies observable behavior. The AI may SUGGEST Verify commands, but the Given/When/Then is human-authored. | In `--auto` mode, the auto-context agent generates acceptance tests from ROADMAP success criteria. This is acceptable because success criteria are human-authored (in ROADMAP.md). The auto-context agent translates human-authored criteria into AT format, not inventing new criteria. |
| Flaky test detection and quarantine | "Detect flaky tests and quarantine them automatically." Standard in enterprise CI/CD. | Flaky test detection requires running each test multiple times and tracking pass/fail rates over time. GSD runs tests once per task commit — there is no historical pass/fail data to analyze. Flaky test management is a CI/CD infrastructure concern, not an orchestrator concern. | If a test is flaky, the hard gate will catch it (test fails -> debug -> fix). The fix is to fix the flaky test, not to quarantine it. The steward can flag tests that failed once and passed on retry as potentially flaky, but this is advisory, not automated quarantine. |
| Visual test reports / dashboards | "Generate an HTML test report with charts and trends." Looks professional. | GSD is markdown-native. All artifacts are .md files in .planning/. Adding HTML report generation introduces a rendering dependency and breaks the "everything is readable in a text editor" principle. | Test results go into VERIFICATION.md (markdown) and MILESTONE-AUDIT.md (markdown). The `gsd progress` command can show test budget status in the terminal. No HTML needed. |
| Per-file or per-function test mapping | "Map each source file to its test file(s) for precise test selection." Enables targeted test runs. | Maintaining a source-to-test mapping is brittle and high-maintenance. File renames, refactors, and test reorganization break the mapping. Running the full suite is simpler and catches cross-file regressions that targeted runs miss. | Run the full test suite via `test.command`. If the suite is slow, the developer can configure a faster subset command. The steward can recommend test file consolidation to reduce suite runtime. |
| Mandatory test generation for all tasks | "Every task should have tests, not just TDD tasks." Maximizes coverage. | Many tasks are not meaningfully testable (UI styling, config changes, documentation, migrations). Forcing test generation for these tasks produces low-value tests that consume budget. The existing TDD heuristic ("Can you write `expect(fn(input)).toBe(output)` before writing `fn`?") is the right filter. | Tasks with `tdd="true"` or `<tests>` blocks get test generation. Tasks without are executed normally. The `add-tests` command fills gaps post-hoc for phases that need additional coverage. |

## Feature Dependencies

```
[discuss-phase acceptance test gathering]
    |-- produces --> <acceptance_tests> in CONTEXT.md
    |-- consumed by --> [verify-phase AT execution]
    |-- consumed by --> [execute-plan hard gate] (AT Verify commands as regression checks)

[plan-phase <tests> block generation]
    |-- requires --> test budget status (gsd-tools test-count)
    |-- produces --> <tests> blocks in PLAN.md
    |-- consumed by --> [execute-plan TDD execution]

[execute-plan hard test gate]
    |-- requires --> test.command in config.json
    |-- requires --> existing deviation Rule 1 (Bug) handling
    |-- produces --> test pass/fail per task commit
    |-- feeds into --> SUMMARY.md test results

[verify-phase acceptance test execution]
    |-- requires --> <acceptance_tests> in CONTEXT.md
    |-- produces --> truth statuses in VERIFICATION.md
    |-- falls back to --> current verify_truths behavior when ATs absent

[test steward agent]
    |-- requires --> test.command (to count tests)
    |-- requires --> test files on disk (to analyze)
    |-- produces --> consolidation proposals in audit report
    |-- triggered by --> audit-milestone.md
    |-- depends on --> test budget config

[config schema]
    |-- consumed by --> all features above
    |-- managed by --> gsd settings command
    |-- zero-config default --> all gates skip with warnings

[gsd-tools test-count]
    |-- consumed by --> plan-phase (budget display)
    |-- consumed by --> test steward (budget analysis)
    |-- consumed by --> gsd settings (test budget display)
```

### Critical Path

1. **Config schema** (everything else reads from it)
2. **gsd-tools test-count** (budget features need counting)
3. **discuss-phase AT gathering** + **plan-phase `<tests>` blocks** (can be parallel — independent workflow changes)
4. **execute-plan hard gate** (depends on config, consumes both layers)
5. **verify-phase AT execution** (depends on discuss-phase producing ATs)
6. **test steward** (depends on everything else being in place; runs at audit time)

## MVP Recommendation

### Phase 1: Foundation (Config + Counting + Hard Gate)

Build the infrastructure that all other features depend on.

1. **Config schema addition** — Add `test.*` keys to config.json with defaults. Integrate with `gsd settings` display.
2. **gsd-tools test-count** — New subcommand for counting test cases.
3. **Execute-plan hard test gate** — Run `test.command` after each task commit. Fail -> Rule 1 deviation.

Rationale: The hard gate is the single highest-value feature. It prevents regressions during autonomous execution. Everything else is enhancement.

### Phase 2: Acceptance Layer (discuss + verify integration)

Build the human-owned acceptance test lifecycle.

4. **discuss-phase acceptance test gathering** — New question pass in interactive mode. Auto-context generation in auto mode.
5. **verify-phase acceptance test execution** — Run AT Verify commands, map to truths.
6. **plan-phase budget awareness** — Planner sees test count in prompt.

Rationale: The acceptance layer is the governance innovation. It gives humans a concrete, executable spec for what "done" means.

### Phase 3: Stewardship (test health + audit integration)

Build the long-term health management.

7. **Test steward agent** — Redundancy detection, stale test identification, consolidation proposals.
8. **audit-milestone integration** — Steward runs during audit, produces test health section.
9. **add-tests evolution** — Becomes "fill gaps" command for pre-existing phases.

Rationale: The steward is valuable but not urgent. It matters at milestone audit time, not during day-to-day execution.

**Defer:** Coverage tracking, visual reports, per-file mapping, flaky test detection.

## Sources

- [Simon Willison: First Run the Tests (Agentic Engineering Patterns)](https://simonwillison.net/guides/agentic-engineering-patterns/first-run-the-tests/) — PRIMARY. Validates "tests are non-negotiable for AI-generated code" and "first run the tests puts the agent in a testing mindset." HIGH confidence.
- [Simon Willison: Agentic Engineering Patterns](https://simonwillison.net/guides/agentic-engineering-patterns/) — Broader context on coding agent patterns. HIGH confidence.
- [Martin Fowler: Given When Then (bliki)](https://martinfowler.com/bliki/GivenWhenThen.html) — Canonical reference for BDD format. HIGH confidence.
- [TestCollab: From Vibe Coding to Spec-Driven Development](https://testcollab.com/blog/from-vibe-coding-to-spec-driven-development) — Validates spec-driven approach: specification as contract, tests from spec, AI implements against spec. MEDIUM confidence.
- [Stryker Mutator](https://stryker-mutator.io/) — JavaScript mutation testing framework. Detects redundant/ineffective tests via mutant analysis. HIGH confidence (established tool).
- [Sander van Beek: Automatically Detecting Redundant Tests](https://lakitna.medium.com/automatically-detecting-redundant-tests-be9151fdd855) — Techniques for automated redundancy detection using mutation analysis. MEDIUM confidence.
- [Semaphore: Accelerate CI/CD with BDD and Acceptance Testing](https://semaphore.io/blog/bdd-acceptance-testing) — BDD scenarios as automated gates in CI/CD pipelines. HIGH confidence.
- [Permit.io: Human-in-the-Loop for AI Agents](https://www.permit.io/blog/human-in-the-loop-for-ai-agents-best-practices-frameworks-use-cases-and-demo) — HITL patterns: approve/edit/reject middleware for agent tool calls. MEDIUM confidence.
- [GitHub: Accelerate TDD with AI (Copilot at Automattic)](https://github.com/readme/guides/github-copilot-automattic) — AI-assisted TDD workflow patterns. MEDIUM confidence.
- [Testrig: Reducing Redundant Tests Using AI-Powered Analysis](https://testrig.medium.com/reducing-redundant-tests-using-ai-powered-test-analysis-81bacf32db37) — Clustering and cosine similarity for test overlap detection. LOW confidence (single source).
- [Arxiv: Fine-Grained Approach for Detecting Redundant Test Cases](https://arxiv.org/pdf/2210.01661) — Tscope approach achieving 91.8% precision on NL test redundancy. MEDIUM confidence (academic).
- Existing GSD codebase analysis (execute-plan.md, verify-phase.md, discuss-phase.md, add-tests.md, tdd.md, audit-milestone.md, config.json) — PRIMARY. Direct code inspection of all integration points. HIGH confidence.

---
*Feature research for: Dual-Layer Test Architecture (GSD v1.6)*
*Researched: 2026-03-05*
