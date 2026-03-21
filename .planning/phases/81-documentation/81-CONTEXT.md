# Phase 81: Documentation - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can discover and learn how to use `/gsd:test-review` from project documentation. This phase updates three documentation files: help.md (command reference), USER-GUIDE.md (usage guide with examples), and README.md (command table entry). No code changes -- documentation only.

</domain>

<decisions>
## Implementation Decisions

### help.md Command Reference
- Add `/gsd:test-review` entry in the "Utility Commands" section after `/gsd:audit-tests` (from help.md structure -- test-review is a test utility like audit-tests)
- Entry format follows established pattern: bold command with flags, bullet list of capabilities, Usage examples (from help.md existing entries like pr-review, audit-tests)
- Document flags: `--report-only` (from REQUIREMENTS.md CMD-03)
- Document behavior: diff-aware analysis, coverage gaps, stale tests, consolidation opportunities, user-choice routing (quick task / milestone / done) (from REQUIREMENTS.md CMD-01 through RTE-06)
- Add quick reference section entry under a "Test Review:" heading after "PR Review:" in the quick reference block at the bottom of help.md (from help.md structure -- each command group has its own quick reference block)

### USER-GUIDE.md Usage Guide
- Add "Test Review" section after the existing "PR Review" section, before "Troubleshooting" (from USER-GUIDE.md structure -- test review is a review workflow like pr-review)
- Include pipeline diagram showing the flow: invoke -> diff gather -> agent analysis -> report -> routing (from USER-GUIDE.md pr-review section pattern with ASCII pipeline diagram)
- Include flags table with `--report-only` flag (from USER-GUIDE.md pr-review flags table pattern)
- Include examples section with common invocations: basic run, report-only mode (from USER-GUIDE.md pr-review examples pattern)
- Explain that routing is user-choice (quick task / milestone / done) with no auto-scoring, unlike pr-review which uses a scoring heuristic (from REQUIREMENTS.md Out of Scope: "Auto-scoring and routing")
- Mention report output path `.planning/reviews/YYYY-MM-DD-test-review.md` (from REQUIREMENTS.md CMD-04)
- Add command table row: `/gsd:test-review [--report-only]` with description and "when to use" (from USER-GUIDE.md command table pattern)

### README.md Command Table
- Add `test-review` row to the Commands table after `/gsd:pr-review` (from README.md command table -- test review is the next review command)
- Format: `| /gsd:test-review | Analyze test coverage gaps for current branch diff |` (Claude's Decision: description follows the terse style of existing README entries -- action-oriented, no flags listed)

### Content Accuracy
- Document the actual implemented behavior from Phases 78-80: diff gathering with size gate, agent spawn, structured report, user-choice routing with three options (from Phase 78-80 summaries)
- Do NOT document flags that don't exist (no --quick, --milestone, --ingest, --full -- those are pr-review flags) (Claude's Decision: test-review has only --report-only; documenting nonexistent flags would confuse users)
- Note that large diffs (>2000 lines) automatically switch to summarized mode (from REQUIREMENTS.md CMD-06)

### Claude's Discretion
- Exact wording of the pipeline diagram labels
- Order of bullet points within the help.md entry
- Exact phrasing of the "when to use" column in USER-GUIDE command table
- Whether to include a "Differences from pr-review" subsection in USER-GUIDE

</decisions>

<specifics>
## Specific Ideas

- The test-review command has only one flag (`--report-only`), making its documentation simpler than pr-review which has five flags. The flags table and examples sections should be correspondingly shorter.
- The pipeline diagram should show the user-choice routing step explicitly since it differentiates test-review from pr-review (user chooses vs auto-scoring).
- The report path uses `-test-review.md` suffix to distinguish from `-pr-review.md` in the same reviews directory -- worth mentioning in documentation.
- Zero-recommendation case (no issues found) should be mentioned -- the command handles this gracefully by skipping routing entirely.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/help.md`: Command reference file. pr-review entry at line 206 and audit-tests entry at line 356 serve as templates for test-review entry placement and format.
- `docs/USER-GUIDE.md`: User guide. PR Review section at line 622 serves as the template for a Test Review section -- same structure (pipeline, flags table, examples).
- `README.md`: Minimal quick start. Command table at line 77 with pr-review at line 89 -- test-review row goes after it.

### Established Patterns
- help.md entry format: Bold command with flags, dash-separated bullet list of features, Usage lines with examples, Result line showing output location
- USER-GUIDE.md section format: Heading, one-sentence description, Pipeline ASCII diagram, Flags table, optional subsections, Examples code block, closing note about output
- README.md table format: `| command | what it does |` -- terse, no flags in table

### Integration Points
- `get-shit-done/workflows/help.md`: Add entry in Utility Commands section and quick reference block
- `docs/USER-GUIDE.md`: Add section after PR Review, add row to command table
- `README.md`: Add row to Commands table

</code_context>

<deferred>
## Deferred Ideas

- Documentation for future INT-01 (auto-run during milestone audit) -- post-v2.9
- Documentation for future INT-02 (custom source-to-test mapping config) -- post-v2.9
- Documentation for future INT-03 (budget impact projection) -- post-v2.9

</deferred>

---

*Phase: 81-documentation*
*Context gathered: 2026-03-21 via auto-context*
