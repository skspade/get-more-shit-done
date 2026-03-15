# Pitfalls Research

**Domain:** Unified validation module replacing divergent state-reading logic across CLI health, autopilot pre-flight, and gsd-tools dispatch
**Researched:** 2026-03-15
**Confidence:** HIGH (pitfalls derived from direct codebase analysis of existing consumers)

## Critical Pitfalls

### Pitfall 1: Auto-Repair Side Effects During Autopilot Pre-Flight

**What goes wrong:**
Auto-repair modifies STATE.md or config.json as a side effect of validation. The autopilot then reads the "fixed" state and makes decisions based on it -- but the repair may have been wrong. For example, if STATE.md references Phase 65 but only Phase 64 exists on disk, auto-repair might reset the current phase to 64, causing autopilot to re-execute an already-completed phase. Worse: the repair writes to disk mid-flight, creating a race condition if the autopilot is also about to write STATE.md via `writeStateMd()`.

**Why it happens:**
Conflating "detect problems" with "fix problems" in a single call. The existing `cmdValidateHealth` in `verify.cjs` already has a `repairs` array and `repairable` flag -- the temptation is to always run repairs when calling from autopilot since "why not fix things automatically?"

**How to avoid:**
Separate validation into two distinct operations: `validate()` returns a result object with issues and suggested repairs; `repair()` takes the result and applies fixes. Autopilot pre-flight calls `validate()` only and fails fast on errors (no silent repair). The `gsd health --fix` CLI path calls `validate()` then `repair()`. Never auto-repair during autopilot -- if state is inconsistent, surface it as a pre-flight failure and let the user run `gsd health --fix` manually.

**Warning signs:**
- A `repair` or `fix` parameter on the validation function itself (coupling detection and mutation)
- Tests that need `beforeEach` filesystem setup to undo auto-repair side effects
- Autopilot logs showing "repaired STATE.md" before phase execution begins

**Phase to address:**
Phase 1 (API design) -- define the validate/repair separation in the module interface before any implementation.

---

### Pitfall 2: Circular Dependencies Between validation.cjs and phase.cjs

**What goes wrong:**
`validation.cjs` needs `computePhaseStatus()` and `findFirstIncompletePhase()` from `phase.cjs` to do artifact-based validation. But `phase.cjs` might need validation results to decide what to do (e.g., auto-creating directories in `cmdPhaseStatus` when a phase is in ROADMAP but not on disk). Adding a `require('./validation.cjs')` to `phase.cjs` creates a circular require that silently returns `{}` for the first module loaded, causing cryptic "X is not a function" errors at runtime.

**Why it happens:**
Node.js CJS circular requires are a silent failure mode -- they don't throw, they just return a partial module object. The existing dependency graph already has `verify.cjs` importing from `phase.cjs`. Adding `validation.cjs` that imports from both `phase.cjs` AND is imported by `phase.cjs` creates the cycle.

