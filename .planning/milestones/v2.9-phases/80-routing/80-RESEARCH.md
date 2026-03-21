# Phase 80: Routing - Research

**Researched:** 2026-03-21
**Status:** Complete

## Phase Scope

Phase 80 replaces the Step 12 placeholder in `test-review.md` with routing logic that lets users act on test review findings by choosing quick task, milestone, or done.

## Codebase Analysis

### Files to Modify

1. **`~/.claude/commands/gsd/test-review.md`** — Replace Step 12 placeholder with routing logic (Steps 12a-12f)

### Files to Reference (Read-Only)

1. **`~/.claude/get-shit-done/workflows/pr-review.md`** — Template for quick task route (Steps 8a-8i) and milestone route (Step 9)
2. **`~/.claude/get-shit-done/workflows/quick.md`** — Quick task directory creation, planner spawn, executor spawn, STATE.md update pattern
3. **`~/.claude/get-shit-done/workflows/brainstorm.md`** — SlashCommand delegation pattern for new-milestone (`SlashCommand("/gsd:new-milestone --auto")`)
4. **`agents/gsd-test-reviewer.md`** — Report format with Summary table for zero-recommendation detection

### Init Function

`cmdInitTestReview()` in `init.cjs` already returns all data needed for routing:
- `next_num`, `quick_dir` — for quick task directory creation
- `planner_model`, `executor_model` — for agent spawns
- `date`, `roadmap_exists`, `state_path` — for STATE.md updates

No modifications to `init.cjs` are needed.

## Key Patterns

### Zero-Recommendation Detection

The agent's `## REVIEWER COMPLETE` structured return includes a Summary table:
```
| Metric | Value |
|--------|-------|
| Missing test files | 0 |
| Coverage gaps | 0 |
| Stale tests | 0 |
| Consolidation opportunities | 0 |
```

Parse these four numeric values. If all are 0, skip routing with "No issues found" message.

### User Choice (vs Auto-Scoring)

Unlike pr-review which auto-scores and routes, test-review uses explicit user choice per requirements (RTE-01). Use AskUserQuestion with three options.

### Quick Task Route

Follows pr-review Steps 8a-8i pattern but with differences:
- Groups findings by **category** (missing coverage, coverage gaps, stale tests, consolidation) not by file proximity
- One plan task per recommendation category with findings
- Source column value: `test-review` (not `pr-review`)
- No plan-checker or verification steps (simple cleanup work)

### Milestone Route

Follows brainstorm.md pattern:
- Write MILESTONE-CONTEXT.md with Goal and Features sections
- Features organized by finding category
- Delegate via `SlashCommand("/gsd:new-milestone --auto")`
- Do NOT inline new-milestone steps (unlike pr-review which predates `--auto`)

### Report-Only Skip

Already handled: Step 11 exits before reaching Step 12 when `--report-only` is true. No additional logic needed.

## Complexity Assessment

This is a single-plan phase. All routing logic goes into one file (`test-review.md`). The patterns are well-established from pr-review and brainstorm workflows. Key differences from pr-review are:
1. User choice instead of auto-scoring
2. Category-based grouping instead of file-proximity dedup
3. SlashCommand delegation instead of inline new-milestone steps
4. No plan-checker/verification for quick route

## Dependencies

- Phase 78 (command infrastructure) — complete
- Phase 79 (analysis agent) — complete
- Agent report format is stable (Summary table parseable)

## Risk Areas

- **Summary table parsing:** Relies on exact format from gsd-test-reviewer agent. The format is defined in the agent spec and unlikely to change, but parsing should be tolerant of whitespace.
- **SlashCommand availability:** The command file already has `Task` and `AskUserQuestion` in its allowed-tools. It does NOT currently list `SlashCommand` — this needs to be added to the frontmatter `allowed-tools` for the milestone route to work.

---

*Phase: 80-routing*
*Research completed: 2026-03-21*
