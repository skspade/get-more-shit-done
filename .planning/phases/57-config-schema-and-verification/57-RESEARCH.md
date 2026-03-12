# Phase 57: Config Schema and Verification - Research

**Researched:** 2026-03-12
**Domain:** Config system registration and runtime wiring
**Confidence:** HIGH

## Summary

Phase 57 adds `autopilot.stall_timeout_ms` as a formally registered config setting. The runtime wiring already exists -- `runClaudeStreaming()` in `autopilot.mjs` already reads the value via `getConfig('autopilot.stall_timeout_ms', 300000)` at line 220. The `getConfig()` function already falls back to `CONFIG_DEFAULTS` before the inline default. This means the only work is config registration (3 touch points) and tests.

The config system has a clear 3-touch-point registration pattern: (1) add to `CONFIG_DEFAULTS` in `config.cjs`, (2) add to `KNOWN_SETTINGS_KEYS` in `cli.cjs`, (3) add validation rule to `validateSetting()` in `cli.cjs`. All three follow established patterns with existing `autopilot.circuit_breaker_threshold` as the exact template.

**Primary recommendation:** Follow the `circuit_breaker_threshold` pattern exactly for all three touch points. No architectural decisions needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `'autopilot.stall_timeout_ms': 300000` to `CONFIG_DEFAULTS` in `config.cjs`
- Add `'autopilot.stall_timeout_ms'` to `KNOWN_SETTINGS_KEYS` array in `cli.cjs`
- Add validation rule in `validateSetting()` in `cli.cjs`: positive integer check matching circuit_breaker_threshold pattern
- No changes needed to `knownKeys` in `gatherHealthData()` (parent `'autopilot'` already covers nested keys)
- Runtime wiring already exists at autopilot.mjs line 220 -- no changes needed

### Claude's Discretion
- Exact validation error message wording for invalid stall_timeout_ms values
- Whether to add the new CONFIG_DEFAULTS entry at the end of the object or sorted with other autopilot keys
- Order of the new KNOWN_SETTINGS_KEYS entry relative to existing autopilot keys
- Whether to add a minimum value check (e.g., >= 1000ms) beyond just positive integer

### Deferred Ideas (OUT OF SCOPE)
- Token-level streaming UI -- out of scope per REQUIREMENTS.md
- Interactive stream controls -- out of scope per REQUIREMENTS.md
- Automatic process kill on stall -- warning-only per REQUIREMENTS.md
- Adding other autopilot config keys to KNOWN_SETTINGS_KEYS and validateSetting()
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-04 | `autopilot.stall_timeout_ms` added to config schema with default 300000 | CONFIG_DEFAULTS registration + KNOWN_SETTINGS_KEYS + validateSetting() validation + tests |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in | Test framework | Already used project-wide |
| node:assert | built-in | Test assertions | Already used project-wide |

### Supporting
No additional libraries needed. All changes are to existing files.

## Architecture Patterns

### Config Registration Pattern (3 Touch Points)

**What:** Every new config setting requires entries in exactly 3 locations.

**Touch Point 1 -- CONFIG_DEFAULTS** (`get-shit-done/bin/lib/config.cjs` line 9):
```javascript
const CONFIG_DEFAULTS = {
  'autopilot.circuit_breaker_threshold': 3,
  'autopilot.max_debug_retries': 3,
  'autopilot.max_audit_fix_iterations': 3,
  'autopilot.auto_accept_tech_debt': true,
  // Add here: 'autopilot.stall_timeout_ms': 300000,
};
```

**Touch Point 2 -- KNOWN_SETTINGS_KEYS** (`get-shit-done/bin/lib/cli.cjs` line 731):
```javascript
const KNOWN_SETTINGS_KEYS = [
  // ...
  'autopilot', 'autopilot.circuit_breaker_threshold',
  // Add here: 'autopilot.stall_timeout_ms',
  // ...
];
```

**Touch Point 3 -- validateSetting()** (`get-shit-done/bin/lib/cli.cjs` line 680):
```javascript
} else if (key === 'autopilot.circuit_breaker_threshold') {
  if (!Number.isInteger(value) || value <= 0) {
    return `'autopilot.circuit_breaker_threshold' must be a positive integer`;
  }
}
// Add similar block for 'autopilot.stall_timeout_ms'
```

### Runtime Config Read Pattern (Already Wired)

`getConfig()` in `autopilot.mjs` (line 173) reads `config.json` with dot-notation traversal, falls back to `CONFIG_DEFAULTS`, then to the inline default. Line 220 already calls `getConfig('autopilot.stall_timeout_ms', 300000)`. Once the key is in CONFIG_DEFAULTS, the formal chain is complete.

### Test Pattern for CONFIG_DEFAULTS

Existing tests in `tests/config.test.cjs` (line 368-416) follow a clear pattern:
1. Default fallback: `config-get <key>` on empty config returns the default value
2. Set-then-get round trip: `config-set <key> <value>` then `config-get` returns the value
3. Existing config with missing key: `config-ensure-section` then `config-get` still returns default

### Test Pattern for Settings Validation

Existing tests in `tests/cli.test.cjs` (line 791-798) follow this pattern:
1. Write a config with the key pre-set to a valid value
2. Attempt to set an invalid value via `routeCommand('settings', tmpDir, ['set', key, invalidValue], 'json')`
3. Assert `result.error === true`
4. Assert the original valid value is preserved in config

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config defaults | Custom default mechanism | CONFIG_DEFAULTS + cmdConfigGet fallback | Already handles nested traversal and fallback chain |
| Setting validation | Custom validation framework | validateSetting() function | Existing pattern with clear branching per key |

## Common Pitfalls

### Pitfall 1: Forgetting a Touch Point
**What goes wrong:** Key works via config-get but shows "unknown setting" warning when using `gsd settings set`
**Why it happens:** Added to CONFIG_DEFAULTS but not KNOWN_SETTINGS_KEYS
**How to avoid:** Always modify all 3 files in one commit
**Warning signs:** "not a recognized setting" message when setting the value

### Pitfall 2: Validation Type Mismatch
**What goes wrong:** CLI passes string "60000" but validation checks `Number.isInteger()`
**Why it happens:** The CLI's `handleSettings()` already parses numeric strings to numbers (line 765: `Number(rawValue)`), but if the value isn't numeric, it stays as a string
**How to avoid:** Test with both valid and invalid values through the settings CLI path

## Code Examples

### Adding to CONFIG_DEFAULTS
```javascript
const CONFIG_DEFAULTS = {
  'autopilot.circuit_breaker_threshold': 3,
  'autopilot.max_debug_retries': 3,
  'autopilot.max_audit_fix_iterations': 3,
  'autopilot.auto_accept_tech_debt': true,
  'autopilot.stall_timeout_ms': 300000,
};
```

### Adding Validation
```javascript
} else if (key === 'autopilot.stall_timeout_ms') {
  if (!Number.isInteger(value) || value <= 0) {
    return `'autopilot.stall_timeout_ms' must be a positive integer`;
  }
}
```

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of config.cjs, cli.cjs, autopilot.mjs, config.test.cjs, cli.test.cjs
- All patterns verified against existing `autopilot.circuit_breaker_threshold` implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all internal, no external dependencies
- Architecture: HIGH - exact pattern already exists for circuit_breaker_threshold
- Pitfalls: HIGH - simple registration, few failure modes

**Research date:** 2026-03-12
**Valid until:** Indefinite (internal codebase patterns)
