---
phase: 98-core-sdk-integration
plan: 01
subsystem: infra
tags: [claude-agent-sdk, zod, esm, abort-controller, hooks]

requires:
  - phase: 97
    provides: v3.1 complete autopilot with streaming support
provides:
  - "@anthropic-ai/claude-agent-sdk and zod production dependencies"
  - "runAgentStep() wrapping SDK query() with bypassPermissions"
  - "handleMessage() typed switch for assistant/system/result messages"
  - "buildStepHooks() PostToolUse/Stop stall detection"
  - "AbortController in SIGINT/SIGTERM signal handlers"
affects: [98-02, phase-99, phase-100]

tech-stack:
  added: ["@anthropic-ai/claude-agent-sdk ^0.2.81", "zod ^4.3.6"]
  patterns: ["SDK query() AsyncGenerator iteration", "PostToolUse hook stall detection", "AbortController signal cleanup"]

key-files:
  created: []
  modified: [package.json, package-lock.json, get-shit-done/scripts/autopilot.mjs]

key-decisions:
  - "Placed SDK functions between Config Loading and legacy Streaming Functions sections"
  - "Exposed _armStallTimer/_clearStallTimer on hooks object for message-loop re-arm and finally cleanup"
  - "Write outputFile before checking quiet mode to ensure error context capture in all modes"

patterns-established:
  - "SDK invocation pattern: query() with bypassPermissions + allowDangerouslySkipPermissions + claude_code preset"
  - "Stall detection via PostToolUse hooks with unref() timers and message-loop re-arm"
  - "Module-scope activeAbortController for signal handler to SDK bridge"

requirements-completed: [SDK-01, SDK-02, SDK-03, MSG-01, MSG-02, SAFE-03, SAFE-04]

duration: 5min
completed: 2026-03-24
---

# Phase 98: Core SDK Integration — Plan 01 Summary

**Installed Agent SDK, implemented runAgentStep/handleMessage/buildStepHooks, updated signal handlers with AbortController**

## What Changed

1. **Dependencies:** Added `@anthropic-ai/claude-agent-sdk` (^0.2.81) and `zod` (^4.3.6) as production deps. Bumped `engines.node` from `>=16.7.0` to `>=18.0.0`.

2. **SDK Import:** Added `import { query } from '@anthropic-ai/claude-agent-sdk'` at top of autopilot.mjs.

3. **Removed `which('node')` check:** The SDK manages its own subprocess requirements. `which('claude')` check preserved since the SDK spawns Claude Code internally.

4. **`buildStepHooks()`:** Creates PostToolUse and Stop hook arrays for stall detection. PostToolUse re-arms a setTimeout-based timer on each tool completion. Stop clears it. All timers use `.unref()` to avoid keeping the process alive. Exposes `_armStallTimer`/`_clearStallTimer` for the message loop and finally block.

5. **`handleMessage()`:** Typed switch on `message.type` -- writes assistant text to stdout, tool_use names to stderr (matching existing output parity). Logs session ID and model from system init messages. Logs cost/turns/subtype from result messages. Always writes to outputFile regardless of quiet mode.

6. **`runAgentStep()`:** Wraps SDK `query()` with all required options (bypassPermissions, claude_code preset, project settingSources, disallowedTools). Iterates messages, accumulates lastAssistantText for error context, returns `{ exitCode, stdout, costUsd }`. Creates AbortController per call, sets/clears module-scope activeAbortController.

7. **Signal handlers:** SIGINT and SIGTERM now call `activeAbortController?.abort()` before cleanup and exit.

## Self-Check: PASSED

- [x] SDK import present
- [x] which('node') removed
- [x] activeAbortController at module scope
- [x] Signal handlers call abort()
- [x] buildStepHooks returns PostToolUse and Stop hooks
- [x] handleMessage handles assistant, system, result types
- [x] runAgentStep wraps query() with correct options
- [x] Legacy functions (runClaudeStreaming, displayStreamEvent) preserved
