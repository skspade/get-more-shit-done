# Feature Landscape

**Domain:** Automated UAT browser testing for autonomous development framework
**Researched:** 2026-03-22
**Confidence:** HIGH (design doc approved, existing codebase patterns well-understood, Chrome MCP and Playwright capabilities verified via official sources)

## Context: What Already Exists

This milestone ADDS a new capability layer on top of existing infrastructure. The following are already built and operational:

- **`/gsd:verify-work` workflow** (`verify-work.md`) -- human-driven UAT with UAT.md template (Given/When/Then format), severity inference, gap diagnosis, gap closure planning. Produces `*-UAT.md` files per phase with structured test results and YAML gap format.
- **`/gsd:verify-phase` workflow** -- code-level truth/artifact/wiring checks with structured VERIFICATION.md output. Already runs in autopilot pipeline.
- **Autopilot verification gate** -- TTY approve/fix/abort pattern. Human reviews verification results before proceeding.
- **Playwright detection and scaffolding** -- `detectPlaywright()` in `testing.cjs` with three-tier status (configured/installed/not-detected), config file discovery, scaffolding support.
- **`gsd-playwright` agent** -- five-step lifecycle (detect, scaffold, generate, execute, report) for on-demand E2E testing via `/gsd:ui-test`.
- **Milestone audit loop** -- `runMilestoneAudit()` in `autopilot.mjs` with gap closure, re-audit, and configurable max iterations. Returns exit codes 0 (pass) or 10 (gaps_found).
- **Gap closure pipeline** -- `runGapClosureLoop()` consumes YAML gaps, creates fix phases via `plan-milestone-gaps`, executes them, re-audits.
- **`runClaudeStreaming()`** -- consolidated Claude CLI invocation with NDJSON parsing, stall detection, and quiet mode.
- **Evidence patterns** -- screenshots already supported by `gsd-playwright` agent; `.planning/` is the standard artifact location.

The new milestone adds automated browser-based UAT execution using Claude-as-tester, integrating between milestone audit and milestone completion in the autopilot pipeline.

## Table Stakes

