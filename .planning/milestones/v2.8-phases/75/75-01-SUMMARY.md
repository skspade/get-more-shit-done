---
phase: 75
plan: 01
subsystem: workflows
tags: [audit-milestone, plan-milestone-gaps, frontmatter, test-consolidation, status-routing]

requires:
  - phase: 74
    provides: "v2.7 complete with steward producing consolidation proposals"
provides:
  - "gaps.test_consolidation schema in MILESTONE-AUDIT.md frontmatter"
  - "Consolidation-aware status routing (tech_debt for consolidation-only)"
  - "plan-milestone-gaps parsing of test_consolidation gap type"
affects: [phase-76, plan-milestone-gaps, audit-milestone]

tech-stack:
  added: []
  patterns: ["gaps.test_consolidation array parallel to requirements/integration/flows"]

key-files:
  created: []
  modified: [get-shit-done/workflows/audit-milestone.md, get-shit-done/workflows/plan-milestone-gaps.md]

key-decisions:
  - "Used estimated_reduction field name (not reduction) to match steward report label"
  - "Omit gaps.test_consolidation entirely when no proposals (not empty array)"
  - "Consolidation proposals never force gaps_found — only tech_debt"

patterns-established:
  - "Gap type addition pattern: add to audit-milestone step 6 template AND plan-milestone-gaps step 1 enumeration atomically"
  - "Guard clause pattern for optional gap types: const x = gaps.type || []"

requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, ROUTE-01, ROUTE-02, ROUTE-03]

duration: 3min
completed: 2026-03-20
---

# Phase 75: Schema Design and Status Routing Summary

**gaps.test_consolidation schema added to audit frontmatter with consolidation-aware tech_debt routing and plan-milestone-gaps parsing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `gaps.test_consolidation` array to MILESTONE-AUDIT.md YAML frontmatter template with strategy, source, action, estimated_reduction fields
- Added step 5f consolidation-aware status routing: consolidation-only audits return tech_debt, mixed audits remain gaps_found, no-proposal audits unchanged
- Added steward proposal extraction instructions for populating the schema from `#### Proposal N:` heading blocks
- Added `gaps.test_consolidation` to plan-milestone-gaps step 1 parsing with guard clause for absent/empty
- Added test consolidation grouping rule to plan-milestone-gaps step 3: single "Test Suite Consolidation" phase, always last

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gaps.test_consolidation schema and status routing to audit-milestone.md** - `5b8e325` (feat)
2. **Task 2: Add gaps.test_consolidation parsing to plan-milestone-gaps.md** - `c5a5317` (feat)

## Files Created/Modified
- `get-shit-done/workflows/audit-milestone.md` - Added gaps.test_consolidation schema, extraction instructions, and step 5f status routing
- `get-shit-done/workflows/plan-milestone-gaps.md` - Added test_consolidation parsing and consolidation grouping rule

## Decisions Made
- Used `estimated_reduction` field name (matching steward report's `**Estimated reduction:**` label) rather than `reduction` from design doc
- Omit `gaps.test_consolidation` entirely when no proposals exist rather than writing an empty array — cleaner for backward compatibility
- Consolidation proposals route to `tech_debt` only, never `gaps_found` — they're optional cleanup, not blockers

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both workflow files updated atomically — write side (audit-milestone) and read side (plan-milestone-gaps) are in sync
- Phase 76 can now implement proposal extraction and task mapping using the schema defined here
- The gaps.test_consolidation structure is ready for consumption by plan-milestone-gaps

---
*Phase: 75*
*Completed: 2026-03-20*
