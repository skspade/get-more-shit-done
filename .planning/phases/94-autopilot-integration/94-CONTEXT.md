# Phase 94: Autopilot Integration - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The autopilot pipeline runs automated UAT after milestone audit passes and routes results into completion or gap closure. This phase adds `runAutomatedUAT()` to autopilot.mjs, wires UAT results into the gap closure loop, modifies `plan-milestone-gaps.md` to recognize MILESTONE-UAT.md as a gap source, and implements app startup management (HTTP polling for dev server readiness). No documentation updates (Phase 95).

</domain>

<decisions>
## Implementation Decisions

### runAutomatedUAT() Function (AUTO-01)
- New async function in autopilot.mjs following the `runMilestoneAudit()` pattern (line 862)
- Gates on `uat-config.yaml` existence via `fs.existsSync(path.join(PROJECT_DIR, '.planning', 'uat-config.yaml'))` -- returns 0 immediately if missing (non-web projects skip silently)
- Invokes workflow via `runStepWithRetry('/gsd:uat-auto', 'automated-uat')` for debug retry on crashes (AUTO-04)
- Reads MILESTONE-UAT.md frontmatter via `gsdTools('frontmatter', 'get', ...)` to get `status` field
- Returns 0 (passed), 10 (gaps_found), or 1 (error) -- identical exit code contract to `runMilestoneAudit()`

