# Phase 98: Core SDK Integration - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Autopilot can invoke Claude through the Agent SDK instead of CLI subprocesses, with correct permissions, message handling, stall detection, and signal cleanup. This phase delivers a working `runAgentStep()` that replaces `runClaudeStreaming()` at the two primary call sites (`runStep()` and `runStepCaptured()`), plus the stall detection hook infrastructure and signal handler updates. Debug retry call sites and old code deletion are deferred to Phase 99.

</domain>

<decisions>
## Implementation Decisions

### SDK Installation and Import
- Install `@anthropic-ai/claude-agent-sdk` and `zod` (peer dep) as production dependencies (from REQUIREMENTS.md SDK-01)
- Bump `engines.node` in package.json from `>=16.7.0` to `>=18.0.0` (from REQUIREMENTS.md SDK-01)
- Import `query` from `@anthropic-ai/claude-agent-sdk` in autopilot.mjs (from REQUIREMENTS.md SDK-02)
- Remove the `which('node')` prerequisite check at lines 68-73 (from REQUIREMENTS.md SDK-02)

### Core Invocation Function (`runAgentStep`)
- Implement `runAgentStep(prompt, { outputFile, quiet, maxTurns, maxBudgetUsd, mcpServers })` wrapping SDK `query()` (from REQUIREMENTS.md SDK-03)
- Set `permissionMode: "bypassPermissions"` AND `allowDangerouslySkipPermissions: true` together -- both required to avoid tool-call permission hangs (from REQUIREMENTS.md SDK-03, PITFALLS.md Pitfall 1)
- Set `systemPrompt: { type: "preset", preset: "claude_code" }` and `settingSources: ["project"]` to load CLAUDE.md and Claude Code system prompt (from REQUIREMENTS.md SDK-03, PITFALLS.md Pitfall 2)
- Set `disallowedTools: ["AskUserQuestion"]` to prevent the autonomous agent from hanging on interactive prompts (from REQUIREMENTS.md SDK-03, PITFALLS.md Pitfall 5)
- Set `cwd: PROJECT_DIR` on every query call (from ARCHITECTURE.md)
- Pass `maxTurns` with a default of `getConfig('autopilot.max_turns_per_step', 200)` (from ARCHITECTURE.md)
- Pass `maxBudgetUsd` defaulting to `undefined` (no cap) when not configured (from ARCHITECTURE.md)

### Message Handling (`handleMessage`)
- Implement `handleMessage()` with typed switch on `message.type` -- `assistant`, `system`, `result` (from REQUIREMENTS.md MSG-01)
- For assistant messages, access content via `message.message?.content` (double `.message` nesting per SDK API) (from PITFALLS.md Pitfall 10)
- Write assistant text blocks to stdout and tool_use blocks as `  * {name}\n` to stderr, preserving output parity with current streaming (from ROADMAP.md success criterion 2)
- Accumulate `lastAssistantText` from every assistant message for error context when result subtype is not `success` (from REQUIREMENTS.md MSG-02, PITFALLS.md Pitfall 6)
- On result messages, use `resultMsg.result` for success subtype, `lastAssistantText` for error subtypes (from PITFALLS.md Pitfall 6)
- Write `JSON.stringify(message) + '\n'` to outputFile for each message when outputFile is specified (from ARCHITECTURE.md)
- In quiet mode (`quiet || QUIET`), suppress display output but still process result messages for exit status (from FEATURES.md)
- Log session ID, model from system init messages via `logMsg()` (from ARCHITECTURE.md)
- Log cost, turns, subtype from result messages via `logMsg()` (from ARCHITECTURE.md)

