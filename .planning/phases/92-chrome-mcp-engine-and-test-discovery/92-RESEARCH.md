# Phase 92: Chrome MCP Engine and Test Discovery - Research

**Researched:** 2026-03-22
**Domain:** Chrome MCP browser automation workflow, UAT test discovery, autonomous workflow design
**Confidence:** HIGH

## Summary

Phase 92 builds the `uat-auto.md` workflow file -- the "brain" of the automated UAT system. It discovers tests from existing UAT.md and SUMMARY.md files, probes Chrome MCP availability with a full round-trip check, executes browser-based tests using Chrome MCP tools, judges pass/fail using DOM content as primary signal, and writes structured results to MILESTONE-UAT.md. The workflow runs as a single agent session (no subagent spawning) and handles both Chrome MCP and Playwright fallback routing internally.

The most critical implementation detail is the Chrome MCP probe: it must be a full round-trip (tabs_context + navigate to base_url + verify response) because tabs_context_mcp alone can return success on stale/disconnected sessions. The second critical detail is using DOM text content as the primary assertion signal (deterministic) with screenshots as supplementary evidence (non-deterministic).

**Primary recommendation:** Build the workflow in clear sequential sections (discover, probe, execute, report) with early-exit on probe failure to the fallback browser mode. Keep the workflow prompt focused on behavioral judgment using DOM content, not visual pixel analysis.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Workflow file at `get-shit-done/workflows/uat-auto.md` -- single agent, no subagent spawning
- Workflow steps: load config, discover tests, detect browser, start app, execute tests, write results, commit, exit
- Fully autonomous -- no user interaction, no checkpoints
- Config loaded via `loadUatConfig()` from `uat.cjs`
- Primary discovery: scan `*-UAT.md` files with `status: complete`
- Fallback discovery: generate test scenarios from SUMMARY.md files
- Navigate via `mcp__claude-in-chrome__navigate`
- Interact via `mcp__claude-in-chrome__computer`, `mcp__claude-in-chrome__form_input`, `mcp__claude-in-chrome__shortcuts_execute`
- Screenshot via `mcp__claude-in-chrome__read_page`
- DOM content via `mcp__claude-in-chrome__get_page_text`
- DOM text content as primary pass/fail signal
- Screenshots saved to `.planning/uat-evidence/{milestone}/{phase}-test-{N}.png`
- Full round-trip probe for Chrome MCP availability
- Probe timeout: 15 seconds
- Wall-clock timeout from `timeout_minutes` config (default 10 min)
- On timeout, write partial results with remaining tests marked `skipped`
- MILESTONE-UAT.md written to `.planning/MILESTONE-UAT.md` with format from Phase 91
- Gaps in markdown body, not YAML frontmatter

### Claude's Discretion
- Exact prompt phrasing for pass/fail judgment
- How to infer page URLs from test descriptions
- Whether to create new tab per test or reuse one tab
- Exact format of test scenario generation from SUMMARY.md
- How much DOM content to capture per test

### Deferred Ideas (OUT OF SCOPE)
- Playwright fallback implementation (Phase 93)
- runAutomatedUAT() in autopilot.mjs (Phase 94)
- plan-milestone-gaps.md modification (Phase 94)
- App startup management with HTTP polling (Phase 94)
- Evidence git strategy (Phase 94/95)
- Documentation (Phase 95)
- Per-test retry before failure
- Confidence scoring on verdicts
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DISC-01 | Discover UAT tests by scanning phase directories for `*-UAT.md` files with status:complete | Glob + Read tool pattern; frontmatter parsing via extractFrontmatter or grep |
| DISC-02 | Fallback: generate test scenarios from SUMMARY.md files when no UAT.md exists | SUMMARY.md key behaviors extraction; BLOCKED pattern from v2.7 if no testable content |
| CMCP-01 | Navigate to pages using Chrome MCP chrome_navigate | `mcp__claude-in-chrome__navigate` tool |
| CMCP-02 | Interact with elements via click, fill, keyboard | `mcp__claude-in-chrome__computer`, `form_input`, `shortcuts_execute` tools |
| CMCP-03 | Capture screenshots and read DOM content | `mcp__claude-in-chrome__read_page` (screenshot), `get_page_text` (DOM) |
| CMCP-04 | Judge pass/fail by comparing observed DOM state against expected behavior | DOM text matching as primary signal; structured judgment protocol in workflow prompt |
| CMCP-05 | Chrome MCP availability verified via full round-trip probe, fallback on failure | tabs_context_mcp + navigate to base_url; 15s timeout; set fallback mode on failure |
| WKFL-01 | Workflow orchestrates full pipeline: config, discover, detect, start, execute, write, commit, exit | Single workflow file with sequential steps and early-exit branches |
| WKFL-02 | Workflow is fully autonomous -- no user interaction | No AskUserQuestion, no checkpoints; matches audit-milestone.md pattern |
| WKFL-04 | Configurable timeout prevents stuck sessions | Wall-clock limit via Date.now() tracking; partial results on timeout |
</phase_requirements>

