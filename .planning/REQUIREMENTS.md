# Requirements: GSD Autopilot

**Defined:** 2026-03-04
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.5 Requirements

Requirements for GSD Brainstorming Command milestone.

### Command

- [x] **CMD-01**: User can invoke `/gsd:brainstorm` to start a brainstorming session
- [x] **CMD-02**: User can pass an optional topic argument (`/gsd:brainstorm [topic]`) to seed the session

### Brainstorming Process

- [x] **BRAIN-01**: Session explores project context (files, docs, recent commits) before asking questions
- [x] **BRAIN-02**: Session asks clarifying questions one at a time, preferring multiple choice
- [x] **BRAIN-03**: Session proposes 2-3 approaches with trade-offs and a recommendation
- [ ] **BRAIN-04**: Session presents design in sections scaled to complexity, with approval after each section
- [ ] **BRAIN-05**: User can request revisions to design sections before approving

### Design Output

- [ ] **DESIGN-01**: Approved design is written to `.planning/designs/YYYY-MM-DD-<topic>-design.md`
- [ ] **DESIGN-02**: Design doc is committed to git after writing

### GSD Routing

- [ ] **ROUTE-01**: After design approval, workflow auto-detects: PROJECT.md exists → new-milestone flow, no PROJECT.md → new-project flow
- [ ] **ROUTE-02**: Design doc context is seeded into the milestone/project creation flow, replacing the questioning phase

### Documentation

- [ ] **DOCS-01**: `/gsd:brainstorm` added to help.md command reference
- [ ] **DOCS-02**: USER-GUIDE.md updated with brainstorm command usage and examples
- [ ] **DOCS-03**: README.md updated with brainstorm command entry

## Future Requirements

### Brainstorming Enhancements

- **BRAIN-06**: Autopilot-compatible mode (auto-approve design sections for fully autonomous brainstorming)
- **BRAIN-07**: Resume a previous brainstorming session from a saved design doc

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying the upstream superpowers:brainstorming skill | Fork maintains its own commands; upstream skill remains independent |
| Interactive design editor | Design docs are markdown files; editing is done by re-running or manual edit |
| Design templates per domain | YAGNI — single design format is sufficient for v1.5 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 25 | Complete |
| CMD-02 | Phase 25 | Complete |
| BRAIN-01 | Phase 25 | Complete |
| BRAIN-02 | Phase 25 | Complete |
| BRAIN-03 | Phase 25 | Complete |
| BRAIN-04 | Phase 26 | Pending |
| BRAIN-05 | Phase 26 | Pending |
| DESIGN-01 | Phase 26 | Pending |
| DESIGN-02 | Phase 26 | Pending |
| ROUTE-01 | Phase 27 | Pending |
| ROUTE-02 | Phase 27 | Pending |
| DOCS-01 | Phase 28 | Pending |
| DOCS-02 | Phase 28 | Pending |
| DOCS-03 | Phase 28 | Pending |

**Coverage:**
- v1.5 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after v1.5 roadmap creation*
