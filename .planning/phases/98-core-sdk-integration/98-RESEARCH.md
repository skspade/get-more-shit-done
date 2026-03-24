# Phase 98: Core SDK Integration - Research

**Researched:** 2026-03-24
**Domain:** Claude Agent SDK TypeScript integration
**Confidence:** HIGH

## Summary

Phase 98 replaces the CLI subprocess invocation (`claude -p --output-format stream-json`) in autopilot.mjs with the official `@anthropic-ai/claude-agent-sdk` TypeScript package. The SDK's `query()` function returns an `AsyncGenerator<SDKMessage, void>` that yields typed messages (assistant, system, result) instead of raw NDJSON lines. This eliminates the readline-based NDJSON parsing, the quiet-mode CLI branch, and the `/dev/null` stdin redirect.

The SDK spawns Claude Code as a subprocess internally (same auth, same `which('claude')` check), so no API key changes are needed. The main implementation surface is three new functions (`runAgentStep`, `handleMessage`, `buildStepHooks`) plus signal handler updates and two call-site rewirings.

**Primary recommendation:** Implement `runAgentStep()` wrapping `query()` with `bypassPermissions` + `allowDangerouslySkipPermissions: true`, typed `handleMessage()` switch, and `PostToolUse`/`Stop` hook-based stall detection. Wire to `runStep()` and `runStepCaptured()` only (debug retry sites deferred to Phase 99).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Install `@anthropic-ai/claude-agent-sdk` and `zod` (peer dep) as production dependencies
- Bump `engines.node` in package.json from `>=16.7.0` to `>=18.0.0`
- Import `query` from `@anthropic-ai/claude-agent-sdk` in autopilot.mjs
- Remove the `which('node')` prerequisite check at lines 68-73
- Implement `runAgentStep(prompt, { outputFile, quiet, maxTurns, maxBudgetUsd, mcpServers })` wrapping SDK `query()`
- Set `permissionMode: "bypassPermissions"` AND `allowDangerouslySkipPermissions: true` together
- Set `systemPrompt: { type: "preset", preset: "claude_code" }` and `settingSources: ["project"]`
- Set `disallowedTools: ["AskUserQuestion"]`
- Set `cwd: PROJECT_DIR` on every query call
- Pass `maxTurns` with default `getConfig('autopilot.max_turns_per_step', 200)`
- Pass `maxBudgetUsd` defaulting to `undefined` when not configured
- Implement `handleMessage()` with typed switch on `message.type` (assistant, system, result)
- For assistant messages, access content via `message.message?.content` (double `.message` nesting per SDK API)
- Write assistant text blocks to stdout and tool_use blocks as `  * {name}\n` to stderr
- Accumulate `lastAssistantText` from every assistant message for error context
- On result messages, use `resultMsg.result` for success subtype, `lastAssistantText` for error subtypes
- Write `JSON.stringify(message) + '\n'` to outputFile for each message
- In quiet mode, suppress display output but still process result messages
- Log session ID, model from system init messages via `logMsg()`
- Log cost, turns, subtype from result messages via `logMsg()`
- Implement `buildStepHooks()` returning `PostToolUse` and `Stop` hook arrays
- `PostToolUse` hook re-arms a `setTimeout`-based stall timer on each tool completion
- Also re-arm stall timer in the main `for await` message loop for thinking-heavy turns
- `Stop` hook clears the stall timer
- Use `stallTimer.unref()` on every timer creation
- Clear stall timer in a `finally` block in `runAgentStep()`
- Use existing `autopilot.stall_timeout_ms` config key with 300000ms default
- Store `AbortController` reference at module scope (`activeAbortController`)
- Create new `AbortController` per `runAgentStep()` call
- In SIGINT handler, call `activeAbortController?.abort()` before `process.exit(130)`
- In SIGTERM handler, call `activeAbortController?.abort()` before `process.exit(0)`
- Set `activeAbortController = null` after each `runAgentStep()` completes
- Return `{ exitCode, stdout, costUsd }` from `runAgentStep()`
- Wire `runAgentStep()` to `runStep()` line 365 replacing `runClaudeStreaming(prompt)`
- Wire `runAgentStep()` to `runStepCaptured()` line 553 replacing `runClaudeStreaming(prompt, { outputFile })`
- Do NOT collect all messages in an array -- process as they arrive, only retain result message reference

