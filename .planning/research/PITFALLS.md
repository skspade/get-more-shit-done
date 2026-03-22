# Domain Pitfalls

**Domain:** Automated UAT browser testing in autonomous pipeline (Chrome MCP + Playwright dual-engine)
**Researched:** 2026-03-22
**Confidence:** HIGH (design doc analysis, codebase pattern review, web-verified Chrome MCP behavior, Playwright best practices)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Chrome MCP Availability Detection Gives False Positives

**What goes wrong:** The design calls for `tabs_context_mcp` as the availability probe. Chrome MCP can appear "available" (the tool resolves) but the browser session is stale, on the wrong machine, or the extension has lost connection. The agent proceeds with Chrome MCP mode, then every subsequent `chrome_navigate` or `chrome_click_element` call silently fails or times out, wasting the entire test session before falling back.

**Why it happens:** Chrome MCP availability is not binary. The MCP bridge can be connected but the Chrome tab closed, Chrome can be running headless without the extension, or (per real-world reports) the extension can route to a different machine's Chrome instance when multiple machines have it installed. A single `tabs_context_mcp` probe does not exercise the full tool chain. GitHub issue #27492 documents the MCP client failing to establish connections to bridge-type MCP servers even when Chrome is running.

**Consequences:** Entire UAT session burns 10+ minutes of context window on Chrome MCP calls that silently fail. The fallback to Playwright never triggers because the initial probe passed. The autopilot stall detector may eventually catch this, but by then the context window is wasted.

**Prevention:**
1. Probe must be a full round-trip: call `tabs_context_mcp`, then `tabs_create_mcp` to open a new tab, then `chrome_navigate` to the actual `base_url`, and verify a non-error response. Only then confirm Chrome MCP is working.
2. Implement per-test engine fallback, not just per-session. If any Chrome MCP call returns an error or times out mid-session, switch to Playwright for remaining tests rather than failing the whole session.
3. Set a hard timeout (5 seconds as designed) but on the full probe sequence, not just `tabs_context_mcp`.

**Detection:** First sign is Chrome MCP tests all failing with timeout or connection errors while the probe reported success.

**Phase:** Must be addressed in the Chrome MCP engine implementation phase. The probe logic is the first thing to get right.

