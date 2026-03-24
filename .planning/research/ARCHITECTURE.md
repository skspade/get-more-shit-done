# Architecture Research

**Domain:** Agent SDK migration -- replacing CLI subprocess spawning with SDK `query()` in autopilot.mjs
**Researched:** 2026-03-24
**Confidence:** HIGH

## System Overview

```
                          autopilot.mjs (ESM / zx)
  ┌─────────────────────────────────────────────────────────────┐
  │                      Main Phase Loop                        │
  │  getPhaseStep() -> discuss/plan/execute/verify/complete     │
  ├─────────────────────────────────────────────────────────────┤
  │  Step Execution Layer                                       │
  │  ┌──────────┐  ┌────────────────┐  ┌────────────────────┐  │
  │  │ runStep  │  │ runStepCaptured│  │ runStepWithRetry   │  │
  │  │ (simple) │  │ (with output   │  │ (debug retry loop) │  │
  │  │          │  │  capture)      │  │                    │  │
  │  └────┬─────┘  └───────┬────────┘  └────────┬───────────┘  │
  │       │                │                     │              │
  │       └────────────────┴─────────────────────┘              │
  │                        │                                    │
  │              ┌─────────┴──────────┐                         │
  │              │   runAgentStep()   │  <-- NEW (replaces      │
  │              │   wraps SDK query  │      runClaudeStreaming) │
  │              └─────────┬──────────┘                         │
  │                        │                                    │
  ├────────────────────────┼────────────────────────────────────┤
  │  SDK Integration       │                                    │
  │              ┌─────────┴──────────┐                         │
  │              │  query() from      │                         │
  │              │  @anthropic-ai/    │                         │
  │              │  claude-agent-sdk  │                         │
  │              └─────────┬──────────┘                         │
  │                        │ spawns internally                  │
  │              ┌─────────┴──────────┐                         │
  │              │  Claude Code       │                         │
  │              │  subprocess        │                         │
  │              │  (same auth)       │                         │
  │              └────────────────────┘                         │
  ├─────────────────────────────────────────────────────────────┤
  │  CJS Module Layer (unchanged)                               │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
  │  │ phase.cjs│ │verify.cjs│ │config.cjs│ │validation.cjs│  │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
  │  ┌──────────┐                                              │
  │  │ core.cjs │                                              │
  │  └──────────┘                                              │
  ├─────────────────────────────────────────────────────────────┤
  │  Shell Layer (unchanged)                                    │
  │  ┌──────────────────┐  ┌──────────────────────────────┐    │
  │  │ gsdTools()       │  │ takeProgressSnapshot()       │    │
  │  │ (zx $ -> node    │  │ (zx $ -> git, find)          │    │
  │  │  gsd-tools.cjs)  │  │                              │    │
  │  └──────────────────┘  └──────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `runAgentStep()` | Wraps SDK `query()` with project-specific options: cwd, permissions, hooks, maxTurns, maxBudgetUsd, MCP servers. Returns `{ exitCode, stdout, costUsd }` | NEW -- replaces `runClaudeStreaming()` |
| `handleMessage()` | Processes SDK typed messages: assistant text to stdout, tool indicators to stderr, result logging | NEW -- replaces `displayStreamEvent()` |
| `buildStepHooks()` | Constructs SDK hook configuration with PostToolUse stall timer and Stop cleanup | NEW -- replaces custom `armStallTimer()` inside `runClaudeStreaming` |
| `runStep()` | Thin wrapper adding banners, progress snapshots, circuit breaker checks | MODIFIED -- internal call changes from `runClaudeStreaming()` to `runAgentStep()` |
| `runStepCaptured()` | Like `runStep` but captures output to temp file for debug retry | MODIFIED -- same internal call change |
| `runStepWithRetry()` | Debug retry loop with `MAX_DEBUG_RETRIES` | MODIFIED -- debug invocation changes |
| `runVerifyWithDebugRetry()` | Verify-specific retry loop with gap detection | MODIFIED -- same pattern |
| CJS imports (`phase.cjs`, `verify.cjs`, etc.) | State reading, phase navigation, config defaults | UNCHANGED |
| `gsdTools()` | Shell-out to `node gsd-tools.cjs` via zx `$` | UNCHANGED |
| Main loop, signal handlers, circuit breaker | Phase lifecycle orchestration | UNCHANGED |

## Integration Points

### Import Changes

```javascript
// ADD -- single new import
import { query } from "@anthropic-ai/claude-agent-sdk";

