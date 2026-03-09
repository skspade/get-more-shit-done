---
phase: 40-command-spec-and-review-capture
plan: 01
subsystem: workflows
tags: [pr-review, command-spec, workflow, findings-parser]

requires:
  - phase: none
    provides: First phase of v2.2
provides:
  - /gsd:pr-review command spec with YAML frontmatter
  - pr-review workflow with argument parsing, fresh/ingest capture, findings extraction
affects: [phase-41-deduplication, phase-42-scoring, phase-43-milestone-route, phase-44-documentation]

tech-stack:
  added: []
  patterns: [pr-review-toolkit-consumption, findings-structure, section-header-severity-mapping]

key-files:
  created:
    - commands/gsd/pr-review.md
    - get-shit-done/workflows/pr-review.md
  modified: []

key-decisions:
  - "Followed linear.md command spec pattern exactly"
  - "Workflow implements steps 1-3 only, steps 4-11 are placeholders for phases 41-43"
  - "Findings structure: { severity, agent, description, file, line, fix_suggestion }"

patterns-established:
  - "PR review findings structure consumed by downstream phases"
  - "Section header severity mapping (## Critical Issues -> critical, etc.)"

requirements-completed: [CMD-01, CMD-02, CMD-03, REV-01, REV-02, REV-03, REV-04]

duration: 3min
completed: 2026-03-09
---

# Phase 40: Command Spec and Review Capture Summary

**/gsd:pr-review command spec and workflow with fresh/ingest capture modes and structured findings extraction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09
- **Completed:** 2026-03-09
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Command spec at commands/gsd/pr-review.md with YAML frontmatter, argument-hint, and allowed-tools
- Workflow with argument parsing for --ingest, --quick, --milestone, --full flags and aspect args
- Fresh mode invokes /pr-review-toolkit:review-pr via Skill tool with aspect passthrough
- Ingest mode prompts user to paste review via AskUserQuestion
- Structured findings extraction with severity, agent, description, file, line, fix_suggestion
- Clean exit with "No actionable issues found" for empty reviews
- Conflict detection for --quick + --milestone flag combination

## Task Commits

Each task was committed atomically:

1. **Task 1: Create command spec and workflow with argument parsing and capture modes** - `353c983` (feat)

## Files Created/Modified
- `commands/gsd/pr-review.md` - Command spec with YAML frontmatter delegating to workflow
- `get-shit-done/workflows/pr-review.md` - Workflow with arg parsing, capture modes, findings extraction

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow steps 1-3 complete, steps 4-11 are placeholders for phases 41-43
- Findings structure established for downstream deduplication and scoring
- No blockers for Phase 41

---
*Phase: 40-command-spec-and-review-capture*
*Completed: 2026-03-09*
