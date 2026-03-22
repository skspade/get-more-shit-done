# Phase 89: Fix Step 5→6 Routing (Actual File Fix) - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Phase 88 was supposed to fix three lines in `~/.claude/get-shit-done/workflows/linear.md` that route Step 5 (hybrid output) exits to Step 7 instead of Step 6 (pre-execution comment-back), but the file was left unchanged. This phase performs the actual three-line text fix so that all Step 5 exit paths flow through Step 6 before reaching Step 7, ensuring the pre-execution comment-back is reachable and the E2E flow is Step 1→2→3→4→5→6→7→8→9→10.

</domain>

<decisions>
## Implementation Decisions

### Line-Level Fixes
- Line 353: change "Continue to Step 7" to "Continue to Step 6" (quick route "Yes, proceed" exit)
- Line 374: change "Continue to Step 7" to "Continue to Step 6" (quick route "Cancel -- proceed as-is" exit)
- Line 474: change "Proceed to Step 7" to "Proceed to Step 6" (milestone route approach selected exit)
- These are the only three locations where Step 5 exits bypass Step 6

### File Scope
- Only `~/.claude/get-shit-done/workflows/linear.md` is modified
- Step 6 (pre-execution comment-back, lines 490-547) is already fully implemented and correct -- only the references pointing past it need fixing (Claude's Decision: verified by reading the file -- Step 6 code is complete with route-aware comment templates and non-blocking MCP error handling)
- No other step transitions need correction -- Step 6 already correctly flows to Step 7 (Claude's Decision: confirmed by grep that no other "Step 7" references exist that should say "Step 6")

### Verification Approach
- After the fix, all Step 5 exit paths must reference Step 6 (from ROADMAP success criteria 1)
- Step 6 must be reachable from all Step 5 exit paths (from ROADMAP success criteria 2)
- E2E flow must include Step 6: Step 1→2→3→4→5→6→7→8→9→10 (from ROADMAP success criteria 3)
- Pre-execution comment is posted to Linear before execution starts (from REQUIREMENTS.md CMNT-01)
- Comment includes goal, scope, criteria, route, and selected approach for milestone route (from REQUIREMENTS.md CMNT-02)
- MCP failure shows warning but does not block execution (from REQUIREMENTS.md CMNT-03)
- Tickets receive two comments total: pre-execution (Step 6) and post-execution (Step 9) (from REQUIREMENTS.md CMNT-04)

### Claude's Discretion
- Whether to preserve exact casing of transition text ("Continue to" vs "Proceed to") at each location
- Whether to add a brief inline comment noting the fix origin

</decisions>

<specifics>
## Specific Ideas

**Three exact edits needed (confirmed by reading the file):**

1. **Line 353** (quick route, "Yes, proceed"):
   - Current: `**If "Yes, proceed":** Continue to Step 7.`
   - Fixed: `**If "Yes, proceed":** Continue to Step 6.`

2. **Line 374** (quick route, "Cancel -- proceed as-is"):
   - Current: `**If "Cancel — proceed as-is":** Continue to Step 7.`
   - Fixed: `**If "Cancel — proceed as-is":** Continue to Step 6.`

3. **Line 474** (milestone route, approach selected):
   - Current: `Proceed to Step 7.`
   - Fixed: `Proceed to Step 6.`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/linear.md` Step 6 (lines 490-547): Pre-execution comment-back is fully implemented with route-aware comment body templates (quick omits "Selected approach", milestone includes it) and non-blocking MCP error handling. No code needs to be written -- only references to this step need to be unblocked.

### Established Patterns
- **Step transition text**: linear.md uses "Continue to Step N" and "Proceed to Step N" as control flow indicators. The fix preserves whichever verb each location currently uses, changing only the step number.
- **Non-blocking MCP comment-back**: Step 6 and Step 9 both use the same try/warning pattern. Step 6 is correctly implemented and ready to receive control flow.

### Integration Points
- **Step 5 -> Step 6**: After hybrid output confirmation (quick) or approach selection (milestone), control flows to Step 6 for pre-execution comment posting. Currently broken by the three "Step 7" references.
- **Step 6 -> Step 7**: After comment-back, control flows to write linear-context.md. This transition is already correct in Step 6's text.
- **Step 9 (post-execution comment-back)**: Unchanged -- produces the second of two comments per ticket.

</code_context>

<deferred>
## Deferred Ideas

- **Phase 90: Traceability and Tech Debt Cleanup** -- REQUIREMENTS.md checkboxes, SUMMARY frontmatter, WKFL-01 step count, Phase 88 VERIFICATION.md correction. Separate phase per ROADMAP.

</deferred>

---

*Phase: 89-fix-step5-step6-routing-actual*
*Context gathered: 2026-03-22 via auto-context*
