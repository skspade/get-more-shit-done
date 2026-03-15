# Project Research Summary

**Project:** GSD Autopilot v2.6 — Unified Validation Module
**Domain:** CJS CLI tooling refactor — validation module unification
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

This milestone is a focused refactoring project, not a greenfield build. Three separate implementations of health/validation logic exist across `cli.cjs` (`gatherHealthData`), `verify.cjs` (`cmdValidateHealth`), and `autopilot.mjs` (ad-hoc pre-flight checks). They use different approaches — regex-based STATE.md parsing vs. artifact inspection via `computePhaseStatus()` — and produce subtly different results for the same project state. The research unanimously confirms that the right approach is to create a single `validation.cjs` module that all three consumers delegate to, with `computePhaseStatus()` from `phase.cjs` as the authoritative source of phase lifecycle truth.

The recommended implementation requires zero new dependencies: Node.js built-ins, the existing CJS module ecosystem, and the `node:test` suite. The module exposes composable check functions (`checkStructure`, `checkConfig`, `checkStateConsistency`, `checkPhaseSync`, `checkAutopilotReadiness`) and a top-level `runChecks()` orchestrator. Auto-repair is strictly separated from detection: check functions are pure/read-only, `autoRepair()` is a separate function that takes detected issues as input. This avoids the most dangerous pitfall — silent state mutation during autopilot pre-flight.

The primary risk is regression: changing the output format of `gsd health --json` would silently break any workflow that parses health output. The mitigation is explicit: add new artifact-based checks additively (as new warning codes W006+) rather than replacing existing regex checks, write a snapshot test for the current JSON output shape before touching any logic, and preserve backward-compatible exports in `verify.cjs` for any consumers that import it directly. The build order matters — create `validation.cjs` as pure additive code first, then migrate consumers, then delete dead code.

## Key Findings

### Recommended Stack

The entire milestone requires zero new dependencies. `validation.cjs` is a CJS module (`module.exports = { ... }`) that uses synchronous `node:fs`, `node:path`, and imports from five existing internal modules: `core.cjs`, `phase.cjs`, `frontmatter.cjs`, `state.cjs`, and `config.cjs`. The project's existing test infrastructure (`node:test`, `node:assert`, `helpers.cjs`) handles all testing. Coverage via `c8` picks up the new file automatically.

See `.planning/research/STACK.md` for full stack details.

**Core technologies:**
- Node.js CJS (`require`/`module.exports`): module format — matches all existing `lib/*.cjs` modules; no ESM conversion needed
- `node:fs` (sync): file I/O — validation runs sequentially at startup; async provides no benefit and adds complexity
- `node:path`: path resolution — standard across all modules; no alternatives
- `node:test` + `node:assert`: test runner — already used for all 750 tests; no new framework
- `c8`: coverage — already in devDependencies; picks up `validation.cjs` automatically

### Expected Features

The unified module is a consolidation, not a feature expansion. The table stakes are all checks that currently exist across the three implementations, now in one place. The differentiators are the improvements that make the refactor worth doing — specifically, replacing regex phase parsing with `computePhaseStatus()` and adding autopilot readiness as a proper check category.

See `.planning/research/FEATURES.md` for full feature analysis with the MVP priority ordering.

**Must have (table stakes):**
- Structured check result objects with stable error codes (E001-E005, W001-W005, I001) — existing consumers parse these
- File/directory existence checks (`checkStructure`) — the foundation; early-exit if `.planning/` missing
- Config JSON validation (`checkConfig`) — parse, known keys, valid enum values
- STATE.md phase reference validation (`checkStateConsistency`) — stale references, cross-checks with ROADMAP.md
- Phase directory naming and disk-vs-roadmap sync (`checkPhaseSync`) — consolidates verify.cjs checks 6-8
- `gsd health` backward-compatible output — cli.cjs stays as the formatting layer
- `gsd-tools.cjs validate` dispatch entry — `validate health`, `validate readiness`, `validate consistency`
- Three-tier severity model (error/warning/info) — aggregate status derived from highest severity

