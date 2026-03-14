# Phase 61: Auto-Chain to Discuss Phase - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

After auto-mode milestone creation completes (roadmap committed), the workflow automatically chains into `/gsd:discuss-phase {N} --auto` for the first phase of the new milestone. This connects milestone creation to the autonomous execution pipeline so that `new-milestone --auto` triggers the full discuss-plan-execute-verify cycle without human intervention. The first phase number is read dynamically from ROADMAP.md, not hardcoded.

</domain>

<decisions>
## Implementation Decisions

### Auto-Chain Trigger (CHAIN-01)
- In auto mode, after the roadmap commit in step 10, add an auto-chain block before the "Done" display in step 11
- The auto-chain uses `SlashCommand("/gsd:discuss-phase {FIRST_PHASE} --auto")` to exit the skill and invoke discuss-phase
- This follows the exact pattern from `new-project.md` lines 1045-1053 which already auto-chains to discuss-phase 1 in auto mode
- In interactive mode, the existing "Next Up" display with manual `/gsd:discuss-phase [N]` instruction remains unchanged

### First Phase Number Resolution (CHAIN-02)
- Read the first phase number from ROADMAP.md using `gsd-tools.cjs phase find-next --from 0` (Claude's Decision: find-next with --from 0 returns the first incomplete phase; avoids adding a new CLI subcommand when the existing one works with a sentinel value)
- If `find-next --from 0` does not work with phase numbers starting above 0, fall back to parsing ROADMAP.md's "Phase Details" section for the first `### Phase N:` heading (Claude's Decision: defensive fallback ensures correctness even if find-next requires a valid existing phase)
- The phase number is NOT hardcoded to 1 -- milestones start at varying phase numbers (e.g., v2.5 starts at phase 59)

### Step 11 Modification
- Step 11 ("Done") gains an auto-mode conditional block identical in structure to new-project.md's auto-chain
- The auto-chain block displays a banner (`AUTO-ADVANCING -> DISCUSS PHASE {N}`) before invoking the SlashCommand
- The auto-chain replaces the "Next Up" section in auto mode -- it does not show both (Claude's Decision: showing "Next Up" instructions is pointless when auto-advancing immediately)

### Error Handling
- If `find-next` returns null (no incomplete phases found), display an error and skip chaining -- the milestone was created but has no actionable phases (Claude's Decision: this should not happen with a fresh roadmap, but failing gracefully is safer than crashing)
- If ROADMAP.md does not exist after step 10, this is a critical error -- the roadmap commit failed. Do not attempt to chain. (Claude's Decision: the roadmap commit in step 10 already handles commit failures; this is a defensive guard)

### Claude's Discretion
- Exact banner text formatting for the auto-advance display
- Whether to read the phase name for the banner display or just show the number
- Variable naming for the resolved first phase number

</decisions>

<specifics>
## Specific Ideas

- REQUIREMENTS.md CHAIN-01: "After roadmap creation in auto mode, invoke `/gsd:discuss-phase {first_phase} --auto`"
- REQUIREMENTS.md CHAIN-02: "First phase number is read from ROADMAP.md, not hardcoded"
- new-project.md (lines 1045-1053) provides the exact template: auto-chain banner + `SlashCommand("/gsd:discuss-phase 1 --auto")` -- but hardcodes "1" which this phase must make dynamic
- Research PITFALLS.md warns: "Verify the auto-chain invokes `/gsd:discuss-phase {FIRST_PHASE} --auto` with the correct phase number (the first phase of the NEW milestone, not phase 1)"
- Research ARCHITECTURE.md shows the full chain: `new-milestone --auto` -> `discuss-phase --auto` -> `plan-phase --auto` -> `execute-phase --auto` -> `transition.md` -> next phase

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/new-project.md` (lines 1045-1053): Auto-chain pattern with banner display and SlashCommand invocation -- direct template, but hardcodes phase 1
- `get-shit-done/workflows/transition.md` (lines 381-393): Auto-chain to discuss-phase/plan-phase with SlashCommand -- same pattern used in phase transitions
- `get-shit-done/bin/lib/phase.cjs` (`findFirstIncompletePhase`): CJS function that reads ROADMAP.md and returns the first incomplete phase number
- `get-shit-done/bin/gsd-tools.cjs` (`phase find-next --from`): CLI dispatch for `nextIncompletePhase` -- returns next incomplete phase after a given phase number

### Established Patterns
- **SlashCommand auto-chain**: `Exit skill and invoke SlashCommand("/gsd:discuss-phase {N} --auto")` -- used in new-project.md and transition.md
- **Auto-advance banner**: Box-drawn banner announcing auto-continuation before SlashCommand invocation
- **Conditional auto/interactive block**: `If auto mode: [chain]. If interactive: [show next steps]` -- same pattern used throughout the workflow

### Integration Points
- **Modified file**: `get-shit-done/workflows/new-milestone.md` -- step 11 gains auto-chain conditional block
- **Tool used**: `gsd-tools.cjs phase find-next --from 0` to resolve first phase number from ROADMAP.md
- **Downstream**: SlashCommand triggers `/gsd:discuss-phase {N} --auto` which spawns gsd-auto-context agent, then chains to plan-phase, execute-phase, and verify-phase

</code_context>

<deferred>
## Deferred Ideas

- Brainstorm routing simplification to use `--auto` flag (Phase 62: INT-01, INT-02)
- Updating new-project.md's hardcoded phase 1 to use dynamic resolution (not in scope -- new-project always starts at phase 1)

</deferred>

---

*Phase: 61-auto-chain-to-discuss-phase*
*Context gathered: 2026-03-14 via auto-context*
