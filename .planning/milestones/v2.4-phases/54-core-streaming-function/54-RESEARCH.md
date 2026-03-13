# Phase 54: Core Streaming Function - Research

**Researched:** 2026-03-12
**Domain:** NDJSON stream parsing, child process stdout async iteration, stall detection
**Confidence:** HIGH

## Summary

Phase 54 builds `runClaudeStreaming()` and `displayStreamEvent()` in autopilot.mjs — a consolidated function that spawns `claude -p --output-format stream-json`, reads NDJSON lines via zx's async iterable stdout, displays assistant text to stdout and tool indicators to stderr in real-time, detects stalls with a repeating timer, and falls back to buffered JSON via `--quiet`. The function returns `{ exitCode, stdout }` matching existing usage patterns.

The implementation is straightforward: zx 8.x `ProcessPromise` exposes stdout as a Node.js `Readable` stream. Wrapping it in `createInterface` (already imported in autopilot.mjs) yields an async iterator of lines. Each line is `JSON.parse()`'d and dispatched through `displayStreamEvent()`. A `setTimeout`-based stall timer with `.unref()` resets on every line and fires warnings to stderr at each interval.

**Primary recommendation:** Implement the streaming function with empirical discovery of `stream-json` event format first, then build the NDJSON parser and display logic against observed event shapes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Empirically discover `stream-json` event format before implementing display logic (STREAM-01)
- `runClaudeStreaming(prompt, { outputFile, quiet })` is the sole entry point (STREAM-02, STREAM-04, STREAM-06)
- Uses `--output-format stream-json` for streaming, `--output-format json` for quiet mode
- Reads child process stdout via zx async iterable with `for await`
- Every raw NDJSON line accumulated into array; joined as `result.stdout`
- Each line parsed with `JSON.parse()` inside try/catch; parse failures write raw line to stdout
- Function returns `{ exitCode, stdout }`
- `displayStreamEvent(event)` is a pure function with switch on `event.type`
- `assistant` events: extract text from `event.message.content` blocks (type `text`), write to `process.stdout`
- `tool_use` events: write compact one-liner to `process.stderr` (two-space indent, diamond bullet, tool name)
- `result` events: silent -- captured programmatically
- All other event types: silent -- accumulated but not displayed
- When `outputFile` provided, each NDJSON line appended via `fs.appendFileSync()` (STREAM-05)
- Stall timeout via `getConfig('autopilot.stall_timeout_ms', 300000)` (STALL-01)
- Timer resets on every NDJSON line received (STALL-01)
- Warning re-arms automatically for repeated warnings (STALL-03)
- Timer uses `setTimeout` with `.unref()` (STALL-04)
- Timer cleaned up in try/finally block (STALL-04)
- New `--quiet` flag added to `knownFlags` set and parsed from `argv.quiet` (CLI-01)
- `QUIET` stored as module-level constant alongside `DRY_RUN` and `FROM_PHASE` (CLI-01)
- `< /dev/null` redirect preserved on both streaming and quiet paths (CLI-05)
- Functions placed in autopilot.mjs between config loading and step execution sections

### Claude's Discretion
- Internal variable names for stall timer state
- Exact stderr warning message formatting and wording
- String template literals vs concatenation for log messages
- Order of fields in returned object
- Discovery invocation prompt text and flags

### Deferred Ideas (OUT OF SCOPE)
- Wiring `runStep()` and `runStepCaptured()` (Phase 55)
- Wiring debug retry invocations (Phase 56)
- Adding `autopilot.stall_timeout_ms` to CONFIG_DEFAULTS and config schema (Phase 57)
- Token-level streaming UI (spinners, progress bars)
- Interactive stream controls (pause/resume)
- Automatic process kill on stall
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STREAM-01 | Discover `stream-json` event format empirically | Discovery task runs `claude -p --output-format stream-json` and records shapes |
| STREAM-02 | `runClaudeStreaming()` reads NDJSON via zx async iterator | zx 8.x ProcessPromise.stdout is a Readable; wrap with createInterface for line iteration |
| STREAM-03 | `displayStreamEvent()` writes assistant text to stdout, tool indicators to stderr | Pure function with switch on event.type; uses `process.stdout.write()` and `process.stderr.write()` |
| STREAM-04 | All NDJSON lines accumulated for `result.stdout` | Lines pushed to array; joined with newline on completion |
| STREAM-05 | Output file receives NDJSON lines in real-time | `fs.appendFileSync(outputFile, line + '\n')` on each line |
| STREAM-06 | Uses `--output-format stream-json` | CLI flag substituted in the zx template literal |
| STALL-01 | Configurable stall timer resets on every event | `getConfig('autopilot.stall_timeout_ms', 300000)` + `clearTimeout`/`setTimeout` per line |
| STALL-02 | Warning to stderr and log when timeout fires | `process.stderr.write()` + `logMsg()` |
| STALL-03 | Warning re-arms for repeated warnings | Timer callback re-sets itself after firing |
| STALL-04 | Timer cleanup on all exit paths | try/finally wrapping stream loop + `.unref()` on timer |
| CLI-01 | `--quiet` flag for buffered JSON output | Add to `knownFlags`, parse `argv.quiet`, store as `QUIET` constant |
| CLI-05 | `< /dev/null` stdin redirect preserved | Applied in zx template literal for both code paths |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zx | ^8.0.0 | Shell command execution, child process management | Already project dependency; ProcessPromise gives async iterable stdout |
| node:readline | built-in | Line-by-line stream reading via createInterface | Already imported in autopilot.mjs; standard Node.js approach for line iteration |
| node:fs | built-in | File I/O for output capture and config | Already used throughout autopilot.mjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:timers | built-in | setTimeout/clearTimeout for stall detection | Used for the repeating stall warning timer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| createInterface for line splitting | Manual buffer + split on newline | createInterface is simpler, already imported |
| setTimeout with manual re-arm | setInterval | setTimeout with re-arm gives exact control over interval-after-last-event semantics |

