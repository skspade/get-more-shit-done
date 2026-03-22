# Phase 92: Chrome MCP Engine and Test Discovery - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The uat-auto.md workflow can discover tests and execute them against a live web application using Chrome MCP as the primary browser engine. This phase delivers the workflow file, the test discovery logic (from UAT.md and SUMMARY.md files), the Chrome MCP execution engine (navigate, interact, screenshot, judge), the Chrome MCP availability probe with Playwright fallback routing, and the session timeout mechanism. No Playwright fallback implementation (Phase 93), no autopilot wiring (Phase 94), no documentation (Phase 95).

</domain>

<decisions>
## Implementation Decisions

### Workflow File Structure (WKFL-01, WKFL-02)
- Workflow file at `get-shit-done/workflows/uat-auto.md` — single agent, no subagent spawning (subagent cannot spawn subagent constraint)
- Workflow steps in order: load config, discover tests, detect browser, start app, execute tests, write results, commit, exit
- Workflow is fully autonomous — no user interaction, no checkpoints, no AskUserQuestion calls
- Workflow reads config via `loadUatConfig()` from `uat.cjs` (already implemented in Phase 91)
- Workflow uses allowed tools from command spec: Read, Glob, Grep, Bash, Write (Claude's Decision: matches the command spec contract defined in Phase 91)

### Test Discovery (DISC-01, DISC-02)
- Primary discovery: scan `.planning/phases/*/` for `*-UAT.md` files, filter for `status: complete` in YAML frontmatter
- Fallback discovery: when no UAT.md files exist, generate test scenarios from SUMMARY.md files across milestone phases — extract key behaviors and success criteria as natural language test cases
- Discovery uses Glob + Read tools to find and parse UAT.md/SUMMARY.md files (Claude's Decision: Glob is the idiomatic GSD tool for file discovery; Read parses frontmatter)
- Test cases are collected into a structured list before execution begins — not discovered incrementally during execution (Claude's Decision: batch discovery before execution enables accurate total count for MILESTONE-UAT.md frontmatter and progress tracking)

### Chrome MCP Execution Engine (CMCP-01, CMCP-02, CMCP-03, CMCP-04)
- Navigate to pages using `mcp__claude-in-chrome__navigate` tool (Chrome MCP navigate)
- Interact with elements via `mcp__claude-in-chrome__computer` (click, type), `mcp__claude-in-chrome__form_input` (fill forms), and `mcp__claude-in-chrome__shortcuts_execute` (keyboard shortcuts)
- Capture screenshots via `mcp__claude-in-chrome__read_page` and read DOM content via `mcp__claude-in-chrome__get_page_text`
- Pass/fail judgment uses DOM text content as primary signal — deterministic string matching against expected behavior descriptions (Claude's Decision: DOM content is deterministic and reproducible; screenshots are supplementary evidence for human debugging)
- Screenshots saved to `.planning/uat-evidence/{milestone}/{phase}-test-{N}.png` using the convention defined in Phase 91
- Each test is executed sequentially — no parallel test execution (from Out of Scope in REQUIREMENTS.md)

### Chrome MCP Availability Probe (CMCP-05)
- Full round-trip probe: `mcp__claude-in-chrome__tabs_context_mcp` to check connectivity, then `mcp__claude-in-chrome__navigate` to `base_url` and verify page loads (Claude's Decision: full round-trip avoids false-positive detection per research pitfall #1 — tabs_context_mcp alone is insufficient)
- On probe failure, set browser mode to fallback_browser from config (default: "playwright") and proceed — do not abort
- Probe timeout: 15 seconds total for the round-trip (Claude's Decision: generous enough for slow Chrome startup but prevents indefinite blocking)

### Session Timeout (WKFL-04)
- Configurable timeout from `timeout_minutes` in uat-config.yaml (default 10 minutes)
- Timeout is a wall-clock limit on the entire test execution phase — not per-test (Claude's Decision: per-test timeout adds complexity; wall-clock limit is simpler and prevents stuck sessions regardless of cause)
- On timeout, write partial results to MILESTONE-UAT.md with whatever tests completed, mark remaining as `skipped` (Claude's Decision: partial results are more useful than no results; gap closure can address incomplete tests)

### App Startup (WKFL-01)
- Before executing tests, check if app is running by fetching `base_url` (Claude's Decision: HTTP fetch is the simplest reliable check — if it returns any response, app is up)
- If app is not running and `startup_command` is configured, start it via Bash in background and wait `startup_wait_seconds`
- If no `startup_command` and app is not running, abort with descriptive error (Claude's Decision: can't test an app that isn't running and have no way to start it)

### Results Writing
- Write MILESTONE-UAT.md to `.planning/MILESTONE-UAT.md` using the format defined in Phase 91 (YAML frontmatter with status, counts, browser, timestamps + results table + gaps section)
- Gaps section uses the four core fields: `truth`, `status`, `reason`, `severity` — with additive `evidence` and `observed` fields
- Gaps stored in markdown body, not YAML frontmatter (per Phase 91 decision to avoid extractFrontmatter nested array limitation)
- Commit MILESTONE-UAT.md and evidence directory after writing

### Claude's Discretion
- Exact prompt phrasing for the pass/fail judgment instruction within the workflow
- How to infer page URLs from test descriptions when not explicitly stated
- Whether to create a new browser tab per test or reuse one tab for all tests
- Exact format of test scenario generation from SUMMARY.md when no UAT.md files exist
- How much DOM content to capture per test (full page vs targeted section)

</decisions>

<specifics>
## Specific Ideas

**Chrome MCP tool mapping (from design doc):**
- Navigate: `mcp__claude-in-chrome__navigate` (receives URL)
- Click/interact: `mcp__claude-in-chrome__computer` (mouse events), `mcp__claude-in-chrome__form_input` (form fields)
- Screenshot: `mcp__claude-in-chrome__read_page` (captures page state)
- DOM content: `mcp__claude-in-chrome__get_page_text` (text extraction for assertion)
- Tab management: `mcp__claude-in-chrome__tabs_context_mcp` (probe), `mcp__claude-in-chrome__tabs_create_mcp` (new tab)

**Test discovery pattern:**
```
1. Glob: .planning/phases/*/ *-UAT.md
2. For each: Read frontmatter, check status == complete
3. Parse test entries from UAT.md body
4. If zero tests found: Glob SUMMARY.md files, extract behaviors as test scenarios
5. Return structured test list: [{phase, name, expected_behavior, url_hint}]
```

**Pass/fail judgment pattern (from research):**
- Read DOM text content via `get_page_text`
- Compare observed DOM state against expected behavior description
- Use screenshot as supplementary evidence
- DOM match = pass; DOM mismatch = fail with `observed` field describing what was actually seen

**Timeout enforcement:** The workflow itself tracks elapsed time and stops executing new tests once timeout is reached. This is simpler than an external timer.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/uat.cjs`: `loadUatConfig()` and `validateUatConfig()` — loads and validates uat-config.yaml, returns structured config object or null (skip signal). Created in Phase 91.
- `get-shit-done/bin/lib/frontmatter.cjs`: YAML frontmatter extraction for reading UAT.md `status: complete` during test discovery.
- `commands/gsd/uat-auto.md`: Command spec already created in Phase 91 — defines the contract (allowed tools, delegation to workflow file).
- `get-shit-done/workflows/audit-milestone.md`: Pattern for a milestone-level workflow that writes a results artifact (MILESTONE-AUDIT.md) with YAML frontmatter status. MILESTONE-UAT.md follows the same pattern.

### Established Patterns
- **Single-agent workflow**: The workflow file is executed as a single Claude session with tool access — no Task() spawning. Follows the same pattern as audit-milestone.md.
- **Frontmatter-based result communication**: Write YAML frontmatter with `status: passed | gaps_found`, autopilot reads via `gsd-tools frontmatter get`. Phase 94 wires this; Phase 92 just writes the file.
- **Evidence directory convention**: `.planning/uat-evidence/{milestone}/` with `{phase}-test-{N}.png` naming (defined in Phase 91 CONTEXT.md).
- **Chrome MCP tool names**: All Chrome MCP tools are prefixed with `mcp__claude-in-chrome__` — this is the MCP namespace for the Chrome DevTools integration.

### Integration Points
- `get-shit-done/workflows/uat-auto.md`: New file created in this phase — the main deliverable.
- `.planning/MILESTONE-UAT.md`: Results artifact written by the workflow.
- `.planning/uat-evidence/{milestone}/`: Screenshot directory written by the workflow.
- `get-shit-done/bin/lib/uat.cjs`: Consumed by the workflow for config loading (already exists).

</code_context>

<deferred>
## Deferred Ideas

- **Playwright fallback implementation** — Phase 93 builds the actual Playwright execution engine
- **runAutomatedUAT() in autopilot.mjs** — Phase 94 wires the workflow into the autopilot pipeline
- **plan-milestone-gaps.md modification** — Phase 94 makes gap closure recognize MILESTONE-UAT.md
- **App startup management with HTTP polling** — Phase 94 handles robust startup (HTTP polling vs fixed wait)
- **Evidence git strategy** — Phase 94/95 decides whether screenshots go in .gitignore or are committed
- **Documentation** — Phase 95
- **Per-test retry before failure** — Research suggested single retry but adds complexity; deferred to gap closure if needed
- **Confidence scoring on verdicts** — Research suggested 1-5 confidence score per judgment; deferred unless non-determinism becomes an issue

</deferred>

---

*Phase: 92-chrome-mcp-engine-and-test-discovery*
*Context gathered: 2026-03-22 via auto-context*
