# Architecture: Autopilot Streaming Integration

**Domain:** Real-time streaming output integration into zx-based autopilot
**Researched:** 2026-03-12
**Confidence:** HIGH (verified against zx docs, Claude CLI docs, and direct source reading of autopilot.mjs)

## Integration Overview

The streaming integration replaces 5 buffered `claude -p --output-format json` invocations with a single `runClaudeStreaming()` function that uses `--output-format stream-json` to emit NDJSON. The function reads stdout line-by-line via zx's built-in async iterator, parses each line as JSON, displays events in real-time, and accumulates all output for compatibility with existing debug retry context extraction and output file capture.

The critical architectural constraint: **every existing consumer of `result.stdout` must continue to work identically.** Debug retry reads the last 100 lines of captured output. The circuit breaker reads progress snapshots before and after step execution. Verification gate reads verification status from files. None of these change -- only the transport (buffered vs streaming) changes.

## Component Map: New vs Modified

### New Components

| Component | Type | Location | Purpose |
|-----------|------|----------|---------|
| `runClaudeStreaming()` | Function | `autopilot.mjs` | Core streaming runner replacing `$\`claude ...\`` |
| `displayStreamEvent()` | Function | `autopilot.mjs` | Routes NDJSON events to terminal display |
| `resetStallTimer()` | Function | `autopilot.mjs` | Stall detection with repeated warnings |
| `--quiet` flag | CLI flag | `autopilot.mjs` argv | Restores buffered JSON behavior for CI |

### Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `runStep()` | Delegates to `runClaudeStreaming()` instead of `await $\`...\`` | LOW -- wrapper only |
| `runStepCaptured()` | Delegates to `runClaudeStreaming()` with `outputFile` | LOW -- wrapper only |
| `runStepWithRetry()` | No change (calls `runStepCaptured`) | NONE |
| `runVerifyWithDebugRetry()` | No change (calls `runStepCaptured`) | NONE |
| Debug retry `$\`claude ...\`` calls (3 sites) | Delegate to `runClaudeStreaming()` | LOW -- same function |
| `knownFlags` set | Add `'quiet'` | NONE |
| Argument parsing | Add `QUIET` constant | NONE |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `checkProgress()` / circuit breaker | Reads git commits + artifact count, not stdout |
| `constructDebugPrompt()` | Constructs prompt string, unrelated to output format |
| `writeFailureReport()` | Reads output file (which is still written) |
| `runVerificationGate()` | Reads verification status from files via CJS |
| `getPhaseStep()` / phase navigation | Reads STATE.md via CJS, not stdout |
| `runMilestoneAudit()` | Calls `runStepWithRetry()` (which adopts streaming internally) |
| `runGapClosureLoop()` | Orchestration logic, no direct claude invocations |
| `runMilestoneCompletion()` | Calls `runStepWithRetry()` |

## System Architecture

```
                    autopilot.mjs Main Loop
                           |
         +-----------------+------------------+
         |                 |                  |
    runStep()      runStepCaptured()    debug $`claude...`
         |                 |                  |
         +--------+--------+--------+---------+
                  |                  |
          runClaudeStreaming()   [3 debug sites]
                  |                  |
                  +--------+---------+
                           |
                  [CORE STREAMING FUNCTION]
                           |
            +-----------------------------+
            |                             |
      quiet=true                    quiet=false
      (--output-format json)    (--output-format stream-json)
            |                             |
      await $`...`                 for await (line of p)
      return stdout                       |
                              +-----------+-----------+
                              |           |           |
                         JSON.parse   appendFile   accumulate
                              |        (output)     (lines[])
                              |
                     displayStreamEvent()
                              |
                    +---------+---------+
                    |         |         |
              text_delta  tool_use   result
              -> stdout   -> stderr  -> capture
```

## Data Flow: Streaming Mode

### NDJSON Event Format (Claude CLI)

Claude CLI `--output-format stream-json` emits NDJSON (one JSON object per line). The top-level `.type` field determines the event category:

| Top-Level Type | Description | Display Action |
|----------------|-------------|----------------|
| `system` | Session init, tool list | Silent |
| `stream_event` | Raw API streaming events (deltas) | Parse `.event` subtype |
| `assistant` | Complete assistant message (text + tool calls) | Silent (redundant with deltas) |
| `user` | Tool results returned to model | Silent |
| `result` | Final result with cost, duration, session ID | Capture for return value |

**Within `stream_event`, the `.event.type` determines the sub-event:**