### Claude's Discretion
- Internal variable naming for stall timer state variables
- Exact format of logMsg strings for session ID and cost tracking
- Whether to use `const` or `let` for the `armStallTimer` closure variable inside `buildStepHooks`
- Order of fields in the `query()` options object
- Whether `handleMessage` logs system messages other than `init` subtype

### Deferred Ideas (OUT OF SCOPE)
- Debug retry call site migration (CALL-02) -- Phase 99
- Per-step-type maxTurns config via TURNS_CONFIG (SAFE-01) -- Phase 99
- maxBudgetUsd config registration (SAFE-02) -- Phase 99
- Deletion of `runClaudeStreaming()` and `displayStreamEvent()` (CLN-01) -- Phase 99
- Config key registration in config.cjs (CLN-02) -- Phase 99
- Per-step MCP server configuration (MCP-01) -- Phase 100
- Cost/turn/duration logging from result messages (MSG-03) -- Phase 100
- Cumulative cost reporting in printFinalReport (OBS-02) -- Phase 100
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SDK-01 | Install SDK and zod, bump engines.node to >=18.0.0 | SDK installs via `npm install @anthropic-ai/claude-agent-sdk`; zod is a peer dep. SDK is ESM-only, natural fit for autopilot.mjs |
| SDK-02 | Import `query` from SDK; remove `which('node')` check | `import { query } from "@anthropic-ai/claude-agent-sdk"` -- verified in official docs. `which('node')` check at lines 68-73 is redundant since SDK manages its own subprocess |
| SDK-03 | Implement `runAgentStep()` wrapping SDK `query()` with permission, prompt, and tool configuration | All Options fields verified: `permissionMode`, `allowDangerouslySkipPermissions`, `systemPrompt`, `settingSources`, `disallowedTools`, `cwd`, `maxTurns`, `maxBudgetUsd`, `hooks`, `abortController` |
| MSG-01 | Implement `handleMessage()` with typed switch on message.type | SDKMessage is a union: SDKAssistantMessage (type="assistant"), SDKSystemMessage (type="system", subtype="init"), SDKResultMessage (type="result"). Content accessed via `message.message.content` for assistant type |
| MSG-02 | Accumulate `lastAssistantText` for error context on non-success results | SDKResultMessage error variants have `errors: string[]` but NOT `result`. Success variant has `result: string`. `lastAssistantText` provides richer error context than the SDK's `errors` array |
| SAFE-03 | Implement `buildStepHooks()` with PostToolUse stall detection | HookEvent includes "PostToolUse" and "Stop". HookCallbackMatcher has `matcher?: string` (regex) and `hooks: HookCallback[]`. Callback signature: `(input, toolUseID, { signal }) => Promise<HookJSONOutput>` |
| SAFE-04 | Update signal handlers with AbortController | Options type includes `abortController: AbortController`. Calling `abort()` on it terminates the subprocess cleanly. Query object also has `close()` for forceful termination |
| CALL-01 | Wire `runAgentStep()` to `runStep()` and `runStepCaptured()` | Line 365 in `runStep()` and line 553 in `runStepCaptured()` both call `runClaudeStreaming()` -- these are the two primary call sites |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | latest | TypeScript SDK for Claude Code agent invocation | Official Anthropic SDK; ESM-only package providing `query()` AsyncGenerator |
| zod | ^3.x (peer dep) | Schema validation for SDK tool definitions | Required peer dependency of the agent SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zx | ^8.0.0 (existing) | Shell commands, `which()`, argv | Already installed; continues to handle `gsdTools()`, `takeProgressSnapshot()`, argv parsing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SDK `query()` | V2 interface (`createSession`/`send`/`stream`) | V2 is preview/unstable -- explicitly deferred per CONTEXT.md |
| `disallowedTools` | `canUseTool` callback | Callback adds complexity for a simple deny-list use case |

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk zod
```

## Architecture Patterns

### Recommended Changes to autopilot.mjs

```
get-shit-done/scripts/autopilot.mjs
  + import { query } from "@anthropic-ai/claude-agent-sdk"
  + let activeAbortController = null              (module scope)
  + function buildStepHooks()                     (new: stall detection via hooks)
  + function handleMessage(message, opts)         (new: typed message switch)
  + async function runAgentStep(prompt, opts)     (new: wraps query())
  ~ runStep()            line 365                 (swap runClaudeStreaming -> runAgentStep)
  ~ runStepCaptured()    line 553                 (swap runClaudeStreaming -> runAgentStep)
  ~ SIGINT handler       line 146                 (add abort() call)
  ~ SIGTERM handler      line 158                 (add abort() call)
  - which('node') check  lines 68-73             (removed)
  = runClaudeStreaming()  lines 228-278           (KEPT -- still used by debug retry in Phase 98)
  = displayStreamEvent()  lines 213-226           (KEPT -- still used by runClaudeStreaming)