// REMOVE -- no longer needed for Claude invocation
// (createInterface stays for askTTY())

// KEEP -- all existing imports unchanged
import { createRequire } from 'module';
import { createInterface } from 'readline';
import os from 'os';
import path from 'path';
import fs from 'fs';
```

**Confidence: HIGH** -- Verified from official TypeScript SDK reference. The SDK exports `query` as a named export from `@anthropic-ai/claude-agent-sdk`. ESM `import` works directly; no CJS interop needed for the SDK itself.

### Module Boundary Preservation

The architecture preserves the existing module boundary cleanly:

| Layer | Module System | Purpose | Changes |
|-------|---------------|---------|---------|
| autopilot.mjs | ESM (zx) | Orchestration, SDK calls | `query()` replaces CLI subprocess |
| phase.cjs, verify.cjs, etc. | CJS via `createRequire()` | State reading | None |
| gsd-tools.cjs | CJS (invoked via zx `$`) | State writing, frontmatter | None |
| @anthropic-ai/claude-agent-sdk | ESM (published as ESM) | Claude invocation | New dependency |

The SDK is published as ESM, making it a natural fit for the `.mjs` file. The `createRequire()` pattern for CJS imports is unaffected.

**Confidence: HIGH** -- The npm package uses `"type": "module"` with ESM exports. The existing `createRequire()` pattern for CJS modules is a standard Node.js approach that is orthogonal to SDK usage.

### New Core Function: `runAgentStep()`

```javascript
async function runAgentStep(prompt, { outputFile, quiet, maxTurns, maxBudgetUsd, mcpServers } = {}) {
  const messages = [];

  for await (const message of query({
    prompt,
    options: {
      cwd: PROJECT_DIR,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: maxTurns || getConfig('autopilot.max_turns_per_step', 200),
      maxBudgetUsd: maxBudgetUsd || getConfig('autopilot.max_budget_per_step_usd', undefined),
      mcpServers: mcpServers || {},
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep",
                     "Agent", "WebSearch", "WebFetch"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      settingSources: ["project"],
      hooks: buildStepHooks(outputFile),
    },
  })) {
    messages.push(message);
    handleMessage(message, { quiet, outputFile });
  }

  const resultMsg = messages.find(m => m.type === "result");
  const exitCode = resultMsg?.subtype === "success" ? 0 : 1;
  const resultText = resultMsg?.result || "";

  return { exitCode, stdout: resultText, costUsd: resultMsg?.total_cost_usd };
}
```

**Key decisions verified against SDK docs:**

| Option | Value | Rationale | Confidence |
|--------|-------|-----------|------------|
| `permissionMode: "bypassPermissions"` | Matches current `--dangerously-skip-permissions` | SDK docs: "Runs all allowed tools without asking" | HIGH |
| `allowDangerouslySkipPermissions: true` | Required when using `bypassPermissions` | SDK docs: "Required when using permissionMode: 'bypassPermissions'" | HIGH |
| `systemPrompt: { type: "preset", preset: "claude_code" }` | Gets Claude Code's full system prompt | SDK docs: "use Claude Code's system prompt" | HIGH |
| `settingSources: ["project"]` | Loads CLAUDE.md from project directory | SDK docs: "Must include 'project' to load CLAUDE.md files" | HIGH |
| `maxTurns` | Per-step configurable | SDK counts tool-use round trips only | HIGH |
| `maxBudgetUsd` | Per-step configurable, defaults to `undefined` (no cap) | SDK returns `error_max_budget_usd` result subtype when exceeded | HIGH |
| `allowedTools` | Auto-approves listed tools | SDK docs: "does not restrict Claude to only these tools; unlisted tools fall through to permissionMode" | HIGH |

### Async Iterator Consumption

The SDK's `query()` returns a `Query` object extending `AsyncGenerator<SDKMessage, void>`. The `for await...of` loop is the standard consumption pattern:

```javascript
for await (const message of query({ prompt, options })) {
  // message is one of: SDKAssistantMessage, SDKUserMessage, SDKResultMessage,
  //                     SDKSystemMessage, SDKPartialAssistantMessage, etc.
}
```

**Process lifecycle:** The loop completes when either:
1. Claude finishes the task (yields `ResultMessage` with `subtype: "success"`)
2. `maxTurns` limit is hit (yields `ResultMessage` with `subtype: "error_max_turns"`)
3. `maxBudgetUsd` limit is hit (yields `ResultMessage` with `subtype: "error_max_budget_usd"`)
4. An error occurs (yields `ResultMessage` with `subtype: "error_during_execution"`)

The `Query` object also exposes `close()` for forceful termination, though autopilot should not need it (SIGINT handler covers interruption).

**Confidence: HIGH** -- Verified from SDK TypeScript reference: `SDKResultMessage` type shows exact subtypes and fields. The `result` field exists only on the `success` variant.

### Hook Wiring for Stall Detection

The SDK provides `PostToolUse` hooks that fire after each tool completes. This replaces the NDJSON-line-based stall timer:

```javascript
function buildStepHooks(outputFile) {
  const stallTimeout = getConfig('autopilot.stall_timeout_ms', 300000);
  let stallTimer = null;
  let stallCount = 0;

  function armStallTimer() {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(function onStall() {
      stallCount++;
      const mins = (stallTimeout * stallCount) / 60000;
      process.stderr.write(`Warning: No tool activity for ${mins} minutes\n`);
      logMsg(`STALL WARNING: no tool activity for ${mins} minutes`);
      stallTimer = setTimeout(onStall, stallTimeout);
      stallTimer.unref();
    }, stallTimeout);
    stallTimer.unref();
  }

  const stallHook = async () => {
    armStallTimer();
    return {};
  };

  armStallTimer();

  return {
    PostToolUse: [{ hooks: [stallHook] }],
    Stop: [{ hooks: [async () => {
      if (stallTimer) clearTimeout(stallTimer);
      return {};
    }] }],
  };
}
```

**Hook API details verified:**

| Aspect | SDK Behavior | Confidence |
|--------|-------------|------------|
| `PostToolUse` fires after every tool execution | Yes -- "Tool execution result" | HIGH |
| No matcher means all tools | Yes -- "omitting the pattern runs your callbacks for every occurrence" | HIGH |
| Returning `{}` allows the operation | Yes -- "Return {} to allow the operation without changes" | HIGH |
| `Stop` fires when agent finishes | Yes -- "Agent execution stop" | HIGH |
| Hook callback receives `(input, toolUseID, { signal })` | Yes -- TypeScript SDK reference confirms 3-arg signature | HIGH |
| Hooks can be async but don't need to modify agent | Yes -- async return is optional, side-effect hooks return `{}` | HIGH |

### Process Signal Handling (SIGINT/SIGTERM)

The existing signal handlers in autopilot.mjs intercept SIGINT and SIGTERM to:
1. Clean up temp files
2. Print resume instructions
3. Exit with appropriate code (130 for SIGINT, 0 for SIGTERM)

**Interaction with SDK `query()`:** The SDK spawns a Claude Code subprocess internally. When the parent process (autopilot.mjs) receives SIGINT:
- Node.js propagates SIGINT to the process group by default
- The SDK's subprocess will be terminated
- The `for await` loop will either: (a) receive a `ResultMessage` with `error_during_execution` if the SDK handles shutdown gracefully, or (b) throw an error that breaks the loop

The `Query` object has an `abortController` option for programmatic cancellation. For cleaner signal handling:

```javascript
// In the SIGINT handler, the query's close() method can force-terminate
// However, the current pattern (process.exit(130)) is sufficient since
// it kills the entire process tree

