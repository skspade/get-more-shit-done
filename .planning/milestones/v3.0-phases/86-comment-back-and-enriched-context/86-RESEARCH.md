# Phase 86: Comment-Back and Enriched Context - Research

**Researched:** 2026-03-22
**Domain:** GSD workflow orchestration (linear.md modifications)
**Confidence:** HIGH

## Summary

Phase 86 modifies the existing `linear.md` workflow to add a pre-execution comment-back step (Step 5.5, renumbered to Step 6 after insertion) and enrich three downstream consumers with interview data. The workflow file is a markdown-based orchestration prompt — no compiled code, no external libraries. All changes are insertions and modifications to the existing step structure.

The primary challenge is step renumbering: inserting Step 5.5 (comment-back) between the current Step 5 (hybrid output) and Step 6 (write linear-context.md) causes all subsequent steps to shift by one. Current Steps 6-9 become Steps 7-10. The modifications to Steps 6, 7-quick, and 7-milestone (which become Steps 7, 8-quick, and 8-milestone) must reference the correct step numbers after renumbering.

**Primary recommendation:** Execute as three focused changes: (1) insert comment-back step, (2) enrich linear-context.md and quick route, (3) enrich milestone route. Renumbering happens as part of change 1.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Interview summary posted to Linear ticket via MCP `create_comment` before execution starts (CMNT-01)
- Comment includes goal, scope, criteria, route, and selected approach for milestone route (CMNT-02)
- MCP failure shows warning but does not block execution (CMNT-03)
- Existing post-execution completion comment-back (Step 8) remains unchanged — tickets receive two comments total (CMNT-04)
- Step 5.5 inserted between Step 5 and Step 6, following the design doc's step mapping
- Comment body format differs by route: quick omits "Selected approach", milestone includes it
- Non-blocking error handling reuses exact pattern from existing Step 8 comment-back
- Comment posted to each issue in $ISSUES array, same loop pattern as existing completion comment-back
- linear-context.md frontmatter gains `interview_summary` text field (WKFL-02)
- `interview_summary` is a single multi-line string with Goal, Scope, Criteria, Route
- `score` field replaced by `route_source: interview|override`
- Quick route description synthesis uses interview-enriched goal/scope/criteria instead of raw truncation (WKFL-03)
- $DESCRIPTION built from $INTERVIEW_CONTEXT Goal and Scope sections
- Linear comments still appended as supplementary context
- Total $DESCRIPTION truncation limit remains 2000 chars
- MILESTONE-CONTEXT.md includes `## Selected Approach` section (WKFL-04)
- Section appended after `## Additional Context`
- $SELECTED_APPROACH variable from Phase 85 consumed here

### Claude's Discretion
- Exact wording of the pre-execution comment body template
- Formatting of the interview_summary frontmatter value
- Whether to include "Execution starting..." footer line
- Order of fields within the comment body

### Deferred Ideas (OUT OF SCOPE)
- Command spec and documentation updates — Phase 87 scope
- Multi-issue interview strategy — Post-v3.0

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMNT-01 | Interview summary posted to Linear ticket via MCP create_comment before execution starts | Existing MCP call pattern in current Step 8 provides exact template |
| CMNT-02 | Comment includes goal, scope, criteria, route, and selected approach (milestone) | $INTERVIEW_CONTEXT and $SELECTED_APPROACH variables available from Steps 3-5 |
| CMNT-03 | MCP failure shows warning but does not block execution | Non-blocking pattern already proven in current Step 8 |
| CMNT-04 | Existing post-execution completion comment remains unchanged — two comments total | Step 8 (becomes Step 9) is untouched; new step is additive |
| WKFL-02 | linear-context.md frontmatter gains interview_summary field | Current Step 6 frontmatter template is the modification target |
| WKFL-03 | Quick route description uses interview-enriched context instead of raw truncation | Current Step 7a $DESCRIPTION synthesis is the modification target |
| WKFL-04 | Milestone MILESTONE-CONTEXT.md includes Selected Approach section | Current Step 7a milestone template already has $SELECTED_APPROACH placeholder |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| linear.md | N/A | Workflow orchestration file | The single file being modified |
| MCP Linear plugin | Current | create_comment API | Already used in Step 8 for completion comments |

### Supporting
No additional libraries needed. All changes are markdown template modifications within the existing workflow file.

## Architecture Patterns

### Current Step Structure (pre-Phase 86)
```
Step 1: Parse arguments
Step 2: Fetch issue data
Step 3: Interview
Step 4: Route decision
Step 5: Hybrid output ($SELECTED_APPROACH set here)
Step 6: Write linear-context.md
Step 7: Execute route (7a-7i quick, 7a-7c milestone)
Step 8: Comment-back to Linear issues
Step 9: Cleanup
```

### Post-Phase 86 Step Structure
```
Step 1: Parse arguments (unchanged)
Step 2: Fetch issue data (unchanged)
Step 3: Interview (unchanged)
Step 4: Route decision (unchanged)
Step 5: Hybrid output (unchanged)
Step 6: Pre-execution comment-back (NEW — was "Step 5.5")
Step 7: Write linear-context.md (MODIFIED — was Step 6)
Step 8: Execute route (MODIFIED — was Step 7)
Step 9: Post-execution comment-back (unchanged — was Step 8)
Step 10: Cleanup (unchanged — was Step 9)
```

### Pattern: Non-Blocking MCP Call
The existing Step 8 comment-back pattern:
```
For each issue in $ISSUES:
  mcp__plugin_linear_linear__create_comment(issueId: issue.id, body: comment_body)
  Display: "✓ Comment posted to {issue.identifier}"
  On failure: "⚠ Failed to post comment to {issue.identifier}. {success message}."
  Continue to next issue.
```
Step 6 (new) reuses this exact pattern.

