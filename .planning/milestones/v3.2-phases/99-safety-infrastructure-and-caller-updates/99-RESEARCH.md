# Phase 99: Safety Infrastructure and Caller Updates - Research

**Researched:** 2026-03-24
**Domain:** Autopilot SDK safety limits, caller migration, config registration
**Confidence:** HIGH

## Summary

Phase 99 completes the SDK migration by adding per-step-type turn limits, optional budget caps, migrating the 3 debug retry call sites from `runClaudeStreaming()` to `runAgentStep()`, updating debug retry logic to only fire on `error_during_execution`, deleting the legacy `runClaudeStreaming()`/`displayStreamEvent()` functions, and registering all new config keys.

The codebase is well-structured for these changes. `runAgentStep()` already accepts `maxTurns` and `maxBudgetUsd` parameters and the SDK handles enforcement natively. The main work is: (1) adding a `TURNS_CONFIG` lookup and `getMaxTurns()` helper, (2) passing `stepType` through the call chain, (3) returning `subtype` from `runAgentStep()` so retry logic can differentiate error types, (4) replacing 3 `runClaudeStreaming()` calls with `runAgentStep()`, (5) updating retry conditions, (6) deleting legacy code, and (7) config registration across 3 files.

**Primary recommendation:** Execute in 2 plans -- Plan 01 for safety infrastructure + config registration (TURNS_CONFIG, getMaxTurns, stepType plumbing, subtype exposure, config 3-touch-point), Plan 02 for debug retry migration + legacy deletion (wire runAgentStep to 3 debug sites, narrow retry condition, delete runClaudeStreaming/displayStreamEvent).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Implement `TURNS_CONFIG` object mapping step types to default maxTurns values: discuss:100, plan:150, execute:300, verify:100, debug:50, audit:100, uat:150, completion:50
- Each step type configurable via `autopilot.turns.<stepType>` config keys
- `getMaxTurns(stepType)` helper centralizes turn limit resolution
- Budget cap via `autopilot.max_budget_per_step_usd` config key, undefined = no cap
- Debug retry only triggers on `error_during_execution` subtype
- `runAgentStep()` returns `subtype` in result object alongside exitCode/stdout/costUsd
- When `error_max_turns` or `error_max_budget_usd` occurs, skip debug retry entirely
- Delete `runClaudeStreaming()` (lines 355-405) and `displayStreamEvent()` (lines 340-353) entirely
- Config 3-touch-point pattern: CONFIG_DEFAULTS + KNOWN_SETTINGS_KEYS + validateSetting
- Add all turn limit keys and budget key to CONFIG_DEFAULTS, KNOWN_SETTINGS_KEYS (cli.cjs), KNOWN_SETTINGS_KEYS (validation.cjs), and validateSetting

### Claude's Discretion
- Exact ordering of TURNS_CONFIG keys
- Whether `getMaxTurns()` is standalone or inlined
- Log message format for turn limit and budget cap events
- Whether to use `null` or omit for "no budget cap" default
- Internal field names for subtype in return object

### Deferred Ideas (OUT OF SCOPE)
- Per-step MCP server configuration (Phase 100)
- Per-step cost/turn/duration logging (Phase 100)
- Cumulative cost reporting (Phase 100)
- `gsd debug-session` command (future)
- V2 SDK interface evaluation (future)
- Per-step effort tuning (future)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAFE-01 | Per-step-type maxTurns via TURNS_CONFIG, configurable via config.json | TURNS_CONFIG object + getMaxTurns helper + stepType plumbing through runStep/runStepCaptured |
| SAFE-02 | Optional maxBudgetUsd per-step cost cap | getConfig resolution in runAgentStep, already accepts maxBudgetUsd param |
| CALL-02 | Wire runAgentStep to all 3 debug retry call sites | Replace runClaudeStreaming at lines 741, 785, 823 with runAgentStep |
| CALL-03 | Debug retry only on error_during_execution | Expose subtype from runAgentStep, check subtype before retry |
| CLN-01 | Delete runClaudeStreaming and displayStreamEvent | Remove lines 340-405 after debug retry migration |
| CLN-02 | Register all new config keys | CONFIG_DEFAULTS + cli.cjs KNOWN_SETTINGS_KEYS + validateSetting + validation.cjs KNOWN_SETTINGS_KEYS |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | installed | SDK query() with maxTurns/maxBudgetUsd | Already installed in Phase 98 |

### Supporting
No new libraries needed. All changes are internal to autopilot.mjs, config.cjs, cli.cjs, and validation.cjs.

## Architecture Patterns

### Pattern 1: TURNS_CONFIG Lookup
**What:** A const object mapping step type strings to default maxTurns integers
**When to use:** Every time runAgentStep needs a maxTurns value
**Example:**
```javascript
const TURNS_CONFIG = {
  discuss: 100, plan: 150, execute: 300, verify: 100,
  debug: 50, audit: 100, uat: 150, completion: 50,
};

function getMaxTurns(stepType) {
  return getConfig(`autopilot.turns.${stepType}`, TURNS_CONFIG[stepType] || 200);
}
```

### Pattern 2: Subtype Exposure
**What:** runAgentStep returns { exitCode, stdout, costUsd, subtype } so callers can differentiate error types
**When to use:** Debug retry callers check subtype before deciding to retry
**Example:**
```javascript
// In runAgentStep, after collecting resultMsg:
const subtype = resultMsg?.subtype || 'unknown';
return { exitCode, stdout, costUsd: resultMsg?.total_cost_usd, subtype };
```

