---
phase: 50-migration-and-fallback
plan: 02
subsystem: infra
tags: [entrypoint, migration, zx, bash]

requires:
  - phase: 50-migration-and-fallback
    provides: autopilot-legacy.sh renamed from autopilot.sh
provides:
  - Entrypoint routing to autopilot.mjs (default) or autopilot-legacy.sh (--legacy)
  - Updated resume instructions referencing gsd-autopilot
affects: [51-tests]

tech-stack:
  added: []
  patterns: [entrypoint-routing-with-legacy-fallback]

key-files:
  created: []
  modified:
    - bin/gsd-autopilot
    - get-shit-done/scripts/autopilot.mjs

key-decisions:
  - "Used conditional on first arg for --legacy detection, shift before exec"
  - "Replaced all 6 autopilot.sh references in resume instructions with gsd-autopilot"

patterns-established:
  - "Entrypoint routing: bash script with conditional exec to node or bash targets"

requirements-completed: [REQ-22]

duration: 2min
completed: 2026-03-10
---

# Plan 50-02: Entrypoint Rewrite and Resume Instruction Updates Summary

**bin/gsd-autopilot now routes to autopilot.mjs by default with --legacy fallback, and all resume instructions reference gsd-autopilot**

## Performance

- **Duration:** 2 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- bin/gsd-autopilot routes to autopilot.mjs via `exec node` by default
- --legacy flag routes to autopilot-legacy.sh via `exec bash` with argument shift
- All 6 autopilot.sh references in autopilot.mjs replaced with gsd-autopilot
- Both paths validate target file exists before exec

## Task Commits

1. **Task 1-2: All tasks** - `d013f56` (feat: rewrite entrypoint, update resume instructions)

## Files Created/Modified
- `bin/gsd-autopilot` - Rewritten with --legacy routing to autopilot-legacy.sh
- `get-shit-done/scripts/autopilot.mjs` - 6 resume/escalation references updated

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Migration complete, users can run zx autopilot by default
- Legacy fallback available via --legacy flag
- Ready for Phase 51 test coverage

---
*Phase: 50-migration-and-fallback*
*Completed: 2026-03-10*