Features users expect from automated UAT in this framework. Missing = the feature feels incomplete or breaks the autonomous pipeline.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| UAT test discovery from existing `*-UAT.md` files | The verify-work workflow already produces UAT.md files with test names and expected behaviors. Automated UAT that ignores these existing artifacts would force users to redefine tests. Discovery must scan phase directories for status:complete UAT files and extract test lists. | LOW | Existing UAT.md files from verify-work (exists), phase directory structure (exists) |
| `uat-config.yaml` for base URL and startup command | Every browser test session needs to know where the app lives. Without a config file, the agent would have to guess or ask -- breaking autonomous execution. The config also gates whether UAT runs at all (no config = no web UI = skip). | LOW | `.planning/` directory (exists) |
| Chrome MCP execution engine (navigate, interact, observe, judge) | Chrome MCP is the primary browser driver. The agent must navigate to pages, click elements, fill forms, take screenshots, and read DOM content. Chrome DevTools MCP provides all required tools: `chrome_navigate`, `chrome_click_element`, `chrome_fill_or_select`, `chrome_screenshot`, `chrome_get_web_content`. The agent interprets expected behavior in natural language -- no assertion DSL needed. | HIGH | Chrome MCP server (external dependency), Claude subagent spawning (exists via Task()) |
| Playwright fallback for headless/CI environments | Chrome MCP requires a running Chrome browser with DevTools MCP enabled. In headless CI, SSH sessions, or environments without a display, Chrome MCP is unavailable. Playwright provides headless Chromium execution. Without fallback, automated UAT only works on developer machines. | MEDIUM | `detectPlaywright()` (exists), Playwright installation (exists in project) |
| Browser engine auto-detection (Chrome MCP vs Playwright) | The agent must automatically determine which engine is available. Design specifies: attempt `tabs_context_mcp` first; if it fails or times out (5 seconds), fall back to Playwright. No user intervention required -- fully autonomous. | LOW | Chrome MCP availability check, Playwright detection (exists) |
| Screenshot evidence per test | Every test execution must produce a screenshot proving what the agent saw. Without evidence, pass/fail judgments are unverifiable black boxes. Failed tests especially need screenshots showing observed vs expected state. Evidence stored in `.planning/uat-evidence/{milestone}/`. | LOW | Chrome MCP `chrome_screenshot` or Playwright `page.screenshot()`, filesystem writes |
| MILESTONE-UAT.md results report | Structured output file with YAML frontmatter (status, counts, browser, timestamps) and results table (test name, phase, status, evidence path). This is how the autopilot knows whether UAT passed or found gaps. Follows the same pattern as MILESTONE-AUDIT.md. | LOW | Test execution results, YAML frontmatter pattern (exists in multiple .planning files) |
| Gaps in MILESTONE-UAT.md following existing YAML gap format | Failed UAT tests must be written as gaps compatible with `plan-milestone-gaps`. The gap format (truth, status, reason, severity, evidence) is already consumed by the gap closure pipeline. Without compatible gaps, failures cannot feed back into the fix loop. | LOW | Existing YAML gap format (exists in verify-work, milestone-audit) |
| Autopilot integration: `runAutomatedUAT()` after audit, before completion | The new function slots between `runMilestoneAudit()` returning 0 and `runMilestoneCompletion()`. UAT pass proceeds to completion; UAT failures feed into gap closure loop and re-audit. This is the core pipeline integration point. | MEDIUM | `autopilot.mjs` main flow (exists), `runGapClosureLoop()` (exists), `runMilestoneCompletion()` (exists) |
| UAT skip when no `uat-config.yaml` exists | Not all projects have web UIs. Without this gate, autopilot would fail on CLI tools, libraries, or backend-only projects. Missing config = no UAT = proceed directly to completion. | LOW | Config file check (trivial) |
| Configurable timeout for UAT session | Browser testing can hang on unresponsive apps, broken navigation, or infinite loops. The design specifies a 10-minute default timeout. Without it, a stuck UAT session blocks the entire autopilot pipeline. | LOW | Existing stall detection pattern in `runClaudeStreaming()` |

## Differentiators

Features that make this approach genuinely novel compared to traditional browser test automation. These leverage the Claude-as-tester pattern.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| Natural language test interpretation (no assertion DSL) | Traditional browser testing requires explicit selectors, assertions, and step definitions. Claude reads "Clicking Reply opens inline composer below comment" and figures out what to click, where to look, and what constitutes success. This is the core innovation -- converting human-readable UAT descriptions directly into browser actions without codegen. | HIGH (but inherent to the agent pattern, not separate implementation work) | Chrome MCP or Playwright browser tools, Claude's multimodal understanding |
| Multimodal pass/fail judgment (screenshot + DOM) | The agent looks at both the screenshot (visual layout, colors, visibility) and the DOM content (text values, element presence) to judge pass/fail. This catches issues that pure DOM inspection misses (layout broken but elements present) and issues that pure visual testing misses (content correct but from wrong data source). | LOW (Claude handles this natively) | `chrome_screenshot` + `chrome_get_web_content`, or Playwright equivalents |
| Test scenario generation from SUMMARY.md when no UAT.md exists | If phases were completed without running verify-work (common in autonomous mode), the agent generates test scenarios from SUMMARY.md deliverables using the same extraction logic as verify-work's initialization step. This means UAT runs even for milestones that never had manual testing. | MEDIUM | SUMMARY.md files across phases, extraction logic (pattern exists in verify-work) |
| Gap closure loop integration for failed UAT tests | Failed tests automatically feed into the existing gap closure pipeline -- fix phases are created, executed, and the milestone is re-audited and re-tested. This creates a closed loop: test, fail, fix, retest. No manual intervention required. | MEDIUM | `runGapClosureLoop()` (exists), `plan-milestone-gaps` (exists), YAML gap format (exists) |
| App startup management | If the app is not running, the agent starts it using `startup_command` from config. If it is already running (detected by fetching `base_url`), it skips startup. This handles both local development (app already running) and CI (app needs to start) without user configuration per-environment. | LOW | `uat-config.yaml` startup_command field, HTTP fetch to check availability |
| Observed vs expected text in failure reports | Failed tests include not just "failed" but a structured description of what was observed vs what was expected. "Expected: comment list refreshes. Observed: list shows 3 items before and after submit." This provides actionable debugging information for gap closure planning. | LOW (agent naturally produces this as part of judgment) | Agent's judgment output from the observe/judge steps |

