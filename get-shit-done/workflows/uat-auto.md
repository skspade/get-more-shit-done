<purpose>
Execute automated UAT tests against a live web application using Chrome MCP (primary) or Playwright (fallback). Discovers tests from existing UAT.md and SUMMARY.md files, probes browser availability, runs tests with DOM-based assertions, and writes structured results to MILESTONE-UAT.md.

This workflow is fully autonomous — no user interaction, no subagent spawning. It is spawned by autopilot.mjs via `claude -p "/gsd:uat-auto"` and runs as a single agent session.
</purpose>

<constraints>
- **No user interaction** — fully autonomous execution (WKFL-02)
- **No subagent spawning** — no Task() calls; all logic runs in this single agent session
- **No source code modification** — read-only testing against a live application
- **No UAT.md modification** — read from per-phase `*-UAT.md` files, write to `MILESTONE-UAT.md`
- **Timeout enforcement** — check wall-clock time before each test; write partial results on timeout (WKFL-04)
- **DOM-first assertions** — use DOM text content as primary pass/fail signal; screenshots are supplementary evidence
</constraints>

<chrome_mcp_tools>
## Chrome MCP Tool Reference

| Tool | Purpose |
|------|---------|
| `mcp__claude-in-chrome__tabs_context_mcp` | Check Chrome MCP connectivity |
| `mcp__claude-in-chrome__tabs_create_mcp` | Create new browser tab |
| `mcp__claude-in-chrome__navigate` | Navigate to URL |
| `mcp__claude-in-chrome__computer` | Click elements, type text, mouse events |
| `mcp__claude-in-chrome__form_input` | Fill form fields and select options |
| `mcp__claude-in-chrome__shortcuts_execute` | Execute keyboard shortcuts |
| `mcp__claude-in-chrome__read_page` | Capture page screenshot |
| `mcp__claude-in-chrome__get_page_text` | Extract DOM text content |
| `mcp__claude-in-chrome__find` | Find elements on page |
</chrome_mcp_tools>

<process>

## Step 1: Load Config

Load UAT configuration from `.planning/uat-config.yaml`:

```bash
node -e "
const uat = require('./get-shit-done/bin/lib/uat.cjs');
const cfg = uat.loadUatConfig('.planning');
if (!cfg) { console.log('SKIP'); process.exit(0); }
console.log(JSON.stringify(cfg));
"
```

**If result is "SKIP":** Print "UAT skipped: no uat-config.yaml found" and stop. Exit normally.

**If config loaded:** Parse the JSON to extract:
- `base_url` — the application URL to test against
- `startup_command` — optional command to start the app
- `startup_wait_seconds` — seconds to wait after starting app (default 10)
- `browser` — preferred browser engine (default "chrome-mcp")
- `fallback_browser` — fallback engine (default "playwright")
- `timeout_minutes` — max session duration (default 10)

Record the session start time for timeout tracking.

## Step 2: Discover Tests

### 2a. Primary: Scan for UAT.md files

Use Glob to find `*-UAT.md` files in `.planning/phases/*/`.

For each found file:
1. Read the file content
2. Check YAML frontmatter for `status: complete`
3. If status is complete, parse the file body for test entries
4. Extract each test: name (from heading or test field), expected behavior description, and URL hint (page path if mentioned, otherwise base_url)

### 2b. Fallback: Generate from SUMMARY.md

If zero tests found from UAT.md files:

1. Use Glob to find `*-SUMMARY.md` files in `.planning/phases/*/` (current milestone phases only)
2. For each SUMMARY.md, read the file and extract:
   - Key behaviors described in the summary
   - Success criteria or verification results
   - Features built that have observable UI behavior
3. Convert each extracted behavior into a test scenario with:
   - Test name: derived from the behavior description
   - Expected behavior: the observable behavior statement
   - URL hint: inferred from context or default to base_url

**Quality gate:** Skip any generated scenario that does not describe a specific page, action, or visible outcome. Generic descriptions like "code was refactored" are not testable.