| Event Subtype | Description | Display Action |
|---------------|-------------|----------------|
| `message_start` | New message begins | Silent |
| `content_block_start` | New text or tool_use block | If `tool_use`: show tool name on stderr |
| `content_block_delta` | Incremental text or JSON chunk | If `text_delta`: write to stdout |
| `content_block_stop` | Block complete | Silent |
| `message_delta` | Stop reason, usage stats | Silent |
| `message_stop` | Message complete | Silent |

### Text Extraction Path

```
NDJSON line
  -> JSON.parse()
  -> type === "stream_event"
  -> event.type === "content_block_delta"
  -> event.delta.type === "text_delta"
  -> event.delta.text -> process.stdout.write()
```

### Tool Call Detection Path

```
NDJSON line
  -> JSON.parse()
  -> type === "stream_event"
  -> event.type === "content_block_start"
  -> event.content_block.type === "tool_use"
  -> event.content_block.name -> process.stderr.write()
```

### Result Capture Path

```
NDJSON line
  -> JSON.parse()
  -> type === "result"
  -> store as finalResult (for exit code, cost, session_id)
```

## Key Integration Pattern: zx Async Iterator

zx's `ProcessPromise` implements `Symbol.asyncIterator`, splitting stdout by newlines by default. This is the exact behavior needed for NDJSON parsing:

```javascript
const p = $`cd ${PROJECT_DIR} && claude -p --output-format stream-json ${prompt} < /dev/null`.nothrow();

for await (const line of p) {
  // Each `line` is one NDJSON object (newline-delimited)
  // zx strips the trailing newline automatically
}
```

**Critical detail:** `for await (const line of p)` iterates line-by-line (newline delimiter) in real-time as the process emits output. This is distinct from `for await (const chunk of p.stdout)` which yields raw Buffer chunks without line splitting.

**`.nothrow()` compatibility:** `.nothrow()` must be called on the ProcessPromise before iteration begins. It modifies promise rejection behavior -- non-zero exit codes do not throw. After the `for await` loop completes (stdout closes), the process can still be awaited to get the exit code.

**readline is NOT needed.** zx's built-in line iterator eliminates the need for `readline.createInterface()`. The design doc's approach of reading `child.stdout` directly should instead use zx's native `for await (const line of p)` pattern.

## Core Streaming Function Design

```javascript
async function runClaudeStreaming(prompt, { outputFile, quiet } = {}) {
  const format = quiet ? 'json' : 'stream-json';
  const args = ['--output-format', format];
  if (!quiet) args.push('--verbose', '--include-partial-messages');

  const p = $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions ${args} ${prompt} < /dev/null`.nothrow();

  if (quiet) {
    const result = await p;
    if (result.stdout) process.stdout.write(result.stdout);
    if (outputFile) fs.appendFileSync(outputFile, result.stdout || '');
    return { exitCode: result.exitCode, stdout: result.stdout };
  }

  // Streaming mode
  const lines = [];
  let stallTimer = null;
  // ... stall timer setup ...

  for await (const line of p) {
    resetStallTimer();
    lines.push(line);
    if (outputFile) fs.appendFileSync(outputFile, line + '\n');

    try {
      const event = JSON.parse(line);
      displayStreamEvent(event);
    } catch {
      process.stdout.write(line + '\n');
    }
  }

  clearTimeout(stallTimer);
  const result = await p;
  return { exitCode: result.exitCode, stdout: lines.join('\n') };
}
```

### Design Decision: `--verbose --include-partial-messages`

The `--include-partial-messages` flag is **required** for stream-json to emit `stream_event` lines with text deltas. Without it, only complete `assistant` messages are emitted (after the full response is generated), defeating the purpose of streaming. The `--verbose` flag enables full turn-by-turn output.

**This is a key finding that differs from the design doc.** The design doc does not mention `--include-partial-messages`, but the CLI docs state it is required: "Include partial streaming events in output (requires `--print` and `--output-format=stream-json`)".

## Integration with Existing Systems

### 1. Output File Capture (Debug Retry Context)

**Current:** `runStepCaptured()` writes `result.stdout` to outputFile after process exits.
**New:** Each NDJSON line is appended to outputFile in real-time as it arrives.

**Compatibility impact:** The debug retry reads the last 100 lines of the output file:
```javascript
const content = fs.readFileSync(outputFile, 'utf-8');
errorContext = content.split('\n').slice(-100).join('\n');
```

With streaming, the file contains NDJSON lines instead of a single JSON blob. The last 100 lines will be the last 100 NDJSON events, which contain the final assistant text, tool results, and the result event. This is **more useful** for debugging than the current approach (which gives one large JSON object).

The failure report also reads the last 50 lines:
```javascript
lastError = lines.slice(-50).join('\n');
```

Same improvement applies -- the last 50 NDJSON events provide a focused tail of activity rather than the middle/end of a monolithic JSON structure.

**No changes needed to `constructDebugPrompt()` or `writeFailureReport()`.** Both consume raw text from the output file and pass it as string context.

### 2. Progress Circuit Breaker

**Current:** `checkProgress()` compares git commit count + artifact file count before and after step execution.
**New:** Identical. The circuit breaker does not read stdout.

```
runStep() -> takeProgressSnapshot() -> runClaudeStreaming() -> takeProgressSnapshot() -> checkProgress()
```

The circuit breaker wraps the streaming function, not the other way around. No changes needed.

### 3. Stall Detection (New)

Stall detection is a new concern that complements the circuit breaker:

| System | Detects | Scope | Response |
|--------|---------|-------|----------|
| Circuit breaker | No progress across steps | Multi-step | Halt autopilot |
| Stall detection | No output within a step | Single step | Warning to stderr |

Stall detection resets on every NDJSON line received. If no lines arrive within the timeout (default 5 min), it prints a warning to stderr and re-arms for the next interval. It does NOT kill the process -- Claude may be performing long tool operations.

### 4. Exit Code Handling

**Current:** `result.exitCode` checked after `await $\`...\``.
**New:** After `for await` loop completes, `await p` to get the final ProcessOutput with `.exitCode`.

