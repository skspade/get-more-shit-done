# Stack Research: Autopilot Streaming (v2.4)

**Domain:** Real-time streaming output for zx-based autopilot CLI
**Researched:** 2026-03-12
**Confidence:** HIGH

## Scope

This research covers ONLY the new capabilities needed for v2.4 streaming features. The existing validated stack (zx v8, createRequire, --output-format json, process.stdout.write, circuit breaker) is not re-evaluated.

## Recommended Stack

### Core Technologies (NEW for v2.4)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `readline` (built-in) | Node 22+ (already in use) | Line-by-line NDJSON parsing from child process stdout | Built-in, zero dependencies, async iterable via `for await`, already imported in autopilot.mjs for TTY input |
| `JSON.parse()` (built-in) | N/A | Parse each NDJSON line into structured event objects | Native, fast, no schema validation needed for known event shapes |
| `setTimeout` / `clearTimeout` (built-in) | N/A | Stall detection timer with repeated re-arming | Native timer API, no external scheduler needed for single-timer pattern |

### No New Dependencies Required

Zero npm packages need to be added. The entire streaming feature is implementable with Node.js built-ins and the existing zx dependency.

**Rationale:** The NDJSON protocol is trivial (one JSON object per newline). Libraries like `ndjson`, `stream-json`, or `JSONStream` add dependency weight for parsing that `readline` + `JSON.parse()` handles in ~5 lines. The autopilot already imports `readline` for TTY input (`createInterface`).

## Critical Finding: Claude CLI Stream-JSON Event Format

**The design doc's assumed event format is WRONG.** The design doc assumes top-level `{"type": "assistant", ...}` events. The actual Claude CLI `--output-format stream-json` emits a DIFFERENT format.

### Actual Event Format (without --include-partial-messages)

Without `--include-partial-messages`, the CLI emits complete turn-level messages as NDJSON:

```jsonl
{"type": "system", "subtype": "init", "data": {...}, "session_id": "..."}
{"type": "assistant", "data": {"message": {"content": [...]}}, "session_id": "..."}
{"type": "result", "subtype": "success", "data": {"total_cost_usd": 0.xx, "duration_ms": nnn, "num_turns": n}, "session_id": "..."}
```

These arrive as COMPLETE messages after each turn finishes. This means assistant text does NOT stream token-by-token -- it arrives as a single complete message per turn.

### Actual Event Format (with --include-partial-messages)

With `--include-partial-messages`, the CLI ALSO emits `stream_event` messages wrapping raw Anthropic API events:

```jsonl
{"type": "stream_event", "event": {"type": "message_start", ...}}
{"type": "stream_event", "event": {"type": "content_block_start", "content_block": {"type": "text", ...}}}
{"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}}
{"type": "stream_event", "event": {"type": "content_block_stop"}}
{"type": "stream_event", "event": {"type": "content_block_start", "content_block": {"type": "tool_use", "name": "Edit"}}}
{"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "input_json_delta", "partial_json": "..."}}}
{"type": "stream_event", "event": {"type": "content_block_stop"}}
{"type": "stream_event", "event": {"type": "message_delta", ...}}
{"type": "stream_event", "event": {"type": "message_stop"}}
{"type": "assistant", "data": {"message": {"content": [...]}}, "session_id": "..."}
{"type": "result", "subtype": "success", "data": {...}, "session_id": "..."}
```

### Implications for Design

1. **Must use `--include-partial-messages`** flag in addition to `--output-format stream-json` to get real-time token streaming
2. **Must also use `--verbose`** to see tool calls (per official docs example)
3. **Event dispatch must check TWO layers:** top-level `type` field, then for `stream_event` type, check `event.type` and `event.delta.type`
4. **The design doc's `displayStreamEvent()` switch must be rewritten** to handle the actual nested event structure

### Corrected CLI Invocation

```javascript
// Design doc assumed:
claude -p --output-format stream-json ${prompt}

// Actual correct invocation:
claude -p --output-format stream-json --verbose --include-partial-messages ${prompt}
```

### Corrected Event Display Logic

