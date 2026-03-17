# Phase 65: Structure and State Checks - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Implement all structure and state consistency checks in `validation.cjs` so it becomes the single source of truth for detecting missing files, invalid config, phase directory naming issues, orphaned plans, and STATE.md/ROADMAP.md mismatches. This phase adds concrete check implementations to the registry skeleton created in Phase 64 -- no consumer migration or auto-repair yet.

</domain>

<decisions>
## Implementation Decisions

### Check Implementations to Migrate

- STRUCT-01: File existence checks for `.planning/`, PROJECT.md, ROADMAP.md, STATE.md, config.json, `phases/` -- migrated from `gatherHealthData()` checks 1-5 and `cmdValidateHealth()` checks 1-4 (from REQUIREMENTS.md STRUCT-01)
- STRUCT-02: Config JSON validation -- parse validity, `model_profile` enum check against `['quality', 'balanced', 'budget']`, unknown key detection against `knownKeys` list (from REQUIREMENTS.md STRUCT-02)
- STRUCT-03: Phase directory naming -- directories must match `NN-name` format regex `/^\d{2}(?:\.\d+)*-[\w-]+$/` (from REQUIREMENTS.md STRUCT-03)
- STRUCT-04: Orphaned plan detection -- PLAN.md files without corresponding SUMMARY.md (from REQUIREMENTS.md STRUCT-04)
- STATE-01: STATE.md `milestone_name` frontmatter field must match ROADMAP.md active milestone name (from REQUIREMENTS.md STATE-01)
- STATE-02: STATE.md `completed_phases` count must match ROADMAP.md `[x]` count for current milestone (from REQUIREMENTS.md STATE-02)
- STATE-03: STATE.md `total_phases` must match ROADMAP.md phase count for current milestone (from REQUIREMENTS.md STATE-03)
- STATE-04: STATE.md `status` field consistency -- `completed` only when all phases checked, `active` when unchecked phases remain (from REQUIREMENTS.md STATE-04)

### Error Code Mapping

