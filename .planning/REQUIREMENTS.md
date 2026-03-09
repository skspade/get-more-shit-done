# Requirements: v2.2 PR Review Integration

## Command Infrastructure (CMD)

- [ ] **CMD-01**: `/gsd:pr-review` command spec with YAML frontmatter and argument hint
- [ ] **CMD-02**: Workflow parses `--ingest`, `--quick`, `--milestone`, `--full` flags and review aspect args
- [ ] **CMD-03**: Errors when both `--quick` and `--milestone` flags are present

## Review Capture (REV)

- [ ] **REV-01**: Fresh mode runs `/pr-review-toolkit:review-pr` with aspect passthrough and captures output
- [ ] **REV-02**: Ingest mode prompts user for pre-existing review summary via AskUserQuestion
- [ ] **REV-03**: Parses findings into structured format (severity, agent, description, file, line, fix_suggestion)
- [ ] **REV-04**: Exits with "No actionable issues found" when no findings parsed

## Deduplication (DDP)

- [ ] **DDP-01**: Sorts findings by file path then line number
- [ ] **DDP-02**: Groups findings within same file and 20-line proximity into file-region groups
- [ ] **DDP-03**: Merges overlapping groups transitively
- [ ] **DDP-04**: Assigns max_severity, agents_involved, and line_range to each group
- [ ] **DDP-05**: Displays dedup summary with raw vs grouped counts

## Persistence (PER)

- [ ] **PER-01**: Writes permanent review report to `.planning/reviews/YYYY-MM-DD-pr-review.md`
- [ ] **PER-02**: Writes temporary `review-context.md` with routing metadata
- [ ] **PER-03**: Creates `.planning/reviews/` directory if needed

## Routing (RTE)

- [ ] **RTE-01**: Scores findings: +2 critical, +1 important, +1 per 5 files
- [ ] **RTE-02**: Routes score >= 5 to milestone, < 5 to quick
- [ ] **RTE-03**: `--quick` and `--milestone` flags bypass scoring

## Quick Route (QCK)

- [ ] **QCK-01**: Synthesizes description from grouped findings
- [ ] **QCK-02**: Creates quick task directory via gsd-tools.cjs init
- [ ] **QCK-03**: Spawns planner with review findings as context, one task per file-region group
- [ ] **QCK-04**: Spawns executor for sequential fix execution
- [ ] **QCK-05**: Updates STATE.md with pr-review source notation
- [ ] **QCK-06**: Final commit with plan, summary, and state files

## Milestone Route (MST)

- [ ] **MST-01**: Builds MILESTONE-CONTEXT.md from file-region groups as features
- [ ] **MST-02**: Delegates to new-milestone workflow steps 1-11

## Cleanup (CLN)

- [ ] **CLN-01**: Deletes temporary review-context.md after completion
- [ ] **CLN-02**: Permanent review report preserved as audit trail
- [ ] **CLN-03**: Displays completion banner with route, report path, and artifacts

## Documentation (DOC)

- [ ] **DOC-01**: help.md updated with `/gsd:pr-review` command reference
- [ ] **DOC-02**: USER-GUIDE.md updated with PR review workflow documentation
- [ ] **DOC-03**: README.md updated with `/gsd:pr-review` in command table

## Traceability

| Requirement | Phase |
|-------------|-------|
| (To be filled by roadmapper) | |

## Future Requirements

(None deferred)

## Out of Scope

- Modifying the PR review toolkit itself — this workflow consumes its output, doesn't change it
- Automatic re-review after fixes — user can re-run manually
- PR comment posting (like Linear comment-back) — no GitHub PR integration for v2.2
- Cross-PR review aggregation — each invocation handles one review session
