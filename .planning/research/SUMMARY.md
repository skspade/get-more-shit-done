# Project Research Summary

**Project:** Autopilot Real-Time Streaming Output (v2.4)
**Domain:** NDJSON streaming integration for zx-based CLI orchestrator
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

The v2.4 milestone adds real-time streaming output to the autopilot by replacing 5 buffered `claude -p --output-format json` invocations with a single `runClaudeStreaming()` function that uses `--output-format stream-json`. The implementation requires zero new dependencies -- zx's built-in async iterator provides line-by-line NDJSON parsing, `JSON.parse()` handles event deserialization, and `setTimeout`/`clearTimeout` powers stall detection. This is a well-scoped refactoring with a clear dependency chain and no architectural unknowns.

The most critical finding from research is that the design doc's assumed event model is wrong. The Claude CLI `stream-json` format does not emit top-level `assistant`/`tool_use` events as the design doc assumes. Instead, it emits `stream_event` wrappers containing nested API events (`content_block_delta` with `text_delta` for text, `content_block_start` with `tool_use` for tools). Additionally, the `--include-partial-messages` flag (not mentioned in the design doc) is required to get token-level streaming -- without it, only complete turn-level `assistant` messages are emitted, defeating the purpose of streaming. The `--verbose` flag is also needed for full tool visibility. These corrections must be incorporated before implementation begins.

The primary risks are implementation-level, not architectural: iterating `child.stdout` instead of the ProcessPromise (yields chunks not lines, causing intermittent JSON parse failures), using `arguments.callee` for timer re-arming (crashes in ES modules), and failing to clear the stall timer on error paths (causes process hangs). All are preventable with the patterns documented in research. The `< /dev/null` stdin redirect from the v2.3 VoidStream fix must survive the refactoring -- dropping it silently hangs every Claude invocation.

## Key Findings

### Recommended Stack

No new dependencies are needed. The entire streaming feature is built with Node.js built-ins and the existing zx dependency.

**Core technologies:**
- **zx async iterator (`for await (const line of proc)`)**: Line-by-line NDJSON parsing from child process stdout -- built into zx, splits on newlines automatically, integrates with `.nothrow()` for error handling
- **`JSON.parse()` per line**: Event deserialization -- native, fast, sufficient for known NDJSON shapes
- **`setTimeout` / `clearTimeout`**: Stall detection timer with re-arming -- no external scheduler needed for a single-timer watchdog pattern
- **Claude CLI flags**: `--output-format stream-json --verbose --include-partial-messages` -- all three required for token-level streaming

**Critical version requirement:** Claude CLI must support `--include-partial-messages` (current versions do). Without this flag, streaming is turn-level only.

### Expected Features

**Must have (table stakes):**
- NDJSON line-by-line parsing with defensive handling of non-JSON lines
- Event type routing dispatching `stream_event` subtypes to display
- Real-time assistant text to stdout via `content_block_delta` / `text_delta`
- Tool call indicators to stderr via `content_block_start` / `tool_use`
- Output file capture per-line (not buffered to end) for debug retry compatibility
- Stall detection with configurable timeout (default 5 min) and repeated warnings
- `--quiet` flag restoring exact pre-streaming buffered JSON behavior
- Consolidated `runClaudeStreaming()` replacing all 5 invocation sites

**Should have (differentiators):**
- Seamless debug retry streaming (watching debugger work in real-time)
- Channel separation (stdout for content, stderr for metadata) enabling clean piping
- Zero-migration quiet mode as a CI compatibility safety net

**Defer (v2+):**
- Progress bars (impossible for LLM generation -- no total to measure)
- Colored/formatted output (ANSI codes add TTY detection complexity)
- Kill-on-stall (circuit breaker handles phase-level loops; stall detection should warn, not kill)
- Structured result extraction (cost, session_id -- separate feature if needed)
- Verbose mode beyond streaming (two modes only: quiet and default)

### Architecture Approach

The architecture is a single new function (`runClaudeStreaming()`) that all 5 existing Claude invocation sites converge into, with a `displayStreamEvent()` helper for terminal output and a stall timer for hung process detection. The quiet-mode path is an early return that preserves the current buffered behavior exactly. No existing components change behavior -- the circuit breaker, debug retry context extraction, output file capture, and verification gate all continue to work because the function returns the same `{ exitCode, stdout }` shape.

