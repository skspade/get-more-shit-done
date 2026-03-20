# Phase 75: Schema Design and Status Routing - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Define the `gaps.test_consolidation` schema in MILESTONE-AUDIT.md frontmatter and lock the status routing rule so consolidation-only audits return `tech_debt` instead of `gaps_found`. Both `audit-milestone.md` and `plan-milestone-gaps.md` are modified atomically in this phase to prevent a broken intermediate state where the write side produces data that the read side silently ignores.

</domain>

<decisions>
## Implementation Decisions

### Frontmatter Schema (SCHEMA-01, SCHEMA-02, SCHEMA-03)
- Add `gaps.test_consolidation` array to the YAML frontmatter template in `audit-milestone.md` step 6, nested under the existing `gaps` object alongside `requirements`, `integration`, `flows` (from REQUIREMENTS.md SCHEMA-03)
- Each entry has four required fields: `strategy`, `source`, `action`, `estimated_reduction` (from REQUIREMENTS.md SCHEMA-02, design doc)
- `strategy` is one of: `parameterize`, `promote`, `prune`, `merge` (from REQUIREMENTS.md SCHEMA-02, steward agent spec)
- `source` contains the verbatim file path and location from the steward report (from REQUIREMENTS.md SCHEMA-02)
- `action` contains the verbatim action description from the steward report (from REQUIREMENTS.md SCHEMA-02)
- `estimated_reduction` is an integer count of tests removed by the proposal (from REQUIREMENTS.md SCHEMA-02)
- When steward is disabled or produces no proposals, `gaps.test_consolidation` is omitted entirely from frontmatter (from design doc edge cases)
- The `test_health.consolidation_proposals` integer count remains unchanged -- it is informational metadata, not the structured data (from PITFALLS.md Pitfall 2)

### Schema Population from Steward Report (SCHEMA-01)
- `audit-milestone.md` step 6 extracts proposals from the steward report by parsing `#### Proposal N:` heading blocks (from ARCHITECTURE.md data flow)
- Within each block, extract labeled fields: `**Strategy:**`, `**Source:**`, `**Action:**`, `**Estimated reduction:**` (from PITFALLS.md Pitfall 4, steward agent spec)
- Malformed proposals (missing required fields) are skipped with a warning, not propagated as incomplete entries (from PITFALLS.md Pitfall 4)
- Extraction only runs when `STEWARD_ENABLED` is true and the steward report contains proposals (from design doc)

### Status Routing (ROUTE-01, ROUTE-02, ROUTE-03)
- An audit with consolidation proposals but no requirement/integration/flow gaps returns `tech_debt` status (from REQUIREMENTS.md ROUTE-01, PITFALLS.md Pitfall 3)
- An audit with consolidation proposals AND other gaps returns `gaps_found` -- other gaps take precedence (from REQUIREMENTS.md ROUTE-02)
- An audit with no consolidation proposals behaves identically to current pre-v2.8 behavior (from REQUIREMENTS.md ROUTE-03)
- The status routing check is added after step 5e in `audit-milestone.md`: if all requirements satisfied and no integration/flow gaps, but `consolidation_proposals > 0`, set status to `tech_debt` (from design doc)

### Plan-Milestone-Gaps Parsing (Atomic with Audit Changes)
- `plan-milestone-gaps.md` step 1 adds `gaps.test_consolidation` to the explicit field enumeration alongside `gaps.requirements`, `gaps.integration`, `gaps.flows` (from PITFALLS.md Pitfall 1, ARCHITECTURE.md)
- Guard clause: `const consolidationGaps = gaps.test_consolidation || [];` for absent or empty key (from PITFALLS.md Pitfall 6)
- Both workflow files are modified in the same plan to prevent silent data loss from a write/read mismatch (from PITFALLS.md Pitfall 1, research SUMMARY.md)

### Claude's Discretion
- Exact placement of the status routing check relative to existing step 5e logic
- Whether to log a count of extracted vs expected proposals for debugging
- Internal variable naming for parsed proposal objects
- Formatting of the `gaps.test_consolidation` YAML block in the audit template

</decisions>

<specifics>
## Specific Ideas

- The v2.7 MILESTONE-AUDIT.md at `.planning/milestones/v2.7-MILESTONE-AUDIT.md` shows the current `gaps` structure with `requirements`, `integration`, `flows` arrays and the separate `test_health` block with `consolidation_proposals: 2` as integer -- this is the live example of the schema being extended
- The steward agent at `agents/gsd-test-steward.md` defines the proposal output format: `#### Proposal {N}: {strategy} -- {title}` with labeled fields `**Strategy:**`, `**Source:**`, `**Action:**`, `**Estimated reduction:**`
- The design doc at `.planning/designs/2026-03-20-test-steward-consolidation-bridge-design.md` specifies the exact YAML shape with `strategy`, `source`, `action`, `reduction` field names
- `frontmatter.cjs` `extractFrontmatter()` already handles arrays of flat objects at two-level nesting -- no parser changes needed for the new array
- The `gaps.integration` array in v2.7 audit (items with `id`, `severity`, `description`, `affected_requirements`, `evidence`) is the structural proof-of-concept for the new `gaps.test_consolidation` array

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/frontmatter.cjs`: `extractFrontmatter()` and `reconstructFrontmatter()` handle arbitrary YAML including arrays of objects -- no modification needed
- `agents/gsd-test-steward.md`: steward agent spec defines the `#### Proposal N:` output format with labeled fields that the extraction logic targets
- `.planning/milestones/v2.7-MILESTONE-AUDIT.md`: live example of current frontmatter schema showing `gaps` object with three arrays and `test_health` block

### Established Patterns
- `audit-milestone.md` step 6 already writes structured arrays under `gaps` (requirements, integration, flows) -- the new `test_consolidation` array follows the same pattern
- `plan-milestone-gaps.md` step 1 uses explicit field enumeration to parse gap types -- adding a fourth type follows the existing three-type pattern
- Status routing in `audit-milestone.md` step 5e/7 uses three statuses: `passed`, `gaps_found`, `tech_debt` -- the consolidation routing adds a condition to the existing `tech_debt` path

### Integration Points
- `workflows/audit-milestone.md` step 6: YAML frontmatter template where `gaps.test_consolidation` is added, and step 5e/7 where status routing logic is extended
- `workflows/plan-milestone-gaps.md` step 1: frontmatter parsing where `gaps.test_consolidation` is added to the field enumeration
- `scripts/autopilot.mjs` `runGapClosureLoop()`: consumes `tech_debt` status via `auto_accept_tech_debt` -- no changes needed, confirms the routing is safe

</code_context>

<deferred>
## Deferred Ideas

- Proposal-to-task mapping for all four strategies (Phase 76)
- Budget threshold gating for consolidation phase creation (Phase 76)
- Grouping proposals into phases with strategy clustering (Phase 76)
- Edge case validation for empty proposals, steward disabled, autopilot flow (Phase 77)
- `gsd health` reporting on pending consolidation proposals (post-v2.8, FUTURE-01)
- Per-proposal estimated budget projection in gap plan presentation (post-v2.8, FUTURE-02)

</deferred>

---

*Phase: 75-schema-design-and-status-routing*
*Context gathered: 2026-03-20 via auto-context*
