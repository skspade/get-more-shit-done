# Phase 97: Test Suite Consolidation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Bring the test suite under budget (800) by retiring subsumed tests, pruning duplicates, and parameterizing verbose routing tests. This is a gap closure phase from the v3.1 milestone audit -- three consolidation proposals are executed: delete `verify-health.test.cjs` (subsumed by `validation.test.cjs`), remove the pre-flight validation describe block from `autopilot.test.cjs` (duplicates `validation.test.cjs`), and replace verbose routing tests in `dispatcher.test.cjs` with a parameterized smoke table. No new features -- only test file consolidation.

</domain>

<decisions>
## Implementation Decisions

### Delete verify-health.test.cjs (Proposal 1: promote strategy)
- Delete `tests/verify-health.test.cjs` entirely -- all 12 tests (2 describe blocks: "validate health command" with 10 tests, "validate health --repair command" with 2 tests) are fully subsumed by `tests/validation.test.cjs` which has 88+ tests covering the same validation module directly
- The verify-health tests exercise `validate health` via the `gsd-tools` CLI dispatcher, which is an integration path already covered by dispatcher routing tests -- the validation logic itself is tested comprehensively in validation.test.cjs
- Expected reduction: 12 tests

### Remove autopilot pre-flight validation block (Proposal 2: prune strategy)
- Remove the `describe('autopilot pre-flight validation', ...)` block from `tests/autopilot.test.cjs` (lines 341-387, 3 tests)
- These 3 tests call `validateProjectHealth()` directly with temp directories -- identical coverage exists in `validation.test.cjs` which tests the same function with the same scenarios (healthy, unhealthy, repairable)
- Also remove the `require('../get-shit-done/bin/lib/validation.cjs')` import at line 343 if it becomes unused after the block removal (Claude's Decision: removing dead imports follows project convention of no unused code)
- Expected reduction: 3 tests

### Parameterize dispatcher routing tests (Proposal 3: parameterize strategy)
- Replace the 12 individual "unknown subcommand" tests in the `describe('dispatcher error paths', ...)` block with a single parameterized `for...of` loop over a test case table
- The 12 tests for unknown subcommands (template, frontmatter, verify, phases, roadmap, requirements, phase, milestone, validate, todo, init, plus the unknown top-level command) all follow the identical pattern: call `runGsdTools('{command} bogus', tmpDir)`, assert `result.success === false`, assert `result.error.includes('Unknown {type} subcommand')`
- Parameterized table entries: `[{command, expectedError}]` array with one `test()` per entry via `for...of` loop (Claude's Decision: follows the established parameterization pattern from v2.6 Phase 68/70 consolidation)
- Keep the 5 non-pattern tests in "dispatcher error paths" as individual tests: no-command, --cwd= form, --cwd= empty, --cwd invalid path -- these have distinct assertion patterns that don't fit the table (Claude's Decision: only parameterize tests with identical assertion structure to preserve test clarity)
- Replace the 6 individual routing branch tests in `describe('dispatcher routing branches', ...)` with a parameterized smoke table testing that each route succeeds and returns valid JSON (Claude's Decision: the audit proposal targets ~8 tests total from 29, and routing branches follow a common setup-invoke-parseJSON pattern)
- Keep `phase find-next dispatch` (3 tests) and `verify status/gaps dispatch` (4 tests) describe blocks unchanged -- they test specific argument variations, not generic routing (Claude's Decision: these blocks test behavioral depth not just routing smoke, and their count is already minimal)
- Expected reduction: ~21 tests (from 29 to ~8)

### Test Suite Integrity
- Run `npm test` after all consolidation changes and verify all remaining tests pass
- Verify final test count is at or below 811 (current count is 787, but the success criteria states 847 baseline reduced to 811 -- the actual baseline may differ from what the audit recorded; the key constraint is all tests pass and count stays under budget)

### Claude's Discretion
- Exact structure of the parameterized test case arrays (column names, ordering)
- Whether to add a brief comment explaining why verify-health.test.cjs was deleted
- Internal ordering of test cases within the parameterized tables
- Whether the parameterized loop uses `test()` directly or wraps in a `describe()`

</decisions>

<specifics>
## Specific Ideas

**Parameterized unknown-subcommand table (conceptual):**
```javascript
const unknownSubcommandCases = [
  { command: 'template bogus', expected: 'Unknown template subcommand' },
  { command: 'frontmatter bogus file.md', expected: 'Unknown frontmatter subcommand' },
  { command: 'verify bogus', expected: 'Unknown verify subcommand' },
  { command: 'phases bogus', expected: 'Unknown phases subcommand' },
  { command: 'roadmap bogus', expected: 'Unknown roadmap subcommand' },
  { command: 'requirements bogus', expected: 'Unknown requirements subcommand' },
  { command: 'phase bogus', expected: 'Unknown phase subcommand' },
  { command: 'milestone bogus', expected: 'Unknown milestone subcommand' },
  { command: 'validate bogus', expected: 'Unknown validate subcommand' },
  { command: 'todo bogus', expected: 'Unknown todo subcommand' },
  { command: 'init bogus', expected: 'Unknown init workflow' },
];

for (const { command, expected } of unknownSubcommandCases) {
  test(`${command.split(' ')[0]} unknown subcommand errors`, () => {
    const result = runGsdTools(command, tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes(expected));
  });
}
```

**Parameterized routing branch table (conceptual):**
```javascript
const routingCases = [
  { name: 'find-phase', command: 'find-phase 01', setup: (dir) => { /* create phase dir */ } },
  { name: 'init resume', command: 'init resume', setup: (dir) => { /* create STATE.md */ } },
  { name: 'init verify-work', command: 'init verify-work 01', setup: (dir) => { /* create ROADMAP + phase */ } },
  // ... etc
];
```

**Consolidation proposals from v3.1-MILESTONE-AUDIT.md frontmatter:**
- Proposal 1 (promote): verify-health.test.cjs (12 tests) -> delete
- Proposal 2 (prune): autopilot.test.cjs pre-flight block (3 tests) -> remove block
- Proposal 3 (parameterize): dispatcher.test.cjs routing tests (29 tests -> ~8) -> refactor

**Test budget math:** Current test count is 787. The audit recorded 847 but that appears stale. With 787 tests, we are already under budget (800). Consolidation still reduces redundancy and prevents future budget pressure.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/validation.test.cjs`: 88+ tests covering `validateProjectHealth()`, `runChecks()`, category filtering, severity model -- subsumes all verify-health.test.cjs coverage and autopilot pre-flight validation coverage
- `tests/helpers.cjs`: `runGsdTools()`, `createTempProject()`, `cleanup()` -- shared test utilities used by dispatcher.test.cjs and verify-health.test.cjs
- `tests/dispatcher.test.cjs`: 29 tests across 4 describe blocks -- the parameterization target for routing smoke tests

### Established Patterns
- **Parameterized test loops**: v2.6 Phase 68/70 established the `for...of` loop pattern with case arrays to reduce test count while preserving coverage. This is the identical approach for dispatcher.test.cjs.
- **Test file deletion**: Prior consolidation (v2.6) deleted redundant test files entirely when coverage was subsumed by newer, more comprehensive tests.
- **node:test framework**: All test files use `require('node:test')` with `describe`/`test`/`beforeEach`/`afterEach` -- the parameterized approach must stay within this framework.
- **Test budget enforcement**: Project budget is 800 tests. Test steward monitors via `testing.cjs` budget utilities. Current count (787) is under budget but consolidation reduces redundancy.

### Integration Points
- `tests/verify-health.test.cjs`: File to delete entirely
- `tests/autopilot.test.cjs` lines 341-387: Describe block to remove
- `tests/dispatcher.test.cjs` lines 19-145 and 149-277: Describe blocks to parameterize
- `package.json` test configuration: No changes needed -- jest/node:test discovers test files by glob pattern, so deleting verify-health.test.cjs is sufficient

</code_context>

<deferred>
## Deferred Ideas

- **Moving scenario-depth assertions to domain test files** -- the audit suggested moving deep routing assertions to roadmap.test.cjs, verify.test.cjs, etc. -- not required for budget compliance and adds cross-file coordination risk
- **Dispatcher single-smoke-test for verify-health route** -- the audit suggested optionally adding a single smoke test to dispatcher.test.cjs after deleting verify-health.test.cjs -- unnecessary since validation.test.cjs already covers the module
- **Further consolidation of other test files** -- budget is already under 800; additional consolidation can be driven by future steward proposals

</deferred>

---

*Phase: 97-test-suite-consolidation*
*Context gathered: 2026-03-22 via auto-context*