**How to avoid:**
`validation.cjs` depends on `phase.cjs` and `core.cjs` -- never the reverse. If `phase.cjs` needs validation logic, it calls the underlying functions directly (they're already in `phase.cjs` itself, like `computePhaseStatus`). The dependency direction is: `validation.cjs` -> `phase.cjs` -> `core.cjs`. No module should import `validation.cjs` except consumers (autopilot.mjs, cli.cjs, gsd-tools.cjs dispatch). Draw the dependency graph before writing any `require()` statements.

**Warning signs:**
- Any `require('./validation.cjs')` appearing in `phase.cjs`, `core.cjs`, or `verify.cjs`
- Runtime errors like "validateX is not a function" that only appear in certain import orders
- Tests passing in isolation but failing when run together (load order dependence)

**Phase to address:**
Phase 1 (API design) -- document the dependency direction as a constraint in the plan.

---

### Pitfall 3: Divergent Health Output Format Breaking CLI Consumers

**What goes wrong:**
`gsd health` currently returns `{ status, checks, errors, warnings, info }` from `gatherHealthData()` in `cli.cjs`, with specific error codes (E001-E005, W001-W005, I001). The `verify.cjs` `cmdValidateHealth` returns a different shape: `{ status, errors, warnings, info, repairable_count }` with a `repairable` boolean on each issue. If `validation.cjs` changes the output structure (different error codes, different field names, different nesting), any scripts or workflows that parse `gsd health --json` output will break silently.

**Why it happens:**
Refactoring two implementations into one inevitably changes the output format. The developer focuses on making the unified module "clean" and forgets that the CLI output is a public API. The `--json` flag makes it especially dangerous because machine consumers depend on exact field names.

**How to avoid:**
The `gsd health` CLI handler in `cli.cjs` must remain the formatting layer. `validation.cjs` returns its own internal result type. `handleHealth()` in `cli.cjs` maps that result into the existing `{ status, checks, errors, warnings, info }` shape. Write a backward-compatibility test that snapshots the current `gsd health --json` output shape and asserts the new implementation matches it. Keep the same error codes (E001-E005, W001-W005).

**Warning signs:**
- No test that asserts the JSON output structure of `gsd health --json`
- Error codes changing from E001 to VAL-001 or similar renaming
- The `checks` array disappearing (it's in cli.cjs but not in verify.cjs)

**Phase to address:**
Phase 2 (implementation) -- add output compatibility test before changing any health logic.

---

### Pitfall 4: Regex vs. Artifact Inspection Parity Gap

**What goes wrong:**
The existing `gatherHealthData()` in `cli.cjs` uses regex to extract phase info from STATE.md (`/Phase:\s*(\d+)\s+of\s+\d+/`). The new `validation.cjs` uses `computePhaseStatus()` which inspects artifact presence (CONTEXT.md, PLAN.md, SUMMARY.md files). These two approaches can give different answers for the same project state. For example: STATE.md says "Phase 64 of 65" but `computePhaseStatus` says phase 64 is complete (all plans have summaries). Switching wholesale from regex to artifact inspection might flag issues that were previously invisible, causing `gsd health` to report "degraded" for projects that were previously "healthy".

**Why it happens:**
The whole point of v2.6 is to unify these approaches. But the transition period creates a parity gap where users see new warnings they've never seen before, eroding trust in the tool.

**How to avoid:**
Add artifact-based checks as new warning codes (W006+) rather than replacing existing regex checks. Keep the existing checks for one release cycle so users see both. Document in release notes which checks are new. The unified module should be strictly additive in its first release -- same checks as before plus new ones.

**Warning signs:**
- Removing the `Phase:\s*(\d+)\s+of\s+\d+` regex without adding an equivalent artifact-based check
- A "healthy" project suddenly showing "degraded" with no actual state change
- Tests that were green becoming red because stricter validation catches pre-existing issues

**Phase to address:**
Phase 2 (implementation) -- implement new checks alongside existing ones, not replacing them.

---

### Pitfall 5: Test Budget Exhaustion During Refactoring

**What goes wrong:**
The test budget is at 750/800 (93.75%). The refactoring involves three test files that test overlapping health/validation logic: `cli.test.cjs` (889 lines), `verify-health.test.cjs` (793 lines), `verify.test.cjs` (1154 lines). Adding `validation.test.cjs` for the new module while keeping the existing tests pushes past the budget. Deleting existing tests to make room risks losing coverage for edge cases that only the old implementation tested.

**Why it happens:**
Shared modules need their own tests. But the consumers also need tests that verify their integration with the shared module. Without careful planning, you end up with: old consumer tests + new module tests + new integration tests = budget blown.

**How to avoid:**
Plan the test migration as a specific task. The existing `verify-health.test.cjs` tests should migrate to `validation.test.cjs` since the logic is moving. `cli.test.cjs` health tests should reduce to thin integration tests that verify `handleHealth()` formats the output correctly (not that validation logic works -- that's `validation.test.cjs`'s job). Count the tests before and after: the refactoring should be test-count neutral or negative. Use the test steward to identify redundancy between the three files before starting.

**Warning signs:**
- Test count increasing by more than 5 during a refactoring milestone (net new tests should be near zero for pure refactoring)
- Duplicate test descriptions across `validation.test.cjs` and `cli.test.cjs`
- Test steward flagging redundancy in the PR

**Phase to address:**
Phase 1 (planning) -- run test steward on existing health tests before planning, account for test budget in plan tasks.

---

### Pitfall 6: gsd-tools Dispatch Entry Breaking Workflow Consumers

**What goes wrong:**
The `gsd-tools.cjs` `validate` command currently dispatches to `verify.cmdValidateConsistency` and `verify.cmdValidateHealth`. Changing this to dispatch to `validation.cmdX` changes the import but must preserve the exact same CLI interface (`gsd-tools.cjs validate consistency`, `gsd-tools.cjs validate health --repair`). If the new module uses different function signatures or different raw output format, any workflow file (markdown) that calls `gsd-tools.cjs validate health` gets different results.

**Why it happens:**
The dispatch layer in gsd-tools.cjs is a thin routing layer. Developers change the import and assume the function contract is the same. But subtle differences in `output()` calls (different JSON structure, different plain-text format) break downstream consumers.

**How to avoid:**
Write the `validation.cjs` exports to match the exact function signatures of the functions they replace in `verify.cjs`. Specifically: `cmdValidateHealth(cwd, options, raw)` and `cmdValidateConsistency(cwd, raw)` must keep the same parameter order and output shape. Add integration tests that call through `gsd-tools.cjs` (via child_process) to verify end-to-end behavior matches.

**Warning signs:**
- Changing the function name from `cmdValidateHealth` to `validateHealth` without updating the dispatch layer
- The `raw` parameter being dropped or reordered
- New required parameters added to the function signature

**Phase to address:**
Phase 2 (implementation) -- preserve function signatures as a hard constraint.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping both `gatherHealthData` in cli.cjs AND new `validation.cjs` | Zero risk of regression | Two implementations drift apart again; defeats the purpose of v2.6 | Never -- the whole milestone is about eliminating this |
| Forwarding `gatherHealthData` to `validation.cjs` without removing old code | Quick win, old code as fallback | Dead code accumulates, confusing future developers | Only during implementation phase, must be cleaned up before milestone close |
| Skipping auto-repair implementation | Simpler module, fewer side effects | `gsd health --fix` stops working | Never -- `--fix` is a documented user-facing feature |
| Putting formatting logic in `validation.cjs` | One place for everything | Module becomes CLI-aware, can't be used by autopilot (which doesn't need ANSI colors) | Never -- keep validation logic format-agnostic |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| autopilot.mjs importing validation.cjs | Using `require()` path relative to autopilot.mjs location incorrectly | Use `createRequire(import.meta.url)` and `require('../bin/lib/validation.cjs')` matching the existing pattern for phase.cjs imports |
| gsd-tools.cjs dispatch | Adding a new top-level command instead of extending `validate` subcommand | Add subcommands under existing `validate` case, e.g., `validate readiness` for autopilot checks |
| cli.cjs health command | Calling `validation.validate()` and passing result directly to JSON output | Map validation result to existing `{ status, checks, errors, warnings, info }` shape in `handleHealth()` |
| verify.cjs consistency check | Keeping `cmdValidateConsistency` in verify.cjs AND duplicating in validation.cjs | Move to validation.cjs, re-export from verify.cjs for backward compat: `module.exports.cmdValidateConsistency = require('./validation.cjs').cmdValidateConsistency` |
| verify.cjs health check | Deleting `cmdValidateHealth` from verify.cjs exports | Re-export from validation.cjs to avoid breaking any existing consumers of verify.cjs |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading ROADMAP.md multiple times per validation run | Slow health checks on large roadmaps | Read once, pass content to all check functions | Not a concern at current scale but worth noting for clean API design |
| `computePhaseStatus` scanning all phase directories on every validation | Pre-flight adds latency to every autopilot invocation | Only validate the current + next phase in autopilot pre-flight, not all phases | Projects with 50+ phases |
| Re-reading STATE.md after auto-repair | Validation reads it, repair writes it, then validation re-reads to verify | Return the repaired content from repair function instead of re-reading from disk | Not a concern but indicates sloppy API design |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| New validation errors appearing after upgrade to v2.6 | Users see "degraded" status on projects that were "healthy" -- erodes trust | Add new checks as info-level first, promote to warning in next milestone |
| Auto-repair running without explicit user consent | Users confused about why STATE.md changed | Never auto-repair in `gsd health` without `--fix` flag; never auto-repair in autopilot pre-flight |
| Different error messages between `gsd health` and `gsd-tools validate health` | Users get inconsistent guidance depending on which command they run | Single source of truth for error messages in `validation.cjs` |
| Autopilot failing pre-flight with cryptic validation error | User doesn't know how to fix the issue | Include the `fix` field from validation result in the autopilot error output, e.g., "Pre-flight failed: E004 STATE.md not found. Fix: run gsd health --fix" |

## "Looks Done But Isn't" Checklist

- [ ] **gsd health --json output:** Shape must match pre-refactoring output exactly -- verify with snapshot test
- [ ] **gsd-tools validate health --repair:** Must still perform actual repairs, not just report repairability
- [ ] **verify.cjs exports:** `cmdValidateConsistency` and `cmdValidateHealth` must still be exported (even if re-exported from validation.cjs)
- [ ] **autopilot pre-flight:** Must call validation before first phase step, not just check `.planning/` exists (lines 74-78 of autopilot.mjs)
- [ ] **Error code stability:** E001-E005, W001-W005, I001 must map to the same issues as before
- [ ] **Test coverage parity:** Every check in old `gatherHealthData` (cli.cjs lines 423-581) has a corresponding test in new test file
- [ ] **HLTH-01/02/03 coverage:** The section markers in cli.cjs reference file checks, config validation, and state consistency -- all three categories must be in validation.cjs
- [ ] **Dead code removal:** Old `gatherHealthData` function in cli.cjs deleted after migration, not left as dead code
- [ ] **checks array preserved:** cli.cjs includes a `checks` array with pass/fail per file -- verify.cjs does not have this. The unified module must support both output shapes or cli.cjs must synthesize it

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auto-repair corrupts STATE.md | LOW | STATE.md is regenerable from ROADMAP.md + phase directories; `gsd health --fix` can rebuild it |
| Circular dependency causes runtime crash | LOW | Move the offending `require()` to the consumer side; no data loss, just a code change |
| CLI output format breaks scripts | MEDIUM | Add backward-compat shim in cli.cjs that maps new format to old; announce deprecation |
| Test budget exceeded | LOW | Run test steward, consolidate redundant tests across the three health-related test files |
| Autopilot pre-flight too strict | LOW | Add config option to skip pre-flight (`autopilot.skip_preflight: true`) as escape hatch |
| Regression in existing health checks | MEDIUM | Git revert the validation.cjs integration; cli.cjs still has old `gatherHealthData` until deleted |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auto-repair side effects | Phase 1 (API design) | `validate()` returns result without mutations; `repair()` is separate function |
| Circular dependencies | Phase 1 (API design) | Dependency graph documented; no `require('./validation.cjs')` in phase.cjs or core.cjs |
| CLI output format breakage | Phase 2 (implementation) | Snapshot test for `gsd health --json` output passes before and after |
| Regex vs artifact parity gap | Phase 2 (implementation) | Both old and new checks present; no "healthy" to "degraded" regression on clean projects |
| Test budget exhaustion | Phase 1 (planning) | Test steward run before implementation; test count target set in plan |
| gsd-tools dispatch breakage | Phase 2 (implementation) | Integration test calling `gsd-tools.cjs validate health` through child_process |

## Sources

- Direct codebase analysis: `cli.cjs` lines 409-655 (`gatherHealthData`, `handleHealth`) -- the regex-based consumer
- Direct codebase analysis: `verify.cjs` lines 535-665 (`cmdValidateHealth`) -- the parallel implementation with repair support
- Direct codebase analysis: `phase.cjs` lines 895-979 (`computePhaseStatus`) -- the artifact-inspection approach
- Direct codebase analysis: `autopilot.mjs` lines 27-30 (CJS imports), lines 1052-1058 (`getPhaseStep`) -- the autopilot consumer
- Direct codebase analysis: `gsd-tools.cjs` lines 508-517 (`validate` dispatch) -- the workflow consumer
- Direct codebase analysis: `verify.cjs` line 10 (`require('./phase.cjs')`) -- existing cross-module dependency
- PROJECT.md v2.6 active requirements and context section
- Test budget status: 750/800 (93.75%) from PROJECT.md context

---
*Pitfalls research for: unified validation module (v2.6)*
*Researched: 2026-03-15*
