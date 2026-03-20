# Phase 74: add-tests Workflow Enhancement - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The existing `add-tests` workflow detects Playwright availability and generates E2E `.spec.ts` files alongside unit tests without breaking the TDD path. This phase surgically modifies `get-shit-done/workflows/add-tests.md` to add a Playwright detection gate, optional scaffolding prompt, inline spec generation using `gsd-playwright` agent patterns, and E2E result folding into the existing summary table. The unit test path (TDD generation, RED-GREEN cycle) remains completely unchanged.

</domain>

<decisions>
## Implementation Decisions

### Playwright Detection Gate (WKFL-01)

- Add a Playwright detection step inside `execute_e2e_generation` before generating any E2E tests (from REQUIREMENTS.md WKFL-01)
- Detection calls `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" playwright-detect --raw` to get `{ status, config_path }` JSON (from Phase 71 infrastructure)
- When status is `configured`: proceed directly to `.spec.ts` generation (from REQUIREMENTS.md WKFL-01)
- When status is `not-detected` or `installed`: route to scaffolding prompt (from REQUIREMENTS.md WKFL-02)
- Detection runs once at the start of `execute_e2e_generation`, not per-file (Claude's Decision: detection result is project-wide; checking once avoids redundant calls)

### Scaffolding Prompt (WKFL-02)

- When Playwright is not detected, present an `AskUserQuestion` asking whether to scaffold Playwright before proceeding (from REQUIREMENTS.md WKFL-02)
- Options: "Scaffold Playwright and continue", "Skip E2E tests", "Cancel" (Claude's Decision: three options cover all user intents; matches the existing classification approval pattern in add-tests)
- If user chooses scaffold: run the same scaffolding steps defined in `agents/gsd-playwright.md` Step 2 inline (create config, e2e dir, example test, .gitignore entries, install chromium) (from REQUIREMENTS.md WKFL-02, Phase 72 agent patterns)
- If user chooses skip: bypass E2E generation entirely, record E2E counts as zero in summary table (Claude's Decision: user may want to add tests later without blocking the current run)
- Scaffolding is inline in the workflow, not a Task() spawn of gsd-playwright (Claude's Decision: add-tests already has Write/Edit/Bash tools; spawning an agent for scaffolding adds unnecessary context overhead for a deterministic set of file writes)

### E2E Spec Generation (WKFL-03)

- Replace the current generic E2E generation logic in `execute_e2e_generation` with Playwright-specific `.spec.ts` generation following `gsd-playwright` agent patterns (from REQUIREMENTS.md WKFL-03)
- Generated tests import `{ test, expect }` from `@playwright/test` (from Phase 72 agent pattern)
- Generated tests use the locator priority hierarchy: `getByRole` > `getByText` > `getByLabel` > `getByTestId` > CSS selector (from REQUIREMENTS.md AGNT-05, Phase 72 pattern)
- Test files placed in `e2e/` directory named `{feature-slug}.spec.ts` (from Phase 72 agent pattern)
- Each E2E-classified file maps to test scenarios from CONTEXT.md/VERIFICATION.md acceptance criteria, with Given/When/Then → test setup/action/assertion (from Phase 72 agent pattern)
- When Playwright is not configured and user declined scaffolding, E2E generation step is skipped entirely (Claude's Decision: cannot generate Playwright specs without Playwright installed)

### RED-GREEN Execution Pattern (WKFL-04)

- E2E tests execute via `npx playwright test --project=chromium` following the same RED-GREEN evaluation logic already in `execute_e2e_generation` (from REQUIREMENTS.md WKFL-04)
- GREEN (passes): record success
- RED (fails): categorize as test-level vs application-level using the same error pattern matching from `gsd-playwright` agent (ERR_CONNECTION_REFUSED = app-level, locator/expect = test-level) (from Phase 72 agent failure categorization)
- Test-level failures: fix the test and re-run (matching existing TDD step behavior)
- Application-level failures: flag as blocker, do not mark as complete (matching existing E2E step no-skip rule)

### Summary Table Integration (WKFL-05)

- E2E test results fold into the existing summary table in `summary_and_commit` step (from REQUIREMENTS.md WKFL-05)
- The existing table already has a `| E2E |` row — populate it with actual Playwright test counts (Generated, Passing, Failing, Blocked) (from current add-tests.md summary_and_commit step)
- When E2E tests were skipped (user declined scaffolding or no E2E-classified files), the E2E row shows zeros (Claude's Decision: consistent table shape regardless of whether E2E ran)

### TDD Path Regression Constraint (WKFL-06)

- The `execute_tdd_generation` step and all steps before it (`parse_arguments`, `init_context`, `analyze_implementation`, `present_classification`, `discover_test_structure`, `generate_test_plan`) remain completely unchanged (from REQUIREMENTS.md WKFL-06)
- Changes are confined to `execute_e2e_generation` and `summary_and_commit` only (Claude's Decision: minimal blast radius ensures zero TDD regression; only the E2E path and final summary are touched)
- The `discover_test_structure` step already discovers E2E test directories and runners — Playwright detection supplements but does not replace this discovery (Claude's Decision: discover_test_structure handles generic test structure; Playwright detection is E2E-framework-specific)

### Claude's Discretion
- Exact wording of the AskUserQuestion scaffolding prompt
- Whether to inline the full Playwright config template or reference the agent's template
- Formatting of Playwright-specific test output within the existing summary structure
- Order of Playwright detection relative to existing E2E duplicate-check within execute_e2e_generation

</decisions>

<specifics>
## Specific Ideas

- The `execute_e2e_generation` step in `get-shit-done/workflows/add-tests.md` (lines 240-269) is the sole modification target for E2E generation changes
- The `summary_and_commit` step (lines 272-333) already contains the `| E2E | {M} | {m1} | {m2} | {m3} |` row — this row gets populated with real Playwright results
- The `gsd-playwright` agent at `agents/gsd-playwright.md` defines the canonical spec generation pattern (Step 3) and failure categorization (Step 5) — the workflow should mirror these patterns inline rather than spawning the agent
- The `gsd-tools.cjs playwright-detect --raw` command returns `{"status":"configured","config_path":"playwright.config.ts"}` or `{"status":"not-detected","config_path":null}` — same JSON shape used by Phase 73 command
- The `commands/gsd/add-tests.md` command file needs no changes — it already delegates to the workflow file, and the workflow file is the only deliverable
- Test budget is at 796/800 (99.5%) but E2E specs in `e2e/` are excluded from budget via Phase 71's EXCLUDE_DIRS addition

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/add-tests.md`: the workflow file being modified — contains all step definitions for test classification, planning, generation, and summary
- `agents/gsd-playwright.md`: canonical reference for scaffolding steps (Step 2), spec generation patterns (Step 3), execution (Step 4), and failure categorization (Step 5)
- `testing.cjs` `detectPlaywright(cwd)`: Phase 71 detection function exposed via `gsd-tools.cjs playwright-detect`
- `testing.cjs` `parsePlaywrightOutput()`: Phase 71 output parsing for Playwright line reporter format

### Established Patterns
- `add-tests.md` uses `AskUserQuestion` for user gates (classification approval, test plan approval) — scaffolding prompt follows the same pattern
- `add-tests.md` `execute_e2e_generation` already has duplicate-check, file creation, test execution, and GREEN/RED/blocker evaluation — Playwright changes layer onto this existing structure
- `gsd-tools.cjs` dispatch provides deterministic data (detection status) via Bash calls — workflow uses this for decision gates
- Playwright error categorization patterns (ERR_CONNECTION_REFUSED = app-level, locator/expect = test-level) are defined in `agents/gsd-playwright.md` Step 5

### Integration Points
- `get-shit-done/workflows/add-tests.md` `execute_e2e_generation` step: primary modification target
- `get-shit-done/workflows/add-tests.md` `summary_and_commit` step: E2E results population
- `gsd-tools.cjs playwright-detect`: Phase 71 detection command called by the workflow
- `agents/gsd-playwright.md`: pattern reference for scaffolding, generation, and failure categorization (not spawned, patterns mirrored inline)

</code_context>

<deferred>
## Deferred Ideas

- Task() spawning of gsd-playwright agent from add-tests workflow — inline generation is simpler for this integration; full agent spawn is available via `/gsd:ui-test` command
- `--headed` flag support in add-tests E2E execution — add-tests is a test generation workflow, not a debug tool; headed mode is available via `/gsd:ui-test --headed`
- Automatic Playwright scaffolding without user prompt (auto-mode for autopilot) — add-tests is a human-interactive workflow with AskUserQuestion gates; auto-scaffolding would bypass user consent
- Help documentation updates (`help.md`, `USER-GUIDE.md`) for enhanced add-tests E2E behavior — deferred to milestone audit documentation pass
- Visual regression test generation (`toHaveScreenshot()` assertions) — deferred per REQUIREMENTS.md (VISREG-01, VISREG-02)
- Multi-browser execution in add-tests (`--project=firefox`) — deferred per REQUIREMENTS.md (MBROW-01)

</deferred>

---

*Phase: 74-add-tests-workflow-enhancement*
*Context gathered: 2026-03-20 via auto-context*
