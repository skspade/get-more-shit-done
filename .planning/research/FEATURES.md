# Feature Landscape

**Domain:** Interview-driven routing refactor for Linear issue workflow in autonomous development framework
**Researched:** 2026-03-22
**Confidence:** HIGH (primary sources are the approved design document, existing GSD codebase patterns, and brainstorm workflow as proven interview model)

## Context: What Already Exists

This milestone REFACTORS an existing command, not building from scratch. The following are already built and operational:

- **`/gsd:linear` command + workflow** (`linear.md`) -- argument parsing, issue fetching via MCP, scoring heuristic (6-factor), quick/milestone routing with override flags, comment-back after completion, cleanup
- **`AskUserQuestion` tool** -- already in `allowed-tools` for the linear command spec; used for missing issue ID prompts
- **Brainstorm workflow** (`brainstorm.md`) -- 3-5 adaptive clarifying questions, approach proposals with pros/cons, AskUserQuestion-driven flow. This is the proven pattern for interview-style interaction
- **Linear MCP tools** -- `get_issue`, `list_comments`, `create_comment`, `list_issues` all available and tested
- **`linear-context.md`** -- temporary tracking file with YAML frontmatter, written during workflow and cleaned up after
- **Quick task infrastructure** -- slug generation, directory creation, planner/executor spawning, STATE.md updates
- **Milestone infrastructure** -- MILESTONE-CONTEXT.md bridge, new-milestone workflow delegation
- **Override flags** -- `--quick`, `--milestone`, `--full` already parsed and respected

The refactor REMOVES the numeric scoring heuristic and REPLACES it with an interview phase that captures richer context.

## Table Stakes

Features the user expects from this refactor. Missing = the refactor feels incomplete or regressive.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| 3-5 adaptive interview questions via AskUserQuestion | The core value proposition of the refactor. The numeric heuristic is being removed specifically because it cannot capture nuance. If the interview is not adaptive (skipping answered questions, adjusting based on prior answers), it is just a static form -- worse than the heuristic it replaces. | MEDIUM | AskUserQuestion (exists), fetched issue data (Step 2, exists) |
| Pre-scan of ticket content before questioning | Without pre-scan, the interview asks questions the ticket already answers (e.g., asking about scope when the ticket names specific files). This is what makes the interview "smart" vs "annoying." The design document specifies checking goal, scope, success criteria, and approach preference from ticket data before asking anything. | LOW | Fetched issue data including description, labels, comments (exists) |
| Complexity signal question as primary routing input | The design replaces the 6-factor scoring table with a single direct question: "Does this feel like a quick fix or a multi-phase effort?" with three options mapping to routes. This is the routing mechanism -- without it, there is no way to determine quick vs milestone. | LOW | AskUserQuestion (exists), routing infrastructure (exists) |
| Override flags still bypass interview routing | `--quick` and `--milestone` flags must still force routing. The design specifies they skip only the complexity question, not the entire interview -- other questions still run to gather context for execution. Removing flag support would be a regression. | LOW | Flag parsing (exists in Step 1) |
| Confirmation summary for quick route | After routing to quick, the user sees a structured summary (issue, goal, scope, success criteria, route) and confirms or requests clarification. Without this, the user cannot validate that the interview captured their intent correctly before execution starts. | LOW | Interview Q&A answers ($INTERVIEW_CONTEXT), AskUserQuestion (exists) |
| Approach proposals for milestone route | After routing to milestone, the user sees 2-3 brainstorm-style approaches with pros/cons and a recommendation. Without this, milestone routing loses the "what approach should we take?" step that brainstorm provides. The design explicitly references brainstorm Step 4 as the model. | MEDIUM | Interview Q&A answers, brainstorm approach proposal pattern (proven in brainstorm.md) |
| Interview summary posted to Linear before execution | Two-comment pattern: one before work (interview summary) and one after (completion summary). The pre-execution comment documents what was understood and agreed to. Without it, the Linear ticket has no record of the interview, making the conversation invisible to other team members. | LOW | `create_comment` MCP tool (exists), interview Q&A data |
| Non-blocking comment-back failure handling | Existing pattern: MCP failures for comment posting show a warning but do not block execution. The design explicitly specifies this: "Warning only -- do not block execution." Breaking this contract would make the workflow fragile. | LOW | Error handling pattern (exists in Step 6) |
| `$INTERVIEW_CONTEXT` stored and threaded through workflow | Interview answers must flow into: (1) routing decision, (2) confirmation/proposal output, (3) Linear comment-back, (4) linear-context.md frontmatter, (5) enriched task descriptions for quick route, (6) MILESTONE-CONTEXT.md for milestone route. Without context threading, the interview is wasted -- answers captured but not used. | MEDIUM | All downstream steps that consume interview data |
| Enriched task descriptions replacing raw truncation | Current quick route truncates `title + description[:1500]` for the planner. The refactor replaces this with interview-synthesized goal, scope, and success criteria. Without this, the interview improves routing but not execution quality -- half the value. | LOW | Interview Q&A answers, quick route planner prompt (exists, needs modification) |

