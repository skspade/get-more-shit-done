# Project Research Summary

**Project:** GSD Autopilot v2.5 -- New-Milestone Auto Mode
**Domain:** Autonomous workflow orchestration (CLI-based coding agent pipeline)
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

This milestone adds `--auto` flag support to the `/gsd:new-milestone` workflow, completing the autonomous pipeline from brainstorm through execution. The work is pure pattern replication -- every behavior needed (flag parsing, config persistence, context resolution, question skipping, auto-chaining) already exists in discuss-phase, plan-phase, execute-phase, or new-project workflows. No new dependencies, libraries, or architectural components are required. The entire implementation consists of modifying three markdown workflow files and adding one field to an existing CJS module.

The recommended approach is a four-phase build that follows the natural dependency chain: first wire up argument parsing and context resolution (the foundation), then add conditional bypasses at each of the 6 AskUserQuestion points (the core feature), then add auto-chaining to discuss-phase (the pipeline connector), and finally simplify brainstorm routing (the cleanup). This order ensures each phase is independently testable and avoids the primary risk of breaking existing interactive behavior.

The key risks are config state leaking between milestones on failure (auto_advance persists to disk but only gets cleaned up at milestone completion), silent failure when --auto is invoked without context, and the brainstorm routing regression when simplifying step 10. All three are preventable with straightforward error handling and testing. The strongest recommendation from research: do NOT persist `workflow.auto_advance` in new-milestone itself -- pass `--auto` through to discuss-phase and let the existing persistence mechanism handle it. This eliminates the config leak risk entirely.

## Key Findings

### Recommended Stack

No new technologies. The entire implementation reuses existing infrastructure.

**Core components (all existing, zero changes needed to infrastructure):**
- `gsd-tools.cjs config-get/config-set` -- reads and persists `workflow.auto_advance` boolean (already registered in KNOWN_SETTINGS_KEYS and booleanKeys)
- `gsd-tools.cjs init new-milestone` -- resolves models for researcher/synthesizer/roadmapper agents (needs one new `auto_mode` field)
- `SlashCommand` invocation pattern -- chains workflows across context windows without subagent nesting limits (proven in discuss-phase auto-chain)

### Expected Features

**Must have (table stakes):**
- `--auto` flag parsing from $ARGUMENTS (identical pattern to discuss-phase)
- `workflow.auto_advance` config read and conditional persistence
- Context resolution priority chain: MILESTONE-CONTEXT.md > @file > inline text > error
- Skip all 6 AskUserQuestion calls with sensible defaults (use context, accept version, always research, select all features, skip gap question, approve roadmap)
- Error with clear usage message when --auto has no context source

**Should have (differentiators):**
- Auto-chain to `/gsd:discuss-phase 1 --auto` after milestone creation (completes the brainstorm-to-execution pipeline)
- Brainstorm.md step 10 simplification (replace ~70 lines of inline milestone creation with single SlashCommand)
- `auto_mode` field in gsd-tools init JSON output (centralizes flag + config resolution)

**Defer (explicitly NOT building):**
- Partial feature selection (`--auto --only "auth,api"`) -- scope control belongs at the input level
- Interactive fallback on context failure -- violates principle of least surprise
- Skip-research option (`--auto --no-research`) -- always research in auto mode
- Dry-run mode -- review inputs before running instead
- Auto-approve verification checkpoint -- human judgment stays at verification by design

### Architecture Approach

The architecture is inline conditional modification of the existing `new-milestone.md` workflow, not a separate auto workflow file. Six AskUserQuestion calls get wrapped in `if auto: {default} else: {interactive}` guards. The auto-chain at step 11 uses SlashCommand (not Task) to avoid subagent nesting limits. The init.cjs module gets one new field. Brainstorm.md step 10 shrinks from ~70 lines of inline execution to a 5-line SlashCommand delegation.

**Major components (by modification scope):**
1. `workflows/new-milestone.md` -- add --auto parsing, 6 conditional bypasses, auto-chain (~80 lines of new conditional blocks)
2. `workflows/brainstorm.md` -- replace step 10 inline execution with SlashCommand (~70 lines removed, ~5 added)
3. `bin/lib/init.cjs` -- add `auto_mode` field to cmdInitNewMilestone output (~3 lines)

### Critical Pitfalls

1. **Config state leaking between milestones** -- `workflow.auto_advance` persists to disk but only clears at milestone completion via transition.md. If new-milestone fails mid-workflow, config stays dirty. Prevention: do NOT persist auto_advance in new-milestone; pass `--auto` through to discuss-phase and let it handle its own persistence.
2. **Silent failure without context** -- `--auto` with no MILESTONE-CONTEXT.md, @file, or inline text must error BEFORE any file mutations (PROJECT.md, STATE.md). Prevention: validate context availability as the very first step in auto-mode path, before any writes.
3. **Brainstorm routing regression** -- replacing brainstorm step 10 inline execution with SlashCommand is a one-way handoff, not a delegation. Prevention: ensure MILESTONE-CONTEXT.md is written and committed before the handoff; include origin context in error messages.
4. **Unstoppable cascade** -- `/gsd:new-milestone --auto` chains to discuss-phase, which chains through the full pipeline. Prevention: document this behavior clearly in command help.
5. **Research model resolution** -- init must return all model fields (researcher, synthesizer, roadmapper) regardless of config state. Prevention: verify init output includes all models before auto-spawning researchers.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Argument Parsing and Context Resolution
**Rationale:** Foundation for all auto-mode behavior. Nothing else works without flag detection and context.
**Delivers:** --auto flag parsing, config read/persist, context resolution chain (MILESTONE-CONTEXT.md > @file > inline > error), init.cjs auto_mode field
**Addresses:** Flag parsing, config persistence, context resolution, error handling (table stakes)
**Avoids:** Config state leaking (Pitfall 1), silent failure without context (Pitfall 2), model resolution issues (Pitfall 5)

