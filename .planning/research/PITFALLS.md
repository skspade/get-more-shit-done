# Pitfalls Research

**Domain:** Diff-aware test review command (`/gsd:test-review`) — git diff parsing, test file mapping, LLM-based analysis, and routing integration in GSD v2.9
**Researched:** 2026-03-21
**Confidence:** HIGH (direct codebase analysis of design doc, existing patterns, and all integration points)

## Critical Pitfalls

### Pitfall 1: Git Diff Exceeds LLM Context Window on Large Branches

**What goes wrong:**
The command runs `git diff main...HEAD` and passes the full diff as part of the `<test-review-input>` XML block to the `gsd-test-reviewer` agent. Long-lived branches or branches touching many files produce diffs of 10,000+ lines. Combined with the changed file list, test file list, test config, and the agent's own prompt, the input exceeds the agent's effective context window. The agent either truncates analysis (silently dropping late-in-diff files), hallucinates coverage gaps for files it cannot see fully, or fails outright with a context error.

**Why it happens:**
The design passes `{full git diff main...HEAD}` without any size gate. The pr-review command avoids this by running a toolkit that processes incrementally, but test-review sends the raw diff as a single blob. There is no precedent in the existing GSD commands for passing large git diffs directly to an agent — the pr-review toolkit handles its own diff reading internally.

**How to avoid:**
Add a diff size gate in the command spec before spawning the agent. Measure the diff in lines (`git diff main...HEAD | wc -l`). If above a threshold (suggested: 2,000 lines), switch to a summarized mode: pass only the `--stat` output and changed file list instead of the full diff, and instruct the agent to read specific files via its Read/Grep tools as needed during analysis. The agent already has Read, Bash, Grep, and Glob tools — let it pull details on demand rather than receiving everything upfront.

**Warning signs:**
- Agent report covers only files early in the diff alphabetically and ignores later files
- Agent produces recommendations for files not actually in the diff (hallucination from context overflow)
- Agent Task() call fails or returns truncated output on branches with many changes

**Phase to address:**
Phase 1 (command spec) — the diff size gate and fallback strategy must be defined in the command spec before implementation. Retrofitting it means changing both the command and the agent prompt.

---

### Pitfall 2: Test File Mapping Uses Only Naming Convention, Misses Non-Standard Patterns

**What goes wrong:**
The agent's step 2 (Coverage Gap Analysis) maps source files to test files using naming conventions: `foo.ts` maps to `foo.test.ts` or `foo.spec.ts`. This misses projects (including this one) where test files live in a `__tests__/` directory, where test file names don't match source file names, or where a single test file covers multiple source modules. The agent flags "missing test coverage" for files that are actually well-tested under a different naming scheme, producing false positive recommendations that waste developer time.

**Why it happens:**
The design doc says "check if a corresponding test file exists (naming conventions: `foo.ts` -> `foo.test.ts`, `foo.spec.ts`)" — a 1:1 name-based mapping. In this codebase, test files like `testing.test.cjs` cover `testing.cjs`, but `validation.test.cjs` covers both `validation.cjs` and parts of `phase.cjs`. The naming convention heuristic has no way to discover that `phase.cjs` functions are tested in `validation.test.cjs`.

**How to avoid:**
The agent prompt must instruct it to go beyond naming conventions: after the naming-convention check, the agent should grep test files for import/require statements referencing the changed source file. If `validation.test.cjs` does `require('./validation.cjs')` or `require('./phase.cjs')`, it covers both. This import-graph check catches the common case where test files import source files regardless of naming. The agent has Grep and Read tools — it can do this during analysis without any new infrastructure.

Additionally, the agent should check whether changed functions/exports are referenced by name in any test file, not just the conventionally-named one.

**Warning signs:**
- Report flags "missing test coverage" for files that have test imports in non-matching test files
- High count of "missing coverage" recommendations that are false positives
- Users learn to ignore the report because it cries wolf

**Phase to address:**
Phase 2 (agent definition) — the agent's step 2 instructions must include import-graph checking alongside naming conventions. This is prompt engineering, not infrastructure work.

---

### Pitfall 3: Staleness Detection Produces False Positives for Refactored But Functionally Unchanged Code