## Differentiators

Features that make this refactor genuinely better than the heuristic it replaces, beyond just "works differently."

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| Inferred routing with confirmation when complexity question is skipped | When the ticket is explicit enough that the complexity question gets skipped, Claude infers the route from ticket content (single-file bug fix -> quick, multi-component feature -> milestone) and asks for confirmation. This handles the edge case where the most important question is not asked. | LOW | Pre-scan results, AskUserQuestion (exists) |
| Re-ask loop on confirmation rejection | Quick route confirmation includes "No, let me clarify" option that re-enters the relevant interview question rather than restarting the whole interview. Feels conversational rather than form-like. | LOW | AskUserQuestion (exists), interview state |
| Selected approach embedded in MILESTONE-CONTEXT.md | For milestone route, the user-selected approach name and description are written under a `## Selected Approach` section in MILESTONE-CONTEXT.md. This seeds the new-milestone workflow with a specific direction rather than leaving it to re-discover during requirements/roadmap. | LOW | Approach selection from milestone output step, MILESTONE-CONTEXT.md writing (exists) |
| `interview_summary` field in linear-context.md frontmatter | The temporary tracking file gains a text field summarizing interview Q&A. This provides a single-source record of what was discussed, accessible to any downstream step that reads the file. | LOW | linear-context.md writing (exists, needs field addition) |

## Anti-Features

Features to explicitly NOT build for this refactor.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| More than 5 interview questions | The design caps at 3-5 adaptive questions. Going beyond 5 turns the workflow from "quick interview" into "interrogation." The brainstorm pattern proves 3-5 is the sweet spot for balancing context capture vs user patience. | Stick to 5-question max. Pre-scan handles the rest. |
| Interview question configuration/customization | Adding config options for which questions to ask, question text, or question order adds complexity without clear value. The questions are designed to cover the universal dimensions of any task (goal, scope, criteria, complexity, context). | Hardcode the question flow in the workflow. Adapt via skipping, not configuration. |
| Persisting interview history across sessions | Storing past interviews for "learning" what a user typically wants adds state management complexity and raises questions about staleness. Each ticket is its own context. | Each invocation starts fresh. The Linear comment-back serves as the persistent record. |
| Auto-answering interview questions from ticket data | Instead of skipping questions that the ticket answers, auto-filling answers and presenting them for confirmation. This doubles the interaction surface (user must confirm each auto-answer) without adding value beyond the confirmation summary at the end. | Skip answered questions entirely. Present the synthesized confirmation summary once at the end. |
| Numeric scoring as fallback | Keeping the heuristic as a backup "in case the interview doesn't work." Two routing mechanisms means two code paths to maintain and explain. The whole point is that the interview is better. | Remove the scoring heuristic entirely. The complexity signal question is the replacement. |
| Interview for multi-issue batches | The current workflow supports multiple issue IDs. Interviewing about each issue individually would be tedious. The design does not address multi-issue interviews. | For multiple issues forced to quick via `--quick`, use first issue only (current behavior). For multiple issues that would route to milestone, the interview covers the batch as a unit, not per-issue. |
| Streaming/typing-indicator UX during interview | Adding visual feedback while Claude "thinks" about the next question. The interview questions are computed instantly from the pre-scan -- there is no meaningful computation delay to indicate. | Let AskUserQuestion handle its own UX. No additional indicators needed. |

