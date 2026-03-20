# Phase 71: Test Infrastructure and Detection Foundation - Research

**Researched:** 2026-03-20
**Status:** Complete

## Phase Goal

GSD can detect Playwright installation state, parse Playwright test output, and safely exclude E2E specs from the test budget.

## Codebase Analysis

### testing.cjs Structure

**EXCLUDE_DIRS (line 89):** `Set(['node_modules', '.git', '.planning', 'dist', 'build', 'coverage'])` — used in `findTestFiles()` recursive walker. Adding `'e2e'` to this Set is the complete integration for INFRA-04.

**detectFramework (line 17):** Two-tier detection pattern: check config files first (`fs.existsSync`), then fall back to `package.json` dependency scanning. Returns framework name string or `null`. The new `detectPlaywright()` follows this pattern but returns a richer object `{ status, config_path }` for three-tier detection.

**parseTestOutput (line 286):** Switch statement with cases for `node:test`, `jest`, `vitest`, `mocha`, and `default`. Each case uses regex to extract pass/fail/total counts from runner-specific output format. Returns `{ total, passed, failed, failedTests: [] }`.

**cmdTestDetectFramework (line 524):** Thin wrapper calling `detectFramework(cwd)` and passing result to `output()`. Pattern for `cmdPlaywrightDetect`.

**module.exports (line 534):** Lists all public functions — new exports appended here.

### gsd-tools.cjs Dispatch

**Line 648:** `case 'test-detect-framework'` calls `testing.cmdTestDetectFramework(cwd, raw)`. New `case 'playwright-detect'` follows identical pattern.

### package.json

**devDependencies (line 26):** Currently `c8` and `esbuild`. Adding `@playwright/test` here.

### Test Budget

Project at 796/800 (99.5%). INFRA-04 (`e2e/` exclusion) is critical to land before Phase 72 generates any `.spec.ts` files, preventing budget overflow.

## Playwright Output Format Analysis

Playwright's default line reporter produces summary lines like:
- `"2 passed (3.1s)"`
- `"3 passed, 1 failed (5.2s)"`
- `"5 passed, 2 skipped (8.1s)"`
- `"1 failed, 2 skipped (4.0s)"`

Regex patterns needed:
- Passed: `/(\d+)\s+passed/`
- Failed: `/(\d+)\s+failed/`
- Skipped: `/(\d+)\s+skipped/`
- Total: computed as `passed + failed + skipped`

Failed test names appear as numbered list in output:
```
  1) test-file.spec.ts:12:5 > test name
  2) test-file.spec.ts:24:3 > another test
```
Pattern: `/^\s+\d+\)\s+(.+)$/gm`

## Implementation Ordering

1. **INFRA-04 first** — Add `'e2e'` to EXCLUDE_DIRS (prevents budget overflow, zero risk)
2. **INFRA-01 + INFRA-02** — `detectPlaywright()` + `playwright-detect` command (detection infrastructure)
3. **INFRA-03** — `parsePlaywrightOutput()` case in `parseTestOutput()` (output parsing)
4. **INFRA-05** — `@playwright/test` devDependency (enables detection testing)

All changes are additive. No existing behavior modified. Single wave execution is safe.

## Test Strategy

Existing test file: `tests/testing.test.cjs` — 796 tests in budget.

New tests needed (must stay within budget):
- `detectPlaywright()` — 3 scenarios: configured (config file exists), installed (package.json only), not-detected
- `cmdPlaywrightDetect` CLI — JSON output, raw mode, real codebase detection
- `parseTestOutput('playwright')` — passed only, passed+failed, passed+skipped, all three
- `findTestFiles` with e2e/ exclusion — verify e2e/ specs not counted
- Keep test count minimal: ~12-15 new tests maximum

## Risk Assessment

**Low risk:** All changes are additive to existing patterns. No refactoring. No behavior changes to existing code paths.

**Budget concern:** At 796/800, we have 4 test slots. New tests will exceed budget — but INFRA-04 excludes `e2e/` directory, and the new tests are for infrastructure, not e2e specs. The budget may need phase-level awareness.

## RESEARCH COMPLETE
