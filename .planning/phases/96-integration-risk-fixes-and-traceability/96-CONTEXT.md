# Phase 96: Integration Risk Fixes and Traceability Cleanup - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Close integration risks from the v3.1 milestone audit and clean up tech debt: fix the allowed-tools whitelist in the uat-auto command spec, add uat-evidence to .gitignore, check all 20 unchecked requirement checkboxes in REQUIREMENTS.md, add `requirements-completed` frontmatter to SUMMARY.md files for phases 91-94, and update stale Chrome MCP tool names in REQUIREMENTS.md. This is a gap closure phase -- no new features, only corrections to existing artifacts.

</domain>

<decisions>
## Implementation Decisions

### Allowed-Tools Fix (CMCP-01-05)
- Add all 9 `mcp__claude-in-chrome__*` tools to the `allowed-tools` list in `commands/gsd/uat-auto.md`
- Tools to add: `mcp__claude-in-chrome__tabs_context_mcp`, `mcp__claude-in-chrome__tabs_create_mcp`, `mcp__claude-in-chrome__navigate`, `mcp__claude-in-chrome__computer`, `mcp__claude-in-chrome__form_input`, `mcp__claude-in-chrome__shortcuts_execute`, `mcp__claude-in-chrome__read_page`, `mcp__claude-in-chrome__get_page_text`, `mcp__claude-in-chrome__find`
- Keep existing tools (Read, Glob, Grep, Bash, Write) -- append Chrome MCP tools after them