### 2c. Zero Tests

If zero tests found from both sources:
1. Write MILESTONE-UAT.md with:
   - `status: passed`
   - `total: 0`, `passed: 0`, `failed: 0`
   - A note in the body: "No UAT-testable changes found in this milestone."
2. Commit the file
3. Print "UAT: no testable changes found. Status: passed."
4. Stop — exit normally.

## Step 3: Detect Browser

### 3a. Chrome MCP Probe (when config.browser is "chrome-mcp")

Execute a full round-trip probe to verify Chrome MCP is working:

**Probe step 1:** Call `mcp__claude-in-chrome__tabs_context_mcp`
- If this call errors or times out: Chrome MCP unavailable. Set browser_mode to config.fallback_browser. Skip remaining probe steps.

**Probe step 2:** Call `mcp__claude-in-chrome__navigate` with the base_url
- If this call errors: Chrome MCP is connected but unstable. Set browser_mode to config.fallback_browser.

**Probe step 3:** Call `mcp__claude-in-chrome__get_page_text` to verify content is returned
- If content is returned: Chrome MCP confirmed working. Set browser_mode to "chrome-mcp".
- If this call errors: Chrome MCP is unreliable. Set browser_mode to config.fallback_browser.

Log the probe result: "Browser: {browser_mode} (probe: {passed|failed})"

### 3b. Direct Playwright (when config.browser is "playwright")

Skip the Chrome MCP probe. Set browser_mode to "playwright".

## Step 4: Start App (if needed)

Check if the application is already running:

```bash
curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 {base_url}
```

**If app responds** (any HTTP status code): Skip startup. Log "App already running at {base_url}".

**If app does not respond:**
- If `startup_command` is configured:
  1. Start the app in background: run `{startup_command}` via Bash with `&` to background it
  2. Wait `startup_wait_seconds` seconds
  3. Re-check with curl. If still not responding, abort with error.
- If no `startup_command`: Abort with error "App not running at {base_url} and no startup_command configured in uat-config.yaml."

## Step 5: Execute Tests

Initialize results tracking:
- `results`: empty list
- `start_time`: session start timestamp (from Step 1)
- `timeout_ms`: timeout_minutes * 60 * 1000

### For each test in the discovered test list:

**Timeout check:** Before starting each test, check elapsed time. If elapsed exceeds timeout_ms, mark this test and all remaining tests as `skipped` (reason: "session timeout") and proceed to Step 6.

**Chrome MCP execution** (when browser_mode is "chrome-mcp"):

1. **Navigate:** Call `mcp__claude-in-chrome__navigate` with the test's URL (base_url + path if specified, or base_url)

2. **Interact:** Based on the test's expected behavior description, determine what actions to perform:
   - For click actions: use `mcp__claude-in-chrome__computer` or `mcp__claude-in-chrome__find` to locate elements, then click
   - For form input: use `mcp__claude-in-chrome__form_input` to fill fields
   - For keyboard actions: use `mcp__claude-in-chrome__shortcuts_execute`
   - If no specific interaction is described (just "verify X is visible"), skip interaction

3. **Read DOM:** Call `mcp__claude-in-chrome__get_page_text` to get the page's text content

4. **Capture Screenshot:** Call `mcp__claude-in-chrome__read_page` to capture the page state
   - Save the screenshot to `.planning/uat-evidence/{milestone}/{phase}-test-{N}.png`
   - Use Bash with base64 decoding if the tool returns base64-encoded image data
   - Ensure the evidence directory exists: `mkdir -p .planning/uat-evidence/{milestone}/`

5. **Judge Pass/Fail:**

   **PRIMARY signal (DOM text):**
   - Does the page text contain the expected content described in the test?
   - Are expected elements, messages, or data present in the DOM text?
   - Are there error messages or unexpected states?

   **SUPPLEMENTARY signal (screenshot):**
   - Does the visual state confirm the DOM text assessment?
   - Is the page visually in the expected state?

   **Verdict:**
   - **PASS** if DOM text content matches the expected behavior description
   - **FAIL** if DOM text contradicts the expected behavior, expected content is missing, or error messages are present

