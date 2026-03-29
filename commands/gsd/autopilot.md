---
name: gsd:autopilot
description: Run entire milestone autonomously within this session
argument-hint: "[--from-phase N] [--dry-run] [--skip-verify-gate]"
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
Run an entire milestone end-to-end within a single chat session.

Orchestrator stays ultra-lean: read metadata via CLI, dispatch each lifecycle step (discuss, plan, execute, verify) as a subagent, check disk artifacts for progress, advance to next phase. Never read plan files, code, or summaries in main context.

Context budget: ~5% orchestrator, 100% fresh per subagent. Estimated ~33k tokens for a 10-phase milestone.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autopilot.md
</execution_context>

<context>
Arguments: $ARGUMENTS

**Flags:**
- `--from-phase N` — Start from a specific phase (default: auto-detect first incomplete)
- `--dry-run` — Print the execution plan without running any steps
- `--skip-verify-gate` — Skip interactive approval after each phase verification

Context resolved inside workflow via `gsd-tools init progress` and `gsd-tools phase status`.
</context>

<process>
Execute the autopilot workflow from @~/.claude/get-shit-done/workflows/autopilot.md end-to-end.
Preserve all workflow gates (circuit breaker, verification gate, gap closure, milestone completion).
</process>
