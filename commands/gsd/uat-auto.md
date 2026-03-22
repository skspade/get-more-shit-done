---
name: gsd:uat-auto
description: Run automated UAT session against a live web application
argument-hint: "[--timeout <minutes>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
---
<objective>
Run automated UAT using Chrome MCP (primary) or Playwright (fallback) to verify user-facing web UI behavior at milestone level. Loads config from `.planning/uat-config.yaml`, discovers tests from phase SUMMARY files, starts the application, executes browser-based tests, and writes results to MILESTONE-UAT.md.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/uat-auto.md
</execution_context>

<context>
**Configuration:** Loaded from `.planning/uat-config.yaml` via the UAT config module (`get-shit-done/bin/lib/uat.cjs`). Config defines `base_url`, `startup_command`, `startup_wait_seconds`, `browser`, `fallback_browser`, and `timeout_minutes`. When no config file exists, the UAT step is skipped silently.

**Test Discovery:** Tests are derived from phase SUMMARY.md files within the current milestone. Each summary's key behaviors and success criteria become UAT test cases.

**Browser Selection:** Primary browser from config (default: `chrome-mcp`). Falls back to `fallback_browser` (default: `playwright`) if primary is unavailable.
</context>

<process>
Execute the uat-auto workflow from @~/.claude/get-shit-done/workflows/uat-auto.md end-to-end.

High-level steps:
1. Load UAT config from `.planning/uat-config.yaml`
2. Discover test cases from phase SUMMARY files
3. Detect available browser (primary or fallback)
4. Start application using `startup_command` (if configured)
5. Wait `startup_wait_seconds` for application readiness
6. Execute browser-based tests against `base_url`
7. Write results to `.planning/milestones/{version}-MILESTONE-UAT.md`
8. Commit results
9. Report status and exit

Note: The workflow implementation is created in Phase 92. This spec defines the command contract only.
</process>
