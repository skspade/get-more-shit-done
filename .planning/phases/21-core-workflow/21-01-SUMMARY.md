---
phase: 21-core-workflow
plan: 01
subsystem: workflow
tags: [linear, mcp, routing, heuristic, workflow]

requires:
  - phase: 20-foundation
    provides: "cmdInitLinear function and /gsd:linear command spec"
provides:
  - "Linear issue routing workflow (linear.md)"
  - "Argument parsing for issue IDs and flags"
  - "MCP-based issue fetching (get_issue, list_comments)"
  - "Complexity scoring heuristic for quick vs milestone routing"
  - "Inline delegation to quick workflow (steps 2-8)"
  - "Inline delegation to new-milestone workflow (steps 1-11)"
affects: [phase-22-completion-loop, phase-23-documentation]

tech-stack:
  added: []
  patterns: [mcp-tool-integration, complexity-scoring-heuristic, inline-workflow-delegation]

key-files:
  created:
    - get-shit-done/workflows/linear.md
  modified: []

key-decisions:
  - "Single workflow file handles both quick and milestone routes via inline delegation rather than spawning workflows as subagents"
  - "Scoring heuristic uses additive points with minimum score of 0"
  - "Both --quick and --milestone flags present results in error (not first-wins)"
  - "Quick route uses init linear for models; milestone route additionally calls init new-milestone for milestone-specific models"
  - "linear-context.md written as bridge file for Phase 22 completion loop"

patterns-established:
  - "MCP tool integration: call get_issue with includeRelations then list_comments for full issue context"
  - "Complexity scoring: multiple signals combined into single score for routing decisions"
  - "Inline workflow delegation: execute another workflow's steps within a parent workflow"

requirements-completed:
  - WKFL-01
  - WKFL-02
  - WKFL-03
  - WKFL-04
  - WKFL-05
  - WKFL-06

duration: 5min
completed: 2026-03-03
---

# Phase 21: Core Workflow Summary

**Linear issue routing workflow with MCP fetching, complexity scoring heuristic, and dual-path delegation to quick or milestone workflows**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created linear.md workflow file (510 lines) powering the /gsd:linear command
- Implemented argument parsing for issue IDs (letter-dash-number pattern) and flags (--quick, --milestone, --full)
- Implemented Linear issue fetching via MCP tools (get_issue with includeRelations, list_comments)
- Built complexity scoring heuristic with 6 factors (issue count, sub-issues, description length, labels, relations)
- Implemented quick route delegation (synthesize description, init linear, inline quick steps 2-8)
- Implemented milestone route delegation (build MILESTONE-CONTEXT.md, init new-milestone, inline steps 1-11)
- Added linear-context.md creation for Phase 22 completion loop
- Added STATE.md Linear column extension for quick task tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the linear.md workflow file** - `694e56c` (feat)

## Files Created/Modified
- `get-shit-done/workflows/linear.md` - Core routing workflow for /gsd:linear command

## Decisions Made
- Error on conflicting --quick and --milestone flags rather than first-wins approach
- Minimum score of 0 (no negative scores) for routing heuristic
- Quick route uses first issue only for description synthesis even with multiple issues
- Milestone route delegates full new-milestone workflow steps 1-11 inline

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- linear.md workflow file is complete and referenced by the command spec from Phase 20
- Phase 22 can build on this by adding comment-back steps and linear-context.md cleanup
- Phase 23 can document /gsd:linear in USER-GUIDE.md and README.md

---
*Phase: 21-core-workflow*
*Completed: 2026-03-03*
