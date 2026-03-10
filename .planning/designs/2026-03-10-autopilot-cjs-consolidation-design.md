# Autopilot CJS Consolidation — Design

**Date:** 2026-03-10
**Approach:** zx Rewrite Extending Existing Modules In-Place

## Module Extension Map

The core of this design maps each redundant bash function to the existing CJS module where it belongs, plus new exports needed.

**Functions moving into `phase.cjs`:**

| Bash Function | New CJS Function | Rationale |
|---|---|---|
| `find_first_incomplete_phase()` | `findFirstIncompletePhase(cwd)` | Iterates phases and checks completion — phase logic |
| `next_incomplete_phase(current)` | `nextIncompletePhase(cwd, currentPhase)` | Same pattern, starting from a given phase |
| `get_phase_dir(phase)` | Already exists as `findPhaseInternal()` → `.directory` | Just needs to be exported or wrapped in a command |

**Functions moving into `verify.cjs` (new section):**

| Bash Function | New CJS Function | Rationale |
|---|---|---|
| `extract_verification_status(phase_dir)` | `getVerificationStatus(cwd, phaseDir)` | Parses VERIFICATION.md/UAT.md frontmatter for status/score |
| `extract_gaps_summary(phase_dir)` | `getGapsSummary(cwd, phaseDir)` | Extracts gap lines from verification files |

**Config defaults moving into `cli.cjs`:**

| Bash Default | Change |
|---|---|
| `CIRCUIT_BREAKER_THRESHOLD=3` | `config-get` returns `3` as default when `autopilot.circuit_breaker_threshold` is unset |
| `MAX_DEBUG_RETRIES=3` | `config-get` returns `3` as default when `autopilot.max_debug_retries` is unset |

**New `gsd-tools.cjs` dispatch commands:**

- `phase find-next [--from N]` → calls `findFirstIncompletePhase` or `nextIncompletePhase`
- `verify status <phase>` → calls `getVerificationStatus`
- `verify gaps <phase>` → calls `getGapsSummary`

## zx Script Architecture

The new `autopilot.mjs` is a thin orchestrator using zx, with all logic delegated to CJS modules via direct `require()`.

**File:** `get-shit-done/scripts/autopilot.mjs`

**Dependencies:**
- `zx` (added to `package.json` dependencies)
- Direct `require()` via `createRequire` for: `phase.cjs`, `verify.cjs`, `cli.cjs`, `frontmatter.cjs`, `roadmap.cjs`

**Structure:**
```
#!/usr/bin/env zx

// ─── Imports ──────────────────────────────
// createRequire for CJS modules
// Import phase, verify, cli, frontmatter, roadmap

// ─── Argument Parsing ─────────────────────
// zx's argv or minimist for --from-phase, --project-dir, --dry-run

// ─── Prerequisites ────────────────────────
// Check claude, jq, node on PATH (zx's `which`)

// ─── Logging ──────────────────────────────
// Same file-based logging, using fs.appendFileSync

// ─── Circuit Breaker ──────────────────────
// Class or plain object with noProgressCount, threshold, check()
// Threshold from config-get with default (now in CJS)

// ─── Step Execution ───────────────────────
// runStep(prompt, stepName) — spawns `claude -p` via zx $``
// runStepWithRetry(prompt, stepName) — retry loop with debug
// runVerifyWithDebugRetry(phase) — verify-specific retry

// ─── Verification Gate ────────────────────
// Uses readline for TTY input (approve/fix/abort)
// Calls verify.getVerificationStatus() and verify.getGapsSummary()

// ─── Phase Navigation ─────────────────────
// Calls phase.findFirstIncompletePhase(cwd)
// Calls phase.nextIncompletePhase(cwd, current)

// ─── Milestone Audit & Gap Closure ────────
// Same flow, but status parsing via CJS frontmatter module

// ─── Main Loop ────────────────────────────
// Same state machine: discuss → plan → execute → verify → complete
// Phase status from phase.cmdPhaseStatus() called as function (not CLI)
```

**Key differences from bash version:**
- No `jq` — parse JSON natively in JS
- No `gsd_tools` shell-out — direct function calls
- `format_json_output` unnecessary — output is already JS objects
- Signal handling via `process.on('SIGINT', ...)` and `process.on('SIGTERM', ...)`
- Temp files via `os.tmpdir()` + `fs.mkdtempSync`

**Entrypoint change:** `bin/gsd-autopilot` updated to call `node autopilot.mjs` (or `zx autopilot.mjs`) instead of `bash autopilot.sh`. Add `--legacy` flag to fall back to `autopilot-legacy.sh`.

## CJS Module Changes

**`phase.cjs` — 2 new exported functions:**

```js
function findFirstIncompletePhase(cwd) {
  // Use roadmap.analyzeRoadmap() to get all phases
  // For each phase in order, call computePhaseStatus() internally
  // Return first phase where phase_complete === false
  // Returns null if all complete
}

function nextIncompletePhase(cwd, currentPhase) {
  // Same as above but starts searching after currentPhase
  // Returns null if no more incomplete phases
}
```