### Autopilot Flow Integration (AUTO-02, AUTO-03)
- Extract an `auditAndUAT()` helper function to eliminate 3-site duplication where audit-pass leads to completion (Claude's Decision: architecture doc explicitly recommends this refactor to avoid 3x code duplication)
- `auditAndUAT()` runs `runMilestoneAudit()`, then if audit returns 0, runs `runAutomatedUAT()`, and returns the combined result (0/10/1)
- Three insertion sites replaced: lines ~1088 (all phases complete on startup), ~1165 (phases complete during main loop), ~1004 (after gap closure re-audit)
- UAT pass (0) proceeds to `runMilestoneCompletion()`
- UAT gaps (10) feeds into `runGapClosureLoop()` for automatic fix cycles
- UAT crash (non-zero from `runStepWithRetry`) handled by existing debug retry mechanism

### Gap Closure Wiring (AUTO-05)
- Modify `plan-milestone-gaps.md` to scan for MILESTONE-UAT.md alongside MILESTONE-AUDIT.md
- Add a second file scan: `ls -t .planning/MILESTONE-UAT.md 2>/dev/null` after the existing audit file scan
- Gaps from MILESTONE-UAT.md use the identical schema (`truth`, `status`, `reason`, `severity`) so existing gap-to-phase mapping works unchanged
- Merge UAT gaps with audit gaps before grouping into fix phases

### App Startup Management (WKFL-03)
- App startup is handled by the `uat-auto.md` workflow (Phase 92 already implements Step 4: Start App)
- The autopilot `runAutomatedUAT()` function does NOT manage app startup -- it delegates entirely to the workflow (Claude's Decision: follows anti-pattern 5 from architecture doc -- autopilot gates on config existence only, workflow handles the rest)

### Evidence and Reporting (EVID-01, EVID-02, EVID-03, EVID-04)
- Screenshots are saved by the uat-auto workflow to `.planning/uat-evidence/{milestone}/` -- no changes needed in autopilot.mjs
- Failed tests include observed vs expected descriptions in MILESTONE-UAT.md gaps section -- handled by the workflow
- MILESTONE-UAT.md gaps use identical YAML schema to MILESTONE-AUDIT.md -- format already defined in Phase 91
- MILESTONE-UAT.md is committed to git by the uat-auto workflow (Step 7 in the workflow) -- no additional commit logic needed in autopilot.mjs
- Evidence PNGs are committed to git (per design doc: "they're small, milestone-scoped, and valuable for debugging")

### Gap Closure Re-UAT Loop
- After gap closure fixes are executed and re-audit passes, UAT runs again via `auditAndUAT()` (Claude's Decision: re-UAT after gap closure ensures fixes actually resolve the UI issues, not just the audit gaps -- this is implicit in the `auditAndUAT()` helper design)
- No limit on UAT-triggered gap closure iterations beyond the existing `max_audit_fix_iterations` config (Claude's Decision: the existing circuit breaker handles runaway; adding a separate UAT limit would add complexity without clear benefit)

### Tests
- Source-text structural tests for autopilot.mjs verifying `runAutomatedUAT` function exists and follows expected patterns (Claude's Decision: follows established v2.3 pattern -- autopilot.mjs uses ESM/zx which cannot be required in CJS tests, so source text assertions are used)
- Unit tests for the `auditAndUAT()` helper logic are not feasible due to ESM/zx constraints -- structural tests verify the function exists and has the expected shape

### Claude's Discretion
- Exact wording of log messages for UAT skip, start, pass, and fail
- Banner text styling for UAT-related banners
- Whether `auditAndUAT()` is defined before or after `runMilestoneAudit()` in the file
- Exact error message when MILESTONE-UAT.md is missing after workflow execution

</decisions>

<specifics>
## Specific Ideas

**runAutomatedUAT() structure (from architecture doc):**
```javascript
async function runAutomatedUAT() {
  const configPath = path.join(PROJECT_DIR, '.planning', 'uat-config.yaml');
  if (!fs.existsSync(configPath)) {
    logMsg('UAT: skipped (no uat-config.yaml)');
    return 0;
  }
  printBanner('AUTOMATED UAT');
  const uatExit = await runStepWithRetry('/gsd:uat-auto', 'automated-uat');
  if (uatExit !== 0) {
    logMsg(`UAT: workflow failed exit=${uatExit}`);
    return 1;
  }
  const uatFile = path.join(PROJECT_DIR, '.planning', 'MILESTONE-UAT.md');
  if (!fs.existsSync(uatFile)) {
    logMsg('UAT: no MILESTONE-UAT.md produced');
    return 1;
  }
  const uatStatus = (await gsdTools('frontmatter', 'get', uatFile, '--field', 'status', '--raw')).trim();
  logMsg(`UAT: result=${uatStatus}`);
  switch (uatStatus) {
    case 'passed': printBanner('UAT PASSED'); return 0;
    case 'gaps_found': printBanner('UAT: FAILURES FOUND'); return 10;
    default: return 1;
  }
}
```

**auditAndUAT() helper (from architecture doc):**
```javascript
async function auditAndUAT() {
  const auditResult = await runMilestoneAudit();
  if (auditResult !== 0) return auditResult;
  const uatResult = await runAutomatedUAT();
  return uatResult;
}
```

**plan-milestone-gaps.md modification:**
The gap discovery step should scan for both files:
- `.planning/v*-MILESTONE-AUDIT.md` (existing)
- `.planning/MILESTONE-UAT.md` (new)
Merge gaps from both sources before creating fix phases.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runMilestoneAudit()` (autopilot.mjs line 862): Direct model for `runAutomatedUAT()` -- same pattern of spawn workflow, parse frontmatter status, return exit code
- `runStepWithRetry()` (autopilot.mjs line 565): Debug retry wrapper -- reuse for UAT workflow invocation to handle crashes (AUTO-04)
- `gsdTools()` helper: Used throughout autopilot.mjs for frontmatter parsing -- reuse for reading MILESTONE-UAT.md status
- `printBanner()` / `logMsg()`: Existing logging utilities -- reuse for UAT banners and log entries
- `uat.cjs`: Config validation module created in Phase 91 -- `loadUatConfig()` used by the workflow, not autopilot
- `uat-auto.md` workflow: Created in Phase 92, enhanced in Phase 93 -- the workflow autopilot spawns

### Established Patterns
- **Exit code contract (0/10/1)**: `runMilestoneAudit()` returns 0 for pass, 10 for gaps, 1 for error. `runAutomatedUAT()` uses the identical contract.
- **Frontmatter-based result communication**: Autopilot spawns a Claude session, the session writes a markdown file with YAML frontmatter, autopilot reads the status field.
- **Config-gated optional features**: `fs.existsSync()` check before running -- non-web projects skip silently.
- **Source-text structural tests**: autopilot.mjs tests (v2.3) read the source file and assert on function names, patterns, and imports rather than requiring the ESM module.

### Integration Points
- `autopilot.mjs` lines ~1088, ~1165, ~1004: Three sites where audit-pass leads to completion -- all three replaced with `auditAndUAT()` helper
- `plan-milestone-gaps.md` line 15: Gap file discovery -- add MILESTONE-UAT.md scanning
- `runGapClosureLoop()` line 1004: Re-audit after gap closure -- `auditAndUAT()` replaces `runMilestoneAudit()` so re-UAT happens automatically

</code_context>

<deferred>
## Deferred Ideas

- **Documentation updates** -- Phase 95 handles help.md, USER-GUIDE.md, README.md
- **Phase-level automated UAT (PLVL-01/02)** -- v2 requirement, post-v3.1
- **UAT result trending (TRND-01)** -- v2 requirement, post-v3.1
- **Milestone archival cleanup for uat-evidence/** -- handled during complete-milestone workflow, not this phase
- **Token budget for UAT session** -- timeout-based limits are sufficient per design doc
- **Individual test retries** -- gap closure fixes the app then re-runs full UAT

</deferred>

---

*Phase: 94-autopilot-integration*
*Context gathered: 2026-03-22 via auto-context*
