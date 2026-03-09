---
name: gsd:pr-review
description: Run a fresh PR review or ingest an existing one, extract structured findings, and route to quick task or milestone
argument-hint: "[--ingest] [--quick|--milestone] [--full] [aspects...]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Run a PR review workflow: capture findings from a fresh toolkit review or ingest a pre-existing review summary, then extract structured findings for downstream processing.

- Fresh mode (default): invokes /pr-review-toolkit:review-pr to run a new review, captures aggregated output
- Ingest mode (--ingest): prompts user to paste a pre-existing review summary
- Parses review output into structured findings (severity, agent, description, file, line, fix_suggestion)
- Routes to quick task or milestone based on complexity scoring (--quick/--milestone override)
- Exits cleanly when no actionable issues found
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/pr-review.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the pr-review workflow from @~/.claude/get-shit-done/workflows/pr-review.md end-to-end.
</process>
