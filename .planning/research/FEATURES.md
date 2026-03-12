# Feature Landscape: Autopilot Real-Time Streaming Output

**Domain:** CLI streaming output for autonomous coding orchestrator -- NDJSON parsing, stall detection, verbosity toggling
**Researched:** 2026-03-12
**Overall confidence:** HIGH (NDJSON is a mature standard; Claude CLI stream-json is documented; watchdog timers are well-understood; quiet/verbose patterns are CLI conventions)

## Table Stakes

Features users expect from a streaming CLI orchestrator. Missing any of these makes the streaming mode feel broken or unfinished.

### NDJSON Stream Parsing

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| Line-by-line NDJSON parsing from child process stdout | NDJSON is defined as "one JSON object per line, separated by newline characters." Every NDJSON consumer processes line-by-line -- buffering the entire stream defeats the purpose. The [NDJSON spec](https://github.com/ndjson/ndjson-spec) and [JSON streaming conventions](https://en.wikipedia.org/wiki/JSON_streaming) make this the baseline expectation. zx provides `for await (const line of p)` which splits on newline by default. | LOW | `autopilot.mjs` -- replaces `await $\`...\`.nothrow()` pattern at 5 invocation sites (lines 278, 469, 536, 581, 620) | zx's async iterator uses `Symbol.asyncIterator` with line buffering. Default delimiter is `\n`, matching NDJSON. No external library needed. Confidence: HIGH -- [zx docs](https://google.github.io/zx/process-promise) confirm async iteration yields lines. |
| Defensive handling of non-JSON lines | Stream may contain non-JSON output (stderr leaks, partial lines on process crash). Silently dropping or crashing on parse failure is unacceptable. The [NDJSON guide](https://thetexttool.com/blog/complete-guide-ndjson-newline-delimited-json) recommends "use streaming parsers that process one line at a time" with error tolerance. | LOW | None -- new code | `try { JSON.parse(line) } catch { process.stdout.write(line) }` -- write unparseable lines to stdout as raw text. This is the design doc's stated approach and matches the defensive pattern every NDJSON consumer uses. Confidence: HIGH. |
| Event type routing by top-level `type` field | Claude CLI `--output-format stream-json` emits NDJSON where each line has a top-level `type` field. Without `--verbose --include-partial-messages`, the types are: `system`, `assistant`, `result`. With those flags, `stream_event` is also emitted containing low-level API deltas (`content_block_delta`, `content_block_start`, etc.). The design doc routes on `type` which is the documented pattern. | LOW | None -- new `displayStreamEvent()` function | The design doc's event model (`assistant` for text, `tool_use` for tools, `result` for final) is a simplification. Actual events without `--verbose` are `system`, `assistant` (complete turns), and `result`. With `--verbose --include-partial-messages`, you get `stream_event` wrapping `content_block_delta` with `text_delta` for real-time tokens. **Decision needed:** use `--verbose --include-partial-messages` for true token-by-token streaming, or accept turn-level `assistant` events. Confidence: MEDIUM -- the exact event types without `--verbose` need empirical verification. |
| Accumulate all output for downstream compatibility | The `runStepCaptured()` function's output file is read by the debug retry loop for error context extraction (lines 519-523). Streaming must not break this: every NDJSON line must be appended to the output file as it arrives, and the full stdout must be returned for `result.stdout` compatibility. | LOW | `runStepCaptured()` (line 452), `constructDebugPrompt()` error context extraction (line 519-523) | Design doc addresses this: `lines.push(line)` accumulates, `fs.appendFileSync(outputFile, line + '\n')` writes incrementally. The returned `{ exitCode, stdout: lines.join('\n') }` maintains the interface. Confidence: HIGH. |
| Real-time output file writes (not buffered until end) | Current behavior writes output file only after process completes (`fs.appendFileSync(outputFile, result.stdout)` on line 476). Streaming should write each line as it arrives so that if the process crashes, partial output is preserved for debug context. | LOW | `runStepCaptured()` output file pattern | `fs.appendFileSync(outputFile, line + '\n')` per line. This is the standard pattern for streaming log files. Appending per-line has negligible overhead compared to the Claude API call. Confidence: HIGH. |

### Stall Detection

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| Watchdog timer that resets on every stream event | The [watchdog timer pattern](https://dev.to/gajus/ensuring-healthy-node-js-program-using-watchdog-timer-4pjd) is the standard approach for detecting hung processes. Reset the timer on every line of output. If no output arrives within the timeout, emit a warning. Claude operations can legitimately take several minutes (large file edits, complex reasoning), so the timer must be generous. | LOW | `getConfig()` function (line 172) for configurable timeout | `setTimeout` / `clearTimeout` pair. Reset on every NDJSON line. This is in-process (not external), which is fine because the watchdog monitors the child process stdout, not the Node.js event loop itself. If the event loop blocks, setTimeout won't fire -- but that cannot happen here because the blocking work is in the child process, not the parent. Confidence: HIGH. |
| Configurable timeout (default 5 minutes) | Different environments have different expectations. CI might want 2 minutes. Local dev might tolerate 10 minutes. Claude tool operations (running test suites, large file reads) can legitimately take minutes without producing text output. 5 minutes is a reasonable default that avoids false positives while catching genuine stalls. | LOW | `config.json` schema -- `autopilot.stall_timeout_ms: 300000`; existing `CONFIG_DEFAULTS` pattern (line 186) | Follows the same pattern as `autopilot.circuit_breaker_threshold` and `autopilot.max_debug_retries`. Read from config with fallback to default. Confidence: HIGH. |
| Repeated warnings at fixed intervals | A single warning is easy to miss. The design doc specifies re-arming the timer so warnings repeat every interval (5min, 10min, 15min). This escalating visibility pattern matches how CI systems handle long-running jobs (GitHub Actions warns at 6hr intervals). | LOW | `logMsg()` function for log file entries (line 107) | Design doc uses `setTimeout(arguments.callee, STALL_TIMEOUT)` for re-arming. Note: `arguments.callee` is deprecated in strict mode. Use a named function reference instead. Warning goes to stderr + log file. Confidence: HIGH. |
| Stall timer cleared on process exit | Timer must be cleared when the child process completes normally. Failing to clear would trigger a spurious warning after the process exits. | LOW | None -- cleanup in `runClaudeStreaming()` | `clearTimeout(stallTimer)` after the `for await` loop completes and before `await child`. Confidence: HIGH. |
| Stall warnings to stderr, not stdout | Stall warnings are diagnostic metadata, not program output. The [CLI Guidelines](https://clig.dev/) specify: "Send messaging to stderr for logs, errors, and status updates." Mixing stall warnings into stdout would corrupt NDJSON output and confuse downstream consumers. | LOW | Existing pattern: `console.error()` for warnings throughout autopilot.mjs (lines 218, 294, 516, etc.) | `console.error()` writes to stderr. Consistent with existing warning pattern in autopilot.mjs. Confidence: HIGH. |

### Quiet Mode

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| `--quiet` flag that restores buffered JSON behavior | CI/scripted consumers need deterministic, parseable output. Streaming text + tool indicators to stdout breaks machine consumption. `--quiet` is a universal CLI convention ([CLI Guidelines](https://clig.dev/), [Ubuntu CLI verbosity](https://discourse.ubuntu.com/t/cli-verbosity-levels/26973), [Microsoft CLI guidance](https://learn.microsoft.com/en-us/dotnet/standard/commandline/design-guidance)). The `--json` flag (line 41 of existing gsd CLI) already establishes this pattern for deterministic output in the project. | LOW | `argv` parsing (line 34) -- add `'quiet'` to `knownFlags` Set | When `--quiet` is true, `runClaudeStreaming()` uses `--output-format json` instead of `stream-json`, waits for process completion, and returns buffered result. This is the current behavior -- `--quiet` is effectively "keep doing what you were doing before streaming was added." Confidence: HIGH. |
| Quiet mode falls back to `--output-format json` | The design doc correctly identifies that quiet mode should use the existing `json` format, not `stream-json` with suppressed display. Using `json` means the Claude CLI handles buffering and returns a single JSON object with `result` field -- no NDJSON parsing needed. | LOW | Current `--output-format json` invocations (lines 278, 469, 536, 581, 620) | This is zero-change for quiet mode. The existing code path continues to work. Only non-quiet mode adds streaming. Confidence: HIGH. |
| Banners and progress UI still visible in quiet mode | `--quiet` suppresses streaming text, not autopilot's own operational output (banners, phase transitions, circuit breaker warnings). The autopilot's operational messages go to stdout/stderr separate from Claude's output. `--quiet` controls Claude output format, not autopilot verbosity. | LOW | `printBanner()` (line 156), `printHaltReport()` (line 226), `printVerificationGate()` (line 660) | These are autopilot-level messages, not Claude output. They remain unchanged regardless of `--quiet`. This distinction is important: `--quiet` is not `--silent`. Confidence: HIGH. |

### Consolidated Invocation Function

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| Single `runClaudeStreaming()` replacing all 5 `claude -p` sites | The existing codebase has 5 separate `$\`claude -p ...\`` invocations (lines 278, 469, 536, 581, 620) with duplicated patterns. Consolidation into one function is standard refactoring hygiene and is required so that streaming behavior is consistent across all invocation types (normal steps, captured steps, debug retries). | MEDIUM | `runStep()` (line 262), `runStepCaptured()` (line 452), `runStepWithRetry()` debug invocation (line 536), `runVerifyWithDebugRetry()` verify invocations (lines 581, 620) | The function must handle: (1) quiet vs streaming format selection, (2) line-by-line reading and event display, (3) output file capture when provided, (4) stall timer management, (5) exit code propagation. `runStep` and `runStepCaptured` become thin wrappers. Debug retry invocations (3 sites) also route through this function. Confidence: HIGH. |
| Streaming during debug retry invocations | The debug retry loop spawns additional `claude -p` processes for the debugger agent. These should also stream by default -- watching the debugger work in real-time is valuable for understanding failure diagnosis. | LOW | `runStepWithRetry()` debug prompt (line 536), `runVerifyWithDebugRetry()` debug prompts (lines 581, 620) | All 3 debug invocation sites route through `runClaudeStreaming()`, so streaming comes for free once the function exists. No special handling needed. Confidence: HIGH. |

### Stream Event Display

| Feature | Why Expected | Complexity | Existing GSD Dependency | Notes |
|---------|--------------|------------|------------------------|-------|
| Assistant text written to stdout in real-time | This is the entire point of streaming. Users want to see Claude "thinking out loud" as it processes each phase. Without text display, streaming mode provides no visible benefit over buffered mode. | LOW | None -- new `displayStreamEvent()` function | For `assistant` events: extract text from `message.content[].text` and write to stdout. For `stream_event` with `content_block_delta` / `text_delta`: write `event.delta.text` to stdout. The approach depends on whether `--verbose --include-partial-messages` is used. Confidence: HIGH. |
| Tool call indicators to stderr | Users need activity signals when Claude is using tools (editing files, running commands). Without tool indicators, long tool executions appear as silence, which is indistinguishable from a stall. Writing to stderr keeps stdout clean for piping. | LOW | None -- new code in `displayStreamEvent()` | Design doc proposes `process.stderr.write(\`  ◆ ${toolName}\n\`)`. This is compact (one line per tool call) and non-intrusive. Tool names are short (`Edit`, `Bash`, `Read`, `Grep`, `Glob`). Confidence: HIGH. |
| Result events captured but not displayed | The `result` event contains the final output, session metadata, and cost info. It should be captured programmatically for exit code determination but not printed to terminal (the caller handles result processing). | LOW | Exit code handling in `runStep()` (line 288-298) | Route `result` events to the accumulator only. No display. The exit code comes from the child process exit, not from the result event. Confidence: HIGH. |
| Tool results suppressed (too verbose) | Tool results (file contents, command output) are typically large and already summarized by the assistant's subsequent text. Displaying them would flood the terminal with noise. | LOW | None | Silent by default. This matches the [Agent SDK streaming UI example](https://platform.claude.com/docs/en/agent-sdk/streaming-output): tool calls show `[Using Read...]` but results are suppressed, and `done` is shown when the tool completes. Confidence: HIGH. |

## Differentiators

Features that set this implementation apart from a basic "pipe stdout to terminal" approach.

| Feature | Value Proposition | Complexity | Existing GSD Dependency | Notes |
|---------|-------------------|------------|------------------------|-------|
| Stall detection with repeated escalating warnings | Most CLI tools either have a hard timeout (kill after N minutes) or no timeout. A soft warning that repeats at intervals is more appropriate for long-running AI operations where legitimate work may take 10+ minutes but genuine stalls should be visible. The design doc's repeating timer pattern is better than a one-shot warning. | LOW | `getConfig()` for `autopilot.stall_timeout_ms` | The key insight is that Claude tool operations (running test suites, large `git diff`) can legitimately take minutes. A hard kill would be destructive. Repeated warnings let the user decide whether to wait or interrupt (Ctrl+C hits the existing SIGINT handler on line 128). Confidence: HIGH. |
| Seamless debug retry streaming | Existing tools that add streaming often only stream the "happy path." Streaming debug retry invocations means users see the debugger's analysis and fix attempts in real-time -- not just "debug retry 1/3..." followed by silence. This is a significant DX improvement for failure scenarios. | LOW | All 5 invocation sites route through `runClaudeStreaming()` | This comes for free from the consolidated function. The debug prompt is just another prompt string passed to `runClaudeStreaming()`. Confidence: HIGH. |
| Zero-migration quiet mode | The `--quiet` flag does not degrade functionality -- it exactly reproduces the pre-streaming behavior. CI scripts that parse autopilot output today continue working unchanged by adding `--quiet`. No output format changes, no behavioral differences. | LOW | Entire existing test suite (`autopilot.test.cjs`) | Tests written against the current buffered JSON behavior should pass unchanged in quiet mode. This is not just a feature -- it is a migration safety net. Confidence: HIGH. |
| Channel separation (stdout for content, stderr for metadata) | Following [CLI Guidelines](https://clig.dev/) best practice: assistant text (the program's "result") goes to stdout, tool indicators and stall warnings (diagnostic metadata) go to stderr. This means `autopilot.mjs 2>/dev/null` shows clean Claude output, and `autopilot.mjs > /dev/null` shows only tool/stall activity. | LOW | Existing pattern: operational messages use `console.log()` (stdout) and `console.error()` (stderr) throughout | The design doc's `process.stdout.write()` for text and `process.stderr.write()` for tool indicators follows this pattern. Confidence: HIGH. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Token-level streaming without `--verbose --include-partial-messages` | The Claude CLI without these flags emits complete `assistant` turn events, not token-by-token deltas. Forcing token-level streaming requires adding `--verbose --include-partial-messages` flags which changes the event format and may emit significantly more NDJSON lines (every delta, every tool input chunk). This adds parsing complexity for marginal UX benefit -- turn-level events already provide real-time visibility for multi-minute operations. | Use `--output-format stream-json` without `--verbose --include-partial-messages`. Accept turn-level granularity. If empirical testing shows turns are too coarse (multi-minute silence between turns), add `--verbose --include-partial-messages` in a follow-up with the corresponding `stream_event` / `content_block_delta` parsing. |
| Progress bars for streaming | Claude's output is not progress-measurable -- there is no "total tokens" or "percentage complete" to display. A progress bar would require knowing the answer length in advance, which is impossible for LLM generation. | Use tool call indicators as activity signals instead. Each `◆ Edit` / `◆ Bash` line proves the process is alive and working. Combined with stall detection, this provides sufficient liveness feedback. |
| Verbose mode (`--verbose` / `-v` flag) | Adding a verbose mode that shows tool results, raw NDJSON events, or additional metadata is scope creep. The streaming mode IS the verbose mode compared to the current buffered behavior. Adding a third verbosity level (quiet < default < verbose) introduces a configuration matrix that complicates testing. | Two modes only: `--quiet` (buffered JSON, current behavior) and default (streaming with text + tool indicators). If users need raw events, they can pipe `claude -p --output-format stream-json` directly without autopilot. |
| Kill-on-stall (automatic SIGTERM after timeout) | Automatically killing a Claude process that appears stalled would destroy work in progress. Claude may be in the middle of a large edit or waiting for a slow API. The existing circuit breaker (line 213) handles genuine stuck-in-a-loop scenarios at the phase level. Stall detection should warn, not kill. | Warn to stderr + log file. Let the user decide whether to Ctrl+C. The circuit breaker catches phase-level loops. Stall detection catches within-step silence. Together they cover both failure modes without destructive action. |
| Colored/formatted streaming output | Adding ANSI color codes to streamed assistant text or tool indicators adds complexity (TTY detection, `NO_COLOR` env var, Windows compatibility) for minimal value. The existing autopilot banners use raw unicode box-drawing characters (line 235-237), not ANSI colors. | Plain text for streamed content. Unicode symbols (`◆` for tool calls, `⚠` for stall warnings) provide visual differentiation without color codes. |
| Stream input format (`--input-format stream-json`) | Claude CLI supports `--input-format stream-json` for piping NDJSON into Claude. This enables stream chaining (agent-to-agent piping). This is entirely out of scope -- the autopilot sends simple string prompts, not NDJSON streams. | Continue passing prompts as string arguments to `claude -p`. Stream chaining is a different architectural pattern (Agent SDK territory) not needed for autopilot phases. |
| Structured output extraction from stream | Attempting to parse the `result` event for structured fields (cost, duration, session_id) is tempting but unnecessary. The autopilot only needs the exit code (from process exit) and the accumulated stdout (for debug retry error context). | Capture the exit code from `child.exitCode` and the stdout from accumulated lines. Ignore `result` event fields. If cost tracking is needed later, it is a separate feature. |

## Feature Dependencies

```
--quiet flag parsing
    |
    v
runClaudeStreaming() core function  <-- stall timer (setTimeout/clearTimeout)
    |                                        |
    |                                        v
    +-- format selection (json vs stream-json)
    |
    +-- line-by-line reading (zx async iterator)
    |       |
    |       v
    |   displayStreamEvent()
    |       |
    |       +-- assistant text -> stdout
    |       +-- tool_use -> stderr indicator
    |       +-- result -> capture only
    |       +-- unknown -> silent
    |
    +-- output file capture (appendFileSync per line)
    |
    +-- stdout accumulation (lines array -> join)
    |
    v
runStep() wrapper  ------> uses runClaudeStreaming()
runStepCaptured() wrapper -> uses runClaudeStreaming() with outputFile
debug retry sites (3) ----> use runClaudeStreaming()
```

**Critical path:** `runClaudeStreaming()` is the foundation. Everything else depends on it.

**No circular dependencies.** The dependency graph is a tree rooted at the CLI flag parsing.

## MVP Recommendation

Prioritize (in implementation order):

1. **`runClaudeStreaming()` core function** -- the single function that replaces all 5 invocation sites. This is the foundation for everything else. Start with `--output-format stream-json` (without `--verbose --include-partial-messages`) to use the simpler turn-level event model.
2. **`displayStreamEvent()` with assistant text + tool indicators** -- the display function that routes events to stdout/stderr. Without this, streaming provides no visible benefit.
3. **`--quiet` flag + format selection** -- add the flag, wire it to format selection. This is the safety net that preserves backward compatibility.
4. **Stall detection timer** -- add the watchdog timer with configurable timeout and repeated warnings.
5. **Wire all 5 invocation sites** -- convert `runStep()`, `runStepCaptured()`, and all 3 debug retry sites to use the new function.

**Defer:**
- Token-level streaming (`--verbose --include-partial-messages`): evaluate after MVP whether turn-level events provide sufficient real-time feedback. If turns are too coarse, add this as a fast-follow.

## Event Format Decision

**Critical implementation detail:** The design doc's event model (`assistant`, `tool_use`, `tool_result`, `result`) is a simplified view. The actual stream-json format depends on flags:

**Without `--verbose --include-partial-messages`:**
- Top-level types: `system`, `assistant`, `result`
- `assistant` events contain complete turn content (all text + tool calls for that turn)
- Coarser granularity -- you get output after each complete turn, not per-token

**With `--verbose --include-partial-messages`:**
- Additional type: `stream_event` wrapping raw API events
- `stream_event` contains `content_block_delta` with `text_delta` for per-token text
- `content_block_start` with `tool_use` type for tool call starts
- Much finer granularity -- true token-by-token streaming

**Recommendation:** Start without `--verbose --include-partial-messages`. The turn-level `assistant` events already provide real-time feedback for multi-minute operations (each assistant turn is emitted as it completes, not buffered until the entire session ends). If empirical testing reveals unacceptable silence gaps between turns, add the flags. The display function should be written to handle both models (check for `stream_event` type in addition to `assistant` type) so the upgrade path is clean.

**Confidence:** MEDIUM -- the exact event types and their content structure without `--verbose` need empirical verification by running `claude -p --output-format stream-json` and inspecting the actual NDJSON output. The [documentation gap issue](https://github.com/anthropics/claude-code/issues/24596) confirms this is under-documented.

## Sources

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- `--output-format`, `--verbose`, `--include-partial-messages` flag documentation
- [Claude Code Headless/Agent SDK CLI](https://code.claude.com/docs/en/headless) -- stream-json usage examples, jq filtering patterns
- [Agent SDK Streaming Output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) -- StreamEvent reference, event type table, message flow diagram
- [Claude Code Issue #24596](https://github.com/anthropics/claude-code/issues/24596) -- documentation gap for stream-json event types
- [NDJSON Specification](https://github.com/ndjson/ndjson-spec) -- format specification (one JSON per line, `\n` delimiter)
- [Complete Guide to NDJSON](https://thetexttool.com/blog/complete-guide-ndjson-newline-delimited-json) -- best practices for streaming NDJSON
- [zx ProcessPromise](https://google.github.io/zx/process-promise) -- async iterator, `Symbol.asyncIterator`, line-by-line reading
- [CLI Guidelines](https://clig.dev/) -- stdout/stderr separation, quiet flags, machine-readable output
- [Ubuntu CLI Verbosity Levels](https://discourse.ubuntu.com/t/cli-verbosity-levels/26973) -- quiet/verbose conventions
- [Microsoft CLI Design Guidance](https://learn.microsoft.com/en-us/dotnet/standard/commandline/design-guidance) -- verbosity levels (Quiet, Normal, Diagnostic)
- [Watchdog Timer Pattern](https://dev.to/gajus/ensuring-healthy-node-js-program-using-watchdog-timer-4pjd) -- stall detection in Node.js
- [Node.js Readline](https://nodejs.org/api/readline.html) -- async iterator for line-by-line stream reading
- [Khan/format-claude-stream](https://github.com/Khan/format-claude-stream) -- community tool for formatting Claude stream-json output
- [ytyng: Extract Text from Claude Stream JSON](https://www.ytyng.com/en/blog/claude-stream-json-jq) -- actual stream-json event structure examples
