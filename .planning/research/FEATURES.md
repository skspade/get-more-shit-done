# Feature Landscape: New-Milestone --auto Mode

**Domain:** Autonomous milestone creation for CLI-based coding orchestrator
**Researched:** 2026-03-14
**Overall confidence:** HIGH (patterns fully established in discuss-phase, plan-phase, execute-phase, and new-project; this is pattern replication, not invention)

## Table Stakes

Features users expect based on existing --auto behavior in other GSD workflows. Missing any of these breaks the "it just works" promise of --auto.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| `--auto` flag parsing from $ARGUMENTS | Every workflow with --auto (discuss-phase, plan-phase, execute-phase, new-project) parses this flag identically. Users pass `--auto` as a trailing flag. Inconsistency here would be a bug. | LOW | None -- string parsing | Same pattern as discuss-phase line 764: parse from $ARGUMENTS. |
| `workflow.auto_advance` config read/persist | The hybrid flag + config pattern is the established contract: `--auto` flag sets `workflow.auto_advance: true` in config so downstream workflows inherit it without re-passing the flag. discuss-phase, plan-phase, execute-phase all read this config. Omitting it breaks the chain. | LOW | `gsd-tools.cjs config-get/config-set` | Read via `config-get workflow.auto_advance`, persist via `config-set workflow.auto_advance true` when --auto passed and config is not already true. |
| Context resolution from MILESTONE-CONTEXT.md | This file is the primary context bridge from brainstorm routing (step 10). It already exists in the new-milestone workflow -- auto mode must use it as the first-priority context source. Without this, brainstorm-to-milestone pipeline breaks. | LOW | MILESTONE-CONTEXT.md file existence check | Already handled in step 2 of current new-milestone.md. Auto mode just skips the confirmation. |
| Context resolution from @file reference | new-project --auto supports `@prd.md` file references. Users expect the same pattern for new-milestone. This is how you point auto mode at an external spec document. | LOW | File reading from args | Parse `@filename` from args after stripping `--auto`, read file contents as milestone goals. |
| Context resolution from inline text | new-project --auto supports inline text after the flag. `/gsd:new-milestone --auto "Add streaming support"` should work identically. | LOW | Arg parsing | Remaining text after `--auto` and @file extraction becomes milestone goals. |
| Error on auto mode with no context | new-project --auto errors with a clear usage message when no idea document is provided. new-milestone --auto must do the same. Silent failure or hallucinated goals would be dangerous. | LOW | Context resolution chain | Error message: `"--auto requires milestone goals. Usage: /gsd:new-milestone --auto 'description' or provide MILESTONE-CONTEXT.md"` |
| Skip "What do you want to build next?" question | This is AskUserQuestion #1 in new-milestone. In auto mode, the resolved context replaces this question entirely. This is the core purpose of --auto. | LOW | Context resolution | Use resolved context from MILESTONE-CONTEXT.md, @file, or inline text. |
| Auto-accept version suggestion | AskUserQuestion #2 asks user to confirm suggested version (minor bump). Auto mode accepts the suggestion. Version bumping is deterministic (parse last from MILESTONES.md, increment minor). No reason to pause for this. | LOW | MILESTONES.md version parsing | Accept the suggested version without asking. Same as how new-project auto-accepts project name. |
| Always run research in auto mode | AskUserQuestion #3 offers research vs skip. Auto mode always researches -- research is the safe default, and skipping it in autonomous mode risks missing domain knowledge. The design doc makes this explicit. | LOW | Research spawning (step 8) | Set `workflow.research true` in config and proceed to research. |
| Include all features for requirement scoping | AskUserQuestion #4 is a multiSelect for feature categories. Auto mode selects all -- the context document defines scope, and autonomous mode should not second-guess it by dropping features. | LOW | Requirement generation (step 9) | Select all categories from research features or context. Skip the "identify gaps" question with "No". |
| Auto-approve roadmap | AskUserQuestion #5 asks for roadmap approval. Auto mode approves. The roadmapper is deterministic given requirements, and if the roadmap needs adjustment, that surfaces during execution. | LOW | Roadmap creation (step 10) | Skip approval AskUserQuestion, proceed to commit. |

