# Phase 62: Brainstorm Integration - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Brainstorm workflow step 10 milestone route currently inlines ~45 lines of milestone creation logic (steps 10a-10c: build MILESTONE-CONTEXT.md, initialize milestone models, execute new-milestone steps 1-11 inline). This phase replaces that inline block with a SlashCommand invocation of `/gsd:new-milestone --auto`, which now handles everything autonomously thanks to Phases 59-61. MILESTONE-CONTEXT.md must be written and committed before the handoff so new-milestone's context resolution (Phase 59) picks it up automatically.

</domain>

<decisions>
## Implementation Decisions

### MILESTONE-CONTEXT.md Handoff (INT-02)
- Step 10a (build MILESTONE-CONTEXT.md) is RETAINED -- brainstorm must still write `.planning/MILESTONE-CONTEXT.md` with the design content before handing off
- The MILESTONE-CONTEXT.md content and format remain unchanged from the current implementation (lines 265-283 of brainstorm.md)
- After writing MILESTONE-CONTEXT.md, commit it to git before invoking new-milestone (Claude's Decision: new-milestone reads MILESTONE-CONTEXT.md from disk; committing ensures it survives context window boundaries if the SlashCommand spawns a fresh session)

### SlashCommand Delegation (INT-01)
- Steps 10b and 10c (init models + inline milestone workflow execution) are replaced with a single SlashCommand invocation: `SlashCommand("/gsd:new-milestone --auto")`
- No arguments beyond `--auto` are needed -- new-milestone's context resolution (Phase 59 CTX-01) auto-detects MILESTONE-CONTEXT.md
- The SlashCommand pattern follows the established convention from new-project.md line 1053 and transition.md lines 381-393

### Inline Code Removal
- Remove step 10b (gsd-tools.cjs init new-milestone + JSON parsing) entirely
- Remove step 10c (inline new-milestone steps 1-11 execution) entirely
- The net deletion is approximately 20 lines (10b-10c, lines 285-307), with step 10a retained and a SlashCommand line added (Claude's Decision: actual line count from brainstorm.md shows 10b-10c is ~20 lines, not ~70 as estimated in the roadmap; the 10a MILESTONE-CONTEXT.md block is retained)

### Step 10 Revised Flow
- Step 10a: Build and write MILESTONE-CONTEXT.md (retained as-is)
- New step: Git add and commit MILESTONE-CONTEXT.md
- New step: Display routing banner and invoke `SlashCommand("/gsd:new-milestone --auto")`
- The `Exit skill and invoke SlashCommand(...)` pattern means brainstorm.md terminates after the SlashCommand -- new-milestone takes over completely

### New-Project Route
- The new-project route (lines 309-318) remains unchanged -- it already uses the correct pattern (displays a command for the user to run) (Claude's Decision: new-project route does not inline milestone creation, so no simplification needed)

### Claude's Discretion
- Exact git commit message wording for the MILESTONE-CONTEXT.md commit
- Banner text formatting before the SlashCommand invocation
- Whether to display "Routing to new-milestone..." or similar status message

</decisions>

<specifics>
## Specific Ideas

- REQUIREMENTS.md INT-01: "brainstorm.md step 10 milestone route simplified to invoke `/gsd:new-milestone --auto` instead of inline steps 1-11"
- REQUIREMENTS.md INT-02: "MILESTONE-CONTEXT.md is written and committed before brainstorm handoff"
- The new-project route at the bottom of step 10 already uses the pattern of directing the user to run a slash command -- the milestone route now follows the same delegation pattern
- Phase 59's CTX-01 guarantees that `/gsd:new-milestone --auto` with MILESTONE-CONTEXT.md present will use that file as context without prompting
- Phase 61's CHAIN-01 ensures new-milestone will auto-chain into discuss-phase after creating the roadmap, completing the brainstorm-to-execution pipeline

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/brainstorm.md` (lines 259-318): Step 10 milestone route -- the target for modification. Lines 263-283 (MILESTONE-CONTEXT.md build) are retained; lines 285-307 (init + inline execution) are replaced.
- `get-shit-done/workflows/new-milestone.md`: Now supports `--auto` flag (Phase 59), auto-skips all decision points (Phase 60), and auto-chains to discuss-phase (Phase 61).
- `get-shit-done/workflows/new-project.md` (line 1053): SlashCommand auto-chain pattern template -- `Exit skill and invoke SlashCommand("/gsd:discuss-phase 1 --auto")`.

### Established Patterns
- **SlashCommand delegation**: `Exit skill and invoke SlashCommand("/gsd:command --auto")` -- used in new-project.md, transition.md, and new-milestone.md for workflow chaining.
- **MILESTONE-CONTEXT.md bridge**: brainstorm.md, pr-review.md, and linear.md all write MILESTONE-CONTEXT.md before milestone creation -- this pattern is preserved, only the consumption mechanism changes.
- **Git commit before handoff**: Design file is committed in step 8 before routing; MILESTONE-CONTEXT.md should similarly be committed before SlashCommand handoff.

### Integration Points
- **Modified file**: `get-shit-done/workflows/brainstorm.md` -- step 10 milestone route rewritten
- **Consumed by**: `/gsd:new-milestone --auto` reads MILESTONE-CONTEXT.md via CTX-01 context resolution
- **Pipeline**: brainstorm -> write MILESTONE-CONTEXT.md -> `/gsd:new-milestone --auto` -> `/gsd:discuss-phase --auto` -> plan -> execute -> verify

</code_context>

<deferred>
## Deferred Ideas

- Simplifying pr-review.md and linear.md milestone routes to also use `/gsd:new-milestone --auto` (noted as future milestone in REQUIREMENTS.md Out of Scope)
- Autopilot-compatible brainstorm mode with auto-approved design sections (noted in PROJECT.md Out of Scope)

</deferred>

---

*Phase: 62-brainstorm-integration*
*Context gathered: 2026-03-14 via auto-context*
