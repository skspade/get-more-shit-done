# Feature Research

**Domain:** Playwright UI Testing Integration for GSD autonomous coding orchestrator
**Researched:** 2026-03-19
**Confidence:** HIGH (Playwright official docs + Microsoft dev blog + verified ecosystem sources)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any Playwright integration. Missing these = the integration feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Playwright detection | Users expect the tool to find existing setup rather than blindly scaffolding over it | LOW | Check `playwright.config.ts`, `playwright.config.js` in project root, then `@playwright/test` in package.json. Three-tier: fully-detected / partially-detected (installed, no config) / not-detected. Already specified in design doc. |
| Playwright scaffolding (`npm install -D @playwright/test` + config creation) | Zero-to-running in one command is the baseline expectation for any test tooling integration | MEDIUM | Design doc specifies: install, `playwright.config.ts` creation with Chromium-only defaults, `e2e/` directory, example test, `.gitignore` updates. `npx playwright install chromium` for browser binary. |
| Playwright test execution (`npx playwright test`) | Running tests is the whole point | LOW | Parse stdout/stderr for pass/fail counts. Exit code 0 = all pass, non-zero = failures. Collect `test-results/` artifacts on failure. |
| Screenshot on failure | Industry standard — all major test frameworks do this. Users expect failures to have visual evidence. | LOW | Already in design doc config: `screenshot: 'only-on-failure'`. Playwright auto-saves under `test-results/`. |
| Pass/fail result summary | After running tests, show how many passed, failed, skipped | LOW | Parse Playwright CLI output. Format as table matching existing GSD summary pattern. |
| Basic test file generation from phase context | The whole point of GSD Playwright integration is generating tests from GSD phase context (CONTEXT.md, SUMMARY.md), not from scratch | HIGH | Map CONTEXT.md Given/When/Then acceptance tests to Playwright `test()` blocks. Locator priority: `getByRole` > `getByText` > `getByLabel` > `getByTestId` > CSS (flagged). |
| `--run-only` flag (skip generation, just run) | Users with existing Playwright tests want to run without regenerating | LOW | Already specified in design doc. Skip steps 3-4 of `/gsd:ui-test` command behavior. |
| `.gitignore` updates for Playwright artifacts | `test-results/`, `playwright-report/`, `blob-report/` should not be committed. Users expect this to be handled automatically. | LOW | Append to `.gitignore` if entries not already present. Already specified in design doc. |
| add-tests E2E path integration | The existing `/gsd:add-tests` workflow already classifies files as E2E. That path should actually work now, not be a placeholder. | MEDIUM | Inline E2E logic in `add-tests.md` (not via subagent spawn — subagent limitation). Follows same patterns as `gsd-playwright` agent but executed directly. |

### Differentiators (Competitive Advantage)

