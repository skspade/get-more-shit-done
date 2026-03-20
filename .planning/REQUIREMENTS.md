# Requirements: GSD Autopilot

**Defined:** 2026-03-19
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v2.7 Requirements

Requirements for Playwright UI Testing Integration. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: `detectPlaywright()` function in testing.cjs with three-tier detection (configured / installed-no-config / not-detected)
- [ ] **INFRA-02**: `playwright-detect` dispatch command in gsd-tools.cjs following test-detect-framework pattern
- [ ] **INFRA-03**: `parsePlaywrightOutput()` case in testing.cjs parsing line reporter pass/fail counts
- [ ] **INFRA-04**: `e2e/` added to EXCLUDE_DIRS in testing.cjs to prevent Playwright specs counting against test budget
- [ ] **INFRA-05**: `@playwright/test` added as devDependency in GSD's package.json for detection testing

### Agent

- [ ] **AGNT-01**: `gsd-playwright` agent with five-step lifecycle (detect, scaffold, generate, execute, report)
- [ ] **AGNT-02**: Playwright scaffolding creates `playwright.config.ts` with Chromium-only, line reporter, webServer block, screenshot on failure
- [ ] **AGNT-03**: Scaffolding creates `e2e/` directory with example test and updates `.gitignore`
- [ ] **AGNT-04**: Phase-aware test generation maps CONTEXT.md Given/When/Then acceptance tests to `.spec.ts` files
- [ ] **AGNT-05**: Generated tests use locator priority hierarchy (getByRole > getByText > getByLabel > getByTestId > CSS)
- [ ] **AGNT-06**: Test execution via `npx playwright test` with structured pass/fail/skipped result parsing
- [ ] **AGNT-07**: Failure categorization distinguishes test issues (locator-not-found) from app bugs (timeout, connection refused)
- [ ] **AGNT-08**: Results reporting surfaces screenshot paths and trace file paths on failure

### Command

- [ ] **CMD-01**: `/gsd:ui-test` command spec with argument parsing (phase number, URL, free-text instructions)
- [ ] **CMD-02**: `--scaffold` flag forces scaffolding even if Playwright is detected
- [ ] **CMD-03**: `--run-only` flag skips generation and runs existing tests
- [ ] **CMD-04**: `--headed` flag runs tests in visible browser mode
- [ ] **CMD-05**: Command spawns gsd-playwright agent and presents structured results with GSD banner

### Workflow

- [ ] **WKFL-01**: Enhanced `execute_e2e_generation` step in add-tests.md with Playwright detection gate
- [ ] **WKFL-02**: Scaffolding prompt when Playwright not detected in add-tests workflow
- [ ] **WKFL-03**: Inline `.spec.ts` generation in add-tests following gsd-playwright agent patterns
- [ ] **WKFL-04**: RED-GREEN execution pattern for E2E tests matching existing TDD step
- [ ] **WKFL-05**: E2E results fold into existing add-tests summary table alongside unit test results
- [ ] **WKFL-06**: TDD path in add-tests remains completely unchanged (regression constraint)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Visual Regression

- **VISREG-01**: Visual regression baseline workflow for `toHaveScreenshot()` setup
- **VISREG-02**: Baseline approval process with screenshot comparison

### Multi-Browser

- **MBROW-01**: Optional Firefox/WebKit test matrix configuration
- **MBROW-02**: Cross-browser failure isolation and reporting

### Authentication

- **AUTH-01**: Authentication flow templates with `storageState` setup
- **AUTH-02**: Common auth pattern library (cookie, JWT, OAuth)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Playwright MCP server integration | GSD's phase-context generation is the approach; MCP creates overlapping flow |
| Playwright Codegen recording | Record-and-replay produces verbose, fragile code; GSD generates from design artifacts |
| HTML report auto-open | GSD runs in CLI; auto-opening creates hanging process |
| API mocking auto-configuration | Mock setup requires project-specific API knowledge |
| Test budgeting for E2E tests | E2E counts are inherently smaller; existing budget calibrated for unit tests |
| Flaky test quarantine | Playwright `retries: 2` is sufficient; quarantine system is orthogonal |
| Pipeline integration (autonomous gate) | This is on-demand only; not wired into the autonomous pipeline |
| Visual regression baselines auto-generated | Baselines require manual approval; auto-generating causes first-run failures |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase TBD | Pending |
| INFRA-02 | Phase TBD | Pending |
| INFRA-03 | Phase TBD | Pending |
| INFRA-04 | Phase TBD | Pending |
| INFRA-05 | Phase TBD | Pending |
| AGNT-01 | Phase TBD | Pending |
| AGNT-02 | Phase TBD | Pending |
| AGNT-03 | Phase TBD | Pending |
| AGNT-04 | Phase TBD | Pending |
| AGNT-05 | Phase TBD | Pending |
| AGNT-06 | Phase TBD | Pending |
| AGNT-07 | Phase TBD | Pending |
| AGNT-08 | Phase TBD | Pending |
| CMD-01 | Phase TBD | Pending |
| CMD-02 | Phase TBD | Pending |
| CMD-03 | Phase TBD | Pending |
| CMD-04 | Phase TBD | Pending |
| CMD-05 | Phase TBD | Pending |
| WKFL-01 | Phase TBD | Pending |
| WKFL-02 | Phase TBD | Pending |
| WKFL-03 | Phase TBD | Pending |
| WKFL-04 | Phase TBD | Pending |
| WKFL-05 | Phase TBD | Pending |
| WKFL-06 | Phase TBD | Pending |

**Coverage:**
- v2.7 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