## Feature Dependencies

```
Step 1: Parse arguments (EXISTS - unchanged)
    |
    v
Step 2: Fetch issue data (EXISTS - unchanged)
    |
    v
Step 3: Pre-scan ticket content (NEW)
    |-- Reads title, description, labels, comments
    |-- Builds internal checklist: goal, scope, criteria, approach
    |-- Determines which questions to skip
    |
    v
Step 3 continued: Interview questions (NEW)
    |-- Q1: Goal clarification (skip if clear from description)
    |-- Q2: Scope boundaries (skip if files/components named)
    |-- Q3: Success criteria (skip if acceptance criteria exist)
    |-- Q4: Complexity signal (skip if --quick or --milestone flag)
    |-- Q5: Additional context (only if ambiguity surfaced)
    |-- Each answer informs next question (adaptive)
    |-- Store all Q&A as $INTERVIEW_CONTEXT
    |
    v
Step 4: Routing decision (REPLACES Step 3 heuristic)
    |-- Complexity signal answer -> route
    |-- If Q4 skipped: infer from ticket content + confirm
    |-- Override flags still respected
    |
    +---> Quick route: Step 5a confirmation summary (NEW)
    |         |-- Synthesized task understanding
    |         |-- "Does this look right?" with yes/no
    |         |-- "No" -> re-ask relevant question
    |
    +---> Milestone route: Step 5b approach proposals (NEW)
              |-- 2-3 approaches with pros/cons
              |-- Recommendation with reasoning
              |-- AskUserQuestion to select approach
    |
    v
Step 5.5: Comment-back before execution (NEW)
    |-- Build comment body from $INTERVIEW_CONTEXT + route
    |-- Post via create_comment MCP
    |-- Warning on failure, do not block
    |
    v
Step 6: Write linear-context.md (EXISTS - MODIFIED)
    |-- Add interview_summary field to frontmatter
    |
    v
Step 7: Execute route (EXISTS - MODIFIED)
    |-- Quick: enriched description from interview (replaces truncation)
    |-- Milestone: MILESTONE-CONTEXT.md includes selected approach
    |
    v
Step 8: Completion comment-back (EXISTS - unchanged)
    |
    v
Step 9: Cleanup (EXISTS - unchanged)
```

### No New Files Required

This refactor modifies two existing files (workflow + command spec). No new agents, commands, or modules are created. The interview logic lives inline in the workflow, following the brainstorm pattern where question logic is embedded in the workflow file rather than extracted to a separate agent.

## MVP Recommendation

### Launch With (v3.0)

All features are part of a single workflow refactor. Prioritize implementation in this order:

1. **Pre-scan + interview questions (Step 3)** -- the core new behavior
2. **Routing decision from interview (Step 4)** -- replace the scoring heuristic
3. **Hybrid output: confirmation + proposals (Step 5)** -- user-facing payoff
4. **Pre-execution comment-back (Step 5.5)** -- simple MCP call
5. **Workflow modifications (Steps 6-7)** -- enriched context threading
6. **Step renumbering + success criteria updates** -- structural cleanup
7. **Command spec update** -- objective description change

### Defer (post-v3.0)

- **Multi-issue interview strategy** -- how to interview when multiple issue IDs are provided
- **Interview analytics** -- tracking which questions get skipped most often

## Sources

- `.planning/designs/2026-03-22-refactor-linear-ticket-flow-interview-design.md` -- Approved design document
- `.planning/PROJECT.md` -- v3.0 active requirements
- `get-shit-done/workflows/linear.md` -- Current linear workflow
- `get-shit-done/workflows/brainstorm.md` -- Proven adaptive question + approach proposal pattern
- `commands/gsd/linear.md` -- Current command spec

---
*Feature research for: /gsd:linear interview-driven routing refactor (GSD v3.0)*
*Researched: 2026-03-22*
