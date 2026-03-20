# Project Research Summary

**Project:** GSD v2.7 — Playwright UI Testing Integration
**Domain:** E2E test scaffolding, generation, and execution integration into an existing autonomous coding CLI
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

GSD v2.7 adds on-demand Playwright E2E testing to an existing Node.js CLI tool with an established Command/Workflow/Agent architecture. The core insight from all four research streams is that this is an additive integration, not a rewrite — three new or modified files (one command, one agent, one workflow modification) plus two small module additions in `testing.cjs` and `gsd-tools.cjs`. The single new dependency is `@playwright/test ^1.50.0`, added as a devDependency to GSD itself for testing detection logic, while user projects install it as part of the scaffold flow. The recommended approach is to follow existing architectural patterns exactly: `ui-test.md` command as a thin orchestrator, `gsd-playwright.md` as a leaf-node agent (following `gsd-test-steward` precedent), and a surgical modification to the `execute_e2e_generation` step in `add-tests.md`.

The key differentiator of this integration is phase-aware test generation: GSD's existing CONTEXT.md acceptance criteria (Given/When/Then format) map directly to Playwright test blocks, producing higher-quality generated specs than raw codegen or record-and-replay tools. Detection follows a three-tier model (fully configured / installed without config / absent), and scaffolding defaults to Chromium-only, `reporter: 'line'` for stdout parsing, and a `webServer` block to support GSD's on-demand invocation model. The `gsd-playwright` agent handles the full lifecycle — detect, scaffold, generate, execute, report — and returns a structured `## PLAYWRIGHT COMPLETE` block.

The critical risk is the existing test budget at 796/800 (99.5%): Playwright `.spec.ts` files use the same `test()` syntax counted by the budget counter, and even a single spec would push it over the limit. The fix is mandatory before any spec generation: add `e2e/` to `EXCLUDE_DIRS` in `testing.cjs` and place all Playwright specs in `e2e/`. Secondary risks are the `baseURL`/`webServer` config gap (tests only work when dev server is running) and the hard test gate accidentally running Playwright specs as unit tests. Both are prevented by Phase 1 infrastructure changes.

## Key Findings

### Recommended Stack

The entire stack addition for v2.7 is a single package: `@playwright/test ^1.50.0`. GSD does not need Playwright as a production dependency; it only needs to detect, scaffold, and invoke it in user projects. The devDependency addition allows GSD's own test suite to test the detection and output parsing logic without live installs. All other GSD infrastructure (Node.js CJS modules, zx/ESM, node:test suite, gsd-tools dispatcher, testing.cjs) is unchanged.

