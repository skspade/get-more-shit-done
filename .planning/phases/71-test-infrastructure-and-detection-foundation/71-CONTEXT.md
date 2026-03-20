# Phase 71: Test Infrastructure and Detection Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

GSD can detect Playwright installation state in a target project, parse Playwright test output into structured results, and safely exclude E2E specs from the test budget and hard test gate. This phase delivers pure infrastructure additions to `testing.cjs` and `gsd-tools.cjs` with no new commands, agents, or workflow modifications. It is the foundation that Phases 72-74 build on.

</domain>

<decisions>
## Implementation Decisions

### Playwright Detection (INFRA-01, INFRA-02)

- `detectPlaywright(cwd)` function added to `testing.cjs` as a separate function from `detectFramework()` -- Playwright is an E2E runner, not a unit test framework; the two detection paths serve different consumers (from REQUIREMENTS.md INFRA-01, ARCHITECTURE.md rationale)
- Three-tier detection return: `{ status: 'configured', config_path }` when `playwright.config.ts` or `playwright.config.js` exists at project root; `{ status: 'installed', config_path: null }` when `@playwright/test` is in `package.json` dependencies or devDependencies but no config file; `{ status: 'not-detected', config_path: null }` when neither is found (from REQUIREMENTS.md INFRA-01, success criteria 1 and 2)
- Config file detection checks both `.ts` and `.js` extensions via `fs.existsSync()` (from STACK.md config file pattern)
- Package.json dependency check reads both `dependencies` and `devDependencies` for `@playwright/test` (from ARCHITECTURE.md detection logic)
- `playwright-detect` dispatch command added to `gsd-tools.cjs` following the `test-detect-framework` dispatch pattern -- single case in the switch block calling `testing.cmdPlaywrightDetect(cwd, raw)` (from REQUIREMENTS.md INFRA-02)
- `cmdPlaywrightDetect(cwd, raw)` wrapper function in `testing.cjs` calls `detectPlaywright(cwd)` and outputs via `output()` (Claude's Decision: matches cmdTestDetectFramework pattern exactly for consistency)

### Output Parsing (INFRA-03)

- `'playwright'` case added to the `parseTestOutput()` switch statement in `testing.cjs` (from REQUIREMENTS.md INFRA-03)
- Regex parses Playwright line reporter summary format: `/(\d+)\s+passed/` for passed count, `/(\d+)\s+failed/` for failed count, `/(\d+)\s+skipped/` for skipped count (from STACK.md output parsing section)
- Total is computed as `passed + failed + skipped` since Playwright line reporter does not emit a separate total (Claude's Decision: matches mocha/vitest pattern of computing total from components)
- Failed test extraction parses lines matching `/^\s+\d+\)\s+(.+)$/gm` from Playwright's numbered failure output (Claude's Decision: Playwright prefixes failures with numbered list like "  1) test name"; this pattern captures the test description)

### E2E Budget Exclusion (INFRA-04)

- `'e2e'` added to the `EXCLUDE_DIRS` Set in `testing.cjs` alongside existing exclusions (`node_modules`, `.git`, `.planning`, `dist`, `build`, `coverage`) (from REQUIREMENTS.md INFRA-04)
- This prevents `findTestFiles()` from discovering `.spec.ts` files under `e2e/` directories, keeping them out of the test budget counter and hard test gate discovery (from PITFALLS.md Pitfall 1 and 6)
- No changes to `TEST_FILE_PATTERNS` regex -- the exclusion is directory-based, not pattern-based (Claude's Decision: directory exclusion is simpler and more reliable than import-sniffing; all Playwright specs will live in e2e/ by convention)

### DevDependency Addition (INFRA-05)

- `@playwright/test` added as a devDependency in GSD's `package.json` for detection testing without live Playwright installs (from REQUIREMENTS.md INFRA-05)
- Version range `^1.50.0` matching research recommendation (from STACK.md version compatibility)

### Claude's Discretion
- Internal helper for safe package.json reading in `detectPlaywright()` (reuse existing pattern or inline)
- Exact wording of the human-readable output string from `cmdPlaywrightDetect`
- Whether to add skipped count to the `parseTestOutput` result type or keep existing `{ total, passed, failed, failedTests }` shape
- Order of the new `playwright-detect` case relative to existing test commands in gsd-tools.cjs switch

</decisions>

<specifics>
## Specific Ideas

- The `EXCLUDE_DIRS` Set on line 89 of `testing.cjs` currently contains: `node_modules`, `.git`, `.planning`, `dist`, `build`, `coverage` -- add `'e2e'` to this Set
- The `parseTestOutput()` switch on line 290 of `testing.cjs` has cases for `node:test`, `jest`, `vitest`, `mocha` -- add `'playwright'` case before the `default`
- The `test-detect-framework` dispatch case on line 648 of `gsd-tools.cjs` is the direct pattern for the new `playwright-detect` case
- Playwright line reporter summary examples: `"2 passed (3.1s)"`, `"3 passed, 1 failed (5.2s)"`, `"5 passed, 2 skipped (8.1s)"`
- The `module.exports` at line 534 of `testing.cjs` needs `detectPlaywright` and `cmdPlaywrightDetect` added
- The `package.json` devDependencies currently has only `c8` and `esbuild` -- add `@playwright/test`
- GSD's test budget is at 796/800 (99.5%); adding `'e2e'` to EXCLUDE_DIRS must happen before any Playwright specs are generated in later phases to prevent budget overflow

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `testing.cjs` `detectFramework(cwd)`: pattern for config-file-then-package-json detection; `detectPlaywright()` follows the same two-tier approach
- `testing.cjs` `parseTestOutput(stdout, stderr, framework)`: switch-based framework parsing with regex extraction; new `'playwright'` case follows identical structure
- `testing.cjs` `cmdTestDetectFramework(cwd, raw)`: thin wrapper that calls detection and outputs via `output()` -- `cmdPlaywrightDetect` mirrors this exactly
- `core.cjs` `output(data, raw, humanString)`: standard JSON/human output function used by all gsd-tools commands

### Established Patterns
- `EXCLUDE_DIRS` is a `Set` checked via `.has()` during directory traversal in `findTestFiles()` -- adding a string to the Set is the complete integration
- `gsd-tools.cjs` dispatch uses `switch(args[0])` with each case calling a module function and breaking -- new cases follow this exact shape
- `module.exports` at bottom of `testing.cjs` lists all public functions -- new exports append to this object

### Integration Points
- `testing.cjs` line 89: `EXCLUDE_DIRS` Set -- add `'e2e'`
- `testing.cjs` line 290-349: `parseTestOutput()` switch -- add `'playwright'` case
- `testing.cjs` line 534-545: `module.exports` -- add `detectPlaywright`, `cmdPlaywrightDetect`
- `gsd-tools.cjs` near line 648: test command dispatch -- add `'playwright-detect'` case
- `package.json` line 26-29: `devDependencies` -- add `@playwright/test`

</code_context>

<deferred>
## Deferred Ideas

- Four-state detection (adding "configured-no-binaries" tier via `npx playwright --version` check) -- deferred to Phase 72 agent logic where binary state matters for scaffolding decisions
- `webServer` block detection and dev command inference from `package.json` scripts -- deferred to Phase 72 scaffolding
- Web app validation guard (rejecting CLI-only projects) -- deferred to Phase 72/73 agent and command
- Locator priority hierarchy enforcement -- deferred to Phase 72 test generation
- JSON reporter fallback (`--reporter=json`) if line reporter parsing proves fragile -- deferred to Phase 72
- `add-tests.md` workflow modification -- deferred to Phase 74

</deferred>

---

*Phase: 71-test-infrastructure-and-detection-foundation*
*Context gathered: 2026-03-20 via auto-context*
