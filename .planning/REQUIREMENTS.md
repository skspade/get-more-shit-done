# Requirements: GSD Autopilot

**Defined:** 2026-03-03
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.4 Requirements

Requirements for Linear integration milestone. Each maps to roadmap phases.

### CLI Infrastructure

- [x] **INIT-01**: `init linear` command returns models, paths, quick task numbering, and config data as JSON

### Command Spec

- [x] **CMD-01**: `/gsd:linear` command spec with frontmatter (name, allowed-tools including Linear MCP tools), objective, and execution_context

### Workflow

- [x] **WKFL-01**: Workflow parses issue IDs and flags (`--quick`, `--milestone`, `--full`) from arguments
- [x] **WKFL-02**: Workflow fetches Linear issue data and comments via MCP tools (`get_issue`, `list_comments`)
- [x] **WKFL-03**: Workflow routes to quick or milestone based on scoring heuristic (issue count, sub-issues, description length, labels, relations)
- [x] **WKFL-04**: Flag overrides (`--quick`, `--milestone`) bypass routing heuristic
- [x] **WKFL-05**: Quick route synthesizes description and delegates to quick workflow
- [x] **WKFL-06**: Milestone route writes MILESTONE-CONTEXT.md and delegates to new-milestone workflow
- [x] **WKFL-07**: Summary comment posted back to Linear issues after completion
- [x] **WKFL-08**: Cleanup removes temporary linear-context.md after completion

### Documentation

- [x] **DOCS-01**: USER-GUIDE.md includes `/gsd:linear` command reference with flags and examples
- [x] **DOCS-02**: README.md mentions Linear integration capability

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
| INIT-01 | Phase 20 | Complete |
| CMD-01 | Phase 24 | Complete |
| WKFL-01 | Phase 21 | Complete |
| WKFL-02 | Phase 21 | Complete |
| WKFL-03 | Phase 21 | Complete |
| WKFL-04 | Phase 21 | Complete |
| WKFL-05 | Phase 21 | Complete |
| WKFL-06 | Phase 21 | Complete |
| WKFL-07 | Phase 22 | Complete |
| WKFL-08 | Phase 22 | Complete |
| DOCS-01 | Phase 24 | Complete |
| DOCS-02 | Phase 24 | Complete |

**Coverage:**
- v1.4 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-04 after Phase 24 gap closure complete*
