# Phase 66: Phase Navigation and Autopilot Readiness - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Add phase navigation and autopilot readiness checks to `validation.cjs` so that phase lifecycle truth comes from `computePhaseStatus()` artifact inspection rather than regex parsing of STATE.md, and autopilot can programmatically determine whether it is safe to proceed. This phase adds NAV and READY category checks to the registry created in Phase 64 and populated with STRUCT/STATE checks in Phase 65.

</domain>

<decisions>
## Implementation Decisions

### Phase Navigation Checks (NAV category)

- NAV-01: Phase status determined by calling `computePhaseStatus()` from `phase.cjs` -- artifact-based inspection is the single source of truth (from REQUIREMENTS.md NAV-01)
- NAV-02: When milestone is active, `findFirstIncompletePhase()` must return a valid phase number -- validates that navigation works (from REQUIREMENTS.md NAV-02)
- NAV-03: Each incomplete phase must report a deterministic lifecycle step from `computePhaseStatus()` -- one of discuss/plan/execute/verify (from REQUIREMENTS.md NAV-03)
- NAV-04: Detect orphan phase directories (on disk but not in ROADMAP) and missing directories (in ROADMAP but not on disk) (from REQUIREMENTS.md NAV-04)
- NAV-01 check imports `computePhaseStatus` and `findFirstIncompletePhase` from `phase.cjs` and calls them directly (from Phase 64 dependency direction constraint)
- NAV-04 compares `extractPhaseNumbers()` output against `fs.readdirSync()` of the phases directory (Claude's Decision: both data sources already exist in phase.cjs and filesystem -- no new parsing needed)

### Autopilot Readiness Checks (READY category)

- READY-01: At least one incomplete phase exists when milestone is active -- uses `findFirstIncompletePhase()` result (from REQUIREMENTS.md READY-01)
- READY-02: Next incomplete phase has a deterministic step -- `computePhaseStatus()` returns a step in `['discuss', 'plan', 'execute', 'verify']`, not null or ambiguous (from REQUIREMENTS.md READY-02)
- READY-03: No truncated/empty artifacts that could confuse step inference -- CONTEXT.md, PLAN.md files must have non-trivial content (from REQUIREMENTS.md READY-03)
- READY-04: Config has valid autopilot settings -- validates against `KNOWN_SETTINGS_KEYS` from `config.cjs` (from REQUIREMENTS.md READY-04)
- Readiness checks populate `nextPhase` and `phaseStep` fields on the `ValidationResult` (from Phase 64 result type contract)

### Severity Assignments

- NAV-01 (status not artifact-based): not a check that fires -- it is the approach used by NAV-02/NAV-03 (Claude's Decision: NAV-01 is a design constraint satisfied by using computePhaseStatus in the other checks, not a standalone pass/fail check)
- NAV-02 (no incomplete phase found when milestone active): warning (Claude's Decision: milestone may legitimately be complete; downstream checks handle that case)
- NAV-03 (ambiguous lifecycle step): error -- autopilot cannot proceed without a deterministic step (from success criterion 2)
- NAV-04 orphan directories: warning (Claude's Decision: orphans do not block execution, they indicate drift)
- NAV-04 missing directories: warning with repairable flag for Phase 67 (Claude's Decision: missing dirs are auto-creatable per existing `cmdPhaseStatus` pattern)
- READY-01 (no incomplete phases): info (Claude's Decision: this is normal when milestone is complete -- not a failure)
- READY-02 (no deterministic step): error -- autopilot must know what to do next (from success criterion 4)
- READY-03 (truncated artifacts): error -- corrupted state is unsafe for autopilot (from success criterion 4)
- READY-04 (invalid config): warning (Claude's Decision: autopilot has CONFIG_DEFAULTS fallback, so invalid settings degrade but do not block)

### Truncated Artifact Detection (READY-03)

- Check CONTEXT.md files are non-empty (> 50 bytes) when they exist (Claude's Decision: 50 bytes is a minimal threshold that catches truncated/empty files while allowing legitimate small files)
- Check PLAN.md files contain at least one `<task` tag or `## Task` heading when they exist (Claude's Decision: a plan without tasks is truncated or malformed -- reuses existing detection pattern from `cmdPhasePlanIndex`)
- Only check artifacts in the next incomplete phase -- do not scan all phases (Claude's Decision: readiness is about the next step, not historical state; scanning all phases adds unnecessary cost)

### Config Validation (READY-04)

- Import `CONFIG_DEFAULTS` from `config.cjs` to get the canonical autopilot setting keys (from Phase 64 code context)
- Validate that if `autopilot` section exists in config.json, its keys are recognized subkeys of the CONFIG_DEFAULTS dotted paths (Claude's Decision: reuses existing config.cjs pattern rather than duplicating key lists)
- Numeric settings (stall_timeout_ms, thresholds) must be positive integers when present (Claude's Decision: zero or negative values would cause immediate stall detection or infinite retries)

### Populating nextPhase and phaseStep

- When readiness checks run, `nextPhase` is set to the result of `findFirstIncompletePhase()` (from Phase 64 result type)
- `phaseStep` is set to the `step` field from `computePhaseStatus()` on the next phase (from Phase 64 result type)
- If no incomplete phase exists, both fields remain null (Claude's Decision: null signals "nothing to do" rather than an error)

### Disk vs ROADMAP Phase Sync (NAV-04)

- Extract phase numbers from ROADMAP.md via `extractPhaseNumbers()` (from phase.cjs)
- Extract phase numbers from disk by reading the phases directory and parsing directory name prefixes (Claude's Decision: reuses the existing `PHASE_DIR_REGEX` from validation.cjs for consistency)
- Only compare phases within the active milestone section of ROADMAP.md, not completed/archived milestones (Claude's Decision: completed milestones have phases in `<details>` blocks and may be archived -- comparing against all phases would produce false orphan detections)

### Claude's Discretion
- Internal helper function organization for NAV vs READY checks
- Exact wording of diagnostic messages for each check
- Whether to combine NAV-02 and NAV-03 into a single check function or keep them separate
- Order of READY checks within the registry array

</decisions>

<specifics>
## Specific Ideas

- `computePhaseStatus()` in phase.cjs already returns `{ step, has_context, has_plans, plan_count, summary_count, all_plans_have_summaries, has_verification, phase_complete }` -- the NAV checks wrap this existing function
- `findFirstIncompletePhase()` iterates all roadmap phases and returns the first where `phase_complete` is false -- this is the canonical "next phase" for autopilot
- `extractPhaseNumbers()` parses both heading format (`### Phase 73:`) and bullet format (`- [ ] **Phase 73:`) from ROADMAP.md
- The `countRoadmapPhases()` helper in validation.cjs already strips `<details>` blocks to count only active milestone phases -- NAV-04 should follow the same pattern
- `CONFIG_DEFAULTS` in config.cjs uses dotted path keys like `autopilot.circuit_breaker_threshold` -- validation should check the `autopilot` object in config.json maps to these subkeys
- Success criterion 4 explicitly lists four conditions: incomplete phases exist, deterministic step, no truncated artifacts, valid config -- each maps to READY-01 through READY-04

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `phase.cjs`: `computePhaseStatus()`, `findFirstIncompletePhase()`, `nextIncompletePhase()`, `extractPhaseNumbers()` -- canonical phase lifecycle functions that NAV checks delegate to
- `validation.cjs`: Phase 64 skeleton + Phase 65 STRUCT/STATE checks -- NAV and READY checks append to the `checks` array
- `config.cjs`: `CONFIG_DEFAULTS` object with dotted-path autopilot settings for READY-04 validation
- `core.cjs`: `findPhaseInternal()`, `getMilestoneInfo()` for locating phase directories and active milestone

### Established Patterns
- Check functions receive `(cwd)` and return `{ passed, message }`, optionally with `severity` override (from Phase 65 checks)
- Checks that depend on missing prerequisites skip gracefully with `passed: true` (from STATE-01 through STATE-04 pattern)
- `countRoadmapPhases()` strips `<details>` blocks to isolate active milestone phases
- `PHASE_DIR_REGEX` (`/^\d{2}(?:\.\d+)*-[\w-]+$/`) for parsing phase directory names

### Integration Points
- `validation.cjs` `checks` array: NAV and READY check objects append here
- `validateProjectHealth()` result: `nextPhase` and `phaseStep` fields populated by READY checks
- `module.exports`: no new exports needed -- checks register via the array, results flow through `validateProjectHealth()`
- No changes to phase.cjs, config.cjs, cli.cjs, or autopilot.mjs in this phase

</code_context>

<deferred>
## Deferred Ideas

- Auto-repair for missing phase directories (Phase 67 -- REPAIR-02)
- Consumer migration: autopilot.mjs pre-flight delegation to `validateProjectHealth()` (Phase 67 -- INT-03)
- `gsd health` output showing deterministic step per phase (future -- DIAG-01)
- `gsd-tools.cjs validate` dispatch entry (Phase 67 -- INT-04)
- Test suite for NAV and READY check categories (Phase 68 -- TEST-01)
- Dead code removal from autopilot.mjs ad-hoc pre-flight checks (Phase 67 -- INT-05)

</deferred>

---

*Phase: 66-phase-navigation-and-autopilot-readiness*
*Context gathered: 2026-03-15 via auto-context*
