# Requirements: GSD Autopilot

**Defined:** 2026-03-20
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v2.8 Requirements

Requirements for Test Steward Consolidation Bridge. Each maps to roadmap phases.

### Schema

- [x] **SCHEMA-01**: audit-milestone step 6 writes `gaps.test_consolidation` array to MILESTONE-AUDIT.md YAML frontmatter when steward proposals exist
- [x] **SCHEMA-02**: Each `gaps.test_consolidation` entry contains strategy, source, action, and estimated_reduction fields matching the steward's proposal structure
- [x] **SCHEMA-03**: `gaps.test_consolidation` is structurally parallel to existing `gaps.requirements`, `gaps.integration`, `gaps.flows` arrays

### Status Routing

- [x] **ROUTE-01**: Audit with consolidation proposals but no requirement/integration/flow gaps returns `tech_debt` status, not `gaps_found`
- [x] **ROUTE-02**: Audit with consolidation proposals AND other gaps returns `gaps_found` (other gaps take precedence)
- [x] **ROUTE-03**: Audit with no consolidation proposals (steward disabled or no findings) behaves identically to current behavior

### Gap Parsing

- [x] **PARSE-01**: plan-milestone-gaps parses `gaps.test_consolidation` from MILESTONE-AUDIT.md frontmatter alongside existing gap types
- [x] **PARSE-02**: When `gaps.test_consolidation` is absent or empty, plan-milestone-gaps skips test consolidation with no error
- [x] **PARSE-03**: Consolidation phase is created only when `test_health.budget_status` is Warning or Over Budget

### Phase Creation

- [x] **PHASE-01**: All test consolidation proposals are grouped into a single "Test Suite Consolidation" phase
- [x] **PHASE-02**: Consolidation phase is always the last phase in the gap closure sequence
- [x] **PHASE-03**: Consolidation phase appears in the gap closure plan presentation with proposals listed as tasks

### Task Mapping

- [x] **TASK-01**: Prune strategy proposals map to delete tasks with source file paths and "run test suite" verification
- [x] **TASK-02**: Parameterize strategy proposals map to refactor tasks specifying test.each conversion with input list
- [x] **TASK-03**: Promote strategy proposals map to delete-and-verify tasks referencing the subsuming integration test
- [x] **TASK-04**: Merge strategy proposals map to reorganize tasks specifying source and target files
- [x] **TASK-05**: Each task description includes the steward's estimated_reduction count

### Edge Cases

- [x] **EDGE-01**: When only test consolidation gaps exist (no other gap types), plan-milestone-gaps creates just the consolidation phase
- [x] **EDGE-02**: Autopilot audit-fix-reaudit loop handles consolidation phases without special-casing
- [x] **EDGE-03**: Steward proposals use verbatim source file paths and test names from the steward report

## Future Requirements

### Post-v2.8 Enhancements

- **FUTURE-01**: `gsd health` reports pending consolidation proposals in health check output
- **FUTURE-02**: Gap plan presentation shows estimated budget projection after all proposals applied
- **FUTURE-03**: Partial proposal acceptance via frontmatter flags for per-proposal approve/defer

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-apply consolidation without human approval | PROJECT.md decision: `steward.auto_consolidate` remains false — test modifications require human review |
| Per-proposal phases | One phase per proposal creates N plan/execute cycles for related cleanup work — batching is standard |
| Re-spawning steward during execution | Violates single-responsibility — execute phases execute, audit phases audit; the re-audit loop handles verification |
| New gsd-tools dispatch commands for test_consolidation | No programmatic consumer exists or is planned for v2.8 |
| Changes to autopilot.mjs | Existing audit-fix-reaudit loop handles tech_debt routing without modification |
| Changes to gsd-test-steward agent | Steward already produces structured proposals; the bridge consumes them, doesn't change them |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 75 | Complete |
| SCHEMA-02 | Phase 75 | Complete |
| SCHEMA-03 | Phase 75 | Complete |
| ROUTE-01 | Phase 75 | Complete |
| ROUTE-02 | Phase 75 | Complete |
| ROUTE-03 | Phase 75 | Complete |
| PARSE-01 | Phase 76 | Complete |
| PARSE-02 | Phase 76 | Complete |
| PARSE-03 | Phase 76 | Complete |
| PHASE-01 | Phase 76 | Complete |
| PHASE-02 | Phase 76 | Complete |
| PHASE-03 | Phase 76 | Complete |
| TASK-01 | Phase 76 | Complete |
| TASK-02 | Phase 76 | Complete |
| TASK-03 | Phase 76 | Complete |
| TASK-04 | Phase 76 | Complete |
| TASK-05 | Phase 76 | Complete |
| EDGE-01 | Phase 77 | Complete |
| EDGE-02 | Phase 77 | Complete |
| EDGE-03 | Phase 77 | Complete |

**Coverage:**
- v2.8 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