## Anti-Features

Features to explicitly NOT build for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Persistent `.spec.ts` test file generation | The design explicitly rejects generating Playwright spec files. Persistent specs create maintenance burden, become stale, and duplicate the UAT.md source of truth. The agent writes ephemeral scripts, runs them, and discards them. The UAT.md files ARE the test definitions. | Agent writes inline scripts per test, executes, discards. UAT.md is the single source of truth. |
| Visual regression baseline comparison | Pixel-diff testing (Applitools, Percy-style) requires baseline approval, storage, and threshold tuning. It is a different testing paradigm than acceptance testing. The agent judges pass/fail semantically, not pixel-by-pixel. | Claude's multimodal judgment replaces pixel comparison. "Does this look right given the expected behavior?" |
| Multi-browser test matrix | Cross-browser testing (Firefox, Safari, Edge) adds complexity without proportional value. Chromium-only is sufficient for acceptance testing. Browser compatibility testing is a separate concern. | Chromium only, via either Chrome MCP or Playwright's Chromium. |
| Parallel test execution | Running multiple tests simultaneously requires multiple browser sessions, coordination logic, and complicates evidence capture. UAT tests are sequential by nature (one user walking through the app). The design specifies sequential execution. | Sequential test execution. Total test count per milestone is small (typically 5-20 tests). |
| Selector-based test definitions | Adding CSS selectors, XPath, or data-testid attributes to UAT.md test definitions. This couples tests to implementation details and defeats the natural-language-interpretation advantage. | Agent discovers elements from context. "Click the Reply button" not "click [data-testid=reply-btn]". |
| Interactive UAT mode (human watches agent) | Adding a mode where the user watches the agent test in real-time and can intervene. This contradicts the "fully autonomous" requirement and adds streaming/interaction complexity. | Fully autonomous. Evidence screenshots provide post-hoc visibility. |
| UAT for non-web projects (CLI testing, API testing) | Extending the browser testing engine to handle CLI commands or API endpoints. These are different testing domains that need different approaches. | Scope to web UI testing only. CLI/API projects skip UAT via missing uat-config.yaml. |
| Cost/token budget for UAT session | Adding token counting or cost caps. The existing progress circuit breaker handles runaway execution. Token budgets add complexity without clear benefit over timeout-based limits. | 10-minute timeout (configurable). Stall detection from runClaudeStreaming(). |
| Retry individual failed tests before reporting | Retrying a failed test to confirm it is not flaky adds complexity and delays failure reporting. UAT tests are deterministic (same app state, same expected behavior). Flakiness is an infrastructure issue, not a test issue. | Report failures immediately. Gap closure fixes the app, then re-runs full UAT. |

## Feature Dependencies

```
uat-config.yaml (NEW file, user-created)
    |
    v
UAT Test Discovery (NEW)
    |-- Scans phase dirs for *-UAT.md with status:complete
    |-- Falls back to SUMMARY.md extraction if no UAT.md files exist
    |
    v
Browser Engine Detection (NEW)
    |-- Try Chrome MCP (tabs_context_mcp)
    |-- Timeout 5s -> fall back to Playwright
    |-- Uses detectPlaywright() (EXISTS) for fallback validation
    |
    +---> Chrome MCP Engine (NEW)
    |         |-- chrome_navigate, chrome_click_element, chrome_fill_or_select
    |         |-- chrome_screenshot, chrome_get_web_content
    |         |-- Agent interprets expected behavior, judges pass/fail
    |
    +---> Playwright Fallback Engine (NEW)
              |-- Ephemeral inline scripts (no .spec.ts files)
              |-- page.goto, page.click, page.fill, page.screenshot
              |-- Agent still judges pass/fail (Playwright = hands, not brain)
    |
    v
Evidence Capture (NEW)
    |-- Screenshots to .planning/uat-evidence/{milestone}/
    |-- Structured per test: {phase}-test-{N}.png
    |
    v
Results & Gap Generation (NEW)
    |-- MILESTONE-UAT.md with frontmatter + results table + gaps YAML
    |-- Gaps follow existing format (truth, status, reason, severity, evidence)
    |
    v
/gsd:uat-auto Workflow (NEW file)
    |-- Orchestrates: config -> discover -> detect -> start app -> execute -> report
    |-- Called by autopilot via claude -p
    |
    v
runAutomatedUAT() in autopilot.mjs (NEW function, MODIFIES existing file)
    |-- Inserted after runMilestoneAudit() returns 0
    |-- Exit 0 + all pass -> runMilestoneCompletion() (EXISTS)
    |-- Exit 0 + failures -> runGapClosureLoop() (EXISTS) -> re-audit -> re-UAT
    |-- Exit non-zero -> debug retry (EXISTS)
```

