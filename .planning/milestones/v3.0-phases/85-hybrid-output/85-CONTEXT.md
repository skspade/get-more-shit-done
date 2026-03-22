# Phase 85: Hybrid Output - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

After the interview (Step 3) and routing decision (Step 4) from Phase 84, this phase adds a new Step 5 that presents route-appropriate output to the user before execution begins. Quick route shows a confirmation summary with the option to re-enter a specific interview question. Milestone route shows 2-3 approach proposals with pros/cons and a recommendation, and the selected approach is written to MILESTONE-CONTEXT.md. Subsequent steps (currently 5-8) shift to 6-9.

</domain>

<decisions>
## Implementation Decisions

### Quick Route Confirmation Summary
- Quick route displays a confirmation summary showing issue, goal, scope, criteria, and route with "Yes, proceed" / "No, let me clarify" options via AskUserQuestion (from REQUIREMENTS.md OUTP-01)
- "No, let me clarify" re-enters the relevant interview question rather than restarting the entire interview (from REQUIREMENTS.md OUTP-02)
- Summary fields are extracted from `$INTERVIEW_CONTEXT` sections (Goal, Scope, Success Criteria, Complexity) established in Phase 84 (from Phase 84 CONTEXT.md)
- Re-ask loop: after "No, let me clarify", present a follow-up AskUserQuestion listing the interview dimensions (Goal, Scope, Criteria, Complexity) so the user picks which to revisit, then re-ask that single question and update `$INTERVIEW_CONTEXT` accordingly (Claude's Decision: explicit dimension picker is simpler than asking user to type which field to change)
- After re-ask, re-display the updated confirmation summary with the same Yes/No prompt (Claude's Decision: user should see the corrected summary before committing to proceed)
- Maximum re-clarification cycles: unlimited -- loop until the user selects "Yes, proceed" (Claude's Decision: no reason to cap corrections on a fast interactive loop)

### Milestone Route Approach Proposals
- Milestone route displays 2-3 approach proposals with pros/cons and a recommendation, following the brainstorm.md Step 4 pattern (from REQUIREMENTS.md OUTP-03)
- User selects an approach via AskUserQuestion with options listing each approach name plus "Let me suggest modifications" (from brainstorm.md Step 4 established pattern)
- If user selects "Let me suggest modifications", ask what they would change, revise proposals, and re-present (Claude's Decision: mirrors brainstorm.md Step 4 revision pattern exactly)
- Selected approach is written to MILESTONE-CONTEXT.md under a `## Selected Approach` section (from REQUIREMENTS.md OUTP-04)
- Approach proposals are synthesized from `$INTERVIEW_CONTEXT` and `$ISSUES` data -- goal, scope, and criteria inform the design space (Claude's Decision: these are the richest context sources available at this point in the workflow)

### Workflow Integration
- New Step 5 inserted between current Step 4 (route decision) and current Step 5 (write linear-context.md), shifting all subsequent steps by 1 (steps become 1-9 total) (Claude's Decision: hybrid output must happen before linear-context.md is written so the selected approach can inform downstream context)
- Step count increases from 8 to 9: Steps 1 (parse) + 2 (fetch) + 3 (interview) + 4 (route) + 5 (hybrid output) + 6 (write context) + 7 (execute) + 8 (comment-back) + 9 (cleanup)
- Quick route confirmation summary lives inline in linear.md -- no separate agent needed since AskUserQuestion must be called from the top-level workflow (from Phase 84 CONTEXT.md architecture constraint)
- Milestone approach proposals also live inline in linear.md following the same constraint
- `$INTERVIEW_CONTEXT` is consumed read-only in Step 5 (quick route) or mutated only by re-ask (quick route clarify loop); the milestone route reads but does not modify it

### MILESTONE-CONTEXT.md Changes
- The `## Selected Approach` section is appended after the existing `## Additional Context` section in MILESTONE-CONTEXT.md (Claude's Decision: keeps existing structure intact while adding new data at the end)
- The section contains the approach name, its description, and the pros/cons as presented to the user (Claude's Decision: downstream consumers need the full rationale, not just the name)
- MILESTONE-CONTEXT.md is written in Step 7 (execute route, milestone path) which already builds this file -- the selected approach section is added during that existing write (Claude's Decision: avoids writing MILESTONE-CONTEXT.md twice)

### Claude's Discretion
- Exact wording of the confirmation summary display format
- Specific phrasing of the AskUserQuestion prompts for approach selection
- Number of approaches (2 or 3) based on issue complexity
- Internal variable naming for selected approach state
- Formatting of pros/cons lists in approach proposals

</decisions>

<specifics>
## Specific Ideas

**Confirmation summary format (from REQUIREMENTS.md OUTP-01):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CONFIRMATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue:    {identifier} — {title}
Goal:     {from $INTERVIEW_CONTEXT}
Scope:    {from $INTERVIEW_CONTEXT}
Criteria: {from $INTERVIEW_CONTEXT}
Route:    {quick / quick (full mode)}
```

**Approach proposal format (from brainstorm.md Step 4 pattern):**
```
## Proposed Approaches

### Approach 1: {Name}
{Description}
**Pros:** ...
**Cons:** ...

### Approach 2: {Name}
...

### Recommendation
I recommend **Approach {N}: {Name}** because {reason}.
```

**Re-clarification dimension picker (from REQUIREMENTS.md OUTP-02):**
```
AskUserQuestion(
  header: "Clarify",
  question: "Which part would you like to revisit?",
  options: ["Goal", "Scope", "Success Criteria", "Complexity", "Cancel — proceed as-is"]
)
```

**Selected approach section in MILESTONE-CONTEXT.md (from REQUIREMENTS.md OUTP-04):**
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
- `~/.claude/get-shit-done/workflows/brainstorm.md` Step 4: Proven pattern for 2-3 approach proposals with pros/cons, recommendation, and user selection via AskUserQuestion. The milestone hybrid output replicates this pattern directly.
- `~/.claude/get-shit-done/workflows/linear.md` Step 3: Interview engine produces `$INTERVIEW_CONTEXT` with labeled sections (Goal, Scope, Success Criteria, Complexity, Additional). The confirmation summary extracts these fields.
- `~/.claude/get-shit-done/workflows/linear.md` Step 4: Route decision sets `$ROUTE` and `$FULL_MODE`. The hybrid output step branches on `$ROUTE`.
- `~/.claude/get-shit-done/workflows/linear.md` Step 6 (milestone path, sub-step 6a): Existing MILESTONE-CONTEXT.md builder with Features and Additional Context sections. The selected approach section extends this template.

### Established Patterns
- **AskUserQuestion with options + revision loop**: brainstorm.md uses AskUserQuestion for approach selection with a "Let me suggest modifications" escape hatch and a revision loop. The milestone approach proposals follow this identical pattern.
- **Banner displays for workflow milestones**: linear.md uses `━━━` banner blocks for step transitions (ISSUE FETCHED, ROUTE). The confirmation summary and approach proposals use the same banner style.
- **In-memory workflow variables without intermediate files**: `$INTERVIEW_CONTEXT` is accumulated in-memory during the interview. The hybrid output step reads it directly without writing/reading files.
- **Single workflow file architecture**: All linear.md logic lives in one file. The hybrid output step is added inline, not as a separate agent or workflow.

### Integration Points
- **Step 4 output -> Step 5 input**: `$ROUTE`, `$FULL_MODE`, `$INTERVIEW_CONTEXT`, and `$ISSUES` feed the hybrid output step.
- **Step 5 output (quick) -> Step 7 input**: Confirmation proceeds directly; re-ask updates `$INTERVIEW_CONTEXT` which may affect downstream description synthesis in Step 7 (6a).
- **Step 5 output (milestone) -> Step 7 input**: Selected approach stored in a variable (e.g., `$SELECTED_APPROACH`) and appended to MILESTONE-CONTEXT.md during Step 7's milestone path (6a).
- **Step renumbering**: Current Steps 5-8 shift to Steps 6-9. All sub-step references (6a-6i) shift to (7a-7i). Cross-references in success criteria must be updated.

</code_context>

<deferred>
## Deferred Ideas

- **Pre-execution comment-back to Linear** -- Phase 86 scope. The confirmation summary and selected approach will be included in the Linear comment, but posting is Phase 86's responsibility.
- **Enriched task descriptions using interview context** -- Phase 86 scope. The quick route description synthesis (Step 7, sub-step 7a) will use interview-enriched fields instead of raw truncation.
- **linear-context.md `interview_summary` frontmatter field** -- Phase 86 scope.
- **Command spec and documentation updates** -- Phase 87 scope.

</deferred>

---

*Phase: 85-hybrid-output*
*Context gathered: 2026-03-22 via auto-context*
