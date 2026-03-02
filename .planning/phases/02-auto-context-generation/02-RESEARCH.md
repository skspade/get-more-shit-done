# Phase 2: Auto-Context Generation - Research

**Researched:** 2026-03-01
**Domain:** Agent design, prompt engineering, structured markdown generation, GSD workflow integration
**Confidence:** HIGH

## Summary

Phase 2 replaces the interactive discuss-phase workflow with an autonomous agent that generates CONTEXT.md files without human input. The core challenge is producing decisions that are (1) structurally identical to human-generated CONTEXT.md, (2) adapted to the phase's domain, and (3) annotated with reasoning for every autonomous choice. The implementation follows GSD's established thin-orchestrator + subagent pattern: discuss-phase.md detects `--auto` and spawns `gsd-auto-context` instead of running interactive question loops.

The agent reads a layered stack of project artifacts (PROJECT.md for constraints and key decisions, ROADMAP.md for phase goal and success criteria, REQUIREMENTS.md for detailed requirement specs) and the codebase (via codebase maps or lightweight grep) to front-load all user-stated decisions. Everything not explicitly stated is decided by Claude with inline reasoning annotations. The CONTEXT.md template already defines the schema -- the agent fills it identically to the interactive path, ensuring downstream agents (gsd-phase-researcher, gsd-planner) consume it unchanged.

