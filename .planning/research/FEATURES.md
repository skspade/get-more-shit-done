# Feature Research

**Domain:** Claude Agent SDK migration -- replacing CLI subprocess invocations with SDK `query()` calls in autopilot.mjs
**Researched:** 2026-03-24
**Confidence:** HIGH (based on official Anthropic Agent SDK TypeScript reference, hooks guide, sessions guide, permissions guide)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must work correctly for the migration to be viable. Missing any of these means the autopilot cannot function.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| `runAgentStep()` wrapping SDK `query()` | Core replacement for `runClaudeStreaming()` -- every Claude invocation routes through this | MEDIUM | SDK install | `query({ prompt, options })` returns `AsyncGenerator<SDKMessage>`. Iterate with `for await`. Returns typed messages instead of NDJSON lines. Design already specifies this function shape. |
| Typed message handling (`handleMessage()`) | Replaces `displayStreamEvent()` NDJSON parsing. SDK yields `SDKAssistantMessage`, `SDKResultMessage`, `SDKSystemMessage` etc. | LOW | `runAgentStep()` | `message.type` discriminates: `"assistant"` has `.message.content[]` blocks (text, tool_use), `"result"` has `.subtype` (success/error_max_turns/error_max_budget_usd/error_during_execution), `"system"` with `subtype: "init"` provides session_id, model, tools. No JSON.parse try/catch needed. |
| `permissionMode: "bypassPermissions"` with `allowDangerouslySkipPermissions: true` | Autopilot runs autonomously -- cannot prompt for permissions | LOW | SDK install | Replaces `--dangerously-skip-permissions` CLI flag. Both fields required together. WARNING: subagents inherit this mode and it cannot be overridden per-subagent. |
| `systemPrompt: { type: "preset", preset: "claude_code" }` with `settingSources: ["project"]` | Must load CLAUDE.md files and use Claude Code's full system prompt | LOW | SDK install | Without `settingSources: ["project"]`, CLAUDE.md files are NOT loaded. Without the preset system prompt, Claude loses its coding personality. Both required together. |
| `cwd` option pointing to `PROJECT_DIR` | SDK must operate in the project directory | LOW | SDK install | Default is `process.cwd()`. Must explicitly set since autopilot resolves `PROJECT_DIR` from argv. |
| Exit code extraction from result messages | `runStep()` / `runStepCaptured()` depend on exit codes (0 = success, non-zero = failure) for retry and circuit breaker logic | LOW | Typed messages | `SDKResultMessage` with `subtype: "success"` maps to exit 0. All error subtypes (`error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`) map to exit 1. The `result` field contains the final text output. |
| Per-step `maxTurns` limits | Prevents runaway agent loops within a single step -- replaces half of the safety infrastructure | MEDIUM | Config integration | SDK stops cleanly and returns `subtype: "error_max_turns"`. Design specifies per-step-type defaults (discuss: 100, plan: 150, execute: 300, verify: 100, debug: 50, audit: 100, uat: 150, completion: 50). Register as new config keys in `config.cjs`. |
| Cost tracking from result messages | Every step should log cost for observability -- never available with CLI subprocess approach | LOW | Typed messages | `SDKResultMessage` provides `total_cost_usd`, `num_turns`, `duration_ms`, `usage` (input/output tokens), and `modelUsage` (per-model breakdown). Log at step completion. |
| Output file capture for debug retry | `constructDebugPrompt()` reads the output file to build error context for retries | LOW | `handleMessage()` | Append `JSON.stringify(message) + '\n'` to output file for each message, same as design specifies. Used by debug retry to extract error context. |
| `allowedTools` configuration | Must provide the agent with the standard GSD tool set | LOW | SDK install | Design lists: `["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"]`. NOTE: `allowedTools` does NOT restrict tools -- it pre-approves them. With `bypassPermissions`, all tools are approved regardless. Use `allowedTools` for documentation clarity, not enforcement. |
| Quiet mode support | `--quiet` flag must still suppress all output for CI/scripted use | LOW | `handleMessage()` | In `handleMessage()`, check `if (quiet || QUIET) return;` to suppress output. The SDK still processes messages; we just don't display them. No separate CLI branch needed (unlike current quiet-mode using `--output-format json`). |

### Differentiators (Competitive Advantage)

