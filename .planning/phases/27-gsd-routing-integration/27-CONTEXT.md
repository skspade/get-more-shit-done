# Phase 27: GSD Routing Integration - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

After design approval, the brainstorm workflow automatically detects whether PROJECT.md exists and routes into the correct GSD creation flow (new-milestone or new-project) with design context seeded so the questioning phase is skipped or pre-answered. This phase extends the existing `brainstorm.md` workflow with routing logic after the git commit step, and ensures the design doc content flows into the creation workflow as pre-populated context. Documentation updates are deferred to Phase 28.

</domain>

<decisions>
## Implementation Decisions

### Project State Detection (ROUTE-01)
- After the design file is committed (step 8), check for `.planning/PROJECT.md` existence to determine routing (from REQUIREMENTS.md ROUTE-01)
- If PROJECT.md exists: route to new-milestone flow (from REQUIREMENTS.md ROUTE-01: "PROJECT.md exists -> new-milestone flow")
- If PROJECT.md does not exist: route to new-project flow (from REQUIREMENTS.md ROUTE-01: "no PROJECT.md -> new-project flow")
- Detection uses file existence check via Bash `test -f .planning/PROJECT.md` (Claude's Decision: simplest reliable check, consistent with how `gsd-tools.cjs init` detects project_exists via pathExistsInternal)

### Workflow Extension Point
- Add steps 9-10 to the brainstorm.md workflow after the current step 8 (git commit) (Claude's Decision: follows Phase 26 pattern of extending brainstorm.md sequentially)
- Step 9: detect project state and build context file; Step 10: route into the correct creation flow (Claude's Decision: separating detection from execution keeps each step focused)
- No new workflow or agent files -- all routing logic lives in `brainstorm.md` (from PROJECT.md: single workflow file pattern established by linear.md, continued in Phases 25-26)

### Design Context Seeding (ROUTE-02)
- Build a MILESTONE-CONTEXT.md from the design doc for the new-milestone path (from established pattern: linear.md builds MILESTONE-CONTEXT.md for new-milestone consumption at step 5a)
- The design doc content replaces the questioning phase -- milestone goals, features, and scope are extracted from the approved design sections (from REQUIREMENTS.md ROUTE-02: "replaces the questioning phase")
- For the new-project path, pass the design doc file path as `--auto @.planning/designs/{filename}` argument to the new-project flow (Claude's Decision: new-project.md already supports --auto with a document reference, reusing this eliminates custom seeding logic)

### Milestone Route Context Format
- Write `.planning/MILESTONE-CONTEXT.md` with design doc content structured as milestone features (from linear.md pattern: MILESTONE-CONTEXT.md is the established handoff format for new-milestone)
- MILESTONE-CONTEXT.md includes: source attribution (brainstorm session), topic, selected approach name, and each design section mapped as a feature (Claude's Decision: mirrors linear.md's MILESTONE-CONTEXT.md structure while adapting source from Linear issues to design doc)
- new-milestone workflow step 2 already detects MILESTONE-CONTEXT.md and uses it to skip questioning (from new-milestone.md: "If MILESTONE-CONTEXT.md exists: Use features and scope from discuss-milestone")

### New-Project Route Integration
- Invoke `/gsd:new-project --auto @{design_file_path}` to start the new-project flow with the design doc as the idea document (Claude's Decision: new-project --auto already synthesizes PROJECT.md from a provided document and auto-runs research/requirements/roadmap -- exact fit for post-brainstorm greenfield)
- The design doc serves as the "idea document" that --auto mode expects (from new-project.md: "Auto mode requires an idea document")

### User Confirmation Before Routing
- After the design commit, ask the user whether to proceed with GSD creation or stop (Claude's Decision: user may want to brainstorm without immediately starting a project/milestone; forcing routing would reduce brainstorm utility as a standalone tool)
- Use AskUserQuestion with options: "Create milestone" (if PROJECT.md exists), "Create project" (if no PROJECT.md), and "Done -- just keep the design" (Claude's Decision: three options cover all cases while giving user control)

### Inline Execution vs Command Delegation
- For new-milestone: execute the new-milestone workflow steps inline within brainstorm.md rather than invoking `/gsd:new-milestone` as a separate command (from established pattern: linear.md executes new-milestone steps 1-11 inline at step 5c)
- For new-project: invoke `/gsd:new-project --auto` as a command delegation since new-project requires its own command context and tool permissions including Task for subagent spawning (Claude's Decision: new-project spawns research subagents via Task tool which brainstorm.md does not have in allowed-tools; command delegation avoids permission issues)

### Command File Update
- Update `commands/gsd/brainstorm.md` allowed-tools to include Task tool for new-milestone inline execution (Claude's Decision: new-milestone spawns researcher and roadmapper subagents via Task, which requires Task in allowed-tools)
- Update the command objective to describe the full flow including routing (Claude's Decision: objective should reflect end-to-end behavior)

### Claude's Discretion
- Exact wording of the routing confirmation prompt
- Format of the MILESTONE-CONTEXT.md content (exact heading structure within the established pattern)
- Whether to display a routing banner before executing the creation flow
- Internal variable naming for the design file path reference

</decisions>

<specifics>
## Specific Ideas

- The linear.md workflow (v1.4) established the pattern for routing into new-milestone with pre-built MILESTONE-CONTEXT.md. Phase 27 follows the same pattern but sources context from a design doc instead of Linear issues.
- The new-project.md workflow already has `--auto` mode that accepts a document reference and auto-runs the full flow (research, requirements, roadmap) without interactive questioning. This is a direct fit for the brainstorm-to-project path.
- The new-milestone.md workflow step 2 explicitly checks for MILESTONE-CONTEXT.md and uses it to pre-populate milestone goals, skipping the "What do you want to build next?" questioning. This is the exact mechanism ROUTE-02 requires.
- The brainstorm command currently has allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion. Adding Task is needed for the new-milestone inline execution which spawns subagents (researchers, synthesizer, roadmapper).
- Out of scope per REQUIREMENTS.md: autopilot-compatible mode (BRAIN-06), resume from saved design (BRAIN-07), modifying upstream brainstorming skill.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/brainstorm.md`: The workflow to extend. Currently has 8 steps (parse topic through git commit). Phase 27 adds steps 9-10 for routing.
- `get-shit-done/workflows/new-milestone.md`: Steps 1-11 to execute inline for the milestone route. Key integration: step 2 detects MILESTONE-CONTEXT.md.
- `get-shit-done/workflows/new-project.md`: Supports `--auto @document` mode for fully automated project creation from an idea document.
- `get-shit-done/workflows/linear.md`: Reference implementation for MILESTONE-CONTEXT.md creation (step 5a) and inline new-milestone execution (step 5c).
- `get-shit-done/bin/lib/init.cjs`: `project_exists` field checks `pathExistsInternal(cwd, '.planning/PROJECT.md')` -- the same detection logic brainstorm routing needs.

### Established Patterns
- MILESTONE-CONTEXT.md handoff: Write a structured markdown file to `.planning/MILESTONE-CONTEXT.md` that new-milestone workflow consumes and deletes. Used by linear.md.
- Inline workflow execution: linear.md executes new-milestone steps 1-11 inline rather than invoking a separate command. Appropriate when the parent workflow has Task tool access.
- Command delegation with --auto: new-project supports `--auto @file` for document-driven initialization without interactive questioning.
- `gsd-tools.cjs init`: Provides `project_exists` boolean. Can be called as `init new-milestone` or `init new-project` to get flow-specific context.

### Integration Points
- Modify `get-shit-done/workflows/brainstorm.md`: Add steps 9-10 after step 8 (git commit) for project detection and routing
- Modify `commands/gsd/brainstorm.md`: Add Task to allowed-tools, update objective text
- Write `.planning/MILESTONE-CONTEXT.md` at runtime (transient file, consumed by new-milestone flow)
- No modifications to new-milestone.md or new-project.md workflows -- they are consumed as-is

</code_context>

<deferred>
## Deferred Ideas

- Autopilot-compatible mode with auto-approve for design sections and auto-routing (Future, BRAIN-06)
- Resume previous brainstorming session from saved design doc (Future, BRAIN-07)
- Documentation updates to help.md, USER-GUIDE.md, README.md (Phase 28, DOCS-01/02/03)

</deferred>

---

*Phase: 27-gsd-routing-integration*
*Context gathered: 2026-03-04 via auto-context*
