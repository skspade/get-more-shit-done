# Phase 61: Auto-Chain to Discuss Phase - Research

**Researched:** 2026-03-14
**Domain:** GSD workflow orchestration (markdown workflow modification)
**Confidence:** HIGH

## Summary

Phase 61 adds an auto-chain block to `new-milestone.md` step 11 so that after roadmap creation in auto mode, the workflow automatically invokes `/gsd:discuss-phase {N} --auto` for the first phase of the new milestone. This connects the milestone creation pipeline to the autonomous execution pipeline.

The implementation is straightforward: the exact pattern already exists in `new-project.md` (lines 1045-1053) and `transition.md` (lines 381-393). The only difference is that the first phase number must be resolved dynamically using `gsd-tools.cjs phase find-next` rather than hardcoded to 1.

**Primary recommendation:** Add a conditional auto-chain block to step 11 of new-milestone.md that resolves the first phase number via `phase find-next` and invokes `SlashCommand("/gsd:discuss-phase {N} --auto")`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- In auto mode, after the roadmap commit in step 10, add an auto-chain block before the "Done" display in step 11
- The auto-chain uses `SlashCommand("/gsd:discuss-phase {FIRST_PHASE} --auto")` to exit the skill and invoke discuss-phase
- This follows the exact pattern from `new-project.md` lines 1045-1053
- In interactive mode, the existing "Next Up" display remains unchanged
- Read the first phase number from ROADMAP.md using `gsd-tools.cjs phase find-next`
- The phase number is NOT hardcoded to 1
- Step 11 ("Done") gains an auto-mode conditional block
- The auto-chain replaces the "Next Up" section in auto mode
- If `find-next` returns null, display an error and skip chaining

### Claude's Discretion
- Exact banner text formatting for the auto-advance display
- Whether to read the phase name for the banner display or just show the number
- Variable naming for the resolved first phase number

### Deferred Ideas (OUT OF SCOPE)
- Brainstorm routing simplification (Phase 62: INT-01, INT-02)
- Updating new-project.md's hardcoded phase 1 (not in scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAIN-01 | After roadmap creation in auto mode, invoke `/gsd:discuss-phase {first_phase} --auto` | Auto-chain pattern from new-project.md + SlashCommand invocation pattern |
| CHAIN-02 | First phase number is read from ROADMAP.md, not hardcoded | `gsd-tools.cjs phase find-next` (calls `findFirstIncompletePhase`) returns first incomplete phase |
</phase_requirements>

## Standard Stack

Not applicable — this phase modifies a markdown workflow file only. No libraries or code dependencies.

## Architecture Patterns

### Pattern 1: Auto-Chain via SlashCommand

**What:** After completing a workflow stage in auto mode, exit the current skill and invoke the next workflow via `SlashCommand()`.

**When to use:** When auto-mode workflows need to chain to the next GSD phase without human intervention.

**Existing examples:**

1. `new-project.md` (lines 1045-1053):
```
If auto mode:
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝

Exit skill and invoke SlashCommand("/gsd:discuss-phase 1 --auto")
```

2. `transition.md` (lines 381-393): Same pattern for chaining between phases.

### Pattern 2: Dynamic Phase Number Resolution

**What:** Use `gsd-tools.cjs phase find-next` to get the first incomplete phase from ROADMAP.md.

**How it works:**
- Without `--from` flag: calls `findFirstIncompletePhase(cwd)` which reads ROADMAP.md, extracts all phase numbers, checks each for completion status, returns first incomplete.
- With `--from N` flag: calls `nextIncompletePhase(cwd, N)` which finds the next incomplete phase after phase N.
- Returns the phase number as a string, or null if all phases are complete.

**Verified:** `phase find-next --raw` returns `61` in the current project state (HIGH confidence — tested directly).

### Anti-Patterns to Avoid
- **Hardcoding phase 1:** Milestones start at varying phase numbers (e.g., v2.5 starts at phase 59)
- **Using `--from 0`:** CONTEXT.md suggested this but the simpler `find-next` without `--from` already returns the first incomplete phase

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding first phase number | Parsing ROADMAP.md manually | `gsd-tools.cjs phase find-next` | Already tested, handles edge cases |

## Common Pitfalls

### Pitfall 1: Auto-chain fires in interactive mode
**What goes wrong:** The auto-chain block runs even when `--auto` is not active, skipping user interaction.
**How to avoid:** Guard the auto-chain with `If auto mode is active:` conditional, same pattern as steps 3, 8, 9, 10.

### Pitfall 2: find-next returns null
**What goes wrong:** If all phases are already complete (shouldn't happen with fresh roadmap), `find-next` returns null and the SlashCommand gets an empty phase number.
**How to avoid:** Check for null before invoking SlashCommand. Display error and fall through to interactive "Next Up" block.

### Pitfall 3: Showing both auto-chain and "Next Up"
**What goes wrong:** Displaying manual instructions after already auto-advancing is confusing.
**How to avoid:** Use if/else — auto mode shows the auto-chain banner; interactive mode shows the "Next Up" block. Never both.

## Code Examples

### Current Step 11 Structure (to be modified)
The current step 11 in new-milestone.md is a single block showing the "MILESTONE INITIALIZED" banner and "Next Up" section. The modification adds a conditional before the "Next Up" section.

### Target Step 11 Structure
```markdown
## 11. Done

**If auto mode is active:**

Resolve first phase:
FIRST_PHASE=$(node gsd-tools.cjs phase find-next --raw)

If FIRST_PHASE is null/empty: display error, skip chaining.

Otherwise:
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE {N}      ║
╚══════════════════════════════════════════╝

Exit skill and invoke SlashCommand("/gsd:discuss-phase {FIRST_PHASE} --auto")

**If interactive mode:** [existing "Next Up" block unchanged]
```

## Sources

### Primary (HIGH confidence)
- `/Users/seanspade/.claude/get-shit-done/workflows/new-milestone.md` — current step 11 implementation
- `/Users/seanspade/.claude/get-shit-done/workflows/new-project.md` — auto-chain pattern (lines 1045-1053)
- `/Users/seanspade/.claude/get-shit-done/bin/lib/phase.cjs` — `findFirstIncompletePhase` implementation
- `/Users/seanspade/.claude/get-shit-done/bin/gsd-tools.cjs` — `phase find-next` CLI dispatch

### Verified by testing
- `node gsd-tools.cjs phase find-next --raw` returns `61` — confirms tool works and returns first incomplete phase

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no libraries involved
- Architecture: HIGH — pattern already exists in two other workflow files
- Pitfalls: HIGH — straightforward conditional logic with well-understood edge cases

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable — workflow markdown files)
