# Phase 4: Failure Handling - Research

**Researched:** 2026-03-02
**Domain:** Bash scripting, process orchestration, failure recovery
**Confidence:** HIGH

## Summary

Phase 4 adds a debug-retry loop to the existing `autopilot.sh` outer loop engine. When a step (execute or verify) fails, instead of immediately halting, the autopilot spawns `gsd-debugger` via `claude -p` to diagnose and attempt a fix. The retry loop runs up to N times (configurable, default 3) before escalating to the human with a detailed failure report.

The implementation is concentrated in a single file (`autopilot.sh`) with minor extensions to config defaults (`config.cjs`) and state management. The existing `gsd-debugger` agent already supports `find_and_fix` mode with `symptoms_prefilled: true`, and the `debug-subagent-prompt.md` template provides the spawn format. The `diagnose-issues.md` workflow demonstrates the pattern for spawning debuggers with pre-filled symptoms and collecting results.

**Primary recommendation:** Wrap the existing `run_step` function with a `run_step_with_retry` function that captures stdout/stderr via `tee`, detects failures, constructs a debugger prompt from the template, spawns `gsd-debugger` via `claude -p`, then re-runs the failed step. Keep the existing circuit breaker as the fallback after retries are exhausted.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- On execution or verification failure (non-zero exit from `run_step`), the orchestrator spawns gsd-debugger to diagnose and attempt a fix rather than halting immediately (from FAIL-01)
- Failure types detected: non-zero exit code from claude -p process, verification status of `gaps_found` after verify step, and execution step producing no artifacts (from ROADMAP success criteria)
- The current `run_step` behavior of halting on non-zero-exit-with-no-progress becomes the fallback after retries are exhausted, not the primary response
- Verification failures (gaps_found) trigger the debug-retry loop automatically before presenting the human gate
- The debug-retry loop attempts up to N fixes before escalating, where N defaults to 3 and is configurable via `autopilot.max_debug_retries` in .planning/config.json (from FAIL-02)
- Each retry is a fresh gsd-debugger invocation via `claude -p` with the failure context passed as prompt input (from ROADMAP success criteria)
- The debugger is spawned in `find_and_fix` mode so it diagnoses AND applies a fix
- After each debug attempt, the failed step is re-executed to check if the fix worked
- Debug retry counter resets when the phase advances -- retries are per-step, not per-phase
- Failure state is written to STATE.md with enough detail that a human can understand the problem and resume after manually fixing it (from FAIL-04)
- STATE.md failure fields: `failure_type`, `retry_count`, `max_retries`, `last_error`, `affected_plan`, `affected_step`, `debug_sessions`
- Failure state is written via gsd-tools state operations to maintain consistency
- Failure state is cleared when the step succeeds after a retry
- After retries are exhausted, the orchestrator stops cleanly with a human-readable summary (from FAIL-03)
- The halt report extends the existing `print_halt_report` format
- Exit code remains 1 for exhausted retries
- The escalation summary is printed to both stdout and written to a `{padded_phase}-FAILURE.md` file
- The `run_step` function is modified to capture stdout/stderr to a temporary file while still piping through to the user in real-time
- Only the last 100 lines of output are passed to the debugger prompt
- When verification finds gaps and the debug-retry loop is active, the loop runs before the human verification gate
- If debug-retry fixes all gaps, the human gate still presents for approval
- If debug-retry exhausts retries on verification gaps, the human gate presents with the exhaustion summary

### Claude's Discretion
- Exact format of the debug prompt passed to gsd-debugger via claude -p
- Temporary file naming and cleanup strategy for captured stdout/stderr
- Whether to log individual retry outcomes to a debug log file
- Internal structure of the retry loop function in autopilot.sh
- How to truncate long error output (head/tail strategy)

