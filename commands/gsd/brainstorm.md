---
name: gsd:brainstorm
description: Brainstorm ideas, write a design doc, then optionally route into GSD milestone or project creation
argument-hint: "[topic]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
Run a collaborative brainstorming session: explore project context, ask clarifying questions one at a time, propose 2-3 distinct approaches with trade-offs and a recommendation, then present the selected approach as a design document in sections for approval. Approved design is written to `.planning/designs/` and committed to git. After commit, the workflow detects project state and offers to route into GSD milestone or project creation with design context seeded.

**How it works:**
1. Parse optional topic from arguments (prompt if not provided)
2. Explore project context — read project files, recent commits, and relevant source code
3. Ask 3-5 clarifying questions one at a time, preferring multiple choice format
4. Propose 2-3 approaches with pros, cons, and a recommendation
5. User selects an approach
6. Present design in sections scaled to complexity, with approval after each section
7. User can request revisions to any section before approving
8. Write approved design to `.planning/designs/YYYY-MM-DD-<topic>-design.md` and commit to git
9. Detect project state and ask user whether to create milestone/project or stop
10. Route into new-milestone (inline) or new-project (--auto) with design context

**Output:** Design document committed to `.planning/designs/`. Optionally routes into milestone or project creation.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/brainstorm.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the brainstorm workflow from @~/.claude/get-shit-done/workflows/brainstorm.md end-to-end.
</process>
