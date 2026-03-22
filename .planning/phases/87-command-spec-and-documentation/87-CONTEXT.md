# Phase 87: Command Spec and Documentation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Update the command spec (`commands/gsd/linear.md`) so its objective description and process section reference interview-driven routing instead of complexity scoring. The workflow file (`get-shit-done/workflows/linear.md`) success criteria were already updated by Phases 84-86; this phase targets only the command spec file where two stale references to "complexity scoring" remain (lines 20 and 41).

</domain>

<decisions>
## Implementation Decisions

### Command Spec Objective Update
- `commands/gsd/linear.md` objective description must mention the interview phase and must not reference scoring or heuristic (from REQUIREMENTS.md WKFL-05)
- Line 20 currently says "auto-routes to quick or milestone based on complexity scoring" -- replace with interview-driven routing language
- The bullet list in the objective section (lines 22-26) must replace "Scores complexity to determine routing" with interview-driven language describing the adaptive question flow and complexity signal routing

### Command Spec Process Update
- Line 41 currently says "Preserve all workflow gates (issue fetch, complexity scoring, routing, execution, Linear status updates)" -- replace "complexity scoring" with "interview" (from REQUIREMENTS.md WKFL-05)

### Success Criteria in Command Spec
- The command spec file does not have its own `<success_criteria>` block -- success criteria live in the workflow file (`get-shit-done/workflows/linear.md`), which was already updated by Phases 84-86 (from REQUIREMENTS.md WKFL-06)
- The workflow file's success criteria already reference interview-driven routing, $INTERVIEW_CONTEXT threading, and no scoring heuristic -- no changes needed there (Claude's Decision: verified by reading workflow lines 994-1022, all interview/routing criteria present)

### Scope Constraint
- Only the command spec file is modified in this phase -- the workflow file is already updated (Claude's Decision: prior phases 84-86 already modified the workflow file; this phase closes the last gap in the command spec)
- No documentation files (USER-GUIDE.md, README.md, help.md) are in scope -- the ROADMAP success criteria only reference the command spec (Claude's Decision: success criteria are specific to commands/gsd/linear.md; expanding scope would exceed phase boundary)

### Claude's Discretion
- Exact phrasing of the updated objective description
- Whether to mention "3-5 questions" or keep the description higher-level
- Formatting of the bullet list in the objective section

</decisions>

<specifics>
## Specific Ideas

**Current command spec objective (lines 19-27):**
```
<objective>
Route Linear issues to GSD workflows. Fetches issue from Linear, auto-routes to quick or milestone based on complexity scoring, delegates to appropriate workflow.

- Reads the Linear issue via MCP tools
- Scores complexity to determine routing (quick task vs new milestone)
- Accepts override flags: --quick (force quick), --milestone (force milestone)
- Delegates to the appropriate GSD workflow with issue context
- Posts status comments back to Linear on completion
</objective>
```

**Updated objective should convey:**
- Fetches issue, asks adaptive interview questions, routes based on complexity signal
- Interview gathers goal, scope, criteria, and complexity before routing
- Presents confirmation summary (quick) or approach proposals (milestone)
- Posts interview summary to Linear before execution

**Current process section (line 41):**
```
Preserve all workflow gates (issue fetch, complexity scoring, routing, execution, Linear status updates).
```

**Updated process should say:**
```
Preserve all workflow gates (issue fetch, interview, routing, hybrid output, execution, Linear status updates).
```

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `commands/gsd/linear.md`: The command spec file to be modified. 42 lines total. Simple structure: YAML frontmatter, objective, execution_context, context, process.
- `get-shit-done/workflows/linear.md`: The workflow file already updated by Phases 84-86 with interview engine, hybrid output, comment-back, and enriched context. Success criteria (lines 994-1022) already reference interview-driven routing.

### Established Patterns
- **Command spec structure**: YAML frontmatter (name, description, argument-hint, allowed-tools) + XML sections (objective, execution_context, context, process). The modifications stay within the existing `<objective>` and `<process>` sections.
- **Command spec as thin delegation layer**: The command spec describes what the workflow does at a high level and delegates execution via `@~/.claude/get-shit-done/workflows/linear.md`. No implementation logic in the command spec.

### Integration Points
- **`commands/gsd/linear.md` -> `get-shit-done/workflows/linear.md`**: The command spec's objective and process must accurately describe what the workflow actually does. After Phases 84-86 changed the workflow, the command spec is now out of sync.
- **`commands/gsd/linear.md` YAML `description` field**: Currently says "Route a Linear issue to the appropriate GSD workflow (quick task or new milestone)" -- this is still accurate and does not mention scoring, so no change needed.

</code_context>

<deferred>
## Deferred Ideas

- **Multi-issue interview strategy** -- Post-v3.0 per REQUIREMENTS.md. Command spec can be updated then.
- **USER-GUIDE.md and README.md updates** -- Not in scope for this phase per ROADMAP success criteria. Could be a future documentation pass.

</deferred>

---

*Phase: 87-command-spec-and-documentation*
*Context gathered: 2026-03-22 via auto-context*
