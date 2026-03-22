# Phase 97: Test Suite Consolidation - Research

**Researched:** 2026-03-22
**Domain:** Test consolidation (node:test framework)
**Confidence:** HIGH

## Summary

This phase consolidates the test suite by deleting subsumed tests, removing duplicate describe blocks, and parameterizing repetitive dispatcher tests. The current test count is 787 (already under the 800 budget), but consolidation removes redundancy and prevents future budget pressure.

Three consolidation targets: (1) delete `verify-health.test.cjs` entirely (12 tests subsumed by `validation.test.cjs`), (2) remove the `autopilot pre-flight validation` describe block from `autopilot.test.cjs` (3 tests), (3) parameterize the unknown-subcommand tests (11 individual tests -> 1 loop) and routing branch tests (6 individual tests -> 1 loop) in `dispatcher.test.cjs`.

**Primary recommendation:** Execute all three proposals in a single plan since they are independent file edits with no cross-dependencies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Delete `tests/verify-health.test.cjs` entirely -- all 12 tests subsumed by `validation.test.cjs`
- Remove `describe('autopilot pre-flight validation', ...)` block from `tests/autopilot.test.cjs` (lines 341-387, 3 tests) plus the unused `require('../get-shit-done/bin/lib/validation.cjs')` import at line 343
- Replace 11 individual unknown-subcommand tests with parameterized `for...of` loop over test case table
- Replace 6 individual routing branch tests with parameterized smoke table
- Keep 5 non-pattern tests in "dispatcher error paths" as individual tests (no-command, unknown command, --cwd= form, --cwd= empty, --cwd invalid path)
- Keep `phase find-next dispatch` (3 tests) and `verify status/gaps dispatch` (4 tests) describe blocks unchanged

### Claude's Discretion
- Exact structure of parameterized test case arrays (column names, ordering)
- Whether to add a brief comment explaining why verify-health.test.cjs was deleted
- Internal ordering of test cases within parameterized tables
- Whether parameterized loop uses `test()` directly or wraps in a `describe()`

### Deferred Ideas (OUT OF SCOPE)
- Moving scenario-depth assertions to domain test files
- Dispatcher single-smoke-test for verify-health route
- Further consolidation of other test files
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | Built-in (Node 18+) | Test runner | Project standard — all test files use it |
| node:assert | Built-in | Assertions | Project standard — strict mode assertions |

No external dependencies needed. All changes are within existing test files using the existing framework.

## Architecture Patterns

### Parameterized Test Pattern (established in v2.6 Phase 68/70)
**What:** `for...of` loop over a case array, each entry creates one `test()` call
**When to use:** Multiple tests with identical assertion structure differing only in input/expected values
**Example:**
```javascript
const cases = [
  { command: 'template bogus', expected: 'Unknown template subcommand' },
  { command: 'verify bogus', expected: 'Unknown verify subcommand' },
];

for (const { command, expected } of cases) {
  test(`${command.split(' ')[0]} unknown subcommand errors`, () => {
    const result = runGsdTools(command, tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes(expected));
  });
}
```

### Anti-Patterns to Avoid
- **Wrapping parameterized tests in extra describe():** The loop already exists inside a describe block. Adding another is unnecessary nesting.
- **Using test.each or similar:** node:test does not have `test.each`. Use plain `for...of`.

## Don't Hand-Roll

Not applicable — this phase modifies existing test files only, no new infrastructure needed.

## Common Pitfalls

### Pitfall 1: Breaking test names in parameterized loops
**What goes wrong:** Dynamic test names cause TAP output parsing issues
**Why it happens:** Template literal test names may contain characters that confuse TAP parsers
**How to avoid:** Keep test names simple — use `command.split(' ')[0]` for the command group name
**Warning signs:** Test runner reports 0 tests or garbled output

### Pitfall 2: Forgetting to remove the unused import
**What goes wrong:** `require('../get-shit-done/bin/lib/validation.cjs')` left at line 343 of autopilot.test.cjs after removing the describe block that uses it
**Why it happens:** Import is visually separated from the describe block
**How to avoid:** Remove both the import (line 343) and the describe block (lines 345-387)

### Pitfall 3: Miscounting test reduction
**What goes wrong:** Final test count doesn't match expectations
**Why it happens:** Parameterized loops still create N tests from N entries — the reduction comes from having fewer entries than individual tests
**How to avoid:** Count the actual entries in each parameterized table. Unknown subcommand: 11 entries (from 11 tests). Routing branches: 6 entries (from 6 tests). Net reduction from parameterization is 0 tests (same count, just DRYer code). Actual reduction: 12 (verify-health delete) + 3 (autopilot block) = 15 tests.

**Important correction:** The context mentions "~8 tests from 29" for dispatcher, implying 21 fewer tests. But the actual dispatcher.test.cjs has 29 tests across 4 describe blocks. Parameterizing doesn't reduce the count — it just makes the code DRYer. The 5 kept tests + 11 unknown subcommand entries + 6 routing entries + 3 find-next + 4 verify status/gaps = 29 tests still. The real reduction is only from deleting verify-health (12) and removing autopilot block (3) = 15 tests total. 787 - 15 = 772, well under 800.

## Code Examples

### Current dispatcher.test.cjs structure (29 tests)
- `dispatcher error paths`: 16 tests (5 individual + 11 unknown subcommand)
- `dispatcher routing branches`: 6 tests
- `phase find-next dispatch`: 3 tests
- `verify status/gaps dispatch`: 4 tests

### Current autopilot.test.cjs pre-flight block (3 tests, lines 341-387)
- Line 343: `const { validateProjectHealth } = require('../get-shit-done/bin/lib/validation.cjs');`
- Lines 345-387: `describe('autopilot pre-flight validation', ...)` with 3 tests

### Current verify-health.test.cjs (12 tests)
- `validate health command`: 10 tests
- `validate health --repair command`: 2 tests

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all target test files
- Existing parameterization pattern from v2.6 consolidation (Phase 68/70)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - built-in node:test, no external deps
- Architecture: HIGH - established parameterization pattern in codebase
- Pitfalls: HIGH - straightforward file editing with known test framework

**Research date:** 2026-03-22
**Valid until:** Indefinite (internal codebase patterns)
