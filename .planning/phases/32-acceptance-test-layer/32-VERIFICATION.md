---
phase: 32-acceptance-test-layer
status: passed
verified: 2026-03-05
verifier: orchestrator-inline
---

# Phase 32: Acceptance Test Layer -- Verification

## Goal
Humans define executable acceptance criteria during discuss-phase that the AI works against -- these criteria are stored, tracked, verified, and protected from AI modification throughout the phase lifecycle.

## Requirements Verified

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| AT-01 | Discuss-phase gathers acceptance tests in Given/When/Then/Verify format | PASS | discuss-phase.md contains gather_acceptance_tests step (2 refs); 23 matches for Given/When/Then/Verify format references; config-gated via test.acceptance_tests with --auto skip |
| AT-02 | Acceptance tests stored in CONTEXT.md with AT-{NN} identifiers | PASS | context.md template contains acceptance_tests section (3 refs); discuss-phase.md references AT- identifiers (3 refs); write_context step includes acceptance_tests block when ATs gathered |
| AT-03 | Verify-phase executes AT Verify commands and maps to verification truths | PASS | verify-phase.md contains verify_acceptance_tests step (1 ref); step parses AT entries, executes Verify commands via shell, maps exit code 0 to PASS / non-zero to FAIL; writes dedicated AT results section |
| AT-04 | Plan-checker validates plans cover all acceptance tests | PASS | gsd-plan-checker.md contains Dimension 9: Acceptance Test Coverage (3 refs); 5 total acceptance_test/acceptance test references; missing coverage is a blocking issue |
| AT-05 | AI cannot modify acceptance tests after discuss-phase approval | PASS | execute-plan.md contains acceptance_test_ownership section (2 refs); declares ATs read-only with explicit DO NOT instructions; executors must debug code not modify ATs |

## Success Criteria Check

1. **During discuss-phase, user prompted for ATs in Given/When/Then/Verify format** -- PASS (gather_acceptance_tests step with per-requirement prompts, config-gated, skipped in --auto mode)
2. **ATs appear in CONTEXT.md with AT-{NN} identifiers persisting through lifecycle** -- PASS (template has acceptance_tests section, write_context conditionally includes block)
3. **Verify-phase executes Verify commands and maps to pass/fail with evidence** -- PASS (verify_acceptance_tests step executes commands, captures output, sets gaps_found on failure)
4. **Plan-checker validates AT coverage before execution** -- PASS (Dimension 9 checks every AT has covering tasks, missing coverage is blocking)
5. **Ownership invariant enforced in plan and execute workflows** -- PASS (acceptance_test_ownership section in execute-plan.md, Dimension 9 note in plan-checker)

## Artifact Verification

| Artifact | Exists | Lines | Key Additions |
|----------|--------|-------|--------------|
| get-shit-done/workflows/discuss-phase.md | YES | 867 | gather_acceptance_tests step, AT prompt format |
| get-shit-done/templates/context.md | YES | -- | acceptance_tests XML section with AT-{NN} format |
| get-shit-done/workflows/verify-phase.md | YES | 327 | verify_acceptance_tests step between verify_requirements and scan_antipatterns |
| agents/gsd-plan-checker.md | YES | -- | Dimension 9: Acceptance Test Coverage |
| get-shit-done/workflows/execute-plan.md | YES | 527 | acceptance_test_ownership section |

## Key Link Verification

| From | To | Via | Verified |
|------|----|-----|----------|
| discuss-phase.md | context.md template | gather_acceptance_tests writes acceptance_tests block | YES |
| context.md (CONTEXT.md) | gsd-plan-checker.md | Dimension 9 reads acceptance_tests block from CONTEXT.md | YES |
| context.md (CONTEXT.md) | execute-plan.md | acceptance_test_ownership declares ATs read-only | YES |
| context.md (CONTEXT.md) | verify-phase.md | verify_acceptance_tests parses and executes AT Verify commands | YES |
| gsd-plan-checker.md | plans | Dimension 9 blocks plans missing AT coverage | YES |

## Score: 5/5 must-haves verified

## Result: PASSED
