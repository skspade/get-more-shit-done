# Pitfalls Research

**Domain:** CLI subprocess spawning to Claude Agent SDK migration (autopilot.mjs)
**Researched:** 2026-03-24
**Confidence:** HIGH (verified against official SDK docs, GitHub issues, TypeScript SDK reference)

## Critical Pitfalls

### Pitfall 1: Missing `allowDangerouslySkipPermissions` Flag

**What goes wrong:**
Setting `permissionMode: "bypassPermissions"` without also setting `allowDangerouslySkipPermissions: true` causes every tool call to require approval. The agent hangs waiting for permission input that never comes in headless/autonomous mode. This is the single most reported issue in the SDK's GitHub tracker (issue #14279).

**Why it happens:**
The CLI uses a single flag (`--dangerously-skip-permissions`), but the SDK requires TWO separate settings. The naming is deliberately cumbersome as a safety guard. Developers assume `permissionMode: "bypassPermissions"` is sufficient because the CLI only needed one flag.

**How to avoid:**
Always pair the two settings together:
```javascript
{
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true,
}
```
Add a unit test that verifies the options object passed to `query()` always includes both when bypass mode is intended. The design document already shows this correctly -- the risk is during implementation if someone copies partial config.

**Warning signs:**
- Tool calls return `"This command requires approval"` errors
- Agent completes with 0 turns but non-zero cost (init cost without any work)
- `permission_denials` array on `ResultMessage` is non-empty

**Phase to address:**
Phase 1 (core `runAgentStep()` implementation). Must be correct from the first working call.

---

### Pitfall 2: System Prompt and Settings Sources Not Loaded by Default

**What goes wrong:**
The agent runs but ignores CLAUDE.md instructions, custom slash commands, project settings.json rules, and .claude/settings.json allow rules. GSD workflows depend heavily on CLAUDE.md for project conventions and slash commands for phase operations. Without these, the agent produces correct output structurally but violates project conventions.

**Why it happens:**
Breaking change in Agent SDK v0.1.0: the SDK no longer loads filesystem settings by default and no longer uses Claude Code's system prompt by default. This was an intentional isolation decision for SDK applications. Developers migrating from CLI assume the same environment applies.

