# Phase 35: Close Verification Gaps - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Create missing VERIFICATION.md files for phases 31, 32, and 33, and update REQUIREMENTS.md bookkeeping so all 24 requirements reach fully-satisfied status. This is a procedural gap closure phase -- all code and integration work is complete (606 tests pass, 23/23 integration checks, 7/7 E2E flows). The gaps are missing verification artifacts and stale bookkeeping.

</domain>

<decisions>
## Implementation Decisions

### VERIFICATION.md Creation (Phases 31, 32, 33)
- Create 31-VERIFICATION.md, 32-VERIFICATION.md, and 33-VERIFICATION.md following the established format from 30-VERIFICATION.md and 34-VERIFICATION.md
- Each VERIFICATION.md includes YAML frontmatter (phase, status, verified date, verifier), goal statement, requirements table with evidence, success criteria checks, artifact verification, and key link/wiring verification
- The verifier must run actual verification commands (gsd-tools.cjs calls, file existence checks, grep for integration points) to produce evidence -- not copy-paste from SUMMARY files (Claude's Decision: verification must be independent of execution claims to maintain the goal-backward verification principle)
- VERIFICATION.md for phase 31 covers GATE-01 through GATE-05 against execute-plan.md test gate sections, testing.cjs cmdTestRun, and TDD/baseline logic
- VERIFICATION.md for phase 32 covers AT-01 through AT-05 against discuss-phase.md acceptance test gathering, context.md template, verify-phase.md AT execution, plan-checker Dimension 9, and ownership invariant in execute-plan.md
- VERIFICATION.md for phase 33 covers STEW-01 through STEW-06 against gsd-test-steward.md agent, audit-tests.md command, audit-milestone.md steward step, and plan-phase.md budget injection

### REQUIREMENTS.md Bookkeeping Updates
- Update STEW-01 through STEW-06 traceability table: change status from "Pending" to "Complete"
- Update FOUND-01 through FOUND-05 traceability table: change status from "Pending" to "Complete" (the audit identified these checkboxes are already checked but status column says "Pending")
- After updates, all 24 requirements in the traceability table should show "Complete" status (Claude's Decision: the audit report explicitly identifies these as bookkeeping gaps, not functional ones)

### Verification Evidence Strategy
- Phase 31 evidence: check execute-plan.md for `test_gate_baseline` and `test_gate` sections, check testing.cjs for cmdTestRun export, check gsd-tools.cjs for test-run dispatch, verify TDD RED detection pattern exists
- Phase 32 evidence: check discuss-phase.md for `gather_acceptance_tests` step, check context.md template for `acceptance_tests` section, check verify-phase.md for `verify_acceptance_tests` step, check plan-checker for Dimension 9, check execute-plan.md for ownership invariant section
- Phase 33 evidence: check agents/gsd-test-steward.md exists with proper structure, check commands/gsd/audit-tests.md exists, check audit-milestone.md for steward step 3.5, check plan-phase.md for budget injection step 7.5, check core.cjs MODEL_PROFILES for gsd-test-steward entry
- Use `grep` and file existence checks for evidence, not just SUMMARY claims (Claude's Decision: independent verification is the whole purpose of the verify-phase pattern)

### ROADMAP.md Phase Completion
- Mark Phase 35 as completed in ROADMAP.md after verification files are written (Claude's Decision: gap closure phases follow the same completion marking pattern as other phases)

### Claude's Discretion
- Exact wording of evidence descriptions in the requirements tables
- Whether artifact verification tables include line counts or just existence checks
- Ordering of sections within each VERIFICATION.md (requirements first vs success criteria first)
- Whether to include a test suite status line in each VERIFICATION.md

</decisions>

<specifics>
## Specific Ideas

- The milestone audit at `.planning/v1.6-MILESTONE-AUDIT.md` explicitly lists all 16 gaps with their requirement IDs, phases, and SUMMARY claim sources -- use this as the verification checklist
- The audit identifies 2 tech debt items: FOUND-01..05 checkboxes (already checked per REQUIREMENTS.md, but status column says "Pending") and STEW-01..06 checkboxes (unchecked with "Pending" status)
- Phase 30 VERIFICATION.md provides the gold standard format: YAML frontmatter, goal, requirements table (Req ID / Description / Status / Evidence), success criteria numbered list, artifact table (Artifact / Exists / Min Lines / Exports), key link table (From / To / Via / Verified)
- Phase 34 VERIFICATION.md uses a slightly simpler format without artifact or link tables since it was documentation-only -- phases 31-33 should use the richer Phase 30 format since they involve code changes
- SUMMARY frontmatter `requirements-completed` arrays provide the requirement-to-plan mapping but must be independently verified

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `30-VERIFICATION.md`: Gold standard format for VERIFICATION.md files with YAML frontmatter, requirements table, success criteria, artifact verification, and key link verification
- `34-VERIFICATION.md`: Simpler format reference for documentation-only verification
- `v1.6-MILESTONE-AUDIT.md`: Complete gap inventory with requirement IDs, phases, SUMMARY claims, and REQUIREMENTS.md status for all 16 gaps
- `gsd-tools.cjs`: Provides verification commands (test-run, test-count, test-config, test-detect-framework) that can be used to generate evidence

### Established Patterns
- VERIFICATION.md uses YAML frontmatter with phase, status (passed/failed), verified date, and verifier fields
- Requirements tables use `| Req ID | Description | Status | Evidence |` column format
- Success criteria are numbered and checked against the ROADMAP.md criteria
- Artifact verification checks file existence and minimum content (line counts, exports)
- Key link verification checks integration wiring between modules

### Integration Points
- `.planning/phases/31-hard-test-gate/31-VERIFICATION.md`: New file to create
- `.planning/phases/32-acceptance-test-layer/32-VERIFICATION.md`: New file to create
- `.planning/phases/33-test-steward/33-VERIFICATION.md`: New file to create
- `.planning/REQUIREMENTS.md`: Update traceability table status column for FOUND-01..05 and STEW-01..06

</code_context>

<deferred>
## Deferred Ideas

None -- phase scope is well-defined by the audit gap inventory.

</deferred>

---

*Phase: 35-close-verification-gaps*
*Context gathered: 2026-03-05 via auto-context*
