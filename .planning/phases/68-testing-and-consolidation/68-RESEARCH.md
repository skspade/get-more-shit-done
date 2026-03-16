# Phase 68: Testing and Consolidation - Research

**Researched:** 2026-03-16
**Status:** Complete

## Current State Analysis

### Test Counts (verified)
- **Total tests:** 766 (confirmed via `node --test`)
- **Budget target:** 750
- **Deficit:** 16 tests over budget

### Test File Inventory

| File | Tests | Purpose |
|------|-------|---------|
| validation.test.cjs | 104 | Check categories (STRUCT, STATE, NAV, READY), auto-repair |
| verify-health.test.cjs | 14 | gsd-tools validate health dispatch |
| cli.test.cjs | 87 total, 17 in handleHealth | CLI routing including health adapter |
| autopilot.test.cjs | ~14 | Dry-run, static analysis, arg validation |

### TEST-01 (Category Tests): ALREADY SATISFIED
- `validation.test.cjs` has dedicated describe blocks for all check categories
- Uses `fs.mkdtempSync` temp directory fixtures with mock project structures
- No new tests needed

### TEST-02 (Auto-Repair Tests): ALREADY SATISFIED
- `validation.test.cjs` has `auto-repair` describe block with 8 tests
- Covers STATE-02/03/04 repair, NAV-04 repair, independence, no-repair-without-flag, result shape
- No new tests needed

### TEST-03 (Autopilot Pre-Flight): NOT YET COVERED
- `autopilot.mjs` lines 75-95: calls `validateProjectHealth(PROJECT_DIR, { autoRepair: true })`
- Logs repairs if any, exits with code 1 if `!healthResult.healthy`
- Current `autopilot.test.cjs` tests: dry-run integration (requires claude CLI), static analysis, argument validation
- **Pre-flight tests can import `validateProjectHealth` directly** and test with temp directories — no claude CLI needed
- Three scenarios required:
  1. Healthy project: `validateProjectHealth()` returns `{ healthy: true, repairs: [], errors: [] }`
  2. Unhealthy project: returns `{ healthy: false, errors: [...] }` — autopilot should exit(1)
  3. Repairable project: repairs succeed, result is healthy — autopilot should proceed
- **Implementation approach:** Since autopilot.mjs is an ESM script using zx, directly testing its pre-flight block requires either:
  - (a) Extract pre-flight into a testable function, or
  - (b) Test `validateProjectHealth()` directly against same scenarios (the pre-flight code is a thin wrapper)
- **Recommended:** Option (b) — test `validateProjectHealth()` with the same fixture patterns as the pre-flight uses. Add 3 tests to `autopilot.test.cjs` as a new describe block that validates the pre-flight contract (healthy passes, unhealthy with errors, repairable project). These tests call `validateProjectHealth` directly since the autopilot pre-flight is just `if (!result.healthy) process.exit(1)`.

### TEST-04 (Net-Zero Count): NOT YET MET
- Current: 766, target: 750, need to remove 16+
- `cli.test.cjs` handleHealth block (lines 535-712): 17 tests
- These test `routeCommand('health', ...)` which is a thin adapter over `validateProjectHealth()`
- Overlap analysis:
  - 7 file existence tests (HLTH-01) → covered by validation.test.cjs STRUCT-01a through STRUCT-01f
  - 3 config tests (HLTH-02) → covered by validation.test.cjs STRUCT-02
  - 2 state consistency tests (HLTH-03) → covered by validation.test.cjs STATE-01 through STATE-04
  - 2 error reporting tests (HLTH-04) → covered by validation.test.cjs result shape tests
  - 3 output mode tests → unique to CLI adapter layer
- **Plan:** Remove 14 redundant tests, keep 3 output mode/adapter tests as smoke tests
- Math: 766 - 14 + 3 (pre-flight) = 755, still 5 over
- **Additional removal candidates:** Need to find 5+ more redundant tests across all files

### Additional Redundancy Scan

Checked for other overlap areas:
- `verify-health.test.cjs` (14 tests): Tests gsd-tools dispatch integration — not redundant with validation.test.cjs since it tests a different consumer path
- `autopilot.test.cjs` dry-run tests (2 tests): Skip when no claude CLI, effectively 0 tests running in CI — not candidates for removal
- `cli.test.cjs` other sections: Not health-related, not in scope

**To close the 5-test gap after removing 14 handleHealth tests and adding 3 pre-flight tests (755 total):**
- Option A: Keep only 2 output mode smoke tests instead of 3 (remove the plain mode test which is weakest) → 754
- Option B: Review if any validation.test.cjs tests are duplicative within themselves
- Option C: Reduce pre-flight tests from 3 to 2 (combine repairable scenario) → 754
- **Recommended:** Option A — remove 15 handleHealth tests (keep 2 smoke tests), add 3 pre-flight → 766 - 15 + 3 = 754 (4 under budget). Alternatively, if that's too aggressive, remove 14 + reduce pre-flight to 2 = 766 - 14 + 2 = 754.

## Technical Notes

### Autopilot Pre-Flight Test Pattern
```javascript
// In autopilot.test.cjs, new describe block:
const { validateProjectHealth } = require('../get-shit-done/bin/lib/validation.cjs');

describe('autopilot pre-flight validation', () => {
  // Use same tmpDir pattern as validation.test.cjs
  // Test 1: healthy project → validateProjectHealth returns { healthy: true }
  // Test 2: unhealthy project (missing PROJECT.md) → returns { healthy: false, errors: [...] }
  // Test 3: repairable project (stale STATE.md counts) → returns { healthy: true } after repair
});
```

### CLI Smoke Tests to Keep
1. `rich mode returns message with ANSI codes` — verifies the adapter produces formatted output
2. `JSON mode returns all structured fields` — verifies the adapter maps ValidationResult to legacy shape

### Failing Test Note
- `roadmap.test.cjs` line 402: `detects checklist-only phases missing detail sections` — pre-existing failure unrelated to Phase 68

## Risk Assessment

- **Low risk:** All changes are test-only, no production code modifications
- **Key constraint:** Must hit 750 or below — math must be exact
- **Verification approach:** Run `node --test` after changes and confirm count

## RESEARCH COMPLETE
