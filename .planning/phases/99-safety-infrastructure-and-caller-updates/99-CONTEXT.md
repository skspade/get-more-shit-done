# Phase 99: Safety Infrastructure and Caller Updates - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

All 5 call sites use the SDK with per-step turn limits and optional budget caps, debug retry only fires on actual execution errors, and old CLI subprocess code is deleted. This phase delivers the TURNS_CONFIG per-step-type limits, optional maxBudgetUsd cost caps, debug retry caller migration with error subtype filtering, config key registration, and removal of `runClaudeStreaming()`/`displayStreamEvent()` legacy code.

</domain>

<decisions>
## Implementation Decisions

### Per-Step Turn Limits (SAFE-01)
- Implement `TURNS_CONFIG` object mapping step types to default maxTurns values: discuss:100, plan:150, execute:300, verify:100, debug:50, audit:100, uat:150, completion:50
- Each step type is configurable via config.json key `autopilot.turns.<stepType>` (e.g., `autopilot.turns.execute`)
- `runAgentStep()` callers pass `maxTurns` derived from step type; `runStep()` and `runStepCaptured()` accept a `stepType` parameter (Claude's Decision: step type must flow from caller to runAgentStep so the correct limit is applied)
- Exceeding the turn limit produces an `error_max_turns` result subtype from the SDK -- `runAgentStep()` already returns exitCode 1 for non-success subtypes
- Add a `getMaxTurns(stepType)` helper that reads `getConfig('autopilot.turns.<stepType>', TURNS_CONFIG[stepType])` (Claude's Decision: centralizes turn limit resolution in one place, avoids scattered getConfig calls)

### Budget Caps (SAFE-02)
- Setting `autopilot.max_budget_per_step_usd` in config.json causes all steps to stop when the cost cap is reached
- `runAgentStep()` already accepts `maxBudgetUsd` -- callers resolve it via `getConfig('autopilot.max_budget_per_step_usd', undefined)`
- When not configured (undefined), no budget cap is enforced -- this is the default behavior
- Exceeding the budget produces an `error_max_budget_usd` result subtype from the SDK

### Debug Retry Migration (CALL-02, CALL-03)
- Wire `runAgentStep()` to all 3 debug retry call sites: `runStepWithRetry()` line 741, `runVerifyWithDebugRetry()` lines 785 and 823, replacing `runClaudeStreaming(debugPrompt)`
- Debug retry only triggers when a step fails with `error_during_execution` subtype -- hitting turn limits or budget caps does NOT trigger debug retry
- `runAgentStep()` must expose the result subtype to callers so retry logic can differentiate (Claude's Decision: return `subtype` in the result object alongside exitCode/stdout/costUsd)
- When `error_max_turns` or `error_max_budget_usd` occurs, the step halts immediately without debug retry -- write failure state and report directly (Claude's Decision: these are intentional safety limits, not bugs to debug)

### Legacy Code Deletion (CLN-01)
- Delete `runClaudeStreaming()` function (lines 355-405) entirely
- Delete `displayStreamEvent()` function (lines 340-353) entirely
- Delete the quiet-mode CLI branch inside `runClaudeStreaming()` (the `$\`claude -p\`` fallback)
- Remove the `createInterface` import usage for NDJSON parsing (keep the import since `askTTY()` still uses it)
- The `which('node')` check was already removed in Phase 98

### Config Key Registration (CLN-02)
- Add to CONFIG_DEFAULTS in config.cjs: `autopilot.turns.discuss: 100`, `autopilot.turns.plan: 150`, `autopilot.turns.execute: 300`, `autopilot.turns.verify: 100`, `autopilot.turns.debug: 50`, `autopilot.turns.audit: 100`, `autopilot.turns.uat: 150`, `autopilot.turns.completion: 50`, `autopilot.max_budget_per_step_usd: null`, `autopilot.max_turns_per_step: 200`
- Add all new keys to KNOWN_SETTINGS_KEYS in cli.cjs (the full 33-key list)
- Add top-level `autopilot` key variants to KNOWN_SETTINGS_KEYS in validation.cjs (the 15-key list) (Claude's Decision: validation.cjs uses top-level keys only for config.json structure validation)
- Add validation rules in `validateSetting()` for turn limit keys (must be positive integer) and budget key (must be positive number or null)

### Claude's Discretion
- Exact ordering of TURNS_CONFIG keys
- Whether `getMaxTurns()` is a standalone function or inlined into callers
- Log message format for turn limit and budget cap events
- Whether to use `null` or omit the key entirely for "no budget cap" default in CONFIG_DEFAULTS
- Internal structure of the result object returned by `runAgentStep()` (field names for subtype)

</decisions>

<specifics>
## Specific Ideas

- The SDK `query()` already enforces `maxTurns` and `maxBudgetUsd` -- when either limit is hit, the generator yields a result message with the corresponding `error_max_turns` or `error_max_budget_usd` subtype. No custom enforcement logic is needed in `runAgentStep()`.
- The debug retry call sites in `runStepWithRetry()` (line 741) and `runVerifyWithDebugRetry()` (lines 785 and 823) currently call `runClaudeStreaming(debugPrompt)`. These must be changed to `runAgentStep(debugPrompt, { ... })` with `stepType: 'debug'` to get the debug turn limit (50).
- The `runStepWithRetry()` function currently triggers retry on ANY non-zero exit code. The CALL-03 requirement narrows this: only `error_during_execution` should trigger retry. `error_max_turns` and `error_max_budget_usd` should skip retry and go directly to failure reporting.
- The config 3-touch-point pattern requires changes in 3 files: `config.cjs` (CONFIG_DEFAULTS), `cli.cjs` (KNOWN_SETTINGS_KEYS + validateSetting), and `validation.cjs` (KNOWN_SETTINGS_KEYS for top-level keys).
- Turn limit config keys use dot notation: `autopilot.turns.discuss`, `autopilot.turns.plan`, etc. The `getConfig()` function already supports dot-notation traversal, so `getConfig('autopilot.turns.execute', 300)` works if `config.json` contains `{ "autopilot": { "turns": { "execute": 300 } } }`.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runAgentStep()` (lines 289-336): Already implemented in Phase 98 with `maxTurns` and `maxBudgetUsd` parameters -- this phase adds per-step-type resolution and exposes subtype in return value
- `getConfig()` (lines 187-203): Config loading with dot-notation traversal and CONFIG_DEFAULTS fallback -- used to resolve turn limits and budget caps
- `handleMessage()` (lines 244-287): Already handles `error_max_turns` and `error_max_budget_usd` subtypes with stderr warnings and log messages
- `constructDebugPrompt()` (lines 514-558): Debug prompt builder -- unchanged, used by retry call sites after migration
- `writeFailureState()` / `writeFailureReport()`: Failure reporting functions -- called directly (no retry) when turn/budget limits are hit

### Established Patterns
- **Config 3-touch-point pattern:** CONFIG_DEFAULTS + KNOWN_SETTINGS_KEYS + validateSetting -- all new config keys must be added to all 3 locations
- **Return shape convention:** `runAgentStep()` returns `{ exitCode, stdout, costUsd }` -- adding `subtype` extends this established pattern
- **Step function call chain:** `runStep()` / `runStepCaptured()` -> `runAgentStep()` -> SDK `query()` -- debug retry sits in `runStepWithRetry()` / `runVerifyWithDebugRetry()` which call `runStepCaptured()` for the main step and currently `runClaudeStreaming()` for the debug step

### Integration Points
- `runStepWithRetry()` line 741: Replace `runClaudeStreaming(debugPrompt)` with `runAgentStep(debugPrompt, { maxTurns: getMaxTurns('debug') })`
- `runVerifyWithDebugRetry()` line 785: Replace `runClaudeStreaming(debugPrompt)` with `runAgentStep(debugPrompt, { maxTurns: getMaxTurns('debug') })`
- `runVerifyWithDebugRetry()` line 823: Replace `runClaudeStreaming(debugPrompt)` with `runAgentStep(debugPrompt, { maxTurns: getMaxTurns('debug') })`
- `runStep()` line 492: Pass stepType-aware maxTurns to `runAgentStep()`
- `runStepCaptured()` line 680: Pass stepType-aware maxTurns to `runAgentStep()`
- `config.cjs` CONFIG_DEFAULTS: Add turn limit and budget cap defaults
- `cli.cjs` KNOWN_SETTINGS_KEYS: Add turn limit keys (`autopilot.turns.*`) and budget key
- `cli.cjs` validateSetting: Add validation for new keys
- `validation.cjs` KNOWN_SETTINGS_KEYS: Add `autopilot` (already present as top-level)

</code_context>

<deferred>
## Deferred Ideas

- **Per-step MCP server configuration (MCP-01):** Phase 100 -- Chrome DevTools MCP for UAT steps
- **Per-step cost/turn/duration logging (MSG-03, OBS-01):** Phase 100 -- detailed observability logging from result messages
- **Cumulative cost reporting in printFinalReport (OBS-02):** Phase 100
- **`gsd debug-session` command (SESS-01):** Future requirement, not v3.2 scope
- **V2 SDK interface evaluation (SDKV2-01):** Deferred until V2 reaches stable release
- **Per-step effort tuning (EFF-01):** Future requirement

</deferred>

---

*Phase: 99-safety-infrastructure-and-caller-updates*
*Context gathered: 2026-03-24 via auto-context*