**Should have (differentiators):**
- Phase status via `computePhaseStatus()` instead of regex — the core reason this module exists
- Autopilot readiness checks — new category: incomplete phase exists, deterministic next step, valid config
- Auto-repair for trivially fixable issues — create missing config.json, regenerate STATE.md, mkdir missing phase dirs
- Category-filtered check execution — autopilot calls only `readiness` category, not all 15+ checks
- Unified check registry — array of `{ id, category, severity, check: fn, repair?: fn }` objects

**Defer (after v2.6):**
- Deterministic step detection in `gsd health` output ("Phase 64: ready for execute") — nice-to-have UX
- Plugin/extensible check system — zero demand signal; hard-coding is correct here
- Watch mode or dashboard reports — over-engineering

### Architecture Approach

The dependency direction is strict and non-negotiable: `validation.cjs` imports from `phase.cjs`, `core.cjs`, `frontmatter.cjs`, `state.cjs`, and `config.cjs`. The consumers (`cli.cjs`, `autopilot.mjs`, `gsd-tools.cjs`) import from `validation.cjs`. `verify.cjs` keeps its verification-specific functions and does NOT import from `validation.cjs` — and `validation.cjs` may optionally import `getVerificationStatus` from `verify.cjs` for enrichment (one-way only). The circular dependency risk between `validation.cjs` and `verify.cjs` is resolved by removing `cmdValidateHealth` from `verify.cjs` entirely and re-exporting it from `validation.cjs` for backward compatibility.

See `.planning/research/ARCHITECTURE.md` for the full dependency graph, data flow diagrams, and the check consolidation matrix.

**Major components:**
1. `validation.cjs` (NEW) — all structural/consistency checks, autopilot readiness, auto-repair; pure data returns, no formatting
2. `cli.cjs handleHealth()` (MODIFIED) — delegates to `validation.runChecks()`, keeps all ANSI formatting, adds `--fix` flag parsing
3. `autopilot.mjs` (MODIFIED) — adds `checkAutopilotReadiness()` call after existing `.planning/` check via `createRequire`
4. `gsd-tools.cjs` (MODIFIED) — routes `validate health` and new `validate readiness` to `validation.cjs`
5. `verify.cjs` (MODIFIED) — removes `cmdValidateHealth`, keeps verification-specific functions, re-exports health for compat

### Critical Pitfalls

1. **Auto-repair side effects during autopilot pre-flight** — Never auto-repair in autopilot; `validate()` and `repair()` must be separate functions. If state is inconsistent at pre-flight, fail fast and tell the user to run `gsd health --fix`.

2. **Circular dependencies between validation.cjs and verify.cjs** — `validation.cjs` -> `verify.cjs` only, never reverse. Document the dependency direction as a hard constraint in Phase 1. Any `require('./validation.cjs')` in `phase.cjs`, `core.cjs`, or `verify.cjs` is a bug.

3. **Divergent health output format breaking CLI consumers** — Add a snapshot test for `gsd health --json` output shape before changing any logic. The `checks` array, error codes, and field names must match pre-refactoring exactly. `validation.cjs` returns its own internal type; `cli.cjs` maps it to the existing public shape.

4. **Regex vs. artifact inspection parity gap** — New artifact-based checks must be additive (W006+), not replacements. Projects that were "healthy" must stay "healthy" after the upgrade. Add new checks alongside existing ones for the first release.

5. **Test budget exhaustion** — Budget is 750/800 (93.75%). The refactoring should be test-count neutral or negative. `verify-health.test.cjs` tests migrate to `validation.test.cjs`; `cli.test.cjs` health tests reduce to thin integration tests. Run test steward before planning to identify redundancy.

## Implications for Roadmap

The build order from ARCHITECTURE.md is clear and dependency-driven. Additive work first, then consumer migrations, then dead code removal, then integration.

