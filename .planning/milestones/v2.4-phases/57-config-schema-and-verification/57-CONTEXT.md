# Phase 57: Config Schema and Verification - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Make `autopilot.stall_timeout_ms` a first-class config setting with default 300000, visible via `gsd settings`, settable via `gsd settings set`, and wired through to the `runClaudeStreaming()` stall detection timer. This is the final phase of v2.4 -- it closes the config gap and provides the opportunity to verify end-to-end streaming behavior across all integration sites.

</domain>

<decisions>
## Implementation Decisions

### Config Schema Registration
- Add `'autopilot.stall_timeout_ms': 300000` to `CONFIG_DEFAULTS` in `config.cjs`
- Add `'autopilot.stall_timeout_ms'` to `KNOWN_SETTINGS_KEYS` array in `cli.cjs`
- Add validation rule in `validateSetting()` in `cli.cjs`: `autopilot.stall_timeout_ms` must be a positive integer (Claude's Decision: matches the existing `autopilot.circuit_breaker_threshold` validation pattern -- positive integer check with descriptive error)
- The `knownKeys` array in `gatherHealthData()` already includes `'autopilot'` as a top-level key, so no changes needed there (Claude's Decision: health check validates top-level keys only; nested autopilot keys are covered by the parent)

### Settings Display and Set
- `gsd settings` displays `autopilot.stall_timeout_ms` when it appears in config.json (already works via `flattenConfig()`)
- `gsd settings set autopilot.stall_timeout_ms <value>` updates the value with numeric coercion and validation (already works via `handleSettings()` dot-notation set path)
- When `stall_timeout_ms` is not explicitly set in config.json, `CONFIG_DEFAULTS` fallback returns 300000 via `cmdConfigGet()`

### Config-to-Runtime Wiring
- `runClaudeStreaming()` already calls `getConfig('autopilot.stall_timeout_ms', 300000)` at line 220 of `autopilot.mjs`
- `getConfig()` reads config.json with dot-notation traversal, then falls back to `CONFIG_DEFAULTS`, then to the inline default
- Adding the key to `CONFIG_DEFAULTS` closes the formal registration -- runtime behavior is already correct

### Testing
- Add a test to `config.test.cjs` for `CONFIG_DEFAULTS` fallback: `config-get autopilot.stall_timeout_ms` returns 300000 when unset (Claude's Decision: follows the existing test pattern for circuit_breaker_threshold, max_debug_retries, etc.)
- Add a test for `config-set autopilot.stall_timeout_ms 60000` followed by `config-get` returning 60000 (Claude's Decision: validates the full set-then-get round trip like the existing circuit_breaker_threshold test)
- Add a test for validation rejection of non-positive values (Claude's Decision: validates the new validation rule works correctly)
- Add a test to `cli.test.cjs` for `gsd settings set autopilot.stall_timeout_ms` if similar settings tests exist there (Claude's Decision: settings set validation should be covered alongside existing settings tests)

### Claude's Discretion
- Exact validation error message wording for invalid stall_timeout_ms values
- Whether to add the new CONFIG_DEFAULTS entry at the end of the object or sorted with other autopilot keys
- Order of the new KNOWN_SETTINGS_KEYS entry relative to existing autopilot keys
- Whether to add a minimum value check (e.g., >= 1000ms) beyond just positive integer

</decisions>

<specifics>
## Specific Ideas

- The success criteria explicitly require three things: (1) `autopilot.stall_timeout_ms` in config schema with default 300000, (2) `gsd settings` displays it and `gsd settings set` updates it, (3) changing the value affects `runClaudeStreaming()` stall detection
- The existing `CONFIG_DEFAULTS` object in `config.cjs` currently has 4 entries -- all `autopilot.*` keys with flat dot-notation
- The `validateSetting()` function in `cli.cjs` has a specific check for `autopilot.circuit_breaker_threshold` (positive integer) -- the new `autopilot.stall_timeout_ms` should follow the same pattern
- The `KNOWN_SETTINGS_KEYS` array in `cli.cjs` includes `'autopilot'` and `'autopilot.circuit_breaker_threshold'` -- add `'autopilot.stall_timeout_ms'` as a sibling
- `runClaudeStreaming()` already reads the config value -- the wiring is done. This phase formalizes it in the schema so it appears in `gsd settings` and gets validated

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CONFIG_DEFAULTS` in `config.cjs` (line 9): Flat key-value map for autopilot defaults -- add `stall_timeout_ms` entry here
- `KNOWN_SETTINGS_KEYS` in `cli.cjs` (line 731): Array of recognized config keys for unknown-key warnings -- add entry here
- `validateSetting()` in `cli.cjs` (line 680): Key-specific validation rules -- add positive integer check here
- `getConfig()` in `autopilot.mjs` (line 173): Already reads `autopilot.stall_timeout_ms` with fallback chain
- `flattenConfig()` in `cli.cjs` (line 663): Recursively flattens nested config for display -- works automatically for new keys

### Established Patterns
- Config registration pattern: add to `CONFIG_DEFAULTS` (config.cjs), `KNOWN_SETTINGS_KEYS` (cli.cjs), and `validateSetting()` (cli.cjs) -- three touch points per new setting
- Test pattern for CONFIG_DEFAULTS: `config-get <key>` on empty config returns the default value (see config.test.cjs lines 379-415)
- Test pattern for config-set round trip: `config-set <key> <value>` then `config-get <key>` returns the parsed value (see config.test.cjs line 403-408)

### Integration Points
- `config.cjs` line 9: `CONFIG_DEFAULTS` object -- add new entry
- `cli.cjs` line 731: `KNOWN_SETTINGS_KEYS` array -- add new entry
- `cli.cjs` line 680: `validateSetting()` function -- add validation branch
- `autopilot.mjs` line 220: `getConfig('autopilot.stall_timeout_ms', 300000)` -- already wired, no changes needed
- `config.test.cjs` line 368: `CONFIG_DEFAULTS fallback` describe block -- add new test cases

</code_context>

<deferred>
## Deferred Ideas

- Token-level streaming UI (spinners, progress bars) -- out of scope per REQUIREMENTS.md
- Interactive stream controls (pause/resume) -- out of scope per REQUIREMENTS.md
- Automatic process kill on stall -- warning-only per REQUIREMENTS.md
- Adding other autopilot config keys (e.g., `autopilot.max_debug_retries`) to `KNOWN_SETTINGS_KEYS` and `validateSetting()` -- existing keys work via CONFIG_DEFAULTS fallback but lack formal settings validation; not in scope for this phase

</deferred>

---

*Phase: 57-config-schema-and-verification*
*Context gathered: 2026-03-12 via auto-context*
