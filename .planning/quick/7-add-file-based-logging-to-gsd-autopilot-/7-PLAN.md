---
phase: quick-7
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/scripts/autopilot.sh
autonomous: true
requirements: [QUICK-7]
must_haves:
  truths:
    - "Every autopilot run writes a persistent log file to .planning/logs/"
    - "Log captures all step transitions, progress snapshots, errors, and circuit breaker events"
    - "When autopilot halts, the halt report includes the log file path"
    - "Log file survives process exit (not cleaned up like temp files)"
  artifacts:
    - path: "get-shit-done/scripts/autopilot.sh"
      provides: "File-based logging for autopilot sessions"
      contains: "LOG_FILE"
  key_links:
    - from: "autopilot.sh log_msg function"
      to: "LOG_FILE"
      via: "append writes throughout execution"
      pattern: "log_msg"
---

<objective>
Add file-based logging to the GSD Autopilot so that when it circuit-breaks, fails, or halts, a persistent log file exists showing exactly what happened, what went wrong, and where it got lost.

Purpose: Currently autopilot output goes to stdout/stderr and temp files that get cleaned up. When it fails 3 times and circuit breaks, there is no persistent record to diagnose what went wrong.

Output: Modified autopilot.sh with logging to .planning/logs/autopilot-{timestamp}.log
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/scripts/autopilot.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add logging infrastructure and instrument autopilot.sh</name>
  <files>get-shit-done/scripts/autopilot.sh</files>
  <action>
Add file-based logging to autopilot.sh with these changes:

1. **Create log directory and file** — After argument parsing and before prerequisites, add:
   - Create `.planning/logs/` directory if it doesn't exist (in PROJECT_DIR)
   - Set `LOG_FILE="$PROJECT_DIR/.planning/logs/autopilot-$(date +%Y%m%d-%H%M%S).log"`
   - Write a session header to the log (timestamp, project dir, from-phase, dry-run flag)

2. **Add a `log_msg` helper function** — Simple append function:
   ```
   log_msg() {
     echo "[$(date +%H:%M:%S)] $*" >> "$LOG_FILE"
   }
   ```

3. **Instrument key points with log_msg calls:**
   - `print_banner` — log the banner text
   - `check_progress` — log the before/after snapshots and whether progress was detected, including the no-progress count
   - `run_step_captured` — log step start, exit code, and snapshot diff
   - `run_step_with_retry` — log each retry attempt and debug prompt invocation
   - `run_verify_with_debug_retry` — log verify attempts and gap findings
   - `print_halt_report` — log the full halt report content AND append "Log file: $LOG_FILE" to the halt report output
   - `print_escalation_report` — log the escalation
   - `print_final_report` — log completion
   - `run_milestone_audit` — log audit result and status
   - `run_gap_closure_loop` — log each iteration
   - Main loop — log each phase/step transition

4. **Add log file path to halt report output** — In `print_halt_report`, add a line: `echo "Log file: $LOG_FILE"` so the user knows where to look.

5. **Add log file path to startup banner** — After the existing startup echo lines, add: `echo "Log file: $LOG_FILE"`

6. **Capture claude command stderr to log** — In `run_step_captured`, tee stderr to the log file as well. Modify the claude invocation to also append stderr to the log:
   ```
   (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") 2> >(tee -a "$LOG_FILE" >&2) | format_json_output | tee -a "$output_file"
   ```

7. **Do NOT log full claude stdout** to the log file (it would be enormous). Only log metadata: step name, exit code, progress snapshots, errors. The existing temp file capture via `output_file` already handles full output for debug retries.

8. **Log the ITERATION_LOG entries** — When circuit breaker triggers or halt report prints, dump all ITERATION_LOG entries to the log file.

Keep changes minimal and surgical. The log_msg function should be simple (just echo >> append). Do not add any external dependencies or complex log rotation.
  </action>
  <verify>
    <automated>cd /Users/seanspade/Documents/Source/get-more-shit-done && bash -n get-shit-done/scripts/autopilot.sh && grep -c "log_msg" get-shit-done/scripts/autopilot.sh | xargs test 10 -le</automated>
  </verify>
  <done>
    - autopilot.sh passes bash syntax check
    - log_msg function exists and is called at least 10 times throughout the script
    - LOG_FILE variable is set after argument parsing
    - .planning/logs/ directory is created at startup
    - print_halt_report includes the log file path in its output
    - Startup banner includes the log file path
    - No full claude stdout is piped to the log file (only metadata)
  </done>
</task>

<task type="auto">
  <name>Task 2: Add --dry-run smoke test for logging</name>
  <files>get-shit-done/scripts/autopilot.sh</files>
  <action>
Run the autopilot in dry-run mode against a temporary test project to verify logging works end-to-end:

1. Create a temporary directory with minimal .planning/ structure (mkdir -p, touch STATE.md/ROADMAP.md/config.json with minimal content, create a phase directory with a PLAN.md)
2. Run `bash get-shit-done/scripts/autopilot.sh --dry-run --project-dir /tmp/test-project`
3. Verify that a log file was created in `/tmp/test-project/.planning/logs/autopilot-*.log`
4. Verify the log file contains expected entries (session header, step transitions, dry-run markers)
5. Clean up the temp directory

If the dry-run reveals any bash errors or missing variable issues, fix them in autopilot.sh.
  </action>
  <verify>
    <automated>cd /Users/seanspade/Documents/Source/get-more-shit-done && bash -n get-shit-done/scripts/autopilot.sh</automated>
  </verify>
  <done>
    - Dry-run execution produces a log file in .planning/logs/
    - Log file contains timestamped entries
    - No bash errors during dry-run execution
    - autopilot.sh still passes syntax check after any fixes
  </done>
</task>

</tasks>

<verification>
- `bash -n get-shit-done/scripts/autopilot.sh` passes (syntax valid)
- `grep -c "log_msg" get-shit-done/scripts/autopilot.sh` shows 10+ call sites
- `grep "LOG_FILE" get-shit-done/scripts/autopilot.sh` shows variable definition and usage in halt report + startup banner
- Dry-run produces a log file with timestamped entries
</verification>

<success_criteria>
- Autopilot writes a persistent log file to .planning/logs/autopilot-{timestamp}.log on every run
- Log captures step transitions, progress snapshots, errors, retry attempts, and circuit breaker events
- Halt report and startup banner both display the log file path
- Log does not contain full claude stdout (only metadata)
- No existing autopilot behavior is changed (logging is additive only)
</success_criteria>

<output>
After completion, create `.planning/quick/7-add-file-based-logging-to-gsd-autopilot-/7-SUMMARY.md`
</output>
