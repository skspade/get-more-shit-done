# Requirements: GSD Autopilot

**Defined:** 2026-03-02
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.1 Requirements

Requirements for removing automated git tagging from this fork.

### Workflow

- [ ] **WF-01**: The `git_tag` step is removed from the `complete-milestone.md` workflow (no annotated tag creation)
- [ ] **WF-02**: The git tag push prompt and logic is removed from the `complete-milestone.md` workflow
- [ ] **WF-03**: The `complete-milestone.md` command spec no longer references git tagging

### Documentation

- [ ] **DOC-01**: `help.md` no longer mentions "Creates git tag for the release"
- [ ] **DOC-02**: `README.md` no longer references automated git tagging during milestone completion
- [ ] **DOC-03**: `USER-GUIDE.md` no longer references automated git tagging

## Future Requirements

None — this is a focused removal milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| CHANGELOG link updates | Historical links to upstream tags — leave as-is |
| Removing version numbering | Versions still useful for milestone tracking, just not as git tags |
| milestone.cjs changes | The code doesn't create git tags — only handles file archival |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WF-01 | TBD | Pending |
| WF-02 | TBD | Pending |
| WF-03 | TBD | Pending |
| DOC-01 | TBD | Pending |
| DOC-02 | TBD | Pending |
| DOC-03 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 6 total
- Mapped to phases: 0
- Unmapped: 6 ⚠️

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
