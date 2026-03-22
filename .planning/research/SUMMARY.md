# Project Research Summary

**Project:** GSD Automated UAT Session (v3.1)
**Domain:** Automated browser-based acceptance testing integrated into autonomous development pipeline
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

GSD v3.1 adds a new automated UAT capability to the existing autopilot pipeline. The core innovation is using Claude as the "assertion engine" — a subagent that navigates a live web application using Chrome MCP (primary) or Playwright (fallback), interprets natural language expected behaviors from existing UAT.md files, and produces structured pass/fail results with screenshot evidence. This approach eliminates the need for a test DSL, CSS selectors, or spec file maintenance. The design is an additive integration on well-established GSD patterns (frontmatter-based result communication, gap closure loop, `runClaudeStreaming`) with only one new npm dependency (`js-yaml`).

The recommended implementation sequencing follows dependency order: define artifact schemas first (uat-config.yaml, MILESTONE-UAT.md format), build the UAT workflow second (the "brain" that executes tests), then wire it into autopilot third, and add gap closure integration last. The most critical architectural constraint is that the `/gsd:uat-auto` workflow must handle both Chrome MCP and Playwright execution paths internally — it cannot spawn subagents. The result communication contract (YAML frontmatter status: passed/gaps_found) must match the existing audit pattern exactly.

The two risks that most threaten the implementation are: (1) Chrome MCP connection instability causing false positives in availability detection — mitigated by requiring a full round-trip probe (not just `tabs_context_mcp`), and (2) AI-driven pass/fail judgment being non-deterministic — mitigated by requiring DOM-first assertions, a structured confidence score per verdict, and single-retry before recording failure. App startup race conditions (fixed wait vs HTTP polling) and YAML gap format incompatibility with the existing closure loop are the next-highest risks.

## Key Findings

### Recommended Stack

The only new npm dependency is `js-yaml ^4.1.1`, added to parse `uat-config.yaml`. Everything else reuses the existing stack: `zx` for background process management (dev server startup), Node.js built-in `fetch` for readiness polling, `Buffer`/`fs` for screenshot decoding, Chrome MCP tools (already available via MCP), and `@playwright/test` (already in devDependencies). The hand-rolled `extractFrontmatter` parser cannot reliably handle YAML type coercion or nested structures, making a real parser necessary even for a simple config file.

**Core technologies:**
- `js-yaml ^4.1.1`: YAML config parsing — lighter and simpler than `yaml` (eemeli), zero dependencies, type-safe coercion for numeric fields
- Chrome MCP tools: primary browser engine — `chrome_navigate`, `chrome_click_element`, `chrome_fill_or_select`, `chrome_screenshot`, `chrome_get_web_content` — no npm package, available via MCP tool calls
- `@playwright/test ^1.50.0` (already installed): fallback browser engine — ephemeral inline scripts executed via Bash, no persistent spec files
- `zx` (already installed): background dev server spawn and health-check polling
- Node.js built-in `fetch` + `Buffer`/`fs`: HTTP polling for readiness, PNG screenshot decoding

**Not adding:** `wait-on`, `tree-kill`, `yaml` (eemeli), `puppeteer`, `sharp`, `fast-glob`, or any test assertion library. Each is explicitly rejected as over-engineering for this scope.

### Expected Features

The feature set is clearly scoped by the approved design document. All features are well-defined with concrete dependencies.

**Must have (table stakes):**
- `uat-config.yaml` schema and validation — gates whether UAT runs at all; missing = skip silently
- UAT test discovery from existing `*-UAT.md` files — reuses verify-work artifacts, no test redefinition
- Browser engine auto-detection (Chrome MCP probe then Playwright fallback) — fully autonomous, no user intervention
- Chrome MCP execution engine — navigate, interact, screenshot, judge pass/fail in natural language
- Playwright fallback engine — headless Chromium via ephemeral inline scripts for CI/SSH environments
- Screenshot evidence per test — stored in `.planning/uat-evidence/{milestone}/`, proves what agent observed
- `MILESTONE-UAT.md` results report — YAML frontmatter (`status`, counts, browser, timestamps) + results table + gaps section
- Gap format compatible with `plan-milestone-gaps` — identical schema to `MILESTONE-AUDIT.md` gaps
- `runAutomatedUAT()` in autopilot.mjs — wired after audit pass, before milestone completion, returns 0/10/1
- UAT skip when no `uat-config.yaml` — non-web projects proceed directly to completion