**Confidence:** HIGH -- multiple sources confirm Chrome MCP connection instability ([GitHub issue #27492](https://github.com/anthropics/claude-code/issues/27492), [wrong-machine routing report](https://mikestephenson.me/2026/03/13/claude-cowork-browser-automation-wrong-machine/)).

### Pitfall 2: AI-Driven Pass/Fail Judgment is Non-Deterministic

**What goes wrong:** The design has Claude judge pass/fail by comparing screenshots + DOM content against natural language expected behavior descriptions. This judgment is inherently non-deterministic -- the same screenshot and expected text can produce different pass/fail verdicts across runs, across context windows, or based on surrounding context in the conversation. A test that "passes" on Tuesday "fails" on Wednesday with identical application state.

**Why it happens:** LLM inference is stochastic. The expected behavior descriptions in UAT.md are natural language ("Comment appears immediately after submission") which have ambiguous thresholds. "Immediately" could mean visible in the screenshot or present in the DOM. A loading spinner might be interpreted as "not yet appeared" or "in progress, will appear." The model's confidence varies with context length and prior conversation content.

**Consequences:** UAT results are not reproducible. Failed tests trigger gap closure phases that "fix" things that are not broken. Passed tests miss regressions that a stricter check would catch. The autopilot enters fix-reaudit-re-UAT loops chasing phantom failures, burning context windows and potentially making unnecessary code changes.

**Prevention:**
1. Require the agent to output a structured confidence score (1-5) alongside each pass/fail verdict. Only count tests with confidence < 3 as "needs human review" rather than hard failures.
2. Implement a confirmation re-test for failures: if a test fails, re-run it once before recording the failure. Two consecutive failures = confirmed failure. Single failure = flaky, log but do not create gaps.
3. Use DOM content assertions (text presence, element existence) as the primary signal, with screenshot judgment as supplementary evidence. DOM checks are deterministic; screenshots are not.
4. Write expected behaviors in UAT.md with concrete observable criteria ("page contains text 'Comment posted successfully'") not vague descriptions ("comment appears").
5. Include explicit failure criteria in the workflow prompt: "A test fails if: the expected element is not visible, an error message appears, the page shows a loading spinner after the wait period, or the observed behavior contradicts the expected behavior description. When in doubt, fail the test."

**Detection:** UAT results flip between runs with no code changes. Gap closure phases produce "fixes" that do not change application behavior.

**Phase:** Must be addressed in the UAT-Auto workflow design phase. The judgment protocol is the core of the testing logic.

**Confidence:** HIGH -- this is an inherent property of LLM-based judgment, well-documented in AI testing literature.

### Pitfall 3: App Startup Race Condition

**What goes wrong:** The design runs `startup_command` (e.g., `npm run dev`) and waits `startup_wait_seconds` (default 10) before testing. But dev servers have wildly variable startup times depending on cold cache, dependency installation, compilation, and port availability. The wait is either too short (app not ready, all tests fail with connection refused) or too long (wasting 30+ seconds every run).

**Why it happens:** Fixed wait times are a known anti-pattern in browser testing. Playwright's own docs state: "Never wait for timeout in production. Tests that wait for time are inherently flaky." Dev servers (Next.js, Vite, webpack-dev-server) have non-linear startup: fast on warm cache, slow on cold start. Port conflicts can cause the startup command to fail silently (exits with error but the agent already moved on). The agent cannot distinguish "server starting" from "server failed to start."

**Consequences:** If too short: every test fails with connection refused, creating false gap closure cycles. The failure categorization (app-level vs test-level from v2.7) should catch this, but only if the error messages are recognized. If too long: wasted time in every UAT session, compounding across milestones.

**Prevention:**
1. Replace fixed wait with HTTP polling: after starting the dev server, poll `base_url` every 2 seconds with a hard timeout of 60 seconds. Only proceed when HTTP 200 (or any non-error response) is received.
2. Capture the startup command's stderr/stdout. If it exits before the wait completes, check the exit code. Non-zero = startup failed, skip UAT with a clear error.
3. Check if `base_url` is already responding BEFORE starting the startup command. If it is, skip startup entirely (user may have the app running).
4. If using Playwright, leverage its built-in `webServer` config block which handles startup, port detection, and readiness checking natively. (Note: scaffolding templates currently omit `webServer` block -- known v2.7 tech debt.)
5. Register a `process.on('exit')` handler in autopilot.mjs that kills the dev server PID. Also register `SIGINT` and `SIGTERM` handlers to prevent orphan processes.

**Detection:** All tests fail with "connection refused" or "navigation timeout." Startup command in process but server not yet listening.

**Phase:** Must be addressed in the autopilot integration phase (where `runAutomatedUAT()` is implemented). The startup management is autopilot's responsibility, not the workflow's.

**Confidence:** HIGH -- universally known issue in browser testing. [Playwright docs](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/) and [BrowserStack](https://www.browserstack.com/guide/playwright-flaky-tests) explicitly warn against fixed waits.

### Pitfall 4: Gap Format Incompatibility Breaks Closure Loop

**What goes wrong:** The design introduces `MILESTONE-UAT.md` with a YAML gap format that must be consumed by `plan-milestone-gaps`. If the gap format from UAT differs even slightly from what the gap planner expects (different field names, different severity values, missing required fields), the gap closure loop silently produces empty or malformed fix phases.

**Why it happens:** The existing gap format is defined by `MILESTONE-AUDIT.md` and the audit workflow. The UAT gap format in the design uses fields like `truth`, `evidence`, `observed` that may not exist in the audit gap schema. The gap planner may not know how to parse UAT-specific fields. YAML parsing in the codebase already has a known tech debt issue (`extractFrontmatter` does not parse nested YAML array-of-objects).

**Consequences:** UAT failures are detected but never fixed. The gap closure loop creates phases but the plans are empty or nonsensical because the planner could not parse the gap descriptions. The autopilot loops through audit-UAT-gap closure without making progress, eventually hitting the circuit breaker.

**Prevention:**
1. Use the exact same gap schema as `MILESTONE-AUDIT.md`. Map UAT failures to the existing schema rather than inventing a new one. The `truth`/`status`/`reason`/`severity` fields should match what `plan-milestone-gaps` already parses.
2. Write an integration test that feeds a sample `MILESTONE-UAT.md` through the gap planning workflow and verifies it produces valid fix phases.
3. Keep the gap format as simple YAML that `extractFrontmatter` can actually parse -- avoid nested array-of-objects given the known parsing limitation.
4. The `evidence` and `observed` fields are additive metadata; they should not be required fields for gap planning.

**Detection:** Gap closure phases have empty or generic plans. The planner's output does not reference specific UAT test failures.

**Phase:** Must be addressed in the evidence and reporting phase. Gap format must be validated against existing consumers before implementation.

**Confidence:** HIGH -- the `extractFrontmatter` limitation is documented tech debt, and the gap format is the integration contract between UAT and the existing closure loop.

### Pitfall 5: Subagent Cannot Spawn Subagent

**What goes wrong:** The workflow tries to spawn a nested subagent (e.g., a Playwright-specific agent from within the UAT agent).

**Why it happens:** GSD has a hard constraint documented in PROJECT.md: "Subagents cannot spawn subagents -- the orchestrator must be the top-level spawner." The `/gsd:uat-auto` workflow is spawned by autopilot as a subagent. Any `Task()` calls inside it would create subagent-spawning-subagent, which silently fails.

**Consequences:** Task() calls silently fail or error out, breaking the entire UAT session.

**Prevention:** The `/gsd:uat-auto` workflow must handle BOTH Chrome MCP and Playwright paths in a single agent session. Do not try to spawn separate agents for each browser mode. The workflow detects the browser mode and branches internally. All browser interaction happens through tool calls (Chrome MCP tools or Bash for Playwright scripts), not through additional agent spawning.

**Detection:** Agent errors about Task() or subagent spawning.

**Phase:** Must be addressed in the UAT-Auto workflow architecture phase. This is a fundamental constraint that shapes the entire implementation.

**Confidence:** HIGH -- documented codebase constraint, well-established pattern.

## Moderate Pitfalls

### Pitfall 6: Screenshot Evidence Bloats Git Repository

**What goes wrong:** The design commits PNG screenshots to git for every UAT test, every milestone. Over 10 milestones with 12 tests each, that is 120+ PNGs accumulating in git history. PNGs are binary; git stores them as full copies on every change. Repository clone time and size grow linearly. Per industry reports, thirty screenshots updated weekly can result in 156MB of history per year.

**Why it happens:** The design explicitly states "Evidence PNGs are committed to git" and "Old evidence is cleaned up during milestone archival." But git history is permanent -- archival removes files from the working tree but not from pack files.

**Prevention:**
1. Add `.planning/uat-evidence/` to `.gitignore` and store evidence as ephemeral artifacts. Only commit the `MILESTONE-UAT.md` results file, not the screenshots. If evidence is needed for debugging, it is available in the local filesystem until archival.
2. If screenshots must be committed, enforce max dimensions (1280x720), use JPEG at 80% quality instead of PNG (evidence, not pixel-perfect baselines), and consider git LFS.
3. At minimum, clean up evidence PNGs from git history (not just working tree) during milestone archival.

**Phase:** Should be addressed in the evidence and reporting phase.

**Confidence:** MEDIUM -- the design handles archival cleanup, but [git history bloat](https://dev.to/omachala/your-screenshot-automation-is-bloating-your-git-repo-3lgc) is a known long-term issue with binary files.

### Pitfall 7: Playwright Fallback Produces Different Results Than Chrome MCP

**What goes wrong:** The dual-engine approach means the same test suite can produce different results depending on which engine runs. Chrome MCP uses a real headed Chrome with extensions and user-agent; Playwright uses headless Chromium with a different user-agent and no extensions. Applications that detect headless mode, bot user-agents, or depend on Chrome extensions will behave differently.

**Why it happens:** Chrome MCP operates on the user's actual Chrome browser with full state (cookies, extensions, logged-in sessions). Playwright creates an isolated browser context with no state. The design says "Output format: Identical to Chrome MCP mode" but the browser behavior is not identical.

**Prevention:**
1. Document that UAT tests must not depend on pre-existing browser state (cookies, login sessions). If authentication is required, the UAT test must include login steps.
2. Set Playwright's user-agent to match Chrome's to avoid bot detection differences.
3. Record which engine was used in `MILESTONE-UAT.md` (the design already does this) and do not compare results across engines. A test that passes in Chrome MCP and fails in Playwright is an engine difference, not a regression.

**Phase:** Should be addressed in both engine implementation phases with a shared test contract.

**Confidence:** MEDIUM -- known issue in dual-browser testing strategies.

### Pitfall 8: Timeout Management Across Nested Loops

**What goes wrong:** The design adds a new step (`runAutomatedUAT()`) between audit and completion in a pipeline that already has nested timeout management: stall detection in `runClaudeStreaming()` (5 min default), debug retry limits, gap closure iteration limits (configurable max), and the progress circuit breaker. The UAT session has its own 10-minute timeout. If UAT triggers gap closure, which triggers re-audit, which triggers re-UAT, the total wall-clock time can exceed any reasonable expectation.

**Why it happens:** Each layer manages its own timeout independently. There is no top-level wall-clock budget for the entire audit-UAT-gap-reaudit cycle.

**Prevention:**
1. Add a top-level wall-clock timeout for the post-audit phase (audit + UAT + gap closure combined). Default 30 minutes. If exceeded, halt and escalate.
2. Limit UAT-triggered gap closure to 1 iteration. If UAT fails after gap closure, escalate to human rather than looping again. Reasoning: if the first fix did not resolve the UAT failure, subsequent automated attempts are unlikely to succeed.
3. Make the UAT timeout configurable in `uat-config.yaml` and scale it by test count (10 minutes for 5 tests is fine; 10 minutes for 30 tests is not).

**Phase:** Should be addressed in the autopilot integration phase where `runAutomatedUAT()` is wired into the main flow.

**Confidence:** HIGH -- the existing pipeline already has multiple timeout layers; adding another without coordination is a known integration risk.

### Pitfall 9: UAT Test Discovery Produces Zero Tests or Fabricated Tests

**What goes wrong:** If no phases in the current milestone produced UAT.md files (infrastructure-only milestone), the fallback is to "generate test scenarios from SUMMARY.md files." This fallback produces AI-generated tests that may have no relationship to actual user-facing behavior.

**Why it happens:** Not every milestone has web UI changes. The UAT.md files are produced by `verify-work` which only runs when there is something to verify manually.

**Prevention:**
1. When zero UAT.md files are found AND no SUMMARY.md files describe UI changes, skip UAT entirely with a clear "No UAT-testable changes in this milestone" message. Do not fabricate tests.
2. The `uat-config.yaml` presence is already the opt-in gate. Reinforce: no config = no UAT, no exceptions.
3. Follow the precedent from v2.7 where the `gsd-playwright` agent returns BLOCKED status when acceptance tests are missing. Same pattern: no testable content = BLOCKED, not "generate something."

**Phase:** Should be addressed in the test discovery phase.

**Confidence:** HIGH -- the BLOCKED pattern from v2.7 is an established codebase precedent.

### Pitfall 10: Context Window Exhaustion During Multi-Test Sessions

**What goes wrong:** The Chrome MCP agent processes all UAT tests sequentially in a single Claude session. Each test involves navigation, interaction, screenshot capture (which consumes tokens as image data), DOM content extraction, and judgment. With 12+ tests, the context window fills. Claude's Chrome documentation itself warns about increased context consumption with browser tools enabled.

**Why it happens:** Screenshots are multimodal input that consume significant tokens. DOM content can be large (especially for SPAs). The design runs all tests in one session with no batching.

**Prevention:**
1. Batch tests: run no more than 5 tests per Claude session. Between batches, spawn a new session with results-so-far and remaining tests.
2. Minimize DOM capture: extract only relevant DOM elements rather than full `chrome_get_web_content`.
3. Do not accumulate screenshots in conversation history -- take the screenshot, judge it, record the result, move on. Evidence is saved to disk; it does not need to persist in context.
4. Set a test count limit in `uat-config.yaml` (default: 20 tests max per session).

**Phase:** Should be addressed in the UAT-Auto workflow implementation phase.

**Confidence:** MEDIUM -- depends on actual token consumption per test, which varies by application complexity. [Claude Chrome docs](https://code.claude.com/docs/en/chrome) confirm increased context usage.

### Pitfall 11: Playwright Fallback Chromium Not Installed

**What goes wrong:** Playwright is in devDependencies (`@playwright/test` installed) but Chromium browser binary is not downloaded (`npx playwright install chromium` never ran). The existing `detectPlaywright()` returns `installed` if the package exists, but that does not guarantee the binary.

**Prevention:** The Playwright fallback path must check for the browser binary, not just the npm package. Add `npx playwright install chromium` as part of the fallback initialization path. This is an existing gap in the three-tier detection from v2.7.

**Detection:** Playwright scripts fail with "browser not found" errors.

**Phase:** Playwright fallback engine phase.

**Confidence:** HIGH -- known limitation of `detectPlaywright()`.

## Minor Pitfalls

### Pitfall 12: Port Conflicts When Starting Dev Server

**What goes wrong:** The startup command binds to a port already in use (from a previous failed UAT run or another dev server). The startup command fails or binds to an alternate port, but UAT tests navigate to the original `base_url` port.

**Prevention:** Before running the startup command, check if `base_url` port is already responding. If so, either use the existing server or warn. After startup, verify the server is on the expected port by hitting `base_url` directly.

**Phase:** Autopilot integration phase.

### Pitfall 13: Chrome MCP ~5s Per Call Latency Compounds

**What goes wrong:** Each Chrome MCP tool call has approximately 5 seconds of MCP protocol overhead. A single test with 5 tool calls = 25 seconds. Twelve tests = 5 minutes just in MCP overhead, before any actual page load or interaction time.

**Prevention:** Factor MCP latency into timeout calculations. A 10-minute UAT timeout with 12 tests allows only ~50 seconds of actual testing per test after MCP overhead. Increase default timeout or reduce test count expectations. Playwright fallback does not have this overhead and is significantly faster.

**Phase:** Chrome MCP engine implementation phase.

**Confidence:** MEDIUM -- [5s per call is reported](https://www.hanifcarroll.com/blog/browser-automation-tools-comparison-2026/) but may vary by setup.

### Pitfall 14: YAML Config Type Coercion

**What goes wrong:** `startup_wait_seconds: 10` parsed as string "10" instead of number 10 by hand-rolled parser.

**Prevention:** Use js-yaml for parsing (handles types correctly). If using `extractFrontmatter`, must explicitly parseInt/parseFloat.

**Phase:** Config parsing phase.

### Pitfall 15: Base URL Trailing Slash Inconsistency

**What goes wrong:** Config has `base_url: "http://localhost:3000"` but test descriptions reference "/dashboard". URL concatenation produces double slashes or missing slashes.

**Prevention:** Normalize base_url by stripping trailing slash in the config loader. Use `new URL(path, base)` for path resolution.

**Phase:** Config parsing phase.

### Pitfall 16: Evidence Path Convention Mismatch

**What goes wrong:** The design specifies `{phase}-test-{N}.png` naming but phase identifiers in the codebase use mixed conventions (e.g., `04-comments` vs `04` vs `phase-04`). Known v2.7 tech debt: path convention mismatch.

**Prevention:** Use a consistent, simple naming scheme: `test-{sequential-number}.png`. Do not encode phase information in the filename -- that is already captured in the results table. After writing evidence, verify the file exists at the recorded path.

**Phase:** Evidence and reporting phase.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Chrome MCP engine | Detection false positive (#1), 5s/call latency (#13) | Full round-trip probe, latency-aware timeouts |
| Playwright fallback engine | Result divergence (#7), Chromium not installed (#11), missing `webServer` block (v2.7 debt) | Shared test contract, binary check, Playwright native startup |
| UAT-Auto workflow | Non-deterministic judgment (#2), context exhaustion (#10), zero-test discovery (#9), subagent constraint (#5) | Confidence scoring, test batching, BLOCKED status, single-agent design |
| Autopilot integration | App startup race (#3), timeout cascade (#8), port conflicts (#12), orphan processes | HTTP polling, top-level timeout budget, port check, exit handlers |
| Evidence and reporting | Gap format incompatibility (#4), git bloat (#6), path mismatches (#16) | Reuse audit gap schema, gitignore evidence, simple naming |
| Config parsing | Type coercion (#14), URL normalization (#15) | Use js-yaml, use URL constructor |
| Test phase (unit/integration) | Testing non-deterministic AI output | Test the protocol (structured output, retry logic), not the judgment content |

## Existing Tech Debt Interactions

These known tech debt items from the codebase directly interact with UAT implementation:

| Tech Debt Item | UAT Interaction | Risk |
|----------------|-----------------|------|
| `extractFrontmatter` cannot parse nested YAML array-of-objects | MILESTONE-UAT.md gaps section uses YAML arrays | Gap parsing may fail silently |
| `playwright-detect --raw` returns string not JSON | Fallback detection logic may mis-parse result | False negative on Playwright availability |
| Scaffolding templates omit `webServer` block | Playwright fallback needs startup management | Must implement startup separately or fix scaffolding |
| Test budget at 103.25% (826/800) | New UAT infrastructure tests add to count if not excluded | Must add exclusion pattern like existing e2e/ exclusion |
| v2.7 path convention mismatch | Evidence file paths must be consistent | Use simple sequential naming |

## Sources

- [Chrome MCP bug: cowork MCP connection issues](https://github.com/anthropics/claude-code/issues/27492) -- Chrome MCP connection instability
- [Browser automation tool comparison](https://www.hanifcarroll.com/blog/browser-automation-tools-comparison-2026/) -- ~5s per call MCP overhead, form interaction reliability
- [Wrong-machine browser automation](https://mikestephenson.me/2026/03/13/claude-cowork-browser-automation-wrong-machine/) -- Chrome extension routing to wrong machine
- [Claude Chrome docs](https://code.claude.com/docs/en/chrome) -- increased context consumption with browser tools
- [Avoiding flaky Playwright tests](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/) -- timing, selectors, hard waits
- [Playwright flaky tests guide](https://www.browserstack.com/guide/playwright-flaky-tests) -- race conditions, timeout configuration
- [17 Playwright testing mistakes](https://elaichenkov.github.io/posts/17-playwright-testing-mistakes-you-should-avoid/) -- common Playwright anti-patterns
- [Screenshot git repo bloat](https://dev.to/omachala/your-screenshot-automation-is-bloating-your-git-repo-3lgc) -- binary file accumulation in git history
- [Git LFS for screenshots](https://www.techedubyte.com/stop-git-repo-bloat-automate-screenshots-git-lfs/) -- LFS solution for screenshot management
- GSD codebase: `.planning/RETROSPECTIVE.md` v2.7 section -- known Playwright tech debt, failure categorization pattern
- GSD codebase: `.planning/PROJECT.md` -- known tech debt (extractFrontmatter, playwright-detect, scaffolding webServer)
- GSD codebase: `autopilot.mjs` -- existing timeout layers (stall detection, debug retry, gap closure iterations)
