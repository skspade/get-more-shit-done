# Autopilot Agent SDK Migration — Design

**Date:** 2026-03-24
**Approach:** SDK-Native Rewrite

## Dependencies and Integration

**Package installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Import changes in autopilot.mjs:**
```javascript
// ADD
import { query } from "@anthropic-ai/claude-agent-sdk";

// REMOVE (no longer needed for Claude invocation)
// - createInterface from 'readline' (was used for NDJSON parsing — still needed for TTY askTTY)
// The `which('claude')` prerequisite check remains valid — the SDK spawns claude code as a subprocess

// KEEP as-is
import { createRequire } from 'module';
import { createInterface } from 'readline';  // still used by askTTY()
import os from 'os';
import path from 'path';
import fs from 'fs';
```

**Key SDK fact:** The Agent SDK spawns a Claude Code subprocess internally — it does NOT make direct API calls. This means:
- Same authentication as the current `claude` CLI (no ANTHROPIC_API_KEY change needed)
- The `which('claude')` prerequisite check remains valid
- `@anthropic-ai/claude-agent-sdk` becomes the only new dependency

**File format:** Stays as `.mjs` (ESM). zx retained for `gsdTools()`, `takeProgressSnapshot()`, and `argv`/`which()`.

## Core Step Execution

The central change: replace `runClaudeStreaming()` (CLI subprocess + NDJSON parsing) with SDK `query()` calls. The new function signature:

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
      allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      settingSources: ["project"],  // loads CLAUDE.md files
      hooks: buildStepHooks(outputFile),
    },
  })) {
    messages.push(message);
    handleMessage(message, { quiet, outputFile });
  }

  // Extract result from the final message
  const resultMsg = messages.find(m => m.type === "result");
  const exitCode = resultMsg?.subtype === "success" ? 0 : 1;
  const resultText = resultMsg?.result || "";

  return { exitCode, stdout: resultText, costUsd: resultMsg?.total_cost_usd };
}
```

**What this replaces:**
- `runClaudeStreaming()` (lines 228-278) — eliminated entirely
- The quiet-mode branch (`claude -p --output-format json`) — replaced by iterating `query()` and only logging the result message
- The streaming-mode branch (`claude -p --output-format stream-json`) — replaced by iterating all messages
- NDJSON readline parsing — eliminated (SDK provides typed messages)
- `/dev/null` stdin redirect — not needed (SDK handles its own I/O)

**Call site mapping:**

| Current | New |
|---------|-----|
| `runClaudeStreaming(prompt)` | `runAgentStep(prompt)` |
| `runClaudeStreaming(prompt, { outputFile })` | `runAgentStep(prompt, { outputFile })` |
| `runClaudeStreaming(debugPrompt)` | `runAgentStep(debugPrompt, { maxTurns: 50 })` |

**`runStep()` and `runStepCaptured()` stay** as thin wrappers — they handle progress snapshots, circuit breaker checks, banners, and dry-run mode. Only their internal Claude invocation call changes from `runClaudeStreaming()` to `runAgentStep()`.

## Stream Handling and Output Display

Replace `displayStreamEvent()` (NDJSON event parsing) with SDK message type handling:

```javascript
function handleMessage(message, { quiet, outputFile } = {}) {
  if (quiet || QUIET) return;  // Quiet mode: suppress all output

  switch (message.type) {
    case "assistant": {
      // Claude's response — text and tool calls
      const content = message.message?.content || [];
      for (const block of content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        } else if (block.type === "tool_use") {
          process.stderr.write(`  ◆ ${block.name}\n`);
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
          console.error("⚠ Step hit maxTurns limit");
        } else if (message.subtype === "error_max_budget_usd") {
          console.error("⚠ Step hit budget limit");
        } else if (message.subtype === "error_during_execution") {
          console.error(`⚠ Execution error: ${message.error || "unknown"}`);
        }
      }
      break;
    }
  }

  // Output file capture (for debug retry error context)
  if (outputFile) {
    try {
      fs.appendFileSync(outputFile, JSON.stringify(message) + '\n');
    } catch {}
  }
}
```

**What this replaces:**
- `displayStreamEvent()` (lines 213-226) — replaced by `handleMessage()`
- JSON.parse try/catch on each NDJSON line — eliminated (SDK provides typed objects)
- Non-JSON fallback line writing — eliminated

**Output parity:** The user-visible output stays identical — assistant text to stdout, tool names to stderr with `◆` prefix. The SDK just provides the data in a cleaner form.

**New capability:** Cost and turn tracking per step are now available via `result` messages — logged automatically.

## Safety Mechanisms

Three safety layers replace/augment the current custom infrastructure:

### 1. maxTurns (replaces part of runaway prevention)

Each `query()` call gets a `maxTurns` limit. If the agent loops without finishing, the SDK stops it cleanly and returns a result with `subtype: "error_max_turns"`.

```javascript
// Step-type-specific limits (configurable via config.json)
const TURNS_CONFIG = {
  discuss:   getConfig('autopilot.turns.discuss', 100),
  plan:      getConfig('autopilot.turns.plan', 150),
  execute:   getConfig('autopilot.turns.execute', 300),
  verify:    getConfig('autopilot.turns.verify', 100),
  debug:     getConfig('autopilot.turns.debug', 50),
  audit:     getConfig('autopilot.turns.audit', 100),
  uat:       getConfig('autopilot.turns.uat', 150),
  completion: getConfig('autopilot.turns.completion', 50),
};
```

### 2. maxBudgetUsd (new — cost cap per step)

Optional per-step budget. If set, the SDK stops the agent when cost exceeds the limit. Result subtype is `"error_max_budget_usd"`.

```javascript
// Global default, overridable per step type
const DEFAULT_BUDGET = getConfig('autopilot.max_budget_per_step_usd', undefined);
```

When `undefined`, no budget cap is enforced (current behavior). Users opt in via `config.json`.

### 3. Stall Detection (SDK hooks replace custom timer)

Replace the custom `armStallTimer()` / `setTimeout(onStall, ...)` with a `PostToolUse` hook that re-arms a timer on each tool completion:

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
      process.stderr.write(`⚠ No tool activity for ${mins} minutes — step may be stalled\n`);
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
    PostToolUse: [{ matcher: ".*", hooks: [stallHook] }],
    Stop: [{ matcher: ".*", hooks: [async () => {
      if (stallTimer) clearTimeout(stallTimer);
      return {};
    }] }],
  };
}
```