### Phase 2: Auto-Skip at Decision Points
**Rationale:** Depends on Phase 1 (needs parsed auto flag and resolved context). This is the core value delivery -- skipping interactive questions.
**Delivers:** Conditional bypasses at all 6 AskUserQuestion calls with correct defaults
**Addresses:** Version auto-accept, always-research, select-all-features, roadmap auto-approve (table stakes)
**Avoids:** MILESTONE-CONTEXT.md not consumed (must still delete after use), requirement over-scoping (select-all includes research anti-features)

### Phase 3: Auto-Chain to Discuss Phase
**Rationale:** Depends on Phase 2 (milestone must be fully created before chaining). This is the differentiating capability that connects milestone creation to execution.
**Delivers:** SlashCommand invocation of `/gsd:discuss-phase {FIRST_PHASE} --auto` at step 11
**Addresses:** Auto-chain (differentiator), full pipeline from brainstorm to human checkpoint
**Avoids:** Unstoppable cascade (Pitfall 4) -- must document the chaining behavior

### Phase 4: Brainstorm Integration
**Rationale:** Depends on Phases 1-3 (new-milestone --auto must work end-to-end before brainstorm delegates to it). Simplification and integration testing.
**Delivers:** Brainstorm.md step 10 simplification, end-to-end brainstorm-to-milestone testing
**Addresses:** Brainstorm simplification (differentiator), code duplication removal (~70 lines removed)
**Avoids:** Brainstorm routing regression (Pitfall 3)

### Phase Ordering Rationale

- **Dependency-driven:** Each phase depends on the previous one. Flag parsing before question skipping before chaining before integration.
- **Risk-front-loaded:** The two critical pitfalls (config leaking, silent failure) are addressed in Phase 1 where they can be caught early.
- **Incremental value:** Phases 1-2 alone deliver a useful "skip confirmations" mode even without chaining. Phase 3 adds autonomous pipeline. Phase 4 is cleanup.
- **Safe brainstorm modification last:** Changing brainstorm.md last ensures the existing inline milestone creation works until --auto is proven.

### Research Flags

Phases with standard patterns (skip research-phase):
- **All phases:** Every behavior is pattern replication from existing --auto implementations. discuss-phase.md is the reference implementation. No novel patterns, no external APIs, no unfamiliar domains.

Phases that need careful testing but not research:
- **Phase 1:** Config leaking edge cases need integration testing, not more research
- **Phase 4:** Brainstorm handoff needs end-to-end testing, not more research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all existing infrastructure verified by direct codebase reading |
| Features | HIGH | Every feature is pattern replication from existing workflows; design doc reviewed |
| Architecture | HIGH | Modification points precisely identified with line numbers; no ambiguity |
| Pitfalls | HIGH | Grounded in real bug history (CHANGELOG), existing --auto edge cases, and design doc analysis |

**Overall confidence:** HIGH

### Gaps to Address

- **Config cleanup on error:** The exact mechanism needs a decision during Phase 1 planning. Recommendation: do not persist auto_advance in new-milestone; let discuss-phase handle it. This eliminates the problem.
- **First phase number for auto-chain:** The auto-chain must invoke discuss-phase with the correct first phase number of the newly created milestone. Verify this is deterministic (always phase 1 of the new milestone) or needs parsing from ROADMAP.md.
- **pr-review.md and linear.md milestone routes:** These also create milestones inline and could benefit from the same simplification as brainstorm.md. Out of scope for v2.5 but worth noting for future work.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/new-milestone.md` -- current interactive workflow (11 steps, 6 AskUserQuestion calls)
- `get-shit-done/workflows/discuss-phase.md` -- reference --auto implementation (flag parsing, config, auto-chain)
- `get-shit-done/workflows/plan-phase.md` -- reference --auto chain (auto-advance to execute-phase)
- `get-shit-done/workflows/execute-phase.md` -- reference --auto chain (auto-advance to transition)
- `get-shit-done/workflows/new-project.md` -- reference --auto context resolution (@file, inline, error)
- `get-shit-done/workflows/brainstorm.md` -- step 10 milestone routing (simplification target)
- `get-shit-done/workflows/transition.md` -- auto_advance reset at milestone boundary
- `get-shit-done/bin/lib/init.cjs` -- cmdInitNewMilestone function
- `get-shit-done/bin/lib/config.cjs` -- CONFIG_DEFAULTS, config-get, config-set
- `get-shit-done/bin/lib/cli.cjs` -- KNOWN_SETTINGS_KEYS, validateSetting (workflow.auto_advance registered)
- `.planning/designs/2026-03-14-new-milestone-auto-mode-design.md` -- approved design document

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
