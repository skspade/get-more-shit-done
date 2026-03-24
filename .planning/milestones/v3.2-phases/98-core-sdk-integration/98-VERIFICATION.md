---
phase: 98-core-sdk-integration
status: passed
verified: 2026-03-24
verifier: orchestrator (inline)
---

# Phase 98: Core SDK Integration - Verification

## Phase Goal
Autopilot can invoke Claude through the Agent SDK instead of CLI subprocesses, with correct permissions, message handling, stall detection, and signal cleanup.

## Success Criteria Verification

### 1. Running autopilot with a discuss or plan step completes successfully using the SDK `query()` call instead of spawning `claude -p` as a subprocess
**Status:** PASSED
- `runStep()` calls `runAgentStep(prompt)` which wraps SDK `query()`
- `runStepCaptured()` calls `runAgentStep(prompt, { outputFile })` which wraps SDK `query()`
- Both verified by grep: exactly 2 `await runAgentStep` calls at these sites

### 2. Assistant text appears on stdout and tool call names appear on stderr during execution, matching the output parity of the old streaming approach
**Status:** PASSED
- `handleMessage()` writes `block.text` to `process.stdout` for text blocks
- `handleMessage()` writes `block.name` to `process.stderr` for tool_use blocks
- Same diamond symbol prefix as existing `displayStreamEvent`

### 3. When a step fails (non-success result subtype), the error context includes the last assistant text, not an empty string
**Status:** PASSED
- `lastAssistantText` accumulated from every assistant message's text blocks
- On non-success result, `runAgentStep` returns `lastAssistantText` as `stdout` instead of empty string
- 3 references to `lastAssistantText` in the file confirm accumulation and use

### 4. Pressing Ctrl-C during a running step terminates both the parent process and the SDK subprocess cleanly without orphaned processes
**Status:** PASSED
- `activeAbortController` stored at module scope
- SIGINT handler calls `activeAbortController?.abort()` before `process.exit(130)`
- SIGTERM handler calls `activeAbortController?.abort()` before `process.exit(0)`
- `AbortController` passed to `query()` via `options.abortController`
- Controller reset to `null` in `finally` block

### 5. Stall detection fires a warning when no tool use occurs within the configured timeout, replacing the old NDJSON-line-based timer
**Status:** PASSED
- `buildStepHooks()` returns PostToolUse hook that re-arms stall timer on each tool completion
- Stall timer also re-armed in the `for await` message loop (handles thinking-heavy turns)
- Stop hook clears stall timer
- All timers use `.unref()` (4 occurrences)
- Stall timer cleared in `finally` block
- Uses existing `autopilot.stall_timeout_ms` config key with 300000ms default

## Requirement Coverage

| Req ID | Status | Evidence |
|--------|--------|----------|
| SDK-01 | Completed | package.json has @anthropic-ai/claude-agent-sdk and zod, engines.node is >=18.0.0 |
| SDK-02 | Completed | `import { query } from '@anthropic-ai/claude-agent-sdk'` present, which('node') removed |
| SDK-03 | Completed | runAgentStep wraps query() with bypassPermissions, allowDangerouslySkipPermissions, claude_code preset, project settingSources, disallowedTools |
| MSG-01 | Completed | handleMessage with switch on assistant/system/result |
| MSG-02 | Completed | lastAssistantText accumulated, returned for error subtypes |
| SAFE-03 | Completed | buildStepHooks with PostToolUse/Stop, message-loop re-arm, unref timers |
| SAFE-04 | Completed | AbortController in signal handlers, passed to query options |
| CALL-01 | Completed | runStep and runStepCaptured call runAgentStep |

## Test Suite
- 780/781 tests pass (1 pre-existing failure unrelated to SDK changes: roadmap analyze missing phase details)
- Module imports resolve without errors

## Must-Haves Check

All must_haves from both plans verified:
- [x] SDK and zod in package.json dependencies
- [x] engines.node is >=18.0.0
- [x] runAgentStep exists and calls SDK query()
- [x] handleMessage exists with typed switch
- [x] buildStepHooks exists with PostToolUse and Stop hooks
- [x] Signal handlers call abort()
- [x] which('node') removed
- [x] runStep calls runAgentStep
- [x] runStepCaptured calls runAgentStep with outputFile
- [x] Debug retry sites still use runClaudeStreaming (Phase 99)
- [x] Return type includes { exitCode, stdout, costUsd }