Features that make GSD's Playwright integration better than just running `npx playwright test` manually.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Phase-aware test generation | GSD uniquely has structured phase context (CONTEXT.md acceptance tests, SUMMARY.md changed files). Generating Playwright specs directly from Given/When/Then acceptance tests is a capability no standalone Playwright tool provides. | HIGH | Core differentiator. Map AT-NN acceptance tests to `test.describe` + `test()` blocks. Reference specific file changes from SUMMARY.md to determine what UI behaviors need covering. |
| Acceptance test to spec mapping | GSD CONTEXT.md acceptance tests in Given/When/Then/Verify format map naturally to Playwright test structure. Auto-populate Verify field with `npx playwright test {spec-file}` when E2E tests are generated. | MEDIUM | Closes the loop between acceptance tests and executable specs. Users see the connection between what was planned and what runs. |
| Failure categorization (test issue vs app bug) | Raw Playwright output says "failed." GSD's integration distinguishes: locator-not-found = likely test issue; timeout = likely app issue. Actionable next steps differ. | MEDIUM | Parse error messages for patterns: `strict mode violation`, `locator.click`, `Timeout`, `net::ERR_CONNECTION`. Route to different suggestions. Already specified in design doc (Results Reporting step). |
| Trace file linking on failure | Playwright generates `.zip` trace files on failure. GSD surfaces the trace path and explains how to open it (`npx playwright show-trace`). | LOW | Trace viewer is Playwright's most powerful debugging tool. Exposing the path + command is low effort, high value for new users unfamiliar with the trace viewer workflow. |
| Chromium-only default | Running all 3 browsers (Chromium, Firefox, WebKit) is the Playwright default but massively slower. GSD defaults to Chromium-only for speed. | LOW | Already specified in design doc. Document the tradeoff clearly — cross-browser can be enabled manually. Aligns with fast-feedback-first philosophy. |
| Scaffolding question for base URL | Dev servers run on different ports (3000 for CRA/Next, 5173 for Vite, 4200 for Angular). Asking at scaffold time prevents broken `baseURL` in config. | LOW | Already specified in design doc. Options: 3000, 5173 (Vite), 4200 (Angular), "I'll specify." |
| Idiomatic locator generation | Generated tests use accessible locators (`getByRole`, `getByLabel`) rather than CSS selectors. Matches Playwright best practices and produces more resilient tests. | MEDIUM | Requires reading implementation file + acceptance test to infer what role/label to target. Low-confidence locators flagged with comment. Already in design doc locator priority list. |
| `--headed` flag for interactive debugging | Running tests in headed mode (visible browser) is useful when tests fail and trace viewer isn't enough. One flag vs editing config. | LOW | Already in design doc. Pass `--headed` to `npx playwright test`. |
| RED-GREEN execution in add-tests | After generating a Playwright spec, immediately run it. Report GREEN (spec passes) or RED (spec fails — investigate if test issue or app bug). Mirrors existing TDD RED-GREEN pattern in add-tests. | MEDIUM | Consistency with existing add-tests TDD execution. Run individual spec file immediately after generation: `npx playwright test {spec-file}`. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful for a Playwright integration but create more problems than they solve.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Visual regression baselines (`toHaveScreenshot()`) auto-generated | Visual tests are powerful. Users want them auto-added to generated specs. | Baselines require manual creation and approval on first run. Auto-generating `toHaveScreenshot()` without existing baselines causes every test to fail on first run with "missing baseline screenshot" errors. This creates confusion for new users who expect green on first run. | Flag visual regression as a candidate where applicable, but don't auto-generate. Comment in generated code: `// TODO: add toHaveScreenshot() after baseline is established`. Already documented in design doc "What the agent does NOT generate." |
| Authentication flow auto-generation | Many apps require login before testing. Users want this handled automatically. | Auth strategies vary widely: cookie-based, token-based, SSO, OAuth. Auto-generated auth flows are almost always wrong and lead to confused test failures. Requires `storageState` setup which is project-specific. | Flag auth requirement in generated test: `// TODO: configure storageState for authenticated tests. See playwright.dev/docs/auth`. Ask user for auth strategy before generating auth-dependent tests. |
| `page.route()` API mocking auto-configuration | Intercepting network requests makes tests fast and deterministic. Naturally appealing. | Mock setup requires knowing the exact API URLs, request shapes, and response shapes — all project-specific. Bad mocks silently make tests pass against wrong behavior. | Suggest API mocking as a next step in the results report when tests fail due to network errors. Never auto-configure. Already documented in design doc. |
| Multi-browser parallel runs by default | "Test in all browsers" sounds thorough. | Firefox and WebKit add 2-3x execution time and surface mostly platform-specific issues irrelevant for most web apps. Slows the GSD feedback loop. | Default Chromium-only. Document how to enable Firefox/WebKit in `playwright.config.ts`. |
| Playwright MCP server integration | MCP server enables AI-assisted live DOM inspection and test generation. | This is a separate tool (`npx @playwright/mcp@latest`) that requires MCP client setup (Cursor, Copilot). GSD's Playwright agent is already doing AI-driven generation from phase context — adding MCP creates an orthogonal, overlapping flow. | GSD's phase-context-driven generation is the approach. Codegen (`npx playwright codegen`) as a manual escape hatch for users who want record-and-replay. |
| Playwright Codegen recording integration | Record-and-replay generates tests from actual browser interactions. | Generated code is verbose, uses fragile CSS selectors, and requires a running app. GSD generates tests from design artifacts (CONTEXT.md), which works before the app is fully deployed and produces cleaner tests. | Document `npx playwright codegen {url}` as a manual option in the generated comment at top of spec files. |
| HTML report auto-open | Some Playwright integrations auto-open the HTML report in a browser after each run. | GSD runs in Claude Code CLI, not in a browser context. Auto-opening creates a hanging process and breaks the GSD command lifecycle. | Surface the report path and `npx playwright show-report` command in the results output. Let user open manually. |
| Flaky test retry with quarantine | Automatically retrying flaky tests and quarantining them. | Adds significant complexity (tracking flake history, quarantine state). The GSD test architecture already has a baseline comparison approach (only blocks on NEW failures). Flake management is orthogonal to this milestone. | Configure `retries: 2` in CI mode in `playwright.config.ts` scaffold. That's the Playwright-native approach. Don't build a quarantine system. |
| Test budgeting for E2E tests | GSD has per-phase (50) and project (800) test budgets for unit tests. Applying the same budget to E2E tests. | E2E test counts are inherently much smaller (5-20 per feature, not 50-100). The existing budget framework is calibrated for unit tests. Applying it to E2E tests would hit the budget with a handful of normal-sized E2E suites. | Track E2E test files separately. Don't include E2E tests in the existing unit test budget. |

