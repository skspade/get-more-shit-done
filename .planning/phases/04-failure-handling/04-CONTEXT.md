# Phase 4: Failure Handling - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

When execution or verification fails, the autopilot automatically diagnoses and attempts fixes before escalating to the human, with full failure context preserved in state. This phase adds a debug-retry loop to autopilot.sh that spawns gsd-debugger on failures, retries up to N times (configurable), and writes failure state to STATE.md when retries are exhausted. This phase does NOT change the verification gate flow (Phase 3) or auto-context generation (Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Failure detection
- On execution or verification failure (non-zero exit from `run_step`), the orchestrator spawns gsd-debugger to diagnose and attempt a fix rather than halting immediately (from FAIL-01)
- Failure types detected: non-zero exit code from claude -p process, verification status of `gaps_found` after verify step, and execution step producing no artifacts (from ROADMAP success criteria)
- The current `run_step` behavior of halting on non-zero-exit-with-no-progress becomes the fallback after retries are exhausted, not the primary response (Claude's Decision: current halt-on-failure is replaced by debug-retry as the first response, with halt as last resort)
- Verification failures (gaps_found) trigger the debug-retry loop automatically before presenting the human gate, giving autopilot a chance to self-heal (Claude's Decision: attempting auto-fix before asking the human reduces unnecessary escalation)

### Debug-retry loop
- The debug-retry loop attempts up to N fixes before escalating, where N defaults to 3 and is configurable via `autopilot.max_debug_retries` in .planning/config.json (from FAIL-02)
- Each retry is a fresh gsd-debugger invocation via `claude -p` with the failure context passed as prompt input -- not a continuation of the previous session (from ROADMAP success criteria)
- The debugger is spawned in `find_and_fix` mode so it diagnoses AND applies a fix, not just reports the root cause (Claude's Decision: autopilot needs autonomous fixes, not reports that require human action)
- After each debug attempt, the failed step is re-executed to check if the fix worked -- the same step (execute or verify) is retried, not the entire phase lifecycle (Claude's Decision: re-running only the failed step minimizes wasted compute while still validating the fix)
- The debug prompt includes: failure type, exit code, step name, phase number, the last N lines of stdout/stderr from the failed step, and paths to relevant phase artifacts (CONTEXT.md, PLANs, SUMMARYs) (Claude's Decision: concrete failure context lets the debugger start investigating immediately rather than gathering symptoms)
- Debug retry counter resets when the phase advances -- retries are per-step, not per-phase (Claude's Decision: a fix that works should not count against the retry budget for future failures)

### Failure state persistence
- Failure state is written to STATE.md with enough detail that a human can understand the problem and resume after manually fixing it (from FAIL-04)
- STATE.md failure fields: `failure_type` (exit_code | gaps_found | no_progress), `retry_count`, `max_retries`, `last_error` (truncated last 20 lines of stderr/stdout), `affected_plan` (plan ID if known), `affected_step` (discuss|plan|execute|verify), `debug_sessions` (list of .planning/debug/*.md paths created during retries) (Claude's Decision: structured fields over freeform text because STATE.md is consumed by both humans and scripts)
- Failure state is written via gsd-tools state operations to maintain consistency with existing STATE.md format (Claude's Decision: using gsd-tools avoids hand-editing STATE.md which could break the existing parser)
- Failure state is cleared when the step succeeds after a retry -- no stale failure data persists into the next phase (Claude's Decision: leftover failure state would confuse resume logic)

### Escalation behavior
- After retries are exhausted, the orchestrator stops cleanly with a human-readable summary of what failed, what was tried, and why it could not be fixed (from FAIL-03)
- The halt report extends the existing `print_halt_report` format with: failure type, retry attempts with brief outcome of each, debug session file paths, and a suggested resume command (Claude's Decision: extending the existing halt report rather than creating a new format maintains consistency with Phase 1's output)
- Exit code remains 1 for exhausted retries, consistent with the existing circuit-breaker halt (Claude's Decision: from the caller's perspective, both circuit-breaker and exhausted-retries mean "autopilot stopped, needs human attention" -- same exit code is appropriate)
- The escalation summary is printed to both stdout and written to a `{padded_phase}-FAILURE.md` file in the phase directory for persistent reference (Claude's Decision: terminal output disappears on scroll; a file preserves the failure context for later human review)

### Stdout/stderr capture for debug context
- The `run_step` function is modified to capture stdout/stderr to a temporary file while still piping through to the user in real-time (Claude's Decision: tee-based capture preserves transparency while enabling the debugger to see what happened)
- Only the last 100 lines of output are passed to the debugger prompt to avoid blowing up context (Claude's Decision: 100 lines is enough to see the error and its immediate context without overwhelming the 200k window)

### Integration with existing verification gate
- When verification finds gaps and the debug-retry loop is active, the loop runs before the human verification gate (Claude's Decision: attempt auto-fix first; if it succeeds, the human sees a clean verification at the gate)
- If debug-retry fixes all gaps, the human gate still presents for approval -- the human sees the fixed result (Claude's Decision: human checkpoint remains authoritative per VRFY-01 regardless of auto-fix success)
- If debug-retry exhausts retries on verification gaps, the human gate presents with the exhaustion summary alongside the gaps, giving the human full context for their fix/abort decision (Claude's Decision: combining the debug failure report with the verification gate provides a single decision point)

### Claude's Discretion
- Exact format of the debug prompt passed to gsd-debugger via claude -p
- Temporary file naming and cleanup strategy for captured stdout/stderr
- Whether to log individual retry outcomes to a debug log file
- Internal structure of the retry loop function in autopilot.sh
- How to truncate long error output (head/tail strategy)

</decisions>

<specifics>
## Specific Ideas

- The existing `run_step` function in autopilot.sh already handles non-zero exit codes and progress checking. Phase 4 wraps this with a retry loop that intercepts failures before the halt path.
- gsd-debugger already supports `symptoms_prefilled: true` and `goal: find_and_fix` modes, which is exactly what the autopilot debug-retry needs -- pre-fill symptoms from captured output, let the debugger find and fix.
- The debug-subagent-prompt template at `get-shit-done/templates/debug-subagent-prompt.md` provides the spawn format. The autopilot constructs this prompt with failure context substituted into placeholders.
- PROJECT.md lists "Debug-first failure handling" as a key decision with rationale "gsd-debugger already exists and is purpose-built for diagnosing execution failures."
- The `autopilot.max_debug_retries` config key follows the established pattern of `autopilot.circuit_breaker_threshold` added in Phase 1.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `autopilot.sh` (~460 lines): The bash outer loop engine with `run_step`, `print_halt_report`, progress tracking, circuit breaker, and verification gate. The debug-retry loop integrates here.
- `gsd-debugger.md` agent: Full debugging agent with scientific method, hypothesis testing, debug file protocol, and structured returns (ROOT CAUSE FOUND, DEBUG COMPLETE, INVESTIGATION INCONCLUSIVE). Supports `find_and_fix` mode with `symptoms_prefilled: true`.
- `debug-subagent-prompt.md` template: Standard spawn format for gsd-debugger with placeholders for issue_id, symptoms, mode, and debug_file path.
- `diagnose-issues.md` workflow: Parallel debug orchestration for UAT gaps. Demonstrates how to spawn gsd-debugger, collect results, and handle inconclusive outcomes. Pattern reference for the autopilot debug loop.
- `gsd-tools.cjs config-get/config-set`: Config management. Already supports `autopilot.circuit_breaker_threshold`. New `autopilot.max_debug_retries` follows same pattern.
- `gsd-tools.cjs state load/record-session`: STATE.md management. Failure state fields would extend the existing state schema.

### Established Patterns
- Stateless orchestration: autopilot.sh queries state each iteration, never caches. The debug-retry loop should follow the same pattern (re-read state after each retry).
- Fresh context windows: each claude -p invocation gets 200k tokens. Debug retries follow the same pattern -- each retry is a fresh invocation.
- Progress snapshot comparison: before/after commit+artifact counts. Debug retries that produce commits or artifacts count as progress for circuit breaker purposes.
- Exit codes: 0=complete, 1=halted, 2=aborted (user), 130=interrupted (SIGINT). No new exit code needed for debug failures.
- Debug file protocol: .planning/debug/{slug}.md files track investigation state across context resets. Autopilot debug retries create these files.
- Thin command dispatch: command.md -> workflow.md -> bash script. No new command or workflow needed; changes are in autopilot.sh.

### Integration Points
- Modified: `~/.claude/get-shit-done/scripts/autopilot.sh` -- add debug-retry loop wrapping `run_step`, stdout/stderr capture, failure state writing, escalation reporting
- Modified: `~/.claude/get-shit-done/workflows/autopilot.md` -- no changes expected (script handles all logic)
- Extended: `.planning/config.json` -- add `autopilot.max_debug_retries: 3` default
- Extended: `~/.claude/get-shit-done/bin/lib/config.cjs` -- add `max_debug_retries` to hardcoded defaults
- Writes: `.planning/phases/{phase_dir}/{padded_phase}-FAILURE.md` -- persistent failure report when retries exhausted
- Writes: `.planning/debug/{slug}.md` -- debug session files created by gsd-debugger during retries
- Reads: `get-shit-done/templates/debug-subagent-prompt.md` -- template for constructing debugger spawn prompts

</code_context>

<deferred>
## Deferred Ideas

- Configurable per-phase debug retry limits (AUTO-01 from v2) -- this phase implements a global default
- Learning from debug outcomes to improve future auto-context decisions (LRNG-01 from v2)
- Streaming debug progress updates to the terminal during retries (SDK-02 from v2)
- Automatic categorization of failure types for metrics/reporting -- would require a separate analytics layer
- Parallel debug retries for multiple independent failures -- current design is sequential (one failure at a time)

</deferred>

---

*Phase: 04-failure-handling*
*Context gathered: 2026-03-02 via auto-context*