```javascript
function displayStreamEvent(line) {
  try {
    const msg = JSON.parse(line);

    if (msg.type === 'stream_event') {
      const event = msg.event;

      if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta') {
          process.stdout.write(event.delta.text);
        }
        // input_json_delta for tool inputs -- skip (too verbose)
      }

      if (event.type === 'content_block_start') {
        if (event.content_block?.type === 'tool_use') {
          process.stderr.write(`  * ${event.content_block.name}\n`);
        }
      }
    }

    if (msg.type === 'result') {
      // Final result -- capture for exit code / cost tracking
      return msg;
    }
  } catch {
    // Non-JSON line -- write raw to terminal as fallback
    process.stdout.write(line + '\n');
  }
  return null;
}
```

## zx Async Iterator for Line Streaming

### How It Works

zx `ProcessPromise` implements `Symbol.asyncIterator`, yielding lines from stdout by default (newline-delimited). This is the PREFERRED approach over `readline.createInterface` for zx child processes.

```javascript
// zx native async iteration -- yields lines from stdout
const child = $`claude -p --output-format stream-json --verbose --include-partial-messages ${prompt} < /dev/null`.nothrow();

for await (const line of child) {
  // Each `line` is a string (one NDJSON line)
  displayStreamEvent(line);
}

const result = await child; // Get exit code after iteration completes
```

**Key behaviors (verified from zx docs):**
- Yields **lines** by default (split on `\n`), not raw chunks
- Custom delimiters supported via `$({delimiter: '\0'})`
- `.nothrow()` works with async iteration (no exception on non-zero exit)
- After iteration completes, `await child` resolves with the ProcessOutput
- Buffering handled internally -- no data loss between iteration start and process output

### Alternative: zx `.stdout` Property

For chunk-level (not line-level) streaming:

```javascript
const child = $`...`.nothrow();
for await (const chunk of child.stdout) {
  // Raw chunks, NOT lines -- would need manual line buffering
}
```

**Recommendation:** Use the default async iterator (line-level), NOT `.stdout` (chunk-level). NDJSON is line-delimited, and zx's default iterator already handles line splitting. Using `.stdout` would require reimplementing line buffering that zx already does.

## readline vs zx Async Iterator

| Aspect | `readline.createInterface` | zx `for await (of $\`...\`)` |
|--------|---------------------------|------------------------------|
| Line splitting | Built-in | Built-in |
| Async iterable | Yes | Yes |
| Already in codebase | Yes (TTY input) | Yes (zx dependency) |
| Extra setup | Need to pass child.stdout as input | Zero -- works directly |
| Error handling | Separate | Integrated with .nothrow() |
| Exit code access | Separate child.on('exit') | `await child` after loop |

**Recommendation:** Use zx's native async iterator. It is simpler because it directly yields lines from the `$` tagged template with zero additional setup. No need to extract the child process handle, create a readline interface, and wire them together. The `readline` import stays for TTY input only.

## Stall Detection Timer Pattern

Node.js `setTimeout` with re-arming is the correct approach. No external library needed.

```javascript
let stallTimer = null;
let stallCount = 0;
const STALL_TIMEOUT = getConfig('autopilot.stall_timeout_ms', 300000);

function resetStallTimer() {
  if (stallTimer) clearTimeout(stallTimer);
  stallCount = 0;

  function warn() {
    stallCount++;
    const mins = (STALL_TIMEOUT * stallCount) / 60000;
    process.stderr.write(`\nWARN: No output for ${mins} minutes -- step may be stalled\n`);
    logMsg(`STALL WARNING: no output for ${mins}m`);
    stallTimer = setTimeout(warn, STALL_TIMEOUT);
  }

  stallTimer = setTimeout(warn, STALL_TIMEOUT);
}

function clearStallTimer() {
  if (stallTimer) clearTimeout(stallTimer);
  stallTimer = null;
}
```