Both reuse the existing `cmdPhaseStatus` internals. This means extracting the status-computation logic from `cmdPhaseStatus` into a shared internal function `computePhaseStatus(cwd, phaseInfo)` that both `cmdPhaseStatus` and the new functions call.

**`verify.cjs` — 2 new exported functions:**

```js
function getVerificationStatus(cwd, phaseDir) {
  // Find VERIFICATION.md or UAT.md in phaseDir
  // Parse frontmatter for status and score
  // Returns { status, score } or null
}

function getGapsSummary(cwd, phaseDir) {
  // Find VERIFICATION.md or UAT.md
  // Extract lines from ## Gap sections
  // Returns string[] of gap descriptions
}
```

These replace the bash `extract_verification_status` and `extract_gaps_summary` which used `sed`/`grep` — the CJS versions use the existing `frontmatter.cjs` parser and string matching.

**`cli.cjs` — config default registration:**

```js
const CONFIG_DEFAULTS = {
  'autopilot.circuit_breaker_threshold': 3,
  'autopilot.max_debug_retries': 3,
  'autopilot.max_audit_fix_iterations': 3,
  'autopilot.auto_accept_tech_debt': true,
};
```

When `config-get` returns null/undefined, it falls back to this map. This replaces the bash `get_config` function's second argument defaults.

**`gsd-tools.cjs` — new dispatch entries:**

- `phase find-next [--from N]` dispatches to `phase.findFirstIncompletePhase` or `phase.nextIncompletePhase`
- `verify status <phase>` dispatches to `verify.getVerificationStatus`
- `verify gaps <phase>` dispatches to `verify.getGapsSummary`

These are added so any remaining bash callers (or future scripts) can access the same logic via CLI, but the zx script calls the functions directly.

## Migration & Fallback Strategy

**Step 1: Add zx dependency**
- Add `zx` to `package.json` dependencies (runtime dependency for autopilot)
- Pin to a specific major version to avoid breaking changes

**Step 2: Extend CJS modules**
- Add `findFirstIncompletePhase`, `nextIncompletePhase` to `phase.cjs`
- Add `getVerificationStatus`, `getGapsSummary` to `verify.cjs`
- Add `CONFIG_DEFAULTS` map and fallback logic to config-get path
- Add new dispatch entries to `gsd-tools.cjs`
- Write tests for all new functions

**Step 3: Write `autopilot.mjs`**
- Create the zx script importing the CJS modules directly
- Port each section of `autopilot.sh` one-for-one, replacing shell-outs with function calls
- Keep the same logging format for compatibility with existing log parsers

**Step 4: Rename and wire up**
- Rename `autopilot.sh` → `autopilot-legacy.sh`
- Update `bin/gsd-autopilot` entrypoint:
  ```bash
  if [[ "$1" == "--legacy" ]]; then
    shift
    exec "$SCRIPTS_DIR/autopilot-legacy.sh" "$@"
  else
    exec node "$SCRIPTS_DIR/autopilot.mjs" "$@"
  fi
  ```

**Step 5: Validate**
- Run existing `format-json-output.test.cjs` — decide if tests need updating or can be retired (since `format_json_output` is eliminated)
- Run full test suite
- Manual smoke test: `gsd-autopilot --dry-run --project-dir <test-project>`

**Legacy removal timeline:** After 1-2 milestones running on the zx version, delete `autopilot-legacy.sh` and the `--legacy` flag.

## Lines of Code Impact

**Eliminated from bash (~200 lines):**
- `find_first_incomplete_phase()` — 27 lines
- `next_incomplete_phase()` — 32 lines
- `extract_verification_status()` — 21 lines
- `extract_gaps_summary()` — 15 lines
- `get_config()` with inline defaults — 11 lines
- `get_phase_dir()` wrapper — 6 lines
- `format_json_output()` — 8 lines
- All `jq` parsing calls throughout — ~80 lines scattered across main loop, gap closure, verification gate

**Added to CJS modules (~120 lines):**
- `phase.cjs`: `computePhaseStatus` extraction + `findFirstIncompletePhase` + `nextIncompletePhase` — ~60 lines
- `verify.cjs`: `getVerificationStatus` + `getGapsSummary` — ~35 lines
- `cli.cjs`: `CONFIG_DEFAULTS` map + fallback — ~15 lines
- `gsd-tools.cjs`: dispatch entries — ~10 lines

**New `autopilot.mjs`:**
- Estimated ~800-900 lines (vs 1313 bash lines)
- Reduction from: no jq parsing, no shell-out overhead, no `format_json_output`, direct function calls replacing `gsd_tools` + `jq` pipelines

**Net effect:** ~400 fewer lines of code, zero duplicated logic between script and modules.
