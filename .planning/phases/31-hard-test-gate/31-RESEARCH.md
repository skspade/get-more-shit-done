# Phase 31: Hard Test Gate - Research

**Researcher:** gsd-phase-researcher
**Date:** 2026-03-05
**Confidence:** HIGH (codebase fully explored, patterns established)

## Executive Summary

Phase 31 adds a post-commit test gate to the execute-plan workflow. The implementation touches three files: `testing.cjs` (new `cmdTestRun` function), `gsd-tools.cjs` (new `test-run` dispatcher case), and `execute-plan.md` (new `<test_gate>` workflow section). All integration points are clean -- Phase 30 already established the testing module, config schema, and dispatcher routing.

## Codebase Analysis

### Existing Infrastructure (from Phase 30)

**testing.cjs** (`get-shit-done/bin/lib/testing.cjs`):
- `detectFramework(cwd)` -- returns `'vitest' | 'jest' | 'mocha' | 'node:test' | null`
- `getTestConfig(cwd)` -- returns merged config with `hard_gate`, `command`, `framework` fields
- `getDefaultCommand(framework)` -- maps framework to command string (`'npx vitest run'`, `'npx jest'`, `'npx mocha'`, `'node --test'`)
- `findTestFiles(cwd)` -- recursive test file discovery
- `countTestsInFile(filePath)` / `countTestsInProject(cwd, options)` -- test counting
- Exports: `cmdTestCount`, `cmdTestDetectFramework`, `cmdTestConfig`

**config.cjs** (`get-shit-done/bin/lib/config.cjs`):
- `test.hard_gate` defaults to `true` (line 62)
- `test.command` and `test.framework` can be explicitly configured
- Config loaded via `loadConfig(cwd)` from `core.cjs`

**gsd-tools.cjs** (`get-shit-done/bin/gsd-tools.cjs`):
- Dispatcher switch at line ~601 already handles `test-count`, `test-detect-framework`, `test-config`
- Pattern: `case 'test-run': { ... }` -- follows identical routing

**core.cjs** (`get-shit-done/bin/lib/core.cjs`):
- `output(result, raw, rawValue)` -- standard JSON/raw output
- `error(msg)` -- standard error output
- Uses `child_process.execSync` for shell commands

### execute-plan.md Workflow Structure

**Current flow after task commit:**
1. `<task_commit>` section -- stage, commit, record hash
2. Next task begins

**Insertion point:** New `<test_gate>` section between `<task_commit>` and the next task loop iteration.

**Workflow sections use XML tags:** `<step>`, `<deviation_rules>`, `<tdd_plan_execution>`, `<task_commit>`, etc.

### run-tests.cjs Reference Implementation

The project's own test runner (`scripts/run-tests.cjs`):
- Uses `execFileSync(process.execPath, ['--test', ...files], { stdio: 'inherit' })`
- Discovers `.test.cjs` files in `tests/` directory
- Exits with test runner's exit code

### TDD Commit Convention

From `tdd.md` and `execute-plan.md`:
- RED phase commit: `test({phase}-{plan}): add failing test for [feature]`
- Pattern: commit message starts with `test(` prefix
- Commit type field is always before the `(` character

## Technical Findings

### Finding 1: Test Execution Pattern
**Confidence:** HIGH

`cmdTestRun` should use `child_process.execSync` with captured output (not `stdio: 'inherit'`). The gate needs to capture stdout/stderr for parsing while preventing raw output from reaching the executor's context window.

```javascript
// Pattern:
const result = execSync(command, {
  cwd,
  stdio: ['pipe', 'pipe', 'pipe'],  // capture all streams
  timeout: 120000,  // 2 minute timeout
  encoding: 'utf-8',
});
```

On failure, `execSync` throws with `.stdout` and `.stderr` properties containing captured output.

### Finding 2: TDD RED Detection
**Confidence:** HIGH

Detection via git log of the most recent commit message:
```bash
git log -1 --format="%s"
```
Check if message matches: `/^test\(/` (starts with `test(` prefix).

This is reliable because the TDD commit convention is enforced by the `<tdd_plan_execution>` section of execute-plan.md. The executor always uses the `test({phase}-{plan}): ...` format.

### Finding 3: Baseline Comparison Strategy
**Confidence:** HIGH

Baseline should be a simple object with:
- `exitCode`: number (0 = all pass)
- `total`: number (test count, if parseable)
- `passed`: number
- `failed`: number
- `failedTests`: string[] (test names/identifiers from output)