**How to avoid:**
Always include both settings:
```javascript
{
  systemPrompt: { type: "preset", preset: "claude_code" },
  settingSources: ["project"],
}
```
The design document correctly specifies `settingSources: ["project"]` and the system prompt preset. The risk is:
1. Using `settingSources: ["user", "project", "local"]` when you only want project settings (user settings may contain unexpected allow/deny rules on the developer's machine).
2. Omitting `settingSources` entirely if a developer refactors the options object and drops it.
3. Passing a custom string as `systemPrompt` instead of the preset, losing Claude Code's built-in tool-use instructions and behaviors.

**Warning signs:**
- Agent does not recognize GSD slash commands
- Agent ignores conventions from CLAUDE.md (commit message style, file patterns)
- Agent asks clarifying questions instead of following project instructions
- `slash_commands` array in `SystemMessage` init is empty

**Phase to address:**
Phase 1. Configuration structure must be correct at the options-building layer.

---

### Pitfall 3: Exit Code vs Result Subtype Semantic Mismatch

**What goes wrong:**
The current autopilot treats exit codes as the primary success/failure signal: `exitCode === 0` means success, non-zero means failure, `130` means SIGINT. The SDK does not return exit codes. It returns `ResultMessage` with a `subtype` field. Naively mapping `subtype !== "success"` to `exitCode = 1` loses critical information about WHY the step failed and whether it is recoverable.

**Why it happens:**
The current `runClaudeStreaming()` returns `{ exitCode, stdout }`. The design's `runAgentStep()` synthesizes an exit code from the result subtype. But different subtypes demand different handling:
- `error_max_turns`: The agent did useful work but ran out of turns. Progress was made. The circuit breaker should NOT count this as zero-progress.
- `error_max_budget_usd`: Cost cap hit. Different from a crash.
- `error_during_execution`: An API failure or process crash. This IS analogous to a non-zero exit.
- `success`: Direct analog to exit code 0.
- `error_max_structured_output_retries`: Not relevant here (no structured output used).

Treating all non-success subtypes identically causes:
1. Debug retry loops wasting retries on budget/turn limits (not fixable by debugging)
2. Circuit breaker false positives (maxTurns hit after productive work counts as "no progress")
3. Loss of cost-cap enforcement intent (budget exceeded should escalate, not debug-retry)

**How to avoid:**
Replace the synthesized `exitCode` return with the actual subtype:
```javascript
return {
  subtype: resultMsg?.subtype || "error_during_execution",
  resultText,
  costUsd: resultMsg?.total_cost_usd,
  numTurns: resultMsg?.num_turns,
};
```
Then update callers to switch on subtype:
- `success` -> continue normally
- `error_max_turns` -> log warning, may still have made progress, do NOT debug-retry
- `error_max_budget_usd` -> escalate to human, do NOT debug-retry
- `error_during_execution` -> debug-retry (this is the actual error case)

**Warning signs:**
- Debug retries triggered immediately after an agent that did extensive work
- "Budget limit hit" appearing in error context passed to the debugger
- Autopilot running debug retries 3 times then halting on what was actually a successful-but-capped run

**Phase to address:**
Phase 1 (return type design) and Phase 2 (caller updates). The return type must be designed correctly BEFORE updating callers.

---

### Pitfall 4: Orphaned Claude Processes on SIGINT/SIGTERM

**What goes wrong:**
When the autopilot receives SIGINT (Ctrl-C) or SIGTERM, the current code cleans up temp files and prints a resume message. But the SDK spawns a Claude Code subprocess internally. If the parent process exits without explicitly aborting the SDK query, the Claude subprocess becomes orphaned and continues running, consuming 50-100MB RAM each. Over time with repeated Ctrl-C interruptions, dozens of orphans accumulate (issue #142, still open as of Jan 2026).

**Why it happens:**
The current autopilot's `$` template literal (zx) creates a child process that is killed when the parent exits because zx handles this. The SDK manages its own subprocess but has no built-in parent-death cleanup. The `AbortController` only works if the parent process is alive to call `abort()`. On SIGKILL or hard crashes, there is no cleanup at all.

**How to avoid:**
1. Store a reference to the `AbortController` used by each `query()` call in module-level state.
2. In SIGINT/SIGTERM handlers, call `controller.abort()` before `process.exit()`.
3. Use the `Query.close()` method if available (it forcefully ends the query and cleans up resources).
4. Consider a periodic cleanup sweep as a defensive measure.

```javascript
let activeAbortController = null;

process.on('SIGINT', () => {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  cleanupTemp();
  // ... existing resume message ...
  process.exit(130);
});
```

**Warning signs:**
- `ps aux | grep claude` shows multiple claude processes after Ctrl-C
- Memory usage grows over repeated autopilot runs
- Port conflicts or file lock issues from zombie claude processes

**Phase to address:**
Phase 1. Signal handler updates must happen in the same phase as the `runAgentStep()` implementation. Cannot be deferred.

---

### Pitfall 5: `allowedTools` Does NOT Restrict Tools in `bypassPermissions` Mode

**What goes wrong:**
The design document specifies:
```javascript
allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"],
```
Developers assume this RESTRICTS the agent to only these tools. In `bypassPermissions` mode, `allowedTools` is purely additive -- it only pre-approves listed tools. Unlisted tools are NOT blocked; they fall through to the permission mode, where `bypassPermissions` approves everything. The agent can use ANY tool including `TodoWrite`, `Skill`, `AskUserQuestion`, and MCP tools.

**Why it happens:**
The mental model from other APIs (OpenAI function calling, etc.) is that a tools list restricts what's available. The SDK docs explicitly warn: "`allowed_tools` does not constrain `bypassPermissions`. Every tool is approved, not just the ones you listed."

**How to avoid:**
If you want to restrict tools in bypass mode, use `disallowedTools` to explicitly block what you do NOT want:
```javascript
{
  permissionMode: "bypassPermissions",
  allowDangerouslySkipPermissions: true,
  disallowedTools: ["AskUserQuestion"], // Block interactive prompts in autonomous mode
}
```
For the autopilot, `AskUserQuestion` is particularly dangerous: if the agent tries to ask a question, it will hang waiting for input that never comes (no TTY, stdin was /dev/null). Block it explicitly with `disallowedTools`.

Alternatively, use `permissionMode: "dontAsk"` with `allowedTools` for a strict whitelist. `dontAsk` denies anything not in the allowed list. But this requires testing that all GSD workflows function correctly without tools that might be implicitly needed.

**Warning signs:**
- Agent spawns `AskUserQuestion` during autonomous execution and hangs
- Agent uses `TodoWrite` or `Skill` tools unexpectedly
- Agent calls MCP tools you didn't configure (from settings.json if loaded)

**Phase to address:**
Phase 1. Must decide the permission strategy (bypass + disallowedTools vs. dontAsk + allowedTools) before implementing `runAgentStep()`.

---

### Pitfall 6: `result` Field Only Exists on Success Subtype

**What goes wrong:**
The `SDKResultMessage` is a discriminated union. The `result` (final text output) field only exists on the `success` variant. On error variants (`error_max_turns`, `error_during_execution`, etc.), accessing `resultMsg.result` returns `undefined`. If the code does `resultText = resultMsg?.result || ""`, it silently works but the debug retry system receives empty error context because the agent's last output is not captured.

**Why it happens:**
The current code captures stdout from the CLI process, which always has output regardless of exit code. The SDK separates "result text" (only on success) from the message stream (always available). The actual output text is in the `AssistantMessage` objects yielded during iteration, not in the `ResultMessage`.

**How to avoid:**
Capture the last assistant text from the message stream, not from the result:
```javascript
let lastAssistantText = "";
for await (const message of query({...})) {
  if (message.type === "assistant") {
    const textBlocks = (message.message?.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text);
    if (textBlocks.length > 0) {
      lastAssistantText = textBlocks.join("");
    }
  }
  if (message.type === "result") {
    resultText = message.subtype === "success" ? message.result : lastAssistantText;
  }
}
```

**Warning signs:**
- Debug retry prompts have empty `<errors>` section
- `constructDebugPrompt()` receives "No output captured" when the agent actually produced output
- Output file for debug context is empty despite the agent having run for many turns

**Phase to address:**
Phase 1 (`handleMessage` implementation). The message capture logic must accumulate assistant text throughout the session.

---

### Pitfall 7: ~12s Cold Start Overhead Per `query()` Call

**What goes wrong:**
Every `query()` call spawns a fresh Claude Code subprocess. This has a consistent ~12 second startup overhead (issue #34). The autopilot makes 4+ `query()` calls per phase (discuss, plan, execute, verify), with up to 10+ phases per milestone. That is 40-120+ calls, adding 8-24 MINUTES of pure startup overhead per milestone run.

**Why it happens:**
The SDK spawns a new process for every `query()` call (unlike the CLI which also spawns a new process per invocation). This is architecturally intentional for isolation, but the overhead is significant for sequential workflows.

**How to avoid:**
This is a known limitation that was partially addressed by streaming input mode (sessions). However, the autopilot design intentionally uses separate `query()` calls per step to get fresh context windows -- this is a FEATURE, not a bug. Each GSD phase needs a clean context to prevent context rot across phases.

Mitigation strategies:
1. Accept the overhead. 12s per call across 50 calls = 10 minutes of overhead. The alternative (context rot) is worse.
2. Do NOT try to use sessions to reuse processes across phases -- the fresh context is critical.
3. Consider batching where possible: if discuss + plan can be a single prompt, that saves one cold start. But this violates the current architecture's isolation guarantees.
4. Log the overhead so it is visible in timing reports. Users should know "12s of that 5-minute phase was startup."

**Warning signs:**
- Autopilot wall-clock time significantly exceeds expected API time
- `duration_ms` vs `duration_api_ms` in ResultMessage shows large gaps
- Users complain about autopilot being "slow" even on simple milestones

**Phase to address:**
Phase 1 (acknowledge and document). Not a bug to fix but a tradeoff to accept and communicate. Add startup overhead to timing logs.

---

### Pitfall 8: Hook `continue: false` Silently Ignored

**What goes wrong:**
The design document uses `PostToolUse` hooks for stall detection. If a hook returns `{ continue: false }` to stop the agent, the CLI subprocess may silently ignore this signal (issue #29991, open). The agent continues running despite the hook's instruction to stop.

**Why it happens:**
The SDK communicates hook results to the CLI subprocess via a JSON control protocol. The `continue: false` field in `PostToolUse` responses is documented to stop execution, but the CLI may not honor it in all code paths. This is a known bug.

**How to avoid:**
Do NOT rely on `continue: false` for critical safety stops. The stall detection design in the migration doc uses hooks for WARNINGS only (logging, stderr output) -- this is correct and safe. If you need to actually STOP a stalled agent:
1. Use `maxTurns` as the hard stop (always honored).
2. Use `maxBudgetUsd` as a cost-based hard stop (always honored).
3. For emergency kills, use the `AbortController` from outside the hook.
4. The stall timer pattern (setTimeout with warnings) is fine because it only emits warnings; the actual kill comes from maxTurns or budget limits.

**Warning signs:**
- Stall detection warnings appear but agent continues running indefinitely
- Hook fires correctly (verified via logging) but agent doesn't stop
- Agent exceeds expected turn count despite hooks returning `continue: false`

**Phase to address:**
Phase 2 (hook implementation). Design hooks for observability (logging, warnings), not for control flow. Use maxTurns/maxBudgetUsd for hard limits.

---

### Pitfall 9: Stall Timer Lifecycle Mismatch

**What goes wrong:**
The current stall detection uses `armStallTimer()` called on each NDJSON line received from the streaming CLI. The migration design replaces this with a `PostToolUse` hook. But tool-use hooks only fire AFTER a tool completes. If the agent is "thinking" (generating a long text response with no tool calls), no `PostToolUse` hooks fire and the stall timer from the initial `armStallTimer()` call eventually triggers a false stall warning.

The current NDJSON streaming fires on EVERY output line including assistant text tokens, so stalls are only detected when there is truly no output at all. The SDK hooks are coarser-grained -- they fire per tool completion, not per token.

**Why it happens:**
Granularity difference: NDJSON lines arrive every few hundred milliseconds during active generation. PostToolUse hooks fire only when a tool round-trip completes (could be minutes apart during long Bash commands or file reads). The stall detection interval (5 minutes default) may be fine for the hook granularity, but edge cases exist:
- A very long `npm install` that takes 6 minutes with no tool completion would trigger a false stall warning.
- A thinking-heavy response with no tool calls would never re-arm the timer.

**How to avoid:**
Two approaches:
1. Keep the 5-minute default but make it generous enough to cover slow tool calls. 5 minutes is already generous; increase to 10 minutes if needed.
2. Add an `AssistantMessage` check in the message iteration loop (not just hooks) to re-arm the timer when any message is received:
```javascript
for await (const message of query({...})) {
  armStallTimer(); // Re-arm on ANY message, not just PostToolUse
  handleMessage(message, { quiet, outputFile });
}
```
This restores the current behavior's granularity while keeping hooks for additional observability.

**Warning signs:**
- False stall warnings during legitimate long-running operations
- Stall warning followed immediately by tool completion
- No stall warnings ever (timer not being armed correctly)

**Phase to address:**
Phase 2 (stall detection migration). The message-loop-based re-arm is simpler and more correct than hook-only stall detection.

---

### Pitfall 10: `message.message.content` vs `message.content` Confusion

**What goes wrong:**
In the TypeScript SDK, `AssistantMessage` and `UserMessage` wrap the raw API message in a `.message` field. Content blocks are at `message.message.content`, NOT `message.content`. Writing `message.content` compiles without error (TypeScript structural typing may allow it or it returns undefined), producing silent data loss where assistant text is never displayed.

**Why it happens:**
The CLI streaming mode returns flat NDJSON events where `event.message.content` is the content array. The SDK wraps this in another layer. The current `displayStreamEvent()` uses `event.message?.content` which happens to be the correct path for both CLI events and SDK messages -- but this is coincidental. If the migration changes the variable name or destructures differently, the path can break.

**How to avoid:**
The design document's `handleMessage()` already uses the correct path:
```javascript
const content = message.message?.content || [];
```
This is correct. The risk is during refactoring. Add a type assertion or runtime check:
```javascript
if (message.type === "assistant" && !message.message?.content) {
  console.error("WARNING: AssistantMessage has no content -- possible SDK version mismatch");
}
```

**Warning signs:**
- Agent runs but produces no visible output
- Output file is empty despite agent completing successfully
- `handleMessage` processes messages but nothing appears on stdout

**Phase to address:**
Phase 1 (`handleMessage` implementation). Test with actual SDK output early.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Synthesizing exit codes from result subtypes | Minimal caller changes | Loses subtype information, wrong debug-retry behavior | Never -- use subtypes directly |
| Skipping `disallowedTools` configuration | Faster initial implementation | `AskUserQuestion` can hang autonomous agent | Never -- block interactive tools from day 1 |
| Using `settingSources: ["user", "project", "local"]` | "Gets everything" | User-level settings vary across machines, non-reproducible behavior | Only if cross-machine consistency not needed |
| Not storing AbortController reference | Simpler code | Orphaned processes on SIGINT | Never -- always store and abort on signal |
| Keeping stall detection only in hooks | Cleaner separation of concerns | False stall warnings during thinking-heavy turns | Only if stall timeout is very generous (15+ min) |

## Integration Gotchas

Common mistakes when connecting the Agent SDK to the existing autopilot infrastructure.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Circuit breaker | Treating `error_max_turns` as zero-progress | Check if turns > 0 and artifacts changed before counting as no-progress |
| Debug retry | Retrying on `error_max_budget_usd` | Budget exceeded is an escalation, not a retryable error |
| Output capture | Reading `result` field on error subtypes | Accumulate `AssistantMessage` text during iteration for error context |
| Temp file logging | Using `fs.appendFileSync(outputFile, line)` with SDK messages | Use `JSON.stringify(message)` since SDK messages are objects, not strings |
| Quiet mode | Suppressing all messages including result | Always process `ResultMessage` even in quiet mode to capture exit status |
| MCP servers | Passing MCP config for all steps | Only pass Chrome MCP for UAT steps; other steps pay context-window cost for unused tool schemas |
| Verification gate | Expecting exit code 10 for gaps_found | SDK has no concept of exit code 10; check verification status via `getVerificationStatus()` after step completes (current behavior, unchanged) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold start per query() | ~12s overhead x N steps = minutes of idle time | Accept and document; fresh context is worth the cost | Always present, ~10 min overhead per milestone |
| MCP server startup per step | Each step with MCP servers pays server init cost | Only attach MCP servers to steps that need them | Noticeable when UAT steps are frequent |
| Message accumulation in memory | Storing all messages for output capture | Only keep last N messages or stream to file | Steps with 200+ turns and large tool outputs |
| Hook timeout defaults | 60s default timeout may be too short for complex hook logic | Keep hooks fast; use async mode for side-effects | Hooks doing HTTP requests or file I/O |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Permission mode:** `bypassPermissions` set -- verify `allowDangerouslySkipPermissions: true` is ALSO set
- [ ] **System prompt:** Custom or empty -- verify `systemPrompt: { type: "preset", preset: "claude_code" }` is set for full Claude Code behavior
- [ ] **Settings sources:** Working locally -- verify `settingSources: ["project"]` is set so CLAUDE.md loads
- [ ] **Signal handling:** SIGINT handler exists -- verify it calls `abort()` on active AbortController, not just cleanup
- [ ] **Result handling:** Success path works -- verify error subtypes return useful error context (not empty string)
- [ ] **Stall detection:** Timer arms on query start -- verify it re-arms on message receipt, not only on PostToolUse hooks
- [ ] **Output file:** Messages written to file -- verify `JSON.stringify(message)` is used (objects not strings)
- [ ] **Tool restriction:** `allowedTools` configured -- verify `AskUserQuestion` is in `disallowedTools` for autonomous mode
- [ ] **Quiet mode:** Output suppressed -- verify `ResultMessage` is still processed for exit status and cost tracking
- [ ] **Cost tracking:** `total_cost_usd` logged -- verify it is accessed from `ResultMessage` (always present) not from `AssistantMessage`

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing allowDangerouslySkipPermissions | LOW | Add the flag; no state corruption, just wasted time |
| Missing settingSources | LOW | Add the option; re-run affected steps |
| Exit code mapping wrong | MEDIUM | Refactor return type and all callers; may need to re-test retry logic |
| Orphaned processes | LOW | `pkill -f "claude.*stream-json"`; add AbortController cleanup |
| allowedTools not restricting | LOW | Add disallowedTools; no harm done if agent didn't use unwanted tools |
| result field undefined | MEDIUM | Add message accumulation in handleMessage; re-test debug retry flow |
| Cold start overhead | NONE | Not recoverable; architectural. Accept and document |
| Hook continue:false ignored | LOW | Switch to maxTurns-based hard stops; hooks remain for observability |
| Stall timer false positives | LOW | Move timer re-arm to message loop; adjust timeout if needed |
| message.message.content confusion | LOW | Fix the property path; add runtime assertion |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Missing allowDangerouslySkipPermissions | Phase 1 (core SDK integration) | Test: query() completes with tool calls; no permission_denials |
| Missing settingSources/systemPrompt | Phase 1 (options configuration) | Test: SystemMessage init shows slash_commands and tools |
| Exit code vs subtype mismatch | Phase 1 (return type) + Phase 2 (callers) | Test: error_max_turns does not trigger debug retry |
| Orphaned processes on SIGINT | Phase 1 (signal handler update) | Manual test: Ctrl-C during active query, verify no orphan via `ps` |
| allowedTools not restricting | Phase 1 (permission strategy) | Test: disallowedTools includes AskUserQuestion |
| result field undefined on error | Phase 1 (message accumulation) | Test: debug retry receives non-empty error context on failure |
| Cold start overhead | Phase 1 (documentation) | Log: timing shows startup vs API time breakdown |
| Hook continue:false ignored | Phase 2 (hook design) | Design review: hooks only emit warnings, maxTurns is hard stop |
| Stall timer lifecycle | Phase 2 (stall detection) | Test: no false stall warning during 3-minute Bash command |
| message.message.content | Phase 1 (handleMessage) | Test: assistant text appears on stdout during streaming |

## Sources

- [Claude Agent SDK TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Options type, SDKResultMessage union, Query object
- [Agent SDK migration guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide) -- Breaking changes: systemPrompt default, settingSources default
- [Agent SDK permissions](https://platform.claude.com/docs/en/agent-sdk/permissions) -- Permission evaluation order, bypassPermissions behavior, allowedTools warning
- [Agent SDK hooks](https://platform.claude.com/docs/en/agent-sdk/hooks) -- PostToolUse hooks, hook timing, continue:false behavior, common issues
- [Agent SDK agent loop](https://platform.claude.com/docs/en/agent-sdk/agent-loop) -- Message types, result subtypes, turns and budget, context window
- [Issue #14279: Tool execution requires approval despite bypassPermissions](https://github.com/anthropics/claude-code/issues/14279) -- Permission flag gotcha
- [Issue #142: Auto-terminate spawned processes (orphan prevention)](https://github.com/anthropics/claude-agent-sdk-typescript/issues/142) -- No built-in cleanup, orphan accumulation
- [Issue #34: ~12s overhead per query() call](https://github.com/anthropics/claude-agent-sdk-typescript/issues/34) -- Cold start architectural limitation
- [Issue #29991: PostToolUse hook continue:false silently ignored](https://github.com/anthropics/claude-code/issues/29991) -- Hook control flow bug
- [Agent SDK quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) -- Basic usage patterns, message handling

---
*Pitfalls research for: autopilot.mjs Agent SDK migration*
*Researched: 2026-03-24*
