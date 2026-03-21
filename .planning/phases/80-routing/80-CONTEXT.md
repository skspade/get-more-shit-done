# Phase 80: Routing - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

User can act on test review findings by choosing quick task, milestone, or done. This phase adds routing logic to the existing `test-review.md` command file (Step 12 placeholder), replacing the current completion banner with user-choice prompting and route execution. Routing is skipped when `--report-only` was set (already handled in Step 11) or when the agent report contains zero recommendations. The quick task route creates a task directory with test recommendations as structured context, and the milestone route writes MILESTONE-CONTEXT.md and delegates to `/gsd:new-milestone --auto`.

</domain>

<decisions>
## Implementation Decisions

### Routing Trigger and Skip Conditions
- Routing is skipped when `--report-only` is true (already implemented in Step 11 of test-review.md command)
- Routing is skipped when the agent report has zero recommendations: parse the Summary table from the agent's report for `Missing test files`, `Coverage gaps`, `Stale tests`, `Consolidation opportunities` counts; if all are 0, display "No issues found. All changed code has adequate test coverage." and exit (from REQUIREMENTS.md RTE-06)
- Zero-recommendation detection parses the `### Summary` table at the end of the agent's report output (from gsd-test-reviewer.md report format — Summary table has `| Metric | Value |` rows with parseable counts)

### User Choice Prompt
- After report display, prompt user via AskUserQuestion with three options: quick task, milestone, or done (from REQUIREMENTS.md RTE-01)
- Done route exits immediately with report already saved (from REQUIREMENTS.md RTE-04)
- No auto-scoring heuristic — user always chooses (from REQUIREMENTS.md Out of Scope: "Auto-scoring and routing: Test findings are too subjective for numeric scoring — user chooses")

### Quick Task Route
- Creates task directory at `.planning/quick/{next_num}-{slug}` using init JSON `next_num` and a generated slug (from REQUIREMENTS.md RTE-02)
- Writes test recommendations as structured context in the planner prompt using `<review_findings>` XML block pattern (from pr-review.md quick route Step 8d)
- Spawns gsd-planner in quick mode with one plan task per recommendation category (missing coverage, coverage gaps, stale tests, consolidation) rather than per file-region group as pr-review does (Claude's Decision: test review findings are organized by category not file proximity — grouping by category maps naturally to plan tasks)
- Spawns gsd-executor to execute the plan, creates summary, updates STATE.md quick tasks table with `test-review` as Source column value (from pr-review.md Step 8h pattern)
- Does NOT include plan-checker or verification steps (Claude's Decision: test review quick tasks are focused cleanup work — full mode complexity is unnecessary and not specified in requirements)

### Milestone Route
- Writes `.planning/MILESTONE-CONTEXT.md` from findings with Goal and Features sections (from REQUIREMENTS.md RTE-03)
- Goal: "Address test coverage gaps and cleanup identified by test review across {N} files"
- Features: one section per finding category (Missing Coverage, Coverage Gaps, Stale Tests, Consolidation) listing specific files and recommendations (Claude's Decision: category-based features give the roadmapper better structure than flat file lists)
- Delegates to `/gsd:new-milestone --auto` via SlashCommand (from PROJECT.md Key Decisions: "SlashCommand delegation for brainstorm to milestone")

### Completion and Cleanup
- Quick route: commit plan, summary, STATE.md update via `gsd-tools.cjs commit` (from pr-review.md Step 8i pattern)
- Quick route: display completion banner with route, report path, directory, and commit hash (from pr-review.md Step 11 pattern)
- Milestone route: display completion banner with route, report path, and milestone info (from pr-review.md Step 11 pattern)

### Command File Modification
- Modify the existing `test-review.md` command file Step 12 to replace the placeholder completion banner with routing logic (Claude's Decision: routing is part of the command orchestrator flow, not a separate workflow file — matches the direct agent spawn pattern)
- Steps added: 12a (parse report summary), 12b (zero-recommendation check), 12c (user choice prompt), 12d (quick task route), 12e (milestone route), 12f (completion banner)

### Claude's Discretion
- Exact wording of the AskUserQuestion prompt and option labels
- Exact slug generation approach for quick task directory naming
- Order of fields in completion banner
- How recommendation categories are summarized in the planner prompt

</decisions>

<specifics>
## Specific Ideas

- The agent report's Summary table (at the end of the `## REVIEWER COMPLETE` structured return) has parseable `| Metric | Value |` rows. Extract numeric values from `Missing test files`, `Coverage gaps`, `Stale tests`, `Consolidation opportunities` rows to determine zero-recommendation state.
- Quick task STATE.md source column value should be `test-review` to distinguish from `pr-review` and Linear entries in the unified Source column.
- The milestone route should use SlashCommand("/gsd:new-milestone --auto") rather than inlining the new-milestone workflow steps, unlike pr-review which inlines them. The `--auto` flag handles all the skip logic. (Claude's Decision: pr-review was built before `--auto` existed; using SlashCommand is simpler and was established as the preferred pattern in v2.5)
- MILESTONE-CONTEXT.md source field should reference the test review report path for traceability.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `test-review.md` command file: Step 12 is the placeholder where routing logic will be inserted. Steps 1-11 already handle argument parsing, init, diff gathering, agent spawn, report write, and --report-only exit.
- `pr-review.md` workflow Steps 7-11: Template for routing logic — scoring/routing, quick task route (init, create dir, spawn planner, spawn executor, update STATE.md, commit), milestone route (MILESTONE-CONTEXT.md, delegate), cleanup, completion banner.
- `quick.md` workflow: Template for quick task creation — init, directory creation, planner spawn, executor spawn, STATE.md update.
- `cmdInitTestReview()` in `init.cjs`: Already returns `next_num`, `quick_dir`, `planner_model`, `executor_model`, `date`, `roadmap_exists` — all needed for quick route.
- `gsd-test-reviewer.md` agent: Produces structured report with `### Summary` table containing parseable counts for routing decisions.

### Established Patterns
- User-choice routing: pr-review uses auto-scoring; test-review uses explicit user choice per requirements (no scoring heuristic)
- Quick task directory: `.planning/quick/{next_num}-{slug}/` with plan and summary files inside
- STATE.md quick task table: `| # | Description | Date | Commit | Source | Directory |` format with Source column
- SlashCommand delegation: brainstorm.md uses `SlashCommand("/gsd:new-milestone --auto")` for milestone creation
- MILESTONE-CONTEXT.md: Standard bridge format with Source, Goal, and Features sections consumed by new-milestone workflow

### Integration Points
- `test-review.md` Step 12: Replace placeholder with routing logic
- `init.cjs` cmdInitTestReview: Already provides all data needed for routing (models, paths, quick task numbering)
- `.planning/MILESTONE-CONTEXT.md`: Written by milestone route, consumed and deleted by new-milestone workflow
- `.planning/STATE.md`: Quick tasks table updated with new row after quick route completes
- `.planning/reviews/YYYY-MM-DD-test-review.md`: Report already committed in Step 10, referenced by routing for context

</code_context>

<deferred>
## Deferred Ideas

- Documentation updates (help.md, USER-GUIDE.md, README.md) -- Phase 81
- Auto-run test-review during milestone audit -- post-v2.9 (from REQUIREMENTS.md future requirements INT-01)
- Plan-checker and verification for quick route -- could be added via `--full` flag in future if needed
- Budget impact projection in routing decisions -- post-v2.9 (from REQUIREMENTS.md future requirements INT-03)

</deferred>

---

*Phase: 80-routing*
*Context gathered: 2026-03-21 via auto-context*
