# Phase 95: Documentation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can discover and understand the automated UAT capability through updated documentation. This phase updates three documentation files (help.md, USER-GUIDE.md, README.md) to include the `/gsd:uat-auto` command and automated UAT usage guidance. No code changes -- documentation only.

</domain>

<decisions>
## Implementation Decisions

### help.md Update (DOCS-01)
- Add `/gsd:uat-auto` entry to the help.md workflow file at `get-shit-done/workflows/help.md`
- Place entry under a new "### Automated UAT" subsection within the existing "### User Acceptance Testing" area
- Include command description, arguments (milestone version), and flags (none currently defined)
- Follow the exact format pattern used by other command entries in help.md (bold command name, description paragraph, usage example, result line)

### USER-GUIDE.md Update (DOCS-02)
- Add an "Automated UAT" section to `docs/USER-GUIDE.md` after the existing "UI Testing (Playwright)" section
- Cover all four topics specified by the success criteria: configuration (`uat-config.yaml`), test discovery (UAT.md scanning + SUMMARY.md fallback), browser engines (Chrome MCP primary, Playwright fallback), and pipeline integration (autopilot triggers UAT after audit)
- Include a workflow diagram showing the UAT pipeline flow (Claude's Decision: workflow diagrams are the established pattern in USER-GUIDE.md for explaining multi-step processes)
- Add `uat-config.yaml` schema reference with all fields documented in a table (Claude's Decision: follows the config.json schema table pattern already established in USER-GUIDE.md)
- Add `/gsd:uat-auto` to the "Brownfield & Utilities" command reference table
- Add an "Automated UAT" example subsection under "Usage Examples" showing common invocations

### README.md Update (DOCS-03)
- Add `/gsd:uat-auto` row to the Commands table in `README.md`
- Place after the existing `/gsd:ui-test` entry (Claude's Decision: groups testing-related commands together)
- Description should be concise: "Run automated UAT session (Chrome MCP + Playwright fallback)"

### Claude's Discretion
- Exact wording of the USER-GUIDE section prose
- Whether to add a troubleshooting entry for UAT-related issues
- Order of subsections within the Automated UAT guide

</decisions>

<specifics>
## Specific Ideas

**uat-config.yaml fields (from Phase 91 CFG-01):**
- `base_url` (string, required) -- URL of the app to test
- `startup_command` (string, optional) -- Command to start the dev server
- `startup_wait_seconds` (integer, optional, default 10) -- Seconds to wait for server startup
- `browser` (string, optional, default "chrome-mcp") -- Primary browser engine
- `fallback_browser` (string, optional, default "playwright") -- Fallback browser engine
- `timeout_minutes` (integer, optional, default 10) -- Max session duration

**Test discovery modes (from Phase 92 DISC-01/02):**
1. Scan phase directories for `*-UAT.md` files with `status: complete`
2. Fall back to generating test scenarios from SUMMARY.md files across milestone phases

**Browser engine selection (from Phase 92/93):**
- Chrome MCP is primary -- uses `chrome_navigate`, `chrome_click_element`, `chrome_fill_or_select`, `chrome_screenshot`, `chrome_get_web_content`
- Playwright is fallback when Chrome MCP probe fails -- ephemeral inline scripts, headless Chromium
- Probe is a full round-trip (not just `tabs_context_mcp`) to verify actual availability

**Autopilot integration (from Phase 94):**
- `runAutomatedUAT()` triggers after milestone audit passes, before completion
- UAT pass proceeds to `runMilestoneCompletion()`
- UAT gaps feed into `runGapClosureLoop()`
- Non-web projects skip UAT silently (no `uat-config.yaml`)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/help.md`: Command reference file -- add new entry following existing format
- `docs/USER-GUIDE.md`: Full user guide -- add section following established patterns (workflow diagrams, config tables, examples)
- `README.md`: Minimal quick-start README -- add row to command table

### Established Patterns
- **help.md command format**: Bold command name, paragraph description, bullet list of features, Usage line, Result line
- **USER-GUIDE.md section format**: H2 heading, prose intro, workflow diagram (ASCII art), config table, flags table, examples with code blocks
- **README.md command table**: Two-column markdown table (Command | What it does) with concise one-line descriptions
- **Prior documentation phases**: Phase 23 (Linear docs), Phase 28 (Brainstorm docs), Phase 34 (Test Architecture docs), Phase 44 (PR Review docs), Phase 81 (Test Review docs), Phase 87 (Linear Interview docs) -- all follow the same 3-file pattern

### Integration Points
- help.md line ~300: User Acceptance Testing section -- insert new subsection
- USER-GUIDE.md line ~260: After "UI Testing (Playwright)" section -- insert new section
- USER-GUIDE.md line ~362: Command reference table -- add new row
- README.md line ~88: Commands table -- add new row

</code_context>

<deferred>
## Deferred Ideas

- **Phase-level automated UAT docs (PLVL-01/02)** -- v2 requirement, document when implemented
- **UAT result trending docs (TRND-01)** -- v2 requirement, document when implemented
- **uat-config.yaml advanced configuration guide** -- current scope covers the basics; advanced patterns deferred

</deferred>

---

*Phase: 95-documentation*
*Context gathered: 2026-03-22 via auto-context*
