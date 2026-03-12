# Phase 56: Debug Retry Integration - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Route all 3 debug retry `claude -p` invocations in `autopilot.mjs` through `runClaudeStreaming()` so that debug retry cycles show live streaming output instead of buffered JSON. After this phase, users can watch the debugger work in real-time during failure recovery. No new functions are created -- this is purely a wiring change at existing invocation sites.

</domain>

<decisions>
## Implementation Decisions

### Debug Retry Invocation Replacement
- All 3 debug retry `claude -p` invocations route through `runClaudeStreaming()` instead of direct `$` template literals
- During a debug retry cycle, assistant text and tool call indicators stream to the terminal in real-time
- The 3 invocation sites are: `runStepWithRetry()` line 597, `runVerifyWithDebugRetry()` line 642 (verify crash path), and `runVerifyWithDebugRetry()` line 681 (gaps found path)
- Each site replaces `const debugResult = await $\`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${debugPrompt} < /dev/null\`.nothrow()` with `const { exitCode, stdout } = await runClaudeStreaming(debugPrompt)` (Claude's Decision: same call signature as runStep/runStepCaptured uses -- no outputFile needed since debug retries do not capture to file)

### Redundant stdout.write Removal
- Remove the `if (debugResult.stdout) process.stdout.write(debugResult.stdout)` line following each invocation (lines 598, 643, 682) because `runClaudeStreaming()` already displays assistant text and tool call indicators in real-time during streaming mode (Claude's Decision: identical pattern to how Phase 55 removed the manual stdout writes from runStep and runStepCaptured)

### Exit Code Handling Preservation
- In `runStepWithRetry()` (line 599-601): the post-debug check `if (debugResult.exitCode !== 0)` continues to work via the destructured `exitCode` from `runClaudeStreaming()` return value (Claude's Decision: the warning-and-continue logic is important -- debugger failures should not halt the retry loop)
- In `runVerifyWithDebugRetry()` verify crash path (line 642-644): no exit code check exists -- the function just continues to the next retry iteration, so only the invocation and stdout write need changing
- In `runVerifyWithDebugRetry()` gaps path (line 681-682): no exit code check exists -- same as verify crash path

### Quiet Mode Passthrough
- `runClaudeStreaming()` already handles the `QUIET` flag internally, falling back to `--output-format json` with direct await -- debug retry calls inherit this behavior without conditional logic (Claude's Decision: no per-site quiet branching needed since the function encapsulates it)

### Claude's Discretion
- Whether to destructure `{ exitCode }` or `{ exitCode, stdout }` at sites where stdout is unused
- Exact placement of any additional `logMsg()` calls around the new invocations
- Whether to keep the empty line (`console.log('')`) between banner and invocation

</decisions>

<specifics>
## Specific Ideas

- All 3 sites follow an identical before/after pattern, making this a mechanical find-and-replace with consistent structure
- The `runStepWithRetry()` site (line 597) is the only one that checks `debugResult.exitCode !== 0` after the call -- the two `runVerifyWithDebugRetry()` sites just invoke and continue
- No output file capture is needed for debug retry invocations -- they are fire-and-forget calls to the debugger, not output-captured steps
- The banner lines preceding each invocation (e.g., `console.log('\u2501'.repeat(53))`) remain unchanged -- they are display chrome, not part of the Claude CLI invocation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runClaudeStreaming(prompt, { outputFile, quiet })`: Phase 54 function at line 211 -- already handles streaming vs quiet mode, stall detection, stdin redirect, and NDJSON display
- `displayStreamEvent(event)`: Phase 54 function at line 196 -- handles assistant text to stdout and tool call indicators to stderr

### Established Patterns
- Phase 55 already demonstrated the pattern: replace `$\`claude -p ...\`` with `runClaudeStreaming()` and remove the manual `process.stdout.write()` call -- this phase applies the same pattern to 3 more sites
- Debug retry invocations do not use `outputFile` (they are not captured for error context -- error context comes from the *failed step's* output file, not the debugger's output)

### Integration Points
- `runStepWithRetry()` line 597: Direct `$` invocation to replace with `runClaudeStreaming(debugPrompt)`
- `runStepWithRetry()` line 598: `process.stdout.write(debugResult.stdout)` to remove
- `runVerifyWithDebugRetry()` line 642: Direct `$` invocation to replace with `runClaudeStreaming(debugPrompt)`
- `runVerifyWithDebugRetry()` line 643: `process.stdout.write(debugResult.stdout)` to remove
- `runVerifyWithDebugRetry()` line 681: Direct `$` invocation to replace with `runClaudeStreaming(debugPrompt)`
- `runVerifyWithDebugRetry()` line 682: `process.stdout.write(debugResult.stdout)` to remove

</code_context>

<deferred>
## Deferred Ideas

- Adding `autopilot.stall_timeout_ms` to config schema for `gsd settings` visibility (Phase 57)
- End-to-end streaming verification (Phase 57)
- Token-level streaming UI (spinners, progress bars) -- out of scope per REQUIREMENTS.md
- Automatic process kill on stall -- warning-only per REQUIREMENTS.md

</deferred>

---

*Phase: 56-debug-retry-integration*
*Context gathered: 2026-03-12 via auto-context*
