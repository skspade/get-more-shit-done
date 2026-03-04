# Phase 23: Documentation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Update USER-GUIDE.md and README.md to document the `/gsd:linear` command. USER-GUIDE.md gets a command reference table entry and a dedicated Linear Integration section with flag descriptions and usage examples. README.md gets a brief mention of the Linear integration capability. No code changes, no workflow changes -- documentation only.

</domain>

<decisions>
## Implementation Decisions

### Command reference table entry (DOCS-01)
- Add `/gsd:linear <issue-id> [--quick\|--milestone\|--full]` to the USER-GUIDE.md command reference table
- Place it in the "Brownfield & Utilities" table alongside `/gsd:quick` since both are task-oriented entry points (Claude's Decision: Linear routing is a task launcher like quick, not a core workflow step)
- Argument hint matches the command spec frontmatter: `<issue-id> [--quick|--milestone|--full]`
- "When to Use" column: "Route a Linear issue to quick task or milestone" (Claude's Decision: mirrors the command spec description concisely)

### Linear Integration section in USER-GUIDE.md (DOCS-01)
- Add a new section titled "Linear Integration" under the Usage Examples section
- Include flag descriptions table with all three flags (`--quick`, `--milestone`, `--full`) and their behavior
- Include 4-5 usage examples covering: single issue, multiple issues, force quick, force milestone, full mode (Claude's Decision: covers all flags and the multi-issue case which triggers automatic milestone routing)
- Explain the routing heuristic briefly -- what factors drive quick vs milestone and the score threshold
- Mention the comment-back behavior (summary posted to Linear after completion)

### README.md mention (DOCS-02)
- Add `/gsd:linear <issue-id> [flags]` to the Utilities command table in README.md alongside `/gsd:quick`
- One-line description: "Route Linear issue to quick task or milestone" (Claude's Decision: matches the pattern of other entries -- brief action description)
- No dedicated section in README -- the README is a high-level overview and already links to the User Guide for details (Claude's Decision: README is already long; a table entry with a link to the User Guide is sufficient)

### Documentation style
- Follow the existing USER-GUIDE.md formatting conventions: markdown tables with `|` separators, code blocks with triple backticks, section headers with `###`
- Usage examples use the same format as "Quick Bug Fix" and "New Project" sections -- code block with `/gsd:linear` invocations
- Keep the Linear Integration section concise -- 30-50 lines total (Claude's Decision: matches the depth of the existing Quick Mode section in README.md as a comparable feature)

### Workflow diagram updates
- Do not add Linear to the Full Project Lifecycle diagram (Claude's Decision: `/gsd:linear` is an alternative entry point, not a step in the standard lifecycle -- adding it would misrepresent the core flow)
- No new diagram needed (Claude's Decision: the linear workflow delegates to existing quick and milestone flows which are already diagrammed)

### Claude's Discretion
- Exact wording of flag descriptions and usage example commentary
- Whether to include a "How routing works" subsection or inline the heuristic explanation
- Exact placement of the Linear Integration section relative to existing sections
- Whether to mention the MCP tool dependency in the user-facing docs

</decisions>

<specifics>
## Specific Ideas

- The command spec frontmatter already defines the argument-hint as `<issue-id> [--quick|--milestone|--full]` -- the documentation should match this exactly
- The routing heuristic scores on 6 factors: multiple issues (+3), sub-issues (+2), long description (+1), feature/epic labels (+2), bug/fix/chore/docs labels (-1), relations (+1) with threshold at score >= 3 for milestone
- Comment-back templates are defined in the workflow: "GSD Quick Task Complete" and "GSD Milestone Initialized" with specific fields
- The `--full` flag only affects quick route (adds plan-checking and verification) and has no effect on milestone routing
- Multiple issue IDs automatically score +3 which meets the milestone threshold, so multiple issues always route to milestone unless `--quick` is forced

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/USER-GUIDE.md`: Target file for DOCS-01 -- has established command reference tables, usage examples, and configuration sections to follow as patterns
- `README.md`: Target file for DOCS-02 -- has command tables in "Utilities" section with consistent `| Command | What it does |` format
- `commands/gsd/linear.md`: Command spec with frontmatter containing the canonical argument-hint and description
- `get-shit-done/workflows/linear.md`: Full workflow with all steps, flags, routing heuristic, and comment-back templates -- source of truth for documentation content

### Established Patterns
- USER-GUIDE.md command reference uses three-column tables: `| Command | Purpose | When to Use |`
- README.md command tables use two-column format: `| Command | What it does |`
- Usage examples in USER-GUIDE.md use code blocks with comments showing the command and context
- Sections in USER-GUIDE.md use `---` separators between major sections

### Integration Points
- `docs/USER-GUIDE.md` line 199-206: "Brownfield & Utilities" command table -- add `/gsd:linear` row here
- `docs/USER-GUIDE.md` line 340-376: "Usage Examples" section -- add Linear Integration subsection nearby
- `README.md` line 510-521: "Utilities" command table -- add `/gsd:linear` row here

</code_context>

<deferred>
## Deferred Ideas

- Documentation for batch processing of team issues (explicitly out of scope per REQUIREMENTS.md)
- CLI reference updates for `gsd` standalone binary (Linear is a Claude Code command, not a CLI command)
- Changelog updates (handled separately from user-facing docs)

</deferred>

---

*Phase: 23-documentation*
*Context gathered: 2026-03-03 via auto-context*
