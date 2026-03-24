# Project Research Summary

**Project:** Autopilot Agent SDK Migration (v3.2)
**Domain:** Claude Agent SDK migration — replacing CLI subprocess spawning with SDK `query()` calls in autopilot.mjs
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

This is a targeted dependency migration of `autopilot.mjs`: replacing `runClaudeStreaming()` (which spawns `claude -p` via zx `$`) with `runAgentStep()` (which calls `query()` from `@anthropic-ai/claude-agent-sdk`). The SDK is ESM-only, ships with full TypeScript types, has zero npm dependencies of its own (zod is a required peer), and works under the same Claude Code CLI authentication model. The migration scope is intentionally narrow — only the Claude invocation layer changes. The phase loop, circuit breaker, CJS module bridge, gsd-tools shell layer, and all state management are untouched.

The recommended approach is a 3-phase sequential build corresponding to the 7-step build order documented in ARCHITECTURE.md: first implement the core invocation layer and all critical safety configuration, then update all caller sites and add turn/budget safety controls, then layer on per-step MCP configuration and observability. This order ensures each phase is independently verifiable before the next and avoids the largest risk: a partially migrated state where both old and new code paths are live simultaneously.

The critical risks are concentrated entirely in Phase 1 and are all well-documented in official SDK sources. The most dangerous is the two-part permission configuration — both `permissionMode: "bypassPermissions"` AND `allowDangerouslySkipPermissions: true` are required, unlike the single `--dangerously-skip-permissions` CLI flag. The second is the SDK's breaking default (since v0.1.0) of NOT loading `settingSources` or the Claude Code system prompt — both must be explicitly set or the agent will ignore all CLAUDE.md instructions. The third is treating result subtypes as a binary exit code, which causes the debug retry loop to fire on budget-exceeded and turn-limit outcomes that are not retryable execution errors. All three are already correctly specified in the design document; the risk is implementation drift.

## Key Findings

### Recommended Stack

The only new dependencies are `@anthropic-ai/claude-agent-sdk@^0.2.81` and `zod@^4.0.0` (required peer). The SDK is actively maintained (66 releases, latest published 2026-03-20), ESM-only (`sdk.mjs`), and requires Node.js >=18.0.0. The project's `package.json` `engines` field must be bumped from `>=16.7.0` to `>=18.0.0` — the actual runtime is v22.20.0 so there is no practical impact, only a correctness fix. The SDK spawns Claude Code as a subprocess internally, so no authentication changes are needed. The existing `which('claude')` prerequisite check remains valid; `which('node')` can be removed since the SDK manages its own Node.js requirement.

**Core technologies:**
- `@anthropic-ai/claude-agent-sdk@^0.2.81`: replaces CLI subprocess spawning — ESM, ships `.mjs` + `.d.ts`, zero npm deps, same CLI auth model
- `zod@^4.0.0`: required peer dependency of the SDK — not used directly in project code
- `engines.node` bump to `>=18.0.0`: correctness fix only, runtime already at v22.20.0
- All existing stack (zx, js-yaml, CJS bridge, gsd-tools, Chrome MCP): fully unchanged

### Expected Features

The migration preserves all existing autopilot functionality while adding observability and safety capabilities that were impossible with CLI subprocess spawning. Every feature maps directly to a verified SDK API.

**Must have (table stakes — v3.2):**
- `runAgentStep()` wrapping `query()` — core replacement covering all 5 `runClaudeStreaming()` call sites
- `handleMessage()` typed dispatch — replaces `displayStreamEvent()` NDJSON parsing with SDK type discrimination
- `permissionMode: "bypassPermissions"` + `allowDangerouslySkipPermissions: true` — replaces single CLI flag; both fields required
- `systemPrompt: { type: "preset", preset: "claude_code" }` + `settingSources: ["project"]` — explicit requirements due to SDK v0.1.0 breaking change
- Per-step `maxTurns` via `TURNS_CONFIG` — configurable per step type (discuss:100, plan:150, execute:300, verify:100, debug:50, audit:100, uat:150, completion:50)
- `buildStepHooks()` with `PostToolUse` stall detection — replaces custom NDJSON-line-based stall timer; stall timer also re-armed in the message loop to handle thinking-heavy turns
- Optional `maxBudgetUsd` per-step cost cap — new capability impossible with CLI subprocess approach
- Per-step MCP server configuration — Chrome DevTools MCP only attached to UAT steps
- Cost and turn tracking from `SDKResultMessage` — `total_cost_usd`, `num_turns`, `duration_ms` now always available
- `disallowedTools: ["AskUserQuestion"]` — blocks autonomous agent from hanging on interactive prompts
- Config key registration for all new settings in `config.cjs`
- Delete `runClaudeStreaming()`, `displayStreamEvent()`, and `which('node')` check