process.on('SIGINT', () => {
  cleanupTemp();
  // process.exit(130) terminates autopilot and all child processes
  // No special SDK cleanup needed -- the subprocess dies with the parent
  process.exit(130);
});
```

**Confidence: MEDIUM** -- The SDK docs state it manages its own subprocess, and the `Query.close()` method exists for cleanup. But the exact SIGINT propagation behavior through the SDK subprocess is not explicitly documented. The existing `process.exit()` pattern should work because killing the parent kills its children (Node.js default behavior for process groups). If edge cases arise, `abortController` can be wired into signal handlers.

## Data Flow

### Current Flow (CLI subprocess)

```
autopilot.mjs
    |
    v
zx $`claude -p --dangerously-skip-permissions --output-format stream-json ${prompt}`
    |
    v  (NDJSON lines via proc.stdout)
readline createInterface
    |
    v  (JSON.parse each line)
displayStreamEvent()  -->  stdout (assistant text), stderr (tool indicators)
    |
    v
{ exitCode: proc.exitCode, stdout: lines.join('\n') }
```

### New Flow (SDK query)

```
autopilot.mjs
    |
    v
query({ prompt, options: { cwd, permissionMode, hooks, maxTurns, ... } })
    |
    v  (async iterator of typed SDKMessage objects)
