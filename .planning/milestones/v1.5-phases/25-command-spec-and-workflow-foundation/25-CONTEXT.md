# Phase 25: Command Spec and Workflow Foundation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

User can invoke `/gsd:brainstorm [topic]` and the workflow explores project context, asks clarifying questions one at a time, and proposes 2-3 approaches with trade-offs. This phase delivers the command file, workflow file, and the brainstorming process through approach proposals. Design presentation, design doc output, and GSD routing are deferred to Phases 26-27.

</domain>

<decisions>
## Implementation Decisions

### Command File Structure
- Command file at `commands/gsd/brainstorm.md` following existing GSD command pattern (from PROJECT.md: must use GSD's native command/workflow/agent pattern)
- Command accepts optional `$ARGUMENTS` as topic string (from REQUIREMENTS.md CMD-02)
- Command frontmatter includes `argument-hint: "[topic]"` (from established command convention in linear.md, discuss-phase.md)
- `allowed-tools` includes Read, Write, Bash, Glob, Grep, AskUserQuestion (Claude's Decision: brainstorm is interactive and needs codebase access for context exploration)
- Command delegates to workflow file via `<execution_context>` referencing `@~/.claude/get-shit-done/workflows/brainstorm.md` (Claude's Decision: matches linear.md and discuss-phase.md delegation pattern)

### Workflow File Structure
- Single workflow file at `get-shit-done/workflows/brainstorm.md` (from PROJECT.md: single workflow file pattern established by linear.md)
- Workflow is a `<process>` with numbered steps, not an agent (Claude's Decision: brainstorm is interactive and conversational like discuss-phase, not autonomous like auto-context)
- Workflow handles the full Phase 25 scope: context exploration, clarifying questions, approach proposals (from ROADMAP.md success criteria)
- Workflow ends at approach proposal stage -- design presentation and doc writing are Phase 26 concerns (from ROADMAP.md phase boundary)

### Context Exploration (BRAIN-01)
- Workflow reads PROJECT.md, REQUIREMENTS.md, ROADMAP.md, and STATE.md before asking any questions (from REQUIREMENTS.md BRAIN-01)
- Workflow reads recent git commits via `git log --oneline -20` (from REQUIREMENTS.md BRAIN-01: "recent commits")
- Workflow scans relevant source files using Glob/Grep based on topic keywords (Claude's Decision: mirrors discuss-phase codebase scout pattern for grounding questions in real code)
- Context exploration results are summarized to the user as a brief "Here's what I found" overview before questions begin (Claude's Decision: user should see that context was gathered, builds trust in the process)

### Clarifying Questions (BRAIN-02)
- Questions asked one at a time via AskUserQuestion tool (from REQUIREMENTS.md BRAIN-02)
- Multiple choice format preferred when options are enumerable (from REQUIREMENTS.md BRAIN-02: "preferring multiple choice")
- Open-ended questions allowed when the domain is too broad for pre-set options (from upstream brainstorming skill pattern)
- 3-5 clarifying questions before proposing approaches (Claude's Decision: enough to understand intent without exhausting the user; matches upstream skill's lightweight questioning)
- Questions focus on: purpose/goal, constraints, success criteria, and user preferences (Claude's Decision: these four dimensions cover the decision space for any brainstorm topic)

### Approach Proposals (BRAIN-03)
- Present 2-3 distinct approaches with trade-offs (from REQUIREMENTS.md BRAIN-03)
- Each approach includes: name, description, pros, cons (Claude's Decision: structured format makes comparison scannable)
- One approach is marked as recommended with stated reasoning (from REQUIREMENTS.md BRAIN-03: "a stated recommendation")
- User selects an approach or requests modifications before proceeding (Claude's Decision: explicit approval gate prevents wasted design effort on wrong direction)

### Session Start Behavior
- When no topic is provided, workflow prompts user for a topic via AskUserQuestion (from REQUIREMENTS.md CMD-01: session starts with no arguments)
- When topic is provided, workflow uses it immediately to seed context exploration (from REQUIREMENTS.md CMD-02)
- Topic string is stored as `$TOPIC` variable for use throughout the workflow (Claude's Decision: consistent variable naming with existing workflow patterns like $ISSUE_IDS in linear.md)

### Claude's Discretion
- Exact phrasing of the context summary shown to the user
- Internal ordering of project file reads during context exploration
- Number of git log entries to display vs just analyze
- Whether to show file paths found during codebase scan or just summarize findings
- Exact question phrasing and multiple choice option text

</decisions>

<specifics>
## Specific Ideas

- The upstream `superpowers:brainstorming` skill (SKILL.md) provides the reference process flow: explore context, ask questions one at a time, propose 2-3 approaches, present design. Phase 25 implements steps 1-3 of this flow. The GSD variant differs by: writing to `.planning/designs/` instead of `docs/plans/`, and routing into GSD milestone/project creation instead of invoking writing-plans skill.
- The todo "Add GSD-integrated brainstorming skill variant" (now complete as planning artifact) confirms the intent: wrap brainstorming process, then feed output into GSD milestone creation flow.
- Out of scope per REQUIREMENTS.md: modifying the upstream superpowers:brainstorming skill, interactive design editor, design templates per domain.
- Future requirements BRAIN-06 (autopilot-compatible mode) and BRAIN-07 (resume from saved design) are explicitly deferred.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commands/gsd/linear.md`: Command file pattern with frontmatter (name, description, argument-hint, allowed-tools), objective, execution_context, context, and process sections. Closest structural analog for the brainstorm command.
- `commands/gsd/discuss-phase.md`: Interactive conversational workflow pattern using AskUserQuestion. Demonstrates how to structure a multi-step questioning flow within GSD.
- `get-shit-done/workflows/linear.md`: Workflow file pattern with `<purpose>`, `<required_reading>`, `<process>` sections and numbered steps. Template for brainstorm.md workflow structure.
- `get-shit-done/workflows/discuss-phase.md`: Codebase scouting pattern (read project files, grep for relevant code, summarize findings). Directly reusable approach for BRAIN-01 context exploration.

### Established Patterns
- Command-to-workflow delegation: Command file defines frontmatter + objective, references workflow via `@~/.claude/get-shit-done/workflows/{name}.md` in `<execution_context>` tag
- AskUserQuestion for interactive flows: Used in discuss-phase and linear (fallback) for one-at-a-time user interaction
- `$ARGUMENTS` variable: Standard way to receive command arguments in GSD commands
- Project file reads: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md are the standard context files read at workflow start

### Integration Points
- New command file: `commands/gsd/brainstorm.md` (alongside existing 33 commands)
- New workflow file: `get-shit-done/workflows/brainstorm.md` (alongside existing 34 workflows)
- No modifications to existing files in this phase -- purely additive
- Phase 26 will extend the workflow with design presentation; Phase 27 will add routing to new-milestone/new-project

</code_context>

<deferred>
## Deferred Ideas

- Design presentation in sections with per-section approval (Phase 26, BRAIN-04/BRAIN-05)
- Design doc writing to `.planning/designs/` (Phase 26, DESIGN-01/DESIGN-02)
- Auto-detect routing to new-milestone vs new-project (Phase 27, ROUTE-01/ROUTE-02)
- Design context seeding into milestone/project creation (Phase 27, ROUTE-02)
- Autopilot-compatible mode for fully autonomous brainstorming (Future, BRAIN-06)
- Resume previous brainstorming session from saved design doc (Future, BRAIN-07)
- Documentation updates to help.md, USER-GUIDE.md, README.md (Phase 28, DOCS-01/02/03)

</deferred>

---

*Phase: 25-command-spec-and-workflow-foundation*
*Context gathered: 2026-03-04 via auto-context*
