# Milestone Context

**Source:** Brainstorm session (Autopilot Agent SDK Migration)
**Design:** .planning/designs/2026-03-24-autopilot-agent-sdk-migration-design.md

## Milestone Goal

Migrate the GSD autopilot (autopilot.mjs) from spawning Claude CLI subprocesses to using the Claude Agent SDK (@anthropic-ai/claude-agent-sdk). Clean break — no legacy CLI fallback. Full SDK adoption: hooks, maxTurns, maxBudgetUsd, per-step MCP servers, typed message streaming. Separate query() calls per step for fresh context isolation.

## Features

### Dependencies and Integration

Install @anthropic-ai/claude-agent-sdk as a new npm dependency. Import `query` from the SDK. Keep zx for remaining shell commands (gsdTools, git, find). File stays as .mjs (ESM). Same authentication — SDK spawns Claude Code subprocess internally.

### Core Step Execution

Replace `runClaudeStreaming()` with `runAgentStep()` wrapping SDK `query()` calls. Each step gets its own query() with `permissionMode: "bypassPermissions"`, `cwd: PROJECT_DIR`, `settingSources: ["project"]`, and configurable `maxTurns`/`maxBudgetUsd`. Six call sites migrate from CLI subprocess to SDK. `runStep()` and `runStepCaptured()` stay as thin wrappers.

### Stream Handling and Output Display

Replace `displayStreamEvent()` (NDJSON parsing) with `handleMessage()` that handles typed SDK messages (assistant, system, result). Output parity: assistant text to stdout, tool names to stderr with diamond prefix. New: cost and turn tracking logged per step via result messages.

### Safety Mechanisms

Four layers: (1) maxTurns per step type (discuss=100, plan=150, execute=300, verify=100, debug=50, audit=100, uat=150, completion=50), configurable via config.json. (2) maxBudgetUsd optional per-step cost cap. (3) Stall detection via PostToolUse hooks replacing custom setTimeout timers. (4) Circuit breaker preserved as-is for cross-step progress tracking.

### Debug Retry Infrastructure

`runStepWithRetry()` and `runVerifyWithDebugRetry()` stay structurally identical. Each attempt invokes `runAgentStep()` instead of `runClaudeStreaming()`. Debug steps get lower maxTurns (default 50). `constructDebugPrompt()`, failure state management, and failure reports unchanged.

### Verification Gate, Milestone Audit, and MCP Configuration

TTY verification gate preserved unchanged. Milestone audit/UAT/completion route through same wrappers with SDK underneath. New: per-step MCP server configuration — UAT steps can receive Chrome DevTools MCP, other steps get no MCP servers by default. Step-type to MCP mapping pattern via STEP_MCP_SERVERS config. Deleted: runClaudeStreaming(), displayStreamEvent(), which('node') check, quiet-mode CLI branch.