## Differentiators

Features that make new-milestone --auto especially useful beyond just "skip the questions."

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Auto-chain to discuss-phase 1 --auto | After roadmap creation, automatically invoke `/gsd:discuss-phase 1 --auto` to continue the autonomous pipeline. This is the key differentiator: without it, auto mode just saves 5 clicks. With it, a single command creates the milestone AND starts executing it. This completes the brainstorm-to-execution pipeline. | LOW | discuss-phase --auto (already built) | Mirrors new-project's auto-chain behavior: `Exit skill and invoke SlashCommand("/gsd:discuss-phase 1 --auto")`. The chain propagates --auto through discuss -> plan -> execute -> verify (human checkpoint). |
| Brainstorm simplification | brainstorm.md step 10 currently executes new-milestone steps 1-11 inline (manual orchestration). With --auto, brainstorm can simply invoke `/gsd:new-milestone --auto` and let the workflow handle everything. This removes ~50 lines of duplicated milestone creation logic from brainstorm.md. | LOW | new-milestone --auto (this feature) | Reduces brainstorm.md complexity and eliminates a maintenance burden where two copies of milestone creation logic must stay in sync. |
| `auto_mode` field in gsd-tools init output | `gsd-tools.cjs init new-milestone` JSON output includes `auto_mode: true/false` reflecting the parsed --auto flag. This centralizes flag+config resolution in one place (the init command) rather than duplicating parsing logic in the workflow markdown. | LOW | gsd-tools.cjs init command | Follows the pattern where init commands provide resolved state. Model resolution and auto-mode detection happen together. |
| Full pipeline from brainstorm to human checkpoint | The complete autonomous chain: `/gsd:brainstorm` -> design doc -> MILESTONE-CONTEXT.md -> `/gsd:new-milestone --auto` -> research -> requirements -> roadmap -> `/gsd:discuss-phase 1 --auto` -> plan -> execute -> verify (pause). One brainstorm session can kick off hours of autonomous work, stopping only at the verification checkpoint where human judgment matters most. | LOW (all pieces exist) | brainstorm routing, new-milestone --auto, discuss-phase --auto chain | This is not a new feature to build -- it is the emergent capability of connecting existing pieces. The value is in the integration, not new code. |
| Config persistence across context windows | The `workflow.auto_advance` config survives `/clear` and context compaction. This is critical because the autonomous pipeline spans multiple context windows (new-milestone -> discuss -> plan -> execute each get fresh contexts). Without config persistence, --auto would need to be re-passed at every transition. | LOW (already built) | config.json, gsd-tools config-set | Already implemented for discuss-phase/plan-phase/execute-phase. new-milestone just needs to participate in the same pattern. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-accept with partial feature selection | Allowing auto mode to select a subset of features (e.g., `--auto --only "auth,api"`) adds arg parsing complexity for a rare use case. If the user wants partial scope, they should curate the MILESTONE-CONTEXT.md or inline description to only mention the features they want. | Include all features from context. Scope control happens at the input level (what you put in MILESTONE-CONTEXT.md), not at the selection level. |
| Interactive fallback on context resolution failure | If auto mode cannot resolve context (no MILESTONE-CONTEXT.md, no @file, no inline text), falling back to interactive mode would violate the principle of least surprise. The user said --auto; failing silently into interactive mode is confusing. | Error with clear usage message. Force the user to provide context explicitly. |
| Skip research option in auto mode | Adding `--auto --no-research` or similar flag creates a combinatorial explosion of flag interactions. Research is always beneficial in autonomous mode and the time cost is acceptable for the quality improvement. | Always research in auto mode. If the user truly wants to skip research, they can run interactively. |
| Dry-run mode (`--auto --dry-run`) | Showing what auto mode would do without doing it adds significant complexity for minimal value. The user can review MILESTONE-CONTEXT.md content before running. | Review inputs before running. If the result is wrong, milestones are cheap to re-create. |
| Auto-approve verification (skip human checkpoint) | The verification checkpoint is the one place in the autonomous pipeline where human judgment is essential. Auto-approving verification would mean no human ever looks at what was built. This is explicitly against the project's design philosophy (PROJECT.md: "Human checkpoint at verification only"). | Maintain the human checkpoint at verification. The pipeline pauses here by design. |
| Custom version override in auto mode | `--auto --version v3.0` adds arg parsing complexity. Version bumping is deterministic (minor increment from last milestone). Major version bumps are rare and warrant interactive mode. | Auto-accept the suggested minor bump. For major version bumps, run interactively. |