## Feature Dependencies

```
Playwright detection
    └──required by──> Scaffolding (skip if already detected)
    └──required by──> Test execution (need config location)
    └──required by──> add-tests E2E path (check before generation)

Playwright scaffolding
    └──required by──> Test generation (need config + test dir)
    └──produces──> playwright.config.ts, e2e/ directory, .gitignore updates

Phase context loading (CONTEXT.md, SUMMARY.md)
    └──required by──> Phase-aware test generation (source of acceptance tests)
    └──existing dependency──> init-phase-op in gsd-tools.cjs (already built)

Test generation
    └──required by──> RED-GREEN execution in add-tests
    └──required by──> Failure categorization (need to run to get failures)

Test execution
    └──required by──> Pass/fail result summary
    └──required by──> Screenshot on failure (Playwright auto-saves on run)
    └──required by──> Trace file linking (Playwright auto-saves on run)
    └──required by──> Failure categorization

add-tests E2E path
    └──depends on──> Playwright detection
    └──depends on──> Test generation patterns (inline, not spawned agent)
    └──integrates with──> Existing add-tests TDD path (same summary table)

/gsd:ui-test command
    └──delegates to──> gsd-playwright agent
    └──depends on──> Playwright detection
    └──depends on──> Scaffolding (when not detected)
    └──depends on──> Test generation (when phase arg provided)
    └──depends on──> Test execution
```

### Dependency Notes

- **Scaffolding requires detection first:** Detection determines whether to run full scaffold, config-only scaffold, or skip. Always detect before scaffolding.
- **Test generation requires phase context:** The differentiating value of GSD's Playwright integration is phase-aware generation. Without loading CONTEXT.md + SUMMARY.md, generation falls back to generic patterns with no GSD advantage.
- **add-tests cannot spawn gsd-playwright as subagent:** Per PROJECT.md constraint, subagents cannot spawn subagents. The `add-tests` workflow must include E2E generation logic inline. The `gsd-playwright` agent spec documents the canonical patterns; the workflow implements them directly.
- **Failure categorization depends on running tests:** Cannot categorize failures without actual failure messages from `npx playwright test`.

## MVP Definition

### Launch With (v2.7)

Minimum viable product — what demonstrates the Playwright integration works end-to-end.

- [ ] `/gsd:ui-test` command with argument parsing (phase, URL, free-text, `--scaffold`, `--run-only`, `--headed`) — entry point
- [ ] `gsd-playwright` agent with detection, scaffolding, test generation, execution, results reporting — core agent
- [ ] Phase-aware test generation: CONTEXT.md acceptance tests → Playwright spec files with correct locator priority
- [ ] Playwright scaffolding specification: three-tier detection, `playwright.config.ts`, Chromium-only defaults, `e2e/`, `.gitignore`
- [ ] Test execution with pass/fail summary, screenshot paths, trace paths on failure
- [ ] Failure categorization (test issue vs app bug heuristic)
- [ ] Enhanced `add-tests` E2E path: detection check, scaffolding prompt, inline `.spec.ts` generation, RED-GREEN execution
- [ ] Results fold into existing `add-tests` summary table (no separate reporting flow)

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Acceptance test Verify field auto-population — update CONTEXT.md `Verify` lines with `npx playwright test {spec-file}` after generation. Trigger: core generation is working and spec filenames are stable.
- [ ] `--headed` debugging guidance — when tests fail, surface `npx playwright test --headed --debug` as a next step. Trigger: users report needing visual debugging help.

