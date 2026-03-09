# Phase 40: Command Spec and Review Capture - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

User can invoke `/gsd:pr-review` to run a fresh PR review or ingest an existing one, and the workflow extracts structured findings. This phase delivers the command spec file, the workflow file with argument parsing, both review capture modes (fresh and ingest), findings parsing into structured format, and the early-exit path for empty reviews. Deduplication, persistence, scoring, and routing are deferred to later phases.

</domain>

<decisions>
## Implementation Decisions

### Command Spec
- Command spec file at `commands/gsd/pr-review.md` with YAML frontmatter and argument hint
- Argument hint: `"[--ingest] [--quick|--milestone] [--full] [aspects...]"`
- Allowed tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion (Claude's Decision: matches linear.md tool set minus Linear MCP tools)
- Command delegates to workflow via `@~/.claude/get-shit-done/workflows/pr-review.md` in execution_context

### Argument Parsing
- Workflow parses `$ARGUMENTS` for `--ingest`, `--quick`, `--milestone`, `--full` flags and remaining tokens as review aspect args
- Error when both `--quick` and `--milestone` flags are present: "Cannot use both --quick and --milestone flags."
- Store parsed values: `$INGEST_MODE`, `$FORCE_QUICK`, `$FORCE_MILESTONE`, `$FULL_MODE`, `$REVIEW_ASPECTS`

### Fresh Review Mode
- Fresh mode (no `--ingest` flag) invokes `/pr-review-toolkit:review-pr` with aspect passthrough via the Skill tool (Claude's Decision: Skill tool is the standard way to invoke cross-toolkit commands)
- Capture the aggregated output as `$RAW_REVIEW`
- No pre-check for staged changes -- the toolkit handles its own preconditions (Claude's Decision: avoids duplicating toolkit validation logic that may change independently)

### Ingest Mode
- Ingest mode (`--ingest` flag) uses AskUserQuestion to prompt user for pre-existing review summary
- AskUserQuestion header: "PR Review Ingest", question: "Paste or provide the PR review summary:" (Claude's Decision: consistent with Linear's AskUserQuestion pattern for user input)
- Store response as `$RAW_REVIEW`

### Findings Parsing
- Parse `$RAW_REVIEW` into structured findings array with fields: severity, agent, description, file, line, fix_suggestion
- Severity mapped from section headers: `## Critical Issues` -> "critical", `## Important Issues` -> "important", `## Suggestions` -> "suggestion"
- Agent extracted from `[agent-name]:` prefix pattern
- File and line extracted from `[file:line]` reference pattern
- Findings with missing file/line get null values for those fields (Claude's Decision: general observations without file references are valid findings, handled in dedup phase)

### Empty Review Handling
- When no findings are parsed, display "No actionable issues found." and exit cleanly
- No error code -- clean exit since the review ran successfully (Claude's Decision: success with zero findings is not an error condition)

### Workflow File Structure
- Single workflow file `get-shit-done/workflows/pr-review.md` following the linear.md pattern
- Phase 40 implements steps 1-3 only (parse args, run/ingest review, parse findings)
- Subsequent phases extend the same workflow file with steps 4-11 (Claude's Decision: matches brainstorm.md incremental extension pattern across phases 25-27)

### Claude's Discretion
- Internal variable naming for parsed flags
- Exact regex patterns for extracting agent names and file references from review output
- Display formatting for the "No actionable issues found" message
- Order of flag checks in argument parsing

</decisions>

<specifics>
## Specific Ideas

- Design doc specifies parsing uses section headers (`## Critical Issues`, `## Important Issues`, `## Suggestions`) for severity mapping and `[agent-name]:` prefix plus `[file:line]` suffix for structured extraction
- The `/pr-review-toolkit:review-pr` command is an external toolkit that produces a "PR Review Summary" with Critical/Important/Suggestions sections -- this phase consumes that output format
- Findings structure from design doc: `{ severity, agent, description, file, line, fix_suggestion }`
- Command follows the same YAML frontmatter pattern as linear.md with `name`, `description`, `argument-hint`, `allowed-tools`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commands/gsd/linear.md`: Command spec pattern with YAML frontmatter, argument-hint, allowed-tools, execution_context delegation -- direct template for pr-review command spec
- `get-shit-done/workflows/linear.md`: Workflow pattern with step-based process, argument parsing with flag detection, AskUserQuestion for user input, error handling for conflicting flags -- direct template for pr-review workflow
- `get-shit-done/workflows/brainstorm.md`: Demonstrates incremental workflow extension across multiple phases (phases 25-27 each added steps to the same file)

### Established Patterns
- **Argument parsing**: Linear workflow parses `$ARGUMENTS` for flags (`--quick`, `--milestone`, `--full`) and remaining tokens -- pr-review uses identical pattern with added `--ingest` flag
- **Conflicting flag error**: Linear errors on `--quick` + `--milestone` -- pr-review uses the same error message pattern
- **AskUserQuestion for input**: Linear uses it for missing issue IDs, brainstorm uses it for topic and approvals -- pr-review uses it for ingest mode paste
- **Workflow delegation**: Commands reference workflows via `@~/.claude/get-shit-done/workflows/{name}.md` in execution_context

### Integration Points
- New command spec: `commands/gsd/pr-review.md` (new file)
- New workflow: `get-shit-done/workflows/pr-review.md` (new file)
- External dependency: `/pr-review-toolkit:review-pr` command (consumed, not modified)
- `$ARGUMENTS` passed from command spec to workflow via `<context>` block

</code_context>

<deferred>
## Deferred Ideas

- File-region deduplication and grouping (Phase 41: DDP-01 through DDP-05)
- Permanent review report and routing context persistence (Phase 41: PER-01 through PER-03)
- Scoring heuristic and routing decision (Phase 42: RTE-01 through RTE-03)
- Quick route execution (Phase 42: QCK-01 through QCK-06)
- Milestone route and MILESTONE-CONTEXT.md generation (Phase 43: MST-01, MST-02)
- Temp file cleanup and completion banner (Phase 43: CLN-01 through CLN-03)
- Documentation updates (Phase 44: DOC-01 through DOC-03)

</deferred>

---

*Phase: 40-command-spec-and-review-capture*
*Context gathered: 2026-03-09 via auto-context*
