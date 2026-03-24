---
phase: 100-mcp-configuration-and-observability
plan: 01
status: complete
completed: 2026-03-24
commit: 47b7c3b
---

# Plan 01 Summary: MCP Configuration and Config Registration

## What Was Done
- Added `STEP_MCP_SERVERS` constant mapping step names to factory functions returning MCP server config objects
- `automated-uat` step returns Chrome DevTools MCP config (`npx @anthropic-ai/chrome-devtools-mcp@latest`) when `uat.chrome_mcp_enabled` is true
- Wired `STEP_MCP_SERVERS[stepName]?.() || {}` into both `runStep()` and `runStepCaptured()` call sites
- Registered `uat.chrome_mcp_enabled: true` in CONFIG_DEFAULTS (config.cjs)
- Added `uat`, `uat.chrome_mcp_enabled` to KNOWN_SETTINGS_KEYS in cli.cjs
- Added boolean validation for `uat.chrome_mcp_enabled` in validateSetting (cli.cjs)
- Added `uat` to KNOWN_SETTINGS_KEYS in validation.cjs

## Requirements Addressed
- **MCP-01**: Per-step MCP server configuration via STEP_MCP_SERVERS mapping; Chrome DevTools MCP for UAT steps only

## Key Decisions
- Keyed STEP_MCP_SERVERS on stepName ('automated-uat') rather than stepType ('uat') since stepName is the step-specific identifier
- Used factory function pattern for lazy config evaluation at call time
- MCP resolution happens at runStep/runStepCaptured level, not inside runAgentStep

## Files Modified
- `get-shit-done/scripts/autopilot.mjs` -- STEP_MCP_SERVERS map, mcpServers in runStep/runStepCaptured
- `get-shit-done/bin/lib/config.cjs` -- CONFIG_DEFAULTS entry
- `get-shit-done/bin/lib/cli.cjs` -- KNOWN_SETTINGS_KEYS + booleanKeys + validateSetting
- `get-shit-done/bin/lib/validation.cjs` -- KNOWN_SETTINGS_KEYS