Features that the SDK migration enables beyond parity. These add value that was impossible or impractical with CLI subprocess spawning.

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| Optional `maxBudgetUsd` per-step cost cap | Prevents runaway spending -- user opts in via config.json. SDK stops agent cleanly when cost exceeds limit, returns `subtype: "error_max_budget_usd"`. | LOW | Config integration | Default `undefined` (no cap). New config key: `autopilot.max_budget_per_step_usd`. When set, passed directly to `query()` options. Error handling same as maxTurns -- log warning, treat as non-zero exit. |
| `PostToolUse` hook-based stall detection | Replaces custom `setTimeout`/`armStallTimer` with SDK hook that fires after every tool completion. More reliable than NDJSON line-based re-arming because it triggers on actual tool completions, not output lines. | MEDIUM | Hook system | `buildStepHooks()` returns `{ PostToolUse: [{ matcher: ".*", hooks: [stallHook] }], Stop: [{ matcher: ".*", hooks: [cleanupHook] }] }`. `stallHook` re-arms timer via `setTimeout`. `Stop` hook clears timer. Design already specifies this pattern. |
| Per-step MCP server configuration | Enables targeted browser access for UAT steps without exposing MCP to all steps. Chrome DevTools MCP only attached during `automated-uat` step type. | MEDIUM | MCP config pattern | `mcpServers` option accepts `Record<string, McpServerConfig>`. `McpStdioServerConfig` uses `{ command, args, env }`. Step-type mapping pattern: `STEP_MCP_SERVERS['automated-uat']` returns Chrome DevTools config when `getConfig('uat.chrome_mcp_enabled', true)`. |
| Session ID logging for debugging | SDK provides `session_id` on every message and `SDKSystemMessage` (init) includes model, tools, mcp_servers, permissionMode. Enables post-mortem debugging via `listSessions()` and `getSessionMessages()`. | LOW | Typed messages | Log session_id at step start from `system`/`init` message. Could later build `gsd debug-session <id>` to replay session transcripts. |
| Structured result metadata | `SDKResultMessage` includes `duration_ms`, `duration_api_ms`, `num_turns`, `usage` (token counts), `modelUsage` (per-model). Enables step-level performance dashboards. | LOW | Typed messages | Log all fields at step completion. No additional implementation needed -- just consume what SDK provides. |
| `AbortController` for graceful cancellation | SDK accepts `abortController` option. SIGINT/SIGTERM handlers can call `controller.abort()` for clean shutdown instead of killing child processes. | LOW | Signal handling | Create `new AbortController()` per step. Pass to `query()`. On SIGINT, call `controller.abort()`. SDK handles cleanup. Replaces the current `proc.kill()` pattern. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but should NOT be built for this migration.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Session resume across autopilot steps | "Keep context from previous phase when running next phase" | Autopilot deliberately uses fresh context windows per step to prevent context rot. Resuming sessions would accumulate stale context. Session files are stored under `~/.claude/projects/<encoded-cwd>/` and tied to specific runs. | Each `query()` call starts fresh. This is the correct design -- the whole point is fresh 200k-token context windows per step. |
| `persistSession: false` for all steps | "Don't clutter disk with session files" | Session files enable post-mortem debugging. The SDK writes them to `~/.claude/projects/` automatically. Disabling would lose the ability to inspect what happened in failed steps. | Leave `persistSession` at default `true`. Session files are small (JSONL) and provide value for debugging. |
| Custom `canUseTool` permission callback | "Fine-grained tool approval per step" | `bypassPermissions` already approves everything. Adding `canUseTool` callbacks adds complexity without value since we want full autonomy. Any `canUseTool` call would block the autonomous loop waiting for a decision. | `bypassPermissions: true` with `disallowedTools` if specific tools need blocking (currently none do). |
| `includePartialMessages: true` for streaming | "Token-by-token streaming like ChatGPT" | Generates `SDKPartialAssistantMessage` events for every token delta. Creates massive message volume. The assistant message already arrives in chunks via the normal iteration. | Use standard `SDKAssistantMessage` messages. Text appears in content blocks as the SDK delivers them. Already provides near-real-time output. |
| V2 preview SDK interface (`createSession`/`send`/`stream`) | "Newer API, must be better" | V2 is explicitly marked unstable/preview -- "APIs may change." The V1 `query()` function is stable and well-documented. Migrating to V2 now would require re-migration later. | Use stable V1 `query()` function. V2 can be evaluated for a future migration if/when it stabilizes. |
| Subagent definitions via SDK `agents` option | "Define GSD agents programmatically" | GSD already defines agents via markdown files in `.claude/agents/`. SDK `agents` option would create a parallel, competing definition system. Slash commands already invoke these agents. | Use `settingSources: ["project"]` to load existing agent definitions from `.claude/` directory. SDK reads them automatically. |
| In-process MCP servers via `createSdkMcpServer()` | "Embed MCP tools in the autopilot process" | Adds complexity. The existing stdio-based MCP pattern (Chrome DevTools) works fine with `McpStdioServerConfig`. In-process servers need Zod schema definitions and handler functions -- overkill for this migration. | Use `McpStdioServerConfig` with `{ command, args }` for external MCP servers. |
| Dynamic permission mode switching via `setPermissionMode()` | "Start restrictive, loosen during execution" | Autopilot is fully autonomous. Starting restrictive would block steps. There is no scenario where we want some steps restricted and others not -- all steps need full permissions. | Set `permissionMode: "bypassPermissions"` once at step creation. Never change it. |
| `outputFormat` for structured JSON output | "Get machine-parseable results" | The `result` field on `SDKResultMessage` already contains the text output. Structured output requires a JSON schema and retries on schema violation (`error_max_structured_output_retries`). GSD commands produce markdown, not JSON. | Read `resultMsg.result` for the text output. Parse it as needed (same as current `stdout` handling). |
| File checkpointing via `enableFileCheckpointing` | "Track file changes for rewind" | The circuit breaker already uses git snapshots (`takeProgressSnapshot()`). File checkpointing adds a parallel tracking system. The SDK's `rewindFiles()` would conflict with git-based recovery. | Keep using git-based progress snapshots. They are already working and integrated with the circuit breaker. |

