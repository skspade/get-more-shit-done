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

**Test Discovery:** Tests are discovered from `*-UAT.md` files (primary, status:complete) or generated from `*-SUMMARY.md` files (fallback) across milestone phases.

**Browser Selection:** Primary browser from config (default: `chrome-mcp`). Falls back to `fallback_browser` (default: `playwright`) if primary is unavailable.
</context>

<process>
Execute the uat-auto workflow from @~/.claude/get-shit-done/workflows/uat-auto.md end-to-end.

High-level steps:
1. Load UAT config from `.planning/uat-config.yaml`
2. Discover test cases from `*-UAT.md` files (primary) or `*-SUMMARY.md` files (fallback)
3. Detect available browser (Chrome MCP probe or direct Playwright)
4. Start application using `startup_command` (if configured and app not running)
5. Execute browser-based tests against `base_url` with DOM-first assertions
6. Write results to `.planning/MILESTONE-UAT.md`
7. Commit results
8. Report status and exit
</process>
