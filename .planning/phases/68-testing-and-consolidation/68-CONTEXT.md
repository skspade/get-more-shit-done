# Phase 68: Testing and Consolidation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Ensure every check category (STRUCT, STATE, NAV, READY) and auto-repair logic has test coverage, add autopilot pre-flight integration tests, and bring the total test count to net-zero or net-negative versus the pre-milestone count of 750. This phase migrates and consolidates existing health tests rather than adding net-new tests on top of the 766 already present.

</domain>

<decisions>
## Implementation Decisions

### Test Scope and Coverage Targets

- Tests must exist for each check category: STRUCT, STATE, NAV, READY using mock filesystem fixtures (from REQUIREMENTS.md TEST-01)
- Auto-repair tests must verify that repairs fix issues and re-validation passes (from REQUIREMENTS.md TEST-02)
- Autopilot pre-flight integration tests must confirm correct behavior for healthy, unhealthy, and repairable project states (from REQUIREMENTS.md TEST-03)
- Total test count must be at or below 750 after this phase completes (from REQUIREMENTS.md TEST-04, ROADMAP.md success criterion 4)

### Current Test Inventory and Migration Strategy

- `validation.test.cjs` already has 104 tests covering STRUCT, STATE, NAV, READY categories and auto-repair -- these were added during Phases 64-67 (Claude's Decision: these tests already satisfy TEST-01 and TEST-02; no new category tests needed)
- `verify-health.test.cjs` has 14 tests covering the gsd-tools validate health dispatch -- these were added/migrated during Phase 67 (Claude's Decision: these tests already cover the consumer integration via gsd-tools)
- `cli.test.cjs` has ~15 health-related tests in the `handleHealth` describe block (lines 535-687) that test the CLI consumer path via `routeCommand('health', ...)` -- these overlap with validation.test.cjs coverage and are migration candidates
- Current total: 766 tests; budget: 750; deficit: 16 tests to remove (Claude's Decision: deficit calculated from test runner output showing 766 tests vs 750 budget)

### What Is Already Covered vs What Remains

- TEST-01 (category tests): Already satisfied -- validation.test.cjs has dedicated describe blocks for STRUCT-01a through STRUCT-04, STATE-01 through STATE-04, NAV-01 through NAV-04, READY-01 through READY-04
- TEST-02 (auto-repair tests): Already satisfied -- validation.test.cjs has `auto-repair` describe block with 8 tests covering STATE-02/03/04 repair, NAV-04 repair, independence, no-repair-without-flag, and result shape
- TEST-03 (autopilot pre-flight): Not yet covered -- no tests verify the autopilot.mjs pre-flight `validateProjectHealth()` call with healthy, unhealthy, and repairable scenarios
- TEST-04 (net-zero count): Not yet met -- 766 > 750, need to remove 16+ redundant tests

### Autopilot Pre-Flight Integration Tests (TEST-03)

- Test the pre-flight code path in autopilot.mjs that calls `validateProjectHealth(cwd, { autoRepair: true })` at line 76 (from REQUIREMENTS.md TEST-03)
- Three scenarios required: healthy project passes pre-flight, unhealthy project fails with non-zero exit, repairable project repairs and proceeds (from ROADMAP.md success criterion 3)
- Tests should mock or use temp filesystem fixtures rather than requiring the Claude CLI binary (Claude's Decision: autopilot tests that need Claude CLI are already skipped when binary is absent; pre-flight tests should be standalone and always runnable)
- Add pre-flight tests to existing `autopilot.test.cjs` as a new describe block (Claude's Decision: keeps autopilot tests co-located; avoids a new test file)
- Target 3-5 tests for the three scenarios (Claude's Decision: minimal coverage for each scenario keeps the count low while satisfying TEST-03)

### Redundant Test Removal Strategy (TEST-04)

- `cli.test.cjs` handleHealth tests (lines 562-687) overlap with `validation.test.cjs` and `verify-health.test.cjs` -- the CLI tests check the same validation logic through a thinner wrapper (Claude's Decision: validation.test.cjs tests the engine directly and verify-health.test.cjs tests the gsd-tools dispatch; CLI handleHealth tests are the most redundant layer)
- Remove ~15 handleHealth tests from cli.test.cjs that are now covered by validation.test.cjs (Claude's Decision: these tests predated validation.cjs and tested gatherHealthData which no longer exists; the routeCommand('health') path is adequately tested by 2-3 smoke tests)
- Keep 2-3 CLI health smoke tests to verify the routeCommand adapter produces correct output shape (Claude's Decision: verifies the mapping layer from ValidationResult to legacy output format still works, without duplicating every check scenario)
- Look for additional redundancy across all test files to close the remaining gap if the ~15 removal plus ~4 additions still exceeds 750 (Claude's Decision: net math is 766 - 15 + 4 = 755, still 5 over; may need to find 5 more redundant tests or reduce pre-flight tests to 3)

### Test Framework and Patterns

- Use `node:test` with `node:assert` matching all existing test files (from project convention)
- Use `fs.mkdtempSync` + `fs.rmSync` for temp directory fixtures matching validation.test.cjs pattern (from project convention)
- Use `helpers.cjs` `createTempProject()` and `cleanup()` for gsd-tools integration tests (from verify-health.test.cjs pattern)

### Claude's Discretion
- Exact selection of which cli.test.cjs handleHealth tests to keep as smoke tests
- Internal helper function organization in pre-flight test fixtures
- Exact test names and descriptions for new autopilot pre-flight tests
- Order of test removal vs test addition in the implementation
- Whether to consolidate any other minor test redundancies across files to hit the 750 target

</decisions>

<specifics>
## Specific Ideas

- The pre-milestone test count is 750 (from PROJECT.md context section: "750 tests (budget at 93.75%)")
- Current count is 766 tests per the test runner (16 tests added during Phases 64-67 for validation.test.cjs and verify-health.test.cjs)
- The `autopilot.mjs` pre-flight block (lines 75-92) calls `validateProjectHealth(PROJECT_DIR, { autoRepair: true })`, logs repairs, and calls `process.exit(1)` on unhealthy results -- pre-flight integration tests should verify this behavior
- The `handleHealth` tests in cli.test.cjs use legacy error codes (E001-E005, W003, W004) that now map from validation.cjs check IDs -- the smoke tests should verify these mappings still work
- Success criterion 4 says "existing health tests migrated, not duplicated" -- this means the validation.test.cjs tests ARE the migrated tests, and old duplicates in cli.test.cjs should be removed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validation.test.cjs`: 104 tests covering all check categories, severity model, category filtering, and auto-repair -- already satisfies TEST-01 and TEST-02
- `verify-health.test.cjs`: 14 tests covering gsd-tools validate health dispatch with repair scenarios
- `autopilot.test.cjs`: Existing test file with static analysis tests and dry-run tests -- pre-flight tests append here
- `tests/helpers.cjs`: `createTempProject()`, `cleanup()`, `runGsdTools()` utilities for integration testing

### Established Patterns
- Temp directory creation: `fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-prefix-'))` in beforeEach, `fs.rmSync(tmpDir, { recursive: true, force: true })` in afterEach
- Mock filesystem: write minimal valid project files (PROJECT.md, ROADMAP.md, STATE.md, config.json, phases/) then selectively remove/corrupt to test failure scenarios
- Integration tests call `runGsdTools()` and parse JSON output; unit tests call module functions directly

### Integration Points
- `autopilot.test.cjs`: Add new describe block for pre-flight validation tests
- `cli.test.cjs`: Remove handleHealth describe block tests (lines 535-687), keep 2-3 smoke tests
- `validation.test.cjs`: No changes needed -- already comprehensive
- `verify-health.test.cjs`: No changes needed -- already covers gsd-tools dispatch

</code_context>

<deferred>
## Deferred Ideas

- Deterministic step detection in `gsd health` output (future -- DIAG-01)
- Health check suggestions with specific fix commands (future -- DIAG-02)
- Plugin/extensible check system (explicitly out of scope per REQUIREMENTS.md)
- Test mutation analysis or code coverage percentage targets (explicitly out of scope per PROJECT.md)

</deferred>

---

*Phase: 68-testing-and-consolidation*
*Context gathered: 2026-03-16 via auto-context*
