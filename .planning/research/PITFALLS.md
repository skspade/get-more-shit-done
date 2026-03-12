# Domain Pitfalls: Adding NDJSON Streaming to zx-Based Autopilot

**Domain:** Adding real-time streaming output to an existing zx-based CLI tool that spawns child processes
**Researched:** 2026-03-12
**Overall confidence:** HIGH (grounded in existing codebase analysis, design doc review, zx documentation, Node.js stream semantics, and prior VoidStream bug experience)

---

## Critical Pitfalls

Mistakes that cause hangs, data loss, silent corruption, or require significant rework.

---

### Pitfall 1: `child.stdout` Yields Raw Chunks, Not Lines — JSON.parse Will Fail on Chunk Boundaries

**What goes wrong:**
The design doc iterates `for await (const line of child.stdout)` and calls `JSON.parse(line)` on each iteration. This is wrong. `child.stdout` is a raw readable stream that yields arbitrary byte chunks aligned to pipe buffer boundaries (typically 64KB), NOT newline-delimited lines. A single NDJSON line can be split across two chunks, or a single chunk can contain multiple NDJSON lines. `JSON.parse()` on a partial chunk produces a syntax error. Multiple JSON objects in one chunk means only the first parses and the rest are silently discarded.

**Why it happens:**
The zx ProcessPromise has TWO async iteration modes that look almost identical:
- `for await (const line of child)` -- iterates the ProcessPromise directly, which uses zx's internal `getLines()` splitter to yield complete newline-delimited lines
- `for await (const chunk of child.stdout)` -- iterates the raw Node.js readable stream, which yields arbitrary chunks

The design doc uses the second form but expects the behavior of the first. This is an easy mistake because the variable is named `line` and the comment says "read stdout line-by-line."

**How to avoid:**
Use `for await (const line of child)` to iterate the ProcessPromise directly. zx's built-in line splitter handles buffering partial lines across chunks and yielding only complete lines. Alternatively, if you need raw stream access, wrap `child.stdout` in `readline.createInterface({ input: child.stdout, crlfDelay: Infinity })` to get line-by-line iteration. But the zx built-in approach is simpler and correct.

**Warning signs:**
- Intermittent `SyntaxError: Unexpected end of JSON input` in logs
- JSON parse errors that appear randomly, not on every line
- Errors correlate with long NDJSON lines (tool_use events with large content) that exceed a pipe buffer boundary
- Works fine in quick runs but fails during long-running phases with lots of tool activity

**Phase to address:** Phase 1 (core `runClaudeStreaming()` function). This is the foundational line-reading mechanism. Getting it wrong means every downstream feature (display, stall timer, output capture) operates on corrupt data.

**Confidence:** HIGH -- verified via zx documentation: ProcessPromise `[Symbol.asyncIterator]` returns a line iterator; `.stdout` returns the raw Node.js Readable stream.

---

### Pitfall 2: `arguments.callee` Is Illegal in ES Modules — Stall Timer Re-Arm Will Crash

**What goes wrong:**
The design doc's `resetStallTimer()` function uses `setTimeout(arguments.callee, STALL_TIMEOUT)` to re-arm the stall warning after each interval. ES modules run in strict mode by default. `arguments.callee` throws `TypeError: 'caller', 'callee', and 'arguments' properties may not be accessed on strict mode functions` the first time the stall timer fires. Since the stall timer only fires after 5 minutes of silence, this bug will not appear in any unit test or short integration test. It will appear only in production when Claude is genuinely stalled -- exactly when you need it most.

