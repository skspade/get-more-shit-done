# Phase 54: Core Streaming Function - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Deliver a single `runClaudeStreaming()` function in `autopilot.mjs` that replaces the direct `$\`claude -p ...\`` invocation pattern with NDJSON line-by-line stream parsing. The function must display assistant text to stdout and tool call indicators to stderr in real-time, detect stalls with a repeating 5-minute warning, fall back to buffered JSON via `--quiet`, and preserve the `< /dev/null` stdin redirect. This phase builds the core function only -- wiring it into `runStep()`/`runStepCaptured()` and debug retry sites happens in Phases 55-56.

</domain>

<decisions>
## Implementation Decisions

### Discovery (STREAM-01)
- Empirically discover `stream-json` event format before implementing display logic by running `claude -p --output-format stream-json` in a throwaway invocation and recording the raw NDJSON output
- Capture actual event shapes to a discovery file (e.g., `.planning/phases/54-core-streaming-function/stream-json-discovery.md`) so display logic is grounded in observed data rather than assumptions (Claude's Decision: design doc event shapes are approximate; verifying against live output prevents misparse bugs)

### NDJSON Parsing (STREAM-02, STREAM-04, STREAM-06)
- `runClaudeStreaming(prompt, { outputFile, quiet })` is the sole entry point for all Claude CLI invocations
- Uses `--output-format stream-json` for the streaming code path and `--output-format json` for quiet mode
- Reads child process stdout as an async iterable of lines via zx's built-in line iteration (`for await (const line of child.stdout)`)
- Every raw NDJSON line accumulated into an array; joined as `result.stdout` on completion for debug retry error context compatibility
- Each line parsed with `JSON.parse()` inside a try/catch; parse failures write the raw line to stdout as a defensive fallback
- Function returns `{ exitCode, stdout }` matching current usage patterns

### Event Display (STREAM-03)
- `displayStreamEvent(event)` is a pure function handling the switch on `event.type`
- `assistant` events: extract text from `event.message.content` blocks (type `text`), write to `process.stdout`
- `tool_use` events: write compact one-liner to `process.stderr` (format: two-space indent, diamond bullet, tool name)
- `result` events: silent -- captured programmatically by the caller
- All other event types: silent -- accumulated in output but not displayed
- Tool call indicator format uses the diamond character already used in autopilot debug retry messages for visual consistency

### Output File Capture (STREAM-05)
- When `outputFile` is provided, each NDJSON line is appended to the file immediately via `fs.appendFileSync()` as it arrives
- This ensures real-time file capture (not buffered to process exit), maintaining compatibility with debug retry error context extraction

### Stall Detection (STALL-01, STALL-02, STALL-03, STALL-04)
- Configurable timeout via `getConfig('autopilot.stall_timeout_ms', 300000)` using the existing config system
- Timer resets on every NDJSON line received
- After timeout with no events: prints warning to stderr and logs to autopilot log file
- Warning re-arms automatically for repeated warnings at each subsequent interval (5min, 10min, 15min, etc.)
- Timer uses `setTimeout` with `.unref()` so it does not prevent Node.js process exit (Claude's Decision: unref prevents timer from keeping process alive if stream ends between timer reset and fire)
- Timer cleaned up in a try/finally block wrapping the stream read loop to cover all exit paths including stream errors

### Quiet Mode (CLI-01)
- New `--quiet` flag added to `knownFlags` set and parsed from `argv.quiet`
- When `quiet` is true, `runClaudeStreaming()` uses `--output-format json` and awaits the child process directly -- identical to current behavior with no streaming display
- `QUIET` flag stored as a module-level constant alongside `DRY_RUN` and `FROM_PHASE`

### Stdin Preservation (CLI-05)
- The `< /dev/null` redirect remains on the shell command inside `runClaudeStreaming()`, applied to both streaming and quiet code paths
- This prevents Claude from hanging waiting for stdin input during autonomous execution

### Function Placement and Export
- `runClaudeStreaming()` and `displayStreamEvent()` are defined in `autopilot.mjs` alongside existing helper functions (Claude's Decision: same file as consumers avoids cross-module wiring for an internal function; extraction can happen later if needed)
- Placed between the config loading section and the step execution section to maintain logical code organization (Claude's Decision: mirrors the existing top-to-bottom dependency order in autopilot.mjs)

### Claude's Discretion
- Internal variable names for stall timer state (counter, timer reference)
- Exact stderr warning message formatting and wording
- Whether to use string template literals or string concatenation for log messages
- Order of fields in the returned `{ exitCode, stdout }` object
- Discovery invocation prompt text and flags beyond `--output-format stream-json`

</decisions>

<specifics>
## Specific Ideas

- The design doc specifies `process.stderr.write(\`  ◆ ${toolName}\n\`)` for tool call indicators -- this matches the existing `◆` character used in debug retry messages (`◆ Debug retry N/M`)
- Stall warning message from design: `⚠ No output for N minutes -- step may be stalled`
- The design doc shows approximate event shapes (`assistant`, `tool_use`, `tool_result`, `result`) but STREAM-01 requires empirical discovery first -- the implementation should be grounded in actual observed event types
- The zx async iterator pattern (`for await (const line of child.stdout)`) is the idiomatic zx approach for line-by-line stream reading, avoiding manual readline setup
- `getConfig()` already exists in autopilot.mjs and supports dot-notation keys with CONFIG_DEFAULTS fallback -- `autopilot.stall_timeout_ms` fits this pattern naturally (Phase 57 adds it to the formal schema; this phase just reads it with a default)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getConfig(key, defaultVal)` in autopilot.mjs: Already handles dot-notation config lookup with CONFIG_DEFAULTS fallback -- stall timeout reads directly from this
- `logMsg(msg)` in autopilot.mjs: Existing log-to-file function for stall warnings and stream lifecycle events
- `CONFIG_DEFAULTS` in config.cjs: Flat key-value map for autopilot defaults -- Phase 57 will add `autopilot.stall_timeout_ms` here, but the function can use the inline default for now
- `printBanner(text)` in autopilot.mjs: Provides console formatting conventions to follow

### Established Patterns
- All `claude -p` invocations use the pattern: `$\`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt} < /dev/null\`.nothrow()` -- the new function replaces `json` with `stream-json` and adds async line iteration
- zx `$` template literals with `.nothrow()` for non-throwing subprocess execution -- streaming must maintain this pattern
- `createRequire` for CJS imports in ESM context -- already wired up at module top
- Module-level constants for parsed flags (`FROM_PHASE`, `DRY_RUN`) -- `QUIET` follows this pattern

### Integration Points
- `runStep()` (line 262): Currently calls `$\`claude -p ...\`` directly -- Phase 55 will delegate to `runClaudeStreaming()`
- `runStepCaptured()` (line 452): Currently calls `$\`claude -p ...\`` with output file capture -- Phase 55 will delegate to `runClaudeStreaming()` with `outputFile` option
- Three debug retry `$\`claude -p ...\`` calls (lines 536, 581, 620): Phase 56 will route these through `runClaudeStreaming()`
- `knownFlags` Set (line 34): `--quiet` flag added here
- Argument parsing section (lines 53-55): `QUIET` constant defined here

</code_context>

<deferred>
## Deferred Ideas

- Wiring `runStep()` and `runStepCaptured()` to use `runClaudeStreaming()` (Phase 55)
- Wiring debug retry invocations through `runClaudeStreaming()` (Phase 56)
- Adding `autopilot.stall_timeout_ms` to CONFIG_DEFAULTS and config schema for `gsd settings` visibility (Phase 57)
- Token-level streaming UI (spinners, progress bars) -- out of scope per REQUIREMENTS.md
- Interactive stream controls (pause/resume) -- out of scope per REQUIREMENTS.md
- Automatic process kill on stall -- warning-only per REQUIREMENTS.md

</deferred>

---

*Phase: 54-core-streaming-function*
*Context gathered: 2026-03-12 via auto-context*
