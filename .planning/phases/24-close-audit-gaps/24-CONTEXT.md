# Phase 24: Close Audit Gaps - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Fix two audit gaps found after v1.4 phases 20-23 completed: the `/gsd:linear` command spec uses a hardcoded absolute path instead of a portable `~` path, and the Phase 23 SUMMARY.md is missing its `requirements_completed` frontmatter. Both are small, targeted edits -- no new features, no logic changes.

</domain>

<decisions>
## Implementation Decisions

### Command spec path fix (CMD-01)
- Replace `@/Users/seanspade/.claude/get-shit-done/workflows/linear.md` with `@~/.claude/get-shit-done/workflows/linear.md` in `commands/gsd/linear.md` (from ROADMAP success criteria #1)
- Fix applies to both occurrences: `<execution_context>` line 30 and `<process>` line 40 (from codebase scout -- the absolute path appears twice)
- Portable `@~/.claude/` prefix matches `quick.md` command spec convention (from codebase pattern)

### SUMMARY frontmatter fix (DOCS-01, DOCS-02)
- Add `requirements_completed: [DOCS-01, DOCS-02]` to `.planning/phases/23-documentation/23-01-SUMMARY.md` YAML frontmatter (from ROADMAP success criteria #2)
- Place after the `completed` field in the existing frontmatter block (Claude's Decision: follows natural ordering of metadata fields -- identification, dates, then completion tracking)

### Claude's Discretion
- Exact line placement of the `requirements_completed` field within the frontmatter block (as long as it is valid YAML)

</decisions>

<specifics>
## Specific Ideas

- `commands/gsd/quick.md` uses `@~/.claude/get-shit-done/workflows/quick.md` -- the linear command spec should follow the identical pattern
- The two absolute-path occurrences in `linear.md` are on line 30 (`<execution_context>`) and line 40 (`<process>`)
- The `23-01-SUMMARY.md` frontmatter currently has: `phase`, `plan`, `title`, `status`, `started`, `completed` -- the `requirements_completed` field is the only missing piece

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commands/gsd/quick.md`: Reference for correct portable path format (`@~/.claude/get-shit-done/workflows/quick.md`)

### Established Patterns
- Command specs use `@~/.claude/` prefix for workflow file references -- never absolute user paths
- SUMMARY.md frontmatter includes `requirements_completed` array listing which requirement IDs the plan addressed

### Integration Points
- `commands/gsd/linear.md` lines 30 and 40: two occurrences of the absolute path to replace
- `.planning/phases/23-documentation/23-01-SUMMARY.md` frontmatter block (lines 1-8): add `requirements_completed` field

</code_context>

<deferred>
## Deferred Ideas

None -- phase scope is well-defined with exactly two targeted fixes.

</deferred>

---

*Phase: 24-close-audit-gaps*
*Context gathered: 2026-03-03 via auto-context*
