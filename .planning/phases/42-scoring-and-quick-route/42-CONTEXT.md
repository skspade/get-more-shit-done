# Phase 42: Scoring and Quick Route - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Findings from Phase 41's file-region groups are scored using a hybrid heuristic (+2 critical, +1 important, +1 per 5 files) and routed to quick or milestone. This phase implements the scoring logic, flag overrides for `--quick` and `--milestone`, and the complete quick route: task directory creation, planner spawning with one task per file-region group, sequential execution, STATE.md update, and final commit. The milestone route itself is deferred to Phase 43.

</domain>

<decisions>
## Implementation Decisions

### Scoring Heuristic
- Score computed as: +2 per critical finding, +1 per important finding, +0 per suggestion, +1 per 5 distinct files affected
- Score >= 5 routes to milestone, < 5 routes to quick
- Minimum score is 0 (cannot go negative)
- `--quick` flag bypasses scoring and forces quick route
- `--milestone` flag bypasses scoring and forces milestone route
- Display routing decision: "Routing: {route} (score: {N})" or "Route: QUICK/MILESTONE (flag override)"
- Update `review-context.md` with computed route and score values after scoring (Claude's Decision: Phase 41 left these as placeholders; scoring populates them before routing consumes them)

### Quick Route Task Setup
- Synthesize description: "Fix PR review issues: {N} groups across {files}" with per-group one-line summaries, truncated to 2000 chars
- Initialize via `gsd-tools.cjs init pr-review` and `gsd-tools.cjs generate-slug`
- Create task directory at `.planning/quick/${next_num}-${SLUG}`
- Error if `roadmap_exists` is false: "Quick mode requires an active project with ROADMAP.md. Run `/gsd:new-project` first." (Claude's Decision: matches Linear quick route guard for consistency)

### Quick Route Planning
- Spawn gsd-planner with review findings as context, one task per file-region group
- Each task targets one file-region group with all findings from that group
- Planner prompt includes `<review_findings>` XML block with group details and fix suggestions
- Planner reads `.planning/reviews/YYYY-MM-DD-pr-review.md`, `.planning/STATE.md`, and `./CLAUDE.md`
- Constraint: do NOT split a file-region group across multiple tasks
- Plan-checker loop only when `$FULL_MODE` is true (same as Linear pattern)

### Quick Route Execution
- Spawn gsd-executor to execute all tasks sequentially
- Executor commits each task atomically and creates summary at `${QUICK_DIR}/${next_num}-SUMMARY.md`
- Verification step only when `$FULL_MODE` is true
- Handle `classifyHandoffIfNeeded` Claude Code bug: check summary file existence and git log if executor reports failure (Claude's Decision: reuse Linear's known-bug workaround to avoid false failure reporting)

### STATE.md Update
- Check for `### Quick Tasks Completed` section, create if missing
- Append row with: next_num, description, date, commit_hash, "pr-review" source notation, directory link
- Source column uses "pr-review" instead of Linear issue ID
- Update "Last activity" line with date and task description
- If table lacks a "Source" column, add it to header and separator rows (Claude's Decision: Linear added "Linear" column; pr-review needs a generic "Source" column that accommodates both)

### Final Commit
- Commit files: plan, summary, STATE.md, review-context.md, and verification if `$FULL_MODE`
- Commit message format: `docs(quick-${next_num}): Fix PR review issues`
- Get commit hash via `git rev-parse --short HEAD`

### Workflow Extension
- Extend `get-shit-done/workflows/pr-review.md` by replacing "Steps 7-11" placeholder with Steps 7-8 (scoring and quick route)
- Step 7: Score and route (scoring heuristic, flag override check, review-context.md update)
- Step 8: Quick route (synthesize, init, plan, execute, state update, commit)
- Steps 9-11 remain as placeholder for Phase 43 (milestone route, cleanup, completion)

### Claude's Discretion
- Exact truncation strategy for the 2000-char description limit
- Internal variable naming for score accumulation
- Display formatting for score breakdown details
- Order of file-region groups in planner prompt
- Exact wording of the roadmap-not-found error message

</decisions>

<specifics>
## Specific Ideas

- Design doc Step 7 specifies the exact scoring table: +2 critical, +1 important, +0 suggestion, +1 per 5 files
- Design doc Step 8 specifies planner prompt structure with `<review_findings>` and `<constraints>` XML blocks, one task per file-region group
- Design doc Steps 8e-8i say to follow the same plan-checker, executor, verification, STATE.md update, and final commit steps as Linear quick route, substituting "PR Review" for "Linear" in labels and banners
- The `gsd-tools.cjs init pr-review` call follows the same pattern as `init linear` -- returns planner_model, executor_model, checker_model, verifier_model, commit_docs, next_num, date, timestamp, quick_dir, state_path, roadmap_path, planning_exists, roadmap_exists

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/pr-review.md`: Steps 1-6 already implemented (arg parsing, review capture, findings parsing, dedup, persistence). This phase extends with Steps 7-8.
- `get-shit-done/workflows/linear.md`: Complete quick route implementation (Steps 5a-5i) serving as the template. PR review quick route mirrors this with review-specific context instead of Linear issue context.
- `get-shit-done/bin/gsd-tools.cjs`: Provides `init`, `generate-slug`, and `commit` subcommands used by the quick route.
- `.planning/designs/2026-03-09-pr-review-to-gsd-workflow-design.md`: Design doc with exact scoring table, planner prompt structure, and quick route steps.

### Established Patterns
- **Quick route lifecycle**: Linear workflow establishes the pattern: synthesize description -> init -> create directory -> spawn planner -> (optional checker) -> spawn executor -> (optional verifier) -> update STATE.md -> commit. PR review follows this identically.
- **Flag override before scoring**: Linear checks `$FORCE_QUICK` / `$FORCE_MILESTONE` before computing score. PR review uses the same guard pattern.
- **Incremental workflow extension**: brainstorm.md and pr-review.md both grow step-by-step across phases. Steps 7-8 added here, Steps 9-11 in Phase 43.
- **STATE.md quick tasks table**: Established by Linear with columns for #, Description, Date, Commit, Linear, Directory. PR review extends with a Source column approach.

### Integration Points
- **Input**: `$GROUPS` array from Step 4, `$FORCE_QUICK`/`$FORCE_MILESTONE` flags from Step 1, `$FULL_MODE` from Step 1
- **Input file**: `.planning/review-context.md` (written by Step 6, updated by Step 7 with score/route)
- **Output file**: `.planning/quick/${next_num}-${SLUG}/` directory with plan, summary, and optional verification
- **Output file**: `.planning/STATE.md` updated with quick task row
- **Workflow file**: `get-shit-done/workflows/pr-review.md` extended with Steps 7-8
- **Tool dependency**: `gsd-tools.cjs` for init, generate-slug, commit

</code_context>

<deferred>
## Deferred Ideas

- Milestone route and MILESTONE-CONTEXT.md generation (Phase 43: MST-01, MST-02)
- Temp file cleanup and completion banner (Phase 43: CLN-01, CLN-02, CLN-03)
- Documentation updates (Phase 44: DOC-01, DOC-02, DOC-03)

</deferred>

---

*Phase: 42-scoring-and-quick-route*
*Context gathered: 2026-03-09 via auto-context*