### Phase 1: API Design and Module Skeleton
**Rationale:** All subsequent phases depend on the module interface being locked. The two most critical decisions — validation/repair separation and dependency direction — must be documented before any implementation. This is where Pitfall 1 (auto-repair side effects) and Pitfall 2 (circular dependencies) are prevented.
**Delivers:** `validation.cjs` skeleton with exported function signatures, JSDoc contracts, dependency graph documented in comments, test file scaffolded with budget accounting.
**Addresses:** Check registry structure, return type contracts, category metadata on checks.
**Avoids:** Circular dependency, auto-repair coupling, and starting implementation without a clear interface.

### Phase 2: Core Check Functions Implementation
**Rationale:** Pure additive code — no existing files change. `checkStructure`, `checkConfig`, `checkStateConsistency`, `checkPhaseSync` with all existing checks migrated from cli.cjs and verify.cjs. This is the deduplication step.
**Delivers:** All existing health checks implemented in `validation.cjs`, tested in `validation.test.cjs`. `runChecks()` orchestrator with early-exit pattern.
**Uses:** `node:fs` (sync), `node:path`, `frontmatter.cjs`, `core.cjs`, `config.cjs`, `phase.cjs`
**Implements:** Check composition pattern, unified result type, backward-compatible error codes.
**Avoids:** Pitfall 3 (output format breakage) via snapshot test written before migration. Pitfall 4 (parity gap) by implementing new checks additively as W006+ codes.

### Phase 3: Autopilot Readiness and Auto-Repair
**Rationale:** Depends on Phase 2 check functions existing. `checkAutopilotReadiness` uses `findFirstIncompletePhase` and `computePhaseStatus` — this is the core improvement over regex. `autoRepair` is built separately from checks (separation enforced from Phase 1 API design).
**Delivers:** `checkAutopilotReadiness()` returning `{ ready, phase, step, errors, warnings }`. `autoRepair()` handling config.json creation, STATE.md regeneration, missing phase mkdir.
**Uses:** `phase.cjs: computePhaseStatus, findFirstIncompletePhase`, `state.cjs: writeStateMd` (lazy require in autoRepair only)
**Implements:** Category-filtered execution, repair report in results.

### Phase 4: Consumer Migration
**Rationale:** Now that `validation.cjs` is complete and tested in isolation, consumers can be refactored to delegate to it. This is the highest-regression-risk phase — do consumers last, after the module is proven.
**Delivers:** `cli.cjs gatherHealthData()` delegating to `validation.runChecks()`. `gsd-tools.cjs` routing `validate health` and new `validate readiness` to `validation.cjs`. `cmdValidateHealth` removed from `verify.cjs` (re-exported for compat). Autopilot `checkAutopilotReadiness()` call added after existing prerequisite check.
**Uses:** `createRequire(import.meta.url)` for autopilot CJS import (established v2.3 pattern).
**Avoids:** Pitfall 6 (gsd-tools dispatch breakage) via integration tests through child_process. Pitfall 3 (output format) verified by snapshot tests from Phase 2 still passing.

### Phase 5: Dead Code Removal and Test Consolidation
**Rationale:** Dead code left from Phase 4 must be explicitly removed. `gatherHealthData()` inline logic in cli.cjs, `cmdValidateHealth` body in verify.cjs. Test files consolidated: `verify-health.test.cjs` tests that duplicated `validation.test.cjs` are deleted.
**Delivers:** Clean codebase with single validation implementation. Test count at or below pre-milestone count. All consumers using `validation.cjs`.
**Avoids:** Pitfall 5 (test budget exhaustion) via net-zero or net-negative test count.

### Phase Ordering Rationale