The generated `playwright.config.ts` template uses `reporter: 'line'` for stdout parsing (enabling GSD's output parsing layer), Chromium-only projects (3x faster than all-browser), and a `webServer` block (enabling on-demand invocation without requiring a pre-running server). Output parsing uses regex for "N passed / N failed" patterns from the line reporter's summary line.

See `.planning/research/STACK.md` for full stack details.

**Core technologies:**
- `@playwright/test ^1.50.0`: E2E test framework installed in user projects — the only Playwright package needed; bundles runner, assertion library, browser download CLI
- `node:test` (built-in): Unchanged — GSD's own test suite; new tests for detection/parsing logic follow existing patterns in `testing.cjs`
- `reporter: 'line'`: Playwright's stdout-focused reporter — enables output parsing by `parsePlaywrightOutput()` without file I/O complexity

### Expected Features

The integration has a clear MVP boundary. All P1 items are required for v2.7 launch; P2 items are polish that fold naturally into the same implementation; P3 items are deferred.

See `.planning/research/FEATURES.md` for the full feature analysis with priority matrix and dependency graph.

**Must have (table stakes):**
- Playwright detection (three-tier) — users expect the tool to find existing setup before scaffolding over it
- Playwright scaffolding (install + config + directory + example test) — zero-to-running in one command
- Test execution with pass/fail summary — the core functionality
- `/gsd:ui-test` command with argument parsing — user entry point
- `gsd-playwright` agent with full lifecycle — core reusable agent
- `add-tests` E2E path enhancement — inline detection and agent delegation
- Phase-aware test generation from CONTEXT.md acceptance criteria — the primary differentiator

**Should have (competitive):**
- Failure categorization (test issue vs app bug) — locator-not-found vs timeout heuristic
- Trace file path surfacing on failure — low effort, high value for new users
- Screenshot path reporting (`screenshot: 'only-on-failure'` in scaffolded config)
- Acceptance test Verify field auto-population in CONTEXT.md after spec generation

**Defer (v2.8+):**
- Visual regression baseline workflow — requires running app and baseline approval process
- Multi-browser matrix (Firefox/WebKit) — Chromium covers 95% of use cases
- Authentication flow templates — storageState setup is too project-specific to automate

### Architecture Approach

The integration follows GSD's established three-tier Command/Workflow/Agent architecture without exceptions. The `/gsd:ui-test` command is a thin orchestrator (matching `audit-tests.md` pattern — no intermediate workflow file needed). The `gsd-playwright` agent is a leaf node with full tool access (Read, Write, Edit, Bash, Glob, Grep) and returns a structured `## PLAYWRIGHT COMPLETE` block. The `add-tests.md` workflow receives a surgical modification at `execute_e2e_generation` only — all other steps including the TDD path are untouched. No new `.planning/` state files are needed since phase context already lives in `${phase_dir}/CONTEXT.md`.

See `.planning/research/ARCHITECTURE.md` for full component responsibility table, data flow diagrams, and anti-pattern list.

**Major components:**
1. `commands/gsd/ui-test.md` (NEW) — parse args, call `gsd-tools init`, spawn `gsd-playwright` agent
2. `agents/gsd-playwright.md` (NEW) — detect/scaffold/generate/execute/report; returns structured `## PLAYWRIGHT COMPLETE` block
3. `workflows/add-tests.md` (MODIFIED) — add Playwright detection gate and agent delegation to `execute_e2e_generation` step only; TDD path untouched
4. `bin/lib/testing.cjs` (MODIFIED) — add `detectPlaywright()` and `'playwright'` case in `parseTestOutput()`
5. `bin/gsd-tools.cjs` (MODIFIED) — add `playwright-detect` dispatch case following `test-detect-framework` pattern

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all seven critical pitfalls with full prevention strategies and phase-to-prevention mapping.

1. **Test budget exceeded by Playwright spec counting** — `testing.cjs` counts `test()` calls in all `.spec.ts` files including Playwright specs; budget is at 796/800. Prevention: add `'e2e'` to `EXCLUDE_DIRS` in Phase 1 before any spec is generated; all Playwright specs must live in `e2e/`.

2. **Partial-install false negative in detection** — `@playwright/test` in package.json but no browser binaries causes "browser not found" failure, not a clear error. Prevention: implement four-state detection (not-installed / installed-no-config / configured-no-binaries / fully-ready) with distinct error messages for each state.

3. **baseURL / webServer absent in scaffolded config** — tests only work when dev server is already running; on-demand invocations fail with `ERR_CONNECTION_REFUSED`. Prevention: always scaffold with `webServer` block; detect dev server command from `package.json` scripts; never scaffold without it.

4. **Hard test gate runs Playwright specs as unit tests** — `.spec.ts` files discovered by `findTestFiles()` are executed with `node --test`; Playwright's ES module imports cause syntax errors. Prevention: `e2e/` in `EXCLUDE_DIRS` (same fix as pitfall 1); verify hard gate exits 0 after adding specs.

5. **Scaffolding runs in wrong project (GSD instead of user's web app)** — `cwd` during GSD development is the GSD repo, which has no UI. Prevention: agent must verify web app markers before scaffolding (framework config files, `start`/`dev` scripts); abort with clear error if absent.

## Implications for Roadmap

All research converges on the same build order: infrastructure first, agent second, command third, workflow modification last. This order minimizes risk because each step can be independently verified before the next introduces complexity.

### Phase 1: Test Infrastructure and Detection Foundation

**Rationale:** Three of the seven critical pitfalls (budget explosion, hard gate failure, wrong-project scaffolding) must be prevented before any test generation occurs. These are pure infrastructure changes with no behavioral risk. The `playwright-detect` gsd-tools command is a dependency of both the new command and the modified workflow, so it must exist first.

**Delivers:** `detectPlaywright()` in `testing.cjs` (four-state detection), `playwright-detect` dispatch in `gsd-tools.cjs`, `'playwright'` case in `parseTestOutput()`, `'e2e'` added to `EXCLUDE_DIRS`, `@playwright/test` as devDependency in GSD's own package.json for test suite use.

**Addresses:** Playwright detection (table stakes), output parsing (table stakes), test budget safety (critical infrastructure guard).

**Avoids:** Test budget exceeded (Pitfall 1), hard gate failure from Playwright specs (Pitfall 6), output parsing returning zeros (Integration Gotcha).

### Phase 2: gsd-playwright Agent

**Rationale:** The agent is the core of the integration and a leaf node with no dependencies on the command or workflow. Building it second allows independent verification via direct `Task()` invocation before either entry point wraps it.

**Delivers:** Full `gsd-playwright.md` agent with five-step lifecycle (detect, scaffold, generate, execute, report), `playwright.config.ts` template with Chromium-only + `webServer` block, `e2e/` directory and example spec scaffolding, phase-aware test generation from CONTEXT.md acceptance criteria, structured `## PLAYWRIGHT COMPLETE` return block.

**Uses:** `@playwright/test`, `detectPlaywright()` from Phase 1, `parsePlaywrightOutput()` from Phase 1.

**Implements:** Agent Structured Return pattern, Three-Tier Detection pattern, phase-aware generation from CONTEXT.md.

**Avoids:** Partial-install false negative (Pitfall 2), baseURL/webServer gap (Pitfall 5), wrong-project scaffolding (Pitfall 4), brittle CSS locators (Pitfall 3 — locator priority hierarchy `getByRole > getByLabel > getByText > getByTestId > CSS` as hard rule in agent prompt).

### Phase 3: /gsd:ui-test Command

**Rationale:** The command is a thin wrapper around the agent (matches `audit-tests.md` pattern exactly). Build it third so the agent is proven before adding the command layer. This is the lowest-risk phase since it contains essentially no logic.

**Delivers:** `commands/gsd/ui-test.md` with argument parsing (phase, URL, `--scaffold`, `--run-only`, `--headed`), `gsd-tools init phase-op` call, GSD banner display, `Task(gsd-playwright)` spawn, and structured result presentation.

**Addresses:** `/gsd:ui-test` command (P1 MVP), `--headed` flag (P2), phase-aware invocation (P1).

**Avoids:** No new pitfall risks introduced; the command is purely structural with no own logic.

### Phase 4: add-tests Workflow Enhancement

**Rationale:** This modifies existing behavior in a widely-used workflow — do it last so all three dependencies (detection, agent, command) are proven. The TDD path must remain unchanged; change is surgical and limited to `execute_e2e_generation` only.

**Delivers:** Modified `add-tests.md` with Playwright detection gate at start of `execute_e2e_generation`, scaffolding prompt when Playwright absent, `Task(gsd-playwright)` delegation for E2E files, RED-GREEN execution pattern, structured result folded into existing coverage report table. All other workflow steps including TDD path completely unchanged.

**Addresses:** `add-tests` E2E path enhancement (P1 MVP), RED-GREEN execution (P1), TDD path preservation (non-negotiable regression constraint).

**Avoids:** TDD path regression (Integration Gotcha), workflow aborting entirely when E2E is blocked (TDD must complete even if Playwright is absent).

### Phase Ordering Rationale

- Infrastructure changes first because budget/gate pitfalls are catastrophic if hit mid-implementation and require code fixes to recover
- Agent before command because agents are leaf nodes tested independently; the command wrapper proves nothing until the agent works
- Command before workflow modification because `/gsd:ui-test` is a simpler entry point to validate agent behavior than modifying an existing multi-step workflow
- Workflow modification last because it has regression risk and depends on all three prior phases being independently verified

### Research Flags

Phases with well-documented patterns where pre-phase research is not needed:
- **Phase 1 (infrastructure):** Pure additive code following exact existing patterns in `testing.cjs` and `gsd-tools.cjs` — HIGH confidence, direct codebase precedents available
- **Phase 3 (ui-test command):** Mirrors `audit-tests.md` exactly — copy-adapt, no new patterns introduced

Phases that may benefit from targeted pre-phase review:
- **Phase 2 (gsd-playwright agent):** The `webServer` detection logic (inferring dev command from `package.json` scripts for Next/Vite/Angular/CRA) needs verification against actual script naming conventions across major frameworks; also, the four-state binary detection path varies by OS (`~/.cache/ms-playwright/` on macOS/Linux vs `%LOCALAPPDATA%\ms-playwright\` on Windows) — prefer `npx playwright --version` as cross-platform check
- **Phase 4 (add-tests modification):** The exact insertion point in `add-tests.md` requires reading the current step structure carefully before writing the modification; recommend re-reading the workflow at phase start to avoid inadvertent TDD path changes

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `@playwright/test` is the only option; version and config template verified against official docs; line reporter format confirmed via official docs and community |
| Features | HIGH | Official Playwright docs plus design doc coverage; MVP boundary is clear; anti-features well-justified with specific failure modes |
| Architecture | HIGH | Based entirely on direct codebase inspection; all integration points verified against actual source files; no speculation |
| Pitfalls | HIGH (infrastructure) / MEDIUM (Playwright-specific) | Budget/gate/detection pitfalls verified via codebase analysis; Playwright binary detection and output parsing format from official docs and community sources |

**Overall confidence:** HIGH

### Gaps to Address

- **Line reporter output format stability:** The `parsePlaywrightOutput()` regex assumes "N passed / N failed" format from the line reporter. This is consistent across community examples and official docs but not guaranteed stable across Playwright minor versions. Mitigation: implement JSON reporter fallback (`--reporter=json` with `PLAYWRIGHT_JSON_OUTPUT_NAME=/dev/stdout`) if line parsing proves fragile in Phase 2 testing.

- **`webServer` dev command detection coverage:** The scaffold logic must detect `npm run dev`, `npm run start`, `npm run serve`, and framework-specific variants. Research did not exhaustively verify all common script names across major frameworks (Next.js, Vite, Angular, CRA, Remix, SvelteKit). Mitigation: implement detection with a fallback to "ask user" rather than hardcoding — do not scaffold without a resolved dev command.

- **Binary cache path cross-platform:** `~/.cache/ms-playwright/` is the Linux/macOS path; Windows uses `%LOCALAPPDATA%\ms-playwright\`. The four-state detection logic in Phase 2 must handle both. Using `npx playwright --version` as the CLI check is more portable than filesystem inspection.

## Sources

### Primary (HIGH confidence — official docs and direct codebase inspection)

- `get-shit-done/bin/lib/testing.cjs` — EXCLUDE_DIRS, findTestFiles, countTestsInFile, detectFramework, parseTestOutput patterns
- `get-shit-done/bin/gsd-tools.cjs` — test-detect-framework dispatch pattern (direct precedent for playwright-detect)
- `commands/gsd/audit-tests.md` — command-as-direct-agent-spawn pattern (precedent for ui-test command)
- `workflows/add-tests.md` — target for modification; execute_e2e_generation step structure
- `agents/gsd-test-steward.md` — agent structure and structured return block pattern
- `.planning/PROJECT.md` — v2.7 requirements, test budget at 796/800
- `.planning/designs/2026-03-19-playwright-ui-testing-integration-design.md` — design specification
- [Playwright Installation Docs](https://playwright.dev/docs/intro) — Node.js >=20.x requirement, `npm init playwright@latest` behavior
- [Playwright Configuration Docs](https://playwright.dev/docs/test-configuration) — defineConfig options, testDir, workers, retries
- [Playwright Reporters Docs](https://playwright.dev/docs/test-reporters) — line reporter behavior, JSON reporter with PLAYWRIGHT_JSON_OUTPUT_NAME
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) — locator priority hierarchy
- [Playwright webServer Docs](https://playwright.dev/docs/test-webserver) — webServer config pattern, reuseExistingServer

### Secondary (MEDIUM confidence — community sources)

- [@playwright/test on npm](https://www.npmjs.com/package/@playwright/test) — version 1.58.2 current as of research date
- [BrowserStack: Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices) — community-validated patterns, CSS selector brittleness
- [Why AI Can't Write Good Playwright Tests](https://dev.to/johnonline35/why-ai-cant-write-good-playwright-tests-and-how-to-fix-it-knn) — locator generation fundamental limitations, accessibility tree information gap
- [Why Playwright Tests Pass Locally but Fail in CI](https://dev.to/sentinelqa/why-playwright-tests-pass-locally-but-fail-in-ci-4ph6) — baseURL and environment mismatch patterns
- [Microsoft Developer Blog: Complete Playwright E2E Story](https://developer.microsoft.com/blog/the-complete-playwright-end-to-end-story-tools-ai-and-real-world-workflows) — AI plus MCP plus Codegen ecosystem overview

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
