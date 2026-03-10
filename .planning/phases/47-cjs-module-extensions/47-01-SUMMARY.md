---
phase: 47-cjs-module-extensions
plan: 01
status: complete
duration: ~3min
---

# Plan 47-01 Summary

## What was built
Extracted `computePhaseStatus` internal helper from `cmdPhaseStatus` and added two new exported functions to phase.cjs:
- `findFirstIncompletePhase(cwd)` — returns first incomplete phase number from roadmap
- `nextIncompletePhase(cwd, currentPhase)` — returns next incomplete phase after given phase

## Key files

### Modified
- `get-shit-done/bin/lib/phase.cjs` — extracted computePhaseStatus, added findFirstIncompletePhase and nextIncompletePhase

## Approach
- Extracted lines 903-984 of cmdPhaseStatus into computePhaseStatus(cwd, phaseInfo) internal helper
- Both new functions read ROADMAP.md directly, parse phase headings with the same regex as cmdRoadmapAnalyze, sort with comparePhaseNum, and use computePhaseStatus for completion checking
- cmdPhaseStatus refactored to delegate to computePhaseStatus with identical behavior

## Commits
- 1492994 feat(47-01): extract computePhaseStatus and add phase navigation functions

## Self-Check
- All 58 phase tests pass (no regression)
- findFirstIncompletePhase returns 47 (correct — first incomplete in v2.3)
- nextIncompletePhase(cwd, '47') returns 48 (correct)
- cmdPhaseStatus output unchanged
