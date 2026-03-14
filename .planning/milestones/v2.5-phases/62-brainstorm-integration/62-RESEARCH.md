# Phase 62: Brainstorm Integration - Research

**Researched:** 2026-03-14
**Domain:** GSD workflow orchestration (brainstorm.md step 10 refactoring)
**Confidence:** HIGH

## Summary

Phase 62 is a surgical edit to `brainstorm.md` step 10 milestone route. The current implementation inlines ~20 lines of milestone creation logic (steps 10b-10c: init new-milestone JSON + execute steps 1-11 inline). This phase replaces that block with a single `SlashCommand("/gsd:new-milestone --auto")` invocation, which now handles everything autonomously thanks to Phases 59-61.

The key prerequisite is that MILESTONE-CONTEXT.md must be written and committed before the SlashCommand handoff, since new-milestone's context resolution (CTX-01) reads it from disk.

**Primary recommendation:** Retain step 10a (MILESTONE-CONTEXT.md creation), add a git commit step, then replace steps 10b-10c with a SlashCommand delegation following the established pattern from new-project.md and transition.md.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Step 10a (build MILESTONE-CONTEXT.md) is RETAINED -- brainstorm must still write `.planning/MILESTONE-CONTEXT.md` with the design content before handing off
- The MILESTONE-CONTEXT.md content and format remain unchanged from the current implementation (lines 265-283 of brainstorm.md)
- After writing MILESTONE-CONTEXT.md, commit it to git before invoking new-milestone
- Steps 10b and 10c are replaced with a single SlashCommand invocation: `SlashCommand("/gsd:new-milestone --auto")`
- No arguments beyond `--auto` are needed
- The SlashCommand pattern follows the established convention from new-project.md line 1053 and transition.md lines 381-393
- The new-project route (lines 309-318) remains unchanged

### Claude's Discretion
- Exact git commit message wording for the MILESTONE-CONTEXT.md commit
- Banner text formatting before the SlashCommand invocation
- Whether to display "Routing to new-milestone..." or similar status message

### Deferred Ideas (OUT OF SCOPE)
- Simplifying pr-review.md and linear.md milestone routes to also use `/gsd:new-milestone --auto`
- Autopilot-compatible brainstorm mode with auto-approved design sections
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01 | brainstorm.md step 10 milestone route simplified to invoke `/gsd:new-milestone --auto` instead of inline steps 1-11 | SlashCommand delegation pattern verified in new-project.md (line 1053) and transition.md (lines 381-393). Pattern: `Exit skill and invoke SlashCommand("/gsd:new-milestone --auto")` |
| INT-02 | MILESTONE-CONTEXT.md is written and committed before brainstorm handoff | Step 10a already writes MILESTONE-CONTEXT.md. Adding git commit before SlashCommand ensures file persists across context boundaries. Commit pattern from brainstorm.md step 8 (design file commit) serves as template. |
</phase_requirements>

## Architecture Patterns

### Pattern 1: SlashCommand Delegation
**What:** Workflow terminates by invoking another GSD command via SlashCommand
**When to use:** When one workflow needs to hand off to another complete workflow
**Example (from new-project.md line 1053):**
```
Exit skill and invoke SlashCommand("/gsd:discuss-phase 1 --auto")
```

### Pattern 2: Bridge File + Commit Before Handoff
**What:** Write a context file, commit it to git, then delegate to another workflow that reads it
**When to use:** When the target workflow reads context from disk and may run in a fresh session
**Example:** brainstorm.md step 8 commits the design file before routing to step 9/10

### Anti-Patterns to Avoid
- **Inline execution of another workflow:** What steps 10b-10c currently do. Creates duplication and divergence when the target workflow evolves.
- **Skipping git commit before handoff:** MILESTONE-CONTEXT.md must be on disk when new-milestone starts; committing ensures it survives context window boundaries.

## Common Pitfalls

### Pitfall 1: Forgetting to commit MILESTONE-CONTEXT.md
**What goes wrong:** new-milestone's CTX-01 reads from disk; if file isn't committed, it might not exist if the SlashCommand spawns a new session
**Why it happens:** The current inline approach consumes MILESTONE-CONTEXT.md in the same context window
**How to avoid:** Add explicit `gsd-tools.cjs commit` call between writing the file and invoking SlashCommand
**Warning signs:** new-milestone prompting for "What do you want to build?" instead of auto-detecting context

### Pitfall 2: Passing unnecessary arguments to new-milestone
**What goes wrong:** Redundant arguments could conflict with new-milestone's own context resolution
**Why it happens:** Trying to be explicit when new-milestone already handles everything
**How to avoid:** Only pass `--auto` -- CTX-01 auto-detects MILESTONE-CONTEXT.md

## Code Examples

### Current Step 10 (lines 259-318 of brainstorm.md)
```markdown
## 10. Route into Creation Flow

### Milestone Route (PROJECT.md exists)

**10a. Build MILESTONE-CONTEXT.md:**
[writes MILESTONE-CONTEXT.md -- RETAINED]

**10b. Initialize milestone models:**
[gsd-tools.cjs init new-milestone -- REMOVED]

**10c. Execute new-milestone workflow steps 1-11 inline:**
[inline execution -- REMOVED]
```

### Target Step 10 (after phase 62)
```markdown
## 10. Route into Creation Flow

### Milestone Route (PROJECT.md exists)

**10a. Build MILESTONE-CONTEXT.md:**
[writes MILESTONE-CONTEXT.md -- unchanged]

**10b. Commit and delegate:**
Commit MILESTONE-CONTEXT.md, display routing banner, invoke SlashCommand.
```

## Sources

### Primary (HIGH confidence)
- brainstorm.md (lines 259-318) -- current step 10 implementation read directly
- new-project.md (line 1053) -- SlashCommand delegation pattern read directly
- 62-CONTEXT.md -- user decisions from discuss-phase
- REQUIREMENTS.md -- INT-01, INT-02 requirement definitions

## Metadata

**Confidence breakdown:**
- Architecture: HIGH - internal workflow patterns, read directly from source files
- Pitfalls: HIGH - based on understanding of GSD's context window behavior
- Implementation: HIGH - straightforward markdown edit with established patterns

**Research date:** 2026-03-14
**Valid until:** indefinite (internal workflow, not external dependency)
