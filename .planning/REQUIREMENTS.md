# Requirements: v2.2 PR Review Integration

## Command Infrastructure (CMD)

- [x] **CMD-01**: `/gsd:pr-review` command spec with YAML frontmatter and argument hint
- [x] **CMD-02**: Workflow parses `--ingest`, `--quick`, `--milestone`, `--full` flags and review aspect args
- [x] **CMD-03**: Errors when both `--quick` and `--milestone` flags are present

## Review Capture (REV)

- [x] **REV-01**: Fresh mode runs `/pr-review-toolkit:review-pr` with aspect passthrough and captures output
- [x] **REV-02**: Ingest mode prompts user for pre-existing review summary via AskUserQuestion
- [x] **REV-03**: Parses findings into structured format (severity, agent, description, file, line, fix_suggestion)
- [x] **REV-04**: Exits with "No actionable issues found" when no findings parsed

## Deduplication (DDP)

- [x] **DDP-01**: Sorts findings by file path then line number
- [x] **DDP-02**: Groups findings within same file and 20-line proximity into file-region groups
- [x] **DDP-03**: Merges overlapping groups transitively
- [x] **DDP-04**: Assigns max_severity, agents_involved, and line_range to each group
- [x] **DDP-05**: Displays dedup summary with raw vs grouped counts

## Persistence (PER)

- [x] **PER-01**: Writes permanent review report to `.planning/reviews/YYYY-MM-DD-pr-review.md`
- [x] **PER-02**: Writes temporary `review-context.md` with routing metadata
- [x] **PER-03**: Creates `.planning/reviews/` directory if needed

## Routing (RTE)

- [x] **RTE-01**: Scores findings: +2 critical, +1 important, +1 per 5 files
- [x] **RTE-02**: Routes score >= 5 to milestone, < 5 to quick
- [x] **RTE-03**: `--quick` and `--milestone` flags bypass scoring

## Quick Route (QCK)

- [x] **QCK-01**: Synthesizes description from grouped findings
- [x] **QCK-02**: Creates quick task directory via gsd-tools.cjs init
- [x] **QCK-03**: Spawns planner with review findings as context, one task per file-region group
- [x] **QCK-04**: Spawns executor for sequential fix execution
- [x] **QCK-05**: Updates STATE.md with pr-review source notation
- [x] **QCK-06**: Final commit with plan, summary, and state files

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 40 | Complete |
| CMD-02 | Phase 40 | Complete |
| CMD-03 | Phase 40 | Complete |
| REV-01 | Phase 40 | Complete |
| REV-02 | Phase 40 | Complete |
| REV-03 | Phase 40 | Complete |
| REV-04 | Phase 40 | Complete |
| DDP-01 | Phase 41 | Complete |
| DDP-02 | Phase 41 | Complete |
| DDP-03 | Phase 41 | Complete |
| DDP-04 | Phase 41 | Complete |
| DDP-05 | Phase 41 | Complete |
| PER-01 | Phase 41 | Complete |
| PER-02 | Phase 41 | Complete |
| PER-03 | Phase 41 | Complete |
| RTE-01 | Phase 42 | Complete |
| RTE-02 | Phase 42 | Complete |
| RTE-03 | Phase 42 | Complete |
| QCK-01 | Phase 42 | Complete |
| QCK-02 | Phase 42 | Complete |
| QCK-03 | Phase 42 | Complete |
| QCK-04 | Phase 42 | Complete |
| QCK-05 | Phase 42 | Complete |
| QCK-06 | Phase 42 | Complete |
| MST-01 | Phase 43 | Pending |
| MST-02 | Phase 43 | Pending |
| CLN-01 | Phase 43 | Pending |
| CLN-02 | Phase 43 | Pending |
| CLN-03 | Phase 43 | Pending |
| DOC-01 | Phase 44 | Pending |
| DOC-02 | Phase 44 | Pending |
| DOC-03 | Phase 44 | Pending |

## Future Requirements

(None deferred)

## Out of Scope

- Modifying the PR review toolkit itself — this workflow consumes its output, doesn't change it
- Automatic re-review after fixes — user can re-run manually
- PR comment posting (like Linear comment-back) — no GitHub PR integration for v2.2
- Cross-PR review aggregation — each invocation handles one review session
