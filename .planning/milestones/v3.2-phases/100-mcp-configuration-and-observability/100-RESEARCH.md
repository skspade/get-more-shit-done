# Phase 100: MCP Configuration and Observability - Research

**Researched:** 2026-03-24
**Domain:** SDK MCP server configuration, per-step observability logging, cumulative cost tracking
**Confidence:** HIGH

## Summary

Phase 100 completes the v3.2 Agent SDK migration by adding three capabilities: (1) per-step MCP server configuration so UAT steps get Chrome DevTools MCP attached automatically, (2) enhanced observability logging with duration, cold start overhead, and session ID per step, and (3) cumulative cost tracking across all steps with a total in the final report.

All three areas are straightforward additions to existing infrastructure. `runAgentStep()` already accepts `mcpServers` and passes it to `query()`. `handleMessage()` already logs cost and turns from result messages. `printFinalReport()` currently prints only `totalIterations`.

**Primary recommendation:** Implement in two plans -- Plan 01 handles MCP server mapping + config registration (MCP-01), Plan 02 handles observability enhancements (MSG-03, OBS-01, OBS-02).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Implement `STEP_MCP_SERVERS` object mapping step names to factory functions that return `mcpServers` config objects
- The `automated-uat` step type returns Chrome DevTools MCP config: `{ 'chrome-devtools': { command: 'npx', args: ['@anthropic-ai/chrome-devtools-mcp@latest'] } }`
- Gate Chrome DevTools MCP behind `getConfig('uat.chrome_mcp_enabled', true)` -- enabled by default
- All other step types return `{}` (empty)
- Wire MCP servers into step execution by resolving `STEP_MCP_SERVERS[stepName]?.()` and passing to `runAgentStep()` via existing `mcpServers` parameter
- Add `uat.chrome_mcp_enabled: true` to `CONFIG_DEFAULTS` in config.cjs
- Add `uat`, `uat.chrome_mcp_enabled` to `KNOWN_SETTINGS_KEYS` in cli.cjs
- Add `uat` to `KNOWN_SETTINGS_KEYS` in validation.cjs
- Enhance `handleMessage()` result case to log `duration_ms`, `duration_api_ms`, `num_turns`, and cold start overhead
- Return `duration_ms` and `num_turns` from `runAgentStep()` alongside existing fields
- Add module-scope `cumulativeCostUsd` accumulator variable
- Increment `cumulativeCostUsd` in `runAgentStep()` when result includes `total_cost_usd`
- Add cumulative cost total to `printFinalReport()` output

### Claude's Discretion
- Exact format of enhanced log strings for duration and cold start overhead
- Whether `STEP_MCP_SERVERS` uses string keys matching stepName or stepType
- Number of decimal places for cost display in the final report
- Whether to log cold start overhead as milliseconds or seconds

