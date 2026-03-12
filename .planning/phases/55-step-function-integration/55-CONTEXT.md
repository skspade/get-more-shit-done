# Phase 55: Step Function Integration - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Wire `runStep()` and `runStepCaptured()` to delegate to `runClaudeStreaming()` instead of direct `$\`claude -p ...\`` invocations. After this phase, every normal autopilot phase step (discuss, plan, execute, verify) streams output in real-time through the consolidated function, and the output file used by debug retry error context extraction receives NDJSON lines as they arrive. Debug retry invocations themselves are NOT rewired here (Phase 56).

</domain>

<decisions>
## Implementation Decisions

### runStep() Integration
- Replace the direct `$\`cd ${PROJECT_DIR} && claude -p ... < /dev/null\`.nothrow()` call (line 348) with a call to `runClaudeStreaming(prompt)`
- Remove the manual `process.stdout.write(result.stdout)` after the call (line 353) -- `runClaudeStreaming()` already displays assistant text and tool call indicators in real-time during streaming mode
- The returned `{ exitCode, stdout }` object maps directly to the existing `exitCode` usage; `stdout` is available but not needed since output is already displayed (Claude's Decision: keeps the function signature change minimal -- just swap the invocation and remove the now-redundant write)
- DRY_RUN path remains unchanged -- it does not invoke Claude

### runStepCaptured() Integration
- Replace the direct `$\`claude -p ...\`` call (line 539) with `runClaudeStreaming(prompt, { outputFile })`
- Remove the manual `process.stdout.write(result.stdout)` and `fs.appendFileSync(outputFile, result.stdout)` block (lines 544-547) -- `runClaudeStreaming()` handles both real-time display and real-time file capture when `outputFile` is provided
- The returned `{ exitCode }` maps directly to the existing `exitCode` usage

### Error Context Extraction Compatibility
- The debug retry error context extraction (lines 589-593, 636-639) reads from the `outputFile` written by `runStepCaptured()` and takes the last 100 lines via `.slice(-100)`
- With NDJSON output, the last 100 lines will be 100 NDJSON lines instead of a single JSON blob -- each line contains a stream event (assistant text, tool use, result, etc.)
- The last 100 NDJSON lines still provide useful context for debugging because they contain the final assistant messages and tool calls leading up to the failure (Claude's Decision: NDJSON lines are individually meaningful -- a `result` event at the end plus preceding `assistant` events gives the debugger more granular context than a single JSON blob)
- No changes needed to `constructDebugPrompt()` or the error context extraction logic itself -- it operates on raw text lines regardless of format

### Quiet Mode Passthrough
- `runClaudeStreaming()` already handles the `QUIET` flag internally (falls back to `--output-format json` with direct await) so `runStep()` and `runStepCaptured()` do not need conditional logic for quiet mode
- The DRY_RUN message in `runStep()` still references `--output-format json` in its display text (Claude's Decision: dry-run message shows what would conceptually execute; the actual format is an implementation detail of runClaudeStreaming)

### Claude's Discretion
- Whether to extract `exitCode` via destructuring or dot notation from the returned object
- Whether to keep or remove the intermediate `result` variable in each function
- Exact placement of the `logMsg()` calls relative to the new `runClaudeStreaming()` call

</decisions>

<specifics>
## Specific Ideas

- `runStep()` currently has 5 lines of invocation logic (call, extract exitCode, log, write stdout) that collapse to 2 lines (call runClaudeStreaming, extract exitCode)
- `runStepCaptured()` similarly collapses from 7 lines to 2 lines
- The `runStepWithRetry()` function does not need changes -- it already delegates to `runStepCaptured()` and reads error context from the output file, both of which continue to work
- `runVerifyWithDebugRetry()` calls `runStepCaptured()` at line 622 -- this automatically gets streaming behavior through the delegation without any direct changes
- The gap closure loop (lines 957-960) and main loop (lines 1121-1125) call `runStep()` for discuss and plan steps -- these also get streaming automatically

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runClaudeStreaming(prompt, { outputFile, quiet })`: Phase 54 function at line 211 -- already handles streaming vs quiet mode, stall detection, output file capture, and NDJSON display
- `displayStreamEvent(event)`: Phase 54 function at line 196 -- handles assistant text to stdout and tool call indicators to stderr

### Established Patterns
- `runStep()` (line 332): Takes progress snapshots before/after, calls Claude, writes stdout, checks progress, handles non-zero exit codes with halt-or-continue logic
- `runStepCaptured()` (line 522): Same pattern as `runStep()` but additionally writes output to a file for debug retry error context extraction
- Both functions return an exit code integer, not the full result object

### Integration Points
- `runStep()` line 348: Direct `$` invocation to replace with `runClaudeStreaming(prompt)`
- `runStep()` line 353: `process.stdout.write(result.stdout)` to remove (streaming handles display)
- `runStepCaptured()` line 539: Direct `$` invocation to replace with `runClaudeStreaming(prompt, { outputFile })`
- `runStepCaptured()` lines 544-547: stdout write + file append block to remove (streaming handles both)
- Error context extraction at lines 589-593 and 636-639: Reads output file, takes last 100 lines -- works with NDJSON without changes
- Three debug retry `$` calls at lines 606, 651, 690: NOT touched in this phase (Phase 56 scope)

</code_context>

<deferred>
## Deferred Ideas

- Wiring debug retry invocations through `runClaudeStreaming()` (Phase 56)
- Adding `autopilot.stall_timeout_ms` to config schema (Phase 57)
- Updating the DRY_RUN display message to mention `stream-json` -- cosmetic, not worth the churn

</deferred>

---

*Phase: 55-step-function-integration*
*Context gathered: 2026-03-12 via auto-context*