**Major components:**
1. **`runClaudeStreaming()`** -- Core function: format selection (json vs stream-json), zx async iteration, line accumulation, output file capture, stall timer lifecycle
2. **`displayStreamEvent()`** -- Event router: `stream_event` with `text_delta` to stdout, `tool_use` to stderr, all other events silent
3. **`resetStallTimer()` / `clearStallTimer()`** -- Watchdog: re-arming `setTimeout` with named function callback, repeated warnings at fixed intervals
4. **`--quiet` flag** -- CLI flag parsed into `QUIET` constant, controls format selection in `runClaudeStreaming()`

### Critical Pitfalls

1. **`child.stdout` yields chunks, not lines** -- Using `for await (const chunk of proc.stdout)` instead of `for await (const line of proc)` causes intermittent JSON parse failures on chunk boundaries. Use the ProcessPromise iterator directly.
2. **`arguments.callee` crashes in ES modules** -- The design doc's stall timer re-arm pattern uses `arguments.callee`, which is forbidden in strict mode (ESM). Use a named function reference. This bug is invisible until a real 5-minute stall occurs in production.
3. **Stall timer prevents process exit** -- `setTimeout` keeps the event loop alive. Use `try/finally` around the `for await` loop to guarantee `clearTimeout`, and call `timer.unref()` as defense-in-depth.
4. **`< /dev/null` must survive the refactor** -- The v2.3 VoidStream fix prevents Claude from hanging on stdin. If the shell redirect is accidentally dropped during consolidation, every invocation hangs silently.
5. **stdout format changes from JSON to NDJSON** -- Debug retry error context extraction reads raw stdout. With streaming, stdout contains NDJSON lines instead of a single JSON blob. The last-100-lines extraction actually improves (more focused context), but verify empirically.

## Implications for Roadmap

Based on research, the implementation has a clear 4-phase dependency chain. Phases 2 and 3 can run in parallel after Phase 1 completes.

### Phase 1: Core Streaming Function

**Rationale:** Everything depends on `runClaudeStreaming()`. No other work can be tested without it. This phase also contains ALL critical pitfall mitigations.
**Delivers:** `runClaudeStreaming()`, `displayStreamEvent()`, stall detection, `--quiet` flag parsing
**Addresses:** NDJSON parsing, event routing, stall detection, quiet mode, consolidated invocation
**Avoids:** Chunk-boundary parse errors (Pitfall 1), `arguments.callee` crash (Pitfall 2), timer prevents exit (Pitfall 3), `< /dev/null` survival (Pitfall 6), event type mismatch (Pitfall 8)
**First task:** Run `claude -p "hello" --output-format stream-json --verbose --include-partial-messages` empirically to discover actual event types before writing display logic.

### Phase 2: Step Function Integration

**Rationale:** `runStep()` and `runStepCaptured()` are the primary invocation wrappers. Debug retry depends on `runStepCaptured()` working correctly.
**Delivers:** All normal autopilot steps streaming by default, output file capture working in streaming mode
**Addresses:** Real-time output file writes, backward compatibility for debug retry context extraction
**Avoids:** stdout format mismatch (Pitfall 5), quiet mode regression (Pitfall 10)
**Implements:** Step function wrappers become thin delegates to `runClaudeStreaming()`

### Phase 3: Debug Retry Integration

**Rationale:** Can run in parallel with Phase 2. The 3 debug retry `$`claude...`` sites are independent of step functions.
**Delivers:** Real-time streaming during debug retry cycles (watching debugger work live)
**Addresses:** Seamless debug retry streaming (differentiator)
**Avoids:** Verify debug retry loop still works with NDJSON output format

### Phase 4: Config and Polish

**Rationale:** Config has a hardcoded default, so this is polish, not blocking. End-to-end verification ensures everything works together.
**Delivers:** `autopilot.stall_timeout_ms` in config schema, `gsd settings` display, end-to-end verification
**Addresses:** Configurable stall timeout, documentation of output format change

### Phase Ordering Rationale

