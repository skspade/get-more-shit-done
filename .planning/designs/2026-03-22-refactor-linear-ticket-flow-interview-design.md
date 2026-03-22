# Refactor Linear Ticket Flow: Interview the User if the Ticket is Vague — Design

**Date:** 2026-03-22
**Approach:** Interview-First Refactor

## Interview Phase (New Step 3)

After fetching the ticket (Step 2), insert a new interview phase that replaces the existing complexity scoring heuristic.

**Entry point:** Immediately after displaying fetched issue data.

**Pre-scan:** Before asking questions, Claude reads the ticket's title, description, labels, and comments to identify what information is already present. Build an internal checklist:
- Goal/purpose — clear from title + description?
- Scope — bounded (specific files, components, endpoints mentioned)?
- Success criteria — acceptance criteria or expected behavior stated?
- Approach preference — any technical direction indicated in comments?

**Question flow (3-5 adaptive, via AskUserQuestion):**

1. **Goal clarification** — "What's the core outcome you want from {issue.identifier}?" Skip if the description clearly states the goal. Use multiple choice when the title suggests 2-3 interpretations.

2. **Scope boundaries** — "How much of the codebase should this touch?" Options derived from the ticket context (e.g., "Just the API layer", "API + frontend", "Full stack"). Skip if the ticket explicitly names files or components.

3. **Success criteria** — "How will you know this is done?" Skip if acceptance criteria exist in the description. Otherwise offer options synthesized from the goal answer.

4. **Complexity signal** — "Does this feel like a quick fix or a multi-phase effort?" Options: "Quick task (hours)", "Medium (1-2 sessions)", "Milestone (multi-phase)". This directly feeds routing.

5. **Additional context** — "Anything else I should know?" Open-ended, asked only if previous answers surfaced ambiguity.

**After each answer:** Incorporate into understanding, skip remaining questions that are now answered.

**Output:** Store all interview Q&A as `$INTERVIEW_CONTEXT` for use in routing, approach proposals, and Linear comment-back.

## Routing Decision (New Step 4)

After the interview completes, determine the route based on interview answers — replacing the numeric scoring heuristic entirely.

**Routing logic:**

The complexity signal question (#4) is the primary routing input:
- **"Quick task (hours)"** → `$ROUTE = "quick"`
- **"Medium (1-2 sessions)"** → `$ROUTE = "quick"` (with `$FULL_MODE = true` for plan-checking and verification)
- **"Milestone (multi-phase)"** → `$ROUTE = "milestone"`

**Override flags still work:**
- `--quick` → force quick, skip complexity question but still run other interview questions
- `--milestone` → force milestone, skip complexity question but still run other interview questions
- `--full` → still sets `$FULL_MODE` for plan-checking/verification on quick route

**If complexity question was skipped** (because the ticket explicitly stated scope): Claude infers the route from the ticket content — single-file bug fix → quick, multi-component feature → milestone. Display the inferred route and ask for confirmation.

**Display:**
```
Route: {QUICK|MILESTONE} (from interview)
```

**Removed:** The entire `$MILESTONE_SCORE` calculation (sub-issues, description length, labels, relations scoring table). The interview captures this information more reliably through conversation.

## Hybrid Output (New Step 5)

After routing, present either a confirmation summary or approach proposals based on complexity.

**Quick route → Confirmation summary:**

```
## Task Understanding

**Issue:** {identifier} — {title}
**Goal:** {synthesized from interview}
**Scope:** {from interview answers}
**Success criteria:** {from interview answers}
**Route:** Quick task

Does this look right?
```

AskUserQuestion with options: "Yes, proceed" / "No, let me clarify"

If "No", re-ask the relevant interview question and re-present the summary.

**Milestone route → Approach proposals (brainstorm-style):**

Present 2-3 approaches with pros/cons, exactly like brainstorm Step 4:

```
## Proposed Approaches

### Approach 1: {Name}
{Description}
**Pros:** ...
**Cons:** ...

### Approach 2: {Name}
...

### Recommendation
I recommend **Approach {N}** because {reasoning tied to interview answers}.
```

AskUserQuestion to select approach. Selected approach feeds into MILESTONE-CONTEXT.md.

**Transition:** After confirmation (quick) or approach selection (milestone), proceed to write linear-context.md and execute route.

## Linear Comment-Back Before Execution (New Step 5.5)

After the user confirms/selects an approach but before execution begins, post the enriched context back to the Linear ticket.

**Comment body for quick route:**

```markdown
## GSD Interview Summary

**Goal:** {synthesized goal}
**Scope:** {scope from interview}
**Success criteria:** {criteria from interview}
**Route:** Quick task

Execution starting...
```

**Comment body for milestone route:**

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

**Post via MCP:**
```
mcp__plugin_linear_linear__create_comment(
  issueId: issue.id,
  body: interview_comment_body
)
```

Display: `✓ Interview summary posted to {issue.identifier}`

**On MCP failure:** Warning only — do not block execution:
```
⚠ Failed to post interview summary to {issue.identifier}. Continuing with execution.
```

**Note:** The existing completion comment-back (Step 6) remains unchanged. Each ticket gets two comments: one before execution (interview summary) and one after (completion summary).

## Workflow File Changes

Summary of structural changes to `get-shit-done/workflows/linear.md`:

**Steps renumbered:**

| Old Step | New Step | Content |
|----------|----------|---------|
| 1. Parse arguments | 1. Parse arguments | Unchanged |
| 2. Fetch issue data | 2. Fetch issue data | Unchanged |
| 3. Route via heuristic | **3. Interview** | **NEW** — 3-5 adaptive questions |
| — | **4. Route decision** | **NEW** — route from interview answers |
| — | **5. Hybrid output** | **NEW** — confirmation or approach proposals |
| — | **5.5. Comment-back** | **NEW** — post interview summary to Linear |
| 4. Write linear-context.md | 6. Write linear-context.md | Add `interview_summary` field to frontmatter |
| 5. Execute route | 7. Execute route | **Modified** — enriched descriptions |
| 6. Comment-back | 8. Completion comment-back | Unchanged |
| 7. Cleanup | 9. Cleanup | Unchanged |

**Removed:**
- `$MILESTONE_SCORE` calculation table (sub-issues, description length, labels, relations)
- Score-based routing threshold (`>= 3` → milestone)

**Modified in existing steps:**
- **linear-context.md** (Step 6): Add `interview_summary` text field to YAML frontmatter
- **Quick route description synthesis** (Step 7, 5a): Replace raw ticket truncation with interview-enriched context — goal, scope, and success criteria from interview answers replace the blunt `title + description[:1500]` truncation
- **Milestone MILESTONE-CONTEXT.md** (Step 7, 5a): Include selected approach name and description under a new `## Selected Approach` section

**Command spec** (`commands/gsd/linear.md`): Update objective description to mention interview phase. No new tools needed — `AskUserQuestion` is already in `allowed-tools`.

**Success criteria updates:** Replace scoring-related criteria with interview-related ones:
- ~~Routing heuristic scores on issue count, sub-issues, description, labels, relations~~
- ~~Score >= 3 routes to milestone, < 3 routes to quick~~
- Interview asks 3-5 adaptive questions, skipping answered ones
- Route determined from interview complexity signal
- Quick route shows confirmation, milestone route shows approach proposals
- Interview summary posted to Linear before execution
