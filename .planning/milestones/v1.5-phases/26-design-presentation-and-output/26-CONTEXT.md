# Phase 26: Design Presentation and Output - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

User can approve a design presented in sections, request revisions, and the approved design is written to `.planning/designs/` and committed to git. This phase extends the existing `brainstorm.md` workflow (built in Phase 25) with design presentation after approach selection, a per-section approval/revision loop, design doc file writing, and a git commit. GSD routing into new-milestone or new-project is deferred to Phase 27.

</domain>

<decisions>
## Implementation Decisions

### Workflow Extension
- Extend existing `get-shit-done/workflows/brainstorm.md` by adding steps 6-8 after the current step 5 (from ROADMAP.md: Phase 26 depends on Phase 25, same workflow)
- No new workflow or agent files -- all design presentation logic lives in `brainstorm.md` (Claude's Decision: single workflow file pattern established in Phase 25 and consistent with linear.md approach)
- Update the command file `commands/gsd/brainstorm.md` objective to reflect the full flow including design output (Claude's Decision: objective should describe end-to-end behavior for discoverability)

### Design Section Presentation (BRAIN-04)
- After approach selection, the workflow breaks the chosen approach into sections and presents each one for approval (from REQUIREMENTS.md BRAIN-04)
- Sections are scaled to complexity: simple topics get 3-4 sections, complex topics get 5-7 sections (from REQUIREMENTS.md BRAIN-04: "scaled to complexity")
- Section breakdown adapts to the topic domain rather than using a fixed template (Claude's Decision: brainstorming covers arbitrary topics so a rigid section list would not fit all domains)
- Each section is presented with a header and content, followed by an AskUserQuestion approval prompt (Claude's Decision: reuses existing AskUserQuestion pattern from the clarifying questions step)
- Approval options per section: "Approve", "Request revisions" (Claude's Decision: minimal option set keeps the loop simple and unambiguous)

### Revision Loop (BRAIN-05)
- When user requests revisions, the workflow asks what to change via AskUserQuestion, revises the section, and re-presents it (from REQUIREMENTS.md BRAIN-05)
- Revision loop continues until the user approves each section -- no limit on revision rounds (Claude's Decision: user controls quality; artificial limits would frustrate the creative process)
- Revisions apply only to the current section, not previously approved sections (Claude's Decision: re-opening approved sections adds complexity with no clear benefit for v1.5)

### Design Doc File Output (DESIGN-01)
- After all sections are approved, the workflow assembles the full design into a single markdown file (from REQUIREMENTS.md DESIGN-01)
- File written to `.planning/designs/YYYY-MM-DD-<topic>-design.md` where topic is slugified from `$TOPIC` (from REQUIREMENTS.md DESIGN-01)
- The `.planning/designs/` directory is created if it does not exist (Claude's Decision: first brainstorm session in a project will not have this directory yet)
- Topic slug uses lowercase with hyphens, stripping special characters (Claude's Decision: consistent with existing GSD file naming like `YYYY-MM-DD-<topic>` todo files)
- Design doc includes: title, date, selected approach name, and all approved sections as markdown (Claude's Decision: minimal metadata keeps the doc focused on the design content)

### Git Commit (DESIGN-02)
- After writing the design file, the workflow commits it to git (from REQUIREMENTS.md DESIGN-02)
- Stage only the design file individually using `git add .planning/designs/<filename>` (from execute-plan.md commit protocol: "NEVER `git add .` or `git add -A`")
- Commit message format: `docs(brainstorm): design for <topic>` (Claude's Decision: `docs` type fits design document output; `brainstorm` scope identifies the source command)
- The designs directory itself is staged if newly created (Claude's Decision: git tracks files not directories, but the add command handles this naturally)

### Session Completion
- After commit, display the file path and a completion message (Claude's Decision: user needs to know where the design was saved)
- Workflow ends after the commit -- GSD routing is Phase 27 (from ROADMAP.md phase boundary)

### Claude's Discretion
- Exact section breakdown for any given topic (number and naming of sections)
- Internal markdown formatting within design doc sections
- Exact wording of approval prompts and revision questions
- Whether to show a preview of the assembled design before writing to file
- Exact git commit message wording beyond the `docs(brainstorm):` prefix

</decisions>

<specifics>
## Specific Ideas

- The upstream brainstorming skill writes to `docs/plans/` -- the GSD variant writes to `.planning/designs/` per REQUIREMENTS.md DESIGN-01. This is the primary structural difference.
- The existing workflow step 5 currently displays "This brainstorming session is complete" after approach selection. Phase 26 replaces this with design presentation steps, making step 5 a transition point rather than a termination point.
- REQUIREMENTS.md explicitly defers BRAIN-06 (autopilot-compatible mode with auto-approve) and BRAIN-07 (resume from saved design). Phase 26 implements only the interactive approval path.
- Out of scope per REQUIREMENTS.md: interactive design editor, design templates per domain, modifying upstream brainstorming skill.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/brainstorm.md`: The workflow to extend. Currently has 5 steps (parse topic, explore context, clarifying questions, propose approaches, session complete). Phase 26 adds steps after approach selection.
- `commands/gsd/brainstorm.md`: Command file with frontmatter, objective, and execution_context pointing to brainstorm workflow. Objective text needs updating to reflect design output.
- AskUserQuestion tool: Already used in brainstorm.md steps 1, 3, and 4 for topic prompt, clarifying questions, and approach selection. Same pattern reused for section approval.

### Established Patterns
- Single workflow file pattern: `linear.md` workflow is a single file handling the full flow (510 lines). `brainstorm.md` follows the same pattern -- extend in place rather than splitting into multiple files.
- AskUserQuestion with options: Used for approach selection in step 4 with `options` parameter listing choices. Same pattern for section approval (Approve / Request revisions).
- Git commit protocol from `execute-plan.md`: Stage files individually, use conventional commit format `{type}({scope}): {description}`.
- File naming with date slug: `.planning/designs/YYYY-MM-DD-<topic>-design.md` matches existing patterns like todo files (`YYYY-MM-DD-<topic>.md`).

### Integration Points
- Modify `get-shit-done/workflows/brainstorm.md`: Replace step 5 (session complete) with design presentation steps, then add file writing and git commit steps
- Modify `commands/gsd/brainstorm.md`: Update objective text to describe design output
- Create `.planning/designs/` directory at runtime if it does not exist (via `mkdir -p`)
- No modifications to other existing workflows or commands

</code_context>

<deferred>
## Deferred Ideas

- Auto-detect routing to new-milestone vs new-project after design approval (Phase 27, ROUTE-01/ROUTE-02)
- Design context seeding into milestone/project creation flow (Phase 27, ROUTE-02)
- Autopilot-compatible mode with auto-approve for design sections (Future, BRAIN-06)
- Resume previous brainstorming session from saved design doc (Future, BRAIN-07)
- Documentation updates to help.md, USER-GUIDE.md, README.md (Phase 28, DOCS-01/02/03)

</deferred>

---

*Phase: 26-design-presentation-and-output*
*Context gathered: 2026-03-04 via auto-context*
