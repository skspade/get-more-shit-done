# Requirements: GSD Autopilot

**Defined:** 2026-03-24
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v3.2 Requirements

Requirements for Autopilot Agent SDK Migration. Each maps to roadmap phases.

### SDK Integration

- [x] **SDK-01**: Install `@anthropic-ai/claude-agent-sdk` and `zod` (peer dep), bump `engines.node` to `>=18.0.0`
- [x] **SDK-02**: Import `query` from SDK in autopilot.mjs; remove `which('node')` prerequisite check
- [x] **SDK-03**: Implement `runAgentStep()` wrapping SDK `query()` with `permissionMode: "bypassPermissions"`, `allowDangerouslySkipPermissions: true`, `systemPrompt` preset, `settingSources: ["project"]`, `disallowedTools: ["AskUserQuestion"]`

### Message Handling

- [x] **MSG-01**: Implement `handleMessage()` with typed switch on `message.type` (assistant, system, result) replacing `displayStreamEvent()` NDJSON parsing
- [x] **MSG-02**: Accumulate `lastAssistantText` from assistant messages for error context when result subtype is not `success`
- [ ] **MSG-03**: Log session ID, cost (`total_cost_usd`), turns (`num_turns`), and duration (`duration_ms`) from result messages

### Safety Mechanisms

- [ ] **SAFE-01**: Implement per-step-type `maxTurns` limits via `TURNS_CONFIG` (discuss:100, plan:150, execute:300, verify:100, debug:50, audit:100, uat:150, completion:50), configurable via config.json
- [ ] **SAFE-02**: Implement optional `maxBudgetUsd` per-step cost cap via config key `autopilot.max_budget_per_step_usd`
- [x] **SAFE-03**: Implement `buildStepHooks()` with `PostToolUse` stall detection replacing custom `armStallTimer()`/`setTimeout` pattern, plus message-loop stall re-arm for thinking-heavy turns
- [x] **SAFE-04**: Update SIGINT/SIGTERM handlers to store `AbortController` reference and call `abort()` before `process.exit()` to prevent orphaned Claude processes

### Caller Migration

- [x] **CALL-01**: Wire `runAgentStep()` to `runStep()` and `runStepCaptured()` (replacing `runClaudeStreaming()` at primary call sites)
- [ ] **CALL-02**: Wire `runAgentStep()` to all 3 debug retry call sites in `runStepWithRetry()` and `runVerifyWithDebugRetry()`
- [ ] **CALL-03**: Update debug retry logic to only trigger on `error_during_execution` subtype (not `error_max_turns` or `error_max_budget_usd`)

### MCP and Observability

- [ ] **MCP-01**: Implement per-step MCP server configuration via `STEP_MCP_SERVERS` mapping; Chrome DevTools MCP for UAT steps only
- [ ] **OBS-01**: Log per-step cost, turns, duration, and cold start overhead (`duration_ms` - `duration_api_ms`) to session log
- [ ] **OBS-02**: Add cumulative cost summary to `printFinalReport()`

### Cleanup

- [ ] **CLN-01**: Delete `runClaudeStreaming()`, `displayStreamEvent()`, quiet-mode CLI branch, and `which('node')` check
- [ ] **CLN-02**: Register all new config keys in `config.cjs` (`autopilot.turns.*`, `autopilot.max_budget_per_step_usd`, `autopilot.max_turns_per_step`, `uat.chrome_mcp_enabled`)

## Future Requirements

### Session Tooling

- **SESS-01**: `gsd debug-session <id>` command leveraging `listSessions()` / `getSessionMessages()` for post-mortem debugging
- **SESS-02**: Session ID display in step banners for easy correlation

### SDK Evolution

- **SDKV2-01**: Evaluate V2 SDK interface (`createSession`/`send`/`stream`) when it reaches stable release
- **EFF-01**: Per-step `effort` tuning (`'low' | 'medium' | 'high' | 'max'`) for cost optimization

## Out of Scope

| Feature | Reason |
|---------|--------|
| Session resume across steps | Defeats fresh context window design; each query must start fresh |
| `includePartialMessages: true` streaming | Token-level events create massive message volume with no benefit |
| In-process MCP servers via `createSdkMcpServer()` | stdio MCP works fine; in-process adds Zod schema complexity |
| File checkpointing via `enableFileCheckpointing` | Conflicts with git-based circuit breaker progress tracking |
| Custom `canUseTool` permission callback | `bypassPermissions` already approves everything; callbacks would block |
| V2 preview SDK interface | Explicitly marked unstable; will require re-migration |
| Programmatic agent definitions via SDK `agents` option | GSD already defines agents via markdown files |
| Dynamic `setPermissionMode()` switching | Autopilot is fully autonomous; all steps need full permissions |
| `outputFormat` for structured JSON output | GSD commands produce markdown, not JSON; `result` field suffices |
| Legacy CLI fallback | Clean break; no `--legacy` or dual-engine pattern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SDK-01 | Phase 98 | Verified |
| SDK-02 | Phase 98 | Verified |
| SDK-03 | Phase 98 | Verified |
| MSG-01 | Phase 98 | Verified |
| MSG-02 | Phase 98 | Verified |
| MSG-03 | Phase 102 | Pending |
| SAFE-01 | Phase 101 | Pending |
| SAFE-02 | Phase 101 | Pending |
| SAFE-03 | Phase 98 | Verified |
| SAFE-04 | Phase 98 | Verified |
| CALL-01 | Phase 98 | Verified |
| CALL-02 | Phase 101 | Pending |
| CALL-03 | Phase 101 | Pending |
| MCP-01 | Phase 102 | Pending |
| OBS-01 | Phase 102 | Pending |
| OBS-02 | Phase 102 | Pending |
| CLN-01 | Phase 101 | Pending |
| CLN-02 | Phase 101 | Pending |

**Coverage:**
- v3.2 requirements: 18 total
- Verified (Phase 98): 8
- Pending verification (Phase 101): 6
- Pending verification (Phase 102): 4
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation*