## Standard Stack

### Core

| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Chrome MCP (claude-in-chrome) | N/A (MCP server) | Primary browser engine | Already available as MCP tools in the Claude session; no install needed |
| js-yaml | ^4.1.1 | Config parsing | Already installed in Phase 91; used by uat.cjs |
| Node.js built-in fs/path | N/A | File I/O | Standard for reading UAT.md, SUMMARY.md, writing MILESTONE-UAT.md |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `mcp__claude-in-chrome__tabs_context_mcp` | Probe Chrome MCP connectivity | First step of browser detection |
| `mcp__claude-in-chrome__tabs_create_mcp` | Create new tab for testing | Session setup after probe passes |
| `mcp__claude-in-chrome__navigate` | Navigate to test URLs | Per-test navigation |
| `mcp__claude-in-chrome__get_page_text` | Extract DOM text content | Primary assertion signal |
| `mcp__claude-in-chrome__read_page` | Capture screenshot | Evidence and supplementary judgment |
| `mcp__claude-in-chrome__computer` | Click elements, type text | Test interaction |
| `mcp__claude-in-chrome__form_input` | Fill form fields | Form-based test interactions |

### Not Adding

No new npm dependencies for Phase 92. The workflow file is a markdown prompt -- it uses MCP tools and existing modules.

## Architecture Patterns

### Pattern 1: Single-Agent Workflow with Internal Branching

**What:** The workflow handles both Chrome MCP and Playwright paths in one agent session. Browser mode is detected early, and subsequent steps branch based on the detected mode.

**Why:** Subagent-cannot-spawn-subagent constraint (PROJECT.md). The workflow is spawned as a subagent by autopilot.mjs.

**Structure:**
```
Step 1: Load config (always)
Step 2: Discover tests (always)
Step 3: Probe Chrome MCP
  -> Success: set mode = chrome-mcp
  -> Failure: set mode = fallback_browser from config
Step 4: Start app if needed (always)
Step 5: Execute tests using detected mode
  -> chrome-mcp: use MCP tools directly
  -> playwright: use Bash to run inline scripts (Phase 93 implements)
Step 6: Write MILESTONE-UAT.md (always)
Step 7: Commit and exit (always)
```

### Pattern 2: Frontmatter-Based Test Discovery

**What:** Scan for `*-UAT.md` files, read YAML frontmatter, filter by `status: complete`.

**Example discovery flow:**
```
1. Glob: .planning/phases/*/ for *-UAT.md files
2. Read each file's frontmatter
3. Filter: status == "complete"
4. Parse test entries from body (test name + expected behavior)
5. Return structured list: [{phase, name, expected, url_hint}]
```

### Pattern 3: DOM-First Assertion Protocol

**What:** Use `get_page_text` output as the primary pass/fail signal. The text content of the page is compared against the expected behavior description. Screenshots provide visual evidence but do not drive the verdict.

**Why:** DOM text comparison is deterministic -- same page state always produces same text. Screenshot interpretation is non-deterministic (Pitfall 2 from research). This reduces false failures from AI judgment variance.

### Anti-Patterns to Avoid

- **Spawning subagents from within the workflow** -- violates fundamental constraint
- **Using screenshot-only judgment** -- non-deterministic, leads to phantom failures
- **Accumulating screenshots in conversation context** -- exhausts context window (Pitfall 10)
- **Fixed wait for app startup** -- race condition anti-pattern; use HTTP fetch check instead

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML config parsing | Custom parser | js-yaml via uat.cjs loadUatConfig() | Already built in Phase 91 |
| YAML frontmatter extraction | Manual regex | extractFrontmatter from frontmatter.cjs | Established pattern |
| Browser automation | Custom WebSocket/CDP | Chrome MCP tools (navigate, click, etc.) | MCP integration already available |
| File discovery | Manual fs.readdir | Glob tool | Standard GSD pattern |

## Common Pitfalls

### Pitfall 1: Chrome MCP Probe False Positives (CRITICAL)

**What goes wrong:** `tabs_context_mcp` succeeds but Chrome session is stale/disconnected. All subsequent Chrome MCP calls fail silently.
**Why it happens:** Chrome MCP availability is not binary. Browser tab may be closed, extension disconnected, or routed to wrong machine.
**How to avoid:** Full round-trip probe: tabs_context_mcp -> navigate to base_url -> verify page loads. Only then confirm Chrome MCP is working.
**Warning signs:** All Chrome MCP tests fail with timeout/connection errors while probe reported success.

### Pitfall 2: Non-Deterministic AI Judgment (CRITICAL)

**What goes wrong:** Same page state produces different pass/fail verdicts across runs.
**Why it happens:** LLM inference is stochastic. Natural language expected behaviors have ambiguous thresholds.
**How to avoid:** DOM text content as primary signal (deterministic). Structured judgment output. Explicit failure criteria in workflow prompt.
**Warning signs:** UAT results flip between runs with no code changes.

### Pitfall 3: Context Window Exhaustion (MODERATE)