```

### Pattern 1: SDK query() AsyncGenerator Iteration
**What:** Iterate typed messages from `query()` with `for await...of`
**When to use:** Every SDK invocation
**Example:**
```javascript
// Source: platform.claude.com/docs/en/agent-sdk/typescript
for await (const message of query({ prompt, options })) {
  handleMessage(message, { quiet, outputFile });
}
```

### Pattern 2: AbortController for Signal Cleanup
**What:** Pass `AbortController` to `query()` options, call `abort()` on signals
**When to use:** Every `runAgentStep()` call
**Example:**
```javascript
// Source: platform.claude.com/docs/en/agent-sdk/typescript Options type
const controller = new AbortController();
activeAbortController = controller;
try {
  for await (const message of query({
    prompt,
    options: { abortController: controller, ... }
  })) { ... }
} finally {
  activeAbortController = null;
}
```

### Pattern 3: PostToolUse Hook for Stall Detection
**What:** Re-arm a setTimeout on each tool completion; Stop hook clears it
**When to use:** Every `runAgentStep()` call via `buildStepHooks()`
**Example:**
```javascript
// Source: platform.claude.com/docs/en/agent-sdk/hooks
{
  PostToolUse: [{ matcher: ".*", hooks: [async () => { armStallTimer(); return {}; }] }],
  Stop: [{ matcher: ".*", hooks: [async () => { clearTimeout(stallTimer); return {}; }] }]
}
```

### Anti-Patterns to Avoid
- **Collecting all messages in an array:** Long-running execute steps can have hundreds of turns. Only retain the result message reference. (CONTEXT.md Anti-Pattern 2)
- **Using `allowedTools` for restriction:** In `bypassPermissions` mode, `allowedTools` only pre-approves, it does NOT restrict. Use `disallowedTools` for enforcement. (CONTEXT.md Pitfall 5)
- **Accessing `message.content` directly on assistant messages:** The SDK wraps content in `message.message.content` (double nesting via BetaMessage). (CONTEXT.md Pitfall 10)
- **Forgetting `.unref()` on stall timers:** Timers without `.unref()` keep the Node.js process alive after the SDK finishes. (CONTEXT.md Pitfall 4)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude invocation | Custom subprocess spawning | SDK `query()` | Handles process lifecycle, message typing, error classification |
| Permission bypass | Manual `--dangerously-skip-permissions` flag | SDK `permissionMode: "bypassPermissions"` + `allowDangerouslySkipPermissions: true` | SDK enforces the flag combination requirement |
| NDJSON parsing | readline + JSON.parse | SDK typed messages | Messages are already parsed, typed objects |
| Process termination | `proc.kill()` | `AbortController.abort()` via SDK | Ensures clean subprocess cleanup |

## Common Pitfalls

### Pitfall 1: Missing allowDangerouslySkipPermissions
**What goes wrong:** Setting `permissionMode: "bypassPermissions"` alone causes the SDK to throw an error
**Why it happens:** Safety guard -- SDK requires explicit opt-in with `allowDangerouslySkipPermissions: true`
**How to avoid:** Always set both `permissionMode: "bypassPermissions"` AND `allowDangerouslySkipPermissions: true`
**Warning signs:** Error at SDK initialization mentioning permissions

### Pitfall 2: Double .message nesting on assistant messages
**What goes wrong:** Accessing `message.content` returns undefined
**Why it happens:** `SDKAssistantMessage` has a `message` field of type `BetaMessage`, which itself has `content`
**How to avoid:** Access via `message.message?.content` (or `message.message.content`)
**Warning signs:** Empty text output despite successful query

### Pitfall 3: Treating error result subtypes as having a `result` field
**What goes wrong:** `resultMsg.result` is undefined on error variants
**Why it happens:** The `SDKResultMessage` union: success has `result: string`, error variants have `errors: string[]` instead
**How to avoid:** Check `resultMsg.subtype === "success"` before accessing `.result`; use `lastAssistantText` for error context
**Warning signs:** Empty stdout string returned to callers on failures

### Pitfall 4: Stall timer keeping process alive
**What goes wrong:** Node.js process hangs after SDK completes
**Why it happens:** `setTimeout` without `.unref()` keeps the event loop alive
**How to avoid:** Call `.unref()` on every stall timer, clear in `finally` block
**Warning signs:** Process hangs after step completion

### Pitfall 5: Stall timer not firing during thinking-heavy turns
**What goes wrong:** Agent does extended thinking without calling tools, no stall warning
**Why it happens:** `PostToolUse` hook only fires when tools complete, not during thinking
**How to avoid:** Also re-arm the stall timer in the `for await` message loop (on each message received)
**Warning signs:** Long silent periods with no stall detection

### Pitfall 6: Not passing abortController to query options
**What goes wrong:** SIGINT/SIGTERM kills parent but orphans Claude subprocess
**Why it happens:** Without AbortController, the SDK subprocess doesn't receive termination signal
**How to avoid:** Create `new AbortController()` per call, pass as `options.abortController`, call `.abort()` in signal handlers
**Warning signs:** Orphaned `claude` processes after Ctrl-C

## Code Examples

### Complete runAgentStep Pattern
```javascript
// Source: verified against platform.claude.com/docs/en/agent-sdk/typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function runAgentStep(prompt, { outputFile, quiet, maxTurns, maxBudgetUsd, mcpServers } = {}) {
  const controller = new AbortController();
  activeAbortController = controller;
  let resultMsg = null;
  let lastAssistantText = '';
  const hooks = buildStepHooks();

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: PROJECT_DIR,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: maxTurns || getConfig('autopilot.max_turns_per_step', 200),
        maxBudgetUsd: maxBudgetUsd || getConfig('autopilot.max_budget_per_step_usd', undefined),
        mcpServers: mcpServers || {},
        disallowedTools: ["AskUserQuestion"],
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["project"],
        hooks,
        abortController: controller,
      },
    })) {
      // Re-arm stall timer on every message (handles thinking-heavy turns)
      hooks._armStallTimer?.();
      handleMessage(message, { quiet, outputFile });

      if (message.type === 'assistant') {
        const textBlocks = (message.message?.content || []).filter(b => b.type === 'text');
        if (textBlocks.length > 0) {
          lastAssistantText = textBlocks.map(b => b.text).join('');
        }
      }
      if (message.type === 'result') {
        resultMsg = message;
      }
    }
  } finally {
    hooks._clearStallTimer?.();
    activeAbortController = null;
  }

  const exitCode = resultMsg?.subtype === 'success' ? 0 : 1;
  const stdout = resultMsg?.subtype === 'success' ? (resultMsg.result || '') : lastAssistantText;
  return { exitCode, stdout, costUsd: resultMsg?.total_cost_usd };
}
```

### SDKAssistantMessage Content Access
```javascript
// Source: platform.claude.com/docs/en/agent-sdk/typescript#sdkassistant-message
// SDKAssistantMessage.message is BetaMessage from Anthropic SDK
// BetaMessage.content is ContentBlock[]
const content = message.message?.content || [];
for (const block of content) {
  if (block.type === 'text') {
    process.stdout.write(block.text);
  } else if (block.type === 'tool_use') {
    process.stderr.write(`  * ${block.name}\n`);
  }
}
```

### SDKResultMessage Discriminated Union
```javascript
// Source: platform.claude.com/docs/en/agent-sdk/typescript#sdkresult-message
// Success variant: { type: "result", subtype: "success", result: string, ... }
// Error variants: { type: "result", subtype: "error_*", errors: string[], ... }
// Common fields: total_cost_usd, num_turns, duration_ms, session_id
if (resultMsg.subtype === 'success') {
  logMsg(`RESULT: success cost=$${resultMsg.total_cost_usd?.toFixed(4)} turns=${resultMsg.num_turns}`);
} else {
  logMsg(`RESULT: ${resultMsg.subtype} cost=$${resultMsg.total_cost_usd?.toFixed(4)}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude -p --output-format stream-json` | SDK `query()` AsyncGenerator | Agent SDK release | Typed messages, no NDJSON parsing, hook system |
| readline NDJSON parsing | Direct typed message iteration | Agent SDK release | Eliminates JSON.parse try/catch, non-JSON fallbacks |
| `--dangerously-skip-permissions` flag | `permissionMode: "bypassPermissions"` option | Agent SDK release | Programmatic, type-checked |
| Custom `setTimeout` stall detection | PostToolUse/Stop hooks | Agent SDK release | Integrated with SDK lifecycle |

**V2 Preview available:** The SDK now offers a V2 interface with `send()`/`stream()` patterns, but it is explicitly marked as preview/unstable. Deferred per CONTEXT.md.

## Open Questions

1. **Cold start overhead**
   - What we know: ~12s per `query()` call is documented as a known SDK limitation
   - What's unclear: Whether this has improved in recent SDK versions
   - Recommendation: Accept and log; optimize later if needed

2. **`maxBudgetUsd` when config returns undefined**
   - What we know: Options type says `maxBudgetUsd: number | undefined`, default is `undefined`
   - What's unclear: Whether passing `undefined` explicitly is identical to omitting the field
   - Recommendation: Use `getConfig(...) || undefined` pattern -- both should be equivalent

## Sources

### Primary (HIGH confidence)
- platform.claude.com/docs/en/agent-sdk/typescript - Full TypeScript SDK reference, Options type, all message types
- platform.claude.com/docs/en/agent-sdk/hooks - Hook configuration, PostToolUse/Stop events, callback signature
- platform.claude.com/docs/en/agent-sdk/permissions - Permission modes, bypassPermissions, disallowedTools
- platform.claude.com/docs/en/agent-sdk/modifying-system-prompts - systemPrompt preset configuration

### Secondary (MEDIUM confidence)
- CONTEXT.md from discuss-phase (auto-generated) - Consolidates ARCHITECTURE.md, PITFALLS.md, FEATURES.md insights

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK docs verified via Context7 and WebFetch
- Architecture: HIGH - All Options fields, message types, and hook interfaces verified against official TypeScript reference
- Pitfalls: HIGH - Confirmed by both CONTEXT.md (from prior design work) and official SDK type definitions

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable SDK, 30-day window)