**Should have (v3.2 if time permits):**
- `AbortController` integration with SIGINT/SIGTERM handlers — cleaner cancellation, prevents orphaned Claude subprocesses
- Session ID logging in step banners — improves post-mortem debugging

**Defer (v3.2.x and beyond):**
- `gsd debug-session <id>` command leveraging `listSessions()` / `getSessionMessages()`
- V2 SDK interface evaluation (`createSession` / `send` / `stream`) — explicitly marked preview/unstable, do not use until stable
- Programmatic agent definitions via SDK `agents` option
- Per-step `effort` tuning (`'low' | 'medium' | 'high' | 'max'`)

**Anti-features confirmed — do NOT build:**
- Session resume across steps (defeats fresh context window design; each query must start fresh)
- `includePartialMessages: true` streaming (token-level events create massive message volume with no benefit)
- In-process MCP servers via `createSdkMcpServer()` (adds Zod schema complexity; stdio MCP works fine)
- File checkpointing via `enableFileCheckpointing` (conflicts with git-based circuit breaker)

### Architecture Approach

The architecture change is surgical: `runAgentStep()` is a drop-in replacement for `runClaudeStreaming()` at all 5 call sites, all of which converge to one function. The module layer boundary is fully preserved — autopilot.mjs (ESM) calls the SDK (ESM), and the existing `createRequire()` bridge for CJS modules is unaffected. The data flow changes from NDJSON-over-readline to typed `AsyncGenerator<SDKMessage>` iteration, eliminating all JSON.parse try/catch. Output parity is maintained: assistant text to stdout, tool names to stderr. New capability: `SDKResultMessage` provides `total_cost_usd`, `num_turns`, `duration_ms`, and per-model token usage.

**Major components:**
1. `runAgentStep()` — NEW: wraps `query()` with all project-specific options (cwd, permissions, hooks, maxTurns, MCP); returns `{ exitCode, stdout, costUsd }`
2. `handleMessage()` — NEW: typed switch on `message.type` replaces NDJSON line parsing; accumulates `lastAssistantText` for error-subtype output capture; writes messages to outputFile as `JSON.stringify(message)`
3. `buildStepHooks()` — NEW: PostToolUse stall timer + Stop cleanup; stall re-arming also occurs in the main message loop to handle thinking-heavy turns without false stall warnings
4. `runStep()` / `runStepCaptured()` / `runStepWithRetry()` / `runVerifyWithDebugRetry()` — MODIFIED: internal calls change from `runClaudeStreaming()` to `runAgentStep()`; all 5 call sites mapped by line number
5. CJS module layer, gsd-tools shell layer, main phase loop, circuit breaker, signal handlers — UNCHANGED in structure; signal handlers get AbortController addition

### Critical Pitfalls

