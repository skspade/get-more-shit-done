# Playwright UI Testing Integration — Design

**Date:** 2026-03-19
**Approach:** Layered Playwright Integration

## `/gsd:ui-test` Command Spec

The user-facing command that serves as the entry point for Playwright UI testing.

**Command:** `/gsd:ui-test`

**Arguments:**
- `<phase>` (optional) — Phase number to generate E2E tests for (reads SUMMARY.md, CONTEXT.md)
- `<url>` (optional) — Base URL of the running application (auto-detected from playwright.config if not provided)
- Free text after arguments treated as additional instructions (e.g., "focus on the login flow")

**Flags:**
- `--scaffold` — Force scaffolding even if Playwright is detected
- `--run-only` — Skip generation, just run existing Playwright tests
- `--headed` — Run tests in headed mode (visible browser)

**Behavior:**
1. Parse arguments for phase number, URL, and extra instructions
2. Detect or scaffold Playwright setup (delegates to `gsd-playwright` agent)
3. If phase provided: load phase artifacts and classify E2E-testable files
4. Generate Playwright test specs from phase context / user instructions
5. Run tests via `npx playwright test`
6. Present results with pass/fail summary, screenshots on failure, and next steps

**Usage examples:**
```
/gsd:ui-test 42                          # Generate + run E2E tests for phase 42
/gsd:ui-test 42 focus on the checkout flow  # With additional instructions
/gsd:ui-test --run-only                  # Just run existing tests
/gsd:ui-test --scaffold                  # Set up Playwright in the project
```

**File:** `commands/gsd/ui-test.md`

## `gsd-playwright` Agent

The specialized agent that handles all Playwright logic — detection, scaffolding, test generation, and execution.

**Agent:** `gsd-playwright`

**Tools available:** Read, Write, Edit, Bash, Grep, Glob, WebFetch (for docs lookup)

**Responsibilities:**

### 1. Playwright Detection
- Search for `playwright.config.ts` / `playwright.config.js` in the project root
- Check `package.json` for `@playwright/test` dependency
- If found: extract base URL, test directory, browser config from the config file
- If not found: report missing and offer scaffolding

### 2. Scaffolding (when Playwright not detected)
- Run `npm init playwright@latest` with sensible defaults (TypeScript, tests/ directory, no GitHub Actions)
- Create `playwright.config.ts` with:
  - `testDir: './e2e'` (or project convention if discoverable)
  - `baseURL` from user input or `http://localhost:3000` default
  - Chromium-only by default (lighter than all 3 browsers)
  - Screenshot on failure enabled
  - HTML reporter
- Create example test to verify setup works
- Run `npx playwright install chromium` for browser binaries

### 3. Test Generation
- Receive file list + phase context (CONTEXT.md acceptance tests, SUMMARY.md changes)
- For each E2E-classified file, generate a `.spec.ts` file:
  - Import `{ test, expect }` from `@playwright/test`
  - Map acceptance test Given/When/Then to `test()` blocks
  - Use Playwright locators (getByRole, getByText, getByTestId) — prefer accessible locators
  - Include `await expect(page).toHaveScreenshot()` for visual regression where applicable
  - Name test files: `{feature-name}.spec.ts` in the E2E test directory

### 4. Test Execution
- Run `npx playwright test` (or `npx playwright test {specific-file}`)
- Parse output for pass/fail counts
- On failure: collect error messages, screenshot paths, trace file paths
- Return structured results: `{ passed, failed, skipped, failures: [{ test, error, screenshot }] }`

### 5. Results Reporting
- Present pass/fail table
- For failures: show error, link to screenshot, suggest fix
- Flag potential application bugs vs test issues (e.g., timeout = likely app issue, locator not found = likely test issue)

**File:** `agents/gsd-playwright.md`

## Enhanced `add-tests` Workflow Integration

The existing `add-tests` workflow already classifies files into TDD/E2E/Skip. This enhancement makes the E2E path actionable by delegating to the `gsd-playwright` agent.

**Changes to `get-shit-done/workflows/add-tests.md`:**

### Modified Step: `execute_e2e_generation`

Currently this step has placeholder logic for E2E test creation. Replace with:

1. **Before E2E generation begins:** Check for Playwright setup using the same detection logic the agent uses (check for `playwright.config.ts` and `@playwright/test` in package.json)

2. **If not detected:** Present scaffolding prompt:
   ```
   AskUserQuestion(
     header: "Playwright Setup",
     question: "No Playwright setup detected. Set it up now?",
     options: ["Yes — scaffold Playwright", "Skip E2E tests for now"]
   )
   ```

