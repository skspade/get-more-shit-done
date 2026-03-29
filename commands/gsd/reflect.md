---
name: gsd:reflect
description: Reflect on milestone and phase retrospectives to identify workflow improvements
argument-hint: "[version|all|topic] [--recent N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Run a reflective analysis session over completed milestones, phases, and retrospectives. Read-only exploration — no patches, no config changes. The goal is collaborative discussion: surface recurring patterns, unresolved lessons, and workflow friction, then let the user drive follow-up questions until ready to wrap up.

**How it works:**
1. Determine scope (specific milestone, recent N, all, or topic focus)
2. Read retrospective data, phase artifacts, and milestone audits
3. Analyze patterns: recurring inefficiencies, lessons stated but never applied, cost trends
4. Present findings as a structured discussion starter
5. User asks follow-up questions — we explore together
6. When done, write findings to `.planning/designs/YYYY-MM-DD-workflow-reflection.md` and commit

**Output:** A reflection document capturing findings and discussion points, committed to `.planning/designs/`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/reflect.md
</execution_context>

<context>
$ARGUMENTS

Scope options:
- `v1.3` or `1.3` — reflect on a specific milestone
- `all` — reflect across all milestones (default)
- `recent 3` or `--recent 3` — reflect on the last N milestones
- `"frontmatter"` or `"verification"` — focus on a specific topic across milestones
</context>

<process>
Execute the reflect workflow from @~/.claude/get-shit-done/workflows/reflect.md end-to-end.
</process>
