---
phase: 50-migration-and-fallback
plan: 01
subsystem: infra
tags: [zx, migration, legacy, testing]

requires:
  - phase: 49-advanced-autopilot-features
    provides: Feature-complete autopilot.mjs script
provides:
  - zx runtime dependency in package.json
  - autopilot-legacy.sh fallback script (renamed from autopilot.sh)
  - Retired format-json-output.test.cjs (11 tests removed)
affects: [50-02, 51-tests]

tech-stack:
  added: [zx ^8.0.0]
  patterns: [legacy-script-preservation]

key-files:
  created: []
  modified:
    - package.json
    - get-shit-done/scripts/autopilot-legacy.sh

key-decisions:
  - "Pinned zx to ^8.0.0 caret range for minor/patch updates"
  - "Used git mv for rename to preserve history"
  - "Retired test file entirely rather than updating path reference"

patterns-established:
  - "Legacy fallback: renamed scripts get -legacy suffix"

requirements-completed: [REQ-20, REQ-21, REQ-23]

duration: 2min
completed: 2026-03-10
---

# Plan 50-01: Dependency, Legacy Rename, and Test Retirement Summary

**Added zx ^8.0.0 runtime dependency, renamed autopilot.sh to autopilot-legacy.sh, and retired 11 bash-only format_json_output tests**

## Performance

- **Duration:** 2 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- zx listed as runtime dependency (not devDependency) in package.json
- autopilot.sh renamed to autopilot-legacy.sh with full git history preserved
- format-json-output.test.cjs deleted, freeing 11 tests from test budget (699 -> 688)

## Task Commits

1. **Task 1-3: All tasks** - `9752a44` (feat: add zx dep, rename script, retire test)

## Files Created/Modified
- `package.json` - Added zx ^8.0.0 to dependencies
- `get-shit-done/scripts/autopilot-legacy.sh` - Renamed from autopilot.sh (content unchanged)
- `tests/format-json-output.test.cjs` - Deleted

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- autopilot-legacy.sh ready for entrypoint --legacy routing (Plan 50-02)
- autopilot.sh path no longer exists, entrypoint must be updated

---
*Phase: 50-migration-and-fallback*
*Completed: 2026-03-10*
