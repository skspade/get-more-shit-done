# Phase 49: Advanced Autopilot Features - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The zx autopilot script (`autopilot.mjs`) gains the three remaining features that make it feature-complete with `autopilot.sh`: debug retry on failures (REQ-14), a TTY-based verification gate with approve/fix/abort routing (REQ-15), and milestone audit with gap closure loop and milestone completion (REQ-16). After this phase, the zx script can drive a full milestone from start to completion autonomously.

</domain>

<decisions>
## Implementation Decisions

### Debug Retry (REQ-14)

- `autopilot.mjs` implements `runStepWithRetry(prompt, stepName)` matching the behavior of bash `run_step_with_retry`
- `autopilot.mjs` implements `runVerifyWithDebugRetry(phase)` matching the behavior of bash `run_verify_with_debug_retry`
- Max retries read from config via `getConfig('autopilot.max_debug_retries', 3)` -- same as bash `MAX_DEBUG_RETRIES`
- `runStepWithRetry` uses a `runStepCaptured` variant that writes output to a temp file via tee, matching the bash `run_step_captured` pattern (Claude's Decision: output capture is required for constructing debug context from the last 100 lines of output)
- `constructDebugPrompt(stepName, exitCode, errorContext, phase, phaseDir, retryNum)` builds the same heredoc-style debug prompt as the bash version, including `<objective>`, `<symptoms>`, `<mode>`, `<debug_file>`, and `<files_to_read>` XML blocks (Claude's Decision: prompt structure must match exactly since it targets the same gsd-debugger agent)
- On retry exhaustion, `writeFailureState` writes a blocker to STATE.md via `gsdTools('state', 'add-blocker', ...)` and `writeFailureReport` writes a `{padded}-FAILURE.md` file -- same artifacts as bash version
- `clearFailureState` removes phase failure blockers from STATE.md on success via `gsdTools('state', 'resolve-blocker', ...)`
- `runVerifyWithDebugRetry` handles three cases: verify crash (non-zero exit), gaps_found status (re-run after debug fix), and success (no gaps) -- same three-branch logic as bash
- On gaps_found with retries exhausted, `runVerifyWithDebugRetry` returns 0 so the verification gate still presents (matching bash behavior)
- The existing `runStep` function in the Phase 48 script is preserved as-is for discuss and plan steps -- only execute and verify use the retry variants

### Verification Gate (REQ-15)

- `autopilot.mjs` implements `runVerificationGate(phase)` using Node.js `readline` with explicit TTY streams (`/dev/tty` for input)
- Gate displays: phase number, verification status, score, gaps (if any), and autonomous decisions (if auto-context)
- Three routing options: `approve` (continue to next phase), `fix` (describe issues, trigger gap-closure cycle), `abort` (exit code 2, state preserved)
- Input accepts same aliases as bash: `a`/`approve`/`yes`/`y`, `f`/`fix`, `x`/`abort`/`quit`/`q` -- case-insensitive with trimming
- `runFixCycle(phase, fixDesc)` runs plan-phase with `--gaps`, execute-phase with `--gaps-only`, and verify-work -- same as bash `run_fix_cycle`
- Gate loops after fix cycle to re-present updated verification status (matching bash behavior)
- In dry-run mode, verification gate is auto-approved with `[DRY RUN] Auto-approving verification gate` message
- `printVerificationGate` uses the same box-drawing characters as bash: `CHECKPOINT: Verification Required` header with `approve / fix / abort` menu (Claude's Decision: visual consistency with bash version ensures users cannot distinguish which script is running)
- `extractAutonomousDecisions(phaseDir)` reads CONTEXT.md, checks for auto-context markers, and extracts lines containing `(Claude's Decision:` -- ported as JS string operations (Claude's Decision: needed for gate display and already available as a bash function to replicate)
- Readline interface created with `input: fs.createReadStream('/dev/tty')` and `output: process.stdout` (Claude's Decision: TTY direct read is required because zx may pipe stdin; this matches the bash `read -r < /dev/tty` pattern)

### Milestone Audit and Completion (REQ-16)

- `autopilot.mjs` implements `runMilestoneAudit()` that invokes `/gsd:audit-milestone` via `runStepWithRetry`, parses the resulting audit file frontmatter for status, and returns 0 (passed/tech-debt-accepted), 10 (gaps_found), or 1 (error) -- same exit code semantics as bash
- Audit file located via `fs.readdirSync` looking for `v*-MILESTONE-AUDIT.md` sorted by mtime descending (Claude's Decision: matches bash `ls -t` pattern without shelling out)
- Audit status routing: `passed` returns 0, `gaps_found` returns 10, `tech_debt` checks `auto_accept_tech_debt` config (true=0, false=10), unknown returns 1
- `runGapClosureLoop()` implements the same four-step loop as bash: check iteration limit, plan gaps (`/gsd:plan-milestone-gaps --auto`), execute fix phases through full lifecycle, re-audit
- Max audit-fix iterations read from `getConfig('autopilot.max_audit_fix_iterations', 3)`
- Gap closure inner loop uses `findFirstIncompletePhase` to find fix phases and drives them through discuss-plan-execute-verify-complete with retry and verification gate
- `printEscalationReport(iterations, maxIterations)` displays when gap closure exhausts iterations -- same box-drawing format as bash
- `runMilestoneCompletion()` extracts milestone version from STATE.md frontmatter, invokes `/gsd:complete-milestone $VERSION` with autopilot auto-approve instructions via `runStepWithRetry`
- Milestone audit triggers in two places: (1) when no starting phase found (all already complete), and (2) in the `complete` case when `nextIncompletePhase` returns null -- matching bash behavior exactly
- After gap closure loop returns 0, `runMilestoneCompletion` is called -- same as bash flow

### Main Loop Updates

- The `execute` case in the main loop switches from `runStep` to `runStepWithRetry` with halt on retry exhaustion
- The `verify` case switches from `runStep` to `runVerifyWithDebugRetry` followed by `runVerificationGate` (or auto-approve in dry-run)
- The `complete` case adds milestone audit, gap closure loop, and milestone completion logic when `nextIncompletePhase` returns null
- The all-phases-complete stub at startup (Phase 48 placeholder) is replaced with actual milestone audit and gap closure logic
- Remove the Phase 48 stub comments (`// Stub: milestone audit is Phase 49 scope`) (Claude's Decision: stubs should be replaced now that the real implementation is being added)

### Output Capture

- `runStepCaptured(prompt, stepName, outputFile)` is the output-capturing variant needed by retry functions -- captures stdout to a temp file while still displaying to terminal (Claude's Decision: this was identified as needed in Phase 48 CONTEXT.md specifics section and is prerequisite for debug context extraction)
- Temp files tracked in the `tempFiles` array for cleanup on exit, matching the Phase 48 pattern
- Error context extracted as last 100 lines of captured output for debug prompt construction (Claude's Decision: matches bash `tail -100` pattern)

### Claude's Discretion

- Whether to use a class or object literal for grouping retry state
- Internal helper function decomposition within `runStepWithRetry` and `runVerifyWithDebugRetry`
- Exact formatting of the debug prompt template string (template literal vs heredoc-style)
- Whether `runMilestoneAudit` returns a numeric code or throws on error
- Exact regex vs string matching for extracting autonomous decisions from CONTEXT.md

</decisions>

<specifics>
## Specific Ideas

- The bash `run_step_captured` (lines 685-716) uses `tee -a` to capture output while displaying -- the zx equivalent should use a writable stream that forks to both stdout and a file
- The bash `construct_debug_prompt` (lines 516-568) produces a structured XML prompt with `<objective>`, `<symptoms>`, `<mode>`, `<debug_file>`, and `<files_to_read>` sections -- the slug pattern is `autopilot-${stepName}-retry-${retryNum}` and `<files_to_read>` lists CONTEXT, PLAN, and SUMMARY files from the phase directory
- The bash `run_verification_gate` (lines 1106-1156) loops until valid input, re-presenting the gate after each fix cycle
- The bash `run_fix_cycle` (lines 1084-1104) resets the circuit breaker counter before and after fix -- the zx version should do the same
- Gap closure inner loop (bash lines 382-442) drives each fix phase through the full lifecycle including `run_step_with_retry` for execute and `run_verify_with_debug_retry` + `run_verification_gate` for verify
- Milestone version extraction strips the `v` prefix from STATE.md frontmatter: `"v1.2"` becomes `"1.2"` for the `/gsd:complete-milestone` command
- The completion prompt includes an `IMPORTANT:` block telling Claude to auto-approve all interactive confirmations (bash lines 489-495)
- The bash `write_failure_report` (lines 607-683) writes a detailed `{padded}-FAILURE.md` with failure type, last error output, debug session paths, and resume instructions

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `autopilot.mjs` (Phase 48 output, 409 lines): The core loop, circuit breaker, logging, signal handling, and argument parsing are all implemented. This phase adds retry, gate, and audit features on top of the existing structure.
- `phase.cjs` (`findFirstIncompletePhase`, `nextIncompletePhase`, `computePhaseStatus`): Phase navigation functions already imported in `autopilot.mjs` -- used by gap closure inner loop for finding fix phases.
- `verify.cjs` (`getVerificationStatus`, `getGapsSummary`): Verification status parsing functions -- needed by verification gate to display status/score/gaps. Already exported by Phase 47.
- `config.cjs` (`CONFIG_DEFAULTS`, `getConfig` in mjs): Config access already wired in `autopilot.mjs` -- `max_debug_retries` and `max_audit_fix_iterations` are already in `CONFIG_DEFAULTS`.
- `core.cjs` (`findPhaseInternal`): Already imported in `autopilot.mjs` -- used by `getPhaseStep` function. Needed for resolving phase directories in debug prompt construction.
- `gsdTools(...)` helper function: Already in `autopilot.mjs` (line 162-165) -- used for state blocker management and phase completion via CLI dispatch.
- `autopilot.sh` (reference implementation): Contains the complete bash implementations of all three features being ported -- serves as the behavioral specification.

### Established Patterns
- `runStep(prompt, stepName)` in `autopilot.mjs`: Takes progress snapshots before/after, handles dry-run, checks circuit breaker. The new `runStepCaptured` and `runStepWithRetry` functions layer on top of this pattern.
- `gsdTools(...)` shell-out helper: Used for operations that need full CLI context (e.g., `phase complete`, `state add-blocker`). The audit and completion flows also need this pattern.
- `printBanner(text)` and `printHaltReport(...)`: Display formatting functions already in `autopilot.mjs`. The escalation report and verification gate follow the same visual style.
- Circuit breaker reset on phase advancement: Already implemented in the `complete` case (lines 399-401). Fix cycles also need circuit breaker resets.
- `tempFiles` array with `cleanupTemp()`: Already handles temp file cleanup on exit. Output capture temp files are added to this array.

### Integration Points
- `autopilot.mjs` main loop `execute` case (line 368-369): Replace `runStep` with `runStepWithRetry`
- `autopilot.mjs` main loop `verify` case (lines 373-381): Replace `runStep` with `runVerifyWithDebugRetry` + `runVerificationGate`
- `autopilot.mjs` main loop `complete` case (lines 384-403): Add milestone audit and gap closure when `nextIncompletePhase` returns null
- `autopilot.mjs` startup all-phases-complete block (lines 326-334): Replace stub with milestone audit, gap closure, and completion
- `autopilot.mjs` `printFinalReport()` (lines 297-308): Called before milestone audit in the `complete` case

</code_context>

<deferred>
## Deferred Ideas

- Entrypoint wiring in `bin/gsd-autopilot` and `--legacy` fallback (Phase 50 per roadmap)
- Renaming `autopilot.sh` to `autopilot-legacy.sh` (Phase 50 per roadmap)
- Adding `zx` to `package.json` dependencies (Phase 50 per roadmap)
- Tests for all autopilot.mjs functions including retry and gate logic (Phase 51 per roadmap)
- Updating or retiring `format-json-output.test.cjs` (Phase 50 per roadmap)

</deferred>

---

*Phase: 49-advanced-autopilot-features*
*Context gathered: 2026-03-10 via auto-context*
