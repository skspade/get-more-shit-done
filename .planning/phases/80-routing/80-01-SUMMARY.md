---
phase: 80-routing
plan: 01
status: complete
started: "2026-03-21"
completed: "2026-03-21"
requirements-completed: [RTE-01, RTE-02, RTE-03, RTE-04, RTE-05, RTE-06]
---

# Plan 80-01 Summary: Add routing logic to test-review command

**Executed:** 2026-03-21
**Status:** Complete

## What Changed

### `~/.claude/commands/gsd/test-review.md`

1. **Added `SlashCommand` to `allowed-tools`** in YAML frontmatter (needed for milestone route delegation)

2. **Updated `<objective>`** to reflect routing capability (not just report generation)

3. **Updated `<context>`** to document quick task data from init JSON (`next_num`, `quick_dir`, `planner_model`, `executor_model`)

4. **Updated Step 2 (Initialize)** to extract additional fields: `planner_model`, `executor_model`, `roadmap_exists`, `state_path`

5. **Replaced Step 12 placeholder** with full routing logic in sub-steps:

   - **12a. Parse Report Summary** — Extracts `MISSING_COUNT`, `GAPS_COUNT`, `STALE_COUNT`, `CONSOLIDATION_COUNT` from the agent's Summary table. Handles `## REVIEWER SKIPPED` edge case.

   - **12b. Zero-Recommendation Check** — When all four counts are 0, displays "No issues found. All changed code has adequate test coverage." and exits without routing (RTE-06).

   - **12c. User Choice Prompt** — Uses `AskUserQuestion` with three options: Quick task, Milestone, Done. Shows finding counts in the prompt. Done exits immediately (RTE-01, RTE-04).

   - **12d. Quick Task Route** — Creates `.planning/quick/{next_num}-{slug}/` directory, builds `<review_findings>` block organized by category (not file proximity), spawns gsd-planner in quick mode (one task per category), spawns gsd-executor, updates STATE.md with source `test-review`, commits, displays completion banner (RTE-02).

   - **12e. Milestone Route** — Writes `.planning/MILESTONE-CONTEXT.md` with Goal and Features sections organized by category, delegates via `SlashCommand("/gsd:new-milestone --auto")` (RTE-03).

## Requirements Addressed

| Requirement | How |
|-------------|-----|
| RTE-01 | AskUserQuestion with three options in Step 12c |
| RTE-02 | Quick task directory + planner + executor in Step 12d |
| RTE-03 | MILESTONE-CONTEXT.md + SlashCommand delegation in Step 12e |
| RTE-04 | "Done" branch exits with report saved in Step 12c |
| RTE-05 | Step 11 exits before Step 12 when --report-only (unchanged) |
| RTE-06 | Zero-recommendation check in Step 12b |

## Commit

File modified: `~/.claude/commands/gsd/test-review.md`
