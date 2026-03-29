<purpose>
Run a reflective analysis over completed milestones, phases, and retrospectives to surface recurring patterns, unresolved lessons, and workflow friction. This is a read-only collaborative discussion — no changes to workflows, agents, or config. The user drives the conversation and decides when to wrap up.

You are a thinking partner reviewing process history. Your job is to find what keeps going wrong, what keeps going right, and what lessons were stated but never applied. Ground everything in the actual retrospective data.
</purpose>

<process>

## 1. Parse Scope

Extract scope from $ARGUMENTS.

**If scope provided:**
- Version (e.g., `v1.3`, `1.3`): focus on that milestone
- `all`: analyze all milestones (default)
- `recent N` or `--recent N`: analyze last N milestones
- Quoted string (e.g., `"frontmatter"`): topic-focused search across all milestones

**If no scope provided:** Default to `all`.

Display:
```
Starting reflection — scope: {scope description}
```

## 2. Read Retrospective Data

Read `.planning/RETROSPECTIVE.md` in full.

**If scope is a specific milestone:** Also read:
- `.planning/milestones/{version}-ROADMAP.md` (if exists)
- `.planning/milestones/{version}-REQUIREMENTS.md` (if exists)
- `.planning/milestones/{version}-MILESTONE-AUDIT.md` (if exists)
- Phase SUMMARY.md and VERIFICATION.md files via: `Glob: .planning/milestones/{version}-phases/*/*-SUMMARY.md` and `Glob: .planning/milestones/{version}-phases/*/*-VERIFICATION.md`

**If scope is `all` or `recent N`:** Read:
- `.planning/MILESTONES.md` (milestone index)
- `.planning/PROJECT.md` (key decisions for context)
- Sample MILESTONE-AUDIT.md files: `Glob: .planning/milestones/*-MILESTONE-AUDIT.md`

**If scope is a topic:** Grep RETROSPECTIVE.md and milestone artifacts for the topic keyword to find all relevant mentions.

## 3. Analyze Patterns

Work through the retrospective data and identify:

### A. Recurring Inefficiencies
Find issues that appear in "What Was Inefficient" or "Key Lessons" across 2+ milestones. For each:
- How many milestones mention it?
- First occurrence vs most recent occurrence
- Has it gotten better, worse, or stayed the same?

### B. Lessons Stated But Never Applied
Cross-reference "Key Lessons" from earlier milestones against "What Was Inefficient" from later milestones. If the same issue appears as a lesson in v1.0 and as an inefficiency in v1.5, the lesson was not applied.

### C. What Keeps Working
Find patterns that appear in "What Worked" across milestones — these are validated strengths to preserve.

### D. Cost Trends
Review "Cost Observations" sections for trends: are milestones getting faster? Are gap closure phases decreasing? Is the model mix shifting?

### E. Pattern Evolution
Track "Patterns Established" across milestones — which patterns stuck? Which were superseded?

## 4. Present Findings

Present findings in a structured format. Lead with the most actionable items.

```
## Reflection: {scope}

### Recurring Issues (appeared in N+ milestones)
1. **{Issue}** — {first seen} → {last seen} ({N} milestones)
   {One-line summary of the pattern}

2. ...

### Lessons Not Yet Applied
- **{Lesson from vX.Y}:** "{quoted lesson}"
  Still occurring as of vA.B: "{quoted inefficiency}"

### Validated Strengths
- {Pattern that keeps working and why}

### Cost Trends
- {Observation about efficiency over time}

### Open Questions
- {Question for the user based on what was found}
```

After presenting, ask:

Use AskUserQuestion:
- header: "Reflect"
- question: "What stands out to you? Any area you'd like to dig deeper into?"
- options:
  1. "Recurring issues" — "Explore why specific issues keep happening"
  2. "Unapplied lessons" — "Discuss why certain lessons weren't applied"
  3. "Cost & efficiency" — "Dig into cost trends and phase efficiency"
  4. "Ready to wrap up" — "Write up findings and commit"

## 5. Discussion Loop

Based on the user's selection, dive deeper into that area. Read additional phase artifacts if needed to understand root causes.

**For each follow-up:**
- Reference specific milestone data (quote the retro)
- Offer your analysis of why the pattern exists
- Suggest what to explore next

After each response, ask:

Use AskUserQuestion:
- header: "Continue"
- question: "Want to explore anything else, or ready to wrap up?"
- options:
  1. "Ask a question" — "I have a specific question about the workflow"
  2. "Explore another area" — "Go back to the findings overview"
  3. "Wrap up" — "Write the reflection document"

**If "Ask a question":** Let the user type their question (free text via Other), answer it grounded in the retro data, then loop back.

**If "Explore another area":** Return to step 4 options.

**If "Wrap up":** Proceed to step 6.

## 6. Write Reflection Document

Compile the discussion into a reflection document. Include:
- Scope and date
- Key findings (from step 4, refined by discussion)
- Discussion highlights (insights that emerged from follow-up questions)
- Suggested action items (framed as suggestions, not commitments)

**Write to:** `.planning/designs/YYYY-MM-DD-workflow-reflection.md`

Format:
```markdown
# Workflow Reflection — {date}

**Scope:** {scope description}
**Milestones reviewed:** {list}

## Key Findings

### Recurring Issues
{Findings from analysis, refined by discussion}

### Lessons Not Yet Applied
{Cross-referenced lessons vs continued inefficiencies}

### Validated Strengths
{Patterns that consistently work}

### Cost & Efficiency Trends
{Observations about how the workflow is trending}

## Discussion Highlights
{Key insights from the interactive discussion — what did we discover?}

## Suggested Improvements
{Actionable suggestions that emerged from the reflection. Frame as options, not mandates.}

- **{Suggestion 1}:** {description and rationale}
- **{Suggestion 2}:** {description and rationale}
```

**Commit** the document:
```bash
git add ".planning/designs/YYYY-MM-DD-workflow-reflection.md"
git commit -m "docs: add workflow reflection for {scope}"
```

Display:
```
Reflection written to .planning/designs/YYYY-MM-DD-workflow-reflection.md
```

</process>
