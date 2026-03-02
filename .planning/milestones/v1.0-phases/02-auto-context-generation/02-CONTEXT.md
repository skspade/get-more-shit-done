# Phase 2: Auto-Context Generation - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Agent that replaces interactive discuss-phase with autonomous CONTEXT.md generation. The agent reads PROJECT.md, ROADMAP.md, REQUIREMENTS.md, and the codebase to produce a CONTEXT.md structurally identical to a human-generated one, with every autonomous decision annotated with reasoning. This phase does NOT change verification gates (Phase 3) or failure handling (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Decision sourcing strategy
- Front-load decisions from PROJECT.md (key decisions, constraints, context), ROADMAP.md (phase goal, success criteria, requirements list), and REQUIREMENTS.md (detailed requirement specs mapped to phases)
- Codebase scout: use .planning/codebase/*.md maps when available, fall back to lightweight grep (same as discuss-phase's scout step) when maps don't exist
- Read prior completed phases' CONTEXT.md files for style consistency and user preference reference
- Claude decides everything that isn't explicitly stated in these sources — no ambiguity left unresolved (Claude's Decision: aggressive autonomy because the whole point is no human prompts during autopilot)

### Domain adaptation
- No explicit phase type classification step — Claude reads the phase goal and naturally adapts its decisions to the domain
- Include domain-specific examples in the agent prompt as guidance (e.g., "For visual features, consider layout, density, interactions. For CLI tools, consider flag design, output format, error handling.") — guides without constraining
- Infrastructure/plumbing phases get minimal context (fewer decisions, leaner CONTEXT.md). Rich user-facing phases get more depth (Claude's Decision: appropriate depth per phase because not everything needs the same level of detail)

### Decision annotation format
- Inline annotations only: each Claude-originated decision includes reasoning right in the bullet — `"- [Decision] (Claude's Decision: [reason])"`
- Decisions sourced from PROJECT.md/ROADMAP.md/REQUIREMENTS.md appear as normal bullets with no annotation — they're the user's decisions
- One-line reasoning — concise and scannable, not multi-sentence
- Claude's Discretion section preserved for truly low-stakes choices (exact spacing, naming conventions, etc.) that the planner/executor can decide freely

### Integration with discuss-phase
- New `gsd-auto-context` agent file in agents/ directory
- discuss-phase workflow detects `--auto` flag and spawns gsd-auto-context as a subagent via Agent tool (thin orchestrator + subagent pattern)
- Autopilot.sh continues calling `/gsd:discuss-phase --auto` unchanged — routing happens inside discuss-phase
- Agent's sole responsibility: write CONTEXT.md to the phase directory
- discuss-phase handles post-write operations: git commit and STATE.md update (same as interactive path)

### Claude's Discretion
- Agent prompt structure and internal reasoning flow
- Exact codebase scout depth when falling back to grep
- How to handle phases with very sparse ROADMAP descriptions
- Order of sections in generated CONTEXT.md (follow template)

</decisions>

<specifics>
## Specific Ideas

- The auto-context agent should produce output that downstream agents (gsd-phase-researcher, gsd-planner) consume identically to human-generated CONTEXT.md — no special handling needed
- ACTX-04 requires every autonomous decision to include "Claude's Decision: X because Y" — this is the key differentiator from human CONTEXT.md
- Prior CONTEXT.md files serve as style reference, not as decision source — don't copy decisions from Phase 1 to Phase 2
- PROJECT.md has a "Key Decisions" table that captures high-level architectural choices — these should be respected as user decisions

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-tools.cjs init phase-op`: Returns phase metadata (phase_dir, has_context, has_plans, etc.) — agent uses this to set up
- `gsd-tools.cjs commit`: Handles git commits with GSD conventions — discuss-phase uses this after agent returns
- `gsd-tools.cjs state record-session`: Updates STATE.md — discuss-phase uses this after agent returns
- `discuss-phase.md`: Contains scout_codebase step logic that can inform the agent's codebase scan approach
- `templates/context.md`: Canonical CONTEXT.md template with required sections and examples

### Established Patterns
- Thin orchestrator + subagent delegation: discuss-phase orchestrates, agent executes
- File-based state: all cross-session state in `.planning/` markdown files
- Agent files in `agents/` directory (e.g., `gsd-phase-researcher.md`, `gsd-planner.md`)
- Agents receive structured prompts and return results; orchestrators handle commit/state

### Integration Points
- New file: `agents/gsd-auto-context.md` — the auto-context agent
- Modified: `get-shit-done/workflows/discuss-phase.md` — add --auto routing to spawn agent
- Reads: PROJECT.md, ROADMAP.md, REQUIREMENTS.md, prior CONTEXT.md files, codebase maps or source files
- Writes: `{phase_dir}/{padded_phase}-CONTEXT.md`
- Unchanged: `scripts/autopilot.sh` (still calls /gsd:discuss-phase --auto)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-auto-context-generation*
*Context gathered: 2026-03-01*
