# Phase 70: Test Consolidation and Legacy Code Fix - Research

**Researched:** 2026-03-16
**Status:** Complete

## Codebase Analysis

### Current Test Count
- **750 tests** total (749 passing, 1 failing — pre-existing roadmap.test.cjs failure)
- Budget: 800 tests max
- Target after consolidation: ~726 tests (-24 net reduction)

### validation.test.cjs Skip-Guard Tests (17 tests -> 1)
17 tests matching `'passes (skipped) when...'` pattern at lines: 299, 369, 410, 550, 558, 605, 651, 709, 774, 817, 851, 858, 931, 940, 1009, 1065, 1205.

Each test follows identical structure:
1. Run checks on tmpDir (which is missing a prerequisite)
2. Find check by ID
3. Assert `check.passed === true`

These span multiple describe blocks for different check IDs (STRUCT-02, STRUCT-03, STRUCT-04, STATE-01, STATE-02, etc.). The parameterization descriptor needs: `{ checkId, missingFile, description }`.

**Note:** Some skip-guard tests are in describe blocks with their own `beforeEach`/`afterEach` that set up partial `.planning/` directories. The parameterized version must handle varying setup requirements — some tests need only `.planning/` with nothing inside, others need `.planning/` with specific files but missing others.

### init.test.cjs Shared Tests (12 tests -> 7)
cmdInitLinear (lines 867-948): 7 tests
cmdInitPrReview (lines 954-1035): 7 tests

Identical tests between the two:
1. `'returns valid JSON with model fields'` — identical assertions
2. `'returns commit_docs config field'` — identical
3. `'returns next_num starting at 1 when no quick tasks exist'` — identical
4. `'returns date and timestamp fields'` — identical
5. `'returns path fields'` — identical
6. `'returns planning_exists and roadmap_exists booleans'` — identical

Different test (unique to each):
- cmdInitLinear: `'returns correct next_num when existing quick tasks are present'` — uses `'init linear'`
- cmdInitPrReview: `'returns correct next_num when existing quick tasks are present'` — uses `'init pr-review'`

Wait — actually both have the next_num test too. Comparing lines 905-915 and 993-1001: both create the same directories and assert `next_num === 4`. So all 7 tests are identical except the command string.

Parameterization: loop over `['linear', 'pr-review']` with 7 shared tests. Result: 7 parameterized tests (each runs for both commands) instead of 14 total. Net: -7 tests (better than the -5 estimate).

### frontmatter-cli.test.cjs Missing File Tests (4 tests -> 1)
4 tests at lines 66, 120, 166, 265 named `'returns error for missing file'`.

Each is in a separate describe block: `frontmatter get`, `frontmatter set`, `frontmatter merge`, `frontmatter validate`.

Pattern:
1. Call `runGsdTools('frontmatter <subcommand> /nonexistent/...')`
2. Assert `result.success` (exit 0)
3. Parse JSON, assert `parsed.error` exists

Parameterization descriptor: `{ subcommand, args }` where args vary slightly per subcommand (get needs just path, set needs path + flags, merge needs path + --data, validate needs path + --schema).

### CHECK_ID_TO_LEGACY Mapping (cli.cjs)
Located at line 406 in `get-shit-done/bin/lib/cli.cjs`.

Current entries: STRUCT-01a (E001), STRUCT-01b (E002), STRUCT-01c (E003), STRUCT-01d (E004), STRUCT-01e (W003), STRUCT-03 (W005), STRUCT-04 (I001).

Missing: STRUCT-01f — needs `{ code: 'W006', fix: 'Create phases/ directory' }`.

STRUCT-01f checks for the existence of `.planning/phases/` directory. It is a warning-severity check. W006 is the next available warning code after W005 (assigned to STRUCT-03).

### Project Patterns
- All test files use `node:test` with `describe`/`test`/`assert`
- Parameterized tests use `for...of` loops (no test.each)
- Temp directories via `fs.mkdtempSync` in `beforeEach`, `fs.rmSync` in `afterEach`
- CLAUDE.md: always remove unused code, keep implementations simple

## Validation Architecture

Not applicable — this is a gap closure phase with test refactoring only. No new validation checks introduced.

## RESEARCH COMPLETE
