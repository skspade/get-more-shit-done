# Phase 60: Auto-Skip Decision Points - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

In auto mode, all 6 interactive confirmation questions in the new-milestone workflow are bypassed with correct defaults, producing a complete milestone (requirements + roadmap) without human input. This phase modifies `new-milestone.md` steps 2, 3, 8, 9, and 10 to add auto-mode conditional branches. Phase 59 already handles flag parsing and context resolution; this phase consumes the resolved context and auto_mode state to skip every AskUserQuestion call.

</domain>

<decisions>
## Implementation Decisions

### Decision Point Mapping (SKIP-01 through SKIP-06)
- SKIP-01 maps to step 2 (Gather Milestone Goals): auto mode uses resolved context, skips "What do you want to build next?" -- already partially wired in Phase 59's `<context_resolution>` block
- SKIP-02 maps to step 3 (Determine Milestone Version): auto mode accepts the suggested minor bump without AskUserQuestion confirmation
- SKIP-03 maps to step 8 (Research Decision): auto mode selects "Research first" and persists `workflow.research true` to config
- SKIP-04 maps to step 9 (Define Requirements -- feature scoping): auto mode includes all features from context/research without category-by-category AskUserQuestion selection
- SKIP-05 maps to step 9 (Define Requirements -- identify gaps): auto mode answers "No, research covered it" to the gaps question
- SKIP-06 maps to step 10 (Create Roadmap -- approval): auto mode selects "Approve" without presenting the roadmap for user review

### Skip Implementation Pattern
- Each decision point gets a conditional guard: `If auto mode is active: [default action]. Otherwise: [existing interactive behavior]` (Claude's Decision: mirrors the pattern Phase 59 established in the context_resolution block -- consistent conditional structure throughout the workflow)
- All 6 skips are implemented in the workflow markdown instructions, not in gsd-tools.cjs or init.cjs (Claude's Decision: decision points are workflow-level concerns -- the AskUserQuestion calls live in new-milestone.md so the skips belong there too)
- No new config keys are introduced; only `workflow.research` is written by SKIP-03 (existing config key already used in step 8)

### Step 2: Context Usage (SKIP-01)
- Phase 59 already wired step 2 to use resolved context in auto mode and skip interactive questioning
- SKIP-01 is effectively satisfied by Phase 59's implementation -- verify it works end-to-end with no additional changes needed (Claude's Decision: the `<context_resolution>` block and step 2's "If auto mode with resolved context" branch already handle this; SKIP-01 may only need verification, not new code)

### Step 3: Version Auto-Accept (SKIP-02)
- In auto mode, compute the suggested version (minor bump from last milestone) and use it directly
- Skip the "Confirm with user" AskUserQuestion -- proceed to step 4 with the suggested version
- No custom version override in auto mode (explicitly out of scope per REQUIREMENTS.md)

### Step 8: Research Auto-Select (SKIP-03)
- In auto mode, always select "Research first" path
- Persist `workflow.research true` to config via `gsd-tools.cjs config-set workflow.research true`
- Spawn 4 parallel researchers and synthesizer exactly as in interactive mode -- no behavioral change to research itself

### Step 9: Feature Scoping Auto-Include (SKIP-04)
- In auto mode, include all features from research FEATURES.md (all table stakes + all differentiators)
- If no research was done (edge case -- SKIP-03 ensures research runs), include all features from resolved context
- Skip category-by-category AskUserQuestion multiSelect -- all features are selected
- Generate REQUIREMENTS.md with all features included, no deferred/out-of-scope items from scoping

### Step 9: Gap Question Auto-Skip (SKIP-05)
- In auto mode, skip the "Identify gaps?" AskUserQuestion
- Proceed as if user selected "No, research covered it"
- Requirements confirmation ("Does this capture what you're building?") is also auto-approved (Claude's Decision: this confirmation is part of the same step 9 flow and cannot be reached interactively without human input in auto mode)

### Step 10: Roadmap Auto-Approve (SKIP-06)
- In auto mode, skip the roadmap approval AskUserQuestion
- Proceed directly to "Commit roadmap" after roadmapper returns ROADMAP CREATED
- If roadmapper returns ROADMAP BLOCKED, still present the blocker and error out -- auto mode cannot resolve roadmapper blockers (Claude's Decision: blocked roadmaps indicate a structural problem that needs investigation, not blind approval)

### Error Handling
- Roadmapper ROADMAP BLOCKED in auto mode exits with an error message rather than looping for user input (Claude's Decision: auto mode cannot interactively resolve blockers; failing fast is safer than guessing)
- All other error paths (missing files, commit failures) remain unchanged from interactive mode

### Claude's Discretion
- Exact conditional syntax within the workflow markdown (if/else wording)
- Whether to group all auto-mode guards in a single `<auto_skip>` section or inline each at its decision point
- Log/display messages shown during auto-skipped steps (e.g., "Auto: accepting version v2.5")
- Order of operations when multiple skips happen in sequence within the same step

</decisions>

<specifics>
## Specific Ideas

- REQUIREMENTS.md defines each SKIP requirement as a separate checkbox item, enabling granular traceability
- The workflow already has the auto mode boolean available from Phase 59's `<auto_mode>` section -- no new flag detection needed
- Step 8 already has the `gsd-tools.cjs config-set workflow.research true` command documented -- auto mode just unconditionally runs it
- The `<context_resolution>` block from Phase 59 already handles SKIP-01's core behavior; Phase 60 confirms end-to-end wiring
- Requirements confirmation in step 9 ("Does this capture what you're building? (yes / adjust)") must also be auto-approved as part of SKIP-04/SKIP-05 flow

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/new-milestone.md`: The target file containing all 6 decision points to modify. Already has `<auto_mode>` and `<context_resolution>` sections from Phase 59.
- `get-shit-done/workflows/discuss-phase.md`: Reference for how auto mode skips interactive questions in other workflows (no AskUserQuestion calls in auto path).
- `get-shit-done/bin/lib/cli.cjs`: `workflow.research` config key already registered in KNOWN_SETTINGS_KEYS and CONFIG_DEFAULTS.

### Established Patterns
- **Conditional auto-mode guard**: `If auto mode is active: [action]. Otherwise: [interactive behavior]` -- used in new-milestone.md step 2, discuss-phase.md, plan-phase.md.
- **Config persistence on auto decisions**: When auto mode makes a choice, persist it to config so downstream workflows inherit (e.g., `workflow.research`, `workflow.auto_advance`).
- **AskUserQuestion bypass**: In auto mode, the workflow skips AskUserQuestion entirely and uses the default/recommended choice.

### Integration Points
- **Modified file**: `get-shit-done/workflows/new-milestone.md` -- steps 3, 8, 9, and 10 gain auto-mode conditional branches
- **Config written**: `workflow.research` set to `true` in auto mode (step 8)
- **Consumed state**: `auto_mode` boolean from `<auto_mode>` section (Phase 59)
- **Downstream**: Phase 61 consumes the completed milestone artifacts to chain into discuss-phase

</code_context>

<deferred>
## Deferred Ideas

- Auto-chain to `/gsd:discuss-phase` after roadmap creation (Phase 61: CHAIN-01, CHAIN-02)
- Brainstorm routing simplification to use `--auto` flag (Phase 62: INT-01, INT-02)
- Custom version override in auto mode (explicitly out of scope per REQUIREMENTS.md)
- `--no-research` flag for auto mode (explicitly out of scope per REQUIREMENTS.md)

</deferred>

---

*Phase: 60-auto-skip-decision-points*
*Context gathered: 2026-03-14 via auto-context*