## Feature Dependencies

```
[SDK Install (@anthropic-ai/claude-agent-sdk)]
    |
    +---> [runAgentStep() core function]
    |         |
    |         +---> [handleMessage() typed dispatch]
    |         |         |
    |         |         +---> [Quiet mode suppression]
    |         |         +---> [Output file capture]
    |         |         +---> [Cost/turn logging]
    |         |
    |         +---> [buildStepHooks() stall detection]
    |         |
    |         +---> [Per-step maxTurns config]
    |         |
    |         +---> [Optional maxBudgetUsd config]
    |         |
    |         +---> [Per-step MCP server config]
    |         |
    |         +---> [AbortController for cancellation]
    |
    +---> [Remove runClaudeStreaming()]
    |         |
    |         +---> [Remove displayStreamEvent()]
    |         +---> [Remove which('node') check]
    |
    +---> [Config registration (new keys)]
              |
              +---> autopilot.max_turns_per_step
              +---> autopilot.turns.{discuss,plan,execute,verify,debug,audit,uat,completion}
              +---> autopilot.max_budget_per_step_usd
```

### Dependency Notes

- **`runAgentStep()` requires SDK install:** Cannot begin core implementation until `@anthropic-ai/claude-agent-sdk` is in `package.json` and importable.
- **`handleMessage()` requires `runAgentStep()`:** Message handling is called from within the query iteration loop.
- **`buildStepHooks()` requires `runAgentStep()`:** Hooks are passed as options to `query()`.
- **Config registration is independent:** New config keys can be added to `config.cjs` before or alongside `runAgentStep()`.
- **Removal of old code requires `runAgentStep()` working:** Cannot remove `runClaudeStreaming()` until `runAgentStep()` is verified.
- **Per-step MCP config requires `runAgentStep()`:** MCP servers are passed as options to `query()`.
- **AbortController requires signal handler updates:** Existing SIGINT/SIGTERM handlers need minor updates to call `controller.abort()`.

## MVP Definition

### Launch With (v3.2)

Minimum for the migration to be complete and all existing autopilot functionality preserved.

- [x] Install `@anthropic-ai/claude-agent-sdk` as npm dependency
- [ ] `runAgentStep()` wrapping SDK `query()` with typed message handling
- [ ] `handleMessage()` replacing `displayStreamEvent()` with SDK message types
- [ ] `buildStepHooks()` with `PostToolUse` stall detection replacing custom timer
- [ ] Per-step-type `maxTurns` limits configurable via config.json
- [ ] Optional `maxBudgetUsd` per-step cost cap
- [ ] Per-step MCP server configuration (Chrome DevTools for UAT)
- [ ] Cost and turn tracking logged per step
- [ ] Remove `runClaudeStreaming()`, `displayStreamEvent()`, and `which('node')` check
- [ ] Config key registration for all new settings

### Add After Validation (v3.2.x)

Features to add once core migration is verified working.

- [ ] `AbortController` integration with SIGINT/SIGTERM handlers -- currently signal handlers kill the child process; SDK provides cleaner cancellation but the current pattern still works via process termination
- [ ] Session ID logging in step banners -- useful for debugging but not blocking
- [ ] `gsd debug-session <id>` command for session transcript replay -- leverages `listSessions()` and `getSessionMessages()` SDK functions

### Future Consideration (v3.3+)

Features to defer until the SDK migration is stable and proven.

