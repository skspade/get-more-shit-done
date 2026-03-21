# Phase 82: Fix Agent Path and Model Profile - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Agent file is deployed to the correct runtime path and model profile is registered so the test-review command works end-to-end. This phase fixes three integration gaps found during the v2.9 milestone audit: (1) copy `gsd-test-reviewer.md` from the project repo to `~/.claude/agents/`, (2) add a `gsd-test-reviewer` entry to `MODEL_PROFILES` in `core.cjs`, and (3) remove unused `checker_model` / `verifier_model` fields from `cmdInitTestReview` in `init.cjs`. All changes are small, targeted fixes -- no new features.

</domain>

<decisions>
## Implementation Decisions

### Agent File Deployment
- Copy `agents/gsd-test-reviewer.md` from the project repo to `~/.claude/agents/gsd-test-reviewer.md` (from ROADMAP.md success criteria 1)
- The command spawns the agent via `Task()` with `subagent_type="gsd-test-reviewer"` which resolves to `~/.claude/agents/` at runtime (from v2.9 MILESTONE-AUDIT.md integration issue)
- All other GSD agents (gsd-test-steward, gsd-playwright, etc.) exist at `~/.claude/agents/` -- the reviewer must follow the same deployment path (from codebase pattern -- 14 agents already deployed there)

### Model Profile Registration
- Add `'gsd-test-reviewer'` entry to `MODEL_PROFILES` in `core.cjs` with the same values as `gsd-test-steward`: `{ quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' }` (from ROADMAP.md success criteria 2)
- The test reviewer and test steward are the same role class (read-only analysis agents), so they share the same model profile (from v2.9 MILESTONE-AUDIT.md recommendation)
- Without this entry, `resolveModelInternal(cwd, 'gsd-test-reviewer')` falls back to `'sonnet'` regardless of profile setting (from core.cjs line 370 fallback behavior)

### Init Function Cleanup
- Remove `checker_model` and `verifier_model` fields from `cmdInitTestReview` in `init.cjs` (from ROADMAP.md success criteria 3)
- These fields were copied from `cmdInitPrReview` but are unused by the test-review command -- it has no plan-checker or verifier step (from v2.9 MILESTONE-AUDIT.md tech debt)
- Keep `reviewer_model`, `planner_model`, and `executor_model` which are used by the command and routing steps (Claude's Decision: these three models are referenced by the command for agent spawn, quick task planning, and execution respectively)

### File Locations
- `core.cjs` changes at `~/.claude/get-shit-done/bin/lib/core.cjs` (Claude's Decision: this is where MODEL_PROFILES is defined and where Phase 78 deployed init changes -- consistent deployment target)
- `init.cjs` changes at `~/.claude/get-shit-done/bin/lib/init.cjs` (Claude's Decision: same deployment location as Phase 78 changes to cmdInitTestReview)

### Claude's Discretion
- Exact placement of the new MODEL_PROFILES entry within the object (alphabetical vs grouped by role)
- Whether to add a comment on the new profile entry

</decisions>

<specifics>
## Specific Ideas

- The MODEL_PROFILES entry should be added after `gsd-test-steward` to keep related agents adjacent, matching the alphabetical-ish ordering already in place.
- The `cmdInitTestReview` function currently has 5 model fields (reviewer, planner, executor, checker, verifier) -- after cleanup it should have 3 (reviewer, planner, executor).
- The agent file copy is a one-time deployment step. The file already exists correctly in the project repo at `agents/gsd-test-reviewer.md` -- no content changes needed, just copying to the runtime path.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/gsd-test-reviewer.md`: Complete agent file (created in Phase 79) ready to deploy -- no modifications needed, just copy to `~/.claude/agents/`.
- `MODEL_PROFILES` in `core.cjs` (line 18): Existing profile registry with 12 entries. Adding a 13th entry for `gsd-test-reviewer`.
- `cmdInitTestReview` in `init.cjs` (line 834): Existing function with `checker_model` and `verifier_model` fields to remove.

### Established Patterns
- Agent deployment: All 14 GSD agents exist at `~/.claude/agents/` alongside the project repo copies in `agents/`. The runtime path is `~/.claude/agents/`.
- Model profile registration: Each agent type gets one entry in `MODEL_PROFILES` with quality/balanced/budget tiers. Read-only analysis agents use `sonnet/sonnet/haiku`.
- Init function fields: Only include model fields that the command actually uses. `cmdInitPrReview` includes checker/verifier because pr-review's quick route uses them; test-review does not.

### Integration Points
- `~/.claude/agents/gsd-test-reviewer.md`: Runtime agent path referenced by `test-review.md` Step 8 `Task()` spawn.
- `~/.claude/get-shit-done/bin/lib/core.cjs` MODEL_PROFILES: Consumed by `resolveModelInternal()` which is called by `cmdInitTestReview` for `reviewer_model`.
- `~/.claude/get-shit-done/bin/lib/init.cjs` cmdInitTestReview: Called by `gsd-tools.cjs init test-review` which the command invokes in Step 2.

</code_context>

<deferred>
## Deferred Ideas

- Syncing project repo files to `~/.claude/` automatically (deployment tooling) -- out of scope, manual copy is sufficient
- Tests for MODEL_PROFILES entries -- existing `core.test.cjs` tests cover `resolveModelInternal` behavior generically

</deferred>

---

*Phase: 82-fix-agent-path-and-model-profile*
*Context gathered: 2026-03-21 via auto-context*
