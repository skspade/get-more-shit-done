# Phase 85: Hybrid Output - Research

**Researched:** 2026-03-22
**Domain:** Workflow orchestration — confirmation summary and approach proposals inline in linear.md
**Confidence:** HIGH

## Summary

Phase 85 adds a new Step 5 (Hybrid Output) between the current Step 4 (Route Decision) and Step 5 (Write linear-context.md) in `linear.md`. For quick route, it displays a confirmation summary with re-ask capability. For milestone route, it displays 2-3 approach proposals following the brainstorm.md Step 4 pattern. Both paths use AskUserQuestion inline (same constraint as the interview engine from Phase 84).

The implementation is straightforward: quick route reads `$INTERVIEW_CONTEXT` fields and presents them in a banner, with a Yes/No AskUserQuestion loop. "No" triggers a dimension picker, re-asks the selected question, updates `$INTERVIEW_CONTEXT`, and re-displays the summary. Milestone route synthesizes approach proposals from `$INTERVIEW_CONTEXT` and `$ISSUES`, presents them with the brainstorm.md approach selection pattern, and stores the selected approach for downstream writing to MILESTONE-CONTEXT.md.

**Primary recommendation:** Implement as a single new Step 5 block in linear.md. Quick route confirmation is a display + AskUserQuestion loop. Milestone route approach proposals replicate brainstorm.md Step 4 exactly. Shift existing Steps 5-8 to Steps 6-9.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Quick route displays a confirmation summary showing issue, goal, scope, criteria, and route with "Yes, proceed" / "No, let me clarify" options via AskUserQuestion (OUTP-01)
- "No, let me clarify" re-enters the relevant interview question rather than restarting the entire interview (OUTP-02)
- Summary fields extracted from `$INTERVIEW_CONTEXT` sections (Goal, Scope, Success Criteria, Complexity) from Phase 84
- Re-ask loop: after "No", present dimension picker AskUserQuestion, re-ask that single question, update `$INTERVIEW_CONTEXT`, re-display updated summary
- After re-ask, re-display the updated confirmation summary with the same Yes/No prompt
- Maximum re-clarification cycles: unlimited — loop until "Yes, proceed"
- Milestone route displays 2-3 approach proposals with pros/cons and a recommendation, following brainstorm.md Step 4 pattern (OUTP-03)
- User selects approach via AskUserQuestion with options listing each approach name plus "Let me suggest modifications"
- If user selects "Let me suggest modifications", ask what they would change, revise proposals, and re-present
- Selected approach written to MILESTONE-CONTEXT.md under `## Selected Approach` section (OUTP-04)
- Approach proposals synthesized from `$INTERVIEW_CONTEXT` and `$ISSUES` data
- New Step 5 inserted between Step 4 (route) and current Step 5 (write linear-context.md), shifting subsequent steps by 1 (total 9 steps)
- Quick route confirmation lives inline in linear.md — no separate agent (AskUserQuestion constraint)
- Milestone approach proposals also live inline for same constraint
- `$INTERVIEW_CONTEXT` consumed read-only in Step 5 (quick) or mutated only by re-ask; milestone reads but does not modify
- `## Selected Approach` section appended after `## Additional Context` in MILESTONE-CONTEXT.md
- Section contains approach name, description, and pros/cons as presented
- MILESTONE-CONTEXT.md written in Step 7 (execute route, milestone path) — selected approach added during that existing write

### Claude's Discretion
- Exact wording of the confirmation summary display format
- Specific phrasing of the AskUserQuestion prompts for approach selection
- Number of approaches (2 or 3) based on issue complexity
- Internal variable naming for selected approach state
- Formatting of pros/cons lists in approach proposals

### Deferred Ideas (OUT OF SCOPE)
- Pre-execution comment-back to Linear — Phase 86
- Enriched task descriptions using interview context — Phase 86
- linear-context.md `interview_summary` frontmatter field — Phase 86
- Command spec and documentation updates — Phase 87
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OUTP-01 | Quick route shows confirmation summary (issue, goal, scope, criteria, route) with "Yes, proceed" / "No, let me clarify" options | Banner display pattern from linear.md + AskUserQuestion with two options |
| OUTP-02 | "No, let me clarify" re-enters the relevant interview question rather than restarting | Dimension picker AskUserQuestion + re-ask single question from Step 3 pattern |
| OUTP-03 | Milestone route shows 2-3 approach proposals with pros/cons and recommendation | Exact replication of brainstorm.md Step 4 approach proposal pattern |
| OUTP-04 | Selected approach written to MILESTONE-CONTEXT.md under `## Selected Approach` | Extend existing MILESTONE-CONTEXT.md template in Step 7 milestone path |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AskUserQuestion | Built-in | Interactive confirmation and selection | Claude Code native — only way to ask users questions in workflows |

### Supporting
No external libraries needed. This phase modifies a workflow markdown file using built-in Claude Code tools only.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline confirmation | Separate agent | AskUserQuestion cannot be called from Task() subagents |
| Re-ask loop | Restart full interview | Re-asking a single question is faster than repeating all 3-5 |

## Architecture Patterns

### Recommended Structure

The hybrid output step is a new Step 5 in `linear.md` containing two branches:

**Quick route branch:**
1. Extract fields from `$INTERVIEW_CONTEXT` (Goal, Scope, Success Criteria, Complexity)
2. Display confirmation summary banner
3. AskUserQuestion: "Yes, proceed" / "No, let me clarify"
4. If "No": dimension picker -> re-ask -> update `$INTERVIEW_CONTEXT` -> redisplay -> loop
5. If "Yes": continue to Step 6

