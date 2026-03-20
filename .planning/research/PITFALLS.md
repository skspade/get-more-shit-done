# Pitfalls Research

**Domain:** Adding Playwright UI testing integration to an existing CLI/workflow tool (GSD v2.7)
**Researched:** 2026-03-19
**Confidence:** HIGH (codebase analysis) / MEDIUM (Playwright-specific, from official docs + community)

## Critical Pitfalls

### Pitfall 1: Playwright `.spec.ts` Files Blow the Test Budget Without Warning

**What goes wrong:**
GSD's `countTestsInFile()` in `testing.cjs` uses the regex `/^\s*(?:test|it)\s*\(/gm` to count test cases, and `findTestFiles()` matches any file matching `/\.(test|spec)\.(js|ts|cjs|mjs)$/`. Playwright test files use `test()` as their primary API — every `.spec.ts` written for UI testing is counted against the 800-test project budget. A single E2E spec with 20 scenarios pushes the budget from 796 to 816 and triggers the hard gate warning. Since the budget is already at 796/800 (99.5%), even a single Playwright spec file with 5 tests immediately exceeds the limit.

**Why it happens:**
The test budget system was designed for unit tests. Playwright tests use the same `test(...)` syntax as Jest/Vitest but live in a different context: they run against a browser, are slow to execute, and are not meant to be counted alongside unit tests. The regex-based counter cannot distinguish framework intent.

**How to avoid:**
Exclude Playwright spec files from the budget count by convention or directory. Options:
1. Place all Playwright specs under `e2e/` and add `'e2e'` to `EXCLUDE_DIRS` in `testing.cjs`
2. Detect Playwright files by checking for `from '@playwright/test'` import before counting
3. Add a `test.playwright_budget` config separate from unit test budget

The simplest and safest approach for v2.7 is option 1: document that all generated `.spec.ts` files go to `e2e/` and extend `EXCLUDE_DIRS` to exclude that directory from budget counting. Do this in Phase 1 of implementation before writing any specs.

**Warning signs:**
- `gsd-tools.cjs test-count` output increases by more than 4 after scaffolding Playwright
- Test steward reports "budget exceeded" immediately after `/gsd:ui-test` runs
- `.spec.ts` files appearing in `tests/` rather than `e2e/` directory

**Phase to address:**
Phase 1 (scaffolding spec) — define the `e2e/` directory convention and the `EXCLUDE_DIRS` extension before any test generation happens.

---

### Pitfall 2: Three-Tier Detection Has a Partial-Install False Negative

**What goes wrong:**
The planned three-tier detection (package.json dep check → `playwright.config.ts` file check → `@playwright/test` import in existing files) can produce a false "not installed" result when Playwright is partially installed: `@playwright/test` is in `package.json` but browser binaries are missing. The gsd-playwright agent scaffolds a new config and tries `npx playwright test`, which fails with "browser not found" — not an application error but a missing binary error. The agent may interpret this as "Playwright is not working" and prompt for re-scaffolding again, creating a confusing loop.

**Why it happens:**
The detection checks the package registry state but not the binary cache state. `playwright.config.ts` presence means configured; binary presence means runnable. These are distinct conditions. The `npx playwright install` step is separate from `npm install @playwright/test`.

**How to avoid:**
Add a fourth detection tier: after detecting `playwright.config.ts` exists, run `npx playwright --version 2>/dev/null` to confirm the CLI is accessible, then verify at least one browser binary directory exists under `~/.cache/ms-playwright/` or the configured browsers path. If config exists but binaries are missing, emit a specific "Playwright binaries missing — run: `npx playwright install chromium`" error rather than re-scaffolding.

The gsd-playwright agent prompt must explicitly distinguish these four states:
- Not installed (no dep, no config)
- Installed but not configured (dep exists, no config)
- Configured but binaries missing (config exists, no binary cache)
- Fully ready (config + binaries present)

**Warning signs:**
- `Error: browserType.launch: Executable doesn't exist` in playwright output
- Detection returning "not installed" on a project that has `playwright.config.ts`
- Agent creating a second `playwright.config.ts` alongside an existing one

