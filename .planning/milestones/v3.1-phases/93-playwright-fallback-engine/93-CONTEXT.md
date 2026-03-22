# Phase 93: Playwright Fallback Engine - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

When Chrome MCP is unavailable, the uat-auto workflow can execute the same tests using Playwright with headless Chromium. This phase adds the Playwright execution path to the existing `uat-auto.md` workflow, including ephemeral inline script generation, Chromium binary availability checking and installation, and identical output format to the Chrome MCP path. No autopilot wiring (Phase 94), no documentation (Phase 95).

</domain>

<decisions>
## Implementation Decisions

### Playwright Execution Path in uat-auto.md (PWRT-01)
- Add the Playwright execution path directly inside the existing `uat-auto.md` workflow file, replacing the current "mark all as skipped" placeholder in Step 5
- The workflow already detects browser mode in Step 3 and branches on `browser_mode`; this phase fills in the `playwright` branch
- No new workflow file or agent file — the single-agent constraint means both engines live in the same workflow

### Ephemeral Inline Script Generation (PWRT-02)
- For each test, the workflow generates a self-contained Node.js script that uses `@playwright/test`'s `chromium` launcher directly (not the test runner)
- Scripts are written to a temp file, executed via `node {script}`, and deleted after execution (Claude's Decision: ephemeral scripts avoid persistent .spec.ts files per explicit Out of Scope constraint, and using `chromium.launch()` directly avoids test runner overhead for single-test execution)
- Each script handles: launch browser, navigate to URL, perform interactions, capture screenshot, extract page text, output results as JSON to stdout, close browser
- Script output is a JSON object: `{ "pageText": "...", "screenshotPath": "..." }` — the workflow agent parses this and applies the same DOM-first judgment as Chrome MCP mode (Claude's Decision: JSON stdout is the simplest reliable IPC between the Bash-executed script and the agent; keeps judgment in the agent not the script)
- Interactions (click, fill, type) are translated from natural language test descriptions into Playwright API calls by the agent when generating each script (Claude's Decision: the agent interprets test descriptions and writes appropriate Playwright code — same role as Chrome MCP mode where the agent decides what MCP tools to call)

### Chromium Binary Availability Check (PWRT-03)
- Before executing the first Playwright test, check if Chromium is available by running `npx playwright install --dry-run chromium` or checking the browser path
- If Chromium is not installed, run `npx playwright install chromium` and log the installation (Claude's Decision: `npx playwright install chromium` is the official way to install just Chromium without other browsers, minimizing download size)
- If installation fails, abort UAT with a descriptive error — do not silently skip (Claude's Decision: Chromium is required for the fallback path; if both engines fail, that is a legitimate error the user needs to know about)
- Use `detectPlaywright()` from `testing.cjs` for package-level detection before attempting binary check (Claude's Decision: reuses existing three-tier detection from v2.7 as the first gate)

### Output Format Parity (PWRT-04)
- Screenshots saved to the same path convention: `.planning/uat-evidence/{milestone}/{phase}-test-{N}.png`
- Results recorded in the same format: `{phase, name, status, evidence, expected, observed}`
- MILESTONE-UAT.md format unchanged — `browser` field in frontmatter will read `playwright` instead of `chrome-mcp`
- Pass/fail judgment follows the identical DOM-first protocol: agent reads page text from script output, applies same judgment criteria as Chrome MCP path

### Script Template Structure
- Each generated script uses `const { chromium } = require('playwright')` (CJS require, not ESM import) (Claude's Decision: project uses CJS throughout; consistent with existing patterns)
- Screenshot saved via `page.screenshot({ path: '{evidence_path}', fullPage: true })` (Claude's Decision: fullPage captures complete state for evidence; matches what Chrome MCP read_page returns)
- Page text extracted via `page.textContent('body')` or `page.innerText('body')` (Claude's Decision: matches the DOM text extraction that `get_page_text` provides in Chrome MCP mode)
- Script exits with code 0 on success, non-zero on Playwright errors — the agent catches non-zero exits and records the test as failed with the error message

### Claude's Discretion
- Exact temp file naming and location for ephemeral scripts
- Whether to use `page.textContent('body')` or `page.innerText('body')` for text extraction
- Exact error message format when Chromium installation fails
- Whether to set a specific viewport size in the Playwright launch options
- How to translate complex interaction sequences from natural language to Playwright API calls

</decisions>

<specifics>
## Specific Ideas

**Ephemeral script template (conceptual):**
```javascript
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('{url}');
  // ... interactions generated by agent per test ...
  await page.screenshot({ path: '{evidence_path}', fullPage: true });
  const text = await page.innerText('body');
  console.log(JSON.stringify({ pageText: text, screenshotPath: '{evidence_path}' }));
  await browser.close();
})();
```

**Chromium availability check sequence:**
1. `detectPlaywright(cwd)` from testing.cjs -- checks package availability (configured/installed/not-detected)
2. If not-detected: abort with error (Playwright package not installed)
3. If configured or installed: run `node -e "const { chromium } = require('playwright'); chromium.launch().then(b => { b.close(); console.log('OK'); }).catch(() => { console.log('MISSING'); process.exit(1); })"` to verify binary
4. If MISSING: run `npx playwright install chromium`
5. Re-verify binary availability after install

**Playwright interaction mapping from test descriptions:**
- "click {element}" -> `page.click('{selector}')`  or `page.getByText('{text}').click()`
- "fill {field} with {value}" -> `page.fill('{selector}', '{value}')` or `page.getByLabel('{label}').fill('{value}')`
- "navigate to {path}" -> `page.goto('{base_url}{path}')`
- The agent determines the appropriate Playwright API calls based on the test's natural language description

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/uat-auto.md`: The workflow already has the Chrome MCP execution engine, test discovery, results writing, and a placeholder for Playwright execution. This phase fills in the placeholder.
- `get-shit-done/bin/lib/testing.cjs`: `detectPlaywright()` function provides three-tier detection (configured/installed/not-detected). Reuse for package-level checks before binary verification.
- `get-shit-done/bin/lib/uat.cjs`: `loadUatConfig()` already handles config loading with `fallback_browser` field. No changes needed.

### Established Patterns
- **Ephemeral script execution via Bash**: The design doc specifies "generates a minimal inline Playwright script" executed via `node`. This is the same pattern used in other GSD workflows that run Node.js snippets via Bash tool calls.
- **DOM-first judgment protocol**: Already defined in `uat-auto.md` Step 5 and `<judgment_protocol>` section. The Playwright path must produce the same inputs (page text + screenshot path) for the agent to apply the same judgment.
- **Evidence directory convention**: `.planning/uat-evidence/{milestone}/{phase}-test-{N}.png` -- defined in Phase 91, implemented in Phase 92 for Chrome MCP mode.
- **Single-agent workflow constraint**: The workflow handles both browser engines internally. Playwright scripts are executed via Bash tool, not via subagent spawning.

### Integration Points
- `get-shit-done/workflows/uat-auto.md`: Step 5 Playwright execution section needs to be replaced with actual implementation.
- The Playwright execution path must produce the same result format as Chrome MCP so Step 6 (Write Results) works identically for both paths.

</code_context>

<deferred>
## Deferred Ideas

- **runAutomatedUAT() in autopilot.mjs** -- Phase 94 wires the workflow into the autopilot pipeline
- **plan-milestone-gaps.md modification** -- Phase 94 makes gap closure recognize MILESTONE-UAT.md
- **App startup management with HTTP polling** -- Phase 94 handles robust startup
- **Documentation** -- Phase 95
- **Playwright webServer config block fix** -- known v2.7 tech debt; not addressed here since startup is managed by the workflow/autopilot, not Playwright's test runner
- **User-agent matching between Chrome MCP and Playwright** -- research pitfall #7 suggests this but adds complexity; defer unless divergence is observed
- **Per-test engine fallback** -- research suggests falling back mid-session if Chrome MCP fails during execution; adds complexity, defer to gap closure if needed

</deferred>

---

*Phase: 93-playwright-fallback-engine*
*Context gathered: 2026-03-22 via auto-context*
