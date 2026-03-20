# Phase 77: Edge Case Hardening and Validation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Verify that all edge cases in the consolidation bridge produce correct behavior: consolidation-only gaps (no requirement/integration/flow gaps) create just the consolidation phase, the autopilot audit-fix-reaudit loop processes consolidation phases without special-casing, steward proposals use verbatim file paths and test names, and existing gap types produce identical behavior to pre-v2.8. This phase validates the work from Phases 75 and 76 -- it does not modify workflow files unless a bug is discovered.

</domain>

<decisions>
## Implementation Decisions

### Consolidation-Only Gap Handling (EDGE-01)
- When `gaps.requirements`, `gaps.integration`, and `gaps.flows` are all empty but `gaps.test_consolidation` has entries and budget gating passes, `plan-milestone-gaps` must create just the "Test Suite Consolidation" phase without error
- The step 2 prioritization logic must not fail when requirement/integration/flow gap arrays are empty -- the existing `|| []` guard clauses must be sufficient
- The step 5 presentation must render correctly with zero requirement/integration/flow counts and only the consolidation phase listed

### Autopilot Loop Compatibility (EDGE-02)
- `autopilot.mjs` `runGapClosureLoop()` processes consolidation phases through the same discuss-plan-execute-verify cycle as any other gap closure phase -- no code changes to autopilot.mjs are needed (from REQUIREMENTS.md Out of Scope: "Changes to autopilot.mjs")
- Consolidation-only audits return `tech_debt` status (from Phase 75 ROUTE-01), which autopilot handles via `auto_accept_tech_debt` config -- when true, it treats as passed; when false, it routes to gap closure
- After gap closure phases execute and re-audit runs, if consolidation proposals are resolved, the audit should return `passed` or `tech_debt` with no remaining gaps

### Verbatim Steward Data (EDGE-03)
- Task descriptions in the generated consolidation phase must use the exact `source` and `action` strings from `gaps.test_consolidation` entries -- no paraphrasing, path normalization, or generalized descriptions
- The `<gap_to_phase_mapping>` templates in `plan-milestone-gaps.md` use `{source}`, `{action}`, `{estimated_reduction}` placeholder interpolation from verbatim frontmatter values (added in Phase 76)
- Validation must confirm that file paths like `tests/foo/bar.test.js` and test names like `"should handle edge case"` pass through unmodified from steward report to generated tasks

### Regression Protection for Existing Gap Types
- Existing gap types (requirements, integration, flows) must produce identical behavior to pre-v2.8 -- the `gaps.test_consolidation` additions must not alter parsing, prioritization, grouping, or presentation of the three original gap types
- The `|| []` guard clause for `gaps.test_consolidation` ensures absent field does not affect existing gap processing
- Status routing: audits with no consolidation proposals but with other gaps must still return `gaps_found` exactly as before

### Verification Approach
- Write tests that exercise `plan-milestone-gaps` with crafted MILESTONE-AUDIT.md frontmatter covering each edge case (Claude's Decision: testing against the workflow's actual parsing logic is the most reliable validation approach)
- Test cases: consolidation-only gaps, mixed gaps with consolidation, empty consolidation array, absent consolidation field, budget OK with proposals, steward disabled (Claude's Decision: covers all edge case paths from success criteria)
- Verify autopilot compatibility by confirming `tech_debt` status routing logic in `autopilot.mjs` handles consolidation-only audits correctly -- read-only check, no modifications (Claude's Decision: autopilot.mjs is explicitly out of scope for changes per REQUIREMENTS.md)

### Claude's Discretion
- Exact test file naming and directory placement for edge case tests
- Whether to use snapshot testing or assertion-based testing for frontmatter output
- Order of edge case test execution
- Whether to add inline comments in workflow files for edge case documentation

</decisions>

<specifics>
## Specific Ideas

- The `plan-milestone-gaps.md` step 1 guard clause `const consolidationGaps = gaps.test_consolidation || [];` is the critical line for EDGE-01 -- when all other gap arrays are empty, this must still allow the workflow to proceed to step 3 grouping and step 5 presentation
- The `autopilot.mjs` `runMilestoneAudit()` function (lines 898-921) shows the `tech_debt` case returning 0 when `auto_accept_tech_debt` is true -- this is the exact path consolidation-only audits take, confirming EDGE-02 compatibility without code changes
- The `<gap_to_phase_mapping>` section's test consolidation templates use `{source}`, `{action}`, `{estimated_reduction}` directly from frontmatter entries -- EDGE-03 validation must confirm no intermediate transformation layer alters these values
- The v2.7 MILESTONE-AUDIT.md at `.planning/milestones/v2.7-MILESTONE-AUDIT.md` provides a real-world example of the frontmatter structure for constructing test fixtures

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/plan-milestone-gaps.md`: Contains all gap parsing, budget gating, grouping, and task mapping logic -- the primary target for edge case validation
- `get-shit-done/workflows/audit-milestone.md`: Writes `gaps.test_consolidation` and `test_health.budget_status` to frontmatter -- source of test fixture data structure
- `get-shit-done/scripts/autopilot.mjs`: `runMilestoneAudit()` and `runGapClosureLoop()` functions handle `tech_debt` status routing -- read-only validation target for EDGE-02
- `get-shit-done/bin/lib/frontmatter.cjs`: `extractFrontmatter()` parses YAML frontmatter -- used to construct and verify test fixtures

### Established Patterns
- Guard clause pattern: `const x = gaps.field || [];` used for all optional gap types -- test consolidation follows same pattern
- Status routing: three-way switch on `passed`/`gaps_found`/`tech_debt` in both audit-milestone and autopilot.mjs -- consolidation uses existing `tech_debt` path
- Gap-to-phase mapping: YAML template interpolation with verbatim field values -- same pattern for all four gap types

### Integration Points
- `plan-milestone-gaps.md` step 1: Frontmatter parsing where consolidation-only scenario must not error
- `plan-milestone-gaps.md` step 3: Budget gating and grouping where consolidation-only must produce a single phase
- `plan-milestone-gaps.md` step 5: Presentation where consolidation-only must render correctly
- `autopilot.mjs` `runMilestoneAudit()`: `tech_debt` case must handle consolidation-only audits via existing logic

</code_context>

<deferred>
## Deferred Ideas

- `gsd health` reporting on pending consolidation proposals (post-v2.8, FUTURE-01)
- Estimated budget projection in gap plan presentation (post-v2.8, FUTURE-02)
- Partial proposal acceptance via frontmatter flags (post-v2.8, FUTURE-03)

</deferred>

---

*Phase: 77-edge-case-hardening-and-validation*
*Context gathered: 2026-03-20 via auto-context*
