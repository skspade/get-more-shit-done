# Phase 11: Gap Closure Loop - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Autopilot automatically plans fixes for audit gaps, executes fix phases, re-audits, and repeats until the audit passes or iteration limits are exhausted. This phase transforms autopilot.sh from a linear "run phases then audit then exit" flow into a self-healing loop that closes its own gaps. It does NOT handle milestone completion after a passing audit (Phase 12 scope).

</domain>

<decisions>
## Implementation Decisions

### Loop Architecture
- Replace the current `exit 10` (gaps found) code path with a loop that invokes `plan-milestone-gaps`, runs generated fix phases through the existing phase loop, and re-audits (from REQUIREMENTS.md LOOP-01, LOOP-02, LOOP-03, LOOP-04)
- The gap closure loop wraps the existing main `while true` phase loop -- after audit returns gaps, plan fixes, then re-enter the phase loop for the new phases, then re-audit (Claude's Decision: the existing phase loop already handles discuss/plan/execute/verify/complete for any phase; reuse it rather than duplicating lifecycle logic)
- Track audit-fix iteration count in a variable that persists across loop iterations, incrementing each time audit returns `gaps_found` (from REQUIREMENTS.md LOOP-04)
- Both audit trigger points (startup all-complete path at line 944 and main loop complete case at line 1018) must feed into the gap closure loop (Claude's Decision: both paths currently exit with code 10 on gaps; both need the same loop treatment for consistency)

### Gap Planning Invocation
- Invoke `/gsd:plan-milestone-gaps` via `claude -p` with fresh context window when audit returns gaps (from REQUIREMENTS.md LOOP-01)
- Use `run_step_with_retry` for the gap planning invocation so debug-retry handles failures (Claude's Decision: plan-milestone-gaps is a complex multi-step workflow that can fail; same resilience pattern as audit invocation)
- The plan-milestone-gaps workflow currently has an interactive confirmation gate (step 5: "Wait for user confirmation") -- autopilot invocation must bypass this by passing `--auto` or equivalent signal in the prompt (Claude's Decision: autopilot is autonomous; interactive gates must be skipped just like discuss-phase uses --auto)

### Fix Phase Execution
- After plan-milestone-gaps creates new fix phases in ROADMAP.md, re-enter the existing phase loop to execute them (from REQUIREMENTS.md LOOP-02)
- Use `find_first_incomplete_phase` to locate the newly created fix phases after gap planning completes (Claude's Decision: plan-milestone-gaps adds new phases with higher numbers; find_first_incomplete_phase will naturally find them)
- Fix phases go through the full lifecycle: discuss (auto), plan (auto), execute, verify, complete -- same as any other phase (Claude's Decision: fix phases are structurally identical to normal phases; no special handling needed)

### Re-Audit After Fix Phases
- After all fix phases complete (next_incomplete_phase returns empty again), automatically re-run `run_milestone_audit` (from REQUIREMENTS.md LOOP-03)
- The re-audit is the same `run_milestone_audit` function already implemented in Phase 10 -- no new audit logic needed (Claude's Decision: reuse existing function; the loop structure provides the repetition)

### Iteration Limiting and Escalation
- Track iteration count starting at 0, increment before each gap planning invocation (from REQUIREMENTS.md LOOP-04)
- When iteration count reaches the configured max, print escalation report and exit with a distinct code instead of starting another fix cycle (from REQUIREMENTS.md LOOP-05)
- Escalation report includes: iterations exhausted count, remaining gaps summary, audit file path, and resume command (Claude's Decision: operators need enough context to diagnose why gaps persist after N attempts)
- Exit code for escalation: exit 1 with clear escalation banner, using `print_halt_report` pattern (Claude's Decision: exit 1 is appropriate since this is a failure to converge; distinct from exit 0 (success) and exit 10 (gaps found, loop continues))

### Configuration
- Read max iterations from config.json via `get_config "autopilot.max_audit_fix_iterations" "3"` (from REQUIREMENTS.md CONF-01)
- Config key is `autopilot.max_audit_fix_iterations` under the established `autopilot.*` namespace (Claude's Decision: follows existing naming convention like `autopilot.circuit_breaker_threshold`)
- Default value is 3 when config key is not set (from ROADMAP.md success criteria 5)

### Integration with Existing Autopilot Flow
- The gap closure loop must be a function or inline loop that replaces the current `exit 10` paths in autopilot.sh
- Reset circuit breaker (`NO_PROGRESS_COUNT=0`) before each gap closure iteration (Claude's Decision: each audit-fix cycle is a fresh attempt; circuit breaker should track progress within iterations, not across them)
- Reset `ITERATION_LOG` between gap closure iterations to avoid stale entries (Claude's Decision: same rationale as circuit breaker reset; each cycle is a fresh scope)
- After gap closure loop succeeds (audit passes), flow continues to wherever exit 0 currently goes -- ready for Phase 12 to wire in milestone completion (Claude's Decision: clean boundary; Phase 12 handles what happens after passing audit)

### Claude's Discretion
- Exact variable name for iteration counter (e.g., `AUDIT_FIX_ITERATION` vs `GAP_CLOSURE_ITERATION`)
- Whether to extract the gap closure loop into a named function or inline it at the two trigger points
- Exact banner text and formatting for escalation messages
- Whether to log each iteration's audit status to a file or just to stdout
- Internal structure of the escalation report

</decisions>

<specifics>
## Specific Ideas

- The `plan-milestone-gaps` workflow (step 5) has an interactive confirmation gate: "Create these {X} phases? (yes / adjust / defer all optional)". In autopilot mode, this must be auto-confirmed. The prompt should include a directive like "Auto-approve all gap closure phases without prompting" similar to how discuss-phase uses `--auto`.
- Config.json currently has `{"autopilot": {"circuit_breaker_threshold": 3}}`. The new `max_audit_fix_iterations` key goes alongside it: `{"autopilot": {"circuit_breaker_threshold": 3, "max_audit_fix_iterations": 3}}`.
- The existing `run_milestone_audit` function returns 0 (passed/tech-debt-accepted), 10 (gaps found), or 1 (error). The loop only continues on return 10; return 0 exits successfully, return 1 halts with error.
- Exit code contract established by Phase 10: `0 = passed`, `10 = gaps_found`. The gap closure loop consumes code 10 internally rather than propagating it as an exit.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `run_milestone_audit` function (autopilot.sh line 200): Invokes audit, parses result, routes by status -- reuse directly for re-audit cycles
- `run_step_with_retry` function (autopilot.sh line 467): Runs Claude steps with debug-retry -- use for gap planning invocation
- `find_first_incomplete_phase` function (autopilot.sh line 689): Finds next phase to work on -- use after gap planning creates new fix phases
- `get_config` function (autopilot.sh line 97): Reads config.json with defaults -- use for `max_audit_fix_iterations`
- `print_halt_report` function (autopilot.sh line 147): Formatted halt output -- use or extend for escalation report
- `print_banner` function (autopilot.sh line 84): Banner formatting -- use for gap closure iteration banners

### Established Patterns
- All Claude invocations use `claude -p --dangerously-skip-permissions --output-format json` with fresh context windows
- Config keys live under `autopilot.*` namespace in `.planning/config.json`
- Exit codes: 0 (success), 1 (error), 2 (user abort), 10 (gaps found), 130 (SIGINT)
- Circuit breaker and progress tracking wrap step invocations
- Two audit trigger points exist: startup all-complete (line 944) and main loop complete case (line 1018)

### Integration Points
- Startup all-complete path (autopilot.sh lines 939-955): Currently exits 0 or 10 -- needs gap closure loop
- Main loop complete case (autopilot.sh lines 1013-1031): Currently exits 0 or 10 -- needs gap closure loop
- `/gsd:plan-milestone-gaps` command: Invoked via `claude -p` to create fix phases from audit gaps
- `.planning/config.json`: Where `autopilot.max_audit_fix_iterations` will be read from
- Phase 12 (Milestone Completion): Will consume exit 0 signal after gap closure loop succeeds

</code_context>

<deferred>
## Deferred Ideas

- Milestone completion invocation after audit passes (Phase 12 scope)
- Partial gap closure or selective gap fixing (explicitly out of scope per REQUIREMENTS.md)
- Interactive audit review between iterations (out of scope -- autopilot is autonomous)
- Persisting iteration count across autopilot restarts (Claude's Decision to defer: iteration count is ephemeral; restarting autopilot resets it, which is acceptable since the audit file reflects actual state)

</deferred>

---

*Phase: 11-gap-closure-loop*
*Context gathered: 2026-03-03 via auto-context*