**Should have (differentiators):**
- Natural language test interpretation — no assertion DSL, selectors, or codegen; Claude reads UAT.md descriptions directly
- Multimodal pass/fail judgment — both screenshot (visual) and DOM content (structural) as evidence
- Test scenario generation from SUMMARY.md — fallback when no UAT.md files exist for a milestone
- Gap closure loop integration — failed tests automatically feed into fix phases, re-audit, re-test cycle
- App startup management — starts dev server if not running, skips if already up

**Defer (post-v3.1):**
- Phase-level automated UAT (replacing human verify-work at individual phases)
- Custom Chrome MCP tool allowlists
- UAT result trending across milestones
- Configurable severity thresholds for gap creation

### Architecture Approach

The automated UAT session inserts as a single new step (`runAutomatedUAT()`) in the autopilot milestone-completion flow, between `runMilestoneAudit()` returning 0 and `runMilestoneCompletion()`. It introduces 4 new components (the function, the workflow file, the config file, and the results artifact) and modifies 2 existing ones (autopilot.mjs at 3 insertion points, plan-milestone-gaps.md to recognize MILESTONE-UAT.md as a gap source). All result communication follows the established frontmatter-based pattern: the workflow writes YAML frontmatter with `status: passed|gaps_found`, and autopilot reads it via `gsd-tools frontmatter get`. The exit code contract (0=pass, 10=gaps, 1=error) matches `runMilestoneAudit()` exactly, making the gap closure loop reuse trivial.

**Major components:**
1. `runAutomatedUAT()` in autopilot.mjs — gates on config existence, spawns workflow, parses results, routes to completion or gap closure
2. `uat-auto.md` workflow — the single subagent that handles discover/detect/execute/report; must contain BOTH Chrome MCP and Playwright paths internally (no subagent spawning allowed)
3. `uat-config.yaml` (per-project) — declares `base_url`, `startup_command`, `startup_wait_seconds`, `browser`, `fallback_browser`, `timeout_minutes`
4. `MILESTONE-UAT.md` — results artifact with frontmatter status, counts, and gaps YAML compatible with plan-milestone-gaps

**Key refactoring opportunity:** Extract `auditAndUAT()` helper to eliminate the 3-site duplication in autopilot.mjs where audit-pass leads to UAT before completion.

### Critical Pitfalls

1. **Chrome MCP false-positive availability detection** — probe with full round-trip (`tabs_context_mcp` + `tabs_create_mcp` + `chrome_navigate` + response check), not just `tabs_context_mcp` alone. Implement per-test fallback to Playwright if mid-session Chrome MCP calls fail. Confirmed by GitHub issue #27492 and wrong-machine routing reports.

2. **Non-deterministic AI pass/fail judgment** — use DOM content assertions as primary signal (deterministic), screenshots as supplementary. Require structured confidence score (1-5) per verdict. Re-run any failed test once before recording failure; two consecutive failures = confirmed gap.

3. **App startup race condition** — replace fixed `startup_wait_seconds` with HTTP polling (`fetch(base_url)` every 2 seconds, 60-second hard cap). Check if app is already running before starting it. Capture startup command stderr/stdout and fail explicitly if it exits with non-zero before readiness.

4. **Gap format incompatibility** — use the exact same `truth`/`status`/`reason`/`severity` schema as `MILESTONE-AUDIT.md`. The `evidence` and `observed` fields are additive metadata, not required for gap planning. Avoid nested YAML array-of-objects given known `extractFrontmatter` limitation.

5. **Subagent cannot spawn subagent** — `uat-auto.md` workflow must handle Chrome MCP and Playwright paths in one agent session. All browser interaction happens via tool calls (Chrome MCP tools or Bash for Playwright scripts), never via `Task()`.

## Implications for Roadmap

Based on the dependency-driven build order identified in ARCHITECTURE.md, a 5-phase structure is recommended:

### Phase 1: Foundation — Artifact Schemas and Config

**Rationale:** Every subsequent component depends on having defined formats for inputs and outputs. Schema definition has no dependencies and unblocks parallel work on the workflow and autopilot function.
**Delivers:** `uat-config.yaml` schema with validation, `MILESTONE-UAT.md` format specification, `uat-evidence/` directory structure, `uat-auto` command spec
**Addresses:** Table stakes items: config schema (gate for UAT), MILESTONE-UAT.md format (result contract)
**Avoids:** Pitfall 4 (gap format incompatibility) — define gap schema as identical to audit schema from the start; Pitfall 14/15 (YAML type coercion, URL normalization) — specify js-yaml and URL constructor as required tools

