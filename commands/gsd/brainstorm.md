---
name: gsd:brainstorm
description: Start a collaborative brainstorming session that explores context, asks questions, and proposes approaches
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
Run a collaborative brainstorming session: explore project context, ask clarifying questions one at a time, then propose 2-3 distinct approaches with trade-offs and a stated recommendation.

**How it works:**
1. Parse optional topic from arguments (prompt if not provided)
2. Explore project context — read project files, recent commits, and relevant source code
3. Ask 3-5 clarifying questions one at a time, preferring multiple choice format
4. Propose 2-3 approaches with pros, cons, and a recommendation
5. User selects an approach

**Output:** Selected approach ready for design presentation (Phase 26 extension)
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
