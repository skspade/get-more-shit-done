# Feature Landscape

**Domain:** PR diff-aware test review command for autonomous development framework
**Researched:** 2026-03-21
**Confidence:** HIGH (primary sources are existing GSD codebase patterns, active PROJECT.md requirements, and domain research)

## Context: What Already Exists

This milestone adds a NEW command to an established system. The following are already built and available as dependencies:

- **Test steward agent** (`gsd-test-steward.md`) — redundancy detection, staleness detection, budget enforcement, consolidation proposals (4 strategies). Read-only analysis agent.
- **`/gsd:audit-tests` command** — on-demand steward spawning with banner/report presentation pattern.
- **`/gsd:pr-review` command** — PR diff capture, finding parsing, deduplication, scoring, routing to quick task or milestone. Report written to `.planning/reviews/`.
- **`testing.cjs`** — `findTestFiles`, `countTestsInProject`, `getTestConfig`, `detectFramework`, `parseTestOutput`. Test file discovery with `EXCLUDE_DIRS` set.
- **Quick task and milestone routing infrastructure** — `gsd-tools.cjs init`, slug generation, STATE.md updates, executor/planner spawning.
- **Consolidation bridge** (v2.8) — `gaps.test_consolidation` schema, budget gating, strategy-to-task mapping.

The NEW `/gsd:test-review` command is specifically about **diff-aware** test analysis: given code changes (from a PR or recent commits), what tests need attention?

## Table Stakes

Features users expect. Missing = command feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Map changed source files to related test files | The core value proposition. If the command cannot connect `src/foo.js` to `tests/foo.test.js`, it provides nothing beyond what `audit-tests` already does. Users invoke this command because they changed code and want to know which tests are affected. | MEDIUM | Heuristic-based: naming convention matching (foo.js -> foo.test.js, foo.spec.js), import/require tracing (which test files `require('./foo')`), directory structure convention. No instrumentation needed — LLM agent reads the files. Depends on: `findTestFiles` from `testing.cjs`. |
| Detect coverage gaps in changed code | Changed or added functions that have no corresponding test assertions. The most common question after a code change: "did I write tests for what I changed?" | MEDIUM | Agent reads diff hunks, identifies new/modified exported functions, checks if related test files exercise them. Not line-level coverage (that requires instrumentation) — function/export-level gap detection via static analysis by the agent. |
| Detect stale tests from changed code | When code changes rename, remove, or refactor functions, existing tests may reference deleted exports. Must flag tests that will fail or silently pass with wrong assertions. | LOW | Steward already does staleness detection globally. The diff-aware twist: scope staleness checks to only test files related to changed source files, making it faster and more relevant. |
| Structured markdown report output | Every GSD analysis command produces a persistent report. Users expect to find it at `.planning/reviews/YYYY-MM-DD-test-review.md` following the `pr-review` pattern. | LOW | Follows `pr-review` report pattern: YAML frontmatter with counts + markdown body with sections. Depends on: `.planning/reviews/` directory (already created by pr-review). |
| `--report-only` flag for analysis without routing | Not every test review needs to create tasks. Users may want to see the report, decide themselves, then optionally route later. The command must support "just tell me" mode. | LOW | When `--report-only` is set, skip routing step entirely. Display report, write file, exit. Follows the pattern of `--ingest` in pr-review (mode flags alter flow). |
| User-choice routing after report | Unlike pr-review (which auto-scores and routes), test review findings are more nuanced. Let the user decide: create a quick task, start a milestone, or just take the report and go. | LOW | AskUserQuestion with 3 options: (1) Quick task, (2) Milestone, (3) Done. Depends on: quick task infrastructure, milestone infrastructure (both exist from pr-review). |
| Read-only analysis (no file modifications) | Established pattern from steward and pr-review: analysis agents never modify source or test files. Users trust the command because it cannot break anything. | LOW | Agent constraint in spec: "You NEVER modify test files, source files, or create new tests." Same constraint as `gsd-test-steward`. |

## Differentiators