### Pattern 3: stepType Parameter Flow
**What:** runStep and runStepCaptured accept stepType parameter, pass it to runAgentStep for maxTurns resolution
**When to use:** Every call site that invokes runAgentStep
**Example:**
```javascript
async function runStep(prompt, stepName, stepType) {
  // ...
  const { exitCode } = await runAgentStep(prompt, { maxTurns: getMaxTurns(stepType || stepName) });
  // ...
}
```

### Pattern 4: Config 3-Touch-Point
**What:** New config keys must be added to 3 locations: CONFIG_DEFAULTS (config.cjs), KNOWN_SETTINGS_KEYS (cli.cjs), validateSetting (cli.cjs), and KNOWN_SETTINGS_KEYS (validation.cjs)
**When to use:** Any new config key addition

### Anti-Patterns to Avoid
- **Scattered getConfig calls:** Centralize in getMaxTurns, don't inline getConfig at each call site
- **Retrying on safety limits:** error_max_turns and error_max_budget_usd must NOT trigger debug retry -- these are intentional limits
- **Leaving dead code:** After migration, runClaudeStreaming and displayStreamEvent must be fully deleted

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Turn limit enforcement | Custom counter | SDK maxTurns parameter | SDK already enforces, yields error_max_turns |
| Budget enforcement | Cost tracking | SDK maxBudgetUsd parameter | SDK already enforces, yields error_max_budget_usd |
| Error subtype detection | Parsing stdout | resultMsg.subtype field | SDK provides structured result messages |

## Common Pitfalls

### Pitfall 1: maxBudgetUsd=0 vs undefined
**What goes wrong:** Passing 0 or null as maxBudgetUsd might disable budget enforcement or cause errors
**Why it happens:** getConfig returns the stored value; if stored as null or 0, SDK behavior is ambiguous
**How to avoid:** Use `maxBudgetUsd || undefined` to ensure falsy values become undefined (no cap)
**Warning signs:** Steps stopping immediately (budget=0) or ignoring configured budget

### Pitfall 2: stepType vs stepName mismatch
**What goes wrong:** stepName might be 'discuss' but the step type for TURNS_CONFIG might need a different key
**Why it happens:** Some step names in the main loop differ from TURNS_CONFIG keys (e.g., 'milestone-audit' vs 'audit', 'automated-uat' vs 'uat')
**How to avoid:** Pass explicit stepType parameter, default to stepName if not provided. Map special names to TURNS_CONFIG keys.
**Warning signs:** getMaxTurns returning the global default (200) instead of step-specific value

### Pitfall 3: createInterface import removal
**What goes wrong:** Removing the createInterface import because runClaudeStreaming used it, but askTTY still needs it
**Why it happens:** Overzealous cleanup
**How to avoid:** Keep the createInterface import -- askTTY at line 830 still uses it
**Warning signs:** Runtime error in askTTY

### Pitfall 4: Quiet mode debug retry
**What goes wrong:** runClaudeStreaming had a special quiet-mode branch using `claude -p`. Replacing with runAgentStep must still work in quiet mode.
**Why it happens:** runAgentStep already supports quiet parameter, but must verify it handles QUIET global flag
**How to avoid:** runAgentStep already respects quiet in handleMessage -- no special handling needed
**Warning signs:** Debug output appearing during quiet mode

## Code Examples

### Current debug retry call sites (to be replaced)

```javascript
// Line 741 in runStepWithRetry:
const { exitCode: debugExitCode } = await runClaudeStreaming(debugPrompt);

// Line 785 in runVerifyWithDebugRetry:
await runClaudeStreaming(debugPrompt);

// Line 823 in runVerifyWithDebugRetry:
await runClaudeStreaming(debugPrompt);
```

### Replacement pattern:
```javascript
const { exitCode: debugExitCode } = await runAgentStep(debugPrompt, {
  maxTurns: getMaxTurns('debug'),
  maxBudgetUsd: getConfig('autopilot.max_budget_per_step_usd', undefined) || undefined,
});
```

### Retry condition narrowing (CALL-03):
```javascript
// Before: retry on ANY non-zero exit
if (stepExit === 0) { return 0; }

// After: only retry on error_during_execution
if (stepExit === 0) { return 0; }
if (subtype !== 'error_during_execution') {
  // Safety limit or other non-retryable error -- report and stop
  await writeFailureState(stepName, stepExit, retryCount, MAX_DEBUG_RETRIES);
  writeFailureReport(stepName, stepExit, retryCount, MAX_DEBUG_RETRIES, outputFile);
  return stepExit;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CLI subprocess (`claude -p`) | SDK `query()` | Phase 98 (2026-03-24) | runStep/runStepCaptured already use runAgentStep |
| NDJSON streaming | SDK message generator | Phase 98 (2026-03-24) | handleMessage replaces displayStreamEvent |
| No turn limits | Global maxTurns default (200) | Phase 98 (2026-03-24) | Phase 99 adds per-step-type limits |

**Deprecated/outdated:**
- `runClaudeStreaming()`: Legacy CLI subprocess approach, to be deleted in this phase
- `displayStreamEvent()`: Legacy NDJSON parser, to be deleted in this phase

## Open Questions

None -- all design decisions are locked in CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of autopilot.mjs (lines 1-1370)
- Direct codebase analysis of config.cjs (lines 1-193)
- Direct codebase analysis of cli.cjs (KNOWN_SETTINGS_KEYS, validateSetting)
- Direct codebase analysis of validation.cjs (KNOWN_SETTINGS_KEYS)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all internal changes
- Architecture: HIGH - patterns established in Phase 98, extending existing code
- Pitfalls: HIGH - identified from direct code reading

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable internal codebase)