- Preserve existing error codes from cli.cjs/verify.cjs: E001 (.planning/ missing), E002 (PROJECT.md missing), E003 (ROADMAP.md missing), E004 (STATE.md missing), E005 (config.json parse error) (from REQUIREMENTS.md INT-06)
- Map new check IDs to existing codes: STRUCT-01 covers E001-E004, STRUCT-02 covers E005/W003/W004, STRUCT-03 covers W005, STRUCT-04 covers I001 (Claude's Decision: backward-compatible codes ensure `gsd health` output stability when Phase 67 migrates consumers)
- STATE checks get new codes since no existing codes cover milestone name/count mismatches (Claude's Decision: existing W002/W005-W009 are taken; STATE checks are new functionality not present in current cli.cjs)

### Severity Assignments

- Missing `.planning/` directory: error -- nothing else can run (from cli.cjs E001 precedent)
- Missing PROJECT.md, ROADMAP.md: error (from cli.cjs E002/E003 precedent)
- Missing STATE.md: error (from cli.cjs E004 precedent)
- Missing config.json: warning -- defaults apply (from cli.cjs W003 precedent)
- Missing `phases/` directory: warning (Claude's Decision: project can exist without phases yet; not a hard failure)
- Config parse error: error (from cli.cjs E005 precedent)
- Invalid `model_profile` enum: warning (from cli.cjs W004 precedent)
- Unknown config keys: info (from cli.cjs I001 precedent)
- Phase directory naming violation: warning (from verify.cjs W005 precedent)
- PLAN without SUMMARY: info (from verify.cjs I001 precedent -- may be in progress)
- STATE.md milestone name mismatch: error (from ROADMAP.md success criterion 3)
- STATE.md phase count disagreement: warning (from ROADMAP.md success criterion 4)
- STATE.md status inconsistency: warning (Claude's Decision: status field is informational; counts/names are more authoritative)

### Check Registry Structure

- Each check is a separate object in the `checks` array with `{ id, category, severity, check }` shape (from Phase 64 registry pattern)
- STRUCT-01 is split into multiple registry entries -- one per file/directory being checked (Claude's Decision: granular check IDs allow consumers to identify exactly which file is missing rather than a single pass/fail for all structure)
- STATE checks require both STATE.md and ROADMAP.md to exist; skip gracefully if either is absent (Claude's Decision: avoids cascading errors when structure checks already report the missing files)
- Config validation is a single check that reports multiple issues via a combined message (Claude's Decision: config is one logical unit; splitting parse-error vs enum-error into separate checks would duplicate the file read)

### State Parsing Approach

- Use `frontmatter.cjs` `extractFrontmatter()` to parse STATE.md frontmatter for `milestone_name`, `progress.completed_phases`, `progress.total_phases`, `status` (from Phase 64 code context)
- Use `core.cjs` `getMilestoneInfo()` to get active milestone name from ROADMAP.md (from codebase pattern)
- Parse ROADMAP.md `[x]` and `[ ]` checkboxes to count completed/total phases for current milestone (Claude's Decision: matches existing cli.cjs/verify.cjs approach; no new parsing library needed)

### Known Keys List for Config Validation

- Import or duplicate the `knownKeys` array from cli.cjs `gatherHealthData()`: `['model_profile', 'commit_docs', 'search_gitignored', 'branching_strategy', 'workflow', 'parallelization', 'autopilot', 'mode', 'depth', 'model_overrides', 'research', 'plan_checker', 'verifier', 'nyquist_validation', 'test']` (from cli.cjs line 521-523)
- Extract to a shared constant in validation.cjs rather than importing from cli.cjs (Claude's Decision: validation.cjs should not depend on cli.cjs; cli.cjs will eventually delegate to validation.cjs in Phase 67)

### Claude's Discretion
- Internal helper functions for reading/parsing STATE.md and ROADMAP.md
- Whether to use early-return or accumulate-all pattern within individual check functions
- Exact diagnostic message wording for new STATE checks
- Order of checks within the registry array
- Whether STRUCT-01 file checks short-circuit (skip remaining checks if .planning/ missing) or report all failures

</decisions>

<specifics>
## Specific Ideas

- The existing `gatherHealthData()` in cli.cjs (lines 409-595) and `cmdValidateHealth()` in verify.cjs (lines 535-797) contain all the check logic to migrate -- these are the source-of-truth implementations
- STATE.md frontmatter uses YAML format with nested `progress:` block containing `total_phases`, `completed_phases`, `total_plans`, `completed_plans`
- STATE.md body contains "Milestone: v2.6 Unified Validation Module" and "Phase: 64 of 68" -- the frontmatter `milestone_name` is the canonical field for STATE-01
- ROADMAP.md active milestone heading format: `### ... v2.6 Unified Validation Module (In Progress)` -- `getMilestoneInfo()` parses this
- ROADMAP.md phase checkboxes: `- [x] **Phase 64:` (completed) vs `- [ ] **Phase 65:` (incomplete)
- The `validProfiles` enum `['quality', 'balanced', 'budget']` appears in both cli.cjs and verify.cjs -- consolidate into validation.cjs

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validation.cjs`: Phase 64 skeleton with `checks` array, `runChecks()`, `validateProjectHealth()` -- new checks append to the `checks` array
- `frontmatter.cjs`: `extractFrontmatter()` for parsing STATE.md YAML frontmatter
- `core.cjs`: `getMilestoneInfo()` for extracting active milestone name/version from ROADMAP.md
- `core.cjs`: `safeReadFile()` for graceful file reads with fallback

### Established Patterns
- Check functions receive `(cwd)` and return `{ passed, message }` (from Phase 64 STRUCT-01 check)
- `fs.existsSync()` for file/directory presence checks throughout cli.cjs and verify.cjs
- Phase directory regex: `/^\d{2}(?:\.\d+)*-[\w-]+$/` from verify.cjs line 642
- Known keys validation: iterate `Object.keys(parsed)` and check against allowed list (cli.cjs lines 521-528)

### Integration Points
- `validation.cjs` `checks` array: new check objects append here (Phase 64 created the array with one STRUCT-01 entry)
- `module.exports`: add any new exported functions (e.g., category-specific validators for Phase 67 consumer migration)
- No changes to cli.cjs, verify.cjs, or gsd-tools.cjs in this phase -- those come in Phase 67

</code_context>

<deferred>
## Deferred Ideas

- Phase navigation checks using `computePhaseStatus()` and `findFirstIncompletePhase()` (Phase 66)
- Autopilot readiness checks with deterministic step detection (Phase 66)
- Auto-repair logic for stale STATE.md counts and missing phase directories (Phase 67)
- Consumer migration: cli.cjs `gatherHealthData()` and verify.cjs `cmdValidateHealth()` delegation (Phase 67)
- Dead code removal from cli.cjs and verify.cjs after migration (Phase 67)
- Test suite for all check categories (Phase 68)
- `KNOWN_SETTINGS_KEYS` consolidation with cli.cjs (Phase 67 -- when cli.cjs imports from validation.cjs)

</deferred>

---

*Phase: 65-structure-and-state-checks*
*Context gathered: 2026-03-15 via auto-context*