### New Files Required

| File | Purpose |
|------|---------|
| `workflows/uat-auto.md` | UAT execution workflow (the `/gsd:uat-auto` slash command) |
| `commands/gsd/uat-auto.md` | Command spec for uat-auto |
| `.planning/uat-config.yaml` | Per-project UAT configuration (user-created, template provided) |

### Modified Files

| File | Change |
|------|--------|
| `get-shit-done/scripts/autopilot.mjs` | Add `runAutomatedUAT()` function, wire into main flow after audit pass |
| `get-shit-done/bin/lib/testing.cjs` | Potentially add UAT test discovery function |
| Command/workflow help references | Document new uat-auto command |

## MVP Recommendation

### Launch With (v3.1)

Prioritize implementation in this order based on dependencies:

1. **uat-config.yaml schema and validation** -- the gate that determines whether UAT runs at all
2. **UAT test discovery from UAT.md files** -- find what to test
3. **Test scenario generation from SUMMARY.md** -- fallback when no UAT.md files exist
4. **Browser engine detection (Chrome MCP probe + Playwright fallback)** -- determine how to test
5. **Chrome MCP execution engine** -- primary engine: navigate, interact, screenshot, judge
6. **Playwright fallback engine** -- secondary engine for headless environments
7. **Evidence capture and MILESTONE-UAT.md generation** -- structured output with screenshots and gap format
8. **`/gsd:uat-auto` workflow** -- the slash command orchestrating steps 1-7
9. **`runAutomatedUAT()` in autopilot.mjs** -- pipeline integration with gap closure loop wiring
10. **App startup management** -- start app if not running, detect if already running

### Defer (post-v3.1)

- **UAT for existing phase-level verify-work** -- letting automated UAT replace human testing at the phase level (not just milestone level)
- **Custom Chrome MCP tool allowlists** -- restricting which Chrome MCP tools the agent can use
- **UAT result trending across milestones** -- tracking pass rates over time
- **Configurable severity thresholds for gap creation** -- letting cosmetic failures pass while blocking major failures

## Sources

- `.planning/designs/2026-03-22-automated-uat-session-design.md` -- Approved design document (primary source)
- `.planning/PROJECT.md` -- v3.1 active requirements and milestone context
- `get-shit-done/workflows/verify-work.md` -- Existing UAT workflow producing UAT.md files
- `get-shit-done/scripts/autopilot.mjs` -- Autopilot pipeline integration point
- `get-shit-done/bin/lib/testing.cjs` -- Existing Playwright detection and test infrastructure
- [Chrome DevTools MCP](https://developer.chrome.com/blog/chrome-devtools-mcp) -- Official Chrome MCP capabilities
- [Browser automation tools comparison for Claude Code](https://dev.to/minatoplanb/i-tested-every-browser-automation-tool-for-claude-code-heres-my-final-verdict-3hb7) -- Real-world testing of browser automation with Claude
- [Agentic Browser Landscape 2026](https://www.nohackspod.com/blog/agentic-browser-landscape-2026) -- Ecosystem overview

---
*Feature research for: Automated UAT Session (GSD v3.1)*
*Researched: 2026-03-22*
