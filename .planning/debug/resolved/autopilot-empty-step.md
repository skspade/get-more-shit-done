---
status: resolved
trigger: "autopilot-empty-step: gsd-autopilot detects phase 8 correctly but immediately fails with 'ERROR: Unknown step '' for phase 8'"
created: 2026-03-02T00:00:00Z
updated: 2026-03-02T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - cmdPhaseStatus errors when phase directory doesn't exist on disk
test: Fixed cmdPhaseStatus, verified phase-status 8 returns step='discuss', all 58 existing tests pass
expecting: User confirms autopilot no longer fails with empty step error
next_action: Await human verification

## Symptoms

expected: gsd-autopilot detects the current phase (phase 8) and proceeds to execute/plan/research it
actual: It detects phase 8 correctly but immediately fails with the error about unknown step
errors: "ERROR: Unknown step '' for phase 8"
reproduction: Run the gsd-autopilot command in this repo
started: Current behavior

## Eliminated

## Evidence

- timestamp: 2026-03-02T00:01:00Z
  checked: phase-status 8 output with stderr suppressed (mimicking autopilot gsd_tools wrapper)
  found: phase-status exits 1, produces empty stdout; jq -r '.step' on empty input returns empty string
  implication: Confirms the empty step is caused by phase-status failing silently

- timestamp: 2026-03-02T00:02:00Z
  checked: .planning/phases/ directory contents
  found: Directory is completely empty - phase 8 has no directory on disk despite being in ROADMAP.md
  implication: Phase 8 is a new milestone phase; its directory hasn't been created yet

- timestamp: 2026-03-02T00:03:00Z
  checked: cmdPhaseStatus in phase.cjs (line 878-881)
  found: Calls findPhaseInternal which searches .planning/phases/ for a matching directory. Returns null when no dir exists. cmdPhaseStatus then calls error() which exits with code 1.
  implication: cmdPhaseStatus cannot handle phases that exist in ROADMAP but lack a directory on disk

- timestamp: 2026-03-02T00:04:00Z
  checked: autopilot.sh gsd_tools wrapper (line 80-82)
  found: gsd_tools() pipes stderr to /dev/null. When phase-status fails, error is swallowed and empty output is passed to jq
  implication: The autopilot has no way to detect the phase-status error; it gets an empty step string

## Resolution

root_cause: cmdPhaseStatus (phase.cjs line 878-881) calls findPhaseInternal which only searches for existing directories in .planning/phases/. For a brand-new phase that exists in ROADMAP.md but has no directory yet, findPhaseInternal returns null, causing cmdPhaseStatus to error(). The autopilot's gsd_tools wrapper suppresses stderr (2>/dev/null), so the error is silently lost. The empty output piped through jq -r '.step' produces an empty string, which doesn't match any case in the autopilot's main loop, triggering the "Unknown step ''" error.
fix: Modify cmdPhaseStatus to handle phases with no directory on disk. When findPhaseInternal returns null, check if the phase exists in the ROADMAP (via getRoadmapPhaseInternal). If it does, create the phase directory and return step='discuss' as the phase lifecycle hasn't started yet.
verification: |
  1. phase-status 8 now returns {"step":"discuss",...} instead of erroring (confirmed)
  2. Simulated full autopilot find_first_incomplete_phase flow - phase 8 correctly detected with step=discuss (confirmed)
  3. phase-status for non-existent phase (99) still correctly errors (confirmed)
  4. All 58 existing phase tests pass with 0 failures (confirmed)
files_changed:
- get-shit-done/bin/lib/phase.cjs
