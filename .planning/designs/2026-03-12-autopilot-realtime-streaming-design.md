# Autopilot Real-Time Streaming Feedback — Design

**Date:** 2026-03-12
**Approach:** Hybrid Stream-JSON Parse + Passthrough

## Stream-JSON Format & Parsing

Claude's `--output-format stream-json` emits newline-delimited JSON (NDJSON). Each line is a self-contained event. The key event types we care about:

```
{"type": "assistant", "message": {"content": [{"type": "text", "text": "..."}]}}
{"type": "tool_use", "tool": {"name": "Edit", ...}}
{"type": "tool_result", "content": "..."}
{"type": "result", "result": "...", "cost_usd": 0.xx, "duration_ms": nnn}
```

**Parsing strategy:**
- Read child process stdout as a line stream (split on `\n`)
- Parse each line as JSON, extract `type` field
- For `assistant` events with text content: write text to terminal + accumulate
- For `tool_use` events: optionally log tool name to terminal (e.g., `[Edit] src/foo.js`)
- For `result` events: capture as the final result for exit code / output file
- For all other events: accumulate silently (available in output file for debugging)
- If JSON parse fails on a line: write raw line to terminal (defensive)

**Output file capture:**
- Every raw NDJSON line is appended to the output file (same as current behavior but streaming)
- The `runStepCaptured` function's output file still works for debug retry error context extraction

## Core Stream Runner Function

Replace the current `await $\`claude -p ... \`.nothrow()` pattern with a new `runClaudeStreaming()` function that all step executors call:

```javascript
async function runClaudeStreaming(prompt, { outputFile, quiet } = {}) {
  const format = quiet ? 'json' : 'stream-json';

  // Spawn claude process with piped stdout for stream reading
  const child = $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format ${format} ${prompt} < /dev/null`.nothrow();

  if (quiet || format === 'json') {
    // Original behavior: wait, then return result
    const result = await child;
    if (result.stdout) process.stdout.write(result.stdout);
    if (outputFile) fs.appendFileSync(outputFile, result.stdout || '');
    return { exitCode: result.exitCode, stdout: result.stdout };
  }

  // Streaming mode: read stdout line-by-line
  const lines = [];
  let stallTimer = null;
  const STALL_TIMEOUT = getConfig('autopilot.stall_timeout_ms', 300000); // 5 min default

  const resetStallTimer = () => { /* ... reset/warn logic ... */ };

  for await (const line of child.stdout) {
    resetStallTimer();
    lines.push(line);
    if (outputFile) fs.appendFileSync(outputFile, line + '\n');

    // Parse and display
    try {
      const event = JSON.parse(line);
      displayStreamEvent(event);
    } catch {
      process.stdout.write(line + '\n');
    }
  }

  clearTimeout(stallTimer);
  const result = await child;
  return { exitCode: result.exitCode, stdout: lines.join('\n') };
}
```

**Key points:**
- `quiet` mode falls back to current `--output-format json` behavior (for `--quiet` flag)
- Streaming mode reads stdout as an async iterable line-by-line
- Each line resets the stall timer
- All lines accumulated for `result.stdout` compatibility (debug retries need this)
- `outputFile` written line-by-line in real-time (not buffered until end)

## Stream Event Display

The `displayStreamEvent()` function determines what the user sees in real-time:

```javascript
function displayStreamEvent(event) {
  switch (event.type) {
    case 'assistant':
      // Extract text from content blocks and write to terminal
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            process.stdout.write(block.text);
          }
        }
      }
      break;

    case 'tool_use':
      // Show which tool is being invoked (compact one-liner)
      const toolName = event.tool?.name || 'unknown';
      process.stderr.write(`  ◆ ${toolName}\n`);
      break;

    case 'result':
      // Final result — don't display (handled by caller)
      break;

    default:
      // System events, tool results, etc. — silent
      break;
  }
}
```

**Display behavior:**
- **Assistant text**: Written directly to stdout in real-time — Claude "thinking out loud" as it works
- **Tool calls**: Compact one-liner to stderr (e.g., `◆ Edit`, `◆ Bash`) — activity signal without noise
- **Tool results**: Silent — too verbose, assistant text usually summarizes what happened
- **Result events**: Captured programmatically, not displayed

## Stall Detection

A stall timer resets on every stream event received. If no events arrive within the timeout, a warning is printed to stderr:

```javascript
const STALL_TIMEOUT = getConfig('autopilot.stall_timeout_ms', 300000); // 5 min

let stallTimer = null;
let stallWarningCount = 0;

function resetStallTimer() {
  if (stallTimer) clearTimeout(stallTimer);
  stallWarningCount = 0;

  stallTimer = setTimeout(() => {
    stallWarningCount++;
    const mins = (STALL_TIMEOUT * stallWarningCount) / 60000;
    console.error(`⚠ No output for ${mins} minutes — step may be stalled`);
    logMsg(`STALL WARNING: no output for ${mins}m`);

    // Re-arm for repeated warnings (every interval)
    stallTimer = setTimeout(arguments.callee, STALL_TIMEOUT);
  }, STALL_TIMEOUT);
}
```

**Behavior:**
- Timer starts when streaming begins
- Resets on every NDJSON line received
- After 5 minutes of silence: prints warning to stderr + logs to autopilot log
- Warning repeats every 5 minutes (10min, 15min, etc.) — escalating visibility
- Timer is cleared when the process exits normally
- Configurable via `config.json`: `autopilot.stall_timeout_ms`

## CLI Flag & Integration

**New `--quiet` flag:**

```javascript
// In argument parsing section
const knownFlags = new Set([..., 'quiet']);
const QUIET = !!(argv.quiet);
```

**Integration with step functions:**

`runStep()` and `runStepCaptured()` both delegate to `runClaudeStreaming()`:

```javascript
async function runStep(prompt, stepName) {
  printBanner(`Phase ${CURRENT_PHASE} > ${stepName}`);
  const snapshotBefore = await takeProgressSnapshot();

  if (DRY_RUN) { /* unchanged */ }

  logMsg(`STEP START: phase=${CURRENT_PHASE} step=${stepName}`);

  const { exitCode, stdout } = await runClaudeStreaming(prompt, { quiet: QUIET });

  logMsg(`STEP DONE: step=${stepName} exit_code=${exitCode}`);

  const snapshotAfter = await takeProgressSnapshot();
  checkProgress(snapshotBefore, snapshotAfter, stepName);

  /* ... existing exit code handling unchanged ... */
  return exitCode;
}

async function runStepCaptured(prompt, stepName, outputFile) {
  /* same pattern, passes outputFile to runClaudeStreaming */
  const { exitCode, stdout } = await runClaudeStreaming(prompt, {
    outputFile,
    quiet: QUIET
  });
  /* ... rest unchanged ... */
}
```

**What changes:**
- `runStep` and `runStepCaptured` become thin wrappers around `runClaudeStreaming`
- All 5 `claude -p` invocation sites route through the same streaming function
- The `< /dev/null` fix stays — it's on the shell command inside `runClaudeStreaming`
- Debug retry invocations also stream by default (watch the debugger work)
- `--quiet` flag restores original json-only behavior for CI/scripted use