```javascript
for await (const line of p) { /* ... */ }
const result = await p;  // Process already exited; this resolves immediately
return { exitCode: result.exitCode, stdout: lines.join('\n') };
```

**Critical:** The `for await` loop ends when the process closes stdout. Awaiting `p` after the loop gets the already-resolved exit code without blocking.

### 5. Display Event Function

```javascript
function displayStreamEvent(event) {
  if (event.type === 'stream_event') {
    const inner = event.event;
    if (inner.type === 'content_block_delta' && inner.delta?.type === 'text_delta') {
      process.stdout.write(inner.delta.text);
    } else if (inner.type === 'content_block_start' && inner.content_block?.type === 'tool_use') {
      process.stderr.write(`  \u25C6 ${inner.content_block.name}\n`);
    }
  }
  // All other event types (system, assistant, user, result) are silent
}
```

**stdout vs stderr separation:**
- Assistant text -> stdout (the "main content" stream, can be piped)
- Tool indicators -> stderr (activity signal, does not pollute piped output)
- Stall warnings -> stderr (diagnostic, does not pollute piped output)

### 6. `--quiet` Flag and CI Compatibility

When `--quiet` is passed, `runClaudeStreaming()` falls back to `--output-format json` and the original buffered behavior. This ensures:

- CI/CD pipelines that parse JSON output continue to work
- Scripted invocations that capture stdout get a single JSON blob
- No streaming display or stall detection overhead

## Anti-Patterns

### Anti-Pattern 1: Using readline.createInterface for NDJSON parsing

**What people do:** Import `readline` and wrap `child.stdout` in `createInterface()` for line splitting.
**Why it is wrong:** zx already provides line-by-line iteration via `Symbol.asyncIterator` with newline as the default delimiter. Adding readline creates an unnecessary abstraction layer and can interfere with zx's stream management.
**Do this instead:** Use `for await (const line of p)` directly on the ProcessPromise.

### Anti-Pattern 2: Reading p.stdout for line-by-line iteration

**What people do:** Use `for await (const chunk of p.stdout)` expecting lines.
**Why it is wrong:** `p.stdout` yields raw Buffer chunks, not newline-delimited strings. A single chunk may contain partial lines or multiple lines.
**Do this instead:** Use `for await (const line of p)` which uses zx's built-in newline splitter.

### Anti-Pattern 3: Killing the process on stall timeout

**What people do:** Set a timer that calls `process.kill()` when no output arrives.
**Why it is wrong:** Claude may be executing long-running tool operations (e.g., running a test suite, reading many files). Tool execution does not produce stream events. A stall during tool execution is normal behavior.
**Do this instead:** Warn on stall but let the process continue. The circuit breaker at the step level handles actual stuck scenarios.