for await (const message of query(...))
    |
    v
handleMessage(message)  -->  stdout (assistant text), stderr (tool indicators)
    |                        logMsg (result cost/turns)
    |
    v  (PostToolUse hooks fire on each tool completion)
buildStepHooks()  -->  stall timer re-arm
    |
    v  (ResultMessage at end)
{ exitCode: 0|1, stdout: resultText, costUsd: total_cost_usd }
```

### Message Handling

```javascript
function handleMessage(message, { quiet, outputFile } = {}) {
  if (quiet || QUIET) return;

  switch (message.type) {
    case "assistant": {
      const content = message.message?.content || [];
      for (const block of content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        } else if (block.type === "tool_use") {
          process.stderr.write(`  * ${block.name}\n`);
        }
      }
      break;
    }
    case "system": {
      if (message.subtype === "init") {
        logMsg(`SESSION: id=${message.session_id} model=${message.model}`);
      }
      break;
    }
    case "result": {
      if (message.subtype === "success") {
        logMsg(`RESULT: success cost=$${message.total_cost_usd?.toFixed(4)} turns=${message.num_turns}`);
      } else {
        logMsg(`RESULT: ${message.subtype} cost=$${message.total_cost_usd?.toFixed(4)}`);
        if (message.subtype === "error_max_turns") {
          console.error("WARNING: Step hit maxTurns limit");
        } else if (message.subtype === "error_max_budget_usd") {
          console.error("WARNING: Step hit budget limit");
        }
      }
      break;
    }
    // Other message types (user, stream_event, etc.) are silently ignored
  }

  if (outputFile) {
    try {
      fs.appendFileSync(outputFile, JSON.stringify(message) + '\n');
    } catch {}
  }
}
```

**Output parity:** The visible output stays identical -- assistant text to stdout, tool names to stderr. The SDK provides typed objects instead of raw NDJSON lines, eliminating JSON.parse try/catch.

**New capability:** `ResultMessage` fields (`total_cost_usd`, `num_turns`, `duration_ms`) enable per-step cost/performance logging that was not previously available.

**Confidence: HIGH** -- `SDKAssistantMessage` wraps content in `message.message.content` (not `message.content`). This is explicitly documented: "AssistantMessage and UserMessage wrap the raw API message in a .message field."

## Call Site Mapping

Every Claude invocation in autopilot.mjs routes through `runClaudeStreaming()`. Here is the complete mapping:

| Location | Current Call | New Call | Notes |
|----------|-------------|----------|-------|
| `runStep()` line 365 | `runClaudeStreaming(prompt)` | `runAgentStep(prompt)` | Simple step |
| `runStepCaptured()` line 553 | `runClaudeStreaming(prompt, { outputFile })` | `runAgentStep(prompt, { outputFile })` | With output capture |
| `runStepWithRetry()` line 614 | `runClaudeStreaming(debugPrompt)` | `runAgentStep(debugPrompt, { maxTurns: TURNS_CONFIG.debug })` | Debug retry with lower maxTurns |
| `runVerifyWithDebugRetry()` line 658 | `runClaudeStreaming(debugPrompt)` | `runAgentStep(debugPrompt, { maxTurns: TURNS_CONFIG.debug })` | Verify debug retry |
| `runVerifyWithDebugRetry()` line 696 | `runClaudeStreaming(debugPrompt)` | `runAgentStep(debugPrompt, { maxTurns: TURNS_CONFIG.debug })` | Gap-fix debug retry |

All 5 call sites converge to the same `runAgentStep()` function.

## Step-Type Configuration

Per-step-type defaults for maxTurns and MCP servers:

```javascript
const TURNS_CONFIG = {
  discuss:    getConfig('autopilot.turns.discuss', 100),
  plan:       getConfig('autopilot.turns.plan', 150),
  execute:    getConfig('autopilot.turns.execute', 300),
  verify:     getConfig('autopilot.turns.verify', 100),
  debug:      getConfig('autopilot.turns.debug', 50),
  audit:      getConfig('autopilot.turns.audit', 100),
  uat:        getConfig('autopilot.turns.uat', 150),
  completion: getConfig('autopilot.turns.completion', 50),
};

