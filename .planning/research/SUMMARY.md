# Project Research Summary

**Project:** GSD v2.9 — `/gsd:test-review` Command
**Domain:** PR diff-aware test analysis for autonomous development framework
**Researched:** 2026-03-21
**Confidence:** HIGH

## Executive Summary

This milestone adds a single on-demand command (`/gsd:test-review`) to the existing GSD Autopilot framework. The command is purely additive — no new npm dependencies, no new CJS modules beyond one init function, no changes to autopilot.mjs. It follows two well-established in-repo patterns: the direct agent spawn pattern from `audit-tests.md` (thin command orchestrator + read-only analysis agent), and the routing pattern from `pr-review.md` (user-choice quick task / milestone / done after report). The intellectual core of the feature is the `gsd-test-reviewer` agent, which performs static diff analysis using LLM reasoning rather than instrumented coverage tooling — consistent with every other GSD analysis tool.

The recommended implementation approach uses heuristic + LLM static analysis: the agent receives the git diff and test metadata, maps source files to test files via naming conventions and import-graph grepping, then detects coverage gaps, stale tests, and consolidation opportunities scoped to the changed files only. This is deliberately scoped to the diff rather than the full suite (as `audit-tests` does), making the output immediately actionable for the developer's current work. Post-analysis routing is user-driven rather than auto-scored, because test recommendations lack the natural severity scoring that PR review findings have.

The primary risks center on the agent receiving inputs that are too large (large diffs), too narrow (naming-only test file mapping), or context-unaware (ignoring the test budget). All three risks are preventable at the prompt-engineering level before implementation begins — retrofitting them post-build is more costly. The base branch resolution for `git diff` must also account for stale local branches. These four mitigations should be baked into the command spec and agent definition in Phase 1 and Phase 2, not deferred.

## Key Findings

### Recommended Stack

No new dependencies are required. The command is two markdown files (command spec + agent spec) plus one init function in `init.cjs` and one dispatch case in `gsd-tools.cjs`. All test data is gathered via existing `gsd-tools.cjs` dispatch entries (`test-count`, `test-config`, `commit`) and standard git commands.

See `.planning/research/STACK.md` for full stack details.

**Core technologies (all unchanged):**
- Claude Code CLI: executes the command spec, spawns the agent via `Task()` — all GSD commands are markdown files interpreted by Claude Code
- Git CLI: `git diff origin/main...HEAD` provides the primary input (changed files + full diff) — no parsing library needed, LLM handles unified diff format natively
- `gsd-tools.cjs` existing dispatch: `test-count`, `test-config`, `commit`, `generate-slug`, `resolve-model` — no new entries except `init test-review`
- `testing.cjs` existing exports: `findTestFiles()`, `countTestsInProject()`, `getTestConfig()` consumed indirectly via gsd-tools dispatch

**Explicitly avoided:**
- `diff-parse` / `parse-diff` npm packages — adds supply-chain surface for something Claude handles natively
- New `gsd-tools` dispatch entries beyond `init test-review` — no programmatic consumer exists for them
- Workflow file for the command — the pipeline is linear; a workflow file adds indirection without value (audit-tests pattern, not pr-review pattern)

### Expected Features

See `.planning/research/FEATURES.md` for full feature analysis with priority matrix and dependency graph.

**Must have (table stakes):**
- Source-to-test file mapping (naming conventions + import-graph check) — the core value proposition; without it the command is not diff-aware
- Coverage gap detection (new/changed exports without test assertions) — most common post-change question
- Stale test detection scoped to changed files — flags tests that reference deleted/renamed exports
- Structured markdown report at `.planning/reviews/YYYY-MM-DD-test-review.md` — every GSD analysis command produces a persistent report
- `--report-only` flag — analysis without routing, for users who want to decide themselves
- User-choice routing (quick task / milestone / done) — test findings require human judgment, not auto-scoring
- Read-only constraint — analysis agents never modify source or test files; users trust it cannot break anything

**Should have (differentiators):**
- Diff-scoped consolidation recommendations — redundancy in the area you are already working is more actionable than a global report
- Missing test file detection — "you modified `lib/parser.cjs` but `tests/parser.test.cjs` does not exist"
- Budget context in report — "project is at 103% budget" informs whether to add tests or consolidate first

**Defer (post-v2.9):**
- Integration with `audit-milestone` (auto-run test-review during milestone audit) — validate standalone first
- Custom source-to-test mapping configuration — naming conventions cover the common case
- Budget impact projection ("+N tests would bring you to X%") — nice but not essential for launch

### Architecture Approach

The architecture is a two-file addition: a thin command orchestrator (`test-review.md`) that gathers data and handles routing, and a read-only analysis agent (`gsd-test-reviewer.md`) that receives a structured XML input block and returns a structured markdown report. The command uses the direct agent spawn pattern (no workflow file needed — the pipeline is linear: gather, analyze, report, route). Routing reuses the quick task and milestone infrastructure proven in pr-review, with the key difference that routing is always user-driven rather than auto-scored.