Comparison logic: after each task commit, run tests and diff `failedTests` against baseline. New entries = new failures = gate block.

For `node:test` output (TAP-like), failing test names can be extracted from lines matching `# FAIL` or `not ok` patterns. For exit-code-only fallback: if baseline `exitCode` was 0, any non-zero exit = new failure.

### Finding 4: Workflow Integration Approach
**Confidence:** HIGH

The `<test_gate>` section should be added to `execute-plan.md` as instructions for the executor agent to follow after each task commit. It is NOT a separate script or hook -- it is workflow prose that tells the executor:

1. After committing, check if hard_gate is enabled
2. If this is a TDD RED commit, skip the gate
3. Run `node gsd-tools.cjs test-run` to get structured results
4. If new failures detected, follow deviation Rule 1 (Bug: fix -> test -> verify)
5. If fix fails after retries, escalate

### Finding 5: Output Parsing Strategy
**Confidence:** MEDIUM

Framework-specific parsing is best-effort. Universal fallback is exit-code-based:
- Exit 0 = all pass
- Exit non-zero = failures exist

For richer output, parse common patterns:
- **node:test (TAP)**: `# tests N`, `# pass N`, `# fail N`, `not ok N - test name`
- **jest**: `Tests: N failed, N passed, N total`
- **vitest**: `Tests N failed | N passed`
- **mocha**: `N passing`, `N failing`

The `cmdTestRun` function should attempt framework-specific parsing but gracefully degrade to exit-code-only.

### Finding 6: Baseline Capture Timing
**Confidence:** HIGH

Baseline must be captured before the first task of a plan executes, not at phase start. The execute-plan.md workflow processes one plan at a time (step `identify_plan` finds first PLAN without SUMMARY). The baseline captures the state when that specific plan begins.

The baseline instruction goes in the `<test_gate>` section as "before first task, capture baseline". The executor calls `gsd-tools.cjs test-run --baseline` once, then `gsd-tools.cjs test-run` after each subsequent commit.

### Finding 7: Gate Return Format
**Confidence:** HIGH

`cmdTestRun` should return structured JSON matching the `output()` pattern:

```json
{
  "status": "pass" | "fail" | "skip" | "error",
  "total": 16,
  "passed": 16,
  "failed": 0,
  "new_failures": [],
  "baseline_failures": [],
  "summary": "16 tests passed",
  "raw_length": 4523
}
```

The `summary` field is the human-readable string shown to the executor. `raw_length` indicates how much output was suppressed.

## Integration Points

| Component | Change | Risk |
|-----------|--------|------|
| `testing.cjs` | Add `cmdTestRun` function + helpers | LOW -- new export, no existing function changes |
| `gsd-tools.cjs` | Add `test-run` case to dispatcher | LOW -- follows exact existing pattern |
| `execute-plan.md` | Add `<test_gate>` section after `<task_commit>` | MEDIUM -- workflow change affects all executor behavior |

## Pitfalls & Risks

1. **Context window bloat**: Raw test output from large suites can be thousands of lines. The gate MUST summarize, never pass raw output to the executor. The `cmdTestRun` return structure handles this.

2. **Timeout handling**: Test suites can hang. The `execSync` call needs a timeout (suggest 120s default). On timeout, gate should report error status, not crash.

3. **Baseline staleness**: Baseline is per-plan-execution only. Between sessions, baseline is lost. This is intentional -- fresh baseline on each plan start prevents stale comparisons.

4. **TDD GREEN phase**: After a TDD RED commit, the next commit (GREEN) should have the gate active. The gate only skips on the RED commit itself, not on subsequent commits in the same TDD cycle.

5. **No test command available**: If `getTestConfig()` returns no command and `detectFramework()` returns null, the gate should be silently skipped (not error). This matches the zero-config degradation pattern.

6. **Pre-existing failures in baseline**: If baseline captures 3 failures, and after a task commit there are still exactly those 3 failures (no new ones), the gate should pass. Only NEW failures block.

## Requirement Coverage

| REQ | How Addressed |
|-----|---------------|
| GATE-01 | `<test_gate>` section in execute-plan.md + `cmdTestRun` in testing.cjs |
| GATE-02 | Gate instructions reference deviation Rule 1 for failure handling |
| GATE-03 | TDD RED detection via commit message `test(` prefix check |
| GATE-04 | Baseline capture via `--baseline` flag, comparison via `new_failures` diff |
| GATE-05 | `cmdTestRun` returns summary only; raw output captured but not returned |

## RESEARCH COMPLETE