const STEP_MCP_SERVERS = {
  'automated-uat': () => {
    const servers = {};
    if (getConfig('uat.chrome_mcp_enabled', true)) {
      servers['chrome-devtools'] = {
        command: 'npx',
        args: ['@anthropic-ai/chrome-devtools-mcp@latest'],
      };
    }
    return servers;
  },
  // Other steps: no MCP servers by default
};
```

**MCP server config format verified:**

```typescript
// SDK McpStdioServerConfig type
type McpStdioServerConfig = {
  type?: "stdio";    // optional, defaults to stdio
  command: string;
  args?: string[];
  env?: Record<string, string>;
};
```

**Confidence: HIGH** -- Exact type from SDK reference. The `type` field is optional for stdio, which is the default.

## Deleted Code

| Code | Lines | Reason |
|------|-------|--------|
| `displayStreamEvent()` | 213-226 | Replaced by `handleMessage()` with typed SDK messages |
| `runClaudeStreaming()` | 228-278 | Replaced by `runAgentStep()` wrapping SDK `query()` |
| `which('node')` check | 68-73 | SDK manages its own Node.js requirement internally |
| Quiet-mode CLI branch | Inside `runClaudeStreaming` | Handled by `handleMessage()` suppressing output when quiet flag is set |
| NDJSON readline parsing | Inside `runClaudeStreaming` | SDK provides typed message objects |
| `/dev/null` stdin redirect | `< /dev/null` in zx command | SDK handles its own I/O |

## Preserved Code (Unchanged)

| Code | Reason |
|------|--------|
| Main loop (`while (true)` with `getPhaseStep()`) | Phase lifecycle is orthogonal to invocation method |
| `runStep()`, `runStepCaptured()` | Thin wrappers -- only internal call changes |
| `runStepWithRetry()`, `runVerifyWithDebugRetry()` | Debug retry logic unchanged, inner call changes |
| `constructDebugPrompt()` | Returns a prompt string, which `query()` accepts directly |
| `writeFailureState()`, `clearFailureState()`, `writeFailureReport()` | State management via gsd-tools, unrelated to invocation |
| `askTTY()`, `runVerificationGate()`, `printVerificationGate()` | Terminal I/O for human gates, no Claude invocations |
| `runMilestoneAudit()`, `runAutomatedUAT()`, `runGapClosureLoop()` | Route through `runStepWithRetry()`, not direct Claude calls |
| `runMilestoneCompletion()` | Routes through `runStepWithRetry()` |
| Progress tracking (`takeProgressSnapshot()`, `checkProgress()`) | Operates on git/filesystem, not Claude output |
| Signal handlers (`SIGINT`, `SIGTERM`) | `process.exit()` terminates all children |
| All CJS imports via `createRequire()` | State reading layer, orthogonal to SDK |
| `gsdTools()` via zx `$` | Shell-out layer, orthogonal to SDK |
| Logging infrastructure | File-based, orthogonal to SDK |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Treating SDK Messages Like CLI Exit Codes

**What people do:** Map `resultMsg.subtype !== "success"` to the same error handling as CLI `exitCode !== 0`.
**Why it's wrong:** SDK result subtypes carry richer information. `error_max_turns` means the step was too complex (may need higher limit), while `error_during_execution` means something broke. These need different handling.
**Do this instead:** Check `subtype` explicitly:
```javascript
switch (resultMsg?.subtype) {
  case "success": return { exitCode: 0, ... };
  case "error_max_turns":
    logMsg("Step hit maxTurns -- consider increasing limit");
    return { exitCode: 1, ... };
  case "error_max_budget_usd":
    logMsg("Step hit budget cap");
    return { exitCode: 1, ... };
  case "error_during_execution":
    logMsg(`Execution error: ${resultMsg.errors?.join(', ')}`);
    return { exitCode: 1, ... };
}
```

### Anti-Pattern 2: Collecting All Messages in Memory for Long Steps

**What people do:** Push every message to an array for later processing.
**Why it's wrong:** Execute steps can run hundreds of turns with large tool outputs, consuming significant memory.
**Do this instead:** Process messages as they arrive. Only retain the `ResultMessage` (last message) for return value extraction. Write to `outputFile` in streaming fashion (already in the design).

### Anti-Pattern 3: Using `includePartialMessages` for Progress Display

**What people do:** Enable `includePartialMessages: true` to get real-time text deltas.
**Why it's wrong:** Adds `SDKPartialAssistantMessage` (stream events) interleaved with full messages, increasing complexity and message volume. The `SDKAssistantMessage` already provides complete turn-by-turn content.
**Do this instead:** Use `SDKAssistantMessage` (`message.type === "assistant"`) which fires after each Claude response with the full content blocks for that turn.

### Anti-Pattern 4: Not Unref-ing Stall Timers

**What people do:** Create `setTimeout` for stall detection without `.unref()`.
**Why it's wrong:** Active timers prevent Node.js from exiting even after `process.exit()` is called in some edge cases, and can keep the process alive if the `for await` loop completes normally.
**Do this instead:** Always call `stallTimer.unref()` so the timer does not keep the process alive.

## Suggested Build Order

Build order accounts for dependencies -- each step can be tested independently before the next.

### Step 1: Install SDK and Verify Import (minimal change)

- `npm install @anthropic-ai/claude-agent-sdk`
- Add `import { query } from "@anthropic-ai/claude-agent-sdk"` to autopilot.mjs
- Verify the ESM import resolves (no CJS/ESM interop issues)
- Remove `which('node')` prerequisite check
- No behavior change yet

### Step 2: Implement `handleMessage()` and `buildStepHooks()`

- Write `handleMessage()` function that processes SDK message types
- Write `buildStepHooks()` function with PostToolUse stall timer
- These are standalone functions with no dependencies on other changes
- Unit-testable by feeding mock message objects

### Step 3: Implement `runAgentStep()` and Wire to `runStep()`/`runStepCaptured()`

- Write `runAgentStep()` wrapping `query()` with all options
- Replace `runClaudeStreaming()` call in `runStep()` (line 365) and `runStepCaptured()` (line 553)
- Add `TURNS_CONFIG` and `STEP_MCP_SERVERS` config objects
- Test discuss/plan/execute/verify steps work through the new path
- This is the critical integration point

### Step 4: Update Debug Retry Paths

- Replace `runClaudeStreaming(debugPrompt)` at lines 614, 658, 696 with `runAgentStep(debugPrompt, { maxTurns: TURNS_CONFIG.debug })`
- Verify debug retry loop still works (trigger a deliberate failure)

### Step 5: Delete `runClaudeStreaming()` and `displayStreamEvent()`

- Remove the two functions entirely
- Remove any dead imports (JSON.parse is gone, readline is still needed for askTTY)
- Verify no other code references the deleted functions

### Step 6: Add maxBudgetUsd and per-step MCP Configuration

- Wire `maxBudgetUsd` option into `runAgentStep()`
- Wire `STEP_MCP_SERVERS` into step execution (UAT steps get Chrome DevTools MCP)
- Add `autopilot.max_budget_per_step_usd` to CONFIG_DEFAULTS
- Add `autopilot.turns.*` keys to CONFIG_DEFAULTS and KNOWN_SETTINGS_KEYS

### Step 7: Add Cost/Turn Logging

- Log `total_cost_usd`, `num_turns`, `duration_ms` from ResultMessage to session log
- Add per-step cost tracking to the autopilot log file
- Add cumulative cost summary to `printFinalReport()`

## Sources

- [Agent SDK reference - TypeScript](https://platform.claude.com/docs/en/agent-sdk/typescript) -- Complete API reference with type definitions
- [How the agent loop works](https://platform.claude.com/docs/en/agent-sdk/agent-loop) -- Message types, turn counting, budget enforcement, result subtypes
- [Intercept and control agent behavior with hooks](https://platform.claude.com/docs/en/agent-sdk/hooks) -- Hook events, matchers, callback signatures, output format
- [@anthropic-ai/claude-agent-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) -- Package info, Node.js 18+ requirement
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- Architecture overview, subprocess spawning model

---
*Architecture research for: Agent SDK migration in GSD autopilot*
*Researched: 2026-03-24*
