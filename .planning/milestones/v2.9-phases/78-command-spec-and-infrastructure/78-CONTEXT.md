# Phase 78: Command Spec and Infrastructure - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

User can invoke `/gsd:test-review` and receive a structured analysis report written to disk. This phase delivers the command orchestrator (`test-review.md`), the init function (`cmdInitTestReview` in `init.cjs`), the gsd-tools dispatch entry, diff gathering with size gating, report persistence, and edge case handling (no diff, large diff, `--report-only`). The agent definition and routing logic are out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Command File Structure
- Command file at `commands/gsd/test-review.md` following the direct agent spawn pattern from `audit-tests.md` (from ARCHITECTURE.md — no workflow file needed for linear flow)
- Command frontmatter: `name: gsd:test-review`, `argument-hint: "[--report-only]"`, allowed-tools include Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion (from design doc)
- `--report-only` flag parsed from `$ARGUMENTS` to skip routing and exit after report write (from REQUIREMENTS.md CMD-03)
- Command gathers `git diff` and spawns `gsd-test-reviewer` agent via `Task()` (from REQUIREMENTS.md CMD-01)

### Diff Gathering and Size Gate
- Use `origin/main` as diff base with fallback chain: `origin/main` -> `origin/master` -> `main` -> `master`; run `git fetch origin main --quiet` before diffing (from PITFALLS.md Pitfall 6)
- Exit gracefully with "No changes found vs main" when diff is empty (from REQUIREMENTS.md CMD-05)
- Diff size gate at ~2000 lines: measure via `wc -l`, switch to `--stat` + file list for large diffs instead of full diff (from REQUIREMENTS.md CMD-06, PITFALLS.md Pitfall 1)
- Capture full diff once, extract file names from it rather than running git diff twice (Claude's Decision: avoids 2x git overhead noted in PITFALLS.md performance traps)

### Banner Display
- Display banner with changed file count, test count, and budget status before spawning agent (from REQUIREMENTS.md CMD-02)
- Banner data sourced from `gsd-tools.cjs test-count --raw` and `gsd-tools.cjs test-config` (from design doc and ARCHITECTURE.md)

### Report Persistence
- Report written to `.planning/reviews/YYYY-MM-DD-test-review.md` (from REQUIREMENTS.md CMD-04)
- Report committed via `gsd-tools.cjs commit` as a separate commit before any routing (from design doc)
- Agent output IS the report — command writes it directly without restructuring (Claude's Decision: matches ARCHITECTURE.md integration gotcha about agent producing structured markdown per output format template)

### Init Function and Dispatch
- `cmdInitTestReview()` in `init.cjs` — near-copy of `cmdInitPrReview()` resolving models, quick task numbering, timestamps, paths, file existence (from ARCHITECTURE.md)
- `gsd-tools.cjs` gets `case 'test-review':` under the `init` switch routing to `cmdInitTestReview` (from ARCHITECTURE.md)
- Update the `Available:` error message list to include `test-review` (Claude's Decision: keeps error messages accurate per existing pattern)

### Agent Input Format
- Pass `<test-review-input>` XML block to agent containing: diff (or stat summary for large diffs), changed files list, test count, test config JSON, test file list (from design doc)
- For large diffs (>2000 lines), the XML block contains `--stat` output and changed file list instead of full diff, with instruction for agent to use Read/Grep tools for details (from PITFALLS.md Pitfall 1)
- Test files discovered via `gsd-tools.cjs test-count` and file list via Bash (Claude's Decision: consistent with audit-tests.md data gathering pattern)

### Claude's Discretion
- Exact banner formatting (unicode characters, ANSI colors, spacing)
- Order of prerequisite checks within the command process steps
- Variable naming in the command's bash snippets
- Exact wording of the "no changes" exit message

</decisions>

<specifics>
## Specific Ideas

- Base branch resolution should try `origin/main` first because stale local `main` is the most common failure mode (from PITFALLS.md Pitfall 6)
- The diff size threshold of ~2000 lines is a heuristic — the research notes it should be validated during implementation by observing agent behavior on varying diff sizes (from SUMMARY.md gaps)
- The `--report-only` exit point must be placed immediately after report write, before any routing code — not just a flag check that can be bypassed (from PITFALLS.md integration gotchas)
- Report filename uses `-test-review.md` suffix to distinguish from `-pr-review.md` reports in the same `reviews/` directory (from ARCHITECTURE.md)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cmdInitPrReview()` in `init.cjs` (line 785): Template for `cmdInitTestReview()` — resolves models, quick task numbering, timestamps, paths, file existence. Near-copy with minimal changes.
- `gsd-tools.cjs` init dispatch (line 604): Existing `case 'pr-review':` pattern to follow for adding `case 'test-review':`
- `audit-tests.md` command: Direct agent spawn pattern — gathers data, spawns agent via `Task()`, no workflow file
- `gsd-tools.cjs` `test-count` (line 642) and `test-config` (line 659): Existing dispatch entries for test data gathering
- `.planning/reviews/` directory: Shared report storage already used by pr-review reports

### Established Patterns
- Direct agent spawn: Command IS the orchestrator, spawns agent via `Task()`, no workflow file needed (audit-tests.md pattern)
- Init function pattern: Resolve models via `resolveModelInternal()`, compute quick task numbering, return structured JSON via `output()` (cmdInitPrReview pattern)
- gsd-tools dispatch: `case` statement under `init` switch, single-line call to init function (existing pattern for all 14 init workflows)
- XML input blocks: Structured data passed from command to agent as XML elements in the Task() prompt (pr-review, linear patterns)

### Integration Points
- `init.cjs` module.exports: Must add `cmdInitTestReview` to the exports object (line 834)
- `gsd-tools.cjs` init switch: Must add `case 'test-review':` before the `default:` case (line 607)
- `gsd-tools.cjs` Available list: Must update the error message string to include `test-review` (line 608)
- `.planning/reviews/` directory: Report file written here alongside existing pr-review reports

</code_context>

<deferred>
## Deferred Ideas

- Agent definition (`gsd-test-reviewer.md`) — Phase 79
- Quick task routing, milestone routing, and user-choice prompt — Phase 80
- Documentation updates (help.md, USER-GUIDE.md, README.md) — Phase 81
- Integration with `audit-milestone` for auto-running test-review during audits — post-v2.9 (from SUMMARY.md)
- Custom source-to-test file mapping configuration — post-v2.9 (from REQUIREMENTS.md future requirements)
- Budget impact projection — post-v2.9 (from REQUIREMENTS.md future requirements)

</deferred>

---

*Phase: 78-command-spec-and-infrastructure*
*Context gathered: 2026-03-21 via auto-context*