- Phase 1 is the sole dependency for everything. It is greenfield code with no risk of breaking existing behavior (existing invocation sites are not yet modified).
- Phases 2 and 3 can run in parallel because step functions and debug retry sites are independent code paths. Sequencing them reduces risk if preferred.
- Phase 4 is pure polish and config wiring. The stall timer works with a hardcoded default from Phase 1.
- All critical pitfalls (1-6) are addressed in Phase 1, preventing them from compounding in later phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** The `stream_event` nested event format needs empirical verification. Run the actual Claude CLI with streaming flags and capture real output before writing the `displayStreamEvent()` switch logic. The exact event types are not fully documented (GitHub issue #24596 confirms this gap).

Phases with standard patterns (skip research-phase):
- **Phase 2:** Standard refactoring -- replace direct `$`...`` calls with function delegation. Well-understood pattern.
- **Phase 3:** Identical pattern to Phase 2, applied to debug retry sites.
- **Phase 4:** Standard config wiring following existing `CONFIG_DEFAULTS` pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. zx async iterator verified in official docs. All Node.js built-ins. |
| Features | HIGH | NDJSON is a mature standard. Stall detection is a well-understood watchdog pattern. `--quiet` is CLI convention. |
| Architecture | HIGH | Verified against existing codebase -- all 5 invocation sites identified, all consumers of stdout audited. |
| Pitfalls | HIGH | Grounded in zx docs, Node.js stream semantics, ESM strict mode rules, and prior VoidStream bug experience. |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude CLI `stream-json` event format**: The exact event types and nesting structure need empirical verification by running real streaming commands. Documentation is incomplete (confirmed by GitHub issue #24596). Must be the first task in Phase 1.
- **Turn-level vs token-level granularity decision**: Features research recommends starting WITHOUT `--verbose --include-partial-messages` for simpler turn-level events, while Stack and Architecture research recommend WITH those flags for true token-level streaming. Resolve empirically: try both approaches and measure the silence gap between turn-level events. The display function should handle both event models from day one so the upgrade path is clean.
- **`fs.appendFileSync` vs write stream**: `appendFileSync` per line may cause event loop blocking during burst output. Acceptable for MVP; monitor during integration testing and replace with `fs.createWriteStream` if stuttering is observed.
- **Memory growth from line accumulation**: The `lines[]` array grows linearly with session length. Acceptable for v2.4. Consider capping to last N lines plus the result event in a future version if multi-hour sessions cause issues.

## Sources

### Primary (HIGH confidence)
- [zx ProcessPromise docs](https://google.github.io/zx/process-promise) -- async iterator, line splitting, .nothrow() behavior
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference) -- `--output-format stream-json`, `--include-partial-messages`, `--verbose` flags
- [Claude Code headless mode docs](https://code.claude.com/docs/en/headless) -- stream-json usage with `-p` flag, jq examples
- [Agent SDK streaming output docs](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- StreamEvent reference, complete event type table
- [Node.js Timers documentation](https://nodejs.org/api/timers.html) -- unref() prevents timer from keeping process alive
- [MDN arguments.callee](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments/callee) -- forbidden in strict mode
- Direct reading: `autopilot.mjs` source code -- all 5 invocation sites, debug retry, circuit breaker

### Secondary (MEDIUM confidence)
- [Claude Code issue #24596](https://github.com/anthropics/claude-code/issues/24596) -- stream-json event types discussion, confirms documentation gap
- [Khan/format-claude-stream](https://github.com/Khan/format-claude-stream) -- community tool confirming real-world stream-json parsing patterns
- [ytyng blog](https://www.ytyng.com/en/blog/claude-stream-json-jq) -- actual stream-json event structure examples
- [NDJSON specification](https://github.com/ndjson/ndjson-spec) -- format specification
- [CLI Guidelines](https://clig.dev/) -- stdout/stderr separation, quiet flags
- [Watchdog timer pattern](https://dev.to/gajus/ensuring-healthy-node-js-program-using-watchdog-timer-4pjd) -- stall detection in Node.js

### Tertiary (LOW confidence)
- [Node.js readline issues #33463, #42454](https://github.com/nodejs/node/issues/33463) -- edge cases with readline async iterator (relevant if readline is used as fallback)

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