### 4. Circuit Breaker (preserved as-is)

The progress circuit breaker (`takeProgressSnapshot()` / `checkProgress()`) stays unchanged. It operates at the outer loop level — tracking progress across steps, not within a single SDK query. maxTurns handles per-step runaway; the circuit breaker handles cross-step stalls.

## Debug Retry Infrastructure

The debug retry loop (`runStepWithRetry()`, `runVerifyWithDebugRetry()`) stays structurally identical — the change is that each attempt invokes `runAgentStep()` instead of `runClaudeStreaming()`.

```javascript
async function runStepWithRetry(prompt, stepName) {
  let retryCount = 0;

  while (true) {
    const outputFile = path.join(os.tmpdir(), `gsd-autopilot-${Date.now()}`);
    fs.writeFileSync(outputFile, '');
    tempFiles.push(outputFile);

    const stepExit = await runStepCaptured(prompt, stepName, outputFile);

    if (stepExit === 0) {
      await clearFailureState();
      return 0;
    }

    retryCount++;
    if (retryCount > MAX_DEBUG_RETRIES) {
      // ... existing exhaustion handling unchanged ...
      return stepExit;
    }

    // Debug retry — uses SDK with lower maxTurns (focused debugging)
    const debugPrompt = constructDebugPrompt(stepName, stepExit, errorContext, phase, phaseDir, retryCount);

    const { exitCode: debugExitCode } = await runAgentStep(debugPrompt, {
      maxTurns: TURNS_CONFIG.debug,
      outputFile,
    });

    if (debugExitCode !== 0) {
      console.error('WARNING: Debugger itself returned non-zero. Continuing to next retry.');
    }
  }
}
```

