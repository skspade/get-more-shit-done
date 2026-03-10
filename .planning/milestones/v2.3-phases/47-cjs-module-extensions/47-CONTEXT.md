# Phase 47: CJS Module Extensions - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Autopilot logic currently duplicated in bash (find_first_incomplete_phase, next_incomplete_phase, extract_verification_status, extract_gaps_summary, get_config defaults) is extracted into tested CJS functions callable from any JS context. New gsd-tools dispatch entries expose these functions via CLI for backward compatibility.

</domain>

<decisions>
## Implementation Decisions

### Phase Navigation (REQ-01, REQ-02, REQ-03)
- `phase.cjs` exports `findFirstIncompletePhase(cwd)` returning the first incomplete phase number or null
- `phase.cjs` exports `nextIncompletePhase(cwd, currentPhase)` returning the next incomplete phase after the given phase or null
- Both functions iterate phases from `roadmap.cmdRoadmapAnalyze()` output and check completion via the existing `cmdPhaseStatus` internals
- Extract shared `computePhaseStatus(cwd, phaseInfo)` internal from `cmdPhaseStatus` so both the command and the new functions reuse the same status-computation logic
- `computePhaseStatus` is not exported -- it is an internal helper shared within `phase.cjs` (Claude's Decision: keeps the module's public API clean while eliminating duplication)
- Phase completion check uses the same three-signal approach already in `cmdPhaseStatus`: `.completed` marker file, ROADMAP.md checkbox fallback, artifact-complete tertiary (Claude's Decision: reusing existing logic avoids divergent completion semantics)

### Verification Status (REQ-04, REQ-05)
- `verify.cjs` exports `getVerificationStatus(cwd, phaseDir)` returning `{ status, score }` or null
- `verify.cjs` exports `getGapsSummary(cwd, phaseDir)` returning an array of gap description strings
- `getVerificationStatus` finds VERIFICATION.md or UAT.md in the phase directory, then parses frontmatter using the existing `extractFrontmatter` from `frontmatter.cjs`
- `getGapsSummary` finds the same file and extracts lines from `## ...Gap` sections using string matching (Claude's Decision: mirrors the bash sed/grep approach but using JS string operations for consistency with CJS codebase)
- File search order: `*-VERIFICATION.md` first, then `*-UAT.md` fallback -- matches existing bash behavior

### Config Defaults (REQ-06)
- `cli.cjs` defines a `CONFIG_DEFAULTS` map: `{ 'autopilot.circuit_breaker_threshold': 3, 'autopilot.max_debug_retries': 3, 'autopilot.max_audit_fix_iterations': 3, 'autopilot.auto_accept_tech_debt': true }`
- `config-get` in `config.cjs` falls back to `CONFIG_DEFAULTS` when the key is unset or config.json is missing (Claude's Decision: config.cjs owns config-get logic, so the fallback belongs there rather than cli.cjs -- the defaults map can be defined in config.cjs directly)
- `CONFIG_DEFAULTS` is exported so the zx script in Phase 48 can import it directly

### Tool Dispatch (REQ-07, REQ-08)
- `gsd-tools.cjs` dispatches `phase find-next [--from N]` to `findFirstIncompletePhase` or `nextIncompletePhase`
- `gsd-tools.cjs` dispatches `verify status <phase>` and `verify gaps <phase>` to `getVerificationStatus` and `getGapsSummary`
- `phase find-next` with no `--from` calls `findFirstIncompletePhase(cwd)`; with `--from N` calls `nextIncompletePhase(cwd, N)`
- `verify status` and `verify gaps` resolve the phase directory using existing `findPhaseInternal` before calling the new functions (Claude's Decision: consistent with how other verify subcommands resolve paths)

### Module Structure
- All new functions are added to their respective existing modules -- no new files created
- Functions accept `cwd` as first parameter following the established pattern in all CJS modules
- `phaseDir` parameter for verify functions is the relative phase directory path (e.g., `.planning/phases/47-cjs-module-extensions`) consistent with `findPhaseInternal` output (Claude's Decision: matches the convention used by existing verify functions like `cmdVerifyPhaseCompleteness`)

### Claude's Discretion
- Internal variable naming within `computePhaseStatus`
- Exact regex pattern for gap section extraction in `getGapsSummary`
- Order of fields in the returned `{ status, score }` object
- Whether `getGapsSummary` returns empty array or null when no verification file exists

</decisions>

<specifics>
## Specific Ideas

- `findFirstIncompletePhase` replicates the bash pattern: call `roadmap analyze`, iterate phases in order, check each for completion via `cmdPhaseStatus` internals, return first where `phase_complete === false`
- `nextIncompletePhase` does the same but starts searching after `currentPhase` using `comparePhaseNum` for ordering
- `getVerificationStatus` replaces the bash pattern that calls `node gsd-tools.cjs frontmatter get <file> --field status` and `--field score` -- the CJS version calls `extractFrontmatter` directly
- `getGapsSummary` replaces the bash `sed -n '/^## .*[Gg]ap/,/^## [^G]/p'` pattern with JS string section extraction
- `CONFIG_DEFAULTS` keys use the dot-notation format matching how `config-get` traverses nested config: `autopilot.circuit_breaker_threshold`, `autopilot.max_debug_retries`, `autopilot.max_audit_fix_iterations`, `autopilot.auto_accept_tech_debt`
- The `config-get` fallback should occur when the key lookup would otherwise call `error()` (key not found) -- instead, check `CONFIG_DEFAULTS` before erroring

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `phase.cjs` (`cmdPhaseStatus`): Contains the full phase completion detection logic (lines 873-988) with `.completed` marker, ROADMAP checkbox, and artifact-complete checks -- this is the code to extract into `computePhaseStatus`
- `roadmap.cjs` (`cmdRoadmapAnalyze`): Parses all phases from ROADMAP.md with disk status -- used by new phase navigation functions to get the ordered phase list
- `frontmatter.cjs` (`extractFrontmatter`): Already used by verify.cjs -- the new `getVerificationStatus` calls it directly instead of shelling out
- `config.cjs` (`cmdConfigGet`): Current implementation errors when key not found -- needs modification to check `CONFIG_DEFAULTS` before erroring
- `core.cjs` (`findPhaseInternal`, `comparePhaseNum`, `normalizePhaseName`): Used throughout for phase resolution and ordering

### Established Patterns
- All CJS command functions follow `cmd*(cwd, ...args, raw)` signature with `output(result, raw, plainText)` for results
- New non-command functions (like `computePhaseStatus`) should return values directly rather than using `output()` -- they are internal helpers
- Module exports listed at bottom of file in `module.exports = { ... }`
- `gsd-tools.cjs` dispatch uses a switch statement with subcommand routing (e.g., `case 'phase':` then `if (subcommand === 'find-next')`)
- The `verify` case in gsd-tools.cjs currently handles: plan-structure, phase-completeness, references, commits, artifacts, key-links -- `status` and `gaps` are added as new subcommands

### Integration Points
- `gsd-tools.cjs` line 336-353: The `verify` switch case needs two new branches for `status` and `gaps`
- `gsd-tools.cjs` line 436-455: The `phase` switch case needs a new `find-next` branch
- `config.cjs` lines 139-173: `cmdConfigGet` needs fallback to `CONFIG_DEFAULTS` before the `error()` call at line 169
- `phase.cjs` lines 873-988: `cmdPhaseStatus` body needs refactoring to extract `computePhaseStatus`
- `phase.cjs` line 990-1000: `module.exports` needs `findFirstIncompletePhase` and `nextIncompletePhase` added
- `verify.cjs` line 781-791: `module.exports` needs `getVerificationStatus` and `getGapsSummary` added

</code_context>

<deferred>
## Deferred Ideas

- Tests for all new functions (deferred to Phase 51 per roadmap)
- zx script that imports these functions (deferred to Phase 48)
- Migration/fallback wiring (deferred to Phase 50)
- Exporting `computePhaseStatus` publicly (only needed internally for now)

</deferred>

---

*Phase: 47-cjs-module-extensions*
*Context gathered: 2026-03-10 via auto-context*
