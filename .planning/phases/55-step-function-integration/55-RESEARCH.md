# Phase 55: Step Function Integration - Research

**Researched:** 2026-03-12
**Domain:** Function delegation, NDJSON output compatibility, error context preservation
**Confidence:** HIGH

## Summary

Phase 55 wires `runStep()` and `runStepCaptured()` to delegate to `runClaudeStreaming()` (built in Phase 54) instead of direct `$\`claude -p ...\`` invocations. This is a targeted refactor of two functions — replacing their direct zx shell invocations with calls to the consolidated streaming function and removing the now-redundant manual `process.stdout.write()` and `fs.appendFileSync()` lines.

The change is mechanical: `runClaudeStreaming()` already handles streaming display, output file capture, quiet mode fallback, and stall detection. The returned `{ exitCode, stdout }` object maps directly to what `runStep()` and `runStepCaptured()` already use. The DRY_RUN paths remain unchanged. Debug retry `$` invocations (lines 606, 651, 690) are explicitly out of scope (Phase 56).

**Primary recommendation:** Replace the two direct `$` invocations with `runClaudeStreaming()` calls and remove the redundant output handling code. Update the static analysis test to expect 5 `claude -p` shell invocations (down from 7, since 2 are replaced by `runClaudeStreaming()` which handles them internally).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace the direct `$\`cd ${PROJECT_DIR} && claude -p ... < /dev/null\`.nothrow()` call in `runStep()` (line 348) with a call to `runClaudeStreaming(prompt)`
- Remove the manual `process.stdout.write(result.stdout)` after the call in `runStep()` (line 353) -- `runClaudeStreaming()` already displays assistant text and tool call indicators in real-time during streaming mode
- The returned `{ exitCode, stdout }` object maps directly to the existing `exitCode` usage; `stdout` is available but not needed since output is already displayed
- DRY_RUN path in `runStep()` remains unchanged -- it does not invoke Claude
- Replace the direct `$\`claude -p ...\`` call in `runStepCaptured()` (line 539) with `runClaudeStreaming(prompt, { outputFile })`
- Remove the manual `process.stdout.write(result.stdout)` and `fs.appendFileSync(outputFile, result.stdout)` block in `runStepCaptured()` (lines 544-547) -- `runClaudeStreaming()` handles both real-time display and real-time file capture when `outputFile` is provided
- The returned `{ exitCode }` maps directly to the existing `exitCode` usage
- Debug retry error context extraction (lines 589-593, 636-639) reads from the `outputFile` and takes last 100 lines -- works with NDJSON without changes
- No changes needed to `constructDebugPrompt()` or the error context extraction logic
- `runClaudeStreaming()` already handles the `QUIET` flag internally so `runStep()` and `runStepCaptured()` do not need conditional logic for quiet mode

### Claude's Discretion
- Whether to extract `exitCode` via destructuring or dot notation from the returned object
- Whether to keep or remove the intermediate `result` variable in each function
- Exact placement of the `logMsg()` calls relative to the new `runClaudeStreaming()` call

### Deferred Ideas (OUT OF SCOPE)
- Wiring debug retry invocations through `runClaudeStreaming()` (Phase 56)
- Adding `autopilot.stall_timeout_ms` to config schema (Phase 57)
- Updating the DRY_RUN display message to mention `stream-json` -- cosmetic, not worth the churn
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-02 | `runStep()` and `runStepCaptured()` delegate to `runClaudeStreaming()` instead of direct `$` invocations | Direct function call replacement; `runClaudeStreaming()` returns `{ exitCode, stdout }` matching existing usage; output display and file capture handled internally |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zx | 8.x | Shell execution via tagged templates | Already used throughout autopilot.mjs; `runClaudeStreaming()` uses it internally |
| node:readline | built-in | Line-by-line stream parsing | Already imported in autopilot.mjs; used by `runClaudeStreaming()` internally |
| node:fs | built-in | File I/O for output capture | Already imported; `runClaudeStreaming()` handles `appendFileSync` internally |

### Supporting
No new libraries needed. This phase only rewires existing function calls.

### Alternatives Considered
None. The implementation approach is fully locked by CONTEXT.md decisions.

## Architecture Patterns