**What goes wrong:**
The agent's step 3 (Staleness Detection) flags tests as stale when they "reference renamed/removed functions, changed signatures, or deleted modules." But many diffs rename internal variables, refactor implementation details, or change non-public functions — the tests still pass and still test the correct behavior. The agent sees "function `computePhaseStatus` had parameter `opts` renamed to `options`" in the diff and flags every test referencing `computePhaseStatus` as potentially stale, even though the function's public API and behavior are unchanged. The result is a report full of false stale-test warnings.

**Why it happens:**
The agent analyzes the diff textually — it sees what lines changed but cannot run the tests to verify they still pass. It cannot distinguish between a breaking change (function removed, signature changed incompatibly) and a cosmetic change (internal rename, comment edit, whitespace). Without execution context, any change near a tested function looks potentially stale.

**How to avoid:**
Instruct the agent to differentiate between exported/public API changes and internal implementation changes. The staleness check should focus on: (1) removed or renamed exports, (2) changed function signatures (parameter count, parameter types if TypeScript), (3) deleted files. Internal refactors within a function body should be flagged as LOW priority at most, not as stale tests. Add a priority field to stale test recommendations: HIGH for removed exports, MEDIUM for signature changes, LOW for internal refactors.

Also: the command already has access to `gsd-tools test-run` — consider running the test suite before analysis and including pass/fail status in the agent input. A test that passes is by definition not stale in a breaking way.

**Warning signs:**
- Stale test count is high (>5) on a branch with minor refactors
- All "stale" tests actually pass when run
- Users stop trusting staleness detection and skip the section

**Phase to address:**
Phase 2 (agent definition) — staleness detection priority levels must be in the agent prompt. Optionally, Phase 1 could add a pre-analysis test run to the command, but that adds execution time and is not strictly necessary.

---

### Pitfall 4: Routing Integration Misaligns with Existing Quick Task Infrastructure

**What goes wrong:**
The design says routing after the report follows "existing quick task or milestone patterns" from pr-review. But the quick task pattern in pr-review creates file-region groups with severity, agent, file, line, and fix_suggestion fields. Test-review findings have a different structure: missing tests have file + function + reason + priority; stale tests have test_file + test_name + issue + action; consolidation has strategy + source + action + reduction. If the test-review command tries to reuse pr-review's XML format (`<test-review-findings>` with `<group>` elements), it loses the structural detail. If it invents its own format, the planner that receives it needs to understand a new context schema.

**Why it happens:**
The design doc's routing section shows an XML format that is simpler than pr-review's format. It groups by type (missing/stale/consolidation) with a single file and action. But a single "missing test" recommendation might involve multiple functions in one file, or one function tested across multiple files. Flattening this into one `<group>` per recommendation loses the nuance that makes the planner's task descriptions accurate.

**How to avoid:**
Define the quick task context format to match the recommendation structure exactly. Each recommendation type should have its own XML element structure matching its fields from step 5 of the agent. Do not try to unify missing/stale/consolidation into a single generic `<group>` format — they have different fields and different task shapes.

For the planner: include the full report path (`.planning/reviews/YYYY-MM-DD-test-review.md`) as a `<files_to_read>` directive so the planner can reference the detailed report, not just the summary XML. The XML provides structure for task creation; the report provides context for task descriptions.

**Warning signs:**
- Quick task plan has tasks that say "fix test" without specifying which test or what the fix is
- Planner creates one giant task instead of per-recommendation tasks
- Milestone context lacks enough detail for discuss-phase to understand the scope

**Phase to address:**
Phase 3 (routing implementation) — the context format for quick task and milestone routing must be defined alongside the report format, not as an afterthought.

---

### Pitfall 5: Agent Recommends Tests That Would Violate Budget

**What goes wrong:**
The agent's step 2 (Coverage Gap Analysis) recommends writing new tests for uncovered functions. But the project has a test budget (800 project-wide, currently at 826/800 or 103.25%). Every "write a test for X" recommendation is a net addition. If the user routes to quick task and the executor writes all recommended tests, the budget goes further over. The test steward then flags the new tests for consolidation in the next milestone audit. The test-review command has created work that the steward immediately wants to undo.

**Why it happens:**
The agent receives `test_count` and `test_config` (which includes budget thresholds) in its input, but the design doc does not instruct the agent to factor budget into its recommendations. The agent is told to find gaps and recommend tests — it does not weigh those recommendations against budget constraints.

**How to avoid:**
Include budget status in the agent's analysis. The agent prompt should say: "If test count exceeds or is within 5% of the project budget, note the budget status in the report summary and prioritize consolidation recommendations over new test recommendations. For each 'missing test' recommendation, note whether it would push the budget further over." This lets the human make informed decisions rather than blindly adding tests.