**Key design note:** The design doc used `arguments.callee` for re-arming which is deprecated in strict mode and unavailable in ES modules. Use a named function reference instead.

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ndjson` npm package | Adds dependency for trivial parsing (JSON.parse per line) | `JSON.parse()` on each line from zx iterator |
| `stream-json` npm package | Heavy streaming JSON parser designed for large JSON documents, not NDJSON | `JSON.parse()` per line |
| `JSONStream` npm package | SAX-style parser for streaming large JSON -- wrong abstraction for NDJSON | `JSON.parse()` per line |
| `split2` npm package | Stream transform that splits on newlines -- zx already does this | zx async iterator |
| `highland` / `rxjs` | Reactive stream libraries -- massive overkill for sequential line processing | `for await...of` loop |
| `readline` for child process | Extra wiring when zx already provides line-level async iteration | zx `for await (of $\`...\`)` |
| External timer libraries | `setTimeout` is sufficient for single-timer stall detection | Built-in `setTimeout`/`clearTimeout` |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| zx async iterator | `readline.createInterface(child.stdout)` | Only if zx iterator has bugs with specific edge cases (none known) |
| `JSON.parse()` per line | `ndjson` package | Only if you need backpressure-aware transform streams (we do not) |
| `setTimeout` re-arming | `setInterval` | Never for stall detection -- setInterval continues even after events resume, setTimeout resets cleanly |
| `--include-partial-messages` | Without (turn-level messages only) | Only if you want turn-level granularity (defeats purpose of streaming) |

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| zx | ^8.0.0 (latest 8.8.5) | Node.js 16.7+ | Async iterator on ProcessPromise available since zx 7.x, stable in 8.x |
| Node.js | 22.x (in use) | zx 8.x | Full async iterator support, native ES modules, `createRequire` |
| Claude CLI | Current | `--output-format stream-json --include-partial-messages --verbose` | All three flags needed for token-level streaming |

## Installation

```bash
# No new packages to install.
# Existing dependency is sufficient:
#   "zx": "^8.0.0"
```

## Integration Points with Existing Autopilot

### Where Streaming Replaces Buffered Calls

All 5 `claude -p` invocation sites in `autopilot.mjs` use this pattern today:

```javascript
const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt} < /dev/null`.nothrow();
```

These are at:
1. `runStep()` -- line 278
2. `runStepCaptured()` -- line 469
3. `runStepWithRetry()` debug invocation -- line 536
4. `runVerifyWithDebugRetry()` debug invocations -- lines 581, 620

All 5 converge into `runClaudeStreaming()` which switches between:
- **Streaming mode:** `--output-format stream-json --verbose --include-partial-messages` with `for await` line processing
- **Quiet mode (--quiet flag):** `--output-format json` with `await` (current behavior preserved)

### Data Flow

```
runStep() / runStepCaptured()
  |
  v
runClaudeStreaming(prompt, { outputFile, quiet })
  |
  +-- quiet=true: await $`claude ... --output-format json ...` (unchanged)
  |
  +-- quiet=false: for await (line of $`claude ... --output-format stream-json ...`)
                     |
                     +-- resetStallTimer()
                     +-- lines.push(line)
                     +-- appendToOutputFile(line)
                     +-- displayStreamEvent(line) --> stdout/stderr
                     |
                   clearStallTimer()
                   await child --> exitCode
```

### Backwards Compatibility

- `runStepCaptured()` still writes to outputFile (line-by-line instead of end-batch)
- `result.stdout` still available as accumulated `lines.join('\n')` for debug retry error context extraction
- Exit code handling unchanged
- Progress circuit breaker snapshots unchanged (taken before/after step)

## Sources

- [zx ProcessPromise docs](https://google.github.io/zx/process-promise) -- async iterator yields lines, .nothrow() compatibility (HIGH confidence)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) -- `--include-partial-messages` flag, `--output-format stream-json` (HIGH confidence)
- [Claude Code headless/programmatic docs](https://code.claude.com/docs/en/headless) -- jq example confirming `stream_event` + `text_delta` event nesting (HIGH confidence)
- [Agent SDK streaming output docs](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- complete event type reference: message_start, content_block_start, content_block_delta, content_block_stop, message_delta, message_stop (HIGH confidence)
- [Claude Code issue #24596](https://github.com/anthropics/claude-code/issues/24596) -- confirms stream-json event types including `system`, `stream_event`, `assistant`, `result` top-level types (MEDIUM confidence -- community source, but matches official docs)
- [Node.js readline documentation](https://nodejs.org/api/readline.html) -- async iterator support, `crlfDelay`, performance notes (HIGH confidence)
- [zx npm registry](https://www.npmjs.com/package/zx) -- latest version 8.8.5 (HIGH confidence)

---
*Stack research for: Autopilot Streaming v2.4*
*Researched: 2026-03-12*