### Stall Detection (`buildStepHooks`)
- Implement `buildStepHooks()` returning `PostToolUse` and `Stop` hook arrays (from REQUIREMENTS.md SAFE-03)
- `PostToolUse` hook re-arms a `setTimeout`-based stall timer on each tool completion (from REQUIREMENTS.md SAFE-03)
- Also re-arm the stall timer in the main `for await` message loop to handle thinking-heavy turns with no tool calls (from REQUIREMENTS.md SAFE-03, PITFALLS.md Pitfall 9)
- `Stop` hook clears the stall timer (from ARCHITECTURE.md)
- Use `stallTimer.unref()` on every timer creation to prevent keeping the process alive (from PITFALLS.md Pitfall 4/Anti-Pattern 4)
- Also clear the stall timer in a `finally` block in `runAgentStep()` to handle cases where `Stop` hooks may not fire at maxTurns limit (from FEATURES.md edge case)
- Use the existing `autopilot.stall_timeout_ms` config key with 300000ms default (from existing config.cjs CONFIG_DEFAULTS)

### Signal Handling
- Store an `AbortController` reference at module scope (`activeAbortController`) (from REQUIREMENTS.md SAFE-04)
- Create a new `AbortController` per `runAgentStep()` call and set `activeAbortController` before iterating (from REQUIREMENTS.md SAFE-04)
- In SIGINT handler, call `activeAbortController?.abort()` before `process.exit(130)` (from REQUIREMENTS.md SAFE-04)
- In SIGTERM handler, call `activeAbortController?.abort()` before `process.exit(0)` (from REQUIREMENTS.md SAFE-04)
- Set `activeAbortController = null` after each `runAgentStep()` completes (Claude's Decision: prevents stale reference from aborting a future query)

### Return Type and Caller Wiring
- Return `{ exitCode, stdout, costUsd }` from `runAgentStep()` where exitCode is 0 for `success` subtype, 1 for all error subtypes (from ARCHITECTURE.md)
- Wire `runAgentStep()` to `runStep()` line 365 replacing `runClaudeStreaming(prompt)` (from REQUIREMENTS.md CALL-01)
- Wire `runAgentStep()` to `runStepCaptured()` line 553 replacing `runClaudeStreaming(prompt, { outputFile })` (from REQUIREMENTS.md CALL-01)
- Do NOT collect all messages in an array for long-running steps -- process as they arrive, only retain the result message reference (Claude's Decision: avoids memory bloat on execute steps with hundreds of turns per ARCHITECTURE.md Anti-Pattern 2)

### Claude's Discretion
- Internal variable naming for stall timer state variables
- Exact format of logMsg strings for session ID and cost tracking
- Whether to use `const` or `let` for the `armStallTimer` closure variable inside `buildStepHooks`
- Order of fields in the `query()` options object
- Whether `handleMessage` logs system messages other than `init` subtype

</decisions>

<specifics>
## Specific Ideas

- The SDK's `query()` returns `AsyncGenerator<SDKMessage, void>` -- iterate with `for await...of` (from ARCHITECTURE.md)
- `SDKResultMessage.subtype` is a discriminated union: `success`, `error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries` (from PITFALLS.md Pitfall 3)
- The `result` field on `SDKResultMessage` is only defined on the `success` variant -- all error variants have `undefined` result (from PITFALLS.md Pitfall 6)
- Hook matcher `".*"` matches all tools (regex, not glob) -- omitting the matcher also matches all (from FEATURES.md)
- PostToolUse hook callback signature: `async (input, toolUseID, { signal }) => ({})` -- returning `{}` allows the operation (from ARCHITECTURE.md)
- Cold start overhead of ~12s per `query()` call is a known SDK limitation -- accept and log (from PITFALLS.md Pitfall 7)
- The `allowedTools` list does NOT restrict tools in `bypassPermissions` mode -- it only pre-approves them; `disallowedTools` is the enforcement mechanism (from PITFALLS.md Pitfall 5)
- `SDKAssistantMessage` wraps content in `message.message.content` (double nesting), not `message.content` (from PITFALLS.md Pitfall 10)
- SDK is ESM-only (`sdk.mjs`) -- natural fit for autopilot.mjs which is already ESM (from ARCHITECTURE.md)
- The existing `which('claude')` prerequisite check remains valid -- the SDK spawns Claude Code as a subprocess internally (from design doc)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runClaudeStreaming()` (lines 228-278): Current implementation being replaced -- informs the interface contract that `runAgentStep()` must satisfy (same `{ exitCode, stdout }` shape plus `costUsd`)
- `displayStreamEvent()` (lines 213-226): Current output display logic -- `handleMessage()` must produce equivalent stdout/stderr output
- `armStallTimer()` pattern (lines 241-253): Current stall detection approach with `setTimeout`/`.unref()`/repeating warnings -- `buildStepHooks()` preserves this exact pattern but triggers from hooks instead of NDJSON lines
- `getConfig()` (lines 190-206): Config loading with nested key traversal and CONFIG_DEFAULTS fallback -- used by new SDK option resolution
- `logMsg()` (lines 125-128): Session logging to file -- used for session ID, cost, and stall warning logging
- Signal handlers (lines 146-170): SIGINT/SIGTERM with cleanup and resume message -- updated to add `AbortController.abort()` call

### Established Patterns
- **Config 3-touch-point pattern:** CONFIG_DEFAULTS in config.cjs + KNOWN_SETTINGS_KEYS in cli.cjs/validation.cjs + validateSetting -- new config keys must follow this pattern (in Phase 99 per requirements)
- **ESM/CJS bridge via `createRequire()`:** autopilot.mjs (ESM) imports CJS modules via `createRequire(import.meta.url)` -- SDK import uses standard ESM `import` since SDK is ESM-native
- **zx `$` for shell-outs:** `gsdTools()` and `takeProgressSnapshot()` use zx `$` for git/filesystem commands -- unchanged, orthogonal to SDK
- **Temp file management via `tempFiles` array:** Output capture files added to array, cleaned up on exit -- same pattern for SDK output files
- **`quiet || QUIET` check for output suppression:** Used throughout to support `--quiet` flag -- `handleMessage()` follows this pattern

### Integration Points
- `runStep()` at line 365: Replace `runClaudeStreaming(prompt)` with `runAgentStep(prompt)`
- `runStepCaptured()` at line 553: Replace `runClaudeStreaming(prompt, { outputFile })` with `runAgentStep(prompt, { outputFile })`
- `runStepWithRetry()` at line 614: Debug retry call site -- deferred to Phase 99 per REQUIREMENTS.md CALL-02
- `runVerifyWithDebugRetry()` at lines 658 and 696: Debug retry call sites -- deferred to Phase 99 per REQUIREMENTS.md CALL-02
- SIGINT handler at line 146: Add `activeAbortController?.abort()` before `process.exit(130)`
- SIGTERM handler at line 158: Add `activeAbortController?.abort()` before `process.exit(0)`
- `package.json` dependencies: Add `@anthropic-ai/claude-agent-sdk` and `zod`
- `package.json` engines: Bump node requirement to `>=18.0.0`

</code_context>

<deferred>
## Deferred Ideas

- **Debug retry call site migration (CALL-02):** Lines 614, 658, 696 are deferred to Phase 99 -- they continue using `runClaudeStreaming()` until Phase 99 wires them to `runAgentStep()`
- **Per-step-type maxTurns config via TURNS_CONFIG (SAFE-01):** Phase 98 uses a single default maxTurns; per-step-type config registration happens in Phase 99
- **maxBudgetUsd config registration (SAFE-02):** The option is wired but config key registration in config.cjs is Phase 99
- **Deletion of `runClaudeStreaming()` and `displayStreamEvent()` (CLN-01):** Cannot delete until all 5 call sites are migrated in Phase 99
- **Config key registration in config.cjs (CLN-02):** All new keys registered together in Phase 99
- **Per-step MCP server configuration (MCP-01):** Phase 100
- **Cost/turn/duration logging from result messages (MSG-03):** Phase 100
- **Cumulative cost reporting in printFinalReport (OBS-02):** Phase 100
- **`gsd debug-session` command (SESS-01):** Future requirement, not v3.2 scope
- **V2 SDK interface evaluation (SDKV2-01):** Deferred until V2 reaches stable release

</deferred>

---

*Phase: 98-core-sdk-integration*
*Context gathered: 2026-03-24 via auto-context*
