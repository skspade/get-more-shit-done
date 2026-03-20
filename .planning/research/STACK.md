# Stack Research

**Domain:** Playwright UI testing integration for GSD (on-demand E2E test scaffolding and generation)
**Researched:** 2026-03-19
**Confidence:** HIGH (core Playwright package), MEDIUM (output parsing format — verified via official docs + community)

## Scope

This research covers ONLY what is new for v2.7 (Playwright UI testing integration). The existing validated
stack (Node.js CJS, zx/ESM, node:test suite, gsd-tools dispatcher, testing.cjs, cli.cjs, autopilot.mjs,
validation.cjs) is NOT re-evaluated.

## Verdict: One New DevDependency — @playwright/test

The target app under test installs `@playwright/test` in its own project. GSD itself only needs knowledge of
how to detect, scaffold, and invoke Playwright in a user's project — not to have Playwright as a production
dependency. However, GSD's own test coverage for the new `playwright-detect` logic in `testing.cjs` may
benefit from having `@playwright/test` available in devDependencies to avoid calling `npx playwright test`
in integration tests.

**Decision:** `@playwright/test` as devDependency of GSD (for testing the detector without live installs),
plus clear documentation that user projects must install it themselves via the scaffold flow.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@playwright/test` | `^1.50.0` (current: 1.58.2) | E2E test framework that users will install in their apps; GSD detects and drives it | The only first-class Playwright integration package. Bundles test runner, browser download CLI, assertion library, and `defineConfig`. No separate `playwright` package needed for web testing. Microsoft-backed, actively maintained (releases monthly). |
| `npx playwright install chromium` | Bundled with `@playwright/test` | Download Chromium browser binary | Chromium-only by default keeps binary footprint small (~140MB vs ~400MB for all 3 browsers). Cross-platform (macOS, Linux, Windows). |
| Node.js | >=20.x (required by Playwright 1.50+) | Runtime for Playwright test execution | Playwright's current docs state "Node.js latest 20.x, 22.x or 24.x" as system requirements. This is a constraint on user app environments, not GSD itself (GSD requires >=16.7.0). |

### TypeScript Config (for generated `playwright.config.ts`)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `typescript` | already in user project or bundled | Type-checking for generated `.spec.ts` files | Playwright ships its own `tsconfig.json` when using TypeScript mode; no separate TS install required in the user's project — Playwright handles transpilation internally via its own ESM handling. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None beyond `@playwright/test` | — | — | Playwright bundles everything needed: `test`, `expect`, `defineConfig`, `devices`, `Page`, screenshot capture, trace viewer. No `@testing-library/playwright` needed — Playwright's built-in locators (getByRole, getByText, getByLabel, getByTestId) cover all common cases. |

### Development Tools (GSD-internal)

| Tool | Purpose | Notes |
|------|---------|-------|
| `node:test` (built-in) | Test suite for `testing.cjs` Playwright-detection logic | No change to existing test runner. New tests for `detectPlaywright()`, `scaffoldPlaywright()`, `parsePlaywrightOutput()` use same `createTempProject()`/`cleanup()` helpers. |
| Existing `testing.cjs` | Where Playwright detection and output parsing land | Add `detectPlaywright(cwd)`, `parsePlaywrightOutput(stdout, stderr)`, and `getPlaywrightCommand(cwd)` alongside existing `detectFramework()`. Keep CJS module format. |

## Installation

```bash
# In GSD itself (devDependency for testing detection logic without live Playwright installs):
npm install -D @playwright/test

# In the USER'S app project (performed by gsd-playwright agent scaffold step):
npm install -D @playwright/test
npx playwright install chromium
```

**Note:** GSD never runs `npm install @playwright/test` in the user's project automatically without
confirmation. The `gsd-playwright` agent and `add-tests` E2E path ask before scaffolding.

## Config File Pattern

Generated `playwright.config.ts` (the canonical GSD scaffold template):

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

**Why `reporter: 'line'`** instead of `html`: Line reporter produces parseable stdout output with a
summary line that GSD's `parsePlaywrightOutput()` can extract pass/fail counts from. HTML reporter
writes files but produces minimal stdout — harder to parse programmatically. GSD's design uses
`testing.cjs`'s output parsing layer, which requires stdout.

**Why `workers: 1` on CI**: Prevents flaky CI failures from parallel browser processes competing for
resources.

## Integration Points with Existing Architecture

### Where Playwright hooks into `testing.cjs`

The existing `testing.cjs` module (in `get-shit-done/bin/lib/testing.cjs`) is the single place where
framework detection, output parsing, and test execution live. Playwright integration follows this pattern:

```
detectFramework(cwd)       — returns 'vitest' | 'jest' | 'mocha' | 'node:test' | null
                           ← ADD: detectPlaywright(cwd) → boolean
                           ← ADD: getPlaywrightCommand(cwd, opts) → string | null

