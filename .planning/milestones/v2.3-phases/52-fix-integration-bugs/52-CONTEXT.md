# Phase 52: Fix Critical Integration Bugs - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The zx autopilot runs without runtime crashes. Two critical integration bugs identified by the v2.3 milestone audit are fixed: the entrypoint invokes autopilot.mjs via `npx zx` instead of plain `node` so zx globals are available, and autopilot.mjs uses `phaseInfo.directory` instead of `.dir` at all 5 locations so phase directory resolution works correctly. This is a gap closure phase with a narrow, well-defined scope.

</domain>

<decisions>
## Implementation Decisions

### Entrypoint Fix (REQ-22)
- `bin/gsd-autopilot` line 25 changes from `exec node "$TARGET" "$@"` to `exec npx zx "$TARGET" "$@"`
- The fix ensures zx globals (`argv`, `$`, `which`, `chalk`, `fs`, `path`) are injected at runtime, matching the `#!/usr/bin/env zx` shebang in `autopilot.mjs`
- `npx zx` is used instead of bare `zx` to avoid requiring a global install (Claude's Decision: npx resolves from the local node_modules where zx is a runtime dependency per REQ-20, avoiding PATH requirements)
- No other changes to the entrypoint file -- the `--legacy` routing and error handling remain as-is

### Property Name Fix (REQ-10, REQ-11)
- `autopilot.mjs` replaces `phaseInfo.dir` with `phaseInfo.directory` at all 5 locations: lines 384, 527, 573, 588, 718
- `findPhaseInternal` in `core.cjs` (line 232) returns `{ directory: "..." }` -- there is no `.dir` property
- The fix is a direct string replacement with no behavioral changes -- the surrounding ternary expressions (`phaseInfo ? phaseInfo.directory : fallback`) remain identical
- No changes to `core.cjs` or any other CJS module -- the bug is entirely in the consumer (`autopilot.mjs`)

### Verification Approach
- `autopilot.mjs --dry-run` must complete without `ReferenceError` or `undefined` path errors
- Dry-run exercises the full code path including phase resolution, so both fixes are validated by a single invocation (Claude's Decision: dry-run is the most efficient single-command verification since it exercises both the zx globals and phaseInfo property access)

### Scope Boundary
- This phase fixes exactly two bugs -- no refactoring, no feature additions, no test changes
- Existing tests that pass before this fix must still pass after (Claude's Decision: regression prevention is critical for a bugfix-only phase)

### Claude's Discretion
- Whether to run `npx zx` or `npx --yes zx` in the entrypoint
- Exact wording of any inline code comments added at fix sites
- Whether to verify the fix with a manual dry-run or rely on existing test infrastructure

</decisions>

<specifics>
## Specific Ideas

- The milestone audit document (`.planning/v2.3-MILESTONE-AUDIT.md`) explicitly identifies both bugs under "Integration Issues" with exact file paths and line numbers
- Bug 1 verified: `node get-shit-done/scripts/autopilot.mjs --help` crashes with `ReferenceError: argv is not defined` at line 37 (where `argv` is the zx-injected CLI argument parser)
- Bug 2 impact: `phaseDir` is always `undefined` at all 5 locations, causing `getVerificationStatus(cwd, undefined)` and `getGapsSummary(cwd, undefined)` to silently fail (return null/empty), and phase logging to show wrong paths
- The `core.cjs` return object shape at line 230-242 is: `{ found, directory, phase_number, phase_name, phase_slug, plans, summaries, incomplete_plans, has_research, has_context, has_verification }`
- Phase 50 CONTEXT.md originally specified `exec node "$TARGET"` as a design decision with rationale "avoids npx startup overhead since zx is a runtime dependency" -- this turned out to be incorrect because plain `node` does not inject zx globals

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/gsd-autopilot` (26 lines): Current entrypoint -- only line 25 needs the `node` to `npx zx` change
- `autopilot.mjs` (1116 lines): Full zx script -- only 5 lines need `.dir` to `.directory` property name change

### Established Patterns
- `findPhaseInternal` returns objects with `directory` property throughout the entire codebase -- `autopilot.mjs` is the only consumer that incorrectly uses `.dir`
- The entrypoint pattern in `bin/gsd-autopilot` uses `exec` to hand off control -- this is preserved, only the command changes from `node` to `npx zx`

### Integration Points
- `bin/gsd-autopilot` line 25: `exec node "$TARGET" "$@"` -> `exec npx zx "$TARGET" "$@"`
- `autopilot.mjs` line 384: `phaseInfo.dir` -> `phaseInfo.directory`
- `autopilot.mjs` line 527: `phaseInfo.dir` -> `phaseInfo.directory`
- `autopilot.mjs` line 573: `phaseInfo.dir` -> `phaseInfo.directory`
- `autopilot.mjs` line 588: `phaseInfo.dir` -> `phaseInfo.directory`
- `autopilot.mjs` line 718: `phaseInfo.dir` -> `phaseInfo.directory`

</code_context>

<deferred>
## Deferred Ideas

- Phase 49 verification and SUMMARY frontmatter fixes (deferred to Phase 53 per roadmap)
- REQUIREMENTS.md traceability table updates (deferred to Phase 53 per roadmap)
- Removing `autopilot-legacy.sh` entirely (design doc says "after 1-2 milestones")
- Consolidation of redundant tests identified by audit (separate concern from bugfixes)

</deferred>

---

*Phase: 52-fix-integration-bugs*
*Context gathered: 2026-03-10 via auto-context*