**Installation:** No new dependencies needed. Everything is built-in Node.js or already in package.json.

## Architecture Patterns

### Function Structure
```
autopilot.mjs (existing file)
├── ... existing imports, arg parsing ...
├── knownFlags (add 'quiet')
├── QUIET constant (new)
├── ... config loading, helper functions ...
├── runClaudeStreaming(prompt, opts)     ← NEW
├── displayStreamEvent(event)           ← NEW
├── ... existing runStep, runStepCaptured, etc. ...
```

### Pattern 1: zx Async Iterable Stdout with readline
**What:** Use `createInterface({ input: proc.stdout })` to get an async iterator of lines from a zx child process
**When to use:** When reading NDJSON (one JSON object per line) from a subprocess
**Example:**
```javascript
const proc = $`claude -p --output-format stream-json ${prompt} < /dev/null`.nothrow();
const rl = createInterface({ input: proc.stdout });
for await (const line of rl) {
  // process each NDJSON line
}
const result = await proc; // get exit code after stream ends
```
**Confidence:** HIGH — zx 8.x ProcessPromise inherits from Node.js ChildProcess; stdout is a standard Readable stream.

### Pattern 2: Stall Timer with Re-arm
**What:** setTimeout that resets on each event and re-arms after firing
**When to use:** Detecting periods of inactivity in a stream
**Example:**
```javascript
let stallTimer = null;
let stallCount = 0;
const stallTimeout = getConfig('autopilot.stall_timeout_ms', 300000);

function resetStallTimer() {
  if (stallTimer) clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    stallCount++;
    const mins = (stallTimeout * stallCount) / 60000;
    process.stderr.write(`\u26a0 No output for ${mins} minutes -- step may be stalled\n`);
    logMsg(`STALL WARNING: no output for ${mins} minutes`);
    // Re-arm for next interval
    stallTimer = setTimeout(arguments.callee, stallTimeout);
    stallTimer.unref();
  }, stallTimeout);
  stallTimer.unref();
}
```
**Confidence:** HIGH — standard Node.js setTimeout pattern.