### Gitignore Fix (EVID-01, EVID-04)
- Add `.planning/uat-evidence/` entry to `.gitignore`
- Place it under a `# UAT evidence screenshots` comment (Claude's Decision: grouped with a comment follows the existing .gitignore style which uses section comments)

### REQUIREMENTS.md Checkbox Updates
- Check all 20 unchecked requirement checkboxes: DISC-01, DISC-02, CMCP-01-05, EVID-01-04, WKFL-01-04, AUTO-01-05
- Add `*(Phase NN)*` annotation to each newly-checked checkbox matching the traceability table
- All 20 have been verified as satisfied by the milestone audit (3-source cross-reference in v3.1-MILESTONE-AUDIT.md)

### REQUIREMENTS.md Tool Name Updates
- Replace stale `chrome_navigate` with `mcp__claude-in-chrome__navigate` in CMCP-01
- Replace stale `chrome_click_element`, `chrome_fill_or_select`, `chrome_keyboard` with `mcp__claude-in-chrome__computer`, `mcp__claude-in-chrome__form_input`, `mcp__claude-in-chrome__shortcuts_execute` in CMCP-02
- Replace stale `chrome_screenshot` with `mcp__claude-in-chrome__read_page` and `chrome_get_web_content` with `mcp__claude-in-chrome__get_page_text` in CMCP-03
- Replace stale `tabs_context_mcp` with `mcp__claude-in-chrome__tabs_context_mcp` in CMCP-05 (Claude's Decision: the probe tool also uses the namespaced format per the actual workflow implementation)

### SUMMARY.md Frontmatter Updates (Phases 91-94)
- Add `requirements-completed` field to SUMMARY.md files that are missing it
- Phase 91-01 (91-01-SUMMARY.md): add `requirements-completed: [CFG-01, CFG-02]` (Claude's Decision: 91-01 delivers uat.cjs config validation covering CFG-01 and CFG-02)
- Phase 91-02 (91-02-SUMMARY.md): add `requirements-completed: [CFG-03]` (Claude's Decision: 91-02 delivers MILESTONE-UAT.md template and command spec covering CFG-03)
- Phase 92-01 (92-01-SUMMARY.md): add `requirements-completed: [DISC-01, DISC-02, CMCP-01, CMCP-02, CMCP-03, CMCP-04, CMCP-05, WKFL-01, WKFL-02, WKFL-04]`
- Phase 93-01 (93-01-SUMMARY.md): add `requirements-completed: [PWRT-01, PWRT-02, PWRT-03, PWRT-04]`
- Phase 94-01 and 94-02 already have `requirements-completed` frontmatter -- no changes needed

### Traceability Table Update
- Update REQUIREMENTS.md traceability table: change all 20 unchecked requirement statuses from `Pending` to `Complete` (Claude's Decision: the traceability table should reflect the same checked status as the checkboxes for consistency)

### Claude's Discretion
- Exact ordering of Chrome MCP tools in the allowed-tools list
- Exact placement of uat-evidence entry within .gitignore
- Whether to add `status: complete` to SUMMARY frontmatter if missing (not required by success criteria)

</decisions>

<specifics>
## Specific Ideas

**Chrome MCP tools used by uat-auto.md workflow (from source grep):**
1. `mcp__claude-in-chrome__tabs_context_mcp` -- connectivity probe
2. `mcp__claude-in-chrome__tabs_create_mcp` -- new tab creation
3. `mcp__claude-in-chrome__navigate` -- page navigation
4. `mcp__claude-in-chrome__computer` -- click, type, mouse events
5. `mcp__claude-in-chrome__form_input` -- form field interaction
6. `mcp__claude-in-chrome__shortcuts_execute` -- keyboard shortcuts
7. `mcp__claude-in-chrome__read_page` -- screenshot capture
8. `mcp__claude-in-chrome__get_page_text` -- DOM text extraction
9. `mcp__claude-in-chrome__find` -- element discovery

**REQUIREMENTS.md stale tool name mapping (from audit):**
- `chrome_navigate` -> `mcp__claude-in-chrome__navigate`
- `chrome_click_element` -> `mcp__claude-in-chrome__computer`
- `chrome_fill_or_select` -> `mcp__claude-in-chrome__form_input`
- `chrome_keyboard` -> `mcp__claude-in-chrome__shortcuts_execute`
- `chrome_screenshot` -> `mcp__claude-in-chrome__read_page`
- `chrome_get_web_content` -> `mcp__claude-in-chrome__get_page_text`
- `tabs_context_mcp` -> `mcp__claude-in-chrome__tabs_context_mcp`

**SUMMARY.md files needing frontmatter:**
- `.planning/phases/91-foundation/91-01-SUMMARY.md` -- missing `requirements-completed`
- `.planning/phases/91-foundation/91-02-SUMMARY.md` -- missing `requirements-completed`
- `.planning/phases/92-chrome-mcp-engine-and-test-discovery/92-01-SUMMARY.md` -- missing `requirements-completed`
- `.planning/phases/93-playwright-fallback-engine/93-01-SUMMARY.md` -- missing `requirements-completed`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commands/gsd/uat-auto.md`: Command spec with YAML frontmatter -- edit the `allowed-tools` list in-place
- `.gitignore`: Project gitignore at repo root -- append uat-evidence entry
- `.planning/REQUIREMENTS.md`: Requirements file with checkbox syntax and traceability table
- `.planning/phases/91-foundation/91-01-SUMMARY.md`, `91-02-SUMMARY.md`: SUMMARY files missing `requirements-completed`
- `.planning/phases/92-chrome-mcp-engine-and-test-discovery/92-01-SUMMARY.md`: SUMMARY file missing `requirements-completed`
- `.planning/phases/93-playwright-fallback-engine/93-01-SUMMARY.md`: SUMMARY file missing `requirements-completed`

### Established Patterns
- **SUMMARY frontmatter `requirements-completed` field**: Phase 94 SUMMARY files demonstrate the format -- a YAML array of requirement IDs (e.g., `requirements-completed: [AUTO-01, AUTO-02]`)
- **Checkbox syntax in REQUIREMENTS.md**: `- [x] **REQ-ID**: Description *(Phase NN)*` for checked items
- **allowed-tools as YAML list**: Command spec uses YAML list format with one tool per line prefixed with `  - `
- **.gitignore comments**: Existing gitignore uses `# Section name` comments to group related entries

### Integration Points
- `commands/gsd/uat-auto.md` line 5-10: YAML `allowed-tools` list to extend
- `.gitignore`: Append new entry at end
- `.planning/REQUIREMENTS.md` lines 18-56: Checkbox section with 20 unchecked items
- `.planning/REQUIREMENTS.md` lines 93-121: Traceability table with Pending statuses
- SUMMARY.md files: YAML frontmatter blocks to extend with `requirements-completed`

</code_context>

<deferred>
## Deferred Ideas

- **Test suite consolidation** -- Phase 97 handles retiring subsumed tests, pruning duplicates, and parameterizing routing tests
- **REQUIREMENTS.md traceability table status automation** -- could be computed from SUMMARY frontmatter rather than manually maintained
- **Phase 82 missing VERIFICATION.md and SUMMARY.md** -- known tech debt from v2.9, not in scope for v3.1

</deferred>

---

*Phase: 96-integration-risk-fixes-and-traceability*
*Context gathered: 2026-03-22 via auto-context*