See `.planning/research/ARCHITECTURE.md` for full component responsibility table, data flow diagrams, and anti-patterns.

**Major components:**
1. `commands/gsd/test-review.md` (NEW) — thin orchestrator: parse args, gather diff + test data, spawn agent, write report, user prompt, route to quick/milestone/done
2. `agents/gsd-test-reviewer.md` (NEW) — 6-step read-only analysis agent: diff parsing, coverage gap detection, staleness detection, consolidation recommendations, report compilation
3. `init.cjs` cmdInitTestReview() (NEW function, existing file) — resolves models, paths, timestamps, quick task numbering; near-copy of cmdInitPrReview()
4. `gsd-tools.cjs` init test-review case (NEW case, existing file) — one-line dispatch entry routing to cmdInitTestReview
5. All existing infrastructure — `testing.cjs`, quick task directories, milestone routing, `.planning/reviews/` — reused without modification

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all six critical pitfalls with full prevention strategies and phase-to-prevention mapping.

1. **Large diff context overflow** — Add a diff size gate in the command spec (~2,000 lines threshold); pass `--stat` + file list for large diffs and let the agent pull file details on demand via Read/Grep tools. Address in Phase 1 (command spec).

2. **Name-only test file mapping produces false positives** — Agent must check import/require statements in test files, not just naming conventions. A single Grep per changed source file catches tests that cover it under a different name. Address in Phase 2 (agent definition).

3. **Staleness false positives from internal refactors** — Agent must differentiate removed/renamed exports (HIGH priority) from internal implementation changes (LOW priority). Tests referencing changed internal variables are not stale in a breaking way. Address in Phase 2 (agent definition).

4. **Budget-unaware recommendations create add/remove cycles** — With the project at 826/800 (103.25% of budget), recommending new tests without mentioning budget causes test inflation that the steward immediately flags for removal. Agent prompt must order consolidation recommendations above new test recommendations when over budget. Address in Phase 2 (agent definition).

5. **Stale local `main` branch fails the diff** — Use `origin/main` with fallback chain (`origin/main` -> `origin/master` -> `main` -> `master`), preceded by `git fetch origin main --quiet`. Address in Phase 1 (command spec).

6. **Quick task routing loses recommendation detail** — Each recommendation type (missing/stale/consolidation) has different fields; forcing them into a generic `<group>` XML format loses the specificity the planner needs to create actionable tasks. Define type-specific XML elements and include the full report path as a `<files_to_read>` directive. Address in Phase 3 (routing implementation).

## Implications for Roadmap

The natural dependency order maps cleanly to four phases that the architecture research already confirms. Phase 1 and Phase 2 together produce a working feature (report-only mode functional). Phase 3 adds routing. Phase 4 validates and documents.

### Phase 1: Command Spec + Infrastructure
**Rationale:** The command spec defines the entire data flow, edge cases, and input format before the agent is written. Building the command first establishes the contract the agent must satisfy. Critical mitigations (diff size gate, base branch resolution) must be in the command spec before anything else — retrofitting them is more expensive after the agent is written to expect a specific input format.
**Delivers:** `commands/gsd/test-review.md` (working through report write step, `--report-only` mode functional), `init.cjs` cmdInitTestReview(), `gsd-tools.cjs` init test-review dispatch case
**Addresses:** `--report-only` flag, structured report output, data gathering pipeline, report persistence
**Avoids:** Large diff context overflow (Pitfall 1), stale local main (Pitfall 5) — both must be in the command spec before implementation

### Phase 2: Agent Definition
**Rationale:** The agent is the intellectual core of the feature. It must be written with full awareness of the mitigations from Phase 1 (what input format it receives, how large inputs are bounded). Budget awareness and import-graph checking are prompt engineering decisions that are far harder to retrofit after the agent is used in production and users have formed expectations about its output.
**Delivers:** `agents/gsd-test-reviewer.md` — 6-step read-only analysis agent with import-graph checking, priority-level staleness detection, and budget-aware recommendation ordering
**Addresses:** Coverage gap detection, stale test detection, consolidation recommendations, missing test file detection, budget context
**Avoids:** Name-only mapping false positives (Pitfall 2), staleness false positives (Pitfall 3), budget-unaware add/remove cycles (Pitfall 4)

### Phase 3: Routing Implementation
**Rationale:** Routing (quick task / milestone / done) depends on the report format established in Phase 2. The XML context format for the planner must match the recommendation types in the report — this can only be defined accurately after the report structure is known. Routing also requires the init function from Phase 1.
**Delivers:** Complete routing in `test-review.md` — quick task spawn (planner + executor + STATE.md update), milestone delegation (MILESTONE-CONTEXT.md + /gsd:new-milestone --auto), zero-recommendation exit path
**Addresses:** User-choice routing, quick task creation, milestone creation
**Avoids:** Quick task routing context mismatch (Pitfall 6), routing prompt on empty recommendations

