# Phase 75 Research: Schema Design and Status Routing

**Researched:** 2026-03-20
**Status:** Complete

## Summary

Phase 75 modifies two workflow files atomically: `audit-milestone.md` (write side) and `plan-milestone-gaps.md` (read side). The changes add `gaps.test_consolidation` to the MILESTONE-AUDIT.md YAML frontmatter and route consolidation-only audits to `tech_debt` status.

## Key Findings

### 1. Audit-Milestone Structure (Write Side)

**File:** `get-shit-done/workflows/audit-milestone.md`

- Step 3.5 spawns the test steward, stores output as `steward_report`
- Step 4 collects results from phases, integration checker, and steward
- Step 5e is the FAIL gate for unsatisfied requirements
- Step 6 writes the MILESTONE-AUDIT.md with YAML frontmatter containing `gaps` object
- Step 7 presents results and routes by status

**Current `gaps` structure in frontmatter template (step 6):**
```yaml
gaps:
  requirements:
    - id: "{REQ-ID}"
      status: "unsatisfied | partial | orphaned"
      phase: "{assigned phase}"
      ...
  integration: [...]
  flows: [...]
```

**Status values (step 6):** `passed`, `gaps_found`, `tech_debt`

**Current status routing:** No explicit routing for consolidation proposals. The `tech_debt` status is set when there are no blockers but accumulated deferred items. The steward's `test_health` block is written to frontmatter but does not influence status.

### 2. Plan-Milestone-Gaps Structure (Read Side)

**File:** `get-shit-done/workflows/plan-milestone-gaps.md`

- Step 1 loads audit results and parses YAML frontmatter
- Currently parses: `gaps.requirements`, `gaps.integration`, `gaps.flows`
- Step 3 groups gaps into phases
- Step 5 presents gap closure plan

**Consumption method:** LLM agent reads the raw MILESTONE-AUDIT.md file directly. The agent understands YAML by reading the markdown text -- it does NOT use `frontmatter.cjs` programmatically. This means the YAML structure just needs to be well-formed and readable, not machine-parseable by the limited `extractFrontmatter()` function.

### 3. Frontmatter Parser Limitation (Not a Blocker)

**File:** `get-shit-done/bin/lib/frontmatter.cjs`

`extractFrontmatter()` only captures the first key-value from array items with nested properties. For example, `gaps.integration` items with `id`, `severity`, `description`, etc. are flattened to strings like `id: "INT-01"`. The subsequent fields are lost.

**Why this doesn't block Phase 75:** The plan-milestone-gaps workflow reads MILESTONE-AUDIT.md as an LLM agent, parsing YAML by reading the text. The `extractFrontmatter()` code path is used by `gsd-tools.cjs frontmatter get` for programmatic access, but no code consumer of `gaps.test_consolidation` exists or is planned for v2.8 (confirmed in REQUIREMENTS.md Out of Scope).

### 4. Steward Output Format

**File:** `agents/gsd-test-steward.md`

Steward proposals use this format:
```markdown
#### Proposal {N}: {strategy} -- {title}
- **Strategy:** {parameterize | promote | prune | merge}
- **Source:** `{file(s) and test names}`
- **Action:** {specific action to take}
- **Estimated reduction:** {N} test(s)
```

### 5. Live Example (v2.7 Audit)

**File:** `.planning/milestones/v2.7-MILESTONE-AUDIT.md`

Current frontmatter includes:
```yaml
test_health:
  budget_status: "Over Budget"
  redundant_tests: 3
  stale_tests: 0
  consolidation_proposals: 2
```

The `consolidation_proposals: 2` integer and two proposals in the markdown body exist but are not in the `gaps` object. Phase 75 moves the structured data into `gaps.test_consolidation`.

### 6. Status Routing Logic

The audit-milestone workflow has three status outcomes:
- `passed` -- all requirements met, no gaps, minimal debt
- `gaps_found` -- critical blockers exist
- `tech_debt` -- no blockers but accumulated deferred items

The change adds: if all requirements satisfied AND no integration/flow gaps AND `consolidation_proposals > 0`, set status to `tech_debt`. This fits the existing `tech_debt` semantics (no blockers, debt to review).

### 7. Design Doc Field Name Discrepancy

The design doc at `.planning/designs/2026-03-20-test-steward-consolidation-bridge-design.md` uses `reduction` as the field name, while the CONTEXT.md and REQUIREMENTS.md use `estimated_reduction`. The steward agent spec uses `**Estimated reduction:**` as the label. The CONTEXT.md decision is authoritative: use `estimated_reduction` as the field name.

## Implementation Touchpoints

1. **`get-shit-done/workflows/audit-milestone.md`** -- Step 6 frontmatter template: add `gaps.test_consolidation` array. Step 5e/7 area: add consolidation-aware status routing.
2. **`get-shit-done/workflows/plan-milestone-gaps.md`** -- Step 1: add `gaps.test_consolidation` to parsed fields. Step 3: add grouping rule for consolidation phase.
3. **No code changes** -- `frontmatter.cjs`, `autopilot.mjs`, `gsd-tools.cjs` do not need modification.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Write/read mismatch if only one file is changed | Both files modified in same plan (CONTEXT.md decision) |
| Steward disabled produces error in gap parsing | Guard clause: `test_consolidation || []` (CONTEXT.md decision) |
| Existing behavior regression | ROUTE-03 requirement: steward-disabled behavior must be identical to pre-v2.8 |
| `estimated_reduction` vs `reduction` field name | Follow CONTEXT.md: use `estimated_reduction` consistently |

## RESEARCH COMPLETE