**Why it happens:**
`arguments.callee` was a common pre-ES5 pattern for recursive anonymous functions. The design doc uses it in a setTimeout callback. Since `autopilot.mjs` is an ES module (uses `import`, runs under zx's ESM mode), strict mode is always active and `arguments.callee` is forbidden.

**How to avoid:**
Use a named function expression:
```javascript
stallTimer = setTimeout(function onStall() {
  stallWarningCount++;
  const mins = (STALL_TIMEOUT * stallWarningCount) / 60000;
  console.error(`Warning: No output for ${mins} minutes`);
  logMsg(`STALL WARNING: no output for ${mins}m`);
  stallTimer = setTimeout(onStall, STALL_TIMEOUT);
}, STALL_TIMEOUT);
```

**Warning signs:**
- Stall timer never fires during normal testing (Claude usually responds within seconds)
- No test exercises the 5-minute timeout path
- TypeError crash shows up only in production autopilot logs during genuinely stalled steps

**Phase to address:** Phase 1 (stall detection). The fix is trivial (named function) but the bug is invisible until production. Write a unit test that fast-forwards timers to verify the re-arm path.

**Confidence:** HIGH -- `arguments.callee` is unambiguously forbidden in strict mode, and ESM files are always strict.

---

### Pitfall 3: Stall Timer Prevents Process Exit — Node.js Hangs After Stream Ends

**What goes wrong:**
`setTimeout()` keeps a reference in the Node.js event loop. If `clearTimeout(stallTimer)` is not called on every exit path -- including error paths, SIGINT, and unexpected stream close -- the Node.js process will hang indefinitely waiting for the timer to fire. The design doc calls `clearTimeout(stallTimer)` only after the `for await` loop completes normally. If the child process crashes (non-zero exit, signal kill), the stream may close with an error that causes `for await` to throw, skipping the `clearTimeout`.

**Why it happens:**
`for await` can throw if the underlying stream emits an `error` event. When this happens, execution jumps to the catch block (if any) and the code after the loop never runs. The stall timer, still armed with a 5-minute timeout, keeps the event loop alive. The autopilot appears to hang between steps.

**How to avoid:**
1. Use `try/finally` around the `for await` loop to guarantee `clearTimeout`:
```javascript
try {
  for await (const line of child) { /* ... */ }
} finally {
  clearTimeout(stallTimer);
}
```
2. Additionally, call `stallTimer.unref()` on each setTimeout so the timer does not prevent process exit if it is the only remaining event loop reference. This is a defense-in-depth measure.
3. In signal handlers (SIGINT/SIGTERM), clear the stall timer before exiting.

**Warning signs:**
- Autopilot hangs for 5 minutes between steps after a claude process crashes
- Process does not respond to the circuit breaker because it is stuck waiting for a timer, not in a step
- Log shows STEP DONE but next BANNER never appears

**Phase to address:** Phase 1 (core streaming function). The `try/finally` pattern must be baked into `runClaudeStreaming()` from the start. Adding `unref()` should also happen here.

**Confidence:** HIGH -- standard Node.js event loop behavior: active timers prevent exit.

---

### Pitfall 4: Race Between `for await` Iterator Completion and ProcessPromise Resolution

**What goes wrong:**
After the `for await` loop finishes (stream closed), the design calls `const result = await child` to get the exit code. In zx, the ProcessPromise resolves when the child process exits AND all stdio streams close. If the `for await` loop consumes all stdout data, the stream closes, and then `await child` resolves. But there is a timing nuance: if the child process exits before the `for await` loop finishes consuming buffered data, the ProcessPromise may resolve (or reject) before the loop completes. With `.nothrow()`, this should not throw, but the exit code may arrive before the last lines are processed.

More critically: if the `for await` loop is still iterating when the child process exits with a non-zero code, and `.nothrow()` was NOT applied to the specific child process object that the iterator is consuming, zx may reject the ProcessPromise, potentially interfering with the iterator. The design applies `.nothrow()` via the `$` template -- this is correct, but note that `child.stdout` and iterating the ProcessPromise are different objects. If the code is refactored to separate the process creation from the iteration, `.nothrow()` must remain attached.

**Why it happens:**
zx's ProcessPromise is both a Promise AND an async iterable. These are two different consumption modes. The `for await` loop consumes the iterable; `await child` resolves the promise. They operate on the same underlying process but have independent completion semantics. If the process exits with error before stdout is fully drained, the promise rejection can interfere with ongoing iteration.

**How to avoid:**
1. Always apply `.nothrow()` before iterating so that non-zero exit codes do not cause rejections during iteration.
2. The `await child` after the loop is correct and necessary -- it waits for the process to fully exit and returns the exit code. Keep this pattern.
3. Do NOT start the `for await` loop and `await child` in parallel (e.g., via `Promise.all`). The iterator must complete first, then await the promise.
4. Store the ProcessPromise in a variable before iterating, and ensure `.nothrow()` is on that variable:
```javascript
const proc = $`...`.nothrow();
for await (const line of proc) { /* ... */ }
const result = await proc;
```

**Warning signs:**
- Intermittent unhandled promise rejections when Claude processes fail
- Exit code occasionally reads as undefined or is missed
- Race condition manifests only when Claude process exits with error during active tool use (lots of output)

**Phase to address:** Phase 1 (core streaming function). The process creation and iteration pattern must be correct from the start.

**Confidence:** MEDIUM -- zx documentation confirms the async iterator and promise are independent; the exact rejection semantics under `.nothrow()` need empirical verification during implementation.

---

### Pitfall 5: Changing `--output-format` From `json` to `stream-json` Changes What `result.stdout` Contains

**What goes wrong:**
The current autopilot uses `--output-format json`, which makes Claude CLI output a single JSON object on stdout. The code does `process.stdout.write(result.stdout)` and passes it to debug retry for error context extraction. When switching to `stream-json`, stdout becomes NDJSON (many JSON objects, one per line). Code that expects `result.stdout` to be a single parseable JSON object will break. The `runStepCaptured()` error context extraction reads the last 100 lines of output -- this currently gets the JSON response; with streaming it will get the last 100 NDJSON events, which is a completely different format.

**Why it happens:**
The output format change is not just a display change -- it fundamentally changes the data contract between Claude CLI and the autopilot. Every consumer of stdout data must be audited: debug retry error extraction, output file format, progress checking, any downstream parsing.

**How to avoid:**
1. When accumulating lines in streaming mode, also track the last `result` event separately. The `result` event contains the final response equivalent to what `--output-format json` produces.
2. For debug retry error context, extract from the accumulated `result` event rather than raw NDJSON lines.
3. For `--quiet` mode (which restores JSON behavior), maintain the current single-JSON-object contract unchanged.
4. Document the output file format change: streaming mode output files contain NDJSON, not JSON.

**Warning signs:**
- Debug retry prompts contain raw NDJSON events instead of human-readable error context
- JSON.parse on the full stdout fails because it is NDJSON, not JSON
- Output files that previously contained parseable JSON now contain concatenated NDJSON

**Phase to address:** Phase 1 (core streaming function) must handle the result event extraction. Phase 2 (integration) must audit all consumers of stdout data.

**Confidence:** HIGH -- the format difference between `json` and `stream-json` is documented in the Claude CLI reference.

---

### Pitfall 6: The `< /dev/null` stdin Fix Must Survive the Streaming Refactor

**What goes wrong:**
v2.3 discovered that zx v8's VoidStream stdin caused `claude -p` to hang indefinitely. The fix was appending `< /dev/null` to the shell command. During the streaming refactor, if the `$` template literal is modified or the command is restructured, the `< /dev/null` redirect can be accidentally dropped. Without it, every Claude invocation hangs waiting for stdin, and the stall timer will fire after 5 minutes, but the process will never produce output.

**Why it happens:**
The `< /dev/null` is a shell-level redirect that is easy to lose when restructuring command strings. It is not obvious why it is there unless you know the VoidStream history. A developer (or an AI agent) cleaning up the code may remove it thinking it is unnecessary.

**How to avoid:**
1. Add a code comment explaining WHY `< /dev/null` is required (reference the zx VoidStream stdin bug).
2. Write a test that verifies the command string includes `< /dev/null` or equivalent stdin handling.
3. Consider extracting the base command construction into a constant or helper to prevent divergence between streaming and quiet modes.
4. When `runClaudeStreaming()` replaces all 5 invocation sites, verify that the new single invocation site includes `< /dev/null`.

**Warning signs:**
- Claude process starts but produces no output
- Stall timer fires immediately on first streaming attempt
- Works with `--quiet` (if that path was not changed) but hangs in streaming mode

**Phase to address:** Phase 1 (core streaming function). The `< /dev/null` must be in the `runClaudeStreaming()` function that replaces all invocation sites.

**Confidence:** HIGH -- this is a known, previously-encountered bug with a documented fix in the current codebase.

---

## Moderate Pitfalls

Issues that cause incorrect behavior or require non-trivial debugging but do not cause hangs or data loss.

---

### Pitfall 7: `fs.appendFileSync` Per Line Blocks the Event Loop During High-Throughput Output

**What goes wrong:**
The design writes `fs.appendFileSync(outputFile, line + '\n')` for every NDJSON line received. During high-throughput phases (large file edits, verbose tool output), Claude can emit hundreds of NDJSON events per second. Each `appendFileSync` call is a synchronous syscall that blocks the event loop. This prevents the async iterator from reading the next chunk, creating artificial backpressure that slows down stream consumption and can cause the child process to block on a full pipe buffer.

**Why it happens:**
`appendFileSync` is the simplest way to persist lines incrementally, and for the typical case (a few events per second) it is fine. The problem manifests only during burst output, which happens during tool_result events containing large file contents.

**How to avoid:**
Use `fs.createWriteStream(outputFile, { flags: 'a' })` and call `stream.write(line + '\n')` asynchronously. The write stream handles buffering and flushing internally. Close the stream in the `finally` block.

Alternatively, if simplicity is preferred: use `fs.appendFile` (async version) with `await` -- but this adds an await per line that may not be desirable. The write stream approach is better.

**Warning signs:**
- Streaming display stutters during large tool operations
- Event loop lag warning if using diagnostic tools
- No visible issue in typical runs; only during phases with heavy file operations

**Phase to address:** Phase 1 (core streaming function). Use a write stream from the start rather than retrofitting later.

**Confidence:** MEDIUM -- the performance impact depends on output volume. For typical Claude CLI output rates (a few events per second), `appendFileSync` is fine. For burst tool_result events, it may matter.

---

### Pitfall 8: Claude CLI `stream-json` Event Types Are Not Fully Documented

**What goes wrong:**
The design doc assumes four event types: `assistant`, `tool_use`, `tool_result`, `result`. The actual Claude CLI `stream-json` output includes additional top-level types (`system`, `user`) and a `stream_event` wrapper with subtypes (`message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`, `input_json_delta`). The `displayStreamEvent()` function's switch statement will fall through to the default case for most events, causing either silent drops or unexpected behavior.

The format may also change between Claude CLI versions. There is an open GitHub issue (anthropics/claude-code#24596) noting the lack of a formal event type reference for `--output-format stream-json`.

**Why it happens:**
The CLI documentation provides only one example (jq filter for `text_delta`), not a comprehensive schema. The design doc was written based on assumed event shapes rather than empirical observation.

**How to avoid:**
1. Before implementation, run `claude -p "hello" --output-format stream-json 2>/dev/null` and examine the actual NDJSON output to discover the real event types and shapes.
2. Make the `displayStreamEvent()` function defensive: log unknown event types to the debug log rather than ignoring them.
3. Handle `stream_event` wrapper types -- the text content is likely inside `stream_event` with `content_block_delta` subtype containing `text_delta`, not a top-level `assistant` type.
4. Pin behavior to known types and treat everything else as passthrough.

**Warning signs:**
- No assistant text appears in terminal despite Claude clearly working (events are wrapped differently than expected)
- The `result` event is never captured because it has a different shape than assumed
- Output works for simple prompts but breaks for multi-turn tool-using responses

**Phase to address:** Phase 1 (core streaming function) must discover real event types empirically. This should be the FIRST implementation task before writing the display logic.

**Confidence:** MEDIUM -- confirmed via GitHub issue that documentation is incomplete. The actual format must be discovered empirically.

---

### Pitfall 9: Stall Timer Resets `stallWarningCount` to 0 on Every Line -- Cumulative Duration Tracking Lost

**What goes wrong:**
The design's `resetStallTimer()` sets `stallWarningCount = 0` every time a line arrives. This means the escalating warning messages (5min, 10min, 15min) only work during a SINGLE continuous stall. If Claude outputs one line after 4 minutes of silence, the counter resets. If Claude then goes silent for another 4 minutes, no warning fires even though total silence is 8 minutes with only 1 line of real output. This masking behavior means a nearly-stalled process (emitting one event every few minutes) never triggers a warning.

**Why it happens:**
The design correctly resets the timer on each line (you do not want a warning during active output). But resetting the warning COUNT makes the escalation meaningless in the face of intermittent output.

**How to avoid:**
Track the last "meaningful progress" timestamp separately from the stall timer. A `tool_result` or `assistant` event with text content is meaningful; a `system` or `message_start` event is not. Reset the stall timer on any event (to avoid false positives), but only reset the "meaningful progress" tracker on events that indicate real work.

Alternatively, keep it simple: just reset the timer on every line and accept that the escalation is per-stall-period, not cumulative. This is probably fine for v2.4 -- Claude either responds or it does not; intermittent-one-event-every-few-minutes is not a realistic failure mode.

**Warning signs:**
- Stall warning never escalates past "5 minutes" because any trickle of events resets it
- Long-running steps feel stalled to the user but no warning appears

**Phase to address:** Phase 1 (stall detection). Decide on the simple or nuanced approach during implementation.

**Confidence:** LOW -- this is a design subtlety, not a bug. The simple approach (reset on every line) is likely sufficient.

---

### Pitfall 10: `--quiet` Mode Must Produce Identical Output Contract to Current `--output-format json`

**What goes wrong:**
The design says `--quiet` falls back to `--output-format json`. But if any code in the streaming path (even in quiet mode) wraps, transforms, or re-emits the output differently, the contract breaks. Current consumers of the JSON output (debug retry error extraction, progress checking, output file format) expect a specific format. If `--quiet` mode routes through the same `runClaudeStreaming()` function but with slightly different handling, subtle differences can appear.

**Why it happens:**
The refactoring consolidates all 5 invocation sites into one function. The quiet path and streaming path share code. Shared code means shared bugs. A change to fix a streaming issue can inadvertently affect quiet mode.

**How to avoid:**
1. Make the quiet/json path a completely separate early-return branch in `runClaudeStreaming()` that matches the CURRENT behavior exactly (i.e., `await child; return { exitCode, stdout: result.stdout }`).
2. Write a regression test that runs the same prompt in both `--output-format json` and `--quiet` streaming mode, and asserts the output file content and exit code are identical.
3. The design already shows this early-return pattern -- ensure it is preserved during implementation.

**Warning signs:**
- Debug retry starts failing because error context format changed
- CI/scripted consumers of quiet mode get unexpected output
- Output file in quiet mode has NDJSON instead of JSON

**Phase to address:** Phase 1 (core streaming function). The quiet-mode early return should be one of the first things implemented and tested.

**Confidence:** HIGH -- this is a standard refactoring regression risk.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `fs.appendFileSync` per line | Simple, no stream management | Event loop blocking under burst output, adds latency to stream reading | Acceptable for v2.4 MVP if output volume is low; replace with write stream if profiling shows issues |
| Hardcoding event type names in switch statement | Quick to implement, easy to read | Breaks when Claude CLI updates event format; no schema validation | Acceptable if the default case logs unknowns rather than silently dropping |
| Accumulating all lines in memory array | Needed for `result.stdout` compatibility | Memory grows linearly with session length; long phases can be very verbose | Acceptable for v2.4; consider extracting only the `result` event and discarding accumulated lines in a future version |
| Resetting stall timer on ALL event types | Simple, no event classification needed | Masks stalls where non-meaningful events trickle through | Acceptable for v2.4; Claude stalls are either total silence or active output, not intermittent trickle |

## Integration Gotchas

Common mistakes when connecting streaming to existing autopilot subsystems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Debug retry error context | Passing raw NDJSON lines as error context to debugger prompt | Extract the `result` event or accumulate only `assistant` text blocks for error context |
| Progress snapshot (circuit breaker) | No change needed, but verifying -- progress snapshot runs AFTER step completes | Confirm `takeProgressSnapshot()` is called after `await child` resolves, not during streaming |
| Output file format | Assuming output file is parseable as a single JSON object | Document that streaming mode output files are NDJSON; update any downstream tools that read output files |
| Verification status extraction | No change needed -- verification reads `.planning/` files, not stdout | Confirm no code path parses claude stdout for verification data |
| Signal handling (SIGINT/SIGTERM) | Not cleaning up stall timer or write stream on signal | Add stall timer cleanup to existing signal handlers; close write stream if using one |

## Performance Traps

Patterns that work at small scale but fail during long-running autopilot sessions.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded line accumulation in `lines[]` array | Memory growth during multi-hour sessions | Cap accumulation or only keep last N lines plus the result event | Long phases with heavy tool use (hundreds of MB of NDJSON) |
| `appendFileSync` per line | Stream stutter during burst output | Use `fs.createWriteStream` with async writes | During phases with large file reads/writes producing burst NDJSON |
| Creating readline interface before consuming | Missed lines (documented Node.js bug) | Use zx's built-in line iterator instead of readline | When any async work happens between interface creation and iteration start |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Streaming works:** Tested with a simple prompt, but NOT tested with a multi-tool, multi-turn Claude session that produces `tool_use`, `tool_result`, `stream_event`, and `result` events -- test with a real autopilot phase
- [ ] **Stall timer fires:** Tested that timer fires once, but NOT tested that re-arm works (the `arguments.callee` bug means it crashes on re-arm) -- test with `setTimeout` mock that fast-forwards twice
- [ ] **Quiet mode matches current behavior:** Quick test shows output looks right, but NOT verified that output file content is byte-identical to current json mode -- diff the output files
- [ ] **`< /dev/null` present:** New `runClaudeStreaming()` function exists, but NOT verified that the shell redirect survived the refactor -- grep for `< /dev/null` in the new function
- [ ] **Error paths clean up:** Happy path clears stall timer, but NOT verified that stream errors, process crashes, and SIGINT all clear the timer -- test each error path
- [ ] **Exit code preserved:** Streaming works, but NOT verified that non-zero exit codes from Claude are correctly propagated through the streaming path to the retry logic -- test with a forced failure
- [ ] **Debug retry still works:** Streaming changes stdout format, but NOT verified that `constructDebugPrompt()` error context extraction still produces useful output -- run a real debug retry cycle

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Chunk-boundary JSON parse errors (Pitfall 1) | LOW | Switch from `child.stdout` to ProcessPromise iteration; no API change needed |
| `arguments.callee` crash (Pitfall 2) | LOW | Replace with named function expression; one-line fix |
| Stall timer prevents exit (Pitfall 3) | LOW | Add `try/finally` and `unref()`; localized change |
| stdout format mismatch (Pitfall 5) | MEDIUM | Must audit all stdout consumers and update error context extraction |
| `< /dev/null` dropped (Pitfall 6) | LOW | Add it back; but diagnosing the hang can take time if the cause is not known |
| Event type mismatch (Pitfall 8) | MEDIUM | Must empirically discover real event types and rewrite display logic |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Chunk-boundary JSON parse (1) | Phase 1: Core streaming | Unit test: feed multi-line NDJSON in single chunk, verify each line parsed separately |
| `arguments.callee` crash (2) | Phase 1: Stall detection | Unit test: mock setTimeout, verify callback fires and re-arms without error |
| Timer prevents exit (3) | Phase 1: Core streaming | Test: stream error path clears timer; process exits promptly |
| Iterator/promise race (4) | Phase 1: Core streaming | Integration test: force non-zero exit during active streaming, verify exit code captured |
| stdout format change (5) | Phase 1 + Phase 2 | Verify debug retry error context is human-readable in both streaming and quiet modes |
| `< /dev/null` survival (6) | Phase 1: Core streaming | Assertion or grep test: command string contains `< /dev/null` |
| `appendFileSync` blocking (7) | Phase 1: Output capture | Monitor during integration testing; optimize if stutter observed |
| Undocumented event types (8) | Phase 1: First task | Empirical discovery: run stream-json and log all event types before writing display logic |
| Stall timer escalation (9) | Phase 1: Stall detection | Design decision during implementation; simple reset-on-every-line is acceptable |
| Quiet mode regression (10) | Phase 1 + Phase 2 | Regression test: quiet mode output matches current json mode output |

## Sources

- [zx ProcessPromise documentation](https://google.github.io/zx/process-promise) -- async iterator vs .stdout semantics, .nothrow() behavior
- [zx Known Issues](https://google.github.io/zx/known-issues) -- output truncation with process.exit()
- [Node.js Child Process documentation](https://nodejs.org/api/child_process.html) -- pipe buffer limits (64KB), stream semantics
- [Node.js Timers documentation](https://nodejs.org/api/timers.html) -- unref() prevents timer from keeping process alive
- [Node.js Readline issue #33463](https://github.com/nodejs/node/issues/33463) -- lines missed when async work happens between createInterface and iteration
- [Node.js Readline issue #42454](https://github.com/nodejs/node/issues/42454) -- silent exit when awaiting before consuming readline iterator
- [Node.js Backpressuring in Streams](https://nodejs.org/en/learn/modules/backpressuring-in-streams) -- highWaterMark, pipe buffer semantics
- [MDN arguments.callee](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments/callee) -- forbidden in strict mode (ES modules)
- [Claude CLI reference](https://code.claude.com/docs/en/cli-reference) -- --output-format stream-json flag
- [Claude Code issue #24596](https://github.com/anthropics/claude-code/issues/24596) -- stream-json event types lack documentation
- [Khan/format-claude-stream](https://github.com/Khan/format-claude-stream) -- real-world stream-json parser with fallback for unknown events
- [Node.js setTimeout memory leak article](https://lucumr.pocoo.org/2024/6/5/node-timeout/) -- timer reference leaks
- [Ben Nadel on appendFileSync vs streams](https://www.bennadel.com/blog/3233-parsing-and-serializing-large-datasets-using-newline-delimited-json-in-node-js.htm) -- performance of per-line sync writes

---
*Pitfalls research for: Adding NDJSON streaming to zx-based autopilot (v2.4)*
*Researched: 2026-03-12*
