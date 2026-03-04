# Phase 21: Core Workflow - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Create the `linear.md` workflow file that powers `/gsd:linear`. The workflow parses issue IDs and flags from arguments, fetches issue data and comments from Linear via MCP tools, applies a routing heuristic to choose quick or milestone, and delegates to the appropriate existing workflow. Comment-back and cleanup are Phase 22 -- this phase delivers the end-to-end routing and delegation pipeline.

</domain>

<decisions>
## Implementation Decisions

### Workflow file structure
- Single workflow file at `get-shit-done/workflows/linear.md` following `<purpose>/<required_reading>/<process>/<success_criteria>` structure (from existing quick.md and new-milestone.md patterns)
- Command spec already exists at `commands/gsd/linear.md` referencing `~/.claude/get-shit-done/workflows/linear.md` (from Phase 20, CMD-01)

### Argument parsing (WKFL-01)
- Issue IDs are any token matching letter-number pattern (e.g., `LIN-123`, `ENG-456`) -- accepts any Linear identifier format
- Flags: `--quick`, `--milestone`, `--full` parsed from `$ARGUMENTS`
- If no issue ID found after parsing, prompt user via `AskUserQuestion` with header "Linear Issue"
- `--full` is a pass-through to the quick workflow's `--full` flag (from design doc)