parseTestOutput(stdout, stderr, framework)
                           ← ADD: 'playwright' case in switch

getDefaultCommand(framework)
                           ← ADD: 'playwright' → 'npx playwright test'
```

**Detection logic** (`detectPlaywright(cwd)`):
1. `playwright.config.ts` or `playwright.config.js` in project root → fully detected
2. `@playwright/test` in `package.json` devDependencies → partially detected (installed, no config)
3. Neither → not detected

**Why separate from `detectFramework()`**: Playwright is an E2E runner, not a unit test framework.
`detectFramework()` is used by the hard test gate to run unit tests. Playwright detection is used by
`add-tests` E2E path and `/gsd:ui-test` — different code paths, different purpose.

### Playwright Output Parsing

Playwright's line reporter stdout ends with a summary line. Examples from community usage:

```
  2 passed (3.1s)
  1 failed (2.4s)
  3 passed, 1 failed (5.2s)
  5 passed, 2 skipped (8.1s)
```

Parsing regex for `parsePlaywrightOutput(stdout, stderr)`:

```javascript
// Match final summary: "N passed" and/or "N failed"
const passMatch = combined.match(/(\d+)\s+passed/);
const failMatch = combined.match(/(\d+)\s+failed/);
const skipMatch = combined.match(/(\d+)\s+skipped/);
```

**Confidence:** MEDIUM. The line reporter format is consistent with community-reported examples and
official Playwright reporter documentation. The JSON reporter (`--reporter=json`) would be more reliable
for structured parsing but writes to a file (not stdout) unless `PLAYWRIGHT_JSON_OUTPUT_NAME` is unset
and the output is piped — which complicates the `runTestCommand()` flow in `testing.cjs`. The line
reporter stdout approach is simpler and consistent with how the existing Jest/Vitest parsers work.

**Alternative (higher confidence, more complexity):** Use `--reporter=json` with
`PLAYWRIGHT_JSON_OUTPUT_NAME=/dev/stdout` to get JSON on stdout. Deferred — adds complexity, implement
if line reporter parsing proves fragile.

### `.gitignore` additions (scaffold step)

```
test-results/
playwright-report/
blob-report/
.playwright/
```

These are the Playwright-generated directories that must not be committed. The scaffold step appends
these if not already present.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@playwright/test` | Cypress | Never for this integration. Downstream consumer spec explicitly excludes Cypress. |
| `@playwright/test` | Selenium/WebdriverIO | Never. Playwright is the modern standard with better DX, faster execution, and built-in auto-waiting. |
| `@playwright/test` | Puppeteer | Only if user needs Chrome-specific automation without assertions. Playwright is strictly superior for testing. |
| `reporter: 'line'` for parsing | `reporter: 'json'` with file | Use JSON reporter if line-format parsing proves unreliable across Playwright versions. JSON is structured and stable but requires file I/O or stdout pipe tricks. |
| Chromium-only by default | All 3 browsers | Use all browsers when user explicitly needs cross-browser testing. Chromium is sufficient for most web apps and dramatically reduces CI time and binary size. |
| `testDir: './e2e'` | `testDir: './tests/e2e'` | Use `tests/e2e` only if user already has `tests/` as their unit test directory AND wants co-location. `e2e/` at root is the Playwright community default. |
| Inline scaffold in workflow | `npm init playwright@latest` | `npm init playwright@latest` prompts interactively (language, directory, CI, browser install) — unsuitable for GSD's programmatic scaffold. Manual config creation is deterministic. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Cypress | Explicitly out of scope per project spec; different architecture (all-JS, no multi-tab), higher npm install weight | `@playwright/test` |
| Selenium / WebdriverIO | Legacy architecture requiring separate WebDriver server; worse DX than Playwright | `@playwright/test` |
| `playwright` (base package) | Only needed for low-level browser automation without the test runner. `@playwright/test` includes everything. | `@playwright/test` |
| `@playwright/browser-tools` MCP | Separate tool for Claude-driven browser inspection; not the same as `@playwright/test` for writing test specs | `@playwright/test` for test generation |
| HTML reporter as default | Writes to files, minimal stdout, can't be parsed by `testing.cjs` output parser | `reporter: 'line'` for stdout parsing |
| All 3 browser projects by default | 3x longer CI runs, 3x binary download size; most projects only need Chromium | Single Chromium project |
| `npm init playwright@latest` for scaffolding | Interactive prompts — not usable from GSD's non-interactive workflow steps | Manual config + directory creation as documented in design |

