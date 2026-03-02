---
phase: 05-fix-autopilot-wiring-bugs
plan: 01
subsystem: infra
tags: [autopilot, phase-status, verification, bash, nodejs]

requires:
  - phase: 04-failure-handling
    provides: "debug-retry loop and failure state management"
provides:
  - "Fixed cmdPhaseStatus with ROADMAP-based completion detection"
  - "Fixed autopilot.sh verification functions with dual VERIFICATION/UAT file pattern"
  - "Registered phase-status command in gsd-tools.cjs"
affects: [06-verify-phase-4-implementation, autopilot]

tech-stack:
  added: []
  patterns: ["ROADMAP checkbox-based completion detection", "dual file pattern fallback (VERIFICATION then UAT)"]

key-files:
  created:
    - "get-shit-done/scripts/autopilot.sh"
  modified:
    - "get-shit-done/bin/lib/phase.cjs"
    - "get-shit-done/bin/gsd-tools.cjs"

key-decisions:
  - "Used ROADMAP checkbox line pattern instead of getRoadmapPhaseInternal section for completion detection, because the completed date marker is on the checkbox line, not in the phase detail section"
  - "Strip leading zeros from phase number before ROADMAP lookup since findPhaseInternal returns '01' but ROADMAP uses 'Phase 1:'"
  - "Added cmdPhaseStatus function and phase-status command to repo copy (was only in installed ~/.claude copy)"

patterns-established:
  - "ROADMAP completion check: regex for -[x]...Phase N:...(completed YYYY-MM-DD) on checkbox line"
  - "Verification file fallback: always check VERIFICATION.md first, then UAT.md"

requirements-completed: [FAIL-02, VRFY-01, VRFY-02, VRFY-03]

duration: 5min
completed: 2026-03-02
---

# Phase 5 Plan 01: Fix Autopilot Wiring Bugs Summary

**Fixed cmdPhaseStatus ROADMAP-based completion detection and autopilot.sh dual VERIFICATION/UAT file pattern matching, enabling the verify step to be reachable and debug-retry to detect verification gaps**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T16:21:49Z
- **Completed:** 2026-03-02T16:27:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- cmdPhaseStatus now returns step='complete' only when ROADMAP.md has the "(completed YYYY-MM-DD)" marker on the checkbox line, not when VERIFICATION.md exists
- The verify step is now reachable in the autopilot main loop (previously skipped straight to 'complete' after execute-phase wrote VERIFICATION.md)
- extract_verification_status and extract_gaps_summary both search *-UAT.md as fallback when no *-VERIFICATION.md exists
- debug-retry can now correctly detect gaps_found status from verify-work output (FAIL-02 fix)
- Added cmdPhaseStatus function and phase-status command registration to repo (was previously only in installed copy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix cmdPhaseStatus step inference to use ROADMAP completion** - `eae1e04` (fix)
2. **Task 2: Fix extract_verification_status and extract_gaps_summary to search UAT.md** - `c067c65` (fix)

## Files Created/Modified
- `get-shit-done/bin/lib/phase.cjs` - Added cmdPhaseStatus with ROADMAP-based completion, added getRoadmapPhaseInternal import
- `get-shit-done/bin/gsd-tools.cjs` - Registered phase-status command and alias
- `get-shit-done/scripts/autopilot.sh` - Added to repo with fixed dual VERIFICATION/UAT file pattern in both extract functions

## Decisions Made
- Used ROADMAP checkbox line pattern (`-[x]...Phase N:...(completed YYYY-MM-DD)`) instead of getRoadmapPhaseInternal section text, because cmdPhaseComplete writes the completed date on the checkbox line which is outside the section returned by getRoadmapPhaseInternal
- Strip leading zeros from phase number before ROADMAP regex matching (findPhaseInternal returns "01" but ROADMAP headings use "Phase 1:")
- Added cmdPhaseStatus and phase-status command to repo copy since they were only in the installed ~/.claude/get-shit-done copy, not in the git-tracked source

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zero-padded phase number mismatch with ROADMAP**
- **Found during:** Task 1 (cmdPhaseStatus ROADMAP completion check)
- **Issue:** Plan used getRoadmapPhaseInternal(cwd, phaseInfo.phase_number) but phase_number is "01" (zero-padded) while ROADMAP uses "Phase 1:" (unpadded). getRoadmapPhaseInternal returned null for "01".
- **Fix:** Strip leading zeros before ROADMAP lookup. Also switched from getRoadmapPhaseInternal section check to direct ROADMAP checkbox line check, since the "(completed DATE)" marker is on the checkbox line, not in the phase detail section.
- **Files modified:** get-shit-done/bin/lib/phase.cjs
- **Verification:** Phase 1 correctly returns step='complete', Phase 5 returns step='discuss'
- **Committed in:** eae1e04

**2. [Rule 3 - Blocking] Added cmdPhaseStatus function and command registration to repo**
- **Found during:** Task 1 (preparing to commit)
- **Issue:** The repo copy of phase.cjs was missing the cmdPhaseStatus function entirely (it only existed in the installed ~/.claude copy). gsd-tools.cjs also lacked the phase-status command registration.
- **Fix:** Added the full cmdPhaseStatus function (with the ROADMAP fix) to the repo phase.cjs, and added the phase status subcommand + phase-status alias to gsd-tools.cjs.
- **Files modified:** get-shit-done/bin/lib/phase.cjs, get-shit-done/bin/gsd-tools.cjs
- **Verification:** node -c passes on both files
- **Committed in:** eae1e04

**3. [Rule 3 - Blocking] Added autopilot.sh to repo**
- **Found during:** Task 2 (preparing to commit)
- **Issue:** The repo had no get-shit-done/scripts/ directory. autopilot.sh only existed in ~/.claude/get-shit-done/scripts/ (installed copy).
- **Fix:** Created get-shit-done/scripts/ in repo, copied the fixed autopilot.sh with UAT.md fallback patterns.
- **Files modified:** get-shit-done/scripts/autopilot.sh (new)
- **Verification:** bash -n passes, grep confirms 4 UAT.md references
- **Committed in:** c067c65

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes were necessary. The zero-padding mismatch was a plan assumption error. The missing repo files were pre-existing gaps between installed and tracked copies. No scope creep.

## Issues Encountered
- The installed copy at ~/.claude/get-shit-done had diverged from the repo copy at get-shit-done/. Functions and scripts added during previous phase execution were never committed to the repo. This was discovered and resolved by adding the missing code to the repo.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 wiring bugs are fixed, autopilot verify step is now reachable
- Phase 6 (Verify Phase 4 Implementation) can proceed with confidence that the verification gate works correctly
- The installed copy at ~/.claude/get-shit-done also has the fixes applied (in addition to the repo copy)

---
*Phase: 05-fix-autopilot-wiring-bugs*
*Completed: 2026-03-02*
