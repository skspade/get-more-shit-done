---
phase: 94
plan: 1
status: complete
started: 2026-03-22
completed: 2026-03-22
requirements-completed:
  - AUTO-01
  - AUTO-02
  - AUTO-03
  - AUTO-04
  - EVID-01
  - EVID-02
  - EVID-03
  - EVID-04
  - WKFL-03
---

# Plan 94-01 Summary: runAutomatedUAT() and auditAndUAT() in autopilot.mjs

## What Was Built

Added `runAutomatedUAT()` function and `auditAndUAT()` helper to autopilot.mjs, wiring automated UAT into the milestone completion flow at all three insertion points.

### Key Changes

1. **`runAutomatedUAT()`** (after `runMilestoneAudit()`):
   - Gates on `uat-config.yaml` existence -- returns 0 if missing (non-web projects skip)
   - Invokes `/gsd:uat-auto` via `runStepWithRetry` for debug retry on crashes
   - Reads `MILESTONE-UAT.md` frontmatter status via `gsdTools`
   - Returns 0 (passed), 10 (gaps_found), or 1 (error) -- same contract as audit

2. **`auditAndUAT()`** helper:
   - Runs `runMilestoneAudit()` first, then `runAutomatedUAT()` if audit passes
   - Eliminates 3-site duplication of audit-to-completion logic

3. **Three insertion points replaced**:
   - All phases complete on startup (line ~1139)
   - Phases complete during main loop (line ~1216)
   - Re-audit after gap closure (line ~1055)

## Self-Check: PASSED

- [x] `runAutomatedUAT` function exists
- [x] `auditAndUAT` helper exists
- [x] Config gate on uat-config.yaml
- [x] Exit code contract (0/10/1) matches audit
- [x] All three insertion points use `auditAndUAT()`
- [x] No direct `runMilestoneAudit()` calls remain outside `auditAndUAT()`

## Key Files

### Modified
- `get-shit-done/scripts/autopilot.mjs` — added 2 functions, rewired 3 call sites

## Commits
- `feat(94-01): add runAutomatedUAT() and auditAndUAT() to autopilot pipeline`