**Milestone route branch:**
1. Synthesize 2-3 approaches from `$INTERVIEW_CONTEXT` + `$ISSUES`
2. Display approaches with pros/cons and recommendation
3. AskUserQuestion: select approach or "Let me suggest modifications"
4. If modifications: ask what to change, revise, re-present -> loop
5. Store `$SELECTED_APPROACH` for downstream MILESTONE-CONTEXT.md

### Pattern 1: Confirmation Summary with Re-ask (new pattern)
**What:** Display structured summary, offer Yes/No, re-ask specific dimensions on "No"
**When to use:** Before committing to an execution route based on interview data
**Key details:**
- Extract labeled fields from `$INTERVIEW_CONTEXT` using `**Field:**` markers
- Dimension picker presents the 4 revisitable fields as options
- Re-ask uses same AskUserQuestion format as original interview question
- Update the relevant line in `$INTERVIEW_CONTEXT` after re-ask

### Pattern 2: Approach Proposal Selection (from brainstorm.md Step 4)
**What:** Present 2-3 distinct approaches with pros/cons and recommendation, let user select
**When to use:** When milestone route needs user to choose implementation strategy
**Key details:**
- Each approach: name, description, pros list, cons list
- Recommendation with reasoning
- AskUserQuestion with approach names + "Let me suggest modifications"
- Modification loop: ask what to change, revise, re-present

### Anti-Patterns to Avoid
- **Restarting full interview on "No, let me clarify":** Wastes user time, only one dimension needs revision
- **Generating approaches in a separate agent:** AskUserQuestion must be inline
- **Writing MILESTONE-CONTEXT.md in Step 5:** It's written in Step 7 (execute route) — Step 5 only stores the selection in a variable
- **Hardcoding exactly 3 approaches:** 2-3 is the range — simple issues may only warrant 2

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive selection | Custom prompt parsing | AskUserQuestion with options | Built-in, consistent UX |
| Approach generation | External brainstorm agent | Inline synthesis from context | Same constraint as interview — AskUserQuestion must be inline |

## Common Pitfalls

### Pitfall 1: Step Number References Not Updated
**What goes wrong:** Existing steps 5-8 references in comments, banners, or success criteria still use old numbers
**Why it happens:** Adding Step 5 shifts all subsequent steps by 1
**How to avoid:** Search for all step number references in linear.md after the new step and update them
**Warning signs:** Comments saying "Step 5" that refer to linear-context.md writing (now Step 6)

### Pitfall 2: $INTERVIEW_CONTEXT Mutation Scope Confusion
**What goes wrong:** Re-ask in quick route modifies `$INTERVIEW_CONTEXT` but the update doesn't propagate to downstream steps
**Why it happens:** In-memory variables in workflow markdown are sequential — mutation in Step 5 carries forward
**How to avoid:** The re-ask replaces the specific labeled line in `$INTERVIEW_CONTEXT`. Since this is an in-memory variable in the same workflow, the updated value is naturally available to subsequent steps.
**Warning signs:** Downstream steps seeing stale interview data after re-ask

### Pitfall 3: MILESTONE-CONTEXT.md Written in Wrong Step
**What goes wrong:** Selected approach is written to MILESTONE-CONTEXT.md in Step 5 instead of Step 7
**Why it happens:** Context says "write to MILESTONE-CONTEXT.md" but that file is assembled in the execute route step
**How to avoid:** Step 5 stores `$SELECTED_APPROACH` as a variable. Step 7 (milestone path, sub-step 7a) appends `## Selected Approach` when building MILESTONE-CONTEXT.md.
**Warning signs:** MILESTONE-CONTEXT.md being written twice or overwritten

### Pitfall 4: Missing Route Guard in Step 5
**What goes wrong:** Both quick and milestone branches execute for the same run
**Why it happens:** Step 5 needs an explicit `$ROUTE` check to branch
**How to avoid:** Start with `If $ROUTE == "quick"` and `If $ROUTE == "milestone"` guards
**Warning signs:** Seeing confirmation summary AND approach proposals in the same run

## Code Examples

### Confirmation Summary Banner Pattern
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

### Dimension Picker Pattern
```
AskUserQuestion(
  header: "Clarify",
  question: "Which part would you like to revisit?",
  options: ["Goal", "Scope", "Success Criteria", "Complexity", "Cancel — proceed as-is"]
)
```

### Approach Proposal Pattern (from brainstorm.md Step 4)
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

### Selected Approach Variable
```
$SELECTED_APPROACH = "
## Selected Approach

### {Approach Name}

{Description}

**Pros:**
- ...

**Cons:**
- ...
"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct execution after routing | Confirmation summary before execution | Phase 85 (now) | User can verify and correct before committing |
| No approach selection for milestones | Approach proposals with selection | Phase 85 (now) | User chooses implementation strategy |

## Open Questions

None — the implementation is well-constrained by CONTEXT.md locked decisions and the brainstorm.md pattern serves as a direct template.

## Sources

### Primary (HIGH confidence)
- `linear.md` current workflow (read directly) — current step structure, `$INTERVIEW_CONTEXT` format, `$ROUTE` variable, MILESTONE-CONTEXT.md template
- `brainstorm.md` Step 4 (read directly) — approach proposal pattern, AskUserQuestion selection pattern, modification loop
- `85-CONTEXT.md` (read directly) — locked decisions, implementation constraints, specific display formats

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md — requirement IDs and descriptions for OUTP-01 through OUTP-04

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AskUserQuestion is well-established in both brainstorm.md and Phase 84 interview
- Architecture: HIGH - Pattern directly copied from proven brainstorm.md Step 4
- Pitfalls: HIGH - Derived from concrete code analysis of existing linear.md step structure

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable — internal workflow, no external dependencies)
