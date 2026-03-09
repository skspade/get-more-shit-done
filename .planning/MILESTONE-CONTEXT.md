# Milestone Context

**Source:** Brainstorm session (PR Review Kit to GSD Workflow Integration)
**Design:** .planning/designs/2026-03-09-pr-review-to-gsd-workflow-design.md

## Milestone Goal

Add a `/gsd:pr-review` command that runs or ingests PR review toolkit results, deduplicates findings via file-region grouping, scores complexity, and routes to quick task or milestone — enabling stateful resolution of PR review issues through the GSD system.

## Features

### Command Specification

`/gsd:pr-review` command with arguments: `--ingest` (paste existing review), `--quick`/`--milestone` (force routing), `--full` (enable plan-checker and verifier), and review aspect passthrough args. Command spec file and workflow file following existing GSD patterns.

### Review Capture

Two modes: (1) run `/pr-review-toolkit:review-pr` fresh and capture output, (2) `--ingest` mode for pasting pre-existing review summaries. Parses findings into structured format with severity, agent, description, file, line, and fix suggestion fields.

### Deduplication and File-Region Grouping

Groups findings by file proximity (same file, lines within 20 of each other). Merges overlapping groups. Each group captures primary file, line range, all findings, max severity, and agents involved. Prevents duplicate work when multiple review agents flag the same code region.

### Persistence and Scoring

Permanent review report written to `.planning/reviews/YYYY-MM-DD-pr-review.md` as audit trail. Temporary `review-context.md` for routing. Hybrid scoring heuristic: +2 per critical, +1 per important, +1 per 5 files affected. Score >= 5 routes to milestone, < 5 to quick. Override flags bypass heuristic.

### Quick Route Execution

Single quick task with one plan task per file-region group. Planner receives full review findings with fix suggestions. Executor handles all groups sequentially to avoid file conflicts. STATE.md updated with `pr-review` source notation.

### Milestone Route and Cleanup

MILESTONE-CONTEXT.md maps each file-region group as a feature. Delegates to new-milestone workflow steps 1-11. Temporary review-context.md deleted after routing. Permanent review report kept.