**Primary recommendation:** Create a single `gsd-auto-context.md` agent file (~200-300 lines) that receives phase metadata from discuss-phase, reads layered sources, makes domain-adapted decisions, and writes CONTEXT.md. The discuss-phase workflow adds a simple `--auto` routing branch that spawns this agent and handles post-write operations (commit, state update) identically to the interactive path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Front-load decisions from PROJECT.md (key decisions, constraints, context), ROADMAP.md (phase goal, success criteria, requirements list), and REQUIREMENTS.md (detailed requirement specs mapped to phases)
- Codebase scout: use .planning/codebase/*.md maps when available, fall back to lightweight grep (same as discuss-phase's scout step) when maps don't exist
- Read prior completed phases' CONTEXT.md files for style consistency and user preference reference
- Claude decides everything that isn't explicitly stated in these sources -- no ambiguity left unresolved (aggressive autonomy because the whole point is no human prompts during autopilot)
- No explicit phase type classification step -- Claude reads the phase goal and naturally adapts its decisions to the domain
- Include domain-specific examples in the agent prompt as guidance (e.g., "For visual features, consider layout, density, interactions. For CLI tools, consider flag design, output format, error handling.") -- guides without constraining
- Infrastructure/plumbing phases get minimal context (fewer decisions, leaner CONTEXT.md). Rich user-facing phases get more depth
- Inline annotations only: each Claude-originated decision includes reasoning right in the bullet -- "- [Decision] (Claude's Decision: [reason])"
- Decisions sourced from PROJECT.md/ROADMAP.md/REQUIREMENTS.md appear as normal bullets with no annotation -- they're the user's decisions
- One-line reasoning -- concise and scannable, not multi-sentence
- Claude's Discretion section preserved for truly low-stakes choices (exact spacing, naming conventions, etc.) that the planner/executor can decide freely
- New `gsd-auto-context` agent file in agents/ directory
- discuss-phase workflow detects `--auto` flag and spawns gsd-auto-context as a subagent via Agent tool (thin orchestrator + subagent pattern)
- Autopilot.sh continues calling `/gsd:discuss-phase --auto` unchanged -- routing happens inside discuss-phase
- Agent's sole responsibility: write CONTEXT.md to the phase directory
- discuss-phase handles post-write operations: git commit and STATE.md update (same as interactive path)

### Claude's Discretion
- Agent prompt structure and internal reasoning flow
- Exact codebase scout depth when falling back to grep
- How to handle phases with very sparse ROADMAP descriptions
- Order of sections in generated CONTEXT.md (follow template)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACTX-01 | Auto-context agent generates CONTEXT.md replacing interactive discuss phase | Agent file `gsd-auto-context.md` + discuss-phase `--auto` routing. Agent writes CONTEXT.md; discuss-phase handles commit/state (same as interactive path) |
| ACTX-02 | Auto-context uses layered approach: front-load decisions from PROJECT.md and ROADMAP.md, Claude decides remaining ambiguities | Agent reads PROJECT.md (Key Decisions table, constraints), ROADMAP.md (phase goal, success criteria, requirements), REQUIREMENTS.md (detailed specs). Remaining gaps filled by Claude with annotation |
| ACTX-03 | Generated CONTEXT.md is structurally identical to human-generated version (downstream agents work unchanged) | Agent uses same CONTEXT.md template (`templates/context.md`) with all required XML sections: `<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, `<deferred>`. Schema validation: all sections present, no empty required fields |
| ACTX-04 | Every autonomous decision includes explicit reasoning ("Claude's Decision: X because Y") | Agent annotates each self-originated decision inline: `- [Decision] (Claude's Decision: [reason])`. User-sourced decisions have no annotation. The distinction is trackable by downstream agents and humans |
| ACTX-05 | Auto-context adapts to phase domain -- UI phases get layout/interaction decisions, API phases get contract/error decisions, infrastructure phases get minimal context | Agent prompt includes domain-specific guidance examples. No explicit classifier -- Claude naturally adapts based on phase goal text. Infrastructure phases produce leaner CONTEXT.md with fewer decisions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GSD Agent Framework | v1.22.0+ | Agent definition, structured prompts, Task spawning | The project IS GSD -- all agents use this pattern |
| gsd-tools.cjs | Current | State management, config, commits, roadmap queries | Already provides all infrastructure the agent needs |
| Node.js | 18+ | Runtime for gsd-tools.cjs | Required by existing GSD infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| discuss-phase.md workflow | Current | Orchestrator that spawns the agent | Modified to add --auto routing branch |
| templates/context.md | Current | Canonical CONTEXT.md schema | Agent uses this as output format reference |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single agent file | Multi-agent pipeline (scout + decision-maker + writer) | Single agent is simpler, matches GSD's one-agent-per-concern pattern. Multi-agent adds orchestration complexity for no benefit -- the agent reads files, thinks, writes one file |
| Inline domain adaptation | Explicit phase-type classifier step | Inline is simpler and the user decided against explicit classification. Claude's language model naturally adapts to domain context |

## Architecture Patterns

### Agent Integration Pattern
```
autopilot.sh                          discuss-phase.md                    gsd-auto-context
    |                                       |                                   |
    |-- /gsd:discuss-phase N --auto ------->|                                   |
    |                                       |-- detects --auto flag              |
    |                                       |-- spawns agent via Task() -------->|
    |                                       |                                   |-- reads PROJECT.md
    |                                       |                                   |-- reads ROADMAP.md
    |                                       |                                   |-- reads REQUIREMENTS.md
    |                                       |                                   |-- reads prior CONTEXT.md files
    |                                       |                                   |-- scouts codebase
    |                                       |                                   |-- generates decisions
    |                                       |                                   |-- writes CONTEXT.md
    |                                       |                                   |-- returns "CONTEXT GENERATED"
    |                                       |<----------------------------------|
    |                                       |-- commits CONTEXT.md              |
    |                                       |-- updates STATE.md                |
    |                                       |-- auto-advances to plan-phase     |
    |<--------------------------------------|                                   |
```

### Decision Sourcing Hierarchy
```
Priority 1: PROJECT.md Key Decisions table → locked, no annotation
Priority 2: ROADMAP.md phase goal + success criteria → locked, no annotation
Priority 3: REQUIREMENTS.md detailed specs for this phase → locked, no annotation
Priority 4: Prior CONTEXT.md style/patterns → reference only, not copied as decisions
Priority 5: Codebase patterns (maps or grep) → informs decisions, annotated if novel
Priority 6: Claude's domain knowledge → annotated with "(Claude's Decision: reason)"
```

### CONTEXT.md Output Schema
The agent MUST produce exactly this structure (from templates/context.md):
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary
[From ROADMAP.md phase goal -- scope anchor]
</domain>

<decisions>
## Implementation Decisions

### [Category 1]
- [User-sourced decision -- no annotation]
- [Claude-sourced decision] (Claude's Decision: [reason])

### Claude's Discretion
[Low-stakes choices left to planner/executor]
</decisions>

<specifics>
## Specific Ideas
[Concrete references from PROJECT.md or requirements]
</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/utility]: [How it could be used]

### Established Patterns
- [Pattern]: [How it constrains/enables]

### Integration Points
- [Where new code connects]
</code_context>

<deferred>
## Deferred Ideas
[Items explicitly out of scope for this phase]
</deferred>
```

### Anti-Patterns to Avoid
- **Copying decisions from prior phases:** Prior CONTEXT.md files are style references, not decision sources. Each phase gets fresh decisions based on its own goal.
- **Over-deciding infrastructure phases:** Plumbing phases (add a config field, wire up a route) don't need layout decisions. The agent should produce a lean CONTEXT.md.
- **Vague decisions:** "Should feel modern" is not a decision. "Card-based layout with subtle shadows" is. The agent must produce concrete, actionable decisions.
- **Missing annotations:** Every decision not sourced from user documents MUST have the Claude's Decision annotation. This is ACTX-04 and is the key differentiator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase metadata resolution | Custom file parsing | `gsd-tools.cjs init phase-op` | Already returns phase_dir, padded_phase, has_context, etc. |
| Git commits | Raw git commands | `gsd-tools.cjs commit` | Handles GSD commit conventions |
| State updates | Direct STATE.md editing | `gsd-tools.cjs state record-session` | Handles schema correctly |
| ROADMAP phase extraction | Custom markdown parsing | `gsd-tools.cjs roadmap get-phase` | Returns structured JSON with goal, requirements, section |
| Config access | Direct file reads | `gsd-tools.cjs config-get` | Handles defaults and missing config |

**Key insight:** gsd-tools.cjs already provides every infrastructure operation the agent needs. The agent should focus purely on reading sources, making decisions, and writing CONTEXT.md.

## Common Pitfalls

### Pitfall 1: Schema Drift
**What goes wrong:** Auto-generated CONTEXT.md has different sections or XML tags than the template, causing downstream agents to fail parsing.
**Why it happens:** Agent is told to "generate context" without strict schema enforcement.
**How to avoid:** Agent prompt includes the exact CONTEXT.md template structure. Output section names and XML tags are literal requirements, not suggestions. The agent fills in content but never changes structure.
**Warning signs:** Missing `<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, or `<deferred>` XML tags in output.

### Pitfall 2: Annotation Inconsistency
**What goes wrong:** Some Claude-originated decisions lack annotations, or user-sourced decisions get annotated, making ACTX-04 compliance unclear.
**Why it happens:** Agent loses track of which decisions came from which source during generation.
**How to avoid:** Two-pass approach in the agent prompt: (1) extract all user-stated decisions first and mark them, (2) generate remaining decisions with annotations. Clear separation of sourcing.
**Warning signs:** CONTEXT.md with a mix of annotated and unannotated decisions where the pattern doesn't match source attribution.

### Pitfall 3: Domain Obliviousness
**What goes wrong:** An API-focused phase gets UI-style decisions (layout, interactions) because the agent uses generic decision categories.
**Why it happens:** Agent uses a fixed decision template instead of adapting to phase goal.
**How to avoid:** Agent prompt includes domain-specific examples as guidance, and instructs Claude to derive categories from the phase goal text. No fixed category list.
**Warning signs:** Decision categories that don't match the phase domain (e.g., "Layout style" for a database migration phase).

### Pitfall 4: discuss-phase.md Routing Regression
**What goes wrong:** Interactive discuss-phase breaks after adding --auto routing.
**Why it happens:** Conditional logic added incorrectly, affecting the non-auto path.
**How to avoid:** Add --auto check EARLY in the discuss-phase process (after initialize, before check_existing). If --auto, branch to auto-context agent spawn. If not --auto, fall through to existing interactive flow unchanged. Keep changes minimal and isolated.
**Warning signs:** Interactive discuss-phase prompts breaking or skipping steps.

### Pitfall 5: Empty/Sparse ROADMAP Phase Descriptions
**What goes wrong:** Agent produces a nearly empty CONTEXT.md because the ROADMAP phase has minimal description.
**Why it happens:** The layered approach depends on ROADMAP.md having a meaningful goal and success criteria. Some phases may have sparse descriptions.
**How to avoid:** Agent falls back to REQUIREMENTS.md as the primary decision source when ROADMAP description is sparse. If both are sparse, agent still produces decisions based on domain knowledge with aggressive annotation. A phase always has at least a goal and requirement IDs -- these are enough.
**Warning signs:** CONTEXT.md with fewer than 3 implementation decisions for a non-trivial phase.

## Code Examples

### discuss-phase.md --auto Routing Addition
The key modification to discuss-phase.md. After the `initialize` step and before `check_existing`, add:

```markdown
<step name="auto_context_check" priority="after-initialize">
**If `--auto` flag present in $ARGUMENTS:**

Display banner:
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-CONTEXT: PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Generating context autonomously...
\`\`\`

Spawn gsd-auto-context:
\`\`\`
Task(
  prompt="<auto_context_prompt>...</auto_context_prompt>",
  subagent_type="general-purpose",
  model="{resolved_model}",
  description="Auto-generate context for Phase {X}"
)
\`\`\`

On return:
- If "CONTEXT GENERATED": proceed to git_commit step, then update_state, then auto_advance
- If "CONTEXT BLOCKED": display blocker, halt auto-advance

**If no `--auto` flag:** Continue to check_existing (existing interactive flow unchanged).
</step>
```

### gsd-auto-context Agent Prompt Structure
The agent receives from discuss-phase:

```markdown
<objective>
Generate CONTEXT.md for Phase {phase_number}: {phase_name} autonomously.
No human input. Read project artifacts, make decisions, annotate reasoning.
</objective>

<files_to_read>
- .planning/PROJECT.md
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- {prior_context_files} (completed phases' CONTEXT.md for style reference)
</files_to_read>

<phase_info>
Phase: {phase_number}
Name: {phase_name}
Goal: {goal from ROADMAP}
Success criteria: {criteria from ROADMAP}
Requirement IDs: {req_ids}
Phase dir: {phase_dir}
Output file: {phase_dir}/{padded_phase}-CONTEXT.md
</phase_info>

<domain_guidance>
Adapt decisions to the phase domain. Examples:
- Visual features: layout, density, interactions, empty states, animations
- CLI tools: flag design, output format, error handling, progress reporting
- API services: contracts, validation, error responses, authentication
- Infrastructure: minimal decisions, focus on integration points and constraints
- Data processing: input/output formats, error handling, performance constraints
</domain_guidance>

<decision_rules>
1. Extract all decisions from PROJECT.md Key Decisions table -- use as-is, no annotation
2. Extract phase goal and success criteria from ROADMAP.md -- use as constraints, no annotation
3. Extract requirement specs from REQUIREMENTS.md for this phase's IDs -- use as-is, no annotation
4. For everything else, decide autonomously with annotation: "- [Decision] (Claude's Decision: [reason])"
5. Low-stakes implementation details go in Claude's Discretion section
6. Respect scope: only decide things within phase boundary, defer everything else
</decision_rules>

<output_schema>
[Exact CONTEXT.md template structure here -- all XML tags, all sections]
</output_schema>
```

### Agent Return Structure
```markdown
## CONTEXT GENERATED

**Phase:** {phase_number} - {phase_name}
**File:** {phase_dir}/{padded_phase}-CONTEXT.md

### Decisions Made
- {count} user-sourced (from PROJECT.md/ROADMAP.md/REQUIREMENTS.md)
- {count} Claude-originated (with annotations)
- {count} Claude's Discretion items

### Domain Adaptation
- Detected domain: {domain type}
- Decision depth: {standard/minimal/detailed}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Always interactive discuss | Auto-context for autopilot mode | Phase 2 (this phase) | Enables fully autonomous milestone execution |
| Generic agent prompts | Domain-adapted prompts with examples | GSD v1.20+ | Better output quality from agents |
| Separate scout step | Codebase maps integrated into agent workflow | GSD v1.22+ | Faster agent startup, reusable across sessions |

## Open Questions

1. **Edge case: Phase with no requirements mapped**
   - What we know: Every phase in the current roadmap has requirement IDs. The REQUIREMENTS.md traceability table maps all 23 requirements to phases.
   - What's unclear: Could a future phase (inserted via `/gsd:add-phase`) have no requirement IDs?
   - Recommendation: Agent handles gracefully -- fewer decisions from requirements, more from domain knowledge with annotations. Not a blocker.

2. **Codebase map freshness**
   - What we know: Codebase maps (.planning/codebase/*.md) are generated by gsd-codebase-mapper and may be stale.
   - What's unclear: How stale can they be before the agent makes wrong assumptions about reusable assets?
   - Recommendation: Agent reads maps if available but also does a lightweight verification (check that referenced files exist). If maps are missing entirely, grep fallback works fine.

## Sources

### Primary (HIGH confidence)
- Project codebase: discuss-phase.md, autopilot.sh, autopilot.md, gsd-tools.cjs -- analyzed directly
- Project artifacts: PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md -- analyzed directly
- GSD templates: templates/context.md -- the canonical CONTEXT.md schema
- Phase 1 artifacts: 01-CONTEXT.md, 01-RESEARCH.md -- reference implementation pattern

### Secondary (MEDIUM confidence)
- GSD agent patterns: gsd-phase-researcher.md, gsd-planner.md -- established agent design patterns used as reference for gsd-auto-context structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components are existing GSD infrastructure
- Architecture: HIGH - Follows established thin-orchestrator + subagent pattern
- Pitfalls: HIGH - Based on direct analysis of existing codebase and integration points

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable internal architecture, no external dependencies)