**What goes wrong:** Processing 12+ tests in one session fills the context window. Screenshots consume significant tokens as multimodal input.
**Why it happens:** Each test involves navigation, DOM extraction, screenshot capture, and judgment. Token consumption is cumulative.
**How to avoid:** Minimize DOM capture (targeted elements, not full page). Do not accumulate screenshots in conversation -- save to disk, judge, move on. Keep workflow prompt compact.
**Warning signs:** Agent slows down or loses context for later tests.

### Pitfall 4: Zero-Test Discovery (MODERATE)

**What goes wrong:** No UAT.md files exist and SUMMARY.md fallback generates irrelevant tests.
**Why it happens:** Infrastructure-only milestones have no UI changes. SUMMARY.md extraction may find no testable behaviors.
**How to avoid:** When zero tests are discovered from both sources, exit early with status "passed" and a note that no UAT-testable changes were found. Do not fabricate tests.
**Warning signs:** Tests have generic descriptions unrelated to actual UI behavior.

## Code Examples

### Workflow Structure (uat-auto.md)

The workflow is a markdown prompt file following the audit-milestone.md pattern:

```markdown
---
(no frontmatter needed -- this is a workflow prompt)
---

<purpose>
Execute automated UAT tests against a live web application.
</purpose>

<process>
Step 1: Load config
Step 2: Discover tests
Step 3: Probe browser
Step 4: Start app
Step 5: Execute tests
Step 6: Write results
Step 7: Commit
Step 8: Exit
</process>
```

### Test Discovery from UAT.md

```
# Pattern: Glob for *-UAT.md, read frontmatter, extract tests
1. Glob: .planning/phases/**/*-UAT.md
2. For each file:
   a. Read file content
   b. Check frontmatter status == "complete"
   c. Parse body for test entries (## Tests section)
   d. Extract: test name, expected behavior, page/URL hint
3. Return test list
```

### Chrome MCP Probe Sequence

```
1. Call mcp__claude-in-chrome__tabs_context_mcp
   -> If error/timeout: Chrome MCP unavailable, use fallback
2. Call mcp__claude-in-chrome__navigate with base_url
   -> If error/timeout: Chrome MCP unstable, use fallback
3. Call mcp__claude-in-chrome__get_page_text
   -> If returns content: Chrome MCP confirmed working
   -> If error: Chrome MCP unstable, use fallback
```

### Pass/Fail Judgment Protocol

```
For each test:
1. Navigate to relevant page
2. Perform described interactions (click, fill, etc.)
3. Read DOM text via get_page_text
4. Capture screenshot via read_page (save to evidence dir)
5. Compare DOM text against expected behavior:
   - Does the page contain expected text/elements?
   - Are error messages absent?
   - Does the state match the expected outcome?
6. Record: pass (DOM matches expected) or fail (DOM contradicts expected)
7. For failures: record observed vs expected description
```

## Open Questions

1. **Chrome MCP tool exact names and parameters**
   - What we know: Tools are prefixed `mcp__claude-in-chrome__`. Available tools include navigate, computer, form_input, read_page, get_page_text, tabs_context_mcp, tabs_create_mcp.
   - What's unclear: Exact parameter schemas for each tool (parameter names, types, required vs optional).
   - Recommendation: The workflow agent will discover parameters at runtime -- MCP tools are self-describing. No hardcoding of parameters in the workflow prompt.

2. **SUMMARY.md fallback test generation quality**
   - What we know: SUMMARY.md files describe what was built and key behaviors.
   - What's unclear: How reliably useful AI-generated test scenarios from SUMMARY.md will be.
   - Recommendation: Implement but with a quality gate -- if generated scenarios are too vague (no specific page or action), skip them rather than running meaningless tests.

## Sources

### Primary (HIGH confidence)
- `.planning/research/SUMMARY.md` -- Project-level research for v3.1 milestone
- `.planning/research/ARCHITECTURE.md` -- Component boundaries and data flow
- `.planning/research/PITFALLS.md` -- Critical and moderate pitfalls
- `.planning/research/FEATURES.md` -- Feature dependencies and anti-features
- `.planning/designs/2026-03-22-automated-uat-session-design.md` -- Approved design specification
- `.planning/phases/92-chrome-mcp-engine-and-test-discovery/92-CONTEXT.md` -- Phase context decisions

### Secondary (MEDIUM confidence)
- [Chrome DevTools MCP blog](https://developer.chrome.com/blog/chrome-devtools-mcp) -- Tool capabilities
- [Claude Chrome docs](https://code.claude.com/docs/en/chrome) -- Context consumption with browser tools
- [GitHub issue #27492](https://github.com/anthropics/claude-code/issues/27492) -- Chrome MCP connection instability

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already available, no new dependencies
- Architecture: HIGH -- follows established single-agent workflow pattern
- Pitfalls: HIGH -- Chrome MCP instability confirmed by multiple sources

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days -- stable domain, no fast-moving dependencies)

---
*Phase 92 research derived from project-level research (SUMMARY.md, ARCHITECTURE.md, PITFALLS.md, FEATURES.md)*