### Phase 2: UAT Workflow — Chrome MCP Engine and Test Discovery

**Rationale:** The `uat-auto.md` workflow is the "brain" of the feature. It must exist and be callable before autopilot integration can proceed. Chrome MCP is the primary engine so it should be implemented before the fallback.
**Delivers:** `uat-auto.md` workflow with Chrome MCP execution (navigate, interact, screenshot, judge), UAT test discovery from `*-UAT.md` files, screenshot saving to evidence directory, MILESTONE-UAT.md production
**Uses:** Chrome MCP tools, `js-yaml` (config parsing in workflow), `frontmatter.cjs` (MILESTONE-UAT.md write)
**Implements:** Components 2 and 4 (workflow and results artifact)
**Avoids:** Pitfall 1 (Chrome MCP false positive) — full round-trip probe; Pitfall 2 (non-deterministic judgment) — DOM-first assertions, confidence scoring, single retry; Pitfall 5 (subagent constraint) — single-agent design; Pitfall 9 (zero tests) — BLOCKED status when no testable content; Pitfall 10 (context exhaustion) — minimize DOM capture, do not accumulate screenshots in context

### Phase 3: Playwright Fallback Engine

**Rationale:** The fallback is a distinct engine with its own reliability concerns. Building it separately from the Chrome MCP engine keeps each implementation focused and allows each path to be tested independently.
**Delivers:** Playwright fallback path in uat-auto.md workflow, Chromium binary availability check (not just package detection), ephemeral inline script generation and execution via Bash
**Uses:** `@playwright/test` (existing), Playwright headless Chromium
**Avoids:** Pitfall 7 (result divergence) — document that tests must not depend on browser state; Pitfall 11 (Chromium not installed) — add `npx playwright install chromium` to fallback initialization

### Phase 4: Autopilot Integration and Gap Closure Wiring

**Rationale:** Can only proceed once the workflow exists (Phase 2). This is the wiring that makes UAT part of the autonomous pipeline.
**Delivers:** `runAutomatedUAT()` function in autopilot.mjs, 3 insertion points (or `auditAndUAT()` helper refactor), `runGapClosureLoop()` wired to handle UAT exit code 10, `plan-milestone-gaps.md` modified to scan MILESTONE-UAT.md as gap source, `js-yaml` npm dependency installed
**Uses:** `gsd-tools frontmatter get` (existing pattern), `runStepWithRetry` (existing pattern), `fs.existsSync` for config gate
**Avoids:** Pitfall 3 (startup race) — HTTP polling not fixed wait, pre-check if already running, exit handlers for orphan processes; Pitfall 8 (timeout cascade) — limit UAT-triggered gap closure to 1 iteration, add top-level wall-clock budget; Pitfall 12 (port conflicts) — pre-check base_url before starting server

### Phase 5: Evidence, Reporting, and Documentation

**Rationale:** Screenshot storage conventions, git hygiene, and documentation are finishers that do not block the core flow but are necessary for production quality.
**Delivers:** Screenshot git strategy (`.gitignore` for uat-evidence/ or git LFS decision), milestone archival cleanup for uat-evidence/, help.md and USER-GUIDE.md updates, unit/integration tests for autopilot function, `uat-config.yaml` template for new projects
**Avoids:** Pitfall 6 (git bloat) — add `.planning/uat-evidence/` to `.gitignore`, commit only MILESTONE-UAT.md results; Pitfall 16 (path convention mismatch) — use sequential `test-{N}.png` naming, not phase-encoded names

### Phase Ordering Rationale

