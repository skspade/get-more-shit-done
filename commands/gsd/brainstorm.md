---
name: gsd:brainstorm
description: Start a collaborative brainstorming session that explores context, asks questions, proposes approaches, and writes an approved design doc
argument-hint: "[topic]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Run a collaborative brainstorming session: explore project context, ask clarifying questions one at a time, propose 2-3 distinct approaches with trade-offs and a recommendation, then present the selected approach as a design document in sections for approval. Approved design is written to `.planning/designs/` and committed to git.

**How it works:**
1. Parse optional topic from arguments (prompt if not provided)
2. Explore project context — read project files, recent commits, and relevant source code
3. Ask 3-5 clarifying questions one at a time, preferring multiple choice format
4. Propose 2-3 approaches with pros, cons, and a recommendation
5. User selects an approach
6. Present design in sections scaled to complexity, with approval after each section
7. User can request revisions to any section before approving
8. Write approved design to `.planning/designs/YYYY-MM-DD-<topic>-design.md` and commit to git

**Output:** Design document committed to `.planning/designs/`
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
