# Milestone Context

**Source:** Brainstorm session (Refactor Linear Ticket Flow: Interview the user if the ticket is vague)
**Design:** .planning/designs/2026-03-22-refactor-linear-ticket-flow-interview-design.md

## Milestone Goal

Replace the numeric complexity scoring heuristic in `/gsd:linear` with an always-on interview phase. The interview asks 3-5 adaptive questions (like `/gsd:brainstorm`), determines routing from the user's answers instead of structural signals, presents a hybrid output (confirmation for quick tasks, approach proposals for milestones), and posts the enriched context back to Linear before execution begins.

## Features

### Interview Phase (New Step 3)
Insert an interview phase after ticket fetch that asks 3-5 adaptive questions via AskUserQuestion. Pre-scan the ticket to identify already-answered information and skip those questions. Questions cover: goal clarification, scope boundaries, success criteria, complexity signal, and additional context.

### Routing Decision (New Step 4)
Replace the `$MILESTONE_SCORE` heuristic with interview-driven routing. The complexity signal question directly determines the route: quick task, medium (quick + full mode), or milestone. Override flags (`--quick`, `--milestone`) still work by skipping the complexity question while running other interview questions.

### Hybrid Output (New Step 5)
After routing, quick tasks get a confirmation summary for approval. Milestone tasks get 2-3 approach proposals with pros/cons (brainstorm-style) and a recommendation. User confirms or selects before execution proceeds.

### Linear Comment-Back Before Execution (New Step 5.5)
Post the interview summary (goal, scope, criteria, route, selected approach) as a comment on the Linear ticket before execution starts. Failure is warning-only, non-blocking. The existing completion comment-back remains unchanged — tickets get two comments total.

### Workflow Restructuring
Renumber workflow steps to accommodate new phases. Remove the scoring calculation table and threshold logic. Update linear-context.md frontmatter with interview_summary field. Enrich quick route description synthesis with interview context instead of raw truncation. Add Selected Approach section to milestone MILESTONE-CONTEXT.md. Update command spec and success criteria.
