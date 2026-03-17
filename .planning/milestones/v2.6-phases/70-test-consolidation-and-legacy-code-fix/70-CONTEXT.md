# Phase 70: Test Consolidation and Legacy Code Fix - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Parameterize redundant tests across three test files to bring the total test count within the 800 budget, and add the missing STRUCT-01f entry to the `CHECK_ID_TO_LEGACY` mapping in `cli.cjs` to close the INT-06 backward-compatibility gap. This is a gap closure phase -- no new functionality, only consolidation and a one-line mapping fix.

</domain>

<decisions>
## Implementation Decisions

### Test Parameterization Strategy

- validation.test.cjs: 17 `'passes (skipped) when...'` tests follow an identical pattern (create temp project missing a prerequisite file, run check, assert passed) -- parameterize into a single `for...of` loop over a test descriptor array, yielding 1 parameterized test instead of 17 (from ROADMAP.md success criterion 1, audit consolidation proposal 1)
- init.test.cjs: cmdInitLinear and cmdInitPrReview share 5+ byte-for-byte identical tests (model fields, commit_docs, next_num, date/timestamp, path fields, booleans) -- extract a shared `for...of` loop over `['linear', 'pr-review']` commands, keeping only tests unique to each command as standalone (from ROADMAP.md success criterion 2, audit consolidation proposal 2)
- frontmatter-cli.test.cjs: 4 identical `'returns error for missing file'` tests across get/set/merge/validate subcommands -- parameterize into a single `for...of` loop over subcommand descriptors (from ROADMAP.md success criterion 3, audit consolidation proposal 3)
- Total test count must be at or below 800 after parameterization (from ROADMAP.md success criterion 5)

### Parameterization Pattern

- Use `node:test` `test()` inside a `for...of` loop with descriptive names like `test('skip-guard: ${desc}', ...)` (Claude's Decision: node:test supports dynamic test names in loops; this is the simplest pattern without introducing test.each or external helpers)
- Each parameterized group gets its own `describe` block with a clear name indicating it is parameterized (Claude's Decision: keeps test output readable and grep-able)
- Remove the original individual tests entirely after parameterization -- no duplicate coverage (from CLAUDE.md: always remove unused code)

### Legacy Code Mapping Fix (INT-06)

- Add `'STRUCT-01f': { code: 'W006', fix: 'Create phases/ directory' }` to the `CHECK_ID_TO_LEGACY` mapping in `cli.cjs` (from ROADMAP.md success criterion 4, audit tech debt finding)
- Use W006 as the legacy code since W001-W005 are already assigned and STRUCT-01f is a warning-severity check (Claude's Decision: W006 is the next available warning code following the existing W005 assignment for STRUCT-03)

### Test Count Arithmetic

- Current count: 750 tests (verified by test runner)
- Audit reported 822 but Phase 69 already consolidated to 750 -- the actual starting point is 750
- validation.test.cjs skip-guards: 17 tests become 1 parameterized test = -16 tests
- init.test.cjs shared tests: 12 tests (6 per command) become 7 (6 parameterized + 1 unique cmdInitPrReview test) = -5 tests (Claude's Decision: 5 of 6 tests in cmdInitPrReview are identical to cmdInitLinear; the reviews_dir test is unique)
- frontmatter-cli.test.cjs missing-file: 4 tests become 1 parameterized test = -3 tests
- Projected total: 750 - 16 - 5 - 3 = 726 tests (well within 800 budget)

### Claude's Discretion
- Exact naming convention for parameterized test descriptors
- Whether to keep the original describe blocks or merge parameterized tests into a new top-level describe
- Internal structure of test descriptor arrays (what fields each entry needs)
- Order of parameterization changes across files

</decisions>

<specifics>
## Specific Ideas

- The `CHECK_ID_TO_LEGACY` mapping in cli.cjs (line 406) currently maps STRUCT-01a through STRUCT-01e, STRUCT-03, and STRUCT-04 -- STRUCT-01f is the only missing entry
- The 17 skip-guard tests in validation.test.cjs all follow the same pattern: create temp dir with `.planning/` but missing a specific prerequisite, call `validateProjectHealth` or `runChecks`, find the check by ID, assert `passed === true`
- The cmdInitLinear tests (lines 867-948) and cmdInitPrReview tests (lines 954-1035) in init.test.cjs differ only in the command string (`'init linear'` vs `'init pr-review'`)
- The frontmatter-cli.test.cjs missing-file tests (lines 66, 120, 166, 265) all call `runGsdTools('frontmatter <subcommand> /nonexistent/...')` and assert error JSON with success exit code

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cli.cjs` `CHECK_ID_TO_LEGACY` (line 406): the mapping object that needs the STRUCT-01f entry
- `tests/helpers.cjs`: `createTempProject()`, `cleanup()`, `runGsdTools()` -- used by init.test.cjs and frontmatter-cli.test.cjs
- `validation.test.cjs`: 17 skip-guard tests to parameterize, each with its own temp dir setup/teardown

### Established Patterns
- `node:test` `describe`/`test`/`beforeEach`/`afterEach` used consistently across all test files
- Temp directory pattern: `fs.mkdtempSync` in `beforeEach`, `fs.rmSync` in `afterEach`
- No use of `test.each` or external parameterization helpers -- dynamic `for...of` loops are the project convention for parameterized tests (from testing.test.cjs patterns)

### Integration Points
- `cli.cjs` line 406-414: `CHECK_ID_TO_LEGACY` object -- add one entry
- `tests/validation.test.cjs`: refactor 17 skip-guard tests into 1 parameterized test
- `tests/init.test.cjs`: refactor cmdInitLinear/cmdInitPrReview shared tests
- `tests/frontmatter-cli.test.cjs`: refactor missing-file tests

</code_context>

<deferred>
## Deferred Ideas

- KNOWN_SETTINGS_KEYS deduplication between validation.cjs and cli.cjs handleSettings (pre-existing tech debt, not in scope)
- roadmap.test.cjs line 402 failure fix (pre-existing, not introduced by v2.6)
- Deterministic step detection in `gsd health` output (future -- DIAG-01)

</deferred>

---

*Phase: 70-test-consolidation-and-legacy-code-fix*
*Context gathered: 2026-03-16 via auto-context*
