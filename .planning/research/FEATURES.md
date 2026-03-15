# Feature Landscape: Unified Validation Module

**Domain:** CLI health-check and pre-flight validation for autonomous coding orchestrator
**Researched:** 2026-03-15
**Overall confidence:** HIGH (existing codebase has two separate validation implementations to unify; patterns well-understood from Kubernetes preflight checks, CLI health frameworks, and the project's own prior art)

## Table Stakes

Features users expect. Missing any of these means the unified module fails its core purpose of eliminating the health/autopilot validation divergence.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Structured check result objects | Both `gatherHealthData()` in cli.cjs and `cmdValidateHealth()` in verify.cjs already return structured objects with status/errors/warnings/info. The unified module must preserve this contract -- consumers parse these objects. | LOW | None | Standard shape: `{ id, category, severity, passed, message, fix, repairable }` per check. Aggregate to `{ status: 'healthy'|'degraded'|'broken', checks, errors, warnings, info }`. |
| Check categories (structure, config, state, phase, readiness) | Current health checks are flat -- all checks run every time. Categorization lets autopilot run only "readiness" checks and `gsd health` run all categories. Without categories, unified module is just code-moved, not improved. | LOW | None | Categories: `structure` (file/dir existence), `config` (JSON validity, schema), `state` (STATE.md consistency), `phase` (disk-vs-roadmap sync, naming), `readiness` (autopilot-specific: incomplete phases exist, deterministic next step). |
| File/directory existence checks | Already implemented in both cli.cjs (HLTH-01) and verify.cjs (Checks 1-4). These are the foundation -- `.planning/`, PROJECT.md, ROADMAP.md, STATE.md, config.json, `phases/`. | LOW | `fs.existsSync` | Move from both locations into single function. Early-exit pattern: if `.planning/` missing, skip everything else. |
| Config JSON validation | Already implemented: parse JSON, validate `model_profile` enum, detect unknown keys. Config validation must survive the move. | LOW | `fs.readFileSync`, `JSON.parse` | Checks E005 (parse error), W004 (invalid profile), I001 (unknown keys). |
| STATE.md phase reference validation | Already implemented: extract phase refs from STATE.md, compare against disk phase directories. Detects stale references. | LOW | Phase directory listing | Checks W002 (phase ref not on disk). |
| STATE.md vs ROADMAP.md cross-check | Already partially implemented in cli.cjs (current phase vs roadmap completion status) and verify.cjs (Check 8 inlines subset of consistency checks). Must be unified. | MED | STATE.md parsing, ROADMAP.md parsing | Current phase marked complete in roadmap = stale STATE.md. Phase count mismatch = state drift. |
| Phase directory naming validation | Already implemented in verify.cjs Check 6: directories must match `NN-name` format. | LOW | `fs.readdirSync` | Check W005 in current verify.cjs. |
| Orphaned plan detection | Already implemented in verify.cjs Check 7: PLAN.md files without corresponding SUMMARY.md. Informational, not error. | LOW | Phase file listing | Check I001 in current verify.cjs. |
| Consistency validation (disk vs roadmap phase sync) | Already implemented in `cmdValidateConsistency()` in verify.cjs: phases on disk but not in roadmap, phases in roadmap but not on disk. Must be absorbed into unified module. | MED | `extractPhaseNumbers()` from phase.cjs, disk listing | Currently a separate command; should become a check category in the unified module. |
| `gsd health` backward-compatible output | `gsd health` currently outputs ANSI-formatted status with check marks, error/warning lists. `gsd health --json` outputs structured JSON. Both must continue working unchanged after refactoring to delegate to validation.cjs. | LOW | cli.cjs `handleHealth()` | cli.cjs becomes a thin wrapper: call `validation.cjs`, format results for display. No user-facing change. |
| `gsd-tools.cjs validate` dispatch entry | v2.6 requirement explicitly calls for `validate` dispatch in gsd-tools.cjs so workflows can invoke validation programmatically. | LOW | gsd-tools.cjs routing | Already has `validate consistency` and `validate health` -- add `validate preflight` or extend existing. |
| Three-tier severity model (error/warning/info) | Both existing implementations use this. Error = broken, Warning = degraded, Info = informational. Aggregate status derived from highest severity. | LOW | None | Matches Kubernetes preflight pattern (fail/warn/pass). Well-established convention. |
| Check IDs (error codes) | Both implementations use codes (E001-E005, W001-W005, I001). Unified module must preserve stable IDs for any consumers parsing them. | LOW | None | Codes must be backward-compatible. New checks get new codes. |

## Differentiators

Features that make the unified module genuinely better than "just move code to a new file."

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Phase status via `computePhaseStatus()` instead of regex | The core problem v2.6 solves. Current `gsd health` uses regex to parse STATE.md for phase info. Autopilot uses `computePhaseStatus()` from phase.cjs which inspects actual artifacts (CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md). Unified module uses the authoritative source. | MED | `phase.cjs: computePhaseStatus, findFirstIncompletePhase` | This is the reason the module exists. Regex-based parsing is fragile and drifts from actual state. Artifact-based inspection is ground truth. |
| Autopilot readiness checks | Checks specific to autopilot pre-flight: (1) at least one incomplete phase exists, (2) `findFirstIncompletePhase()` returns a result, (3) that phase has a deterministic next step (discuss/plan/execute/verify), (4) config has valid autopilot settings. Currently autopilot does ad-hoc checks (lines 60-83 of autopilot.mjs). | MED | `phase.cjs: findFirstIncompletePhase, computePhaseStatus`, `config.cjs: CONFIG_DEFAULTS` | Without these, autopilot discovers problems mid-run and crashes with unhelpful errors. Pre-flight catches them cleanly. |
| Auto-repair for trivially fixable issues | `--fix` flag on `gsd health` and auto-repair at autopilot startup. Repairs: create missing config.json with defaults, regenerate STATE.md from disk state, create missing phase directories referenced in roadmap. | MED | `state.cjs: writeStateMd`, `config.cjs: CONFIG_DEFAULTS`, `fs.mkdirSync` | Already partially spec'd in verify.cjs (`repairable` flag on issues, `repairs` array). Needs actual repair execution. Current code flags repairable issues but never repairs them. |
| Category-filtered check execution | `runChecks({ categories: ['readiness'] })` for autopilot vs `runChecks()` for full health. Avoids autopilot running 15+ checks when it only needs 4-5 readiness checks. | LOW | Check registration with category metadata | Each check function tagged with its category. Filter at runtime. |
| Unified check registry (array of check definitions) | Single array of `{ id, category, severity, check: fn, repair?: fn }` objects replaces the inline waterfall of if-statements in both implementations. Adding a check = adding one object to the array. | LOW | None | Pattern from Kubernetes preflight (Replicated Troubleshoot framework). Makes checks discoverable and testable in isolation. |
| Deterministic step detection | For each incomplete phase, determine what lifecycle step comes next (discuss, plan, execute, verify) based on artifact presence. If the step is ambiguous (e.g., partial artifacts), flag as warning. | MED | `computePhaseStatus()` result fields: `has_context`, `has_plan`, `has_summary`, `has_verification` | Autopilot currently derives this inline. Moving it to validation means the health command can show "Phase 64: ready for execute" which is useful for humans too. |
| Repair report in check results | When `--fix` runs repairs, include a `repairs` array in results documenting what was changed. `gsd health --fix --json` returns both the fixed issues and what was done. | LOW | Repair function return values | Important for auditability. Users need to know what auto-repair touched. |

## Anti-Features

Features to explicitly NOT build for the unified validation module.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Interactive repair prompts | PROJECT.md constraint: "Interactive prompts (inquirer-style) -- CLI is read-only for v1.3." Auto-repair is all-or-nothing via `--fix` flag. No "repair this? [y/n]" per issue. | `--fix` flag repairs all repairable issues. No flag = report only. |
| Deep content validation of markdown files | Validating that CONTEXT.md has "good enough" content, or that PLAN.md tasks are well-formed, is subjective and fragile. Health checks validate structure and consistency, not content quality. | Check file existence and required sections (already done). Leave content quality to the verify-phase workflow. |
| Network-dependent checks | Checking if Claude CLI is authenticated, if MCP servers are reachable, if npm registry is up. These are environment checks, not project health checks. They add latency and failure modes. | Autopilot already checks `which claude` separately (line 60-65 of autopilot.mjs). Keep that separate from project validation. |
| Automatic repair of non-trivial issues | Auto-repairing ROADMAP.md inconsistencies, fixing phase numbering gaps, or resolving conflicting state across files. These require human judgment. | Flag as errors/warnings with clear fix instructions. Only auto-repair: missing config (create default), stale STATE.md counts (regenerate from disk), missing phase dirs (mkdir). |
| Watch mode / continuous health monitoring | A `gsd health --watch` that polls for changes. Over-engineering for a tool that runs checks on-demand. | Run `gsd health` when you want to check. Autopilot runs pre-flight once at startup. |
| Plugin/extensible check system | Making it possible for users to register custom checks via config or JS files. Zero demand signal for this. Adds complexity. | Hard-code checks in validation.cjs. Adding a check is editing one file. |
| HTML/dashboard health reports | Visual reports beyond CLI output. The CLI table output and JSON flag cover all use cases. | `--json` for machine consumption. ANSI output for human consumption. |
| Repair history / audit log | Tracking what was repaired when across invocations. Overkill for a local CLI tool. | Repairs show in git diff. The repair report in check results covers single-invocation auditability. |

## Feature Dependencies

```
Check Registry (unified check definitions)
  --> Category-filtered execution (depends on checks having category metadata)
  --> Auto-repair (depends on checks having optional repair functions)
  --> Autopilot readiness checks (a category within the registry)

computePhaseStatus integration
  --> Deterministic step detection (needs artifact inspection results)
  --> Replaces regex-based phase parsing in cli.cjs health

gsd health refactor
  --> Delegates to validation.cjs (depends on unified module existing)
  --> --fix flag (depends on auto-repair in validation.cjs)
  --> Backward-compatible output (depends on same result shape)

Autopilot pre-flight
  --> Calls validation.cjs with category filter (depends on category-filtered execution)
  --> Auto-repairs before proceeding (depends on auto-repair)
  --> Replaces ad-hoc checks in autopilot.mjs lines 60-83
```

## MVP Recommendation

Prioritize in this order:

1. **Check registry with structured results** -- Foundation. Every other feature depends on checks being registered objects with category, severity, and optional repair function.

2. **Migrate all existing checks from cli.cjs and verify.cjs** -- Achieve code deduplication immediately. No new checks needed first; move what exists.

3. **Replace regex phase parsing with `computePhaseStatus()`** -- This is the v2.6 raison d'etre. Without this, the module is just a refactor, not an improvement.

4. **Category-filtered execution** -- Enables autopilot to call only readiness checks.

5. **Autopilot readiness checks** -- New check category: incomplete phase exists, deterministic next step, valid config.

6. **Auto-repair implementation** -- Wire up the `repairable` flags that already exist in verify.cjs to actual repair functions.

7. **`gsd health --fix` flag** -- Surface auto-repair to CLI users.

8. **Autopilot pre-flight integration** -- Replace ad-hoc checks in autopilot.mjs with `validation.runChecks({ categories: ['structure', 'readiness'], autoRepair: true })`.

Defer:
- **Deterministic step detection in health output** ("Phase 64: ready for execute"): Nice-to-have, not required for unification. Can be added after core module ships.

## Sources

- Existing codebase: `cli.cjs` gatherHealthData (lines 409-595), `verify.cjs` cmdValidateHealth (lines 535-665), `verify.cjs` cmdValidateConsistency (lines 416-533), `phase.cjs` computePhaseStatus/findFirstIncompletePhase, `autopilot.mjs` prerequisite checks (lines 58-83)
- [Replicated Troubleshoot Preflight Framework](https://troubleshoot.sh/docs/preflight/cli-usage/) -- pass/warn/fail severity model, category-based check organization
- [Google Distributed Cloud Preflight Checks](https://cloud.google.com/kubernetes-engine/distributed-cloud/vmware/docs/how-to/preflight-checks) -- granular skip flags, iterative validation, early-run best practice
- [Microservices Health Check API Pattern](https://microservices.io/patterns/observability/health-check-api.html) -- structured health endpoint returning component-level status
- PROJECT.md v2.6 requirements (lines 98-105)
