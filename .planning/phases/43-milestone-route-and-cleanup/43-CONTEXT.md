# Phase 43: Milestone Route and Cleanup - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

High-scoring reviews are routed to a new milestone via MILESTONE-CONTEXT.md generation and new-milestone workflow delegation, and temporary files are cleaned up after either route completes. This phase implements Steps 9-11 of the pr-review.md workflow: milestone route (MILESTONE-CONTEXT.md build, new-milestone delegation), cleanup (delete review-context.md, preserve permanent report), and completion banner. The quick route is already complete from Phase 42.

</domain>

<decisions>
## Implementation Decisions

### Milestone Route (Step 9)
- Milestone route triggers when `$ROUTE == "milestone"` (from Step 7 scoring or `--milestone` flag override)
- Build MILESTONE-CONTEXT.md from file-region groups: each group becomes a "Feature" section with `### Fix: {primary_file} ({max_severity})` header
- MILESTONE-CONTEXT.md includes source reference to the permanent review report path, total findings count, group count, and review score
- Milestone goal line: "Resolve all critical and important issues identified by PR review across {N} files."
- Each feature section lists all findings from that group with agent, description, line, and fix suggestion
- Write to `.planning/MILESTONE-CONTEXT.md`

### New-Milestone Delegation (Step 9b)
- Initialize via `gsd-tools.cjs init new-milestone` to get researcher_model, synthesizer_model, roadmapper_model, and other config
- Execute new-milestone workflow steps 1-11 inline, following the exact pattern from Linear's milestone route (Claude's Decision: Linear's milestone route is the established delegation pattern and pr-review should mirror it exactly)
- MILESTONE-CONTEXT.md provides goal and features, replacing the questioning phase (step 2 of new-milestone)
- New-milestone step 6 deletes MILESTONE-CONTEXT.md after consuming it (built-in cleanup)
- Display banner after delegation completes: `GSD > PR REVIEW MILESTONE INITIALIZED`

### Cleanup (Step 10)
- Delete temporary `.planning/review-context.md` via `rm -f` after completion regardless of which route was taken
- Permanent review report at `.planning/reviews/YYYY-MM-DD-pr-review.md` is explicitly preserved -- serves as audit trail
- Cleanup runs after both quick route (Step 8) and milestone route (Step 9) -- shared exit path (Claude's Decision: single cleanup point after route-specific logic avoids duplication and ensures cleanup runs for both paths)

### Completion Banner (Step 11)
- Display unified completion banner with box-drawing characters matching the established GSD banner format
- Banner header: `GSD > PR REVIEW COMPLETE`
- Banner includes: source (findings count and group count), route taken, report path
- Quick route additionally shows: directory and commit hash
- Milestone route additionally shows: milestone version and name from new-milestone output
- Quick route already displays its own completion banner in Step 8i; Step 11 replaces it with the unified banner (Claude's Decision: design doc Step 11 is the canonical completion display for both routes, superseding the quick-specific banner in 8i)

### Workflow Extension
- Replace the `Steps 9-11: Milestone Route and Cleanup` placeholder in pr-review.md with the actual implementation
- Step 9: Milestone route (build MILESTONE-CONTEXT.md, delegate to new-milestone)
- Step 10: Cleanup (delete review-context.md)
- Step 11: Completion display (unified banner for both routes)
- Also update the quick route's Step 8i to skip its own completion banner, deferring to Step 11 (Claude's Decision: unified completion path means Step 8i should end after commit, letting Step 11 handle the banner for both routes)

### Claude's Discretion
- Exact markdown formatting of MILESTONE-CONTEXT.md feature sections
- Variable naming for new-milestone init JSON fields
- Display formatting details within the completion banner (spacing, alignment)
- How to extract milestone version/name from new-milestone workflow output

</decisions>

<specifics>
## Specific Ideas

- Design doc Step 9a provides the exact MILESTONE-CONTEXT.md template with Source, Findings, Score metadata and per-group feature sections
- Design doc Step 9b says "Same as Linear milestone route" -- call `gsd-tools.cjs init new-milestone`, parse JSON, execute new-milestone workflow steps 1-11 inline
- Design doc Step 10 specifies `rm -f .planning/review-context.md` for cleanup, explicitly noting the permanent report is kept
- Design doc Step 11 provides the exact completion banner format with conditional lines for quick vs milestone routes
- Linear workflow lines 420-493 demonstrate the complete milestone delegation pattern: build context file, init, execute steps 1-11 inline, display completion

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/pr-review.md`: Steps 1-8 already implemented. Steps 9-11 placeholder at the end needs replacement with actual milestone route, cleanup, and completion logic.
- `get-shit-done/workflows/linear.md` (lines 420-493): Complete milestone route implementation serving as the direct template -- MILESTONE-CONTEXT.md build, `gsd-tools.cjs init new-milestone`, inline execution of new-milestone steps 1-11.
- `get-shit-done/workflows/new-milestone.md`: The 11-step workflow that milestone delegation executes inline. Steps include load context, gather goals from MILESTONE-CONTEXT.md, version determination, PROJECT.md update, STATE.md update, cleanup/commit, research, requirements, roadmap, done.
- `get-shit-done/bin/gsd-tools.cjs`: Provides `init new-milestone` subcommand returning researcher_model, synthesizer_model, roadmapper_model, and other config fields.

### Established Patterns
- **Milestone delegation**: Linear workflow builds MILESTONE-CONTEXT.md, calls `gsd-tools.cjs init new-milestone`, then follows new-milestone.md steps 1-11 inline. PR review uses the identical pattern with review-specific context content.
- **MILESTONE-CONTEXT.md as bridge**: Both brainstorm and linear use this file to seed milestone creation with pre-gathered context, replacing the interactive questioning phase.
- **Incremental workflow extension**: pr-review.md has been extended across phases 40-42 by replacing placeholder comments with actual steps. Phase 43 replaces the final placeholder.
- **Banner format**: Box-drawing characters with `GSD >` prefix used throughout all GSD workflows for status and completion displays.

### Integration Points
- **Input**: `$ROUTE`, `$REVIEW_SCORE`, `$GROUPS` from Steps 7-8; `.planning/review-context.md` from Step 6; `.planning/reviews/YYYY-MM-DD-pr-review.md` from Step 5
- **Output (milestone)**: `.planning/MILESTONE-CONTEXT.md` (temporary, consumed and deleted by new-milestone step 6)
- **Output (cleanup)**: `.planning/review-context.md` deleted
- **Output (preserved)**: `.planning/reviews/YYYY-MM-DD-pr-review.md` kept as audit trail
- **Workflow file**: `get-shit-done/workflows/pr-review.md` -- final extension replacing Steps 9-11 placeholder

</code_context>

<deferred>
## Deferred Ideas

- Documentation updates for help.md, USER-GUIDE.md, and README.md (Phase 44: DOC-01, DOC-02, DOC-03)

</deferred>

---

*Phase: 43-milestone-route-and-cleanup*
*Context gathered: 2026-03-09 via auto-context*