### Future Consideration (v2+)

Features to defer until Playwright integration is proven in practice.

- [ ] Visual regression baseline workflow — guide for establishing `toHaveScreenshot()` baselines. Deferred because it requires a working app and careful baseline approval process.
- [ ] Multi-browser matrix — optional Firefox/WebKit runs. Deferred because Chromium-only covers 95% of use cases.
- [ ] Authentication flow templates — `storageState` setup patterns for common auth types (cookie, JWT, OAuth). Deferred because auth strategies are highly project-specific.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Playwright detection + scaffolding | HIGH | MEDIUM | P1 |
| Phase-aware test generation | HIGH | HIGH | P1 |
| Test execution + pass/fail summary | HIGH | LOW | P1 |
| `/gsd:ui-test` command | HIGH | LOW | P1 |
| `gsd-playwright` agent | HIGH | MEDIUM | P1 |
| add-tests E2E path enhancement | HIGH | MEDIUM | P1 |
| Failure categorization | MEDIUM | MEDIUM | P2 |
| Trace file path surfacing | MEDIUM | LOW | P2 |
| Screenshot on failure (config) | MEDIUM | LOW | P2 |
| Acceptance test Verify field update | MEDIUM | LOW | P2 |
| `--headed` flag | LOW | LOW | P2 |
| Visual regression baseline workflow | LOW | HIGH | P3 |
| Multi-browser matrix | LOW | MEDIUM | P3 |
| Authentication templates | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v2.7)
- P2: Should have, add when possible (v2.7.x)
- P3: Nice to have, future consideration (v2.8+)

## Competitor Feature Analysis

| Feature | Raw `npx playwright test` | Playwright Codegen | GSD Playwright Integration |
|---------|---------------------------|-------------------|---------------------------|
| Test generation | None — write from scratch | Record-and-replay in live browser | Generate from phase context (CONTEXT.md/SUMMARY.md) — works before app is running |
| Test structure | N/A | Generated but verbose, fragile CSS selectors | Idiomatic: `getByRole` priority, AAA structure, AT mapping |
| Scaffolding | `npm init playwright@latest` (interactive wizard) | Requires existing setup | Integrated: detect/scaffold as part of command, sensible GSD defaults |
| Results reporting | CLI output only | N/A | CLI output + failure categorization + trace path surfacing |
| Phase context awareness | None | None | Core feature: reads GSD CONTEXT.md, SUMMARY.md, maps acceptance tests |
| add-tests workflow integration | None | None | First-class: E2E path in add-tests triggers Playwright generation |
| Auth handling | Manual | Manual | Flags as TODO, asks user (same as Codegen) |
| Visual regression | Requires manual setup | N/A | Flags as TODO candidate, does not auto-generate baselines |

## Sources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices) — official docs, locator hierarchy, test isolation patterns
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) — trace capture on failure, `show-trace` command
- [Playwright Components (experimental)](https://playwright.dev/docs/test-components) — component testing scope and limitations
- [Playwright Authentication](https://playwright.dev/docs/auth) — storageState patterns, worker-level auth reuse
- [Playwright Reporters](https://playwright.dev/docs/test-reporters) — HTML reporter, JUnit, multi-reporter configuration
- [BrowserStack: Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) — community-validated patterns
- [Microsoft Developer Blog: Complete Playwright E2E Story](https://developer.microsoft.com/blog/the-complete-playwright-end-to-end-story-tools-ai-and-real-world-workflows) — AI + MCP + Codegen ecosystem overview
- [TestDino: AI Test Generation Tools 2026](https://testdino.com/blog/ai-test-generation-tools/) — Codegen vs MCP vs AI-generated comparison
- [Playwright MCP Integration](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/how-to-integrate-playwright-mcp-for-ai-driven-test-automation/4470372) — Microsoft Community Hub, official MCP server documentation
- GSD design doc: `.planning/designs/2026-03-19-playwright-ui-testing-integration-design.md`
- GSD existing infrastructure: `get-shit-done/workflows/add-tests.md`, `agents/gsd-test-steward.md`

---
*Feature research for: Playwright UI Testing Integration (GSD v2.7)*
*Researched: 2026-03-19*