- API design before implementation prevents the hardest-to-fix architectural mistakes (circular deps, auto-repair coupling)
- Pure additive work (Phases 1-3) before any existing-file changes (Phase 4) means each phase is independently verifiable and reversible
- Consumer migrations grouped together in Phase 4 because they share the same regression risk — run the full test suite after each consumer is migrated, not after all four at once
- Dead code removal last (Phase 5) because it's easy to skip when everything seems to work — but without it, the milestone has not actually eliminated the divergence

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Consumer Migration):** The `verify.cjs` re-export strategy and exact backward-compatibility shape needs careful line-by-line analysis of what consumers of `verify.cjs` actually call. Worth a focused pre-phase review.
- **Phase 3 (Autopilot Readiness):** The `computePhaseStatus()` return shape and what fields map to which lifecycle steps needs confirming against the actual phase.cjs implementation before coding.

Phases with standard patterns (skip research-phase):
- **Phase 1 (API Design):** Pattern is well-established from existing lib/*.cjs modules — named exports, plain object results, `(cwd, options)` signatures.
- **Phase 2 (Core Checks):** Direct migration of existing code; patterns fully documented in STACK.md and ARCHITECTURE.md.
- **Phase 5 (Cleanup):** Mechanical deletion and test consolidation; no new patterns needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on direct codebase inspection; zero new dependencies; all patterns exist in current lib/*.cjs files |
| Features | HIGH | Both existing implementations analyzed line-by-line; feature boundaries clear from actual code, not speculation |
| Architecture | HIGH | Dependency graph derived from actual imports; circular dependency risk identified and resolution documented |
| Pitfalls | HIGH | All pitfalls derived from direct analysis of the existing divergent implementations and known Node.js CJS behaviors |

**Overall confidence:** HIGH

### Gaps to Address

- **`verify.cjs` exact export surface for backward compat:** Research documents that `cmdValidateHealth` must be re-exported from `validation.cjs`, but the complete list of `verify.cjs` exports consumed by external callers needs a grep before Phase 4 planning to avoid missing any.
- **`computePhaseStatus()` return fields:** ARCHITECTURE.md references `has_context`, `has_plan`, `has_summary`, `has_verification` fields — these need verification against the actual phase.cjs implementation (lines 895-979) before coding Phase 3.
- **Test count delta:** The research identifies that `verify-health.test.cjs` (793 lines) is a candidate for migration, but the actual redundancy between it, `cli.test.cjs` health tests, and the planned `validation.test.cjs` needs a test steward run to quantify. Target is net-zero or net-negative test count.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `bin/lib/cli.cjs` lines 409-655 — `gatherHealthData()`, `handleHealth()`, regex-based health checks
- `bin/lib/verify.cjs` lines 535-871 — `cmdValidateHealth()`, `cmdValidateConsistency()`, artifact-based validation
- `bin/lib/phase.cjs` lines 895-979, 1034-1055 — `computePhaseStatus()`, `findFirstIncompletePhase()`
- `bin/lib/core.cjs` — `findPhaseInternal`, `getMilestoneInfo`, `safeReadFile`, `output`, `error`
- `bin/lib/state.cjs` — `writeStateMd`
- `bin/lib/config.cjs` — `CONFIG_DEFAULTS`
- `bin/gsd-tools.cjs` lines 508-519 — `validate` dispatch routing
- `scripts/autopilot.mjs` lines 27-30, 60-83 — CJS imports, pre-flight prerequisite checks
- `tests/helpers.cjs` — `runGsdTools`, `createTempProject`, `cleanup` patterns
- `tests/verify-health.test.cjs` — existing health test patterns
- `package.json` — engine (`>=16.7.0`), devDependencies (`c8 ^11.0.0`), dependencies (`zx` only)
- `.planning/PROJECT.md` — v2.6 active requirements

### Secondary (MEDIUM confidence — external reference implementations)

- [Replicated Troubleshoot Preflight Framework](https://troubleshoot.sh/docs/preflight/cli-usage/) — pass/warn/fail severity model, category-based check organization
- [Google Distributed Cloud Preflight Checks](https://cloud.google.com/kubernetes-engine/distributed-cloud/vmware/docs/how-to/preflight-checks) — granular skip flags, iterative validation, early-run best practice
- [Microservices Health Check API Pattern](https://microservices.io/patterns/observability/health-check-api.html) — structured health endpoint returning component-level status

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