### Deferred Ideas (OUT OF SCOPE)
- Configurable per-phase debug retry limits (AUTO-01 from v2)
- Learning from debug outcomes to improve future auto-context decisions (LRNG-01 from v2)
- Streaming debug progress updates to the terminal during retries (SDK-02 from v2)
- Automatic categorization of failure types for metrics/reporting
- Parallel debug retries for multiple independent failures
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FAIL-01 | On execution or verification failure, orchestrator spawns gsd-debugger to diagnose and attempt fix | Existing `gsd-debugger` agent supports `find_and_fix` mode with `symptoms_prefilled: true`. `debug-subagent-prompt.md` template provides spawn format. `run_step` already detects non-zero exit codes and no-progress states. |
| FAIL-02 | Debug-retry loop attempts up to N fixes before escalating (N configurable, default 3) | `config.cjs` already supports `autopilot.*` namespace. `config-get`/`config-set` handle dot-notation paths. Pattern established by `autopilot.circuit_breaker_threshold`. |
| FAIL-03 | After debug retries exhausted, orchestrator stops cleanly and surfaces the problem for human review | `print_halt_report` function already exists in autopilot.sh. Needs extension with retry-specific fields. FAILURE.md file written to phase directory for persistence. |
| FAIL-04 | Failure state is written to STATE.md so the human can understand what went wrong and resume after fixing | `gsd-tools state load/record-session` commands exist. STATE.md has structured frontmatter + freeform sections. Failure fields extend existing schema. |
</phase_requirements>

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| autopilot.sh | `~/.claude/get-shit-done/scripts/autopilot.sh` | Outer loop engine | Single file containing all orchestration logic. All changes go here. |
| gsd-debugger.md | `~/.claude/agents/gsd-debugger.md` | Debug agent | Already supports `find_and_fix` mode. No modifications needed. |
| debug-subagent-prompt.md | `~/.claude/get-shit-done/templates/debug-subagent-prompt.md` | Spawn template | Standard format for constructing debugger prompts. Used by diagnose-issues. |
| config.cjs | `~/.claude/get-shit-done/bin/lib/config.cjs` | Config management | Handles dot-notation config paths. Hardcoded defaults. |
| gsd-tools.cjs | `~/.claude/get-shit-done/bin/gsd-tools.cjs` | CLI tool | State operations, config, commits. Entry point for all gsd-tools commands. |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| diagnose-issues.md | `~/.claude/get-shit-done/workflows/diagnose-issues.md` | Pattern reference | Shows how to spawn gsd-debugger with pre-filled symptoms and collect results |
| STATE.md | `.planning/STATE.md` | Project state | Write failure fields here for persistence across context resets |

## Architecture Patterns

### Pattern 1: Tee-Based Output Capture
**What:** Use `tee` to simultaneously display output to the user and capture it to a temporary file for the debugger.
**When to use:** Every `run_step` invocation, so that if the step fails, the captured output is available for diagnosis.
**Example:**
```bash
# Create temp file for output capture
local output_file
output_file=$(mktemp "/tmp/gsd-autopilot-XXXXXX.log")

# Execute with tee-based capture (stdout + stderr merged, piped through tee)
local exit_code=0
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") 2>&1 | tee "$output_file" || exit_code=${PIPESTATUS[0]}

# On failure, extract last N lines for debugger context
local error_context
error_context=$(tail -100 "$output_file")
```

**Important:** When using `tee` in a pipeline, `$?` gives the exit code of `tee`, not the upstream command. Use `${PIPESTATUS[0]}` (bash) or `set -o pipefail` (already set in autopilot.sh) to capture the correct exit code.

### Pattern 2: Fresh Debugger Invocations
**What:** Each debug retry is a completely new `claude -p` process with full 200k-token context, not a continuation.
**When to use:** Every retry iteration. This matches the stateless orchestration pattern used throughout autopilot.sh.
**Example:**
```bash
# Construct debug prompt from template
local debug_prompt
debug_prompt=$(construct_debug_prompt "$step_name" "$exit_code" "$error_context" "$CURRENT_PHASE")

# Spawn fresh debugger
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || true
```

### Pattern 3: Per-Step Retry Counter
**What:** Retry counter resets when the phase advances to a new step. Failures in "execute" don't consume the budget for "verify".
**When to use:** At the start of each step transition in the main loop.
**Example:**
```bash
RETRY_COUNT=0
MAX_RETRIES=$(get_config "autopilot.max_debug_retries" "3")

# Reset on step transition
case "$CURRENT_STEP" in
  execute|verify)
    RETRY_COUNT=0
    ;;
esac
```