### Pattern 1: Delegation to Consolidated Function
**What:** Replace direct `$\`claude -p ...\`` invocations with `runClaudeStreaming()` calls
**When to use:** Any step execution function that spawns Claude CLI
**Example:**

Before (`runStep()` line 348):
```javascript
const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt} < /dev/null`.nothrow();
```

After:
```javascript
const result = await runClaudeStreaming(prompt);
```

Before (`runStepCaptured()` line 539):
```javascript
const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt} < /dev/null`.nothrow();
```

After:
```javascript
const result = await runClaudeStreaming(prompt, { outputFile });
```

### Pattern 2: Redundant Output Removal
**What:** Remove `process.stdout.write()` and `fs.appendFileSync()` calls that are now handled by `runClaudeStreaming()`
**When to use:** After replacing direct `$` invocations with `runClaudeStreaming()`

`runStep()` -- remove line 353:
```javascript
if (result.stdout) process.stdout.write(result.stdout);
```

`runStepCaptured()` -- remove lines 544-547:
```javascript
if (result.stdout) {
  process.stdout.write(result.stdout);
  fs.appendFileSync(outputFile, result.stdout);
}
```

### Anti-Patterns to Avoid
- **Double-writing output:** Do NOT keep `process.stdout.write()` after switching to `runClaudeStreaming()` -- it already writes assistant text to stdout in real-time
- **Double-capturing to file:** Do NOT keep `fs.appendFileSync()` after passing `outputFile` to `runClaudeStreaming()` -- it already appends each NDJSON line in real-time
- **Touching debug retry invocations:** Lines 606, 651, 690 are Phase 56 scope -- do NOT modify them

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming NDJSON display | Custom stream parser in `runStep()` | `runClaudeStreaming()` | Already handles streaming, stall detection, quiet mode |
| Real-time file capture | Manual `fs.appendFileSync()` per step | `runClaudeStreaming({ outputFile })` | Already appends each NDJSON line as it arrives |
| Quiet mode detection | Conditional `--output-format` selection | `runClaudeStreaming()` internal QUIET check | Already falls back to `--output-format json` when QUIET is true |

## Common Pitfalls

### Pitfall 1: exitCode Extraction
**What goes wrong:** `runClaudeStreaming()` returns `{ exitCode, stdout }` but the existing code assigns `const exitCode = result.exitCode` -- if using destructuring you might shadow `exitCode` or miss that it comes from an object property.
**Why it happens:** The existing code expects `result.exitCode` from the zx `ProcessOutput`. `runClaudeStreaming()` returns a plain object with the same shape.
**How to avoid:** Use `const { exitCode } = await runClaudeStreaming(prompt)` or keep `const result = await runClaudeStreaming(prompt)` and `const exitCode = result.exitCode`. Both work identically.
**Warning signs:** Test failures showing `exitCode is undefined`.

### Pitfall 2: Static Analysis Test Breakage
**What goes wrong:** The test `autopilot.test.cjs` asserts "there are exactly 7 claude -p shell invocations". After this phase, 2 direct `$` invocations are replaced by `runClaudeStreaming()` calls, reducing the count to 5.
**Why it happens:** The test counts `$\`` lines containing `claude -p`. `runClaudeStreaming()` has its own internal `$\`` invocations (2 of them -- streaming and quiet paths) which ARE counted, but the 2 removed from `runStep()`/`runStepCaptured()` reduce the total.
**How to avoid:** Update the test assertion from 7 to 5.
**Warning signs:** Test failure: `Expected 7 claude -p shell invocations, found 5`.

### Pitfall 3: DRY_RUN Path Inconsistency
**What goes wrong:** The DRY_RUN path in `runStep()` displays `--output-format json` in its console message. Changing this to `stream-json` is tempting but unnecessary.
**Why it happens:** The DRY_RUN path returns early before any Claude invocation. The message is informational only.
**How to avoid:** Leave the DRY_RUN path unchanged per CONTEXT.md deferred decisions.
**Warning signs:** Unnecessary code churn in a path that never invokes Claude.