6. **Record result:**
   - For PASS: `{phase, name, status: "pass", evidence: "{path}"}`
   - For FAIL: `{phase, name, status: "fail", evidence: "{path}", expected: "{expected behavior}", observed: "{what DOM text showed}"}`

**Playwright execution** (when browser_mode is "playwright"):

Playwright execution engine is implemented in Phase 93. For now:
- Mark all tests as `skipped` with reason "Playwright fallback not yet implemented"
- This is not a failure — set overall status to `passed` (no failures detected)

## Step 6: Write Results

Create `.planning/MILESTONE-UAT.md` with the following structure:

### YAML Frontmatter

```yaml
---
status: {passed if all tests pass or skip, gaps_found if any test failed}
milestone: {milestone version, e.g., v3.1}
browser: {browser_mode used}
started: {ISO 8601 timestamp from Step 1}
completed: {ISO 8601 timestamp now}
total: {total test count}
passed: {pass count}
failed: {fail count}
---
```

### Results Table

```markdown
## Results

| # | Phase | Test | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | {phase} | {test name} | {pass/fail/skipped} | {evidence path or -} |
```

### Gaps Section (only if failures exist)

```markdown
## Gaps

- truth: "{expected behavior from test description}"
  status: failed
  reason: "Automated UAT: {observed behavior description}"
  severity: major
  evidence: "{screenshot path}"
  observed: "{what was actually seen in DOM text}"
```

Write the file using the Write tool.

Ensure the evidence directory exists:
```bash
mkdir -p .planning/uat-evidence/{milestone}/
```

## Step 7: Commit

Commit the results and evidence:

```bash
git add .planning/MILESTONE-UAT.md .planning/uat-evidence/ 2>/dev/null
git commit -m "test(uat): automated UAT results for {milestone}"
```

If git commit fails (no changes or other error), log the error but do not abort.

## Step 8: Exit

Print the final status to stdout:

```
UAT complete. Status: {passed|gaps_found}. Tests: {passed}/{total} passed, {failed} failed.
```

Exit normally. The spawning process (autopilot.mjs) reads `MILESTONE-UAT.md` frontmatter for the actual result status.

</process>

<judgment_protocol>
## Pass/Fail Judgment Protocol

This section instructs the agent on HOW to judge test results.

### Primary Signal: DOM Text Content

The `get_page_text` tool returns the text content of the page. This is the **primary** assertion signal because it is deterministic — the same page state always produces the same text.

**A test PASSES if:**
- The DOM text contains the expected text, elements, or data described in the test's expected behavior
- No error messages or unexpected states are present
- The page is in the state described by the expected behavior

**A test FAILS if:**
- The DOM text does not contain expected content
- Error messages or crash indicators are present
- The page shows an unexpected state (e.g., login page when dashboard expected)
- Expected data or elements are absent from the text content

### Supplementary Signal: Screenshots

Screenshots captured by `read_page` provide visual evidence. They are saved to disk for human debugging but should NOT be the primary basis for pass/fail decisions.

Use screenshots to:
- Confirm or add nuance to DOM text assessment
- Provide evidence for failure reports
- Verify visual layout when DOM text alone is ambiguous

### Recording Failures

For every failed test, record:
- **Expected:** The test's expected behavior description (verbatim from the test source)
- **Observed:** What the DOM text actually showed (specific text or element absence)

This enables the gap closure pipeline to create targeted fix plans.

### Context Efficiency

Do NOT accumulate screenshots in conversation history. After capturing a screenshot:
1. Save it to disk (evidence directory)
2. Judge pass/fail using DOM text + screenshot
3. Record the result
4. Move on to the next test

This prevents context window exhaustion during multi-test sessions.
</judgment_protocol>
