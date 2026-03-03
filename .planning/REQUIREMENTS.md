# Requirements: GSD Autopilot

**Defined:** 2026-03-03
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.2 Requirements

Requirements for milestone v1.2: Add Milestone Audit Loop.

### Audit Integration

- [ ] **AUDIT-01**: Autopilot automatically runs milestone audit after all phases complete
- [ ] **AUDIT-02**: Autopilot parses audit result status (passed / gaps_found / tech_debt) and routes accordingly

### Gap Closure Loop

- [ ] **LOOP-01**: Autopilot automatically invokes plan-milestone-gaps when audit finds gaps
- [ ] **LOOP-02**: Autopilot executes generated fix phases using existing phase loop
- [ ] **LOOP-03**: Autopilot re-runs milestone audit after fix phases complete
- [ ] **LOOP-04**: Audit-fix loop repeats until audit passes or max iterations reached
- [ ] **LOOP-05**: Autopilot pauses for human escalation when max iterations exhausted

### Milestone Completion

- [ ] **COMP-01**: Autopilot automatically invokes complete-milestone when audit passes
- [ ] **COMP-02**: Milestone completion runs autonomously (archival, PROJECT.md evolution, commit)

### Configuration

- [ ] **CONF-01**: Max audit-fix iterations is configurable (default: 3)
- [ ] **CONF-02**: Tech debt handling is configurable via `auto_accept_tech_debt` setting (default: true)

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
| AUDIT-01 | — | Pending |
| AUDIT-02 | — | Pending |
| LOOP-01 | — | Pending |
| LOOP-02 | — | Pending |
| LOOP-03 | — | Pending |
| LOOP-04 | — | Pending |
| LOOP-05 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |
| CONF-01 | — | Pending |
| CONF-02 | — | Pending |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after initial definition*
