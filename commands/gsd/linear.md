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
Route Linear issues to GSD workflows. Fetches issue from Linear, auto-routes to quick or milestone based on complexity scoring, delegates to appropriate workflow.

- Reads the Linear issue via MCP tools
- Scores complexity to determine routing (quick task vs new milestone)
- Accepts override flags: --quick (force quick), --milestone (force milestone)
- Delegates to the appropriate GSD workflow with issue context
- Posts status comments back to Linear on completion
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
Preserve all workflow gates (issue fetch, complexity scoring, routing, execution, Linear status updates).
</process>
