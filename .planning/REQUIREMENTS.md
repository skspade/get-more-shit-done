# Requirements: GSD Autopilot

**Defined:** 2026-03-22
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v3.0 Requirements

Requirements for the Linear Interview Refactor milestone. Each maps to roadmap phases.

### Interview

- [ ] **INTV-01**: Interview asks 3-5 adaptive questions via AskUserQuestion after ticket fetch, skipping questions already answered by the ticket
- [ ] **INTV-02**: Pre-scan reads ticket title, description, labels, and comments to build internal checklist of what information is already present
- [ ] **INTV-03**: Each interview question adapts based on previous answers — questions are not a static form
- [ ] **INTV-04**: Interview covers five dimensions: goal clarification, scope boundaries, success criteria, complexity signal, additional context
- [ ] **INTV-05**: All interview Q&A stored as `$INTERVIEW_CONTEXT` and threaded to all 6 downstream consumers

### Routing

- [ ] **ROUT-01**: Complexity signal question determines route — "Quick task (hours)" → quick, "Medium (1-2 sessions)" → quick with `$FULL_MODE`, "Milestone (multi-phase)" → milestone
- [ ] **ROUT-02**: `$MILESTONE_SCORE` heuristic (6-factor scoring table and threshold) removed entirely
- [ ] **ROUT-03**: Override flags (`--quick`, `--milestone`) skip complexity question but still run other interview questions
- [ ] **ROUT-04**: When complexity question is skipped (ticket explicitly states scope), Claude infers route from ticket content and asks for confirmation

### Output

- [ ] **OUTP-01**: Quick route shows confirmation summary (issue, goal, scope, criteria, route) with "Yes, proceed" / "No, let me clarify" options
- [ ] **OUTP-02**: "No, let me clarify" re-enters the relevant interview question rather than restarting the whole interview
- [ ] **OUTP-03**: Milestone route shows 2-3 approach proposals with pros/cons and a recommendation (brainstorm Step 4 pattern)
- [ ] **OUTP-04**: User selects approach via AskUserQuestion; selected approach feeds into MILESTONE-CONTEXT.md under `## Selected Approach` section

### Comment-Back

- [ ] **CMNT-01**: Interview summary posted to Linear ticket via MCP `create_comment` before execution starts
- [ ] **CMNT-02**: Comment includes goal, scope, criteria, route, and selected approach (for milestone route)
- [ ] **CMNT-03**: MCP failure shows warning but does not block execution (non-blocking pattern)
- [ ] **CMNT-04**: Existing post-execution completion comment-back remains unchanged — tickets get two comments total

### Workflow

- [ ] **WKFL-01**: Workflow steps renumbered to accommodate new phases (7 → 9 steps)
- [ ] **WKFL-02**: `linear-context.md` frontmatter gains `interview_summary` text field
- [ ] **WKFL-03**: Quick route description synthesis uses interview-enriched goal/scope/criteria instead of raw `title + description[:1500]` truncation
- [ ] **WKFL-04**: Milestone MILESTONE-CONTEXT.md includes `## Selected Approach` section from approach proposals
- [ ] **WKFL-05**: Command spec (`commands/gsd/linear.md`) updated with interview phase in objective description
- [ ] **WKFL-06**: Success criteria updated — scoring references replaced with interview references

## Future Requirements

### Multi-Issue Interview

- **MULTI-01**: Interview strategy for multiple issue IDs provided simultaneously
- **MULTI-02**: Per-issue vs batch interview decision logic

## Out of Scope

| Feature | Reason |
|---------|--------|
| More than 5 interview questions | 3-5 is the brainstorm-proven sweet spot; more becomes interrogation |
| Interview question configuration | Universal dimensions (goal, scope, criteria, complexity, context) don't need customization |
| Persisting interview history | Each ticket is its own context; Linear comment serves as persistent record |
| Auto-answering from ticket data | Doubles interaction surface without adding value; skip entirely instead |
| Numeric scoring as fallback | Two routing mechanisms means two code paths; the interview is the replacement |
| Streaming/typing UX during interview | No meaningful computation delay to indicate |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTV-01 | Phase 84 | Pending |
| INTV-02 | Phase 84 | Pending |
| INTV-03 | Phase 84 | Pending |
| INTV-04 | Phase 84 | Pending |
| INTV-05 | Phase 84 | Pending |
| ROUT-01 | Phase 84 | Pending |
| ROUT-02 | Phase 84 | Pending |
| ROUT-03 | Phase 84 | Pending |
| ROUT-04 | Phase 84 | Pending |
| OUTP-01 | Phase 85 | Pending |
| OUTP-02 | Phase 85 | Pending |
| OUTP-03 | Phase 85 | Pending |
| OUTP-04 | Phase 85 | Pending |
| CMNT-01 | Phase 86 | Pending |
| CMNT-02 | Phase 86 | Pending |
| CMNT-03 | Phase 86 | Pending |
| CMNT-04 | Phase 86 | Pending |
| WKFL-01 | Phase 84 | Pending |
| WKFL-02 | Phase 86 | Pending |
| WKFL-03 | Phase 86 | Pending |
| WKFL-04 | Phase 86 | Pending |
| WKFL-05 | Phase 87 | Pending |
| WKFL-06 | Phase 87 | Pending |

**Coverage:**
- v3.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