### Anti-Pattern 4: Accumulating parsed events instead of raw lines

**What people do:** Store parsed JSON objects in an array, then serialize back to produce `stdout`.
**Why it is wrong:** Wasteful memory usage and loses the exact byte representation. The debug retry and failure report consume raw text, not structured data.
**Do this instead:** Accumulate raw NDJSON lines as strings. Join with `\n` for the `stdout` return value.

### Anti-Pattern 5: Displaying `assistant` messages for real-time output

**What people do:** Check for `event.type === 'assistant'` to display text in real-time.
**Why it is wrong:** `assistant` messages are complete messages emitted after Claude finishes a full response turn. They contain the same text that was already streamed via `stream_event` deltas. Displaying them produces duplicate output.
**Do this instead:** Display only `stream_event` with `content_block_delta` / `text_delta` for real-time text. Ignore `assistant` messages entirely (they are useful for programmatic consumption, not display).

## Design Doc Corrections

The design doc (2026-03-12-autopilot-realtime-streaming-design.md) has several assumptions that need correction based on research:

### 1. Event Type Model

**Design doc assumes:** Top-level `type` values of `assistant`, `tool_use`, `tool_result`, `result`.
**Actual behavior:** Top-level `type` values of `system`, `stream_event`, `assistant`, `user`, `result`. Text and tool events are nested inside `stream_event` as `event.type` subtypes (e.g., `content_block_delta`, `content_block_start`).

**Impact:** `displayStreamEvent()` must check `event.type === 'stream_event'` first, then inspect `event.event.type` for the inner event subtype.

### 2. `--include-partial-messages` Flag

**Design doc omits:** The `--include-partial-messages` flag.
**Required:** Without this flag, `stream_event` lines with incremental deltas are not emitted. Only complete `assistant` messages appear, making streaming pointless.

**Impact:** Add `--include-partial-messages` and `--verbose` to the claude invocation when in streaming mode.

### 3. stdout Reading Mechanism

**Design doc assumes:** `for await (const line of child.stdout)`.
**Correct approach:** `for await (const line of p)` where `p` is the ProcessPromise itself. zx's `Symbol.asyncIterator` on ProcessPromise splits by newlines; `p.stdout` gives raw chunks.

**Impact:** Use ProcessPromise iteration, not stdout stream iteration.

### 4. Exit Code After Streaming

**Design doc shows:** `const result = await child;` after the loop.
**Correct approach:** `const result = await p;` where `p` is the same ProcessPromise used in the loop. After the `for await` loop ends (stdout closed), awaiting `p` resolves with the ProcessOutput containing `.exitCode`.

**Impact:** Minor naming change, same semantics.

## Invocation Site Inventory

All 5 current `claude -p` invocation sites and their streaming integration:

| Site | Current Location | Function | Output File | Streaming Change |
|------|-----------------|----------|-------------|------------------|
| 1. Main step execution | `runStep()` line 278 | `await $\`...\`` | None | `runClaudeStreaming(prompt, { quiet: QUIET })` |
| 2. Captured step execution | `runStepCaptured()` line 469 | `await $\`...\`` | Yes | `runClaudeStreaming(prompt, { outputFile, quiet: QUIET })` |
| 3. Debug retry (runStepWithRetry) | Line 536 | `await $\`...\`` | None | `runClaudeStreaming(debugPrompt, { quiet: QUIET })` |
| 4. Debug retry (verify crash) | Line 581 | `await $\`...\`` | None | `runClaudeStreaming(debugPrompt, { quiet: QUIET })` |
| 5. Debug retry (verify gaps) | Line 620 | `await $\`...\`` | None | `runClaudeStreaming(debugPrompt, { quiet: QUIET })` |

Sites 3-5 are debug retry invocations. The design doc correctly notes that debugging should also stream by default (watching the debugger work in real-time is valuable for understanding what it is doing).

## Build Order (Dependency-Driven)

### Phase 1: Core Streaming Function

**New: `runClaudeStreaming()` + `displayStreamEvent()` + stall detection**

Dependencies: None (greenfield function)
- Implement `runClaudeStreaming()` with quiet/streaming dual mode
- Implement `displayStreamEvent()` with proper event type routing
- Implement stall timer with repeated warnings
- Add `--quiet` flag to argv parsing
- Unit test: mock child process, verify line accumulation, verify display routing

Why first: This is the foundation. Nothing else can be tested without it.

### Phase 2: Step Function Integration

**Modified: `runStep()` + `runStepCaptured()`**