### Pattern 4: Verification Gap Detection
**What:** After running `verify`, parse the verification file's frontmatter to detect `gaps_found` status before presenting the human gate.
**When to use:** In the `verify` case of the main loop, between `run_step` and `run_verification_gate`.
**Example:**
```bash
verify)
  run_step "/gsd:verify-work $CURRENT_PHASE" "verify"

  # Check for gaps BEFORE human gate
  local phase_dir verify_status
  phase_dir=$(get_phase_dir "$CURRENT_PHASE")
  verify_status=$(extract_verification_status "$phase_dir" | cut -d'|' -f1 | cut -d'=' -f2)

  if [[ "$verify_status" == "gaps_found" ]]; then
    # Attempt debug-retry before presenting human gate
    run_debug_retry_loop "$CURRENT_PHASE" "verify" "$verify_status"
  fi

  # Human gate always presents (even after successful debug-retry)
  run_verification_gate "$CURRENT_PHASE"
  ;;
```

### Anti-Patterns to Avoid
- **Caching state across retries:** The debug-retry loop must re-read state after each retry (stateless orchestration pattern). Don't store verification results in variables across retries.
- **Retrying the entire phase lifecycle:** Only retry the specific failed step (execute or verify), not the entire discuss-plan-execute-verify sequence.
- **Continuing after debugger failure:** If the debugger itself fails (non-zero exit), count it as a failed retry attempt and move on. Don't retry the debugger.
- **Modifying gsd-debugger.md:** The debugger agent already has all the capabilities needed. Changes go in autopilot.sh only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Output capture | Custom file writing with redirects | `tee` with temp files | Handles buffering, encoding, and concurrent writes correctly |
| Config management | Direct JSON parsing in bash | `gsd-tools config-get/config-set` | Already handles dot-notation, type coercion, defaults |
| State persistence | Direct STATE.md editing | `gsd-tools state` commands | Maintains frontmatter/content consistency |
| Debug prompt construction | Inline string concatenation | Fill `debug-subagent-prompt.md` template | Consistent format, already proven in diagnose-issues |
| Verification status parsing | grep/sed on VERIFICATION.md | `extract_verification_status` function | Already exists in autopilot.sh, handles frontmatter |

## Common Pitfalls

### Pitfall 1: PIPESTATUS vs $? with Tee
**What goes wrong:** `command | tee file` sets `$?` to tee's exit code, not the command's. If the claude process fails but tee succeeds, the failure goes undetected.
**Why it happens:** Bash pipeline exit status is the last command's exit code by default.
**How to avoid:** `set -o pipefail` is already set in autopilot.sh (line 11: `set -uo pipefail`). This makes the pipeline return the rightmost failing exit code. Verify `$?` or `${PIPESTATUS[0]}` after the pipeline.
**Warning signs:** Steps "succeed" despite claude -p returning non-zero exit.

### Pitfall 2: Infinite Debug Loops
**What goes wrong:** The debugger "fixes" something that doesn't actually address the root cause, the step fails again, another debugger spawns, and the cycle repeats until max retries.
**Why it happens:** The debugger may fix a symptom rather than the cause, or the fix may introduce a new failure.
**How to avoid:** Each retry is independently counted toward the max. After max retries, halt unconditionally. Don't reset the counter on partial success.
**Warning signs:** Same error message appearing across multiple retry iterations.

### Pitfall 3: Temp File Leaks
**What goes wrong:** Temporary files from output capture accumulate in /tmp, consuming disk space.
**Why it happens:** If the script exits via `exit 1` or signal handler, cleanup code may not run.
**How to avoid:** Use a `trap` to clean up temp files on EXIT/INT/TERM. Create all temp files in a single directory for easy cleanup.
**Warning signs:** Many `/tmp/gsd-autopilot-*.log` files accumulating.

### Pitfall 4: Context Bleeding Between Retries
**What goes wrong:** Debug session files from previous retries interfere with new debugger invocations.
**Why it happens:** gsd-debugger checks for active debug sessions on startup. If a previous retry left an unresolved session, the new debugger may try to resume it instead of starting fresh.
**How to avoid:** Each retry should use a unique debug slug (e.g., `failure-{step}-retry-{N}`). Alternatively, clean up or resolve debug files between retries.
**Warning signs:** Debugger returning "Resuming previous session" instead of investigating fresh.