Features that set this command apart from just running `audit-tests`.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Diff-scoped analysis (not whole-suite) | `audit-tests` analyzes the entire test suite. For a 826-test project, that is slow and noisy. `/gsd:test-review` analyzes only tests related to what changed, making results immediately actionable. The diff is the scope filter. | MEDIUM | Agent receives list of changed files (from git diff or PR diff), maps to related test files, analyzes only those. Report sections are organized by changed file, not by test file. |
| Consolidation recommendations scoped to changed area | When you touch a module, you might notice its tests are redundant or bloated. Surfacing consolidation opportunities in the area you are already working is more actionable than a global report. | LOW | Reuse steward's 4-strategy framework (prune, parameterize, promote, merge) but scoped to test files related to the diff. Not a full steward run — just the intersection. |
| Missing test file detection | Beyond coverage gaps within existing tests: detect when a changed source file has NO corresponding test file at all. "You modified `lib/parser.cjs` but `tests/parser.test.cjs` does not exist." | LOW | Check naming conventions and import patterns. If no test file maps to a changed source file, flag it as a gap. Simple but high-signal finding. |
| Integration with existing test infrastructure data | Report includes budget context: "Project is at 103% budget. Adding tests for these gaps would increase count by ~N." Helps users make informed decisions about whether to add tests or consolidate first. | LOW | Pull budget data from `getTestConfig` and `countTestsInProject` (both exist in `testing.cjs`). Include as context section in report, not as a gate. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automatic test generation from diff | Generating test code requires understanding business logic, edge cases, and assertion semantics. AI-generated tests tend to be repetitive happy-path tests that inflate coverage without catching regressions. The `add-tests` workflow already handles test generation with human-guided acceptance criteria. | Report gaps with enough context (function signature, expected behavior hints) that the user or `add-tests` workflow can write meaningful tests. |
| Line-level coverage analysis (Istanbul/c8 integration) | Requires instrumentation, build tooling integration, and coverage report parsing. Adds a hard dependency on the project having coverage tooling configured. The GSD approach is agent-driven static analysis, not tooling-driven dynamic analysis. | Function/export-level gap detection via LLM reading source and test files. Good enough for "did you test this?" without requiring coverage infrastructure. |
| Auto-scoring and routing (like pr-review) | PR review findings have clear severity (critical/important/suggestion) that maps to a score. Test review findings are more subjective — a missing test for a utility function is different from a missing test for a critical auth module. Auto-routing would make wrong decisions. | Present findings, let user choose: quick task, milestone, or done. User has context about which gaps matter. |
| Git blame / change frequency analysis | "Files that change often should have more tests" is true but adds complexity (git log parsing, frequency thresholds) for marginal value in a single review session. | Focus on the current diff. Historical analysis is a future consideration. |
| Running tests as part of the review | The review command is analysis-only. Running tests conflates "what should be tested?" with "do tests pass?" — different questions with different workflows. Test execution belongs in the hard gate (execute-plan) and `ui-test`. | Report identifies gaps and staleness. User runs tests separately via the existing hard gate or manual invocation. |
| Cross-repository test mapping | Some monorepos have tests in separate packages. Supporting arbitrary test-to-source mappings across package boundaries adds significant complexity. | Support single-repo conventions. If test files are in a `tests/` or `__tests__/` directory following naming conventions, that covers the common case. |
| Watching for file changes (daemon mode) | A persistent watcher that re-runs test review on every save. Adds process management complexity and continuous resource usage. | On-demand invocation via `/gsd:test-review`. User runs it when they want a review, not continuously. |

## Feature Dependencies

```
Git diff / changed files list (input)
    |
    v
Source-to-test file mapping (heuristic)
    |-- naming convention: foo.cjs -> foo.test.cjs
    |-- import tracing: which test files require('./foo')
    |-- directory convention: src/foo -> tests/foo.test
    |
    +---> Coverage gap detection (per changed file)
    |         |-- reads changed functions/exports
    |         |-- checks if test file exercises them
    |         |-- reports missing coverage
    |
    +---> Staleness detection (scoped to related tests)
    |         |-- checks test references against current source
    |         |-- flags deleted/renamed exports
    |
    +---> Consolidation opportunities (scoped)
    |         |-- redundancy in related test files
    |         |-- parameterization candidates
    |
    +---> Missing test file detection
              |-- changed source file with no test file at all
    |
    v
Structured report (.planning/reviews/YYYY-MM-DD-test-review.md)
    |
    v
User routing choice (--report-only skips this)
    |-- Quick task -> existing quick task infrastructure
    |-- Milestone -> existing milestone infrastructure
    |-- Done -> exit
```

### Dependency on Existing Infrastructure

| Dependency | Module | What It Provides |
|------------|--------|-----------------|
| `findTestFiles` | `testing.cjs` | Discovers all test files in project |
| `countTestsInProject` | `testing.cjs` | Budget context for report |
| `getTestConfig` | `testing.cjs` | Budget thresholds, steward enabled flag |
| `detectFramework` | `testing.cjs` | Framework identification for report context |
| `gsd-tools.cjs init` | `gsd-tools.cjs` | Quick task / milestone initialization |
| `gsd-tools.cjs resolve-model` | `gsd-tools.cjs` | Agent model resolution |
| `gsd-tools.cjs generate-slug` | `gsd-tools.cjs` | Directory slug for quick tasks |
| `.planning/reviews/` | pr-review workflow | Report output directory (already exists) |
| Quick task creation pattern | pr-review workflow | STATE.md update, directory creation, executor spawning |

### New Components Required

| Component | Type | Purpose |
|-----------|------|---------|
| `gsd-test-reviewer` agent | Agent spec (`.md`) | 6-step diff-aware analysis agent, read-only |
| `/gsd:test-review` command | Command spec (`.md`) | Argument parsing, data gathering, agent spawning, routing |
| Report template | Within agent spec | Structured markdown output format |

## MVP Recommendation

### Launch With (v2.9)

Prioritize in this order:

1. **`/gsd:test-review` command spec** — argument parsing (`--report-only` flag), diff capture (git diff or user-provided), agent spawning, report presentation, user routing choice. Follows `audit-tests` pattern (command is thin orchestrator).
2. **`gsd-test-reviewer` agent** — 6-step read-only analysis:
   - Step 1: Receive diff / changed files list
   - Step 2: Map changed source files to test files (naming + import heuristics)
   - Step 3: Detect coverage gaps (new/changed exports without test assertions)
   - Step 4: Detect stale tests (references to deleted/renamed exports in related test files)
   - Step 5: Identify consolidation opportunities (scoped redundancy, parameterization candidates)
   - Step 6: Compile structured report
3. **Structured report output** — written to `.planning/reviews/YYYY-MM-DD-test-review.md` with YAML frontmatter
4. **User-choice routing** — quick task, milestone, or done (after report is presented)
5. **Documentation** — help.md, USER-GUIDE.md, README.md updates

### Defer (post-v2.9)

- Integration with `audit-milestone` (auto-run test-review during milestone audit) — let users validate the command standalone first
- Custom source-to-test mapping configuration — naming conventions cover the common case
- Budget impact projection ("adding these tests would bring you to N%") — nice but not essential

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Source-to-test file mapping | HIGH | MEDIUM | P1 |
| Coverage gap detection | HIGH | MEDIUM | P1 |
| Stale test detection (diff-scoped) | HIGH | LOW | P1 |
| Structured report output | HIGH | LOW | P1 |
| `--report-only` flag | MEDIUM | LOW | P1 |
| User-choice routing | HIGH | LOW | P1 |
| Read-only constraint | HIGH | LOW | P1 |
| Missing test file detection | MEDIUM | LOW | P1 |
| Diff-scoped consolidation recs | MEDIUM | LOW | P1 |
| Budget context in report | LOW | LOW | P1 |
| Documentation updates | MEDIUM | LOW | P1 |
| Budget impact projection | LOW | MEDIUM | P2 |
| Auto-run during milestone audit | LOW | MEDIUM | P2 |
| Custom source-to-test mapping config | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (v2.9)
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Comparison: Test Review Approaches

The domain offers two fundamental approaches to diff-aware test analysis. GSD uses the heuristic/LLM approach because it requires no instrumentation.

| Approach | How It Works | Pros | Cons | GSD Fit |
|----------|-------------|------|------|---------|
| **Instrumented coverage** (Istanbul, c8, JaCoCo) | Run tests with coverage, track which lines each test covers, diff against changed lines | Precise line-level mapping, definitive gap identification | Requires instrumentation setup, slow (runs full suite), project-specific config | Poor — adds hard dependency, violates zero-config principle |
| **Heuristic + LLM static analysis** | Naming conventions, import tracing, agent reads source + test files | Zero-config, works across frameworks, understands semantic gaps | Approximate (may miss indirect dependencies), no runtime data | Good — matches GSD's agent-driven, read-only, zero-config pattern |

**Recommendation:** Heuristic + LLM approach. Consistent with every other GSD analysis tool (steward, pr-review). The agent reads files and applies judgment — no build tooling integration required.

## Sources

- [diff_cover](https://github.com/Bachmann1234/diff_cover) — Open source tool for finding diff lines needing test coverage; demonstrates the diff-to-coverage mapping pattern
- [Teamscale Test Gap Analysis](https://teamscale.com/features/test-gap-analysis) — Commercial tool for identifying untested code changes; demonstrates the "changed code without tests" detection pattern
- [Test Impact Analysis (Martin Fowler)](https://martinfowler.com/articles/rise-test-impact-analysis.html) — Canonical reference for mapping source files to test cases; describes static vs dynamic TIA approaches
- [Codacy Diff Coverage](https://blog.codacy.com/diff-coverage) — PR-level coverage metrics; demonstrates the "coverage delta on PR" pattern
- [minware Test Impact Analysis](https://www.minware.com/guide/best-practices/test-impact-analysis) — Best practices for TIA without instrumentation; describes file-level dependency mapping
- `/Users/seanspade/Documents/Source/get-more-shit-done/.planning/PROJECT.md` — v2.9 active requirements, existing architecture, constraints
- `/Users/seanspade/Documents/Source/get-more-shit-done/agents/gsd-test-steward.md` — Steward analysis patterns (redundancy, staleness, consolidation)
- `/Users/seanspade/Documents/Source/get-more-shit-done/commands/gsd/audit-tests.md` — On-demand agent spawning pattern (command as thin orchestrator)
- `/Users/seanspade/Documents/Source/get-more-shit-done/commands/gsd/pr-review.md` — PR review command pattern (argument parsing, routing, report output)
- `/Users/seanspade/Documents/Source/get-more-shit-done/get-shit-done/bin/lib/testing.cjs` — Existing test infrastructure (findTestFiles, countTestsInProject, getTestConfig)

---
*Feature research for: /gsd:test-review — PR Diff-Aware Test Review (GSD v2.9)*
*Researched: 2026-03-21*