## Feature Dependencies

```
--auto flag parsing + config read
    |
    v
Context resolution chain (MILESTONE-CONTEXT.md > @file > inline > error)
    |
    v
Skip 5 AskUserQuestion calls (goals, version, research, features, roadmap)
    |
    +-- Always research (set config, spawn researchers)
    |
    +-- Include all features (select all categories)
    |
    v
Auto-approve roadmap
    |
    v
Auto-chain to /gsd:discuss-phase 1 --auto
    |
    v
[Existing --auto chain: discuss -> plan -> execute -> verify (human checkpoint)]
```

**Brainstorm simplification (parallel work):**
```
brainstorm.md step 10 refactor
    |
    depends on: new-milestone --auto working end-to-end
```

**gsd-tools init update (parallel work):**
```
gsd-tools.cjs init new-milestone
    |
    add: auto_mode field to JSON output
    |
    depends on: nothing (can be done first)
```

## MVP Recommendation

Prioritize (in implementation order):

1. **--auto flag parsing + config persistence** -- The foundation. Parse flag, read/write config. Identical pattern to discuss-phase. Must work before anything else.
2. **Context resolution chain** -- MILESTONE-CONTEXT.md > @file > inline > error. This determines what the milestone is about. Without it, auto mode has nothing to work with.
3. **Skip 5 AskUserQuestion calls** -- The core auto behavior. Each question gets a default: use context, accept version, always research, include all features, approve roadmap.
4. **Auto-chain to discuss-phase 1 --auto** -- The differentiating capability. Without chaining, auto mode is just "skip confirmations." With chaining, it is "create and start executing autonomously."
5. **Brainstorm simplification** -- Replace brainstorm.md step 10 inline milestone creation with `/gsd:new-milestone --auto`. Reduces code duplication.
6. **gsd-tools init update** -- Add `auto_mode` field. Can be done at any point but logically pairs with flag parsing.

**Defer:** Nothing. All features are LOW complexity and tightly coupled. This is a single-phase milestone.

## Complexity Assessment

**Overall: LOW.** This milestone is pattern replication. Every behavior being added already exists in at least one other workflow:
- Flag parsing: discuss-phase, plan-phase, execute-phase, new-project
- Config persistence: discuss-phase (the original), propagated to all others
- Context resolution: new-project (same @file + inline pattern)
- Question skipping: new-project (skips interactive questions in auto mode)
- Auto-chaining: discuss-phase -> plan-phase -> execute-phase (the full chain exists)
- Brainstorm routing: brainstorm.md step 10 (simplification of existing code)

The risk is not in complexity but in **completeness** -- ensuring all 5 AskUserQuestion calls are correctly skipped and the context resolution priority chain handles all edge cases (especially the error case).

## Sources

- `/get-shit-done/workflows/new-milestone.md` -- Current interactive workflow with 5 AskUserQuestion calls
- `/get-shit-done/workflows/discuss-phase.md` -- Reference --auto implementation (flag parsing, config, auto-chain)
- `/get-shit-done/workflows/plan-phase.md` -- Reference --auto implementation (config read, auto-chain to execute)
- `/get-shit-done/workflows/execute-phase.md` -- Reference --auto implementation (config read, auto-chain to transition)
- `/get-shit-done/workflows/new-project.md` -- Reference --auto implementation (context resolution, @file support, error on missing)
- `/get-shit-done/workflows/brainstorm.md` -- Step 10 milestone routing (simplification target)
- `/get-shit-done/workflows/transition.md` -- Auto-advance propagation and milestone boundary clear
- `.planning/designs/2026-03-14-new-milestone-auto-mode-design.md` -- Design doc with decision table
- `.planning/MILESTONE-CONTEXT.md` -- Current milestone goals