### Pitfall 5: Verification Gap Detection Timing
**What goes wrong:** The debug-retry loop for verification gaps re-runs verify, but the VERIFICATION.md file from the previous run still has `gaps_found`. The new verification overwrites it, but if the loop checks the status before the new verification completes, it sees stale data.
**Why it happens:** File-based state has no locking. Read-after-write race conditions.
**How to avoid:** Always re-extract verification status AFTER the verify step completes, not before. The stateless pattern (re-read every time) handles this naturally.
**Warning signs:** Loop appears to never escape `gaps_found` even after successful fixes.

## Code Examples

### Debug Prompt Construction
```bash
construct_debug_prompt() {
  local step_name="$1"
  local exit_code="$2"
  local error_context="$3"
  local phase="$4"
  local phase_dir="$5"

  cat <<PROMPT
<objective>
Investigate and fix: Autopilot step "$step_name" failed during Phase $phase
</objective>

<symptoms>
expected: Step "$step_name" completes with exit code 0
actual: Step failed with exit code $exit_code
errors: |
$(echo "$error_context" | sed 's/^/  /')
reproduction: Run autopilot for Phase $phase, step $step_name
timeline: During autopilot execution
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/autopilot-${step_name}-failure.md
</debug_file>

<files_to_read>
- ${phase_dir}/*-CONTEXT.md
- ${phase_dir}/*-PLAN.md
- .planning/STATE.md
</files_to_read>
PROMPT
}
```

### Run Step with Retry Wrapper
```bash
run_step_with_retry() {
  local prompt="$1"
  local step_name="$2"
  local retry_count=0
  local max_retries
  max_retries=$(get_config "autopilot.max_debug_retries" "3")

  while true; do
    # Capture output while displaying in real-time
    local output_file
    output_file=$(mktemp "/tmp/gsd-autopilot-XXXXXX.log")
    TEMP_FILES+=("$output_file")

    run_step_captured "$prompt" "$step_name" "$output_file"
    local step_exit=$?

    if [[ $step_exit -eq 0 ]]; then
      # Step succeeded - clear any failure state
      clear_failure_state
      return 0
    fi

    # Step failed - attempt debug retry
    retry_count=$((retry_count + 1))
    if [[ $retry_count -gt $max_retries ]]; then
      # Retries exhausted
      write_failure_state "$step_name" "$step_exit" "$retry_count" "$max_retries" "$output_file"
      write_failure_report "$step_name" "$step_exit" "$retry_count"
      print_halt_report "Debug retries exhausted ($retry_count/$max_retries)" "$step_name" "$step_exit"
      exit 1
    fi

    echo "Debug retry $retry_count/$max_retries for step '$step_name'..." >&2

    local error_context
    error_context=$(tail -100 "$output_file")

    local phase_dir
    phase_dir=$(get_phase_dir "$CURRENT_PHASE")

    local debug_prompt
    debug_prompt=$(construct_debug_prompt "$step_name" "$step_exit" "$error_context" "$CURRENT_PHASE" "$phase_dir")

    # Spawn fresh debugger
    (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || true

    # Loop continues - re-run the failed step
  done
}
```

### Failure State Writing
```bash
write_failure_state() {
  local step_name="$1"
  local exit_code="$2"
  local retry_count="$3"
  local max_retries="$4"
  local output_file="$5"

  local last_error
  last_error=$(tail -20 "$output_file")

  # Determine failure type
  local failure_type="exit_code"
  if [[ "$step_name" == "verify" ]]; then
    failure_type="gaps_found"
  fi

  # Write to STATE.md via structured update
  # (Uses the Blockers/Concerns section for failure state)
  local failure_block="- [Phase $CURRENT_PHASE]: FAILURE - type=$failure_type, step=$step_name, retries=$retry_count/$max_retries, exit_code=$exit_code"

  echo "$failure_block"
}
```

