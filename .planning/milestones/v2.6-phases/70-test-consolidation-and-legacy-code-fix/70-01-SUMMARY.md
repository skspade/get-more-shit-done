---
phase: 70-test-consolidation-and-legacy-code-fix
plan: 01
status: complete
started: 2026-03-16
completed: 2026-03-16
---

# Plan 70-01: Test Consolidation and Legacy Code Fix

## Result

All tasks completed successfully. Test count reduced and STRUCT-01f legacy mapping added.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Parameterize redundant tests in three test files | Complete |
| 2 | Add STRUCT-01f to CHECK_ID_TO_LEGACY mapping | Complete |

## Key Changes

### validation.test.cjs
- Extracted 17 individual skip-guard tests from their respective describe blocks
- Created a single parameterized describe block with a `skipGuardCases` array
- Each case specifies `checkId`, `description`, `category`, and `setup` function
- Tests cover: STRUCT-02, STRUCT-03, STRUCT-04, STATE-01 through STATE-04, NAV-01 through NAV-04, READY-01, READY-02, READY-04

### init.test.cjs
- Merged `cmdInitLinear` and `cmdInitPrReview` describe blocks into a single `for...of` loop over `['linear', 'pr-review']`
- All 7 shared tests now run for both commands via parameterization
- Removed ~90 lines of duplicated test code

### frontmatter-cli.test.cjs
- Extracted 4 identical `'returns error for missing file'` tests from get, set, merge, and validate describe blocks
- Added a single parameterized describe block at the end of the file
- Each case specifies `subcommand` and `args`

### cli.cjs
- Added `'STRUCT-01f': { code: 'W006', fix: 'Create phases/ directory' }` to CHECK_ID_TO_LEGACY mapping

## Metrics

- Static test count: 796 (within 800 budget)
- Runtime test count: 750 (749 pass, 1 pre-existing fail in roadmap.test.cjs)
- Lines removed: 318, Lines added: 168

## Self-Check: PASSED

- [x] validation.test.cjs skip-guard tests parameterized
- [x] cmdInitLinear/cmdInitPrReview shared tests parameterized
- [x] frontmatter-cli.test.cjs missing-file tests parameterized
- [x] STRUCT-01f has entry in CHECK_ID_TO_LEGACY with code W006
- [x] Total test count <= 800
- [x] All tests pass (749 pass, 1 pre-existing fail)

## key-files

### created
- .planning/phases/70-test-consolidation-and-legacy-code-fix/70-01-SUMMARY.md

### modified
- tests/validation.test.cjs
- tests/init.test.cjs
- tests/frontmatter-cli.test.cjs
- get-shit-done/bin/lib/cli.cjs
