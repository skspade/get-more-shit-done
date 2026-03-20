# Phase 72: gsd-playwright Agent - Research

**Researched:** 2026-03-20
**Status:** Complete

## Phase Objective

Build `agents/gsd-playwright.md` — a single agent file that scaffolds Playwright, generates specs from acceptance criteria, executes tests, categorizes failures, and returns structured results.

## Codebase Findings

### Agent File Pattern (from gsd-test-steward.md)

All GSD agents follow this structure:
```yaml
---
name: gsd-{name}
description: {one-line description}
tools: {comma-separated tool list}
color: {color}
---
```

Followed by XML sections: `<role>`, `<input>`, `<process>`, `<output>`.

Key patterns:
- `<role>` defines identity, spawner, core responsibilities
- `<input>` documents the input contract (fields, sources, purposes)
- `<process>` has numbered steps with code blocks for bash commands
- `<output>` defines structured return format with `## {AGENT} COMPLETE` or `## {AGENT} SKIPPED/BLOCKED`
- Agents that need initial file reads include a "CRITICAL: Mandatory Initial Read" block for `<files_to_read>`

### Phase 71 Infrastructure (testing.cjs)

**detectPlaywright(cwd)** at line 92:
- Returns `{ status: 'configured'|'installed'|'not-detected', config_path: string|null }`
- Checks for `playwright.config.ts` / `playwright.config.js` first
- Falls back to checking `@playwright/test` in package.json dependencies
- Callable via `node gsd-tools.cjs playwright-detect`

**Playwright output parsing** at line 376 (inside `parseTestOutput()` case 'playwright'):
- Regex patterns: `/(\d+)\s+passed/`, `/(\d+)\s+failed/`, `/(\d+)\s+skipped/`
- Extracts failing test names from numbered list: `^\s+\d+\)\s+(.+)$`
- Returns `{ passed, failed, total, failedTests }`

**EXCLUDE_DIRS** at line 122:
- `e2e/` already excluded from test budget — no budget impact from generated specs

### Data Flow

The agent receives all context via `Task()` prompt from callers (Phase 73 `/gsd:ui-test`, Phase 74 `add-tests`). Input fields:
- `mode`: `ui-test` | `generate` | `scaffold`
- `phase_dir`: path to phase directory (for reading CONTEXT.md)
- `base_url`: URL of the running application (default `http://localhost:3000`)
- `flags`: `--scaffold`, `--run-only`, `--headed`

### Playwright Config Template

From CONTEXT.md decisions and STACK.md research:
```typescript
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL: '{base_url}',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### Failure Categorization Patterns

Application-level (app not running or broken):
- `ERR_CONNECTION_REFUSED`, `net::ERR_`, `ECONNREFUSED`
- `Timeout` in navigation context, `page.goto` timeout
- `NS_ERROR_CONNECTION_REFUSED`

Test-level (test needs adjustment):
- `locator`, `not found`, `element not visible`
- `expect(received)`, `toBe`, `toHaveText`, assertion keywords
- `strict mode violation` (multiple elements matched)

### Existing Agent Count

12 existing agents in `agents/` directory. The new `gsd-playwright.md` will be the 13th.

## Risks and Mitigations

1. **Scaffold may fail if npm is not available** — Agent should check for npm/npx availability before scaffolding
2. **Generated specs depend on acceptance test quality in CONTEXT.md** — Agent reports BLOCKED if no `<acceptance_tests>` section exists
3. **Line reporter output varies by Playwright version** — The regex patterns from testing.cjs are broad enough to handle minor format changes

## Summary

This is a single-file deliverable. The agent file is self-contained with no code changes to existing files. All infrastructure (detection, parsing, e2e exclusion) was delivered in Phase 71. The agent calls Phase 71 tools via `node gsd-tools.cjs playwright-detect` and mirrors the parsing patterns for direct stdout extraction.