### Pattern: YAML Frontmatter in linear-context.md
Current frontmatter fields: `issue_ids`, `route`, `interview`, `fetched`.
New fields: `interview_summary` (multi-line YAML string), `route_source` (replaces nothing — `score` was already removed).

Note: The current linear.md Step 6 frontmatter already uses `interview: true` — there is no `score` field to replace. The CONTEXT.md mentions replacing `score` with `route_source`, but the actual file shows `interview: true` instead. The change is: add `interview_summary` and `route_source` fields.

### Pattern: $DESCRIPTION Synthesis (Quick Route)
Current Step 7a builds $DESCRIPTION from raw issue data:
```
title + "\n\n" + description[:1500] + "\n\nLinear comments:\n" + comments[:200 each]
```
New pattern replaces with interview-enriched data:
```
identifier + " — " + title + "\n\nGoal: " + interview_goal + "\nScope: " + interview_scope + "\nCriteria: " + interview_criteria + "\n\nLinear comments:\n" + comments[:200 each]
```

### Pattern: MILESTONE-CONTEXT.md Template
Current Step 7a milestone already has `${$SELECTED_APPROACH}` placeholder at the end of the template. This means WKFL-04 may already be partially implemented by Phase 85. Need to verify during planning.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP error handling | Custom retry/timeout logic | Existing non-blocking pattern from Step 8 | Proven pattern, consistent behavior |
| YAML multi-line strings | Custom serialization | YAML pipe literal block scalar (`\|`) | Standard YAML syntax for multi-line values |

## Common Pitfalls

### Pitfall 1: Step Number Reference Drift
**What goes wrong:** After inserting Step 6 (comment-back), internal references to "Step 6", "Step 7", etc. throughout linear.md become incorrect.
**Why it happens:** The workflow has cross-references between steps (e.g., "Continue to Step 6" in Step 5).
**How to avoid:** Systematically renumber ALL step references after insertion, not just step headers.
**Warning signs:** Any occurrence of "Step 6" through "Step 9" in the file needs examination.

### Pitfall 2: MILESTONE-CONTEXT.md Double-Write
**What goes wrong:** The `$SELECTED_APPROACH` section might already be written by Phase 85's changes to Step 7a milestone, causing duplication.
**Why it happens:** Phase 85 added `${$SELECTED_APPROACH}` to the MILESTONE-CONTEXT.md template.
**How to avoid:** Verify current state of Step 7a milestone template. If placeholder exists, WKFL-04 is already satisfied — just verify, don't duplicate.
**Warning signs:** Grep for `$SELECTED_APPROACH` in the milestone template section.

### Pitfall 3: Interview Summary Extraction
**What goes wrong:** Incorrectly parsing $INTERVIEW_CONTEXT to extract Goal, Scope, Criteria for the comment body.
**Why it happens:** $INTERVIEW_CONTEXT uses `**Goal:**`, `**Scope:**`, etc. as labeled sections.
**How to avoid:** The comment body template uses the same labeled format, so extraction is straightforward string parsing from the in-memory variable.

## Code Examples

### New Step 6: Pre-Execution Comment-Back
```markdown
**Step 6: Pre-execution comment-back**

Post interview summary to Linear before execution starts.

**Build comment body based on route:**

**If `$ROUTE == "quick"`:**
```
## GSD Interview Summary

**Goal:** {from $INTERVIEW_CONTEXT}
**Scope:** {from $INTERVIEW_CONTEXT}
**Success criteria:** {from $INTERVIEW_CONTEXT}
**Route:** Quick task

Execution starting...
```

**If `$ROUTE == "milestone"`:**
```
## GSD Interview Summary

**Goal:** {from $INTERVIEW_CONTEXT}
**Scope:** {from $INTERVIEW_CONTEXT}
**Success criteria:** {from $INTERVIEW_CONTEXT}
**Route:** Milestone
**Selected approach:** {approach name from $SELECTED_APPROACH}

{2-3 sentence approach description from $SELECTED_APPROACH}

Milestone creation starting...
```

**Post comment to each issue (non-blocking):**
For each issue in `$ISSUES`:
  mcp__plugin_linear_linear__create_comment(issueId: issue.id, body: comment_body)
  Display: `✓ Pre-execution summary posted to {issue.identifier}`
  On failure: `⚠ Failed to post pre-execution summary to {issue.identifier}. Continuing...`
```

### Modified Step 7: linear-context.md Frontmatter
```yaml
---
issue_ids: [{comma-separated issue identifiers}]
route: {quick|milestone}
route_source: {interview|override}
interview_summary: |
  Goal: {goal from $INTERVIEW_CONTEXT}
  Scope: {scope from $INTERVIEW_CONTEXT}
  Criteria: {criteria from $INTERVIEW_CONTEXT}
  Route: {route}
fetched: {ISO date}
---
```

## Open Questions

1. **`route_source` values**
   - What we know: CONTEXT.md says `interview|override`
   - What's unclear: When exactly is `override` used? When `$FORCE_QUICK` or `$FORCE_MILESTONE` is true?
   - Recommendation: `override` when flags used, `interview` otherwise (including ticket inference with confirmation)

## Sources

### Primary (HIGH confidence)
- `/Users/seanspade/.claude/get-shit-done/workflows/linear.md` — current workflow state
- `.planning/phases/86-comment-back-and-enriched-context/86-CONTEXT.md` — user decisions
- `.planning/REQUIREMENTS.md` — requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external dependencies, just workflow template edits
- Architecture: HIGH — existing patterns reused verbatim
- Pitfalls: HIGH — step renumbering is the main risk, well-understood

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain — workflow files don't have version drift)