The report's "Recommended Actions" section should order recommendations with budget awareness: consolidation first (reduces count), stale test updates second (neutral), new tests last (increases count).

**Warning signs:**
- Report recommends 10 new tests when budget is already over
- Quick task execution increases test count, immediately triggering steward warnings
- User cycle: test-review says "add tests" -> steward says "remove tests" -> repeat

**Phase to address:**
Phase 2 (agent definition) — budget awareness must be in the agent prompt, not retrofitted after users report the add/remove cycle.

---

### Pitfall 6: `git diff main...HEAD` Fails When Main Is Not Checked Out Locally

**What goes wrong:**
The command runs `git diff main...HEAD --name-only` as its first step. If the local `main` branch is stale (behind remote) or does not exist (shallow clone, CI environment, or renamed default branch like `master`), the command either diffs against an old main (producing a diff that includes commits already merged) or fails outright with `fatal: ambiguous argument 'main...HEAD'`.

**Why it happens:**
The design hardcodes `main` as the comparison base. Most local development environments have `main` checked out, but it may be behind `origin/main` by weeks. The diff then includes changes already merged to main by other work, producing a bloated diff and recommendations for code the developer did not touch.

**How to avoid:**
Use `origin/main` instead of `main` as the diff base, with a fallback chain: `origin/main` -> `origin/master` -> `main` -> `master`. Before diffing, run `git fetch origin main --quiet` to ensure the ref is current. If all bases fail, display an error: "Could not determine base branch. Ensure origin/main exists." This mirrors how most CI/CD tools resolve the comparison base.

**Warning signs:**
- Report includes recommendations for files the developer did not change on this branch
- Diff file count is much higher than expected (includes previously merged work)
- Command fails in CI with "ambiguous argument" error

**Phase to address:**
Phase 1 (command spec) — the base branch resolution must be defined before implementation. Changing it later means updating both the command and tests.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Passing full diff as a single blob without size gate | Simpler command implementation | Agent hallucinates or truncates on large branches | Never — large diffs are the norm in real work |
| Name-only test file mapping without import checking | Simpler agent prompt | False positive "missing coverage" erodes trust | Never — import-graph check is one Grep call per file |
| Hardcoding `main` as diff base | Simpler command | Fails in repos with `master`, CI, or stale local main | Never — fallback chain is trivial to implement |
| Ignoring budget in agent recommendations | Simpler agent prompt | Creates add/remove cycle with test steward | Acceptable for first iteration if budget status is shown in report summary |
| Single `<group>` XML format for all recommendation types | Simpler routing template | Planner loses structural detail, tasks are vague | Never — each type has different fields that matter for task accuracy |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `test-review.md` command -> `gsd-test-reviewer` agent | Passing too much data upfront (full diff + all test files) instead of letting agent pull on demand | Pass file list and stats; let agent Read/Grep specific files as needed for large diffs |
| Agent output -> report file | Writing the raw agent output as the report instead of structuring it | Agent produces structured markdown per the output format template; command writes it directly since the agent's output IS the report |
| Report -> quick task routing | Using pr-review's `<group>` format which loses test-review-specific fields | Define test-review-specific XML context format matching the three recommendation types |
| `findTestFiles()` in testing.cjs -> agent input | Passing absolute paths which confuse the agent (it expects project-relative) | Convert to relative paths before including in agent input: `path.relative(cwd, filePath)` |
| `gsd-tools commit` for report persistence | Committing the report before the user has chosen routing — routing then modifies state on top of report commit | Commit the report as a separate commit before routing begins, matching pr-review's pattern |
| `--report-only` flag -> routing skip | Flag parsed but routing code still prompts the user due to missing early return | Place the `--report-only` exit point immediately after report write, before any routing code |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running `git diff main...HEAD` twice (once for `--name-only`, once for full) | 2x git overhead on large repos | Capture full diff once, extract file names from it | Repos with >1000 changed files |
| Agent grepping every test file for imports of every changed file | O(changed * tests) Grep calls, agent runs for 10+ minutes | Limit import-graph check to files without a naming-convention match | Branches touching >20 source files in a repo with >100 test files |
| `findTestFiles()` walking entire directory tree for every invocation | Slow on large monorepos | Already handled — `EXCLUDE_DIRS` skips `node_modules`, `.git`, etc. | Not a concern for this project's size |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Report recommends tests for generated or vendored files in the diff | User confused by recommendations for files they should not test | Filter out common non-testable patterns: `*.d.ts`, `*.json`, `*.md`, files in `dist/`, `build/`, `vendor/` |
| No indication of analysis progress on large branches | User waits 2+ minutes with no feedback, thinks command is stuck | Display a banner with file count and estimated scope before spawning agent; agent Task() call will show streaming output via Claude's tool indicators |
| Report has 30+ recommendations with no prioritization | User overwhelmed, does nothing | Cap "Recommended Actions" at top 10, ordered by priority; full details remain in the categorized sections above |
| Routing prompt appears after a long report scroll | User loses context of what the recommendations were | Repeat the summary counts (N missing, N stale, N consolidation) inline with the routing prompt |

