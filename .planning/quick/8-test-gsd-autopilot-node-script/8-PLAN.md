---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/autopilot.test.cjs
autonomous: true
must_haves:
  truths:
    - "Every `claude -p` invocation in autopilot.mjs includes `< /dev/null` stdin redirect"
    - "A regression test fails if any `claude -p` call is added without `< /dev/null`"
    - "Argument parsing rejects unknown flags and positional args"
  artifacts:
    - path: "tests/autopilot.test.cjs"
      provides: "Static analysis + unit tests for autopilot.mjs"
      contains: "dev/null"
---

<objective>
Add regression tests to autopilot.test.cjs that catch the zx v8 VoidStream stdin bug and verify other statically-testable aspects of autopilot.mjs.

Purpose: The critical bug where zx v8's default VoidStream stdin caused `claude -p` to hang was fixed by adding `< /dev/null` to all 5 invocations. The existing dry-run tests cannot catch this regression. Static analysis of the source file can.
Output: Updated tests/autopilot.test.cjs with new test suites.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/scripts/autopilot.mjs
@tests/autopilot.test.cjs
@tests/helpers.cjs
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add stdin redirect regression tests and source analysis tests to autopilot.test.cjs</name>
  <files>tests/autopilot.test.cjs</files>
  <behavior>
    - Test: Every line containing `claude -p` that is an actual shell invocation (template literal with `$\`...\``) must also contain `< /dev/null`. Read autopilot.mjs source as text and use regex to find all `$\`...claude -p...\`` lines.
    - Test: Count of `< /dev/null` occurrences in shell invocation lines equals count of `claude -p` shell invocation lines (currently 5). This catches the case where a new invocation is added without the redirect.
    - Test: Lines that are comments or console.log strings containing `claude -p` should NOT be required to have `< /dev/null` (they are not shell invocations).
    - Test: Unknown positional argument causes exit code 1 (e.g., `npx zx autopilot.mjs badarg`).
    - Test: Unknown flag causes exit code 1 (e.g., `npx zx autopilot.mjs --bad-flag`).
    - Test: Known flags `--dry-run`, `--from-phase`, `--project-dir` do not cause argument errors (validated via dry-run with valid structure).
  </behavior>
  <action>
Add two new `describe` blocks to the existing tests/autopilot.test.cjs:

1. **`describe('autopilot.mjs stdin redirect (regression)')`** - Static analysis tests that read autopilot.mjs source as a string:
   - Read `get-shit-done/scripts/autopilot.mjs` with `fs.readFileSync`.
   - Split into lines. Filter for lines that are actual zx shell invocations containing `claude -p` (match pattern: line contains both `` $` `` and `claude -p`, excluding comment lines starting with `//` and `console.log` lines).
   - Assert every such line also contains `< /dev/null`.
   - Assert there are exactly 5 such invocation lines (guards against adding new ones without the fix).
   - These tests need no `claude` binary, no temp dirs, no skip conditions.

2. **`describe('autopilot.mjs argument validation')`** - Tests that run the actual script to verify argument parsing:
   - These DO need `claude` binary (use the existing `hasClaude` skip pattern).
   - Test unknown positional arg: run `npx zx autopilot.mjs badarg`, expect non-zero exit and stderr containing "Unknown argument".
   - Test unknown flag: run `npx zx autopilot.mjs --bad-flag`, expect non-zero exit and stderr containing "Unknown argument".
   - Use `execSync` with `{ stdio: ['pipe', 'pipe', 'pipe'] }` and catch the error to check exit code and stderr.
   - Timeout 15000ms for each test (fast failures, no network).

Keep the existing `describe('autopilot.mjs --dry-run')` block exactly as-is. Append new blocks after it. Use the same `require('node:test')` and `require('node:assert')` style as existing tests.
  </action>
  <verify>
    <automated>cd /Users/seanspade/Documents/Source/get-more-shit-done && node --test tests/autopilot.test.cjs</automated>
  </verify>
  <done>
    - Static analysis test reads autopilot.mjs and asserts all 5 `claude -p` shell invocations include `< /dev/null`
    - Removing `< /dev/null` from any invocation line would cause test failure
    - Adding a 6th `claude -p` invocation without `< /dev/null` would cause test failure
    - Argument validation tests confirm unknown args/flags are rejected
    - All tests pass with `node --test tests/autopilot.test.cjs`
  </done>
</task>

</tasks>

<verification>
- `node --test tests/autopilot.test.cjs` passes all tests (existing + new)
- `npm test` passes (full suite including new tests)
- Temporarily remove `< /dev/null` from one invocation line in autopilot.mjs, run tests, confirm failure, then restore
</verification>

<success_criteria>
- Regression tests catch the VoidStream stdin bug via static source analysis
- Tests are self-contained (no network, no claude invocations for static tests)
- Existing dry-run tests continue to pass unchanged
</success_criteria>

<output>
After completion, record results in `.planning/quick/8-test-gsd-autopilot-node-script/8-SUMMARY.md`
</output>
