# Phase 72: gsd-playwright Agent - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

A reusable `gsd-playwright` agent can scaffold Playwright from scratch, generate phase-aware `.spec.ts` files from CONTEXT.md acceptance criteria, execute them via `npx playwright test`, and report structured results with failure categorization and artifact paths. This phase delivers a single new agent file (`agents/gsd-playwright.md`) that is a leaf node — spawned by both the Phase 73 `/gsd:ui-test` command and the Phase 74 `add-tests` workflow modification. It depends on the Phase 71 `detectPlaywright()` and `parsePlaywrightOutput()` infrastructure in `testing.cjs`.

</domain>

<decisions>
## Implementation Decisions

### Agent File and Lifecycle (AGNT-01)

- Single agent file `agents/gsd-playwright.md` following the existing GSD agent pattern (YAML frontmatter with name, description, tools, color; then `<role>`, `<input>`, `<process>`, `<output>` XML sections)
- Five-step lifecycle: detect, scaffold, generate, execute, report (from REQUIREMENTS.md AGNT-01)
- Agent is a leaf node — cannot spawn subagents; uses `Bash` tool directly for `npx playwright test` execution (from PROJECT.md architecture constraint)
- Tools: `Read, Write, Edit, Bash, Glob, Grep` (from ARCHITECTURE.md agent tool access analysis)
- Agent receives context via Task() prompt: mode, phase_dir, base_url, flags (from ARCHITECTURE.md data flow)
- No temporary `.planning/` state file needed — all context comes from Task() prompt and existing phase artifacts (from ARCHITECTURE.md anti-pattern 5)

### Scaffolding (AGNT-02, AGNT-03)

- Scaffolding creates `playwright.config.ts` with: `testDir: './e2e'`, `fullyParallel: true`, `reporter: 'line'`, `screenshot: 'only-on-failure'`, `trace: 'on-first-retry'`, Chromium-only project, `baseURL` from input or `http://localhost:3000` default (from STACK.md config file pattern)
- `reporter: 'line'` instead of `'html'` — line reporter produces parseable stdout that `parsePlaywrightOutput()` in testing.cjs can extract counts from (from STACK.md rationale)
- `retries: process.env.CI ? 2 : 0` and `workers: process.env.CI ? 1 : undefined` for CI-awareness (from STACK.md config file pattern)
- Scaffolding creates `e2e/` directory at project root with an example smoke test (from REQUIREMENTS.md AGNT-03)
- Scaffolding appends `test-results/`, `playwright-report/`, `blob-report/`, `.playwright/` to `.gitignore` if not already present (from STACK.md .gitignore additions)
- Scaffolding runs `npx playwright install chromium` to download browser binaries (from STACK.md installation)
- Scaffolding skipped when detection returns `configured` status (unless `--scaffold` flag forces it) (Claude's Decision: avoid overwriting user's existing config)
- When detection returns `installed` status (dep exists but no config), scaffolding creates config and runs browser install but skips `npm install` (from STACK.md stack patterns)

### Test Generation (AGNT-04, AGNT-05)

- Agent reads `{phase_dir}/CONTEXT.md` to extract acceptance criteria from `<acceptance_tests>` section (from REQUIREMENTS.md AGNT-04)
- Each acceptance criterion's Given/When/Then/Verify maps to a Playwright `test()` block inside a `describe()` group (from REQUIREMENTS.md AGNT-04)
- Locator priority hierarchy enforced in generated tests: `getByRole` > `getByText` > `getByLabel` > `getByTestId` > CSS selector (from REQUIREMENTS.md AGNT-05)
- Generated test files named `{phase-slug}.spec.ts` placed in the `e2e/` directory (from ARCHITECTURE.md step 3)
- Tests import `{ test, expect }` from `@playwright/test` (from STACK.md core technologies)
- When no `<acceptance_tests>` section exists in CONTEXT.md (auto-context mode), agent reports BLOCKED with reason "No acceptance tests defined" (Claude's Decision: auto-context intentionally omits acceptance tests per gsd-auto-context agent rules; agent should not fabricate tests)

### Execution (AGNT-06)

- Tests executed via `npx playwright test` with optional `--headed` and `--project=chromium` flags (from REQUIREMENTS.md AGNT-06)
- Output parsed using the same regex patterns that Phase 71's `parsePlaywrightOutput()` uses — agent can call `node gsd-tools.cjs` or parse stdout directly (Claude's Decision: direct stdout parsing in agent is simpler since agent already captures Bash output)
- Pass/fail/skipped counts extracted from Playwright line reporter summary

### Failure Categorization (AGNT-07)

- Agent distinguishes two failure categories in its report (from REQUIREMENTS.md AGNT-07):
  - **Test-level failures**: locator not found, element not visible, assertion mismatch — indicate test needs adjustment
  - **Application-level failures**: timeout waiting for server, connection refused, navigation failed — indicate the app is not running or has a bug
