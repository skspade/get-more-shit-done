# Phase 88: Fix Step 5→6 Routing - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Fix the Step 5 (hybrid output) exit paths in `linear.md` that incorrectly skip Step 6 (pre-execution comment-back) and jump directly to Step 7 (write linear-context.md). Three locations in Step 5 say "Continue to Step 7" or "Proceed to Step 7" when they should say "Continue to Step 6". This is a gap closure phase -- the routing logic and comment-back code already exist, but the control flow text bypasses Step 6 entirely.

</domain>

<decisions>
## Implementation Decisions

### Step 5 Exit Path Fixes
- Line 353: Quick route "Yes, proceed" says "Continue to Step 7" -- change to "Continue to Step 6" (from ROADMAP success criteria 1: all Step 5 exit paths route to Step 6)
- Line 374: Quick route "Cancel -- proceed as-is" says "Continue to Step 7" -- change to "Continue to Step 6" (from ROADMAP success criteria 1)
- Line 474: Milestone route approach selected says "Proceed to Step 7" -- change to "Proceed to Step 6" (from ROADMAP success criteria 1)
- Pre-execution comment (Step 6) is posted to Linear before execution starts (from REQUIREMENTS.md CMNT-01)
- Tickets receive two comments total: pre-execution (Step 6) and post-execution (Step 9) (from REQUIREMENTS.md CMNT-04)

### Scope Constraint
- Only the `get-shit-done/workflows/linear.md` file is modified (Claude's Decision: the bug is three incorrect step references in one file -- no other files are affected)
- Step 6 implementation is already correct and complete -- only the references pointing past it need fixing (Claude's Decision: Step 6 code at lines 490-547 already handles pre-execution comment-back with non-blocking MCP pattern)
- No changes to success criteria needed -- they already reference CMNT-01 and CMNT-04 implicitly through the step structure (Claude's Decision: success criteria at lines 994-1022 do not explicitly mention Step 6 routing, but fixing the step references is sufficient to satisfy the requirements)

### Claude's Discretion
- Whether to add a success criteria line explicitly mentioning Step 5→6→7 flow
- Exact wording of the step transition text (e.g., "Continue to Step 6" vs "Proceed to Step 6")

</decisions>

<specifics>
## Specific Ideas

**Three exit paths that need fixing (from codebase inspection):**

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
- `get-shit-done/workflows/linear.md` Step 6 (lines 490-547): Pre-execution comment-back is fully implemented with route-aware comment body templates and non-blocking MCP error handling. No code needs to be written -- only references to this step need to be unblocked.

### Established Patterns
- **Step transition text**: linear.md uses "Continue to Step N" and "Proceed to Step N" as control flow indicators throughout the workflow. The fix follows this same convention.
- **Non-blocking MCP comment-back**: Step 6 and Step 9 both use the same try/warning pattern for MCP calls. Step 6 is already correctly implemented.

### Integration Points
- **Step 5 -> Step 6**: After hybrid output confirmation (quick) or approach selection (milestone), control should flow to Step 6 for pre-execution comment posting.
- **Step 6 -> Step 7**: After comment-back, control flows to write linear-context.md. This transition is already correct in Step 6's text.
- **Step 9 (post-execution comment-back)**: Remains unchanged -- produces the second of two comments per ticket.

</code_context>

<deferred>
## Deferred Ideas

None -- phase scope is well-defined. This is a three-line text fix in a single file.

</deferred>

---

*Phase: 88-fix-step5-step6-routing*
*Context gathered: 2026-03-22 via auto-context*