### Pitfall 4: NDJSON vs JSON in Error Context
**What goes wrong:** After switching `runStepCaptured()` to use `runClaudeStreaming()`, the output file will contain NDJSON lines instead of a single JSON blob. The error context extraction (`.slice(-100)`) still works but returns different content format.
**Why it happens:** `runClaudeStreaming()` writes one NDJSON line per stream event to the output file. The old code wrote the entire buffered stdout as one blob.
**How to avoid:** No code changes needed. The last 100 NDJSON lines contain the final assistant messages and tool calls, providing equivalent or better debugging context than the old single JSON blob.
**Warning signs:** None -- this is expected behavior change, not a bug.

## Code Examples

### runStep() After Integration
```javascript
async function runStep(prompt, stepName) {
  printBanner(`Phase ${CURRENT_PHASE} > ${stepName}`);

  const snapshotBefore = await takeProgressSnapshot();

  if (DRY_RUN) {
    logMsg(`STEP DRY-RUN: ${stepName}`);
    console.log('[DRY RUN] Would execute:');
    console.log(`  claude -p --dangerously-skip-permissions --output-format json "${prompt}"`);
    console.log('');
    checkProgress(snapshotBefore, snapshotBefore, `${stepName} (dry-run)`);
    return 0;
  }

  logMsg(`STEP START: phase=${CURRENT_PHASE} step=${stepName}`);

  const { exitCode } = await runClaudeStreaming(prompt);

  logMsg(`STEP DONE: step=${stepName} exit_code=${exitCode}`);

  const snapshotAfter = await takeProgressSnapshot();
  checkProgress(snapshotBefore, snapshotAfter, stepName);

  if (exitCode !== 0) {
    if (snapshotBefore === snapshotAfter) {
      console.error(`ERROR: Step '${stepName}' failed with exit code ${exitCode} and no artifacts created`);
      printHaltReport('Step failure with no progress', stepName, exitCode);
      process.exit(1);
    } else {
      console.error(`WARNING: Step '${stepName}' exited with code ${exitCode} but made progress. Continuing.`);
    }
  }

  return exitCode;
}
```

### runStepCaptured() After Integration
```javascript
async function runStepCaptured(prompt, stepName, outputFile) {
  printBanner(`Phase ${CURRENT_PHASE} > ${stepName}`);

  const snapshotBefore = await takeProgressSnapshot();

  if (DRY_RUN) {
    logMsg(`STEP DRY-RUN: ${stepName}`);
    const msg = `[DRY RUN] Would execute: claude -p --dangerously-skip-permissions --output-format json "${prompt}"`;
    console.log(msg);
    console.log('');
    fs.appendFileSync(outputFile, msg + '\n');
    checkProgress(snapshotBefore, snapshotBefore, `${stepName} (dry-run)`);
    return 0;
  }

  logMsg(`STEP START: phase=${CURRENT_PHASE} step=${stepName}`);

  const { exitCode } = await runClaudeStreaming(prompt, { outputFile });

  logMsg(`STEP DONE: step=${stepName} exit_code=${exitCode}`);

  const snapshotAfter = await takeProgressSnapshot();
  checkProgress(snapshotBefore, snapshotAfter, stepName);

  return exitCode;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `$\`` invocation per step function | Consolidated `runClaudeStreaming()` | Phase 54 (v2.4) | Eliminates duplicated invocation, output, and file capture logic |
| Buffered `--output-format json` | Streaming `--output-format stream-json` | Phase 54 (v2.4) | Real-time output during long-running steps |
| Manual `process.stdout.write()` per function | `displayStreamEvent()` in `runClaudeStreaming()` | Phase 54 (v2.4) | Unified display logic with tool call indicators |

## Open Questions

None. The implementation is fully specified by CONTEXT.md locked decisions and the existing `runClaudeStreaming()` API.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `autopilot.mjs` (lines 196-261, 332-369, 522-553, 589-593, 636-639)
- Phase 54 CONTEXT.md and RESEARCH.md for `runClaudeStreaming()` API contract
- `autopilot.test.cjs` for static analysis test expectations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; uses only existing imports
- Architecture: HIGH - Mechanical substitution of two function calls with well-defined API
- Pitfalls: HIGH - All identified from direct code analysis; test count change is the only non-obvious issue

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- internal refactor, no external dependencies)
