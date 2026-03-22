# Requirements: GSD Autopilot

**Defined:** 2026-03-22
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v3.0 Requirements

Requirements for the Linear Interview Refactor milestone. Each maps to roadmap phases.

### Interview

- [x] **INTV-01**: Interview asks 3-5 adaptive questions via AskUserQuestion after ticket fetch, skipping questions already answered by the ticket
- [x] **INTV-02**: Pre-scan reads ticket title, description, labels, and comments to build internal checklist of what information is already present
- [x] **INTV-03**: Each interview question adapts based on previous answers — questions are not a static form
- [x] **INTV-04**: Interview covers five dimensions: goal clarification, scope boundaries, success criteria, complexity signal, additional context
- [x] **INTV-05**: All interview Q&A stored as `$INTERVIEW_CONTEXT` and threaded to all 6 downstream consumers

### Routing

- [x] **ROUT-01**: Complexity signal question determines route — "Quick task (hours)" → quick, "Medium (1-2 sessions)" → quick with `$FULL_MODE`, "Milestone (multi-phase)" → milestone
- [x] **ROUT-02**: `$MILESTONE_SCORE` heuristic (6-factor scoring table and threshold) removed entirely
- [x] **ROUT-03**: Override flags (`--quick`, `--milestone`) skip complexity question but still run other interview questions
- [x] **ROUT-04**: When complexity question is skipped (ticket explicitly states scope), Claude infers route from ticket content and asks for confirmation

### Output

- [x] **OUTP-01**: Quick route shows confirmation summary (issue, goal, scope, criteria, route) with "Yes, proceed" / "No, let me clarify" options
- [x] **OUTP-02**: "No, let me clarify" re-enters the relevant interview question rather than restarting the whole interview
- [x] **OUTP-03**: Milestone route shows 2-3 approach proposals with pros/cons and a recommendation (brainstorm Step 4 pattern)
- [x] **OUTP-04**: User selects approach via AskUserQuestion; selected approach feeds into MILESTONE-CONTEXT.md under `## Selected Approach` section

### Comment-Back

- [x] **CMNT-01**: Interview summary posted to Linear ticket via MCP `create_comment` before execution starts
- [x] **CMNT-02**: Comment includes goal, scope, criteria, route, and selected approach (for milestone route)
- [x] **CMNT-03**: MCP failure shows warning but does not block execution (non-blocking pattern)
- [x] **CMNT-04**: Existing post-execution completion comment-back remains unchanged — tickets get two comments total

### Workflow

- [x] **WKFL-01**: Workflow steps renumbered to accommodate new phases (7 → 10 steps)
- [x] **WKFL-02**: `linear-context.md` frontmatter gains `interview_summary` text field
- [x] **WKFL-03**: Quick route description synthesis uses interview-enriched goal/scope/criteria instead of raw `title + description[:1500]` truncation
- [x] **WKFL-04**: Milestone MILESTONE-CONTEXT.md includes `## Selected Approach` section from approach proposals
- [x] **WKFL-05**: Command spec (`commands/gsd/linear.md`) updated with interview phase in objective description
- [x] **WKFL-06**: Success criteria updated — scoring references replaced with interview references

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
| INTV-01 | Phase 84 | Satisfied |
| INTV-02 | Phase 84 | Satisfied |
| INTV-03 | Phase 84 | Satisfied |
| INTV-04 | Phase 84 | Satisfied |
| INTV-05 | Phase 84 | Satisfied |
| ROUT-01 | Phase 84 | Satisfied |
| ROUT-02 | Phase 84 | Satisfied |
| ROUT-03 | Phase 84 | Satisfied |
| ROUT-04 | Phase 84 | Satisfied |
| OUTP-01 | Phase 85 | Satisfied |
| OUTP-02 | Phase 85 | Satisfied |
| OUTP-03 | Phase 85 | Satisfied |
| OUTP-04 | Phase 85 | Satisfied |
| CMNT-01 | Phase 89 | Satisfied |
| CMNT-02 | Phase 89 | Satisfied |
| CMNT-03 | Phase 89 | Satisfied |
| CMNT-04 | Phase 89 | Satisfied |
| WKFL-01 | Phase 84 | Satisfied |
| WKFL-02 | Phase 86 | Satisfied |
| WKFL-03 | Phase 86 | Satisfied |
| WKFL-04 | Phase 86 | Satisfied |
| WKFL-05 | Phase 87 | Satisfied |
| WKFL-06 | Phase 87 | Satisfied |

**Coverage:**
- v3.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