---

## "Looks Done But Isn't" Checklist

- [ ] **Large diff handling:** Run the command on a branch with 3000+ lines of diff changes — verify the agent does not hallucinate or truncate
- [ ] **Stale local main:** Delete local `main` branch, verify command falls back to `origin/main` or `origin/master`
- [ ] **No diff scenario:** Run on `main` branch itself — verify clean "No changes found vs main" exit
- [ ] **Budget-over reporting:** Run on a project already over budget — verify report mentions budget status and orders recommendations appropriately
- [ ] **False positive check:** For each "missing test" recommendation in the report, manually verify the function is actually untested (not tested under a different file name)
- [ ] **Report persistence:** Verify report is committed to git and appears in `.planning/reviews/`
- [ ] **`--report-only` flag:** Verify no routing prompt appears and command exits after report write
- [ ] **Quick task routing:** Verify the planner receives enough context to create specific tasks (not generic "fix tests")
- [ ] **Milestone routing:** Verify MILESTONE-CONTEXT.md is written with categorized recommendations
- [ ] **Empty recommendations:** Agent finds no issues — verify report says "no recommendations" and routing prompt is skipped (nothing to route)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context overflow on large diff | LOW | Add size gate to command spec; re-run with summarized mode |
| False positive test mapping | LOW | Update agent prompt to include import-graph check; re-run analysis |
| Stale base branch | LOW | Switch to `origin/main` with fallback chain; re-run |
| Budget-unaware recommendations cause test inflation | MEDIUM | Run test steward to identify consolidation targets; manually reconcile; update agent prompt for future runs |
| Quick task routing loses detail | LOW | Redefine XML context format; re-run routing; existing report is unchanged |
| Agent produces garbled report format | LOW | Agent prompt defines exact output format — fix prompt, re-run; report is overwritten |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Large diff context overflow | Phase 1 (command spec with size gate) | Command on a 3000-line diff uses summarized mode; agent report covers all changed files |
| Stale/missing `main` branch | Phase 1 (command spec with base branch resolution) | Command succeeds with no local `main` branch; uses `origin/main` fallback |
| Name-only test mapping false positives | Phase 2 (agent definition with import-graph check) | Agent report for a file tested under non-matching name shows "covered" not "missing" |
| Staleness false positives from internal refactors | Phase 2 (agent definition with priority levels) | Internal-only refactor produces LOW priority staleness, not HIGH |
| Budget-unaware recommendations | Phase 2 (agent definition with budget awareness) | Report on over-budget project mentions budget and prioritizes consolidation |
| Quick task context format mismatch | Phase 3 (routing implementation) | Planner creates per-recommendation tasks with correct specificity from XML context |
| Routing prompt for empty recommendations | Phase 3 (routing implementation) | Zero-recommendation report skips routing, exits cleanly |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `.planning/designs/2026-03-20-pr-test-review-command-design.md` — full design doc specifying command flow, agent steps, report format, and routing
  - `commands/gsd/pr-review.md` and `get-shit-done/workflows/pr-review.md` — existing routing pattern for quick task and milestone delegation; XML context format precedent
  - `commands/gsd/audit-tests.md` — existing agent-spawn pattern for test analysis; direct spawn without workflow file
  - `get-shit-done/bin/lib/testing.cjs` — `findTestFiles()` implementation (EXCLUDE_DIRS, TEST_FILE_PATTERNS), `countTestsInProject()`, `getTestConfig()` including budget thresholds
  - `.planning/PROJECT.md` — v2.9 active requirements, test budget at 826/800 (103.25%), architecture constraints, existing tech debt items

---
*Pitfalls research for: GSD v2.9 diff-aware test review command*
*Researched: 2026-03-21*
