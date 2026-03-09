# Phase 41: Deduplication and Persistence - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Findings from Phase 40's structured parsing are grouped by file proximity (20-line threshold) with transitive merging, then written to two output files: a permanent review report at `.planning/reviews/YYYY-MM-DD-pr-review.md` for audit trail and a temporary `review-context.md` with routing metadata for downstream scoring/routing phases. The user sees a dedup summary showing raw vs grouped counts.

</domain>

<decisions>
## Implementation Decisions

### Deduplication Algorithm
- Sort findings by file path then line number
- Group findings within the same file and 20-line proximity into a single file-region group
- Merge overlapping groups transitively (A overlaps B, B overlaps C -> one group)
- Assign max_severity, agents_involved, and line_range to each group
- Findings with null file/line (general observations) each become their own single-finding group (Claude's Decision: general observations cannot be proximity-grouped, and collapsing unrelated observations would lose information)

### Group Data Structure
- Each group has fields: id, primary_file, line_range, findings, max_severity, agents_involved
- `id` follows `group-N` format (from design doc)
- `line_range` is `[start, end]` representing the min and max line numbers in the group
- `max_severity` uses priority order: critical > important > suggestion (Claude's Decision: highest severity drives urgency for downstream routing)

### Dedup Summary Display
- Display raw findings count vs grouped count with per-group detail lines
- Use the banner format from design doc: `GSD > PR REVIEW FINDINGS` header with box-drawing characters
- Each group line shows: primary_file:line_range, max_severity, finding count, agents involved (Claude's Decision: matches design doc display format exactly)

### Permanent Review Report
- Written to `.planning/reviews/YYYY-MM-DD-pr-review.md`
- YAML frontmatter with date, source, total_findings, groups, critical/important/suggestions counts
- Body contains summary paragraph and per-group sections with findings tables
- Create `.planning/reviews/` directory if it does not exist

### Temporary Routing Context
- Written to `.planning/review-context.md` (project root `.planning/` directory)
- YAML frontmatter with review_report path, route placeholder, score placeholder, groups count
- Route and score fields written as empty/placeholder since scoring happens in Phase 42 (Claude's Decision: Phase 41 writes the file structure; Phase 42 populates routing fields after scoring)

### Workflow Extension
- Extend existing `get-shit-done/workflows/pr-review.md` by replacing the placeholder "Steps 4-11" comment with Steps 4-6
- Step 4: Deduplication and grouping logic
- Step 5: Write permanent review report
- Step 6: Write temporary routing context
- Steps 7-11 remain as placeholder for Phases 42-43 (Claude's Decision: matches the incremental extension pattern used by brainstorm.md across phases 25-27)

### Claude's Discretion
- Exact proximity comparison logic (inclusive vs exclusive 20-line boundary)
- Internal sort implementation details
- YAML frontmatter key ordering in review report
- Variable naming for intermediate grouping state
- Markdown table column widths in the review report

</decisions>

<specifics>
## Specific Ideas

- Design doc specifies the exact dedup summary display format with box-drawing characters and `>` bullet per group showing `{group.primary_file}:{group.line_range} -- {group.max_severity} ({N} findings from {agents})`
- Review report format from design doc includes YAML frontmatter with metadata counts and per-group sections with markdown tables (columns: #, Severity, Agent, Description, Line, Fix)
- Routing context file from design doc: `.planning/review-context.md` with YAML frontmatter containing review_report path, route, score, groups count
- File-region group structure from design doc: `{ id, primary_file, line_range, findings, max_severity, agents_involved }`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/pr-review.md`: The workflow file from Phase 40 -- Steps 1-3 already parse args, capture review, and produce `$FINDINGS` array. This phase extends with Steps 4-6.
- `.planning/designs/2026-03-09-pr-review-to-gsd-workflow-design.md`: Contains the complete design spec with exact formats for dedup summary, review report, and routing context file.

### Established Patterns
- **Incremental workflow extension**: brainstorm.md was extended across phases 25-27 by adding steps to the same file. pr-review.md follows this same pattern.
- **YAML frontmatter in markdown files**: Used throughout the project for structured metadata (STATE.md, design docs). Review report and routing context follow this convention.
- **Directory creation on demand**: `mkdir -p` pattern used for `.planning/reviews/` matches how other `.planning/` subdirectories are created.

### Integration Points
- **Input**: `$FINDINGS` array produced by Step 3 of pr-review.md workflow (structured findings with severity, agent, description, file, line, fix_suggestion)
- **Output (permanent)**: `.planning/reviews/YYYY-MM-DD-pr-review.md` -- new file, new directory
- **Output (temporary)**: `.planning/review-context.md` -- consumed by Phase 42 scoring/routing, deleted by Phase 43 cleanup
- **Workflow file**: `get-shit-done/workflows/pr-review.md` -- extended in place

</code_context>

<deferred>
## Deferred Ideas

- Scoring heuristic and routing decision (Phase 42: RTE-01 through RTE-03)
- Quick route task creation and execution (Phase 42: QCK-01 through QCK-06)
- Milestone route and MILESTONE-CONTEXT.md generation (Phase 43: MST-01, MST-02)
- Temp file cleanup and completion banner (Phase 43: CLN-01 through CLN-03)
- Documentation updates (Phase 44: DOC-01 through DOC-03)

</deferred>

---

*Phase: 41-deduplication-and-persistence*
*Context gathered: 2026-03-09 via auto-context*