### Issue fetching (WKFL-02)
- Call `mcp__plugin_linear_linear__get_issue` with `includeRelations: true` for each issue ID
- Call `mcp__plugin_linear_linear__list_comments` for each issue ID
- Display fetched issue title, state, labels, and comment count (from ROADMAP success criteria #2)
- Error on fetch failure with clear message identifying the bad issue ID

### Routing heuristic (WKFL-03)
- Scoring system with `$MILESTONE_SCORE` starting at 0 (from ROADMAP success criteria #3)
- Multiple issues: +3 points
- Sub-issues / child issues: +2 points
- Description > 500 words: +1 point
- Labels matching "feature" or "epic": +2 points; labels matching "bug", "fix", "chore", "docs": -1 point
- Blocking or related issue relations: +1 point
- Score >= 3 routes to milestone, score < 3 routes to quick (from ROADMAP success criteria #3)
- Display routing decision with score

### Flag overrides (WKFL-04)
- `--quick` forces quick route regardless of heuristic score
- `--milestone` forces milestone route regardless of heuristic score
- Flag overrides bypass heuristic entirely (from ROADMAP success criteria #4)

### Quick route delegation (WKFL-05)
- Synthesize `$DESCRIPTION` from issue title + description + key comments, truncated to 2000 chars (Claude's Decision: prevents context bloat while preserving essential info)
- Generate slug via `gsd-tools.cjs generate-slug`
- Initialize via `gsd-tools.cjs init linear` for quick task numbering and models
- Execute quick workflow steps 2-8 inline (skipping step 1 since description is already synthesized)
- Append Linear issue ID context to planner prompt (Claude's Decision: gives planner traceability without modifying quick.md)

### Milestone route delegation (WKFL-06)
- Build MILESTONE-CONTEXT.md from issue data (titles as features, descriptions as details, comments as context)
- Write to `.planning/MILESTONE-CONTEXT.md` -- consumed by new-milestone workflow's step 2 detection
- For milestone models (`roadmapper_model`, `researcher_model`, `synthesizer_model`), call `gsd-tools.cjs init new-milestone` separately since `init linear` only provides quick-path models (Claude's Decision: reuses existing init command rather than modifying shipped init linear)
- Execute new-milestone workflow steps 1-11 inline with MILESTONE-CONTEXT.md pre-populated

### Init linear data usage
- Shipped `cmdInitLinear` returns: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `next_num`, `date`, `timestamp`, `quick_dir`, `state_path`, `roadmap_path`, `project_path`, `config_path`, `planning_exists`, `roadmap_exists`
- Quick path uses these fields directly
- Milestone path additionally calls `init new-milestone` for milestone-specific models (Claude's Decision: avoids modifying Phase 20 shipped code; init new-milestone already provides what the milestone path needs)

### Linear reference tracking
- Write `.planning/linear-context.md` with issue IDs and route decision as YAML frontmatter (from design doc)
- This file is consumed by Phase 22's cleanup step -- Phase 21 creates it, Phase 22 deletes it

### STATE.md Linear issue ID column
- When delegating to quick workflow, add Linear issue ID to the Quick Tasks Completed table row (from PROJECT.md active requirements)
- If table lacks a "Linear" column, add it to header and separator rows (Claude's Decision: self-healing schema migration keeps the table extensible)

### Banner and display formatting
- Follow existing GSD banner style with box-drawing characters (from quick.md and new-milestone.md patterns)
- Display routing decision with score and flag override indicator

### Claude's Discretion
- Exact issue ID regex pattern for parsing (any reasonable letter-dash-number pattern)
- Internal variable naming within the workflow steps
- Exact wording of error messages and prompts
- Order of heuristic scoring evaluations
- How to handle edge case of both `--quick` and `--milestone` flags present (Claude's Decision: first flag wins, or error -- either is reasonable)
- Description truncation strategy (hard truncate vs sentence-boundary truncate)

</decisions>

<specifics>
## Specific Ideas

- Design doc specifies comment-back format templates (Quick: task + commit + summary excerpt; Milestone: version + phase count + requirement count) -- but comment-back is Phase 22 scope, so the workflow should be structured to allow Phase 22 to add steps 8-9 cleanly
- Design doc mentions `.planning/linear-context.md` as the temporary file for cross-step state -- this is the bridge between Phase 21 (create) and Phase 22 (consume and delete)
- The `--full` flag only affects the quick route (enables plan-checking and verification) -- it has no effect on milestone routing
- Multiple issue IDs automatically score +3 on the heuristic, which meets the milestone threshold alone -- this means multiple issues always route to milestone unless `--quick` is forced

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/quick.md`: Complete quick workflow with steps 1-8 -- linear workflow delegates to steps 2-8 for quick route
- `get-shit-done/workflows/new-milestone.md`: Complete milestone workflow with steps 1-11 -- linear workflow delegates for milestone route with pre-populated MILESTONE-CONTEXT.md
- `get-shit-done/bin/lib/init.cjs` `cmdInitLinear`: Returns quick-path models, next task number, paths, timestamps
- `get-shit-done/bin/gsd-tools.cjs generate-slug`: Converts text to URL-safe slug for quick task directory names
- `commands/gsd/linear.md`: Command spec already wired with Linear MCP tools in allowed-tools

### Established Patterns
- Workflow structure: `<purpose>/<required_reading>/<process>/<success_criteria>` XML sections (all workflows follow this)
- Init-then-delegate: Workflows call `gsd-tools.cjs init X` for models and state, then spawn subagents via `Task()`
- Banner formatting: Box-drawing characters with `GSD >` prefix and step descriptions
- AskUserQuestion for missing required inputs with header/question/followUp structure
- Inline delegation: quick.md executes steps directly rather than spawning the workflow as a subagent

### Integration Points
- `~/.claude/get-shit-done/workflows/linear.md`: File must be created here (command spec already references this path)
- `.planning/MILESTONE-CONTEXT.md`: Written by linear workflow for milestone route, consumed by new-milestone workflow
- `.planning/linear-context.md`: Created by linear workflow to track issue IDs and route for Phase 22
- `.planning/STATE.md` Quick Tasks Completed table: Extended with Linear issue ID column
- MCP tools: `get_issue`, `list_comments`, `create_comment` (create_comment used in Phase 22, but allowed-tools already includes it)

</code_context>

<deferred>
## Deferred Ideas

- Comment-back to Linear issues after workflow completion (Phase 22, WKFL-07)
- Cleanup of `.planning/linear-context.md` temporary file (Phase 22, WKFL-08)
- USER-GUIDE.md and README.md documentation (Phase 23, DOCS-01, DOCS-02)
- Batch processing of all team issues (explicitly out of scope per REQUIREMENTS.md)
- Linear issue status updates (explicitly out of scope -- comment-back is sufficient)

</deferred>

---

*Phase: 21-core-workflow*
*Context gathered: 2026-03-03 via auto-context*
