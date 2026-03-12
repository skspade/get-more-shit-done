# Phase 56: Debug Retry Integration - Research

**Researched:** 2026-03-12
**Domain:** Autopilot debug retry streaming integration
**Confidence:** HIGH

## Summary

Phase 56 is a mechanical wiring change: replace 3 direct `$` template literal `claude -p` invocations in debug retry code paths with calls to the existing `runClaudeStreaming()` function, and remove the now-redundant manual `process.stdout.write()` calls that follow each invocation.

The pattern is identical to what Phase 55 did for `runStep()` and `runStepCaptured()`. All 3 sites follow the same before/after structure. The `runClaudeStreaming()` function already handles streaming vs quiet mode, stall detection, stdin redirect, and NDJSON display.

**Primary recommendation:** Replace all 3 debug retry invocations with `const { exitCode, stdout } = await runClaudeStreaming(debugPrompt)` and remove the `process.stdout.write()` lines. Update the static analysis test that counts direct `$` template invocations from 5 to 2.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 3 debug retry `claude -p` invocations route through `runClaudeStreaming()` instead of direct `$` template literals
- During a debug retry cycle, assistant text and tool call indicators stream to the terminal in real-time
- The 3 invocation sites are: `runStepWithRetry()` line 597, `runVerifyWithDebugRetry()` line 642 (verify crash path), and `runVerifyWithDebugRetry()` line 681 (gaps found path)
- Each site replaces the direct `$` invocation with `const { exitCode, stdout } = await runClaudeStreaming(debugPrompt)`
- Remove the `if (debugResult.stdout) process.stdout.write(debugResult.stdout)` line following each invocation because `runClaudeStreaming()` already displays output in real-time
- In `runStepWithRetry()` (line 599-601): the post-debug check `if (debugResult.exitCode !== 0)` continues to work via the destructured `exitCode` from `runClaudeStreaming()` return value
- In `runVerifyWithDebugRetry()` verify crash path (line 642-644): no exit code check exists -- just invocation and stdout write need changing
- In `runVerifyWithDebugRetry()` gaps path (line 681-682): no exit code check exists -- same as verify crash path
- `runClaudeStreaming()` already handles the `QUIET` flag internally

### Claude's Discretion
- Whether to destructure `{ exitCode }` or `{ exitCode, stdout }` at sites where stdout is unused
- Exact placement of any additional `logMsg()` calls around the new invocations
- Whether to keep the empty line (`console.log('')`) between banner and invocation

### Deferred Ideas (OUT OF SCOPE)
- Adding `autopilot.stall_timeout_ms` to config schema for `gsd settings` visibility (Phase 57)
- End-to-end streaming verification (Phase 57)
- Token-level streaming UI (spinners, progress bars) -- out of scope per REQUIREMENTS.md
- Automatic process kill on stall -- warning-only per REQUIREMENTS.md
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-03 | All 3 debug retry `claude -p` invocations route through `runClaudeStreaming()` | All 3 invocation sites confirmed at lines 597, 642, 681 in autopilot.mjs. `runClaudeStreaming()` function exists at line 211. Pattern identical to Phase 55 wiring change. |
</phase_requirements>

## Architecture Patterns

### Pattern: Debug Retry Invocation Replacement

**Before (current code at all 3 sites):**
```javascript
const debugResult = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${debugPrompt} < /dev/null`.nothrow();
if (debugResult.stdout) process.stdout.write(debugResult.stdout);
```

**After (replacement):**
```javascript
const { exitCode, stdout } = await runClaudeStreaming(debugPrompt);
```

Note: `runClaudeStreaming()` already handles:
- `cd ${PROJECT_DIR}` (built into its `$` invocation)
- `--dangerously-skip-permissions` flag
- `--output-format stream-json` (streaming) or `--output-format json` (quiet mode)
- `< /dev/null` stdin redirect
- `.nothrow()` (built into its `$` invocation)
- Real-time display of assistant text and tool call indicators via `displayStreamEvent()`

### Site-Specific Details

**Site 1: `runStepWithRetry()` line 597-601**
- Variable changes: `debugResult` -> destructured `{ exitCode }`
- Exit code check at line 599 changes from `debugResult.exitCode` to `exitCode`
- Line 598 (`process.stdout.write`) is removed entirely

**Site 2: `runVerifyWithDebugRetry()` line 642-643 (verify crash path)**
- No exit code check after invocation -- just `continue`
- Only invocation + stdout write need replacing
- Can destructure just `exitCode` (or nothing, since it's unused)

**Site 3: `runVerifyWithDebugRetry()` line 681-682 (gaps found path)**
- Same as Site 2 -- no exit code check, just invocation + stdout write
- End of while loop body, so execution falls through to next iteration

## Common Pitfalls

### Pitfall 1: Forgetting to Update Static Analysis Test
**What goes wrong:** The test at `tests/autopilot.test.cjs` line 127 asserts exactly 5 `claude -p` shell invocations (lines matching `$\`` and `claude -p`). After removing 3 direct invocations, only 2 remain (inside `runClaudeStreaming()` itself).
**How to avoid:** Update the test assertion from 5 to 2.

### Pitfall 2: No outputFile for Debug Retries
**What goes wrong:** Passing `outputFile` to `runClaudeStreaming()` when debug retries don't need file capture.
**How to avoid:** Call `runClaudeStreaming(debugPrompt)` with no options object -- debug retries are fire-and-forget invocations that don't capture output to file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming output | Custom streaming for debug retries | `runClaudeStreaming()` | Already handles all edge cases (quiet mode, stall detection, NDJSON parsing) |
| Stdin redirect | Per-site `< /dev/null` handling | `runClaudeStreaming()` | Already includes stdin redirect |

## Code Examples

### Existing runClaudeStreaming signature (line 211)
```javascript
async function runClaudeStreaming(prompt, { outputFile, quiet } = {})
```

Returns: `{ exitCode: number, stdout: string }`

### Phase 55 precedent (runStep, line 348)
```javascript
const { exitCode } = await runClaudeStreaming(prompt);
```

### Phase 55 precedent (runStepCaptured, line 536)
```javascript
const { exitCode } = await runClaudeStreaming(prompt, { outputFile });
```

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of `autopilot.mjs` (all line numbers verified against current file)
- Phase 55 implementation pattern (commits 5441a8b, 9317119)
- Test file `tests/autopilot.test.cjs` (static analysis test at line 127 needs update)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure wiring change
- Architecture: HIGH - identical pattern to Phase 55, all 3 sites verified
- Pitfalls: HIGH - test update requirement identified from source analysis

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable internal codebase)
