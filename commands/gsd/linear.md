---
name: gsd:linear
description: Route a Linear issue to the appropriate GSD workflow (quick task or new milestone)
argument-hint: "<issue-id> [--quick|--milestone|--full]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
  - mcp__plugin_linear_linear__get_issue
  - mcp__plugin_linear_linear__list_comments
  - mcp__plugin_linear_linear__create_comment
  - mcp__plugin_linear_linear__list_issues
---
<objective>
Route Linear issues to GSD workflows. Fetches issue from Linear, conducts an adaptive interview to gather goal, scope, and complexity signal, then routes to quick or milestone workflow.

- Reads the Linear issue via MCP tools
- Conducts 3-5 adaptive interview questions covering goal, scope, criteria, and complexity
- Routes based on complexity signal from interview (quick task vs new milestone)
- Accepts override flags: --quick (force quick), --milestone (force milestone)
- Presents confirmation summary (quick) or approach proposals (milestone)
- Posts interview summary to Linear before execution, completion comment after
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/linear.md
</execution_context>

<context>
$ARGUMENTS

Context files are resolved inside the workflow (`init linear`) and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the linear workflow from @~/.claude/get-shit-done/workflows/linear.md end-to-end.
Preserve all workflow gates (issue fetch, interview, routing, hybrid output, execution, Linear status updates).
</process>