- Schema definition before implementation prevents the gap format incompatibility pitfall from requiring a rewrite once the closure loop is wired
- Chrome MCP before Playwright because Chrome MCP is the primary engine; the fallback should share the same test contract established in Phase 2
- Workflow before autopilot integration because autopilot calls the workflow — you cannot wire a caller before the callee exists
- Gap closure integration in Phase 4 (same as autopilot) because it is tightly coupled to how autopilot routes UAT exit code 10
- Evidence/documentation last because it does not block any core functionality

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Chrome MCP engine):** Chrome MCP connection instability is confirmed but the exact probe sequence that reliably distinguishes "available" from "falsely available" may need experimentation. The 5s/call latency assumption should be validated against actual project Chrome MCP performance before finalizing timeout values.
- **Phase 3 (Playwright fallback):** The Playwright `webServer` config block is documented as a solution for startup management but the existing GSD scaffolding templates omit it (known v2.7 tech debt). Determine whether to fix scaffolding templates as part of this phase or implement startup separately.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Schema definition follows existing MILESTONE-AUDIT.md and VERIFICATION.md patterns exactly. No research needed.
- **Phase 4 (Autopilot integration):** The `runMilestoneAudit()` function at line 862 of autopilot.mjs is a direct model. Insertion points are identified by line number. No research needed.
- **Phase 5 (Evidence/documentation):** Standard git hygiene and documentation work. Well-understood patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single new dependency (js-yaml) is well-established with zero dependencies itself. All other stack components are already in use and verified. Rejections are well-reasoned with explicit alternatives considered. |
| Features | HIGH | Primary source is the approved design document. Feature list is concrete, scoped, and dependency-mapped. Anti-features are explicit with rationale. |
| Architecture | HIGH | Codebase was analyzed directly with insertion points identified by line number. Existing patterns (runMilestoneAudit, frontmatter communication, exit code contract) are confirmed to exist. |
| Pitfalls | HIGH | All 5 critical pitfalls are documented from verified sources (GitHub issues, official docs, codebase tech debt tracking). Chrome MCP instability is confirmed by multiple independent sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Chrome MCP probe reliability:** The exact probe sequence that avoids false positives needs empirical validation during Phase 2 implementation. Start with the full round-trip (tabs_context_mcp + tabs_create_mcp + chrome_navigate to base_url) and adjust based on observed behavior.
- **Test batching threshold:** Context window exhaustion (Pitfall 10) is a MEDIUM confidence risk — actual token consumption per test is application-dependent. Start with 20-test limit in config and monitor.
- **Gap format consumer compatibility:** Validate during Phase 4 that MILESTONE-UAT.md gap YAML is parseable by plan-milestone-gaps before finalizing the schema. The `extractFrontmatter` nested array limitation may require storing gaps in the markdown body rather than YAML frontmatter.
- **Dev server lifecycle UX:** The design notes the dev server "can be left running" when the Claude session ends. Clarify whether this is intentional or should be cleaned up, and document the expected behavior for users.

## Sources

### Primary (HIGH confidence)
- `.planning/designs/2026-03-22-automated-uat-session-design.md` — approved design specification (primary source for all research)
- `get-shit-done/scripts/autopilot.mjs` — integration points, existing patterns, line-level analysis
- `get-shit-done/bin/lib/testing.cjs` — Playwright detection three-tier status, known limitations
- `get-shit-done/workflows/verify-work.md` — UAT.md file format and ownership model
- `get-shit-done/workflows/audit-milestone.md` — milestone audit patterns replicated for UAT
- `get-shit-done/workflows/plan-milestone-gaps.md` — gap consumption schema (must be matched)
- [Chrome DevTools MCP official docs](https://developer.chrome.com/blog/chrome-devtools-mcp) — Chrome MCP tool capabilities
- [Claude Chrome docs](https://code.claude.com/docs/en/chrome) — context consumption with browser tools
- [js-yaml npm](https://www.npmjs.com/package/js-yaml) — v4.1.1, 24k+ dependents, zero dependencies

### Secondary (MEDIUM confidence)
- [Browser automation tool comparison 2026](https://www.hanifcarroll.com/blog/browser-automation-tools-comparison-2026/) — ~5s/call Chrome MCP latency overhead
- [Browser automation for Claude Code comparison](https://dev.to/minatoplanb/i-tested-every-browser-automation-tool-for-claude-code-heres-my-final-verdict-3hb7) — real-world Chrome MCP vs Playwright assessment
- [Avoiding flaky Playwright tests](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/) — fixed wait anti-pattern, polling alternatives
- [Screenshot git repo bloat](https://dev.to/omachala/your-screenshot-automation-is-bloating-your-git-repo-3lgc) — binary accumulation in git history
- [Agentic Browser Landscape 2026](https://www.nohackspod.com/blog/agentic-browser-landscape-2026) — ecosystem overview

### Confirmed Issues (codebase and external)
- [GitHub issue #27492](https://github.com/anthropics/claude-code/issues/27492) — Chrome MCP connection instability confirmed
- [Wrong-machine routing report](https://mikestephenson.me/2026/03/13/claude-cowork-browser-automation-wrong-machine/) — Chrome extension routing to different machine
- `.planning/RETROSPECTIVE.md` v2.7 section — Playwright tech debt items (playwright-detect, scaffolding webServer, path conventions)
- `.planning/PROJECT.md` — known tech debt: extractFrontmatter nested YAML limitation, test budget at 103.25%

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
