# Phase 22: Completion Loop - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

After the linear workflow's quick or milestone delegation completes, post a summary comment back to each Linear issue via MCP and delete the temporary `.planning/linear-context.md` file. This phase adds steps to the end of the existing `linear.md` workflow -- no new files, no new agents, no routing changes.

</domain>

<decisions>
## Implementation Decisions

### Comment-back mechanism (WKFL-07)
- Use `mcp__plugin_linear_linear__create_comment` to post summary comments to each issue ID from `$ISSUE_IDS` (from REQUIREMENTS.md WKFL-07)
- Quick completion comment includes task description, commit hash, and 2-3 sentence summary excerpt from SUMMARY.md (from design doc comment-back format)
- Milestone initialization comment includes milestone name (version + name), phase count, and requirement count (from design doc comment-back format)
- Comment body uses markdown formatting matching the design doc templates (from design doc)
- Read SUMMARY.md to extract summary excerpt for quick route comments (Claude's Decision: SUMMARY.md already contains the completion narrative -- extracting 2-3 sentences avoids duplicating synthesis logic)
- For milestone route, extract milestone name from ROADMAP.md or new-milestone output, phase count and requirement count from ROADMAP.md and REQUIREMENTS.md (Claude's Decision: these files are the source of truth for milestone metadata after new-milestone completes)
- Comment posted to every issue ID in `$ISSUE_IDS`, not just the first one (Claude's Decision: all linked issues should receive completion notification for traceability)

### Quick route comment template
- Template from design doc:
  ```
  ## GSD Quick Task Complete
  **Task:** [description]
  **Commit:** `[hash]`
  **Summary:** [2-3 sentences from SUMMARY.md]
  Artifacts: `.planning/quick/[N]-[slug]/`
  ```
- `$DESCRIPTION` and `$commit_hash` are already available from Step 5 execution (from linear.md workflow context)
- Summary excerpt extracted by reading SUMMARY.md and taking the first paragraph after the title (Claude's Decision: first paragraph is consistently the accomplishment summary across all GSD SUMMARY.md files)

### Milestone route comment template
- Template from design doc:
  ```
  ## GSD Milestone Initialized
  **Milestone:** v[X.Y] [Name]
  **Phases:** [N] planned
  **Requirements:** [N] mapped
  Roadmap: `.planning/ROADMAP.md`
  ```
- Milestone version and name from the new-milestone workflow output or ROADMAP.md latest milestone section (Claude's Decision: new-milestone workflow prints this in its Step 11 completion display)
- Phase count from ROADMAP.md phase list under the new milestone (Claude's Decision: ROADMAP.md is authoritative for phase structure)
- Requirement count from REQUIREMENTS.md active requirements (Claude's Decision: REQUIREMENTS.md is authoritative for requirement counts)

### Temporary file cleanup (WKFL-08)
- Delete `.planning/linear-context.md` after comment-back completes (from REQUIREMENTS.md WKFL-08, ROADMAP success criteria #3)
- Use `rm` via Bash or file deletion -- simple removal, no archival needed (Claude's Decision: this is a transient bridge file with no long-term value)
- Cleanup happens after comment-back, not before, so comment-back failures do not leave orphaned context files (Claude's Decision: cleanup is the final step to ensure all preceding steps have access to the context file if needed)

### Workflow modification approach
- Add new steps to the end of linear.md's process section after the existing Step 5 route execution (Claude's Decision: appending steps preserves all existing functionality and keeps the workflow sequential)
- Step 6: Comment-back to Linear issues (Claude's Decision: logically follows completion of the delegated workflow)
- Step 7: Cleanup temporary files (Claude's Decision: cleanup is always the last operation)
- Both steps execute regardless of which route was taken (quick or milestone), with route-specific comment templates (Claude's Decision: both routes need comment-back and cleanup)

### Error handling for comment-back
- If MCP comment creation fails, log the error but do not fail the overall workflow (Claude's Decision: comment-back is informational -- the primary work is already done and committed; failing the workflow over a comment would lose completed work)
- Display warning: "Warning: Failed to post comment to {ISSUE_ID}. The task completed successfully." (Claude's Decision: user should know the comment failed but also know their work is safe)

### Claude's Discretion
- Exact wording of comment body text beyond the template structure
- How to extract the 2-3 sentence summary excerpt (paragraph boundary, sentence count, character limit)
- Variable naming for comment body construction
- Whether to include a timestamp in the comment body
- Exact error message phrasing for MCP failures

</decisions>

<specifics>
## Specific Ideas

- Design doc provides exact comment-back templates for quick completion and milestone initialization (see "Comment-Back Format" section in `docs/plans/2026-03-03-linear-integration-design.md`)
- Design doc also includes a "Milestone complete" template but that applies when a full milestone finishes execution via autopilot -- out of scope for this phase since `/gsd:linear` only initializes milestones, it does not run them to completion
- The `linear-context.md` file written in Step 4 of linear.md contains `issue_ids` in YAML frontmatter -- Phase 22 steps can reference `$ISSUE_IDS` directly from workflow state rather than re-parsing the file
- The `create_comment` MCP tool is already in the command spec's `allowed-tools` list (added in Phase 20)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/linear.md`: The workflow file to be extended -- currently has Steps 1-5 covering parse, fetch, route, write context, and execute route
- `commands/gsd/linear.md`: Command spec already includes `mcp__plugin_linear_linear__create_comment` in allowed-tools
- `mcp__plugin_linear_linear__create_comment`: MCP tool accepting `issueId` (UUID) and `body` (markdown content) parameters

### Established Patterns
- Workflow steps are sequential and numbered -- new steps append after existing ones
- Banner formatting uses box-drawing characters with `GSD >` prefix (consistent across all workflows)
- Error handling in workflows displays warnings but continues execution for non-critical failures (e.g., classifyHandoffIfNeeded bug handling in quick workflow)
- SUMMARY.md files follow a consistent structure: frontmatter, title with description, Performance section, Accomplishments section

### Integration Points
- `linear.md` Step 5i (quick route) already captures `$commit_hash` and `$QUICK_DIR` -- these feed directly into the quick comment template
- `linear.md` Step 5c (milestone route) runs new-milestone inline -- milestone metadata (version, name, phase count, requirement count) needs to be captured from that output
- `.planning/linear-context.md` is the bridge file: created in Step 4, consumed/deleted in the new cleanup step
- `$ISSUES` array from Step 2 contains issue UUIDs needed for `create_comment` (the `id` field, not the `identifier` field)

</code_context>

<deferred>
## Deferred Ideas

- "Milestone complete" comment-back (design doc template exists but only applies after full autopilot execution, not after initialization)
- Linear issue status updates (explicitly out of scope per REQUIREMENTS.md)
- Retry logic for failed MCP comments (simple warn-and-continue is sufficient for v1.4)

</deferred>

---

*Phase: 22-completion-loop*
*Context gathered: 2026-03-03 via auto-context*
