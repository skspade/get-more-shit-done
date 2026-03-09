# Phase 45: Fix Quick Route Init Command - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Quick route works end-to-end by adding the missing `init pr-review` subcommand to gsd-tools.cjs. The pr-review workflow (Step 8) calls `gsd-tools.cjs init pr-review` but this subcommand does not exist in the init switch statement, causing a runtime crash that blocks the entire quick route. This phase adds the `cmdInitPrReview` function, wires it into the init dispatch, updates the error message's available list, and adds tests. This is a gap closure phase fixing a runtime integration bug.

</domain>

<decisions>
## Implementation Decisions

### Init Function Implementation
- Add `cmdInitPrReview` function to `get-shit-done/bin/lib/init.cjs` returning identical fields as `cmdInitLinear` (Claude's Decision: pr-review quick route consumes the same fields as linear quick route -- planner_model, executor_model, checker_model, verifier_model, commit_docs, next_num, date, timestamp, quick_dir, state_path, roadmap_path, project_path, config_path, planning_exists, roadmap_exists)
- Function body is identical to `cmdInitLinear` -- same quick task numbering, same model resolution, same path/existence checks (Claude's Decision: the pr-review workflow expects the exact same JSON shape as linear, so the function is a direct copy with a different name)

### Init Dispatch Wiring
- Add `case 'pr-review':` to the init switch statement in `gsd-tools.cjs`, calling `init.cmdInitPrReview(cwd, raw)`
- Place the new case after the `case 'linear':` block for logical grouping
- Add `cmdInitPrReview` to the module.exports in `init.cjs`
- Update the error message's "Available:" list to include `pr-review`

### Test Coverage
- Add test describe block `cmdInitPrReview` in `tests/init.test.cjs` mirroring the `cmdInitLinear` tests
- Tests verify: valid JSON with model fields, commit_docs config, next_num starting at 1, correct next_num with existing tasks, date/timestamp fields, path fields, planning_exists and roadmap_exists booleans
- Tests use `runGsdTools('init pr-review', tmpDir)` pattern matching existing test conventions

### Claude's Discretion
- Exact ordering of the new case within the switch statement (after linear is preferred but not critical)
- Whether to extract shared logic between `cmdInitLinear` and `cmdInitPrReview` into a helper (Claude's Decision: keep them separate for now -- premature abstraction; they may diverge if pr-review needs different fields later)

</decisions>

<specifics>
## Specific Ideas

- REQUIREMENTS.md QCK-02 specifies: "Creates quick task directory via gsd-tools.cjs init"
- Phase 42 CONTEXT.md specifies: "Initialize via `gsd-tools.cjs init pr-review` and `gsd-tools.cjs generate-slug`"
- The pr-review workflow at line 269 calls `gsd-tools.cjs init pr-review` and expects the same JSON fields as `init linear`
- The `cmdInitLinear` function (init.cjs lines 735-782) is the direct template -- copy with renamed function name
- The init switch statement (gsd-tools.cjs lines 525-571) needs a new case and updated error message

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/bin/lib/init.cjs` `cmdInitLinear` (lines 735-782): Direct template for `cmdInitPrReview`. Returns planner_model, executor_model, checker_model, verifier_model, commit_docs, next_num, date, timestamp, quick_dir, state_path, roadmap_path, project_path, config_path, planning_exists, roadmap_exists.
- `tests/init.test.cjs` `cmdInitLinear` test block (lines 846-929): Direct template for `cmdInitPrReview` tests. 7 tests covering all output fields.

### Established Patterns
- **Init function pattern**: All init functions follow the same shape: `function cmdInitX(cwd, raw) { ... output(result, raw); }` with `loadConfig`, `resolveModelInternal`, and `pathExistsInternal` helpers.
- **Init dispatch pattern**: Switch statement in gsd-tools.cjs routes `init <workflow>` to `init.cmdInitX(cwd, raw)`.
- **Test pattern**: Each init subcommand has a `describe('cmdInitX')` block with tests using `runGsdTools('init x', tmpDir)` helper.

### Integration Points
- **Modified file**: `get-shit-done/bin/lib/init.cjs` -- add new function and export
- **Modified file**: `get-shit-done/bin/gsd-tools.cjs` -- add case to init switch, update error message
- **Modified file**: `tests/init.test.cjs` -- add test describe block
- **Consuming file**: `get-shit-done/workflows/pr-review.md` line 269 -- already calls `init pr-review`, currently fails at runtime

</code_context>

<deferred>
## Deferred Ideas

- Extracting shared quick-route init logic into a common helper function (premature until a third consumer emerges)
- Phase 46 handles remaining verification and metadata gaps (VERIFICATION.md files, SUMMARY frontmatter, REQUIREMENTS.md checkboxes)

</deferred>

---

*Phase: 45-fix-quick-route-init*
*Context gathered: 2026-03-09 via auto-context*
