# Phase 86: Comment-Back and Enriched Context - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

After Phase 85 added the hybrid output step (confirmation summary / approach proposals), this phase adds pre-execution comment-back to Linear and enriches all downstream context consumers with interview data. A new Step 5.5 posts the interview summary (goal, scope, criteria, route, selected approach) to the Linear ticket via MCP before execution starts, using non-blocking error handling. The existing post-execution completion comment (Step 8) remains unchanged, giving tickets two comments total. Step 6 (write linear-context.md) gains an `interview_summary` frontmatter field, Step 7 quick route replaces raw title+description truncation with interview-enriched goal/scope/criteria, and Step 7 milestone route includes the `## Selected Approach` section in MILESTONE-CONTEXT.md.

</domain>

<decisions>
## Implementation Decisions

### Pre-Execution Comment-Back (New Step 5.5)
- Interview summary posted to Linear ticket via MCP `create_comment` before execution starts (from REQUIREMENTS.md CMNT-01)
- Comment includes goal, scope, criteria, route, and selected approach for milestone route (from REQUIREMENTS.md CMNT-02)
- MCP failure shows warning but does not block execution (from REQUIREMENTS.md CMNT-03)
- Existing post-execution completion comment-back (Step 8) remains unchanged -- tickets receive two comments total (from REQUIREMENTS.md CMNT-04)
- Step 5.5 inserted between Step 5 (hybrid output) and Step 6 (write linear-context.md), following the design doc's step mapping
- Comment body format differs by route: quick route omits "Selected approach" line, milestone route includes approach name and 2-3 sentence description (from design doc)
- Non-blocking error handling reuses the exact pattern from the existing Step 8 comment-back: try MCP call, on failure display warning with `⚠` prefix and continue (Claude's Decision: proven pattern already in linear.md Step 6/8, no reason to invent a new error handling approach)
- Comment posted to each issue in `$ISSUES` array, same loop pattern as existing completion comment-back (Claude's Decision: multi-issue support must be consistent between pre-execution and post-execution comments)

### Enriched linear-context.md Frontmatter
- `linear-context.md` frontmatter gains an `interview_summary` text field (from REQUIREMENTS.md WKFL-02)
- The `interview_summary` value is a single multi-line string containing the Goal, Scope, Criteria, and Route extracted from `$INTERVIEW_CONTEXT` (Claude's Decision: single field keeps frontmatter simple; downstream consumers parse the labeled sections within it)
- The existing `score` field is replaced by `route_source: interview|override` to indicate how the route was determined (Claude's Decision: scoring heuristic was removed in Phase 84, so `score` field is now meaningless -- `route_source` captures the routing provenance)

### Quick Route Enriched Descriptions
- Quick route description synthesis (Step 7, sub-step 7a) uses interview-enriched goal/scope/criteria instead of raw `title + description[:1500]` truncation (from REQUIREMENTS.md WKFL-03)
- `$DESCRIPTION` built from `$INTERVIEW_CONTEXT` Goal and Scope sections, plus issue identifier and title as header (Claude's Decision: interview context is richer and already validated by user during confirmation summary)
- Linear comments still appended to `$DESCRIPTION` as supplementary context, but no longer the primary content source (Claude's Decision: comments may contain useful technical details not covered in interview)
- Total `$DESCRIPTION` truncation limit remains 2000 chars to respect planner context constraints (Claude's Decision: downstream planner prompt budget is unchanged)

### Milestone MILESTONE-CONTEXT.md Enrichment
- MILESTONE-CONTEXT.md includes `## Selected Approach` section from approach proposals (from REQUIREMENTS.md WKFL-04)
- The `## Selected Approach` section is appended after `## Additional Context` in MILESTONE-CONTEXT.md during Step 7 milestone path (from Phase 85 CONTEXT.md)
- Section contains the approach name, description, and pros/cons as presented to the user (from Phase 85 CONTEXT.md)
- `$SELECTED_APPROACH` variable from Phase 85 is consumed here -- Phase 86 reads it, Phase 85 sets it (Claude's Decision: variable is already defined by Phase 85's approach selection step, this phase just writes it to the file)

### Claude's Discretion
- Exact wording of the pre-execution comment body template
- Formatting of the `interview_summary` frontmatter value (indentation, line breaks)
- Whether to include the "Execution starting..." footer line in the comment
- Order of fields within the comment body

</decisions>

<specifics>
## Specific Ideas

**Pre-execution comment body format for quick route (from design doc):**
```markdown
## GSD Interview Summary

**Goal:** {synthesized goal}
**Scope:** {scope from interview}
**Success criteria:** {criteria from interview}
**Route:** Quick task

Execution starting...
```

**Pre-execution comment body format for milestone route (from design doc):**
```markdown
## GSD Interview Summary

**Goal:** {synthesized goal}
**Scope:** {scope from interview}
**Success criteria:** {criteria from interview}
**Route:** Milestone
**Selected approach:** {approach name}

{2-3 sentence approach description}

Milestone creation starting...
```

**linear-context.md frontmatter with new field (from REQUIREMENTS.md WKFL-02):**
```yaml
---
issue_ids: [LIN-123]
route: quick
route_source: interview
fetched: 2026-03-22
interview_summary: |
  Goal: {goal from interview}
  Scope: {scope from interview}
  Criteria: {criteria from interview}
  Route: quick
---
```

**Enriched quick route description synthesis (from REQUIREMENTS.md WKFL-03):**
Replace the current Step 5a pattern:
```
# Current (raw truncation):
$DESCRIPTION = title + "\n\n" + description[:1500] + "\n\nLinear comments:\n" + comments[:200 each]

# New (interview-enriched):
$DESCRIPTION = identifier + " — " + title + "\n\nGoal: " + interview_goal + "\nScope: " + interview_scope + "\nCriteria: " + interview_criteria + "\n\nLinear comments:\n" + comments[:200 each]
```

**MILESTONE-CONTEXT.md with Selected Approach (from REQUIREMENTS.md WKFL-04):**
```markdown
## Selected Approach

### {Approach Name}

{Description}

**Pros:**
- ...

**Cons:**
- ...
```

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/linear.md` Step 6 (current, becomes Step 8): Existing MCP `create_comment` call with non-blocking error handling. The pre-execution comment-back (new Step 5.5) reuses this exact pattern -- MCP call wrapped in try/warning on failure.
- `get-shit-done/workflows/linear.md` Step 4 (current, becomes Step 6): Existing `linear-context.md` writer with YAML frontmatter. The `interview_summary` field extends this existing template.
- `get-shit-done/workflows/linear.md` Step 5a quick route: Existing `$DESCRIPTION` synthesis logic. This is the code that gets modified to use interview context instead of raw truncation.
- `get-shit-done/workflows/linear.md` Step 5a milestone route: Existing MILESTONE-CONTEXT.md builder. The `## Selected Approach` section extends this template.

### Established Patterns
- **Non-blocking MCP comment-back**: Step 6 (current) wraps `create_comment` with warning-only failure handling. Step 5.5 follows the identical pattern -- this is the CMNT-03 requirement's implementation approach.
- **YAML frontmatter in linear-context.md**: Existing frontmatter has `issue_ids`, `route`, `score`, `fetched`. Adding `interview_summary` and replacing `score` with `route_source` follows the same structure.
- **Banner displays for workflow transitions**: linear.md uses `━━━` banners for step transitions. The comment-back step uses this pattern for its display output.
- **In-memory workflow variables**: `$INTERVIEW_CONTEXT` and `$SELECTED_APPROACH` are accumulated in-memory by Phase 84 and 85 respectively. This phase reads them without file I/O.

### Integration Points
- **Step 5 output -> Step 5.5 input**: `$INTERVIEW_CONTEXT`, `$ROUTE`, `$SELECTED_APPROACH` (milestone only), and `$ISSUES` feed the comment-back step.
- **Step 5.5 output -> Step 6 input**: Comment-back success/failure is display-only; no variable state is passed forward. Step 6 writes linear-context.md independently.
- **Step 5.5 -> Step 6**: `$INTERVIEW_CONTEXT` is also consumed by Step 6 to populate the `interview_summary` frontmatter field.
- **Step 5 -> Step 7 (quick)**: `$INTERVIEW_CONTEXT` Goal/Scope/Criteria sections replace the raw truncation in `$DESCRIPTION` synthesis.
- **Step 5 -> Step 7 (milestone)**: `$SELECTED_APPROACH` is appended to MILESTONE-CONTEXT.md during the milestone route's context builder.
- **Step 8 (completion comment-back)**: Remains unchanged -- still reads SUMMARY.md or ROADMAP.md to build completion comment. Two comments total per ticket.

</code_context>

<deferred>
## Deferred Ideas

- **Command spec and documentation updates** -- Phase 87 scope. The `commands/gsd/linear.md` objective text and success criteria referencing interview-driven routing.
- **Multi-issue interview strategy** -- Post-v3.0 per REQUIREMENTS.md. Comment-back already handles multi-issue via loop, but interview batching is future scope.

</deferred>

---

*Phase: 86-comment-back-and-enriched-context*
*Context gathered: 2026-03-22 via auto-context*
