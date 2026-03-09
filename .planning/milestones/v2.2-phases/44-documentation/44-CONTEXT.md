# Phase 44: Documentation - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can discover and learn the `/gsd:pr-review` workflow from project documentation. This phase updates three documentation files: help.md (command reference with argument details and usage examples), USER-GUIDE.md (end-to-end PR review workflow section covering capture, dedup, scoring, and routing), and README.md (command table entry for `/gsd:pr-review`). No code changes -- documentation only.

</domain>

<decisions>
## Implementation Decisions

### help.md Updates
- Add `/gsd:pr-review` section under a new "### PR Review" heading after the "### Brainstorming" section in the command reference
- Include full argument reference: `--ingest`, `--quick`, `--milestone`, `--full`, and `[aspects...]` passthrough
- Include 4-5 usage examples covering: default fresh review, ingest mode, force quick, force milestone, aspect passthrough (Claude's Decision: matches brainstorm section which has 2 examples; pr-review has more flags so warrants more examples)
- Description matches command spec: "Run a fresh PR review or ingest an existing one, extract structured findings, and route to quick task or milestone"
- Add a "PR Review" entry to the "Common Workflows" section with a usage block (Claude's Decision: brainstorm has a Common Workflows entry, pr-review should follow the same pattern)

### USER-GUIDE.md Updates
- Add a "### PR Review" section after the "### Brainstorming" subsection in the Usage Examples area
- Document the end-to-end workflow: capture (fresh/ingest), findings parsing, deduplication, scoring, routing (quick/milestone), cleanup
- Include a flags table matching the Linear Integration format: Flag | Effect columns
- Include routing heuristic explanation: +2 critical, +1 important, +1 per 5 files, score >= 5 routes to milestone
- Include 4-6 usage examples covering all flag combinations
- Add `/gsd:pr-review` row to the "Brownfield & Utilities" command table (Claude's Decision: pr-review is a utility command like linear and brainstorm, fits this table)
- Add a workflow diagram showing the pr-review pipeline (Claude's Decision: USER-GUIDE has diagrams for other workflows; a text diagram for capture->dedup->score->route helps users understand the flow)

### README.md Updates
- Add `/gsd:pr-review` row to the Commands table
- Entry text: "Route PR review findings to quick task or milestone"
- Place after the `/gsd:quick` row (Claude's Decision: pr-review is a task-creation command like quick, grouping them together is logical)

### Documentation Style
- Follow existing documentation patterns exactly: same markdown formatting, same table column structures, same heading hierarchy
- Flags table uses `*(none)*` for default behavior row, matching the Linear flags table format
- Usage examples use fenced code blocks with no language tag, matching existing examples

### Claude's Discretion
- Exact wording of the workflow description paragraph in USER-GUIDE.md
- Ordering of usage examples within each documentation file
- Exact text-art format for the workflow diagram in USER-GUIDE.md
- Whether to include the scoring formula inline or as a separate subsection

</decisions>

<specifics>
## Specific Ideas

- REQUIREMENTS.md DOC-01 specifies: "help.md updated with `/gsd:pr-review` command reference"
- REQUIREMENTS.md DOC-02 specifies: "USER-GUIDE.md updated with PR review workflow documentation"
- REQUIREMENTS.md DOC-03 specifies: "README.md updated with `/gsd:pr-review` in command table"
- Success criteria specify help.md needs "argument reference and usage examples"
- Success criteria specify USER-GUIDE.md documents "the PR review workflow end-to-end (capture, dedup, scoring, routing)"
- Success criteria specify README.md "command table includes `/gsd:pr-review` entry"
- The pr-review command spec YAML frontmatter provides the canonical argument-hint: `"[--ingest] [--quick|--milestone] [--full] [aspects...]"`
- Linear Integration section in USER-GUIDE.md (lines 516-553) is the direct template for PR Review section structure (flags table + routing heuristic + examples)
- Brainstorming section in help.md (lines 188-202) is the direct template for PR Review section structure

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/help.md`: The help command reference file. PR Review section goes after the Brainstorming section (line ~202). Also needs a Common Workflows entry.
- `docs/USER-GUIDE.md`: The user guide. Linear Integration section (lines 516-553) provides the exact template: flags table, routing heuristic, examples. PR Review section follows the same structure.
- `README.md`: The project README. Commands table (lines 77-90) needs a new row for `/gsd:pr-review`.
- `commands/gsd/pr-review.md`: The command spec provides the canonical description and argument-hint for documentation.
- `get-shit-done/workflows/pr-review.md`: The complete workflow provides the technical details to document (11 steps, scoring formula, routing logic).

### Established Patterns
- **Documentation mirroring between commands**: Linear has entries in all three files (help.md, USER-GUIDE.md, README.md). Brainstorm has entries in all three files. PR Review follows the same three-file pattern.
- **Flags table format**: Linear's USER-GUIDE section uses a `| Flag | Effect |` table. PR Review uses the same format with its own flags.
- **Usage examples format**: Fenced code blocks with `#` comments explaining each invocation. Both Linear and brainstorm use this pattern.
- **Command table in README**: Two columns `| Command | What it does |`. One row per command with concise description.

### Integration Points
- **help.md**: New section insertion point after Brainstorming section (~line 202), new Common Workflows entry
- **USER-GUIDE.md**: New section insertion point after Brainstorming section (~line 565), new row in Brownfield & Utilities table (~line 312)
- **README.md**: New row in Commands table (~line 88, after `/gsd:quick`)

</code_context>

<deferred>
## Deferred Ideas

None -- phase scope is well-defined. This is the final phase of v2.2 and covers all three documentation requirements.

</deferred>

---

*Phase: 44-documentation*
*Context gathered: 2026-03-09 via auto-context*
