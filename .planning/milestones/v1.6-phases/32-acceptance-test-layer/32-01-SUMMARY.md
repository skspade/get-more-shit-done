---
phase: 32-acceptance-test-layer
plan: 01
subsystem: workflows
tags: [discuss-phase, context-template, acceptance-tests, AT-format]

requires: []
provides:
  - Acceptance test section in CONTEXT.md template
  - gather_acceptance_tests step in discuss-phase workflow
  - Config-gated AT gathering with interactive prompts
affects: [gsd-phase-researcher, gsd-planner, gsd-verifier]

tech-stack:
  added: []
  patterns: [acceptance_tests XML section, gather_acceptance_tests step, AT-{NN} identifier format]

key-files:
  created: []
  modified:
    - get-shit-done/templates/context.md
    - get-shit-done/workflows/discuss-phase.md

key-decisions:
  - "AT section placed between code_context and deferred in template"
  - "gather_acceptance_tests step placed between discuss_areas and write_context"
  - "Config check uses gsd-tools.cjs config-get test.acceptance_tests with true default"

requirements-completed: [AT-01, AT-02]

duration: 3min
completed: 2026-03-05
---

# Phase 32 Plan 01: Context Template and Discuss-Phase Integration Summary

**Added acceptance test gathering to discuss-phase workflow and <acceptance_tests> XML section to CONTEXT.md template with AT-{NN} Given/When/Then/Verify format**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05
- **Completed:** 2026-03-05
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `<acceptance_tests>` section to context.md template between `<code_context>` and `<deferred>` with AT-{NN} format example
- Added `gsd-verifier` to downstream consumers list in context.md template
- Added `gather_acceptance_tests` step to discuss-phase.md between `discuss_areas` and `write_context`
- Step checks `--auto` flag (skips for autopilot) and `test.acceptance_tests` config (skips when disabled)
- Step uses AskUserQuestion to prompt for ATs per requirement in Given/When/Then/Verify format
- Updated `write_context` step template to include `<acceptance_tests>` block when ATs gathered

## Deviations from Plan

None - plan executed exactly as written.

## Next

Ready for Plan 03 (Wave 2) after Plan 02 completes.
