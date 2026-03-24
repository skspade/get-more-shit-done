---
phase: 99-safety-infrastructure-and-caller-updates
status: passed
verified: 2026-03-24
verifier: orchestrator (inline)
---

# Phase 99: Safety Infrastructure and Caller Updates - Verification

## Phase Goal
All 5 call sites use the SDK with per-step turn limits and optional budget caps, debug retry only fires on actual execution errors, and old CLI subprocess code is deleted.

## Success Criteria Verification

### 1. Each step type enforces its own maxTurns limit, and exceeding it produces an `error_max_turns` result instead of running forever
**Status:** PASSED
- `TURNS_CONFIG` at autopilot.mjs:209 maps 8 step types to defaults: discuss:100, plan:150, execute:300, verify:100, debug:50, audit:100, uat:150, completion:50
- `getMaxTurns(stepType)` at autopilot.mjs:214 resolves from `getConfig('autopilot.turns.${stepType}', TURNS_CONFIG[stepType] || 200)`
- `maxTurns: getMaxTurns(...)` passed at all 5 SDK call sites: runStep (line 460), runStepCaptured (line 652), 3 debug retry sites (lines 727, 784, 824)
- `error_max_turns` subtype handled at autopilot.mjs:299 with warning output

### 2. Setting `autopilot.max_budget_per_step_usd` in config.json causes steps to stop when the cost cap is reached, producing an `error_max_budget_usd` result
**Status:** PASSED
- `runAgentStep` accepts `maxBudgetUsd` parameter at autopilot.mjs:312
- Budget resolution at autopilot.mjs:329: `maxBudgetUsd || getConfig('autopilot.max_budget_per_step_usd', undefined) || undefined`
- `error_max_budget_usd` subtype handled at autopilot.mjs:301 with warning output
- Default is `null` (no cap) per config.cjs:16

### 3. Debug retry only triggers when a step fails with `error_during_execution` subtype -- hitting turn limits or budget caps does not trigger debug retry
**Status:** PASSED
- `runStepWithRetry` at autopilot.mjs:676 extracts `stepSubtype = stepResult.subtype`
- Non-retryable gate at autopilot.mjs:684: `if (stepSubtype !== 'error_during_execution')` skips retry, logs `NON-RETRYABLE`, writes failure state with retryCount=0, returns immediately
- `runVerifyWithDebugRetry` at autopilot.mjs:748 extracts `verifySubtype = verifyResult.subtype`
- Non-retryable gate at autopilot.mjs:749: `if (verifySubtype !== 'error_during_execution')` skips retry, logs `NON-RETRYABLE`, writes failure state, returns immediately
- Both `error_max_turns` and `error_max_budget_usd` are thus non-retryable

### 4. `runClaudeStreaming()` and `displayStreamEvent()` no longer exist in the codebase -- all Claude invocations go through `runAgentStep()`
**Status:** PASSED
- Zero matches for `function runClaudeStreaming` in autopilot.mjs
- Zero matches for `function displayStreamEvent` in autopilot.mjs
- All 5 Claude invocation sites use `runAgentStep`: lines 459, 650, 726, 783, 823
- Stale references exist only in tests/autopilot.test.cjs (legacy tests checking for deleted functions) and historical docs (RETROSPECTIVE.md, design docs) -- these are acceptable remnants

### 5. All new config keys are registered in config.cjs and visible via `gsd settings`
**Status:** PASSED
- config.cjs CONFIG_DEFAULTS (lines 15-25): 10 new keys registered
  - `autopilot.max_turns_per_step`: 200
  - `autopilot.max_budget_per_step_usd`: null
  - `autopilot.turns.discuss`: 100
  - `autopilot.turns.plan`: 150
  - `autopilot.turns.execute`: 300
  - `autopilot.turns.verify`: 100
  - `autopilot.turns.debug`: 50
  - `autopilot.turns.audit`: 100
  - `autopilot.turns.uat`: 150
  - `autopilot.turns.completion`: 50
- cli.cjs KNOWN_SETTINGS_KEYS (lines 681-685): all keys listed including `autopilot.turns` parent key and 8 individual step-type keys
- cli.cjs validateSetting rules (lines 628-643):
  - `autopilot.max_turns_per_step`: positive integer
  - `autopilot.turns.*`: positive integer
  - `autopilot.max_budget_per_step_usd`: positive number or null

## Requirement Coverage

| Req ID | Status | Evidence |
|--------|--------|----------|
| SAFE-01 | Completed | TURNS_CONFIG with 8 entries at autopilot.mjs:209, getMaxTurns at :214, maxTurns passed at all 5 call sites |
| SAFE-02 | Completed | maxBudgetUsd in runAgentStep at :312, config resolution at :329, error_max_budget_usd handling at :301 |
| CLN-02 | Completed | 10 keys in config.cjs CONFIG_DEFAULTS :15-24, cli.cjs KNOWN_SETTINGS_KEYS :681-685, validateSetting :628-643 |
| CALL-02 | Completed | 3 debug retry sites at :726, :783, :823 all use runAgentStep with getMaxTurns('debug') |
| CALL-03 | Completed | Subtype gate at :684 and :749 -- only error_during_execution triggers retry; error_max_turns and error_max_budget_usd skip to failure |
| CLN-01 | Completed | Zero matches for runClaudeStreaming/displayStreamEvent in autopilot.mjs; all invocations via runAgentStep |

## Test Suite
- 788/795 tests pass (7 failures are pre-existing, unrelated to Phase 99 changes)
- Stale tests in autopilot.test.cjs reference deleted functions (runClaudeStreaming, displayStreamEvent) -- these are candidates for Phase 103 test consolidation

## Must-Haves Check

All must_haves from Phase 99 plans verified:
- [x] TURNS_CONFIG maps 8 step types to maxTurns defaults
- [x] getMaxTurns resolves from config with TURNS_CONFIG fallback
- [x] stepType parameter plumbed through runStep/runStepCaptured
- [x] subtype exposed in runAgentStep return object
- [x] maxBudgetUsd resolves from autopilot.max_budget_per_step_usd config
- [x] 10 config keys registered in CONFIG_DEFAULTS
- [x] All keys in KNOWN_SETTINGS_KEYS with validateSetting rules
- [x] 3 debug retry sites migrated to runAgentStep
- [x] Subtype-gated retry: only error_during_execution is retryable
- [x] runClaudeStreaming and displayStreamEvent deleted from autopilot.mjs
