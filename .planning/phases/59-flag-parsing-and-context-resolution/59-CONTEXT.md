# Phase 59: Flag Parsing and Context Resolution - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Users can invoke `/gsd:new-milestone --auto` and have their context (MILESTONE-CONTEXT.md, @file, or inline text) automatically detected and validated before any mutations occur. This phase adds the `--auto` flag parsing, the hybrid flag+config pattern, the priority-ordered context resolution logic, the early error on missing context, and the `auto_mode` field in `gsd-tools.cjs init new-milestone` output. No decision points are skipped yet (Phase 60) and no auto-chaining happens (Phase 61).

</domain>

<decisions>
## Implementation Decisions

### Flag Parsing (PARSE-01, PARSE-02, PARSE-03)
- Parse `--auto` flag from `$ARGUMENTS` in new-milestone.md workflow, same pattern as discuss-phase.md line 133
- Read `workflow.auto_advance` config via `gsd-tools.cjs config-get workflow.auto_advance` as fallback when flag not present
- If `--auto` flag present and config is not already true, persist via `gsd-tools.cjs config-set workflow.auto_advance true`
- Strip `--auto` from arguments before passing remainder to context resolution (Claude's Decision: remaining args after flag removal are the context source -- inline text or @file reference)
- Auto mode is active when either `--auto` flag is present OR `workflow.auto_advance` config is true (hybrid pattern from design doc)

### Context Resolution (CTX-01 through CTX-05)
- Resolution follows strict priority order: MILESTONE-CONTEXT.md > @file > inline text > error
- If `.planning/MILESTONE-CONTEXT.md` exists, use it as context (existing behavior, e.g., from brainstorm routing)
- If `@file` reference in args (after stripping `--auto`), read the referenced file as milestone goals
- If inline text in args (after stripping `--auto`), use as milestone goals
- If no context source found and auto mode is active, error with usage message: `"--auto requires milestone goals. Usage: /gsd:new-milestone --auto 'description' or provide MILESTONE-CONTEXT.md"`
- If no context source found and interactive mode, fall through to existing questioning behavior (unchanged)
- Context validation occurs before any PROJECT.md or STATE.md mutations -- the resolution block runs before step 4 (Update PROJECT.md)

### Context Resolution Placement in Workflow
- Insert context resolution as a new step between existing step 1 (Load Context) and step 2 (Gather Milestone Goals) (Claude's Decision: validation must run after loading project state but before any mutations, and step 2 is where context is consumed)
- Step 2 (Gather Milestone Goals) conditionally uses the resolved context in auto mode instead of asking the user

### Init Command Extension (INT-03)
- Add `auto_mode` field to `cmdInitNewMilestone` output in `init.cjs`
- `auto_mode` reflects the merged state: true if `workflow.auto_advance` config is true (Claude's Decision: init command reads config not CLI flags -- flag parsing happens in the workflow layer, init provides config state)
- No other fields change in the init output

### Error Handling
- Error message on missing context includes both usage forms: MILESTONE-CONTEXT.md file and inline/file arguments (Claude's Decision: users need to know all valid context sources when they hit the error)
- Error exits before any file mutations -- no partial PROJECT.md or STATE.md changes on failure

### Claude's Discretion
- Exact wording of the error/usage message
- Variable naming for the resolved context within the workflow
- Whether to use a helper function or inline logic for @file detection
- Whitespace/formatting in the new workflow steps

</decisions>

<specifics>
## Specific Ideas

- Design doc specifies the exact priority order: MILESTONE-CONTEXT.md > @file > inline text > error
- Design doc provides the error message template: `"--auto requires milestone goals. Usage: /gsd:new-milestone --auto 'description' or provide MILESTONE-CONTEXT.md"`
- Design doc specifies the config persistence pattern: `gsd-tools.cjs config-set workflow.auto_advance true`
- The `@file` pattern is already used by brainstorm.md (line 317: `/gsd:new-project --auto @.planning/designs/{date}-{topic-slug}-design.md`) and new-project.md (line 26)
- Config key `workflow.auto_advance` is already registered in KNOWN_SETTINGS_KEYS (cli.cjs line 739) and validated as boolean (cli.cjs line 684)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/discuss-phase.md` (line 133): Established `--auto` flag parsing pattern from `$ARGUMENTS` -- direct template for new-milestone
- `get-shit-done/bin/lib/cli.cjs` (lines 684, 739): `workflow.auto_advance` already registered as boolean config key in KNOWN_SETTINGS_KEYS and validateSetting
- `get-shit-done/workflows/new-project.md` (lines 12-27): Auto mode detection and `@file` reference parsing pattern already implemented for new-project

### Established Patterns
- **Hybrid flag+config**: `--auto` flag in `$ARGUMENTS` + `workflow.auto_advance` config fallback. discuss-phase, plan-phase, and transition.md all use this pattern.
- **Config persistence**: When `--auto` flag is present but config is not set, persist it so downstream workflows inherit the setting.
- **3-touch-point config registration**: CONFIG_DEFAULTS + KNOWN_SETTINGS_KEYS + validateSetting. `workflow.auto_advance` already has all 3.
- **Init command JSON output**: Each workflow has a corresponding `cmdInit*` function in init.cjs returning config/state for that workflow.

### Integration Points
- **Input**: `$ARGUMENTS` from command spec, `.planning/MILESTONE-CONTEXT.md` (optional), `@file` reference (optional), inline text (optional)
- **Modified files**: `get-shit-done/workflows/new-milestone.md` (add flag parsing and context resolution steps), `get-shit-done/bin/lib/init.cjs` (add `auto_mode` to `cmdInitNewMilestone`)
- **Config**: `workflow.auto_advance` in `.planning/config.json` (read and optionally written)
- **Test file**: `tests/init.test.cjs` (add test for `auto_mode` field in new-milestone init output)

</code_context>

<deferred>
## Deferred Ideas

- Auto-skipping of all 6 decision points (Phase 60: SKIP-01 through SKIP-06)
- Auto-chain to discuss-phase after roadmap creation (Phase 61: CHAIN-01, CHAIN-02)
- Brainstorm routing simplification to use `--auto` flag (Phase 62: INT-01, INT-02)

</deferred>

---

*Phase: 59-flag-parsing-and-context-resolution*
*Context gathered: 2026-03-14 via auto-context*
