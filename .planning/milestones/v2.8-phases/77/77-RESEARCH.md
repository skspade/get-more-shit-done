# Phase 77: Edge Case Hardening and Validation - Research

**Researched:** 2026-03-20
**Status:** Complete

## Key Findings

### 1. plan-milestone-gaps.md Structure (Primary Validation Target)

The workflow file at `get-shit-done/workflows/plan-milestone-gaps.md` contains all consolidation logic added in Phases 75-76:

- **Step 1** (line 22-26): Parses `gaps.test_consolidation` with `|| []` guard, extracts `test_health.budget_status` defaulting to `OK`
- **Step 3** (line 55-64): Budget gating — OK skips consolidation, Warning/Over Budget proceeds; groups all proposals into single "Test Suite Consolidation" phase as last in sequence
- **Step 5** (line 123-131): Presentation with per-task detail and estimated total reduction
- **gap_to_phase_mapping** (line 286-314): Four strategy-to-task templates using verbatim `{source}`, `{action}`, `{estimated_reduction}` placeholders

### 2. Frontmatter Parser (Test Infrastructure)

`get-shit-done/bin/lib/frontmatter.cjs` provides `extractFrontmatter()` which parses YAML frontmatter. Tests in `tests/frontmatter.test.cjs` demonstrate the testing pattern: construct frontmatter strings, parse them, assert on structure.

The parser handles nested objects and arrays (gaps.requirements, gaps.test_consolidation), inline arrays, and nested key-value pairs (test_health.budget_status). This is the programmatic entry point for validating that crafted MILESTONE-AUDIT.md fixtures parse correctly.

### 3. Existing MILESTONE-AUDIT.md Structure

`.planning/v2.3-MILESTONE-AUDIT.md` shows the real-world frontmatter structure:
- `gaps.requirements: []` (empty array when no gaps)
- `gaps.integration: [...]` (array of objects with id, type, description, severity)
- `gaps.flows: []`
- `test_health.budget_status: "Warning"`
- `test_health.consolidation_proposals: 1`

### 4. Autopilot tech_debt Routing (Read-Only Validation)

`autopilot.mjs` lines 898-921 show the `runMilestoneAudit()` function:
- `tech_debt` status with `auto_accept_tech_debt=true` → returns 0 (passed)
- `tech_debt` status with `auto_accept_tech_debt=false` → returns 10 (gaps)
- `gaps_found` → returns 10
- `passed` → returns 0

`runGapClosureLoop()` (line 924+) processes gap closure phases through the standard discuss-plan-execute-verify cycle with no consolidation-specific code. This confirms EDGE-02: no special-casing needed.

### 5. Test Budget Status

Project currently at 807/800 tests (Over Budget). Phase budget: 50 per phase. Edge case tests should be minimal — focus on frontmatter parsing validation, not heavy integration tests.

### 6. Testing Approach

The most reliable validation approach: write tests against `extractFrontmatter()` with crafted MILESTONE-AUDIT.md frontmatter covering each edge case. This validates the actual parsing logic that plan-milestone-gaps relies on.

Edge cases to test:
1. **Consolidation-only**: gaps.requirements=[], gaps.integration=[], gaps.flows=[], gaps.test_consolidation=[{entries}], test_health.budget_status="Over Budget"
2. **Mixed gaps with consolidation**: All gap types populated
3. **Empty consolidation array**: gaps.test_consolidation=[]
4. **Absent consolidation field**: No gaps.test_consolidation key at all
5. **Budget OK with proposals**: test_health.budget_status="OK" — consolidation should be skipped
6. **Verbatim field passthrough**: Verify source paths and action strings parse without modification

### 7. Workflow File Validation (Non-Code)

The plan-milestone-gaps.md workflow is a markdown instruction file, not executable code. The edge case validation needs to:
- Verify frontmatter parsing handles all edge case structures correctly
- Confirm autopilot.mjs tech_debt routing works for consolidation-only audits (read-only inspection)
- Validate the workflow instructions are internally consistent

## Architecture Decisions

- Test file: `tests/edge-cases-consolidation.test.cjs` — separate file for consolidation edge cases
- Use `extractFrontmatter()` from frontmatter.cjs as the parsing validation entry point
- Construct frontmatter fixtures that mirror real MILESTONE-AUDIT.md structure
- Read-only validation of autopilot.mjs — no modifications per REQUIREMENTS.md Out of Scope

---

*Phase: 77-edge-case-hardening-and-validation*
*Research completed: 2026-03-20*
