# Phase 100: MCP Configuration and Observability - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

UAT steps get Chrome DevTools MCP attached automatically, every step logs cost/turns/duration, and the final report shows cumulative cost. This phase delivers the `STEP_MCP_SERVERS` mapping, the `uat.chrome_mcp_enabled` config key, enhanced per-step observability logging (cost, turns, duration, cold start overhead, session ID), and cumulative cost tracking in `printFinalReport()`.

</domain>

<decisions>
## Implementation Decisions

### Per-Step MCP Server Configuration (MCP-01)
- Implement `STEP_MCP_SERVERS` object mapping step names to factory functions that return `mcpServers` config objects (from REQUIREMENTS.md MCP-01)
- The `automated-uat` step type returns Chrome DevTools MCP config: `{ 'chrome-devtools': { command: 'npx', args: ['@anthropic-ai/chrome-devtools-mcp@latest'] } }` (from ARCHITECTURE.md verified pattern)
- Gate Chrome DevTools MCP behind `getConfig('uat.chrome_mcp_enabled', true)` -- enabled by default, can be disabled via config.json (from REQUIREMENTS.md CLN-02)
- All other step types return `{}` (empty) -- no MCP servers attached to non-UAT steps (from ROADMAP.md success criterion 1)
- Wire MCP servers into step execution by resolving `STEP_MCP_SERVERS[stepType]?.()` and passing to `runAgentStep()` via the existing `mcpServers` parameter (from ARCHITECTURE.md)
- `runStep()` and `runStepCaptured()` already accept `stepType` and pass `maxTurns` to `runAgentStep()` -- add `mcpServers` resolution alongside it (Claude's Decision: consistent with existing parameter flow pattern)
- `runStepWithRetry()` must also pass MCP servers since it calls `runStepCaptured()` for the main step -- the stepType already flows through (Claude's Decision: UAT runs through runStepWithRetry, so MCP must propagate)

### Config Key Registration (MCP-01, CLN-02)
- Add `uat.chrome_mcp_enabled: true` to `CONFIG_DEFAULTS` in config.cjs (from REQUIREMENTS.md CLN-02)
- Add `uat`, `uat.chrome_mcp_enabled` to `KNOWN_SETTINGS_KEYS` in cli.cjs (Claude's Decision: follows 3-touch-point pattern; uat is a new top-level namespace)
- Add `uat` to `KNOWN_SETTINGS_KEYS` in validation.cjs (Claude's Decision: validation.cjs uses top-level keys only)
- Add validation rule in `validateSetting()` for `uat.chrome_mcp_enabled` (must be boolean) (Claude's Decision: consistent with existing validation rules for boolean config keys)

### Per-Step Observability Logging (MSG-03, OBS-01)
- Enhance the `handleMessage()` result case to log `duration_ms`, `duration_api_ms`, `num_turns`, and cold start overhead (`duration_ms - duration_api_ms`) from `SDKResultMessage` (from REQUIREMENTS.md MSG-03, OBS-01)
- Session ID is already logged from system init messages (`SESSION: id=... model=...`) -- this satisfies the session ID per step requirement (from ROADMAP.md success criterion 4)
- Enhance `STEP DONE` log line in `runStep()` and `runStepCaptured()` to include cost, turns, and duration from the `runAgentStep()` return value (from REQUIREMENTS.md OBS-01)
- Return `duration_ms` and `num_turns` from `runAgentStep()` alongside existing `exitCode`, `stdout`, `costUsd`, `subtype` (Claude's Decision: callers need duration and turns for the enhanced log line)

### Cumulative Cost Tracking (OBS-02)
- Add a module-scope `cumulativeCostUsd` accumulator variable initialized to 0 (Claude's Decision: simple accumulation; no need for a complex tracking structure)
- Increment `cumulativeCostUsd` in `runAgentStep()` when the result message includes `total_cost_usd` (from REQUIREMENTS.md OBS-02)
- Add cumulative cost total to `printFinalReport()` output: display `Cumulative cost: $X.XXXX` alongside the existing total iterations line (from ROADMAP.md success criterion 3)

### Claude's Discretion
- Exact format of enhanced log strings for duration and cold start overhead
- Whether `STEP_MCP_SERVERS` uses string keys matching stepName or stepType
- Number of decimal places for cost display in the final report
- Whether to log cold start overhead as milliseconds or seconds

</decisions>

<specifics>
## Specific Ideas

- The SDK `McpStdioServerConfig` type is `{ type?: "stdio", command: string, args?: string[], env?: Record<string, string> }` -- the `type` field is optional and defaults to stdio (from ARCHITECTURE.md verified type)
- Chrome DevTools MCP command is `npx @anthropic-ai/chrome-devtools-mcp@latest` -- already in production use via the `/gsd:uat-auto` workflow (from existing uat-auto.md)
- `SDKResultMessage` includes `duration_ms`, `duration_api_ms`, `num_turns`, `total_cost_usd`, `usage`, `modelUsage` -- all available for logging (from FEATURES.md)
- Cold start overhead is `duration_ms - duration_api_ms` and is approximately 12 seconds per `query()` call per SDK documentation (from PITFALLS.md Pitfall 7)
- The `runAutomatedUAT()` function calls `runStepWithRetry('/gsd:uat-auto', 'automated-uat', 'uat')` -- the stepType `'uat'` and stepName `'automated-uat'` both exist; MCP resolution should key off stepName `'automated-uat'` since that is the step-specific identifier (from autopilot.mjs line 1031)
- `handleMessage()` already logs cost and turns for result messages -- this phase enhances those logs with duration and cold start data
- `printFinalReport()` currently prints only `totalIterations` -- adding cumulative cost is a small addition

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runAgentStep()` (lines 298-345): Already accepts `mcpServers` parameter and passes it to `query()` at line 316 -- only needs MCP server resolution at call sites
- `handleMessage()` (lines 253-296): Already logs cost and turns from result messages -- needs enhancement for duration_ms, duration_api_ms, and cold start
- `getConfig()` (lines 187-203): Config loading with dot-notation traversal -- used to read `uat.chrome_mcp_enabled`
- `logMsg()` (lines 119-122): Session logging to file -- used for all observability output
- `printFinalReport()` (lines 1201-1212): Currently prints total iterations -- add cumulative cost line

### Established Patterns
- **Config 3-touch-point pattern:** CONFIG_DEFAULTS in config.cjs + KNOWN_SETTINGS_KEYS in cli.cjs + validateSetting in cli.cjs + KNOWN_SETTINGS_KEYS in validation.cjs -- new `uat.chrome_mcp_enabled` key must be added to all locations
- **Step type flow:** `runStep(prompt, stepName, stepType)` and `runStepCaptured(prompt, stepName, outputFile, stepType)` pass stepType to `getMaxTurns()` -- same flow path for MCP server resolution
- **Return shape extension:** `runAgentStep()` already returns `{ exitCode, stdout, costUsd, subtype }` -- extended in Phase 99; adding `durationMs` and `numTurns` follows the same pattern
- **Factory function pattern for step config:** `STEP_MCP_SERVERS['automated-uat']` as a function (`() => servers`) allows conditional logic (config check) at call time

### Integration Points
- `runStep()` line 433: Add `mcpServers: STEP_MCP_SERVERS[stepName]?.() || {}` to the `runAgentStep()` call
- `runStepCaptured()` line 621: Add `mcpServers: STEP_MCP_SERVERS[stepName]?.() || {}` to the `runAgentStep()` call
- `handleMessage()` result case lines 280-294: Enhance with `duration_ms`, `duration_api_ms`, cold start logging
- `runAgentStep()` line 345 return: Add `durationMs` and `numTurns` fields from `resultMsg`
- `runAgentStep()` after result processing: Increment `cumulativeCostUsd`
- `printFinalReport()` line 1210: Add `Cumulative cost: $X.XXXX` line
- `config.cjs` CONFIG_DEFAULTS: Add `uat.chrome_mcp_enabled: true`
- `cli.cjs` KNOWN_SETTINGS_KEYS: Add `uat`, `uat.chrome_mcp_enabled`
- `cli.cjs` validateSetting: Add boolean validation for `uat.chrome_mcp_enabled`
- `validation.cjs` KNOWN_SETTINGS_KEYS: Add `uat`

</code_context>

<deferred>
## Deferred Ideas

- **`gsd debug-session` command (SESS-01):** Future requirement -- uses `listSessions()` / `getSessionMessages()` for post-mortem debugging
- **Session ID display in step banners (SESS-02):** Future requirement -- not part of v3.2 scope
- **V2 SDK interface evaluation (SDKV2-01):** Deferred until V2 reaches stable release
- **Per-step effort tuning (EFF-01):** Future requirement for cost optimization

</deferred>

---

*Phase: 100-mcp-configuration-and-observability*
*Context gathered: 2026-03-24 via auto-context*