Dependencies: Phase 1 (runClaudeStreaming must exist)
- Replace `await $\`...\`` in `runStep()` with `runClaudeStreaming()` call
- Replace `await $\`...\`` in `runStepCaptured()` with `runClaudeStreaming()` call
- Verify: progress snapshots still taken before/after
- Verify: exit code handling unchanged
- Verify: output file written correctly in streaming mode

Why second: These are the primary invocation wrappers. Debug retry depends on `runStepCaptured()` working.

### Phase 3: Debug Retry Integration

**Modified: 3 debug `$\`claude...\`` sites**

Dependencies: Phase 1 (runClaudeStreaming)
- Replace debug retry invocations (lines 536, 581, 620) with `runClaudeStreaming()`
- Verify: debug retry loop still works (output capture, retry counting)
- Verify: failure report still reads output correctly

Why third: Debug retry sites are independent of step functions. Could be done in parallel with Phase 2 but sequencing reduces risk.

### Phase 4: Config Integration + Polish

**Modified: config.json schema, documentation**

Dependencies: Phases 1-3
- Add `autopilot.stall_timeout_ms` to CONFIG_DEFAULTS
- Add `autopilot.stall_timeout_ms` to config.json schema
- Update `gsd settings` display for stall timeout
- Verify end-to-end: `--quiet` flag, streaming mode, stall detection

Why last: Config is read by the stall timer but has a hardcoded default. This is polish, not blocking.

### Dependency Graph

```
[1] runClaudeStreaming() --------+--------+
    displayStreamEvent()         |        |
    stall detection              v        v
                           [2] runStep   [3] debug retry
                           runStepCaptured   (3 sites)
                                 |        |
                                 v        v
                           [4] Config + polish
```

## Invariants (Must Not Be Violated)

1. **`runClaudeStreaming()` returns identical `{ exitCode, stdout }` shape** -- all callers depend on this contract
2. **Output file receives every line in real-time** -- debug retry reads output files during the retry loop
3. **`--quiet` mode produces identical behavior to current implementation** -- CI compatibility
4. **Stall detection never kills the process** -- only warns; process termination is the circuit breaker's job
5. **No new dependencies** -- zx already provides everything needed (async iterator, nothrow, process management)
6. **stdout/stderr separation preserved** -- assistant text to stdout, diagnostics to stderr
7. **`< /dev/null` fix preserved** -- prevents claude from reading stdin, which causes hangs in non-interactive mode

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| zx async iterator drops lines under heavy output | LOW | HIGH | zx uses Node.js stream infrastructure; backpressure handled automatically |
| `--include-partial-messages` changes behavior | LOW | MEDIUM | Flag is documented and stable; test with actual claude invocation |
| NDJSON line contains embedded newline | LOW | HIGH | Claude CLI guarantees one JSON object per line; JSON spec does not allow unescaped newlines in strings |
| Stall timer fires during legitimate long tool execution | HIGH | LOW | Timer only warns, does not kill; user sees warning and waits |
| Output file grows very large with NDJSON | MEDIUM | LOW | Same data volume as JSON; lines are individually smaller but more numerous |
| `for await` loop does not terminate if process hangs | LOW | MEDIUM | SIGINT handler already exists; circuit breaker operates at outer loop |

## Sources

- [zx ProcessPromise docs](https://google.github.io/zx/process-promise) -- async iterator, pipe, nothrow behavior (HIGH confidence)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) -- `--output-format stream-json`, `--include-partial-messages` flags (HIGH confidence)
- [Claude Code headless mode docs](https://code.claude.com/docs/en/headless) -- stream-json usage with `-p` flag (HIGH confidence)
- [Agent SDK streaming output docs](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- StreamEvent reference, event subtypes, message flow (HIGH confidence)
- [GitHub issue #24596](https://github.com/anthropics/claude-code/issues/24596) -- stream-json event type discussion, jq filter examples (MEDIUM confidence)
- [ytyng blog: extract text from stream-json](https://www.ytyng.com/en/blog/claude-stream-json-jq) -- NDJSON structure examples, text_delta extraction (MEDIUM confidence)
- Direct reading: `autopilot.mjs` -- all 5 invocation sites, debug retry, circuit breaker (HIGH confidence)
- Direct reading: design doc `2026-03-12-autopilot-realtime-streaming-design.md` (HIGH confidence)

---
*Architecture research for: autopilot streaming integration*
*Researched: 2026-03-12*