3. **If detected (or just scaffolded):** For each E2E-classified file:
   - Read the implementation file to understand what UI behavior it drives
   - Cross-reference with CONTEXT.md acceptance tests tagged as E2E
   - Generate `.spec.ts` file using Playwright best practices (accessible locators, proper waits)
   - Run the individual test immediately after generation (same RED-GREEN pattern as TDD step)

4. **Results merge:** E2E test results fold into the existing summary table alongside unit test results — no separate reporting flow.

### What stays the same:
- Classification logic (step `analyze_implementation`) — unchanged
- TDD execution (step `execute_tdd_generation`) — unchanged
- Summary format (step `summary_and_commit`) — extended to include E2E column, already has the table structure for it

### Delegation pattern:
The workflow does NOT spawn the `gsd-playwright` agent as a subagent (subagent spawning limitations). Instead, the workflow contains the E2E generation logic inline, following the same patterns defined in the agent spec. The agent exists as a standalone tool for the `/gsd:ui-test` command; the workflow shares the same approach but executes it directly.

## Test Generation Patterns

How the agent and workflow generate idiomatic Playwright tests from GSD phase context.

### Mapping Acceptance Tests to Playwright Specs

Given a CONTEXT.md acceptance test:
```markdown
### AT-03: User can filter products by category
- Given: User is on the products page with 50 products across 5 categories
- When: User clicks the "Electronics" category filter
- Then: Only electronics products are displayed, count shown updates
- Verify: `npx playwright test products-filter.spec.ts`
```

Generated `products-filter.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Product filtering', () => {
  test('filters products by category', async ({ page }) => {
    // Given: User is on the products page
    await page.goto('/products');

    // When: User clicks the "Electronics" category filter
    await page.getByRole('button', { name: 'Electronics' }).click();

    // Then: Only electronics products are displayed
    const products = page.getByTestId('product-card');
    await expect(products).not.toHaveCount(0);

    // Count shown updates
    const countLabel = page.getByTestId('product-count');
    await expect(countLabel).toContainText('Electronics');
  });
});
```

### Locator Priority
1. `getByRole()` — semantic, accessible (preferred)
2. `getByText()` — for visible text content
3. `getByLabel()` — for form fields
4. `getByTestId()` — when no semantic locator works
5. CSS selectors — last resort, flagged with a comment explaining why

### Common Patterns Library
The agent knows these common UI test patterns:

| Scenario | Pattern |
|----------|---------|
| Page navigation | `await page.goto()` + `await expect(page).toHaveURL()` |
| Form submission | `fill()` + `click()` + `waitForResponse()` or `waitForURL()` |
| Modal interaction | `click trigger` + `expect(dialog).toBeVisible()` + `click action` |
| Table/list assertions | `locator.count()`, `nth()`, text content checks |
| Loading states | `waitForSelector()` or `expect(spinner).not.toBeVisible()` |
| Toast/notification | `expect(alert).toBeVisible()` + `expect(alert).toContainText()` |

### What the agent does NOT generate:
- Visual regression baselines (`toHaveScreenshot()` without existing baselines — flags for manual baseline creation)
- Authentication flows (flags as needing `storageState` setup, asks user for auth strategy)
- API mocking (suggests but doesn't auto-configure `page.route()` intercepts)

## Scaffolding Specification

How the detect-and-scaffold flow works when a target project has no Playwright setup.

### Detection Logic

Check in order:
1. `playwright.config.ts` or `playwright.config.js` in project root → **detected**
2. `@playwright/test` in `package.json` devDependencies → **partially detected** (installed but no config)
3. Neither → **not detected**

If partially detected: create config file only, skip install.
If not detected: full scaffold.

### Scaffold Steps

1. **Install Playwright:**
   ```bash
   npm install -D @playwright/test
   npx playwright install chromium
   ```

2. **Create config file** (`playwright.config.ts`):
   ```typescript
   import { defineConfig } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     fullyParallel: true,
     retries: process.env.CI ? 2 : 0,
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

3. **Create test directory:** `mkdir -p e2e`

4. **Create example test** (`e2e/example.spec.ts`):
   ```typescript
   import { test, expect } from '@playwright/test';

   test('homepage loads', async ({ page }) => {
     await page.goto('/');
     await expect(page).toHaveTitle(/.+/);
   });
   ```

5. **Add to .gitignore:** Append `test-results/`, `playwright-report/`, `blob-report/` if not already present

### Configuration Customization

Before scaffolding, ask the user:
```
AskUserQuestion(
  header: "Playwright Config",
  question: "What's the base URL of your dev server?",
  options: [
    "http://localhost:3000",
    "http://localhost:5173 (Vite)",
    "http://localhost:4200 (Angular)",
    "I'll specify"
  ]
)
```

The test directory defaults to `e2e/` but adapts if the project already uses a different convention (e.g., `tests/` for unit tests → `e2e/` to avoid collision).