### Pattern 3: Quiet Mode Branch
**What:** When `--quiet` is set, skip streaming entirely and use original buffered JSON behavior
**When to use:** CI environments or scripted usage where streaming output is unwanted
**Example:**
```javascript
if (quiet) {
  const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt} < /dev/null`.nothrow();
  return { exitCode: result.exitCode, stdout: result.stdout };
}
```
**Confidence:** HIGH — directly mirrors existing `runStep()` behavior.

### Anti-Patterns to Avoid
- **Piping stdout to readline after process completion:** Must create readline interface BEFORE awaiting the process, otherwise the stream has already been consumed
- **Using `proc.stdout.on('data')` for line reading:** Data events give arbitrary buffer chunks, not lines. Use readline createInterface instead.
- **Forgetting `.nothrow()` on zx commands:** Without it, non-zero exit codes throw exceptions that break the control flow

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line-by-line stream reading | Manual buffer + newline splitting | `createInterface({ input: stream })` | Handles partial lines, backpressure, encoding correctly |
| Timer that doesn't block process exit | Manual process.exit checks | `timer.unref()` | Built-in Node.js mechanism for non-blocking timers |

## Common Pitfalls

### Pitfall 1: Awaiting zx ProcessPromise Before Reading Stdout
**What goes wrong:** If you `await` the zx `$` tagged template before reading stdout, the process runs to completion and stdout is consumed/closed
**Why it happens:** `await` on a ProcessPromise waits for the process to exit, consuming all output
**How to avoid:** Store the ProcessPromise in a variable, read stdout via readline, THEN await the promise for exit code
**Warning signs:** Empty readline iteration, process completing before any lines are read

### Pitfall 2: createInterface Not Closing After Stream Ends
**What goes wrong:** The readline interface may not close automatically when the child process exits
**Why it happens:** readline waits for explicit 'close' event on the input stream
**How to avoid:** The child process stdout stream will emit 'close' when the process exits, which triggers readline 'close'. The `for await` loop will terminate naturally.
**Warning signs:** Process hanging after child exits

### Pitfall 3: JSON.parse on Non-JSON Lines
**What goes wrong:** Claude CLI may emit non-JSON lines (empty lines, debug output) mixed with NDJSON
**Why it happens:** Stream may include framing or debug output that isn't valid JSON
**How to avoid:** Wrap JSON.parse in try/catch; on failure, write raw line to stdout as defensive fallback (per CONTEXT.md decision)
**Warning signs:** Unhandled JSON parse errors crashing the process

### Pitfall 4: Timer Not Cleaned Up on Stream Error
**What goes wrong:** If the stream throws an error, the stall timer may remain active
**Why it happens:** Error path bypasses normal cleanup
**How to avoid:** Use try/finally wrapping the entire stream read loop; clearTimeout in finally block
**Warning signs:** Stale timer warnings appearing after the streaming function has returned

### Pitfall 5: Missing .unref() on Timer
**What goes wrong:** Node.js process stays alive waiting for timer even after all work is done
**Why it happens:** Active setTimeout keeps the event loop running
**How to avoid:** Call `.unref()` on every timer creation
**Warning signs:** Process hanging at end instead of exiting

## Code Examples

### Complete runClaudeStreaming Pattern
```javascript
async function runClaudeStreaming(prompt, { outputFile, quiet } = {}) {
  if (quiet || QUIET) {
    const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt} < /dev/null`.nothrow();
    return { exitCode: result.exitCode, stdout: result.stdout };
  }

  const lines = [];
  const stallTimeout = getConfig('autopilot.stall_timeout_ms', 300000);
  let stallTimer = null;
  let stallCount = 0;

  function armStallTimer() {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stallCount++;
      const mins = (stallTimeout * stallCount) / 60000;
      process.stderr.write(`\u26a0 No output for ${mins} minutes -- step may be stalled\n`);
      logMsg(`STALL WARNING: no output for ${mins} minutes`);
      stallTimer = setTimeout(armStallTimer, stallTimeout);
      stallTimer.unref();
    }, stallTimeout);
    stallTimer.unref();
  }

  const proc = $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format stream-json ${prompt} < /dev/null`.nothrow();
  const rl = createInterface({ input: proc.stdout });

  try {
    armStallTimer();
    for await (const line of rl) {
      lines.push(line);
      armStallTimer();
      if (outputFile) fs.appendFileSync(outputFile, line + '\n');
      try {
        const event = JSON.parse(line);
        displayStreamEvent(event);
      } catch {
        process.stdout.write(line + '\n');
      }
    }
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }

  const result = await proc;
  return { exitCode: result.exitCode, stdout: lines.join('\n') };
}
```

### displayStreamEvent Pattern
```javascript
function displayStreamEvent(event) {
  if (event.type === 'assistant') {
    const blocks = event.message?.content || [];
    for (const block of blocks) {
      if (block.type === 'text') {
        process.stdout.write(block.text);
      }
    }
  } else if (event.type === 'tool_use') {
    const toolName = event.name || event.tool_name || 'unknown';
    process.stderr.write(`  \u25c6 ${toolName}\n`);
  }
  // result and other types: silent
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--output-format json` (buffered) | `--output-format stream-json` (NDJSON streaming) | Claude CLI recent versions | Enables real-time output display |

## Open Questions

1. **Exact `stream-json` event shapes**
   - What we know: Design doc shows approximate shapes (`assistant`, `tool_use`, `tool_result`, `result`)
   - What's unclear: Exact field names and nesting in live output
   - Recommendation: STREAM-01 discovery task will resolve this empirically before implementing display logic

2. **zx ProcessPromise stdout readline interaction**
   - What we know: zx 8.x ProcessPromise exposes stdout as a Readable
   - What's unclear: Whether zx wraps stdout in a way that breaks readline createInterface
   - Recommendation: Test in discovery task; fallback to manual `proc.stdout.on('data')` + buffer splitting if needed

## Sources

### Primary (HIGH confidence)
- Codebase analysis: autopilot.mjs (current implementation patterns, imports, function structure)
- Codebase analysis: config.cjs (CONFIG_DEFAULTS, getConfig pattern)
- Codebase analysis: package.json (zx ^8.0.0 dependency)
- Node.js built-in: readline.createInterface for async line iteration (stable API)
- Node.js built-in: setTimeout/clearTimeout + .unref() (stable API)

### Secondary (MEDIUM confidence)
- zx 8.x ProcessPromise stdout as Readable stream — confirmed by zx being a standard Google/npm library using Node.js ChildProcess

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all built-in Node.js or existing dependencies
- Architecture: HIGH - straightforward NDJSON parsing pattern
- Pitfalls: HIGH - well-known Node.js stream and timer patterns

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (30 days — stable Node.js APIs)