### Phase 4: Documentation + Tests
**Rationale:** Documentation and tests validate a working implementation. Writing them before the feature is stable wastes effort on a moving target. Tests for the init function mirror the pr-review init tests — straightforward once the function is stable.
**Delivers:** `commands/gsd/help.md` update, `USER-GUIDE.md` section, `README.md` command table entry, `node:test` tests for cmdInitTestReview()
**Addresses:** Documentation requirement, test coverage for new CJS code

### Phase Ordering Rationale

- **Command before agent:** The command spec defines the input contract the agent receives. Writing the agent first risks designing around assumptions that the command spec then contradicts.
- **Agent before routing:** The routing XML context format must match the agent's output structure. Defining routing before the report format is known produces a mismatch (Pitfall 6).
- **Mitigations in Phase 1 and 2, not Phase 3:** Context overflow, base branch resolution, import-graph checking, and budget awareness are all baked into the inputs/prompts. The earlier they are defined, the cheaper they are to get right.
- **Documentation last:** No user-facing docs should be written until the feature is end-to-end functional. Updating help.md before routing works would document incomplete behavior.

### Research Flags

Phases with well-documented patterns (skip research-phase during planning):
- **Phase 1:** Command spec pattern is well-established (`audit-tests.md`, `pr-review.md` provide exact models). Init function is a near-copy of `cmdInitPrReview()`. All patterns have HIGH-confidence references in the existing codebase.
- **Phase 2:** Agent definition pattern is well-established (`gsd-test-steward.md` provides the exact read-only analysis agent model). The 6-step structure is defined in the design doc.
- **Phase 3:** Routing patterns are fully established by pr-review's quick task and milestone routes. The only novel element is the type-specific XML context format, which can be defined inline during implementation without additional research.
- **Phase 4:** Documentation and test patterns are trivially established by existing commands.

No phases require `/gsd:research-phase` during planning. All patterns have HIGH-confidence references in the existing codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection confirmed all existing dispatch entries, module exports, and file patterns. No new dependencies — zero uncertainty about tooling. |
| Features | HIGH | Primary sources are existing codebase patterns and the approved design doc. Domain research confirms the heuristic + LLM approach is the right fit for GSD's zero-config constraint. |
| Architecture | HIGH | Direct analysis of `audit-tests.md`, `pr-review.md`, `gsd-test-steward.md`, `init.cjs`, and `gsd-tools.cjs`. Component boundaries and data flow are fully specified in the design doc and validated against production code. |
| Pitfalls | HIGH | Derived from direct design doc analysis and comparison with existing command implementations. The project's test budget situation (826/800 = 103.25%) is a concrete data point, not speculation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Git diff size threshold:** The ~2,000-line threshold for switching to summarized mode is a heuristic, not a measured value. Validate during Phase 1 implementation by running the command on branches with varying diff sizes and observing agent behavior. Adjust threshold based on observed context window performance.
- **Import-graph check performance boundary:** PITFALLS.md flags O(changed * tests) Grep calls as a potential slowdown for branches touching >20 source files with >100 test files. This is within acceptable range for this project's current size (826 tests) but should be noted as a future scaling concern.
- **Empty recommendations flow:** The design doc mentions zero-recommendation handling but does not fully specify whether to skip the routing prompt entirely or still offer "done". Resolve during Phase 3 implementation — the simplest approach (skip routing, display "no issues found", exit cleanly) should be the default.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `.planning/designs/2026-03-20-pr-test-review-command-design.md` — approved design doc specifying command flow, agent steps, input/output format, routing
- `commands/gsd/audit-tests.md` — direct agent spawn pattern (thin command + read-only agent)
- `commands/gsd/pr-review.md` — routing pattern (quick task + milestone + done), report output, XML context format
- `agents/gsd-test-steward.md` — read-only analysis agent pattern (6-step structure, tool constraints, consolidation vocabulary)
- `get-shit-done/bin/lib/testing.cjs` — confirmed exports: findTestFiles(), countTestsInProject(), getTestConfig(), detectFramework()
- `get-shit-done/bin/gsd-tools.cjs` — confirmed dispatch entries: test-count (line 642), test-config (line 659), commit, generate-slug, resolve-model
- `get-shit-done/bin/lib/init.cjs` — cmdInitPrReview() as template for cmdInitTestReview()
- `.planning/PROJECT.md` — v2.9 requirements; test budget at 826/800 (103.25%)

### Secondary (MEDIUM confidence — domain research)

- [diff_cover](https://github.com/Bachmann1234/diff_cover) — demonstrates diff-to-coverage mapping pattern; confirms the approach is well-understood
- [Test Impact Analysis (Martin Fowler)](https://martinfowler.com/articles/rise-test-impact-analysis.html) — canonical reference for static vs dynamic TIA; validates heuristic approach for zero-config environments
- [minware Test Impact Analysis](https://www.minware.com/guide/best-practices/test-impact-analysis) — file-level dependency mapping without instrumentation; supports import-graph check approach

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