- Categorization based on error message pattern matching: `ERR_CONNECTION_REFUSED`, `net::ERR_`, `timeout` patterns signal application-level; `locator`, `not found`, `expect(` patterns signal test-level (Claude's Decision: Playwright error messages contain distinctive strings for each category; pattern matching is reliable and simple)

### Results Reporting (AGNT-08)

- Agent returns a structured `## PLAYWRIGHT COMPLETE` markdown block (from ARCHITECTURE.md pattern 2)
- Block format includes: Status (GREEN/RED/BLOCKED), Scaffolded (yes/no), Generated (N tests in M files), Passed/Failed/Skipped counts (from ARCHITECTURE.md structured return pattern)
- On failure (RED status), report includes a failure details table with: test name, error type (test-level/app-level), error message, screenshot path, trace path (from REQUIREMENTS.md AGNT-08)
- Screenshot paths from Playwright's `test-results/` directory surfaced in the report (from REQUIREMENTS.md AGNT-08)
- Trace file paths surfaced for `npx playwright show-trace` usage (from REQUIREMENTS.md AGNT-08)
- On BLOCKED status, report includes the blocker reason (e.g., "No acceptance tests defined", "Playwright scaffold failed") (Claude's Decision: BLOCKED status allows callers to distinguish "nothing to test" from "tests failed")

### Mode Handling

- Agent supports three modes passed via Task() prompt (from ARCHITECTURE.md input spec):
  - `ui-test`: full lifecycle (detect, scaffold, generate, execute, report) — used by `/gsd:ui-test` command
  - `generate`: generation and execution only (skip detection/scaffold, assume configured) — used by `add-tests` workflow
  - `scaffold`: scaffolding only (detect, scaffold, report) — used when `--scaffold` flag is passed
- `--run-only` flag causes agent to skip generation and execute existing tests only (from ARCHITECTURE.md flags)

### Claude's Discretion
- Exact example smoke test content in the scaffolded `e2e/example.spec.ts`
- Internal prompt wording within the agent's `<process>` steps
- Exact regex patterns for failure categorization (as long as both categories are distinguished)
- Whether to use a `webServer` block in the scaffold config template or leave it to the user
- Formatting of the failure details table in the structured return block

</decisions>

<specifics>
## Specific Ideas

- The agent file follows the same YAML frontmatter + XML section structure as `agents/gsd-test-steward.md`: frontmatter (name, description, tools, color), then `<role>`, `<input>`, `<process>`, `<output>` sections
- The `## PLAYWRIGHT COMPLETE` structured return follows the same pattern as `gsd-test-steward`'s `## STEWARD COMPLETE` block — a fixed markdown header that callers parse deterministically
- Phase 71 already built `detectPlaywright(cwd)` in `testing.cjs` and the `playwright-detect` dispatch in `gsd-tools.cjs` — the agent calls `node gsd-tools.cjs playwright-detect` for detection
- Phase 71 already built `parsePlaywrightOutput()` in `testing.cjs` — the agent can reference the same parsing patterns for stdout extraction
- The `e2e/` directory is already in `EXCLUDE_DIRS` in `testing.cjs` from Phase 71, so generated specs will not count against the test budget
- Playwright line reporter summary examples: `"2 passed (3.1s)"`, `"3 passed, 1 failed (5.2s)"`, `"5 passed, 2 skipped (8.1s)"`
- The scaffold config template from STACK.md research is the canonical reference for `playwright.config.ts` content

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/gsd-test-steward.md`: structural reference for agent file format (YAML frontmatter, XML sections, structured return block)
- `testing.cjs` `detectPlaywright(cwd)`: three-tier detection returning `{ status, config_path }` — agent calls this via `gsd-tools.cjs playwright-detect`
- `testing.cjs` `parsePlaywrightOutput(stdout, stderr)`: regex-based extraction of pass/fail/skipped counts from line reporter output
- `core.cjs` `output(data, raw, humanString)`: standard output function used by gsd-tools commands

### Established Patterns
- Agent files use YAML frontmatter (name, description, tools, color) followed by `<role>`, `<input>`, `<process>`, `<output>` XML sections
- Agents return structured markdown blocks (`## STEWARD COMPLETE`, `## STEWARD SKIPPED`) for deterministic caller parsing
- `Task()` spawning passes all context in the prompt — no temporary state files needed for atomic operations
- `gsd-tools.cjs` dispatch provides data layer; agents call it via `Bash` tool for deterministic operations

### Integration Points
- `agents/gsd-playwright.md`: new file — the sole deliverable of this phase
- `gsd-tools.cjs playwright-detect`: Phase 71 dispatch command that the agent calls for detection
- `testing.cjs parsePlaywrightOutput()`: Phase 71 parsing function whose patterns the agent mirrors
- Phase 73 (`/gsd:ui-test` command) and Phase 74 (`add-tests` workflow) will spawn this agent via `Task()`

</code_context>

<deferred>
## Deferred Ideas

- `/gsd:ui-test` command file creation — deferred to Phase 73
- `add-tests.md` workflow `execute_e2e_generation` step modification — deferred to Phase 74
- `webServer` block auto-detection from `package.json` scripts (detecting `dev`, `start` commands and inferring port) — deferred to future iteration; users provide `baseURL` explicitly for now
- Visual regression with `toHaveScreenshot()` baseline workflow — deferred per REQUIREMENTS.md (VISREG-01, VISREG-02)
- Multi-browser project support (Firefox, WebKit) — deferred per REQUIREMENTS.md (MBROW-01, MBROW-02)
- Authentication flow templates with `storageState` — deferred per REQUIREMENTS.md (AUTH-01, AUTH-02)
- JSON reporter fallback (`--reporter=json`) if line reporter parsing proves fragile — noted in Phase 71 deferred items

</deferred>

---

*Phase: 72-gsd-playwright-agent*
*Context gathered: 2026-03-20 via auto-context*