### FAILURE.md Report
```bash
write_failure_report() {
  local step_name="$1"
  local exit_code="$2"
  local retry_count="$3"

  local phase_dir
  phase_dir=$(get_phase_dir "$CURRENT_PHASE")
  local padded_phase
  padded_phase=$(printf "%02d" "$CURRENT_PHASE")

  local failure_file="$PROJECT_DIR/$phase_dir/${padded_phase}-FAILURE.md"

  cat > "$failure_file" <<EOF
# Phase $CURRENT_PHASE: Failure Report

**Generated:** $(date -Iseconds)
**Step:** $step_name
**Exit Code:** $exit_code
**Retries:** $retry_count

## What Failed

Step "$step_name" in Phase $CURRENT_PHASE failed with exit code $exit_code.

## Debug Attempts

$(for i in $(seq 1 "$retry_count"); do
  echo "### Attempt $i"
  echo "- Spawned gsd-debugger in find_and_fix mode"
  echo "- Re-ran step after fix attempt"
  echo "- Result: Step still failed"
  echo ""
done)

## Last Error Output

\`\`\`
$(tail -50 "$output_file" 2>/dev/null || echo "Output not available")
\`\`\`

## Debug Sessions

$(ls "$PROJECT_DIR/.planning/debug/autopilot-"* 2>/dev/null | sed 's/^/- /' || echo "- None created")

## Resume

To resume after manually fixing the issue:
\`\`\`
autopilot.sh --from-phase $CURRENT_PHASE --project-dir $PROJECT_DIR
\`\`\`

---
*Generated by autopilot.sh debug-retry exhaustion handler*
EOF
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Halt on first failure | Debug-retry before halting | Phase 4 (this phase) | Reduces human intervention for recoverable failures |
| Manual debugging after halt | Automated gsd-debugger spawn | Phase 4 (this phase) | Leverages existing debugging agent for autonomous recovery |
| No failure context preservation | STATE.md + FAILURE.md | Phase 4 (this phase) | Enables informed resume after manual intervention |

## Open Questions

1. **Debug file slug collision across retries**
   - What we know: Each debugger invocation creates a `.planning/debug/{slug}.md` file. Multiple retries for the same step would collide on the slug.
   - What's unclear: Whether gsd-debugger handles existing files (resume vs overwrite).
   - Recommendation: Include retry number in slug: `autopilot-{step}-retry-{N}`. This avoids collision and preserves history.

2. **Interaction between debug-retry and circuit breaker**
   - What we know: Debug retries that produce commits/artifacts would reset the circuit breaker counter (they count as "progress"). Debug retries that fail to produce anything would increment it.
   - What's unclear: Should successful debug attempts that don't ultimately fix the step count as progress for circuit breaker purposes?
   - Recommendation: Debug attempts should NOT reset the circuit breaker. Only a successful step completion should reset it. This prevents the debug loop from masking true stalls.

3. **gsd-tools state operations for failure fields**
   - What we know: `gsd-tools state load` and `gsd-tools record-session` exist. STATE.md has frontmatter and freeform sections.
   - What's unclear: Whether existing state commands support writing arbitrary failure fields to STATE.md, or if new commands are needed.
   - Recommendation: Check `gsd-tools.cjs` for state write capabilities. If insufficient, write failure state to the Blockers/Concerns section of STATE.md using simple file append, which is less fragile than modifying frontmatter.

## Sources

### Primary (HIGH confidence)
- `~/.claude/get-shit-done/scripts/autopilot.sh` — Full source read, 558 lines. All integration points identified.
- `~/.claude/agents/gsd-debugger.md` — Full agent definition read. Confirms `find_and_fix` mode, `symptoms_prefilled: true`, debug file protocol.
- `~/.claude/get-shit-done/templates/debug-subagent-prompt.md` — Template with placeholders confirmed.
- `~/.claude/get-shit-done/bin/lib/config.cjs` — Config handling source read. Confirms `autopilot.*` namespace pattern.
- `~/.claude/get-shit-done/workflows/diagnose-issues.md` — Pattern for spawning debuggers with pre-filled symptoms.

### Secondary (MEDIUM confidence)
- `.planning/phases/04-failure-handling/04-CONTEXT.md` — Design decisions from auto-context phase.
- `.planning/REQUIREMENTS.md` — FAIL-01 through FAIL-04 requirement definitions.
- `.planning/ROADMAP.md` — Phase 4 success criteria.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components exist, read source code directly
- Architecture: HIGH - Patterns derived from existing code patterns in autopilot.sh
- Pitfalls: HIGH - Identified from direct code analysis (PIPESTATUS, temp files, debug slugs)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable infrastructure, no external dependencies)
