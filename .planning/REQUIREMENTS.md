# Requirements: GSD Autopilot

**Defined:** 2026-03-03
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.2 Requirements

Requirements for milestone v1.2: Add Milestone Audit Loop.

### Audit Integration

- [x] **AUDIT-01**: Autopilot automatically runs milestone audit after all phases complete
- [x] **AUDIT-02**: Autopilot parses audit result status (passed / gaps_found / tech_debt) and routes accordingly

### Gap Closure Loop

- [x] **LOOP-01**: Autopilot automatically invokes plan-milestone-gaps when audit finds gaps
- [x] **LOOP-02**: Autopilot executes generated fix phases using existing phase loop
- [x] **LOOP-03**: Autopilot re-runs milestone audit after fix phases complete
- [x] **LOOP-04**: Audit-fix loop repeats until audit passes or max iterations reached
- [x] **LOOP-05**: Autopilot pauses for human escalation when max iterations exhausted

### Milestone Completion

- [x] **COMP-01**: Autopilot automatically invokes complete-milestone when audit passes
- [x] **COMP-02**: Milestone completion runs autonomously (archival, PROJECT.md evolution, commit)

### Configuration

- [x] **CONF-01**: Max audit-fix iterations is configurable (default: 3)
- [x] **CONF-02**: Tech debt handling is configurable via `auto_accept_tech_debt` setting (default: true)

## Future Requirements

None currently deferred.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Partial gap closure (fix some gaps, defer others) | Full loop is simpler — fix everything or escalate |
| Interactive audit review | Autopilot is autonomous — human gate is at verification, not audit |
| Custom audit criteria beyond requirements | audit-milestone already handles this; no autopilot-specific additions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIT-01 | Phase 10 | Complete |
| AUDIT-02 | Phase 10 | Complete |
| LOOP-01 | Phase 11 | Complete |
| LOOP-02 | Phase 11 | Complete |
| LOOP-03 | Phase 11 | Complete |
| LOOP-04 | Phase 11 | Complete |
| LOOP-05 | Phase 11 | Complete |
| COMP-01 | Phase 13 | Complete |
| COMP-02 | Phase 13 | Complete |
| CONF-01 | Phase 11 | Complete |
| CONF-02 | Phase 10 | Complete |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