1. **Missing `allowDangerouslySkipPermissions: true`** — The SDK requires BOTH `permissionMode: "bypassPermissions"` AND this flag; setting only one causes every tool call to hang waiting for permission. Most-reported SDK GitHub issue (#14279). Both flags must be set together in Phase 1.

2. **`settingSources` and `systemPrompt` not loaded by default** — SDK v0.1.0 breaking change: CLAUDE.md files and the Claude Code system prompt do not load unless explicitly configured. Agent runs but ignores all GSD project conventions and slash commands. Always include `systemPrompt: { type: "preset", preset: "claude_code" }` and `settingSources: ["project"]`.

3. **Exit code vs result subtype semantic mismatch** — `SDKResultMessage.subtype` is a discriminated union, not a binary exit code. `error_max_turns` means productive work happened; `error_max_budget_usd` means cost cap exceeded; only `error_during_execution` is analogous to a process crash. Mapping all non-success subtypes to exit code 1 causes the debug retry loop to fire on non-retryable failures. Return `subtype` directly and switch on it in callers.

4. **Orphaned Claude processes on SIGINT** — The SDK's internal subprocess does not automatically terminate in all cases when the parent exits. Must store `AbortController` at module scope and call `abort()` before `process.exit()` in signal handlers. Known open issue (#142).

5. **`result` field only exists on success subtype** — `SDKResultMessage.result` is `undefined` on all error subtypes. Must accumulate `lastAssistantText` from `AssistantMessage` objects during iteration and use that for error context when `subtype !== "success"`. Without this, debug retry receives empty error context.

6. **`allowedTools` does NOT restrict in `bypassPermissions` mode** — `allowedTools` is additive/documentary in bypass mode; all tools are approved regardless. Must use `disallowedTools: ["AskUserQuestion"]` to block interactive prompts that would hang the autonomous loop.

7. **~12s cold start per `query()` call** — Architectural limitation, not fixable. With 50+ calls per milestone this adds ~10 minutes of overhead. Accept, log the gap between `duration_ms` and `duration_api_ms`, and communicate to users.

## Implications for Roadmap

Based on the dependency structure in research, a 3-phase build is recommended. All Phase 1 work must be complete and verified before Phase 2 begins, because Phase 2 modifies callers that depend on Phase 1's return type contract.

### Phase 1: Core SDK Integration

**Rationale:** All critical pitfalls are Phase 1 issues. The options configuration, permission strategy, message handling, return type design, signal handler updates, and output capture logic must all be correct from the first working call. This phase establishes the contract that all callers depend on.

**Delivers:** A working `runAgentStep()` that replaces `runClaudeStreaming()` at the simplest call sites (`runStep()` and `runStepCaptured()`), verified end-to-end with an actual discuss or plan step.

**Addresses:**
- Install `@anthropic-ai/claude-agent-sdk` and `zod`, bump engines field to `>=18.0.0`
- Remove `which('node')` prerequisite check
- Add `import { query } from "@anthropic-ai/claude-agent-sdk"` to autopilot.mjs
- Implement `handleMessage()` with typed switch including `lastAssistantText` accumulation
- Implement `buildStepHooks()` with PostToolUse stall timer AND message-loop stall re-arm
- Implement `runAgentStep()` with all required options (both permission flags, systemPrompt preset, settingSources, disallowedTools)
- Update SIGINT/SIGTERM handlers to store `AbortController` reference and call `abort()` before exit
- Wire `runAgentStep()` to `runStep()` (line 365) and `runStepCaptured()` (line 553)
- Return type must expose `subtype` discriminated union, NOT a synthesized exit code

**Avoids:** Pitfalls 1, 2, 4, 5, 6, 7, 10 — all are Phase 1 per pitfall-to-phase mapping in PITFALLS.md

### Phase 2: Safety Infrastructure and Caller Updates

**Rationale:** Once the core function and its return type are verified, update the remaining 3 call sites (debug retry paths) and implement the turn-limit and budget controls. These callers need the Phase 1 return type contract to be stable before they are modified.

**Delivers:** Complete migration of all 5 `runClaudeStreaming()` call sites; `maxTurns` enforcement per step type; `maxBudgetUsd` optional cap; correct debug retry behavior (only on `error_during_execution`); deletion of all old code.

**Addresses:**
- Replace `runClaudeStreaming(debugPrompt)` at lines 614, 658, 696 with `runAgentStep(debugPrompt, { maxTurns: TURNS_CONFIG.debug })`
- Add `TURNS_CONFIG` with per-step-type defaults
- Wire `maxBudgetUsd` from `getConfig('autopilot.max_budget_per_step_usd', undefined)`
- Update circuit breaker: do not count `error_max_turns` as zero-progress when turns > 0
- Update debug retry: only trigger on `error_during_execution` subtype
- Register all new config keys in `config.cjs` (`autopilot.turns.*`, `autopilot.max_budget_per_step_usd`, `autopilot.max_turns_per_step`)
- Delete `runClaudeStreaming()` and `displayStreamEvent()` entirely

**Avoids:** Pitfall 3 (exit code/subtype mismatch in callers), Pitfall 8 (do not use hook `continue: false` for control flow — maxTurns is the hard stop)

### Phase 3: MCP Configuration and Observability

**Rationale:** Per-step MCP server configuration and cost/turn logging are independent of the core migration and can be added once the invocation path is stable. Chrome DevTools MCP for UAT is the only non-trivial wiring.

**Delivers:** UAT steps get Chrome DevTools MCP; all other steps have no MCP schema overhead; per-step cost, turns, and timing logged to session log and final report; cold start overhead visible in timing logs.

**Addresses:**
- Add `STEP_MCP_SERVERS` mapping with Chrome DevTools config for `automated-uat` steps
- Wire `mcpServers: STEP_MCP_SERVERS[stepType]?.()` into `runAgentStep()` options
- Log `total_cost_usd`, `num_turns`, `duration_ms`, `duration_api_ms` from `SDKResultMessage` per step
- Log the gap between `duration_ms` and `duration_api_ms` to surface cold start overhead (Pitfall 7 mitigation)
- Add cumulative cost summary to `printFinalReport()`
- Session ID logging from `SDKSystemMessage` init event

**Avoids:** Pitfall 9 (stall timer lifecycle — message-loop re-arm already implemented in Phase 1 handles this)

### Phase Ordering Rationale

- Phase 1 before Phase 2: The return type contract (`subtype` discriminated union) must be finalized before updating callers. Updating callers against a wrong return type creates two bugs instead of one and is harder to diagnose.
- Phase 1 before Phase 3: MCP server config is passed inside `runAgentStep()` — the function must exist and be stable before adding MCP wiring.
- Phase 2 before Phase 3: Debug retry callers must use the correct return type before layering on observability, to avoid logging stale data from old code paths.
- Phase 3 is the only phase that could theoretically be split: cost logging and MCP config are independent. However, they share the same `runAgentStep()` options object and are both low-effort, so combining them is efficient.

### Research Flags

Phases with standard patterns (skip additional research — implementation can proceed directly):
- **Phase 1:** All SDK APIs verified from official docs with HIGH confidence. The exact implementation is specified in ARCHITECTURE.md down to function signatures and line numbers. No additional research needed.
- **Phase 2:** All config key patterns follow existing `config.cjs` conventions. Debug retry and circuit breaker logic changes are mechanical. No research needed.
- **Phase 3:** `McpStdioServerConfig` type verified from SDK reference. Chrome MCP command pattern (`npx @anthropic-ai/chrome-devtools-mcp@latest`) is already in production use. No research needed.

No phase requires a `/gsd:research-phase` call. All implementation decisions are resolved by this research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All facts verified via `npm view` and official Anthropic docs. Version, engines, ESM format, peer deps, and module structure all confirmed directly from npm registry. |
| Features | HIGH | All features verified against the TypeScript SDK reference, hooks guide, permissions guide, and sessions guide. SDK behavior edge cases confirmed from docs and GitHub issues with issue numbers. |
| Architecture | HIGH | Data flow, message types, hook signatures, and call site line numbers all verified from the TypeScript reference and agent loop docs. `handleMessage()` and `buildStepHooks()` implementations are design-ready. |
| Pitfalls | HIGH | All 10 pitfalls sourced from official docs plus confirmed GitHub issues. Recovery strategies and phase assignments provided for each. Critical pitfalls have warning signs and verification criteria. |

**Overall confidence:** HIGH

### Gaps to Address

- **SIGINT propagation through SDK subprocess (MEDIUM confidence):** The exact behavior of SIGINT through the SDK's internal subprocess is not explicitly documented. The `AbortController` + `process.exit(130)` pattern is logically correct and should be manually verified with a Ctrl-C test during a live query in Phase 1 before considering this closed.
- **`error_max_turns` circuit breaker behavior:** The recommendation to not count `error_max_turns` as zero-progress when turns > 0 is logically correct but untested against the actual circuit breaker implementation. Needs a deliberate maxTurns-hit test scenario in Phase 2.
- **Cold start timing:** The ~12s figure comes from GitHub issue #34. Actual timing may vary. Phase 3 logging will surface the real number; the 7-step build order footnote in ARCHITECTURE.md should be updated with observed values.

## Sources

### Primary (HIGH confidence)
- [npm: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — version, engines, peer deps, module format verified via `npm view`
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — architecture, subprocess spawning model, authentication
- [Agent SDK quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) — Node.js 18+ requirement, installation, basic `query()` usage
- [Agent SDK TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript) — complete `Options` type, all message types, hook types, `McpStdioServerConfig`
- [Agent SDK migration guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide) — v0.1.0 breaking changes: systemPrompt default, settingSources default, package rename
- [Agent SDK hooks guide](https://platform.claude.com/docs/en/agent-sdk/hooks) — PostToolUse/Stop lifecycle, matcher syntax, callback signature, `continue: false` behavior
- [Agent SDK permissions guide](https://platform.claude.com/docs/en/agent-sdk/permissions) — `bypassPermissions` evaluation, `allowedTools` vs `disallowedTools` semantics
- [Agent SDK sessions guide](https://platform.claude.com/docs/en/agent-sdk/sessions) — session persistence, `listSessions()`, `getSessionMessages()`
- [Agent SDK agent loop](https://platform.claude.com/docs/en/agent-sdk/agent-loop) — result subtypes, turn counting, budget enforcement, context window behavior

### Secondary (MEDIUM confidence)
- [GitHub issue #14279: Tool execution requires approval despite bypassPermissions](https://github.com/anthropics/claude-code/issues/14279) — confirms both permission flags required together
- [GitHub issue #142: Auto-terminate spawned processes](https://github.com/anthropics/claude-agent-sdk-typescript/issues/142) — orphaned process issue, no built-in cleanup
- [GitHub issue #34: ~12s overhead per query() call](https://github.com/anthropics/claude-agent-sdk-typescript/issues/34) — cold start timing benchmark
- [GitHub issue #29991: PostToolUse hook continue:false silently ignored](https://github.com/anthropics/claude-code/issues/29991) — hook control flow bug; design around with maxTurns hard stops
- [GitHub issue #38: zod v3 to v4 peer dependency upgrade](https://github.com/anthropics/claude-agent-sdk-typescript/issues/38) — confirms zod@^4.0.0 requirement context

### Tertiary (informational only)
- [TypeScript V2 preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview) — confirms V2 is unstable/preview; do not use

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
