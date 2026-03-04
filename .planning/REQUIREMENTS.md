# Requirements: GSD Autopilot

**Defined:** 2026-03-03
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.4 Requirements

Requirements for Linear integration milestone. Each maps to roadmap phases.

### CLI Infrastructure

- [ ] **INIT-01**: `init linear` command returns models, paths, quick task numbering, and config data as JSON

### Command Spec

- [ ] **CMD-01**: `/gsd:linear` command spec with frontmatter (name, allowed-tools including Linear MCP tools), objective, and execution_context

### Workflow

- [ ] **WKFL-01**: Workflow parses issue IDs and flags (`--quick`, `--milestone`, `--full`) from arguments
- [ ] **WKFL-02**: Workflow fetches Linear issue data and comments via MCP tools (`get_issue`, `list_comments`)
- [ ] **WKFL-03**: Workflow routes to quick or milestone based on scoring heuristic (issue count, sub-issues, description length, labels, relations)
- [ ] **WKFL-04**: Flag overrides (`--quick`, `--milestone`) bypass routing heuristic
- [ ] **WKFL-05**: Quick route synthesizes description and delegates to quick workflow
- [ ] **WKFL-06**: Milestone route writes MILESTONE-CONTEXT.md and delegates to new-milestone workflow
- [ ] **WKFL-07**: Summary comment posted back to Linear issues after completion
- [ ] **WKFL-08**: Cleanup removes temporary linear-context.md after completion

### Documentation

- [ ] **DOCS-01**: USER-GUIDE.md includes `/gsd:linear` command reference with flags and examples
- [ ] **DOCS-02**: README.md mentions Linear integration capability

## Future Requirements

None identified.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Linear issue creation from GSD | Read-only integration for v1.4; creating issues adds write-side complexity |
| Linear project/cycle mapping | Focus on individual issue routing, not project-level sync |
| Webhook-driven automation | MCP-based pull model is simpler and sufficient |
| Issue status updates | Comment-back is sufficient feedback; status transitions are managed in Linear |
| Batch processing of all team issues | Single-invocation model; user picks which issues to process |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INIT-01 | Phase 20 | Pending |
| CMD-01 | Phase 20 | Pending |
| WKFL-01 | Phase 21 | Pending |
| WKFL-02 | Phase 21 | Pending |
| WKFL-03 | Phase 21 | Pending |
| WKFL-04 | Phase 21 | Pending |
| WKFL-05 | Phase 21 | Pending |
| WKFL-06 | Phase 21 | Pending |
| WKFL-07 | Phase 22 | Pending |
| WKFL-08 | Phase 22 | Pending |
| DOCS-01 | Phase 23 | Pending |
| DOCS-02 | Phase 23 | Pending |

**Coverage:**
- v1.4 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
