# Artifact-Based Phase Completion Detection

**Date:** 2026-03-02
**Status:** Approved

## Problem

`cmdPhaseStatus` in `phase.cjs` determines phase completion using two signals:
1. `.completed` marker file (written by `gsd_tools phase complete`)
2. ROADMAP.md `[x]` checkbox with `(completed YYYY-MM-DD)` format

Projects that were built with vanilla GSD (pre-fork) or older versions lack both signals for completed phases. This causes autopilot's `find_first_incomplete_phase()` to restart from early phases instead of advancing to the current work.

Meanwhile, `roadmap analyze` in `roadmap.cjs` already correctly identifies these phases as `disk_status: "complete"` by checking `summaries >= plans && plans > 0`. The data exists — `cmdPhaseStatus` just doesn't use it.

## Solution

Add artifact completeness (`allPlansHaveSummaries`) as a third completion signal in `cmdPhaseStatus`, after the existing `.completed` marker and ROADMAP checkbox checks.

### Signal priority chain

1. `.completed` marker file — explicit, written by `phase complete`
2. ROADMAP.md checkbox — semi-explicit, regex match
3. Artifact completeness — inferred, `summaryCount >= planCount && planCount > 0`

### Change location

`get-shit-done/bin/lib/phase.cjs`, function `cmdPhaseStatus`, after line 930 (after the ROADMAP fallback block):

```javascript
// Tertiary signal: artifact-complete (all plans have summaries)
// Covers pre-fork projects that lack .completed markers and checkbox formatting
if (!phaseComplete && allPlansHaveSummaries) {
  phaseComplete = true;
}
```

### Constraints

- `cmdPhaseStatus` stays read-only — no side effects, no `.completed` file writes
- Step inference waterfall unchanged (discuss -> plan -> execute -> verify)
- `phase complete` command still writes explicit markers for new phases going forward

### Risk

A phase with equal PLAN and SUMMARY file counts but incomplete work would be falsely treated as complete. In practice, summaries are only written by the executor after real work, so this is not a realistic scenario.
