# Phase 50: Migration and Fallback - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Wire up the zx autopilot (`autopilot.mjs`) as the default entry point, preserve the legacy bash script as a fallback, add `zx` as a runtime dependency, and retire the now-unnecessary `format_json_output()` test file. After this phase, `gsd-autopilot` runs the zx script by default and users can opt into the legacy bash script with `--legacy`.

</domain>

<decisions>
## Implementation Decisions

### Entrypoint Rewrite (REQ-22)
- `bin/gsd-autopilot` is rewritten to route to `autopilot.mjs` by default and `autopilot-legacy.sh` with `--legacy` flag
- Entrypoint remains a bash script with `#!/usr/bin/env bash` shebang for portability
- Default path: `exec node "$SCRIPTS_DIR/autopilot.mjs" "$@"` (Claude's Decision: using `node` rather than `npx zx` avoids npx startup overhead since zx is a runtime dependency)
- Legacy path: detect `--legacy` as the first argument, `shift` it, then `exec bash "$SCRIPTS_DIR/autopilot-legacy.sh" "$@"`
- `SCRIPTS_DIR` resolved relative to the entrypoint location using `$HOME/.claude/get-shit-done/scripts` matching the current `AUTOPILOT` variable pattern
- Entrypoint validates the target script exists before exec, printing an error and exit 1 if missing (Claude's Decision: preserves existing error handling behavior for missing installs)

### Legacy Script Preservation (REQ-21)
- `autopilot.sh` renamed to `autopilot-legacy.sh` via `git mv` in the same directory (`get-shit-done/scripts/`)
- The original `autopilot.sh` path must no longer exist after this phase
- Internal references within `autopilot-legacy.sh` (usage strings, resume instructions) are left as-is -- they already reference `autopilot.sh` which is acceptable for a legacy fallback (Claude's Decision: minimal changes to legacy file reduce risk of introducing bugs in the fallback path)

### Resume Instruction Updates
- `autopilot.mjs` resume instructions updated from `autopilot.sh --from-phase` to `gsd-autopilot --from-phase` (Claude's Decision: resume instructions should reference the entrypoint users actually invoke, not the internal script path)
- Failure reports written by `autopilot.mjs` also reference `gsd-autopilot --from-phase` in their resume section
- Escalation reports in `autopilot.mjs` reference `gsd-autopilot --project-dir` (Claude's Decision: consistent with resume instruction update)

### Dependency Management (REQ-20)
- `zx` added to `package.json` `dependencies` (not `devDependencies`) as a runtime dependency
- Pin to current major version range (e.g., `^8.0.0`) (Claude's Decision: caret range allows minor/patch updates while preventing breaking major version changes)
- No other dependency changes needed -- `zx` is the only new runtime dependency

### Test File Retirement (REQ-23)
- `tests/format-json-output.test.cjs` is retired (deleted) since `format_json_output()` only exists in the legacy bash script and the zx script does not use it
- The test file currently extracts `format_json_output` from `autopilot.sh` via `sed` -- after the rename to `autopilot-legacy.sh`, the hardcoded path (`path.join(__dirname, '..', 'get-shit-done', 'scripts', 'autopilot.sh')`) would break anyway
- Retire rather than update because: the function is not used by the primary code path, and maintaining tests for legacy-only code adds maintenance burden (Claude's Decision: dead code tests should not consume test budget when the project is at 87.4% of the 800-test limit)

### Install Script Updates
- `bin/replace-vanilla.sh` references `bin/gsd-autopilot` for CLI installation -- no changes needed since the entrypoint file name stays the same, only its contents change
- The install script copies `bin/gsd-autopilot` to `$GSD_DIR/scripts/gsd-autopilot` and symlinks to `$HOME/.local/bin/gsd-autopilot` -- this flow is unchanged (Claude's Decision: verified the install script copies the entrypoint by filename, not by content inspection)

### Documentation References
- `autopilot.sh` references in active documentation (USER-GUIDE.md, README.md, help.md) should be updated to reference `gsd-autopilot` or `autopilot.mjs` as appropriate (Claude's Decision: stale documentation references create confusion for users)
- Archived milestone documentation (`.planning/milestones/`) is left unchanged -- historical records should reflect what was true at the time

### Claude's Discretion
- Exact zx version number to pin in package.json
- Whether to add a `--version` flag to the entrypoint
- Exact error message wording when target script is not found
- Whether resume instructions say `gsd-autopilot` or `autopilot.mjs`
- Order of flag detection in the entrypoint script

</decisions>

<specifics>
## Specific Ideas

- The design document (`.planning/designs/2026-03-10-autopilot-cjs-consolidation-design.md` lines 176-186) specifies the exact entrypoint pattern: check for `--legacy` first arg, shift and exec legacy, else exec node autopilot.mjs
- `autopilot.mjs` currently has 6 places referencing `autopilot.sh` in resume/escalation messages (lines 135, 147, 255, 439, 693, 783) -- all need updating
- The `format-json-output.test.cjs` file contains 11 tests across 5 describe blocks (FMT-01, FMT-02, FMT-03, INT-01, INT-02) -- all 11 tests are retired
- The design document mentions a "legacy removal timeline: after 1-2 milestones" -- this is out of scope for this phase but validates the `--legacy` approach
- `bin/gsd-autopilot` currently uses `$HOME/.claude/get-shit-done/scripts/autopilot.sh` as the hardcoded path -- the new version needs to resolve to the same `scripts/` directory but point to both `autopilot.mjs` and `autopilot-legacy.sh`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/gsd-autopilot` (16 lines): Current entrypoint -- simple bash script that resolves the script path and execs it. The structure is directly reusable with routing logic added.
- `autopilot.mjs` (Phase 48+49 output, ~780 lines): Feature-complete zx script that needs only resume instruction text updates.
- `autopilot.sh` (45,146 bytes): Legacy bash script to be renamed. No content changes needed.

### Established Patterns
- Entrypoint pattern: `bin/gsd-autopilot` resolves paths relative to `$HOME/.claude/get-shit-done/` and uses `exec` to hand off control -- the new version follows the same pattern with a conditional branch.
- `bin/replace-vanilla.sh` install flow: copies `bin/gsd-autopilot` to the GSD scripts directory and creates a symlink -- the entrypoint filename is stable, only contents change.
- Test retirement precedent: the project tracks test budget (699/800) and has identified 5 redundancy findings -- retiring 11 tests frees budget for Phase 51's new tests.

### Integration Points
- `bin/gsd-autopilot`: Rewritten with `--legacy` routing
- `get-shit-done/scripts/autopilot.sh` -> `get-shit-done/scripts/autopilot-legacy.sh`: Renamed via git mv
- `get-shit-done/scripts/autopilot.mjs`: Resume instruction text updates (6 locations)
- `package.json`: Add `zx` to `dependencies`
- `tests/format-json-output.test.cjs`: Deleted
- Active docs (if any reference `autopilot.sh` directly): Updated

</code_context>

<deferred>
## Deferred Ideas

- Removing `autopilot-legacy.sh` entirely (design doc says "after 1-2 milestones running on the zx version")
- Adding `--legacy` documentation to help.md/USER-GUIDE.md (documentation for migration-period flags is low priority)
- Tests for the new entrypoint routing logic and autopilot.mjs (deferred to Phase 51 per roadmap)
- Updating `version` field in `package.json` to `2.3.0` (happens at milestone completion, not during phases)

</deferred>

---

*Phase: 50-migration-and-fallback*
*Context gathered: 2026-03-10 via auto-context*
