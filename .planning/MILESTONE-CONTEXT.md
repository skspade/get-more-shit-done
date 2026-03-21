# Milestone Context

**Source:** Brainstorm session (PR Test Review Command)
**Design:** .planning/designs/2026-03-20-pr-test-review-command-design.md

## Milestone Goal

Create `/gsd:test-review` — a standalone command that analyzes git diff main...HEAD and produces test recommendations (missing coverage, stale tests, consolidation opportunities). Produces a shareable markdown report and optionally routes into quick task or milestone for actionable resolution. Built as a new diff-aware agent (gsd-test-reviewer) spawned by a thin command, following the audit-tests pattern.

## Features

### Command Specification
`/gsd:test-review` command file at `commands/gsd/test-review.md`. Gathers diff via `git diff main...HEAD`, collects test data via `gsd-tools.cjs test-count` and `test-config`, displays banner, spawns agent, presents report, writes to `.planning/reviews/YYYY-MM-DD-test-review.md`. Supports `--report-only` flag to skip routing. No arguments needed.

### Agent Definition
`gsd-test-reviewer` agent at `agents/gsd-test-reviewer.md`. Read-only analysis agent with 6-step process: parse diff, coverage gap analysis, staleness detection, consolidation analysis, generate recommendations, compile report. Receives diff + test data as XML input block. Uses steward vocabulary (prune/parameterize/promote/merge). Produces structured markdown report with summary stats, categorized findings, and priority-ordered actions.

### Report Persistence and Routing
Report written to `.planning/reviews/YYYY-MM-DD-test-review.md` and committed to git. When not `--report-only`, user is prompted to choose: quick task (recommendations as plan input), milestone (MILESTONE-CONTEXT.md from findings, delegate to new-milestone), or done (exit with report saved).

### Integration with Existing Infrastructure
Reuses `testing.cjs` utilities, `gsd-tools.cjs` dispatch entries, quick task infrastructure, and commit tooling. Purely additive — no modifications to existing files except documentation updates (help.md, USER-GUIDE.md, README.md).
