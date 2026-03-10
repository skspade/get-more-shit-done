# Phase 48: zx Autopilot Core - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The autopilot state machine (discuss, plan, execute, verify, complete) is rewritten as a zx script (`autopilot.mjs`) that imports CJS modules directly instead of shelling out to `gsd-tools.cjs`. Phase navigation, config access, and verification status are all direct function calls. This phase covers the core loop, circuit breaker, logging, signal handling, and CLI arguments -- but NOT debug retry, verification gate TTY input, or milestone audit (those are Phase 49).

</domain>

<decisions>
## Implementation Decisions

### Script Architecture (REQ-09, REQ-10)
- `autopilot.mjs` lives at `get-shit-done/scripts/autopilot.mjs` matching the existing `autopilot.sh` location
- Uses `#!/usr/bin/env zx` shebang with zx's built-in `$` template literal for shell commands
- Imports CJS modules via `createRequire(import.meta.url)` for `phase.cjs`, `verify.cjs`, `config.cjs`, `frontmatter.cjs`, `roadmap.cjs`, `core.cjs`
- No `jq` dependency required -- JSON is handled natively in JS
- No `format_json_output` needed -- Claude CLI output parsed as JS objects directly (Claude's Decision: zx operates in JS context, so piping through jq is unnecessary overhead)

### State Machine (REQ-11)
- Implements the same discuss-plan-execute-verify-complete cycle as `autopilot.sh` with identical phase progression behavior
- Phase status determined by calling `computePhaseStatus` or `cmdPhaseStatus` from `phase.cjs` directly (no JSON serialization boundary)
- State machine switch cases: `discuss`, `plan`, `execute`, `verify`, `complete` -- same as bash version
- `discuss` step invokes `claude -p` with `/gsd:discuss-phase $PHASE --auto`
- `plan` step invokes `claude -p` with `/gsd:plan-phase $PHASE --auto`
- `execute` step invokes `claude -p` with `/gsd:execute-phase $PHASE`
- `verify` step invokes `claude -p` with `/gsd:verify-work $PHASE`
- Phase completion marked via `gsd_tools phase complete $PHASE` (Claude's Decision: reuse gsd-tools CLI for phase-complete rather than importing the function, since it has side effects that need full CLI context)
- After verify approval, the loop calls `phase complete` then advances to next phase

### Claude CLI Invocation (REQ-12)
- All `claude -p` spawns use zx's `$` template literal with `.nothrow()` to capture exit codes without throwing
- Passes `--dangerously-skip-permissions --output-format json` matching the bash version
- Output piped to stdout for transparency (same as bash `| format_json_output` but without jq formatting) (Claude's Decision: keeps user-visible output identical while removing jq dependency)
- stderr tee'd to log file via zx's `.pipe()` or manual stream handling (Claude's Decision: matches bash behavior of capturing stderr to log while displaying to user)

### Phase Navigation (REQ-09, REQ-10)
- Starting phase determined by `findFirstIncompletePhase(cwd)` when no `--from-phase` argument
- Phase advancement uses `nextIncompletePhase(cwd, currentPhase)` -- direct function call, no shell-out
- If no incomplete phase found at start, all-phases-complete path triggers (stub for milestone audit -- Phase 49 scope)

### Circuit Breaker (REQ-13)
- Reads threshold from `CONFIG_DEFAULTS` via `cmdConfigGet` or direct `CONFIG_DEFAULTS['autopilot.circuit_breaker_threshold']` import
- Progress snapshot uses git commit count + artifact file count -- same signals as bash version
- `noProgressCount` increments when before/after snapshot match; resets to 0 when progress detected
- Halts with exit code 1 and halt report when threshold reached
- Counter resets on phase advancement (Claude's Decision: matches bash behavior where phase transition is definitional progress)

### File-Based Logging (REQ-17)
- Log file at `.planning/logs/autopilot-YYYYMMDD-HHMMSS.log` matching existing format
- Session header: separator line, "GSD Autopilot Session Log", ISO timestamp, project dir, from-phase, dry-run -- identical to bash
- Log entries: `[HH:MM:SS] MESSAGE` format using `fs.appendFileSync`
- Log messages for: BANNER, STARTUP, MAIN LOOP, STEP START, STEP DONE, PROGRESS CHECK, NO PROGRESS, PROGRESS DETECTED, CIRCUIT BREAKER -- same prefixes as bash version
- Existing log parsers must work unchanged against the new format

### Signal Handling (REQ-18)
- `process.on('SIGINT', handler)` and `process.on('SIGTERM', handler)` print resume instructions and exit
- Resume message: `"To resume: autopilot.sh --from-phase $PHASE --project-dir $DIR"` (Claude's Decision: references autopilot.sh for now since entrypoint wiring is Phase 50 scope)
- Cleans up temp files on exit via `process.on('exit', cleanup)`
- Exit code 130 for SIGINT (matching bash convention), clean exit for SIGTERM

### Argument Parsing (REQ-19)
- Supports `--from-phase N`, `--project-dir PATH`, `--dry-run` via zx's built-in `argv` (minimist)
- `--project-dir` defaults to `process.cwd()` when not provided
- `--dry-run` prints what would execute but does not spawn `claude -p` processes
- Unknown arguments produce usage error and exit 1 (Claude's Decision: matches bash behavior for argument validation)

### Prerequisites Check
- Checks for `claude` on PATH via `which` (zx built-in)
- Checks for `node` on PATH via `which`
- Does NOT check for `jq` -- no longer required (Claude's Decision: jq was only needed for JSON parsing which is now native JS)
- Validates `.planning/` directory exists in project dir
- Validates `gsd-tools.cjs` exists at expected path

### Console Output
- Banner format uses same box-drawing characters as bash: `━━━━━━━━━` borders, `GSD > AUTOPILOT:` prefix
- Halt report uses same `╔══╗` / `╚══╝` box as bash version
- Warning messages to stderr match bash format (Claude's Decision: visual consistency so users cannot distinguish which version is running)

### Scope Boundary -- What This Phase Does NOT Include
- Debug retry (`run_step_with_retry`, `run_verify_with_debug_retry`) -- Phase 49
- Verification gate TTY input (approve/fix/abort) -- Phase 49
- Milestone audit, gap closure loop, milestone completion -- Phase 49
- For `execute` and `verify` steps in this phase, use simple `run_step` (no retry) as a placeholder (Claude's Decision: keeps Phase 48 focused on the core loop; Phase 49 layers retry and gate logic on top)

### Claude's Discretion
- Internal variable naming for state machine tracking (e.g., `currentPhase` vs `phase`)
- Exact structure of progress snapshot comparison (string vs object)
- Whether to use a class or plain functions for circuit breaker state
- Helper function decomposition within the script
- Exact temp file naming pattern

</decisions>

<specifics>
## Specific Ideas

- The bash `run_step` function (lines 869-907) is the minimal step execution pattern this phase ports -- it spawns `claude -p`, captures exit code, checks progress, and handles partial success (non-zero exit but artifacts changed)
- The bash `run_step_captured` function (lines 685-716) adds output capture to a temp file -- this is needed for debug retry in Phase 49 but the capture pattern should be present in Phase 48 to avoid rework
- The `take_progress_snapshot` bash function (lines 151-156) uses `git rev-list --count HEAD` and `find .planning/phases -name "*.md" | wc -l` -- the zx version should use the same signals for backward compatibility
- The log file session header (lines 84-93) has an exact format that log parsers depend on -- replicate field-for-field
- The `check_progress` function (lines 158-182) writes to both the log file and the iteration log array -- both mechanisms needed for halt report display
- `print_halt_report` (lines 184-231) shows reason, phase, step, exit code, total iterations, no-progress count, debug sessions, iteration log, and resume instructions -- this output format must be preserved
- For dry-run mode, the bash version still runs progress checks (which will always show no progress) and triggers circuit breaker -- preserve this behavior so dry-run exercises the full code path

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `phase.cjs` (`findFirstIncompletePhase`, `nextIncompletePhase`, `computePhaseStatus`, `cmdPhaseStatus`): Phase navigation and status -- imported directly, replacing 100+ lines of bash + jq
- `config.cjs` (`cmdConfigGet`, `CONFIG_DEFAULTS`): Config with defaults -- imported to read circuit breaker threshold, max debug retries, etc.
- `verify.cjs` (`getVerificationStatus`, `getGapsSummary`): Verification status parsing -- imported for verify step gap checking (Phase 49 uses these more heavily)
- `core.cjs` (`findPhaseInternal`, `comparePhaseNum`): Phase resolution -- potentially needed for phase directory lookups
- `frontmatter.cjs` (`extractFrontmatter`): Frontmatter parsing -- used indirectly through verify.cjs

### Established Patterns
- All CJS modules follow `cmd*(cwd, args, raw)` signature with `output(result, raw)` for CLI-facing functions
- Non-CLI functions like `findFirstIncompletePhase` return values directly -- the zx script uses these
- `gsd-tools.cjs` dispatch pattern: the script may still shell out to `gsd-tools.cjs` for operations not yet extracted (e.g., `phase complete`, `state add-blocker`)
- Logging format is `[HH:MM:SS] PREFIX: key=value` pairs -- established by 46 phases of log data

### Integration Points
- `get-shit-done/scripts/autopilot.mjs`: New file alongside existing `autopilot.sh`
- `bin/gsd-autopilot`: Entrypoint currently delegates to `autopilot.sh` -- Phase 50 will update this to route to `autopilot.mjs`
- `get-shit-done/bin/lib/phase.cjs`: Exports `findFirstIncompletePhase` and `nextIncompletePhase` (added by Phase 47)
- `get-shit-done/bin/lib/config.cjs`: Exports `CONFIG_DEFAULTS` and `cmdConfigGet` (modified by Phase 47)
- `get-shit-done/bin/lib/verify.cjs`: Exports `getVerificationStatus` and `getGapsSummary` (added by Phase 47)
- `.planning/logs/`: Directory for log files -- format must remain compatible

</code_context>

<deferred>
## Deferred Ideas

- Debug retry loop with `construct_debug_prompt` and `run_step_with_retry` (deferred to Phase 49 per roadmap)
- Verification gate with TTY readline input (approve/fix/abort) (deferred to Phase 49 per roadmap)
- Milestone audit, gap closure loop, and milestone completion (deferred to Phase 49 per roadmap)
- Entrypoint wiring in `bin/gsd-autopilot` and `--legacy` fallback (deferred to Phase 50 per roadmap)
- Renaming `autopilot.sh` to `autopilot-legacy.sh` (deferred to Phase 50 per roadmap)
- Adding `zx` to `package.json` dependencies (deferred to Phase 50 per roadmap -- script can be run with `npx zx` or local install during development)
- Tests for `autopilot.mjs` (deferred to Phase 51 per roadmap)

</deferred>

---

*Phase: 48-zx-autopilot-core*
*Context gathered: 2026-03-10 via auto-context*