- [ ] V2 SDK interface evaluation (`createSession`/`send`/`stream`) -- if/when it exits preview
- [ ] Programmatic agent definitions via SDK `agents` option -- only if markdown-based agents prove insufficient
- [ ] `effort` option tuning per step type -- SDK supports `'low' | 'medium' | 'high' | 'max'` for thinking depth

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| `runAgentStep()` core | HIGH | MEDIUM | P1 | Core |
| `handleMessage()` typed dispatch | HIGH | LOW | P1 | Core |
| `permissionMode` + `systemPrompt` config | HIGH | LOW | P1 | Core |
| Per-step `maxTurns` | HIGH | MEDIUM | P1 | Safety |
| `buildStepHooks()` stall detection | HIGH | MEDIUM | P1 | Safety |
| Optional `maxBudgetUsd` | MEDIUM | LOW | P1 | Safety |
| Per-step MCP servers | MEDIUM | MEDIUM | P1 | MCP |
| Cost/turn logging | MEDIUM | LOW | P1 | Observability |
| Remove old code | HIGH | LOW | P1 | Cleanup |
| Config key registration | MEDIUM | LOW | P1 | Config |
| AbortController cancellation | LOW | LOW | P2 | Polish |
| Session ID logging | LOW | LOW | P2 | Observability |
| `gsd debug-session` command | LOW | MEDIUM | P3 | Future |

**Priority key:**
- P1: Must have for v3.2 launch
- P2: Should have, add if time permits in v3.2
- P3: Future consideration, not v3.2 scope

## SDK Behavior Edge Cases

Critical behaviors discovered in official documentation that affect implementation:

| Behavior | Implication | Handling |
|----------|-------------|----------|
| `allowedTools` does NOT restrict tools -- only pre-approves them | With `bypassPermissions`, all tools are approved regardless of `allowedTools` list | Use `allowedTools` for documentation only. Use `disallowedTools` if tools actually need blocking. |
| `settingSources` defaults to `[]` (no settings loaded) | Without explicit `settingSources: ["project"]`, CLAUDE.md files are NOT loaded | Must always include `settingSources: ["project"]` in query options. |
| `maxTurns` limit may prevent `Stop` hooks from firing | "Hooks may not fire when the agent hits the max_turns limit because the session ends before hooks can execute" | Stall timer cleanup must also happen in the `finally` block of `runAgentStep()`, not only in Stop hooks. |
| `bypassPermissions` is inherited by all subagents and cannot be overridden | Subagents spawned by the Agent tool get full permissions automatically | Acceptable for autopilot (we want full autonomy). Document for awareness. |
| Result message `errors` field only present on error subtypes | Success results have `result` (text). Error results have `errors` (string array) but no `result`. | Check `subtype` before accessing fields. `resultMsg.subtype === "success" ? resultMsg.result : resultMsg.errors.join('\n')` |
| Session files stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` | CWD must be consistent for session discovery to work | Always pass `cwd: PROJECT_DIR` explicitly. |
| `SDKAssistantMessage.message` is an Anthropic `BetaMessage` object | Content is in `message.message.content[]` -- note double `.message` nesting | `message.message?.content` for content blocks as shown in design doc. |
| Hook `matcher` is regex, not glob | `".*"` matches all tools, not `"*"` | Use `".*"` for catch-all matchers in stall detection hooks. |
| Multiple hooks on same event execute in array order; deny overrides allow | If any hook returns deny, operation is blocked regardless of other hooks | Only one hook per event type needed for our use case (stall detection). |
| `compact_boundary` system messages indicate context compaction | Long-running sessions may auto-compact, losing earlier context | Each autopilot step is a fresh query -- compaction should not occur within a single step at normal turn counts. If it does, it indicates the step is too large. |

## Sources

- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- Architecture, capabilities, comparison to CLI (HIGH confidence)
- [Agent SDK reference - TypeScript](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Complete API reference: query(), Options, message types, hook types (HIGH confidence)
- [Hooks guide](https://platform.claude.com/docs/en/agent-sdk/hooks) -- Hook lifecycle, matchers, callbacks, output format, common patterns (HIGH confidence)
- [Sessions guide](https://platform.claude.com/docs/en/agent-sdk/sessions) -- Session persistence, resume, fork, continue, cross-host (HIGH confidence)
- [Permissions guide](https://platform.claude.com/docs/en/agent-sdk/permissions) -- Permission modes, evaluation order, allowedTools vs disallowedTools (HIGH confidence)
- [TypeScript V2 preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview) -- V2 interface status (preview/unstable) (MEDIUM confidence -- not directly verified)

---
*Feature research for: Claude Agent SDK migration (autopilot.mjs v3.2)*
*Researched: 2026-03-24*