### Deferred Ideas (OUT OF SCOPE)
- `gsd debug-session` command (SESS-01)
- Session ID display in step banners (SESS-02)
- V2 SDK interface evaluation (SDKV2-01)
- Per-step effort tuning (EFF-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | Per-step MCP server configuration via `STEP_MCP_SERVERS` mapping; Chrome DevTools MCP for UAT steps only | `STEP_MCP_SERVERS` factory pattern, `runStep()`/`runStepCaptured()` call site wiring, config key registration |
| MSG-03 | Log session ID, cost, turns, and duration from result messages | `handleMessage()` result case enhancement, `SDKResultMessage` fields |
| OBS-01 | Log per-step cost, turns, duration, and cold start overhead to session log | Enhanced `STEP DONE` log line in `runStep()`/`runStepCaptured()`, `runAgentStep()` return shape extension |
| OBS-02 | Add cumulative cost summary to `printFinalReport()` | Module-scope accumulator, `printFinalReport()` addition |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | installed | SDK `query()` with `mcpServers` param | Already integrated in Phase 98 |
| @anthropic-ai/chrome-devtools-mcp | latest (npx) | Chrome DevTools MCP for UAT | Already in production via `/gsd:uat-auto` |

### Supporting
No additional libraries needed. All changes are within existing autopilot.mjs, config.cjs, cli.cjs, and validation.cjs.

## Architecture Patterns

### Pattern 1: Factory Function Map for Step Config
**What:** `STEP_MCP_SERVERS` maps step names to factory functions returning MCP config
**When to use:** When step-specific configuration needs lazy evaluation (config check at call time)
**Example:**
```javascript
const STEP_MCP_SERVERS = {
  'automated-uat': () => {
    if (!getConfig('uat.chrome_mcp_enabled', true)) return {};
    return {
      'chrome-devtools': {
        command: 'npx',
        args: ['@anthropic-ai/chrome-devtools-mcp@latest'],
      },
    };
  },
};
```

### Pattern 2: Config 3-Touch-Point Registration
**What:** New config keys must be registered in 3 files: config.cjs (CONFIG_DEFAULTS), cli.cjs (KNOWN_SETTINGS_KEYS + validateSetting), validation.cjs (KNOWN_SETTINGS_KEYS)
**When to use:** Any new config key

### Pattern 3: Return Shape Extension
**What:** `runAgentStep()` returns `{ exitCode, stdout, costUsd, subtype }` -- extend with `durationMs`, `numTurns`
**When to use:** When callers need additional data from SDK result messages

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP server config | Custom MCP wiring | SDK `mcpServers` param | Already supported by `query()` |
| Cost tracking | Custom API call counting | `total_cost_usd` from SDK result | SDK provides accurate cost data |

## Common Pitfalls

### Pitfall 1: MCP Server Resolution at Wrong Level
**What goes wrong:** Resolving MCP servers in `runAgentStep()` instead of at call sites
**Why it happens:** Seems cleaner to centralize
**How to avoid:** Resolve at `runStep()`/`runStepCaptured()` call sites where stepName is available, pass result to `runAgentStep()` via existing `mcpServers` parameter
**Warning signs:** `runAgentStep()` needing to know about step names

### Pitfall 2: Forgetting validation.cjs Touch Point
**What goes wrong:** Config key works but `gsd health` reports unknown keys
**Why it happens:** validation.cjs has its own `KNOWN_SETTINGS_KEYS` that differs from cli.cjs
**How to avoid:** Always update all 3 files when adding config keys

### Pitfall 3: Null Safety on Result Message Fields
**What goes wrong:** `TypeError` when accessing `duration_ms` on a result message that lacks it
**Why it happens:** Not all result subtypes may include all fields
**How to avoid:** Use optional chaining: `resultMsg?.duration_ms`

## Code Examples

### MCP Server Resolution at Call Sites
```javascript
// In runStep():
const { exitCode } = await runAgentStep(prompt, {
  maxTurns: getMaxTurns(stepType || stepName),
  mcpServers: STEP_MCP_SERVERS[stepName]?.() || {},
});

// In runStepCaptured():
const result = await runAgentStep(prompt, {
  outputFile,
  maxTurns: getMaxTurns(stepType || stepName),
  mcpServers: STEP_MCP_SERVERS[stepName]?.() || {},
});
```

### Enhanced handleMessage Result Logging
```javascript
case 'result': {
  if (message.subtype === 'success') {
    logMsg(`RESULT: success cost=$${message.total_cost_usd?.toFixed(4)} turns=${message.num_turns} duration=${message.duration_ms}ms cold_start=${(message.duration_ms || 0) - (message.duration_api_ms || 0)}ms`);
  }
  // ... existing error handling
}
```

### Extended runAgentStep Return
```javascript
return {
  exitCode,
  stdout,
  costUsd: resultMsg?.total_cost_usd,
  subtype,
  durationMs: resultMsg?.duration_ms,
  numTurns: resultMsg?.num_turns,
};
```

### Cumulative Cost
```javascript
let cumulativeCostUsd = 0;

// In runAgentStep(), after result processing:
if (resultMsg?.total_cost_usd) {
  cumulativeCostUsd += resultMsg.total_cost_usd;
}

// In printFinalReport():
console.log(`Cumulative cost: $${cumulativeCostUsd.toFixed(4)}`);
```

## Integration Points

### autopilot.mjs Changes
1. **Add `STEP_MCP_SERVERS` map** (near TURNS_CONFIG, ~line 211)
2. **Add `cumulativeCostUsd` accumulator** (near totalIterations, module scope)
3. **Enhance `handleMessage()` result case** (lines 280-294) -- add duration_ms, cold start
4. **Extend `runAgentStep()` return** (line 345) -- add durationMs, numTurns; accumulate cost
5. **Wire MCP in `runStep()`** (line 433) -- add mcpServers param
6. **Enhance `runStep()` STEP DONE log** (line 435) -- include cost, turns, duration
7. **Wire MCP in `runStepCaptured()`** (line 621) -- add mcpServers param
8. **Enhance `runStepCaptured()` STEP DONE log** (line 623) -- include cost, turns, duration
9. **Enhance `printFinalReport()`** (line 1210) -- add cumulative cost line

### config.cjs Changes
10. **Add `uat.chrome_mcp_enabled: true`** to CONFIG_DEFAULTS

### cli.cjs Changes
11. **Add `uat`, `uat.chrome_mcp_enabled`** to KNOWN_SETTINGS_KEYS
12. **Add boolean validation** for `uat.chrome_mcp_enabled` in validateSetting

### validation.cjs Changes
13. **Add `uat`** to KNOWN_SETTINGS_KEYS

## Sources

### Primary (HIGH confidence)
- Codebase inspection of autopilot.mjs (current state after Phase 98+99)
- Codebase inspection of config.cjs, cli.cjs, validation.cjs
- CONTEXT.md user decisions
- REQUIREMENTS.md requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - extending existing patterns with verified code references
- Pitfalls: HIGH - based on actual codebase patterns observed

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable internal codebase)
