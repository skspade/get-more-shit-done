# Phase 60: Auto-Skip Decision Points - Research

**Researched:** 2026-03-14
**Domain:** Workflow markdown auto-mode conditional branches
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SKIP-01 maps to step 2: auto mode uses resolved context, skips "What do you want to build next?"
- SKIP-02 maps to step 3: auto mode accepts suggested minor bump without confirmation
- SKIP-03 maps to step 8: auto mode selects "Research first" and persists config
- SKIP-04 maps to step 9 (feature scoping): auto mode includes all features
- SKIP-05 maps to step 9 (gap question): auto mode answers "No, research covered it"
- SKIP-06 maps to step 10: auto mode auto-approves roadmap
- All skips implemented in workflow markdown, not in gsd-tools.cjs
- No new config keys introduced; only `workflow.research` written by SKIP-03
- Roadmapper ROADMAP BLOCKED in auto mode exits with error

### Claude's Discretion
- Exact conditional syntax within the workflow markdown
- Whether to group all auto-mode guards in a single section or inline each at its decision point
- Log/display messages shown during auto-skipped steps
- Order of operations when multiple skips happen in sequence

### Deferred Ideas (OUT OF SCOPE)
- Auto-chain to discuss-phase (Phase 61: CHAIN-01, CHAIN-02)
- Brainstorm routing simplification (Phase 62: INT-01, INT-02)
- Custom version override in auto mode
- `--no-research` flag for auto mode
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIP-01 | "What do you want to build next?" skipped, using resolved context | Step 2 already has auto mode branch from Phase 59 -- verify it works, may need no changes |
| SKIP-02 | Version suggestion auto-accepted (minor bump) | Step 3 needs new auto-mode conditional before "Confirm with user" |
| SKIP-03 | Research decision auto-selects "Research first" | Step 8 needs auto-mode conditional before AskUserQuestion |
| SKIP-04 | Requirement scoping auto-includes all features | Step 9 needs auto-mode conditional to skip per-category AskUserQuestion |
| SKIP-05 | "Identify gaps" auto-skipped with "No" | Step 9 needs auto-mode conditional to skip gaps AskUserQuestion |
| SKIP-06 | Roadmap approval auto-approved | Step 10 needs auto-mode conditional to skip approval AskUserQuestion |
</phase_requirements>

## Summary

Phase 60 adds auto-mode conditional branches to steps 3, 8, 9, and 10 of `new-milestone.md`. Phase 59 already implemented step 2's auto-mode branch (SKIP-01), so that requirement only needs end-to-end verification. The remaining 5 decision points each get a simple pattern: "If auto mode is active: [default action]. Otherwise: [existing interactive behavior]."

All changes are in a single file: `get-shit-done/workflows/new-milestone.md`. No code changes to `.cjs` files. No tests to write (workflow markdown is tested via integration, not unit tests).

**Primary recommendation:** Inline each auto-mode guard at its decision point (not a single grouped section) to maintain readability and match Phase 59's established pattern in step 2.

## Standard Stack

No libraries or code dependencies. This phase modifies only workflow instruction markdown.

## Architecture Patterns

### Pattern: Inline Auto-Mode Guard

Phase 59 established this pattern in step 2:

```markdown
## 2. Gather Milestone Goals

**If auto mode with resolved context:**
- Use resolved context from `<context_resolution>` as milestone goals
- Skip interactive questioning
- Continue to step 3

**If MILESTONE-CONTEXT.md exists:**
[... existing interactive behavior ...]
```

Each SKIP follows this same structure: add an auto-mode conditional at the TOP of the step, before the existing interactive path.

### Pattern: Auto-Mode Display Messages

When skipping a decision point, display a brief message so the user sees progress:

```
Auto: using resolved context for milestone goals
Auto: accepting version v2.5 (minor bump)
Auto: selecting "Research first"
Auto: including all features from research
Auto: skipping gap identification
Auto: approving roadmap
```

These use the same prefix ("Auto:") for consistency and are visible in logs.

### Pattern: Config Persistence on Auto Decisions

Step 8 (SKIP-03) persists `workflow.research true` -- this follows the existing pattern where auto mode persists choices so downstream workflows inherit them. The command already exists in step 8's documentation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-mode detection | New flag parsing | Existing `auto_mode` boolean from `<auto_mode>` section | Phase 59 already built this |
| Config persistence | Manual file writes | `gsd-tools.cjs config-set` | Already used throughout workflow |

## Common Pitfalls

### Pitfall 1: Missing the Requirements Confirmation
**What goes wrong:** Step 9 has TWO interactive checkpoints -- per-category scoping AND the final "Does this capture what you're building?" confirmation. Missing the second leaves an interactive prompt in auto mode.
**How to avoid:** SKIP-04/SKIP-05 must cover both the scoping AskUserQuestion and the requirements confirmation.

### Pitfall 2: Roadmapper BLOCKED in Auto Mode
**What goes wrong:** Auto-approving a ROADMAP BLOCKED response (which indicates structural problems).
**How to avoid:** Only auto-approve ROADMAP CREATED. ROADMAP BLOCKED still errors out in auto mode.

### Pitfall 3: SKIP-01 May Already Be Done
**What goes wrong:** Implementing SKIP-01 twice, creating redundant or conflicting conditionals.
**How to avoid:** Phase 59's plan 02 already added the auto-mode branch to step 2. Verify it covers SKIP-01 before adding anything.

## Code Examples

### Step 3 Auto-Skip (SKIP-02)
```markdown
## 3. Determine Milestone Version

**If auto mode is active:**
- Compute suggested version (minor bump from last milestone)
- Display: `Auto: accepting version v[X.Y] (minor bump)`
- Continue to step 4

- Parse last version from MILESTONES.md
- Suggest next version (v1.0 -> v1.1, or v2.0 for major)
- Confirm with user
```

### Step 8 Auto-Skip (SKIP-03)
```markdown
## 8. Research Decision

**If auto mode is active:**
- Display: `Auto: selecting "Research first"`
- Persist choice: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.research true`
- Continue to research spawning (below)

AskUserQuestion: "Research the domain ecosystem..."
```

### Step 9 Auto-Skip (SKIP-04, SKIP-05)
```markdown
**If auto mode is active:**
- Include all features from research FEATURES.md (all table stakes + all differentiators)
- Skip per-category AskUserQuestion scoping
- Skip "Identify gaps" AskUserQuestion (proceed as "No, research covered it")
- Skip requirements confirmation ("Does this capture what you're building?") -- auto-approve
- Display: `Auto: including all features from research`
- Continue to generate and commit REQUIREMENTS.md
```

### Step 10 Auto-Skip (SKIP-06)
```markdown
**If `## ROADMAP CREATED`:**

**If auto mode is active:**
- Display: `Auto: approving roadmap`
- Skip approval AskUserQuestion
- Continue to commit roadmap

**If interactive mode:**
Read ROADMAP.md, present inline...
```

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/new-milestone.md` -- current workflow file, all 6 decision points identified
- `.planning/phases/59-flag-parsing-and-context-resolution/59-02-PLAN.md` -- Phase 59's implementation of auto_mode and context_resolution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no libraries involved
- Architecture: HIGH - extending established pattern from Phase 59
- Pitfalls: HIGH - clear scope, well-documented decision points

**Research date:** 2026-03-14
**Valid until:** 2026-04-14

## RESEARCH COMPLETE