**Phase to address:**
Phase 1 (gsd-playwright agent scaffolding logic) — define all four detection states explicitly in the agent prompt.

---

### Pitfall 3: Generated Tests Use Brittle CSS Selectors Instead of Role-Based Locators

**What goes wrong:**
When the gsd-playwright agent generates test code from acceptance criteria (Given/When/Then format), it has no visibility into the actual DOM of the target application. Without access to the rendered page or explicit `data-testid` attributes in the source, the agent generates positional or CSS-based locators: `page.locator('.submit-btn')`, `page.locator('button:nth-child(3)')`, or `page.getByRole('button').nth(2)`. These selectors break the moment a developer changes CSS class names, reorders DOM siblings, or refactors a component.

**Why it happens:**
AI-generated Playwright tests face a fundamental information gap: the accessibility tree (what Playwright sees) omits non-semantic containers and generic div wrappers. Without running the app and inspecting the DOM, the only information available is the source code and acceptance criteria text. Source code rarely exposes locator-stable attributes explicitly.

This is confirmed by [research](https://dev.to/johnonline35/why-ai-cant-write-good-playwright-tests-and-how-to-fix-it-knn): "it's information-theoretically impossible to generate `getByTestId('product-card')` when `data-testid='product-card'` is not present in the input."

**How to avoid:**
1. Instruct the gsd-playwright agent to use the locator priority hierarchy explicitly: `getByRole` > `getByLabel` > `getByText` > `getByTestId` > CSS selectors (last resort with comment)
2. When no stable locator is inferrable from source context, generate a placeholder comment: `// TODO: add data-testid="submit-button" to the submit button and use page.getByTestId('submit-button')`
3. Never generate `.nth()` selectors without explicit documentation in the spec that ordering is intentional and stable
4. The generate-test step in the `add-tests` E2E path should include a post-generation quality check: scan the generated file for `.nth(`, `locator('.')`, and CSS class patterns; warn the user if found

**Warning signs:**
- Generated `.spec.ts` files containing `locator('button:nth-child` or `locator('.')`
- Tests passing in CI but failing after a UI refactor that didn't change behavior
- E2E tests that fail only on certain screen sizes or when element order changes

**Phase to address:**
Phase 2 (test generation patterns) — encode the locator priority hierarchy as a hard rule in the gsd-playwright agent prompt, not a suggestion.

---

### Pitfall 4: `add-tests` E2E Path Runs Playwright in the GSD Project Instead of the Target App

**What goes wrong:**
The `add-tests` workflow currently runs in the context of the project being tested (the web app). But GSD itself is a Node.js CLI tool — it has no `playwright.config.ts`, no running server, and no UI. If the `add-tests` E2E path scaffolds Playwright in the wrong directory (`~/.claude/get-shit-done/` instead of the user's project), it will create a `playwright.config.ts` in GSD itself, install browser binaries, and attempt to run tests against a nonexistent server.

**Why it happens:**
The `add-tests` workflow uses `cwd` throughout, which in GSD's own development context is the GSD repo. When building the Playwright integration, developers will test the workflow against the GSD codebase itself. The distinction between "GSD as the tool" and "the user's web app as the target" can blur during development.

**How to avoid:**
The gsd-playwright agent must verify that the target project has UI characteristics before scaffolding: check for `package.json` with a `start` or `dev` script, look for framework markers (`next.config.js`, `vite.config.ts`, `angular.json`, etc.). If none found, emit:

```
ERROR: No web app detected in current directory.
Playwright UI testing requires a web application project.
Found: Node.js CLI tool (no start script, no framework config)
```

Additionally, the `/gsd:ui-test` command spec must include explicit guard logic: if the project type detected is "cli tool" or "node library" (no HTML entry point, no dev server config), abort with explanation.

**Warning signs:**
- `playwright.config.ts` appearing in GSD's own repo root (`.../get-more-shit-done/`)
- `npx playwright test` running against `localhost:3000` when no server was started
- The test execution step producing `net::ERR_CONNECTION_REFUSED` for all tests

**Phase to address:**
Phase 1 (command spec, detection logic) — the `/gsd:ui-test` command must reject non-web-app projects before any scaffolding occurs.

---

### Pitfall 5: `baseURL` Not Set Causes Tests to Pass Locally, Fail in On-Demand Execution

**What goes wrong:**
When gsd-playwright scaffolds `playwright.config.ts`, if `baseURL` is not explicitly set (or is set to a hardcoded `localhost:3000`), tests work when the developer already has their dev server running but fail when invoked fresh via `/gsd:ui-test` in a context where the server isn't running. The tests navigate to relative paths like `page.goto('/')` and silently succeed against whatever happens to be at that port, or fail with `net::ERR_CONNECTION_REFUSED`.

This is specifically problematic for GSD's on-demand model: `/gsd:ui-test` is invoked episodically, not in a continuous pipeline where a server is always running.

**Why it happens:**
The official Playwright `reuseExistingServer: !process.env.CI` pattern assumes CI is the "cold" environment. GSD's on-demand invocation is cold even locally — no `CI` env var is set, so `reuseExistingServer: true` allows the tests to attach to an already-running server. If no server is running, tests fail with connection errors, not a clear "server not started" message.

**How to avoid:**
The scaffolded `playwright.config.ts` must include a `webServer` block:

```typescript
webServer: {
  command: 'npm run dev',  // or 'npm start' -- detected from package.json scripts
  url: 'http://localhost:3000',  // detected from framework defaults
  reuseExistingServer: true,  // always reuse if already running
  timeout: 120 * 1000,  // 2 min startup timeout
}
```

The gsd-playwright agent should detect the dev server command by inspecting `package.json` `scripts` for `dev`, `start`, or `serve`. If ambiguous, prompt the user once and store in `playwright.config.ts`. Never scaffold without a `webServer` entry or a `baseURL` — an incomplete config is worse than no config.

**Warning signs:**
- Scaffolded `playwright.config.ts` with no `webServer` block
- Tests navigating to absolute URLs like `http://localhost:3000/` hardcoded in test files
- `/gsd:ui-test --run-only` producing "connection refused" errors when no server context is given

**Phase to address:**
Phase 1 (scaffolding specification) — `webServer` config detection logic must be part of the scaffolding spec, not left as a user post-processing step.

---

### Pitfall 6: Hard Test Gate Runs Playwright Specs in Execute-Plan Loop

**What goes wrong:**
GSD's `execute-plan` workflow runs the hard test gate (`gsd-tools.cjs test-run`) after every task commit during GSD's own development. If Playwright specs exist in the GSD project directory and match `TEST_FILE_PATTERNS`, the test runner attempts to run them with the unit test command (`node --test` or `npx jest`). Playwright specs cannot be run by Jest/node:test — they require `npx playwright test`. This causes every commit during v2.7 development to fail the hard gate with a confusing "SyntaxError: Cannot use import statement in a CommonJS module" or "Unknown test" error.

**Why it happens:**
`testing.cjs`'s `detectFramework()` returns `'node:test'` for GSD itself (it reads the test wrapper script). The `cmdTestRun()` function uses that framework to run all discovered test files, including any `.spec.ts` files. Playwright specs use ES module imports from `@playwright/test` which break when executed under Node's test runner.

**How to avoid:**
Two-layer prevention:
1. Keep all Playwright specs outside GSD's own test discovery scope (under `e2e/` with `e2e/` in EXCLUDE_DIRS)
2. The hard gate should only run unit tests (the existing framework command) — never attempt to discover and run E2E tests as part of the gate

The Playwright specs generated by GSD for user projects are in the user's project directory, not in GSD's codebase. Specs used to test GSD's own Playwright integration should live in `e2e/` and be excluded from the budget counter and the hard gate.

**Warning signs:**
- `execute-plan` hard gate failing with syntax errors after creating `.spec.ts` files
- `test-run` command showing failed test count increasing with "import" errors
- `gsd-tools.cjs test-detect-framework` returning `node:test` but test files include ES module imports

**Phase to address:**
Phase 1 (test infrastructure planning) — decide where integration test specs live relative to GSD's own test suite; Phase 2 (implementation) — extend EXCLUDE_DIRS before writing any `.spec.ts` files.

---

### Pitfall 7: Browser Binary Download in Restricted Environments Silently Hangs

**What goes wrong:**
`npx playwright install chromium` downloads ~150MB of browser binaries from a CDN. In corporate networks with proxy restrictions, restricted Docker containers, or air-gapped environments, the download silently hangs or fails with a network timeout — not a clear error message. The gsd-playwright agent waits for the install step, sees no output for minutes, and either times out or reports success based on the process exit code (which may be 0 even with partial download).

**Why it happens:**
Playwright's binary installer uses `https://playwright.azureedge.net` CDN. Proxy configurations that work for `npm install` (HTTPS to npm registry) may not apply to Azure CDN URLs. The download progress is not piped to stderr in a way that GSD's streaming output would surface clearly.

**How to avoid:**
The scaffolding step should:
1. Run `npx playwright install chromium --dry-run 2>/dev/null` first to check if binaries already exist (exit 0 = already present)
2. Set a 3-minute timeout on the install command (not the default 2-minute overall timeout)
3. Surface the install command to the user with explicit messaging: "Downloading Chromium (~150MB). This may take several minutes on slow connections."
4. If install fails, provide the `PLAYWRIGHT_BROWSERS_PATH` environment variable option for offline/restricted environments

**Warning signs:**
- Install step taking > 5 minutes with no output
- `npx playwright test` failing with "Executable doesn't exist" after a nominally successful install
- `~/.cache/ms-playwright/chromium-*/chrome-linux/chrome` not present after install

**Phase to address:**
Phase 2 (scaffolding implementation) — the gsd-playwright agent scaffolding logic must handle install timeout and failure modes explicitly.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Putting Playwright specs in `tests/` alongside unit tests | Single test directory | Budget counter counts them as unit tests; framework detection confusion; hard gate runs wrong runner | Never — separate directories from day one |
| Hardcoding `localhost:3000` in scaffolded config | Simple, works most projects | Breaks for Next.js (3001), Vite (5173), Angular (4200), and projects with custom ports | Never — always detect or prompt |
| Skipping `webServer` config in `playwright.config.ts` | Fewer moving parts | Tests only work when server is already running; fails in clean on-demand invocations | Only if user explicitly opts out with `--run-only` flag |
| Generating tests without running them | Faster feedback loop in generation step | "Looks done but isn't" — RED gate skipped; bugs in generated locators go undetected | Never — spec says RED-GREEN pattern |
| Using Chromium-only default forever | Simpler, less install overhead | Missing Firefox/WebKit coverage for cross-browser issues | Acceptable as default; acceptable to leave as config option for users who need it |
| Counting Playwright `test()` calls in budget | Single counting function for all tests | Budget exhausted immediately on real E2E test suites; blocks the hard gate mechanism for unit tests | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `testing.cjs` EXCLUDE_DIRS | Forgetting to add `e2e/` to exclusion set — Playwright specs counted in budget | Add `'e2e'` to the `EXCLUDE_DIRS` Set in `testing.cjs` before any spec generation |
| `add-tests` workflow E2E path | Calling the unit test command (`node --test`) to run Playwright specs | E2E path must invoke `npx playwright test` with the detected config file, not the unit test command |
| gsd-playwright agent + `gsd-tools.cjs` | Adding a new top-level `playwright` command instead of routing through existing test infrastructure | Route Playwright execution through `test-run` by detecting `playwright` as a framework, OR add a separate `playwright-run` subcommand with its own output parsing |
| Playwright output parsing | Playwright output format differs from Jest/Vitest — `parseTestOutput()` returns zeros | Add a `'playwright'` case to `parseTestOutput()` in `testing.cjs` — Playwright reports `N passed (NNs)` and `N failed` format |
| `detectFramework()` in user projects | Playwright coexisting with Vitest — `detectFramework()` returns `vitest` but there's also `playwright.config.ts` | Detection should be multi-framework aware: return the unit test framework for the gate, and separately detect Playwright for E2E |
| Add-tests TDD path when E2E path is blocked | User runs `/gsd:add-tests` on a phase with E2E files but Playwright not installed — the TDD path should still execute | Never abort the entire `add-tests` workflow because E2E is blocked — complete TDD tests and report E2E as a blocker in the summary |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running all Playwright browsers in every invocation | `/gsd:ui-test` takes 5+ minutes for a single spec | Scaffold Chromium-only by default; Firefox and WebKit are opt-in via config | Any project — Chromium alone is fast, all 3 is 3x slower |
| Not using `reuseExistingServer: true` | Dev server starts fresh for every `/gsd:ui-test` invocation, adding 30-60 second startup | Always set `reuseExistingServer: true` in scaffolded config | Every project with a non-trivial build step |
| Playwright trace collection enabled by default | Each test writes video/trace files to `test-results/`; disk fills up quickly | Set `trace: 'on-first-retry'` not `trace: 'on'` in scaffolded config | Projects with many test runs |
| Running Playwright in headed mode (`--headed`) during autopilot | Autopilot subprocess cannot manage a visible browser window — may hang waiting for display | Never set `headed: true` in scaffolded config; `--headed` is a user-invoked `/gsd:ui-test` flag only | Any autopilot-driven execution |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Scaffolding Playwright without asking the target URL | User gets a `playwright.config.ts` with `baseURL: undefined`; tests fail immediately | Ask for baseURL + dev server command once, store in config, never ask again |
| Presenting 20 generated E2E tests for approval as a flat list | User cannot evaluate quality — too much to read | Group by acceptance criterion from CONTEXT.md; one test per criterion max in initial pass |
| Showing Playwright HTML report path when user is in a terminal-only environment | User gets a file path they cannot open | Summarize pass/fail counts in terminal first; offer HTML report as an explicit opt-in |
| Re-scaffolding every time `/gsd:ui-test` is invoked | User's customized `playwright.config.ts` is overwritten | Detection is mandatory: if config exists, skip scaffold and go straight to test generation or execution |
| Treating Playwright install failure as a soft warning | Tests marked as "blocked" but user doesn't understand severity | Emit a hard error with exact install command and troubleshooting steps; do not continue to test generation |

---

## "Looks Done But Isn't" Checklist

- [ ] **EXCLUDE_DIRS updated:** `testing.cjs` excludes `e2e/` — verify `gsd-tools.cjs test-count` does not increase after generating specs in `e2e/`
- [ ] **Playwright output parsed:** `parseTestOutput()` handles Playwright's output format — verify it returns non-zero counts from `npx playwright test` output
- [ ] **webServer in scaffolded config:** `playwright.config.ts` template includes `webServer` block, not just `use.baseURL` — verify generated config has `webServer.command`
- [ ] **Add-tests TDD path unaffected:** Running `/gsd:add-tests` on a phase with no E2E files still works exactly as before — verify no regression in unit-test-only path
- [ ] **Hard gate not triggered by Playwright specs:** GSD's own `execute-plan` hard gate does not discover `.spec.ts` files in `e2e/` — verify `gsd-tools.cjs test-run` exits 0 after adding test specs to `e2e/`
- [ ] **Detection idempotent:** Running `/gsd:ui-test --scaffold` twice on a project with `playwright.config.ts` does not overwrite the config — verify second invocation shows "Playwright already configured" message
- [ ] **Binary check explicit:** Scaffolding step distinguishes "not installed" from "installed but no binaries" — verify error message for each case is distinct
- [ ] **Budget at 796/800 unchanged after implementation:** GSD's own test count is still 796 after all v2.7 code is written — verify with `gsd-tools.cjs test-count` before milestone close

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Budget exceeded by Playwright spec counting | LOW | Add `e2e/` to EXCLUDE_DIRS in testing.cjs; move spec files to `e2e/`; verify count drops |
| Overwritten `playwright.config.ts` in user project | LOW | Git restore `playwright.config.ts`; add idempotency check to scaffold step |
| Hard gate failing with Playwright import errors | LOW | Move spec files to `e2e/`; confirm EXCLUDE_DIRS covers them; rerun |
| baseURL wrong in scaffolded config | LOW | Edit `playwright.config.ts` directly; add detection logic to scaffolding spec |
| Browser binaries missing in CI-like environment | MEDIUM | Document `PLAYWRIGHT_BROWSERS_PATH` option; add explicit install step to `/gsd:ui-test` help text |
| Generated tests all use brittle CSS selectors | MEDIUM | Re-run generation with explicit `--force-role-locators` instruction; audit and update generated specs manually |
| Playwright test count appearing in hard gate budget | HIGH (requires code change) | Fix `EXCLUDE_DIRS` in testing.cjs to exclude `e2e/`; regression test that budget stays at pre-v2.7 number |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Playwright specs blow test budget | Phase 1 (scaffolding spec) | `gsd-tools.cjs test-count` unchanged after adding E2E specs to `e2e/` |
| Partial-install false negative in detection | Phase 1 (agent detection logic) | Agent correctly identifies each of 4 install states with distinct messages |
| Brittle CSS locators in generated tests | Phase 2 (test generation patterns) | Generated specs pass locator quality check (no `.nth()` without comment, no CSS class selectors) |
| Scaffolding runs in wrong project | Phase 1 (command spec guard logic) | `/gsd:ui-test` on GSD's own repo emits "no web app detected" error |
| baseURL not set / webServer missing | Phase 1 (scaffolding spec) | Scaffolded config always has `webServer` block with detected command |
| Hard gate runs Playwright specs as unit tests | Phase 1 (test infrastructure planning) | Hard gate exits 0 after specs created; GSD budget stays at 796 |
| Binary download hangs silently | Phase 2 (scaffolding implementation) | 3-minute timeout + explicit user messaging in install step |
| Add-tests TDD path broken | Phase 3 (add-tests workflow extension) | `/gsd:add-tests` on unit-test-only phase completes without error; regression test passes |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `get-shit-done/bin/lib/testing.cjs` lines 86-138 — `TEST_FILE_PATTERNS`, `EXCLUDE_DIRS`, `findTestFiles()`, `countTestsInFile()` — identifies budget counting vulnerability
  - `get-shit-done/bin/lib/testing.cjs` lines 286-349 — `parseTestOutput()` — confirms Playwright case not handled
  - `get-shit-done/workflows/add-tests.md` steps 3-6 — E2E classification and execution path
  - `.planning/PROJECT.md` — active v2.7 requirements, test budget status 796/800 (99.5%)
  - `gsd-tools.cjs test-count` output — confirmed 796 tests as of research date

- Official Playwright documentation (HIGH confidence):
  - [Playwright Best Practices](https://playwright.dev/docs/best-practices) — locator priority hierarchy, flaky test prevention
  - [Playwright CI](https://playwright.dev/docs/ci) — `npx playwright install --with-deps` requirement
  - [Playwright Browsers](https://playwright.dev/docs/browsers) — binary management, caching behavior
  - [Playwright webServer](https://playwright.dev/docs/test-webserver) — `webServer` config pattern, `reuseExistingServer`
  - [Playwright Locators](https://playwright.dev/docs/locators) — role-based locator priority

- Community sources (MEDIUM confidence):
  - [Better Stack: Playwright Pitfalls](https://betterstack.com/community/guides/testing/playwright-best-practices/) — CSS selector brittleness, test interdependencies
  - [Why AI Can't Write Good Playwright Tests](https://dev.to/johnonline35/why-ai-cant-write-good-playwright-tests-and-how-to-fix-it-knn) — AI locator generation fundamental limitations, accessibility tree information gap
  - [Why Playwright Tests Pass Locally but Fail in CI](https://dev.to/sentinelqa/why-playwright-tests-pass-locally-but-fail-in-ci-4ph6) — baseURL and environment mismatch patterns

---
*Pitfalls research for: GSD v2.7 Playwright UI testing integration*
*Researched: 2026-03-19*