## Stack Patterns by Variant

**If user project already has `playwright.config.ts`:**
- Skip scaffold entirely
- Read existing `testDir` from config and use it for spec generation
- Do not overwrite user's config
- Run `npx playwright test` using their existing setup

**If `@playwright/test` is in devDependencies but no config exists:**
- "Partially detected" path: create `playwright.config.ts` only, skip `npm install`
- Run `npx playwright install chromium` to ensure browser binaries are available
- Create `e2e/` directory with example test

**If neither config nor package exists:**
- Full scaffold: install + config + directory + example test + `.gitignore` additions
- Requires user confirmation before running

**If user's app uses Vite (port 5173) or Angular (port 4200):**
- Override `baseURL` in the scaffold config
- Detected by checking `package.json` for `vite`, `@angular/core`, `next`, `nuxt` dependencies

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@playwright/test@^1.50.0` | Node.js >=20.x | Node 16/18 dropped in Playwright 1.49+. User's app must run Node 20+. GSD itself still supports Node >=16.7.0. |
| `@playwright/test@^1.50.0` | TypeScript 5.x | Ships its own TS transpilation; user's tsconfig is optional |
| `@playwright/test@^1.50.0` | macOS 14+, Ubuntu 22.04+, Windows 11+ | System requirements from official docs. M1/M2/M3 Mac supported. |
| `testing.cjs` Playwright parser | `@playwright/test@^1.50.0` | Line reporter summary format has been stable across Playwright 1.x; regex for "N passed" / "N failed" is resilient to minor format changes |
| GSD test suite (node:test, 796 tests) | No conflict | Playwright tests live in user's project, not in GSD's test suite. GSD tests only test the detection + parsing logic. |

## Sources

- [@playwright/test on npm](https://www.npmjs.com/package/@playwright/test) — version 1.58.2 current as of March 2026 (MEDIUM confidence; 403 on direct fetch, version from WebSearch result summary)
- [Playwright Installation Docs](https://playwright.dev/docs/intro) — Node.js >=20.x requirement, `npm init playwright@latest` behavior (HIGH confidence, official docs)
- [Playwright Configuration Docs](https://playwright.dev/docs/test-configuration) — `defineConfig` options: testDir, baseURL, retries, workers, reporter, projects (HIGH confidence, official docs)
- [Playwright Reporters Docs](https://playwright.dev/docs/test-reporters) — Built-in reporters, JSON reporter with `PLAYWRIGHT_JSON_OUTPUT_NAME`, line reporter behavior (HIGH confidence, official docs)
- [Playwright Design Doc](..designs/2026-03-19-playwright-ui-testing-integration-design.md) — scaffold specification, detection logic, config template, locator priority (HIGH confidence, project design doc)
- `get-shit-done/bin/lib/testing.cjs` — existing detectFramework, parseTestOutput, runTestCommand patterns (HIGH confidence, direct codebase inspection)
- `tests/testing.test.cjs` — existing test patterns for integration points (HIGH confidence, direct codebase inspection)
- `package.json` — current dependencies: zx only; devDeps: c8, esbuild (HIGH confidence, direct codebase inspection)

---
*Stack research for: Playwright UI testing integration (v2.7)*
*Researched: 2026-03-19*