**What changes:**
- `runClaudeStreaming(debugPrompt)` → `runAgentStep(debugPrompt, { maxTurns: TURNS_CONFIG.debug })`
- Debug steps get a lower `maxTurns` (default 50) since debugging should be focused
- `constructDebugPrompt()` stays unchanged — it returns a prompt string, which `query()` accepts directly

**What doesn't change:**
- Retry count logic, `MAX_DEBUG_RETRIES`, exhaustion handling
- `writeFailureState()`, `clearFailureState()`, `writeFailureReport()`
- `runVerifyWithDebugRetry()` structure — same pattern, just swaps the inner call

## Verification Gate, Milestone Audit, and MCP Configuration

### Verification Gate (preserved)

The TTY-based verification gate (`askTTY()`, `runVerificationGate()`, `printVerificationGate()`) stays unchanged. It's pure terminal I/O and phase-state reading — no Claude invocations. The only thing that changes is how fix cycles invoke Claude:

```javascript
async function runFixCycle(phase) {
  const fixDesc = await askTTY('Describe what to fix: ');
  // These now go through runAgentStep internally via runStep()
  await runStep(`/gsd:plan-phase ${phase} --gaps -- Human fix request: ${fixDesc}`, 'fix-plan');
  await runStep(`/gsd:execute-phase ${phase} --gaps-only -- Human fix request: ${fixDesc}`, 'fix-execute');
  await runStep(`/gsd:verify-work ${phase}`, 'fix-verify');
}
```

### Milestone Audit and UAT (preserved with SDK calls)

`runMilestoneAudit()`, `runAutomatedUAT()`, `runGapClosureLoop()`, and `runMilestoneCompletion()` all stay structurally identical. Their Claude invocations route through `runStepWithRetry()` → `runStepCaptured()` → `runAgentStep()`.

### MCP Server Configuration (new)

Per-step MCP servers can now be passed to `runAgentStep()`. This enables targeted browser access for UAT steps without exposing it to all steps:

```javascript
// In runAutomatedUAT():
const uatMcpServers = {};

// If Chrome MCP is available, pass it for UAT
const chromeAvailable = getConfig('uat.chrome_mcp_enabled', true);
if (chromeAvailable) {
  uatMcpServers['chrome-devtools'] = {
    command: 'npx',
    args: ['@anthropic-ai/chrome-devtools-mcp@latest'],
  };
}

const uatExit = await runStepWithRetry('/gsd:uat-auto', 'automated-uat');
// MCP servers flow through to runAgentStep via a step-config pattern
```

**Step-level MCP configuration pattern:**

```javascript
// Optional: step-type to MCP server mapping
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

### Deleted Code

The following are removed entirely:
- `runClaudeStreaming()` (~50 lines) — replaced by `runAgentStep()`
- `displayStreamEvent()` (~14 lines) — replaced by `handleMessage()`
- The `which('node')` prerequisite check (line 68-73) — SDK manages its own Node.js requirement
- Quiet-mode CLI branch (`claude -p --output-format json`) — handled by `handleMessage()` suppressing output

### Preserved Code

Everything outside the Claude invocation path stays:
- Main loop, phase navigation, `getPhaseStep()`
- Progress tracking, circuit breaker
- Signal handling (SIGINT/SIGTERM)
- Logging infrastructure
- All CJS imports (phase.cjs, verify.cjs, config.cjs, etc.)
- `gsdTools()` helper (still uses zx `$`)
- `askTTY()` for verification gate
