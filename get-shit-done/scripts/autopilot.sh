#!/usr/bin/env bash
# GSD Autopilot — Outer loop engine that drives GSD phases autonomously
# with fresh context windows per step and circuit-breaks on stalls.
#
# Usage:
#   autopilot.sh [--from-phase N] [--project-dir PATH] [--dry-run]
#
# Each GSD lifecycle step (discuss, plan, execute, verify) is invoked as a
# separate `claude -p` process, ensuring fresh 200k-token context windows.

set -uo pipefail

# ─── Path Resolution ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GSD_HOME="$(cd "$SCRIPT_DIR/.." && pwd)"
GSD_TOOLS="$GSD_HOME/bin/gsd-tools.cjs"

# ─── Argument Parsing ─────────────────────────────────────────────────────────

PROJECT_DIR=""
FROM_PHASE=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-phase)
      FROM_PHASE="$2"
      shift 2
      ;;
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: autopilot.sh [--from-phase N] [--project-dir PATH] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

# Default project dir to current directory
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

# ─── Prerequisites ────────────────────────────────────────────────────────────

command -v claude >/dev/null 2>&1 || {
  echo "Error: claude CLI not found on PATH. Install Claude Code first." >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || {
  echo "Error: jq not found on PATH. Install jq (https://jqlang.github.io/jq/)." >&2
  exit 1
}

command -v node >/dev/null 2>&1 || {
  echo "Error: node not found on PATH. Node.js 18+ required." >&2
  exit 1
}

if [[ ! -d "$PROJECT_DIR/.planning" ]]; then
  echo "Error: .planning/ directory not found in $PROJECT_DIR" >&2
  echo "Run /gsd:new-project first to initialize." >&2
  exit 1
fi

if [[ ! -f "$GSD_TOOLS" ]]; then
  echo "Error: gsd-tools.cjs not found at $GSD_TOOLS" >&2
  exit 1
fi

# ─── Helper Functions ─────────────────────────────────────────────────────────

gsd_tools() {
  node "$GSD_TOOLS" "$@" --cwd "$PROJECT_DIR" 2>/dev/null
}

print_banner() {
  local text="$1"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " GSD ► AUTOPILOT: $text"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

get_phase_status() {
  gsd_tools phase-status "$1"
}

get_config() {
  local key="$1"
  local default_val="${2:-}"
  local val
  val=$(gsd_tools config-get "$key" 2>/dev/null || echo "")
  if [[ -z "$val" || "$val" == "null" || "$val" == "undefined" ]]; then
    echo "$default_val"
  else
    echo "$val"
  fi
}

# ─── Progress Tracking (Circuit Breaker) ──────────────────────────────────────

NO_PROGRESS_COUNT=0
CIRCUIT_BREAKER_THRESHOLD=3
ITERATION_LOG=()
TOTAL_ITERATIONS=0
TEMP_FILES=()
MAX_DEBUG_RETRIES=3

take_progress_snapshot() {
  local commits artifacts
  commits=$(cd "$PROJECT_DIR" && git rev-list --count HEAD 2>/dev/null || echo 0)
  artifacts=$(find "$PROJECT_DIR/.planning/phases" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "${commits}|${artifacts}"
}

check_progress() {
  local before="$1"
  local after="$2"
  local step_desc="$3"

  TOTAL_ITERATIONS=$((TOTAL_ITERATIONS + 1))

  if [[ "$before" == "$after" ]]; then
    NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
    ITERATION_LOG+=("Iteration $TOTAL_ITERATIONS ($step_desc): NO PROGRESS - snapshot unchanged ($before)")

    if [[ $NO_PROGRESS_COUNT -ge $CIRCUIT_BREAKER_THRESHOLD ]]; then
      print_halt_report "Circuit breaker triggered" "$step_desc" "N/A"
      exit 1
    fi
    echo "WARNING: No progress detected ($NO_PROGRESS_COUNT/$CIRCUIT_BREAKER_THRESHOLD consecutive)" >&2
  else
    NO_PROGRESS_COUNT=0
    ITERATION_LOG=()
  fi
}

print_halt_report() {
  local reason="$1"
  local step="$2"
  local exit_code="$3"

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  AUTOPILOT HALTED                                           ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Reason: $reason"
  echo "Phase: $CURRENT_PHASE"
  echo "Step: $step"
  echo "Exit code: $exit_code"
  echo "Total iterations: $TOTAL_ITERATIONS"
  echo "Consecutive no-progress: $NO_PROGRESS_COUNT"
  echo ""

  # Show debug retry info if debug sessions were created
  local debug_sessions
  debug_sessions=$(ls "$PROJECT_DIR/.planning/debug/autopilot-"*.md 2>/dev/null || true)
  if [[ -n "$debug_sessions" ]]; then
    echo "Debug sessions created:"
    echo "$debug_sessions" | sed 's/^/  - /'
    echo ""
  fi

  echo "Last iterations:"
  for entry in "${ITERATION_LOG[@]}"; do
    echo "  - $entry"
  done
  echo ""
  echo "Progress signals checked:"
  echo "  - Git commit count"
  echo "  - Artifact file count in .planning/phases/"
  echo ""
  echo "To resume: autopilot.sh --from-phase $CURRENT_PHASE --project-dir $PROJECT_DIR"
  echo ""
}

print_escalation_report() {
  local iterations="$1"
  local max_iterations="$2"

  local audit_file
  audit_file=$(ls -t "$PROJECT_DIR/.planning/v"*"-MILESTONE-AUDIT.md" 2>/dev/null | head -1)

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  AUTOPILOT ESCALATION                                       ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Gap closure exhausted: $iterations/$max_iterations iterations completed"
  echo "Audit gaps persist after $iterations fix cycles."
  echo ""
  if [[ -n "$audit_file" ]]; then
    echo "Latest audit: $audit_file"
    echo ""
  fi
  echo "The autopilot could not converge to a passing audit."
  echo "Human review is required to diagnose remaining gaps."
  echo ""
  echo "To resume after manual fixes:"
  echo "  autopilot.sh --project-dir $PROJECT_DIR"
  echo ""
}

print_final_report() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " GSD ► AUTOPILOT COMPLETE ✓"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "All phases complete."
  echo "Total iterations: $TOTAL_ITERATIONS"
  echo ""
}

# ─── Milestone Audit ─────────────────────────────────────────────────────────

run_milestone_audit() {
  print_banner "MILESTONE AUDIT"

  # Invoke audit-milestone via claude with retry support
  local audit_prompt="/gsd:audit-milestone"
  local audit_exit=0
  run_step_with_retry "$audit_prompt" "milestone-audit" || audit_exit=$?

  if [[ $audit_exit -ne 0 ]]; then
    echo "ERROR: Milestone audit failed (exit $audit_exit)" >&2
    return 1
  fi

  # Locate the most recent audit file
  local audit_file
  audit_file=$(ls -t "$PROJECT_DIR/.planning/v"*"-MILESTONE-AUDIT.md" 2>/dev/null | head -1)

  if [[ -z "$audit_file" ]]; then
    echo "ERROR: No MILESTONE-AUDIT.md file found after audit" >&2
    return 1
  fi

  # Parse audit status from frontmatter
  local audit_status
  audit_status=$(gsd_tools frontmatter get "$audit_file" --field status --raw 2>/dev/null || echo "")

  if [[ -z "$audit_status" ]]; then
    echo "ERROR: Could not parse status from $audit_file" >&2
    return 1
  fi

  echo "Audit result: $audit_status"

  # Read tech debt config
  local auto_accept_tech_debt
  auto_accept_tech_debt=$(get_config "autopilot.auto_accept_tech_debt" "true")

  # Route based on status
  case "$audit_status" in
    passed)
      print_banner "MILESTONE AUDIT PASSED ✓"
      echo "All requirements satisfied. Ready for milestone completion."
      return 0
      ;;
    gaps_found)
      print_banner "MILESTONE AUDIT: GAPS FOUND"
      echo "Audit found gaps that need fixing."
      return 10
      ;;
    tech_debt)
      if [[ "$auto_accept_tech_debt" == "true" ]]; then
        print_banner "MILESTONE AUDIT PASSED ✓ (tech debt accepted)"
        echo "Audit found tech debt only. auto_accept_tech_debt=true — treating as passed."
        return 0
      else
        print_banner "MILESTONE AUDIT: GAPS FOUND (tech debt rejected)"
        echo "Audit found tech debt. auto_accept_tech_debt=false — treating as gaps."
        return 10
      fi
      ;;
    *)
      echo "ERROR: Unknown audit status '$audit_status'" >&2
      return 1
      ;;
  esac
}

# ─── Gap Closure Loop ────────────────────────────────────────────────────────

run_gap_closure_loop() {
  local max_iterations
  max_iterations=$(get_config "autopilot.max_audit_fix_iterations" "3")
  local iteration=0

  while true; do
    # Check iteration limit BEFORE planning
    if [[ $iteration -ge $max_iterations ]]; then
      print_escalation_report "$iteration" "$max_iterations"
      exit 1
    fi

    iteration=$((iteration + 1))

    print_banner "GAP CLOSURE: Iteration $iteration/$max_iterations"

    # Reset circuit breaker and iteration log for fresh cycle
    NO_PROGRESS_COUNT=0
    ITERATION_LOG=()

    # LOOP-01: Invoke plan-milestone-gaps to create fix phases
    local gap_plan_prompt="/gsd:plan-milestone-gaps --auto"
    local gap_plan_exit=0
    run_step_with_retry "$gap_plan_prompt" "gap-planning" || gap_plan_exit=$?

    if [[ $gap_plan_exit -ne 0 ]]; then
      echo "ERROR: Gap planning failed (exit $gap_plan_exit)" >&2
      print_escalation_report "$iteration" "$max_iterations"
      exit 1
    fi

    # LOOP-02: Execute fix phases through existing phase loop
    while true; do
      local fix_phase
      fix_phase=$(find_first_incomplete_phase)

      if [[ -z "$fix_phase" ]]; then
        # All fix phases complete — break to re-audit
        break
      fi

      CURRENT_PHASE="$fix_phase"

      # Reset progress tracking for each fix phase
      NO_PROGRESS_COUNT=0
      ITERATION_LOG=()

      # Run the fix phase through the normal lifecycle
      while true; do
        local status_json step
        status_json=$(get_phase_status "$CURRENT_PHASE")
        step=$(echo "$status_json" | jq -r '.step')

        case "$step" in
          discuss)
            run_step "/gsd:discuss-phase $CURRENT_PHASE --auto" "discuss"
            ;;
          plan)
            run_step "/gsd:plan-phase $CURRENT_PHASE --auto" "plan"
            ;;
          execute)
            run_step_with_retry "/gsd:execute-phase $CURRENT_PHASE" "execute"
            local exec_exit=$?
            if [[ $exec_exit -ne 0 ]]; then
              print_halt_report "Fix phase execution failed after debug retries" "execute" "$exec_exit"
              exit 1
            fi
            ;;
          verify)
            run_verify_with_debug_retry "$CURRENT_PHASE"
            local verify_exit=$?
            if [[ $verify_exit -ne 0 ]]; then
              print_halt_report "Fix phase verification failed after debug retries" "verify" "$verify_exit"
              exit 1
            fi
            if [[ "$DRY_RUN" == true ]]; then
              echo "[DRY RUN] Auto-approving verification gate"
            else
              run_verification_gate "$CURRENT_PHASE"
            fi
            gsd_tools phase complete "$CURRENT_PHASE"
            ;;
          complete)
            print_banner "Fix Phase $CURRENT_PHASE COMPLETE ✓"
            break
            ;;
          *)
            echo "ERROR: Unknown step '$step' for fix phase $CURRENT_PHASE" >&2
            exit 1
            ;;
        esac
      done
    done

    # LOOP-03: Re-run milestone audit after fix phases complete
    print_banner "RE-AUDIT: After iteration $iteration"

    local audit_result=0
    run_milestone_audit || audit_result=$?

    if [[ $audit_result -eq 0 ]]; then
      # Audit passed — gap closure successful
      print_banner "GAP CLOSURE COMPLETE ✓"
      echo "Audit passed after $iteration iteration(s)."
      return 0
    elif [[ $audit_result -eq 10 ]]; then
      # LOOP-04: Gaps still found — loop continues
      echo "Gaps remain after iteration $iteration. Continuing..."
      continue
    else
      # Audit error
      echo "ERROR: Milestone audit encountered an error during re-audit" >&2
      exit 1
    fi
  done
}

# ─── Milestone Completion ────────────────────────────────────────────────────

run_milestone_completion() {
  print_banner "MILESTONE COMPLETION"

  # Extract milestone version from STATE.md
  local version_raw
  version_raw=$(gsd_tools frontmatter get .planning/STATE.md --field milestone --raw 2>/dev/null || echo "")

  if [[ -z "$version_raw" ]]; then
    echo "ERROR: Could not extract milestone version from STATE.md" >&2
    echo "Expected frontmatter field 'milestone' (e.g., 'milestone: v1.2')" >&2
    print_halt_report "Milestone version extraction failed" "milestone-completion" "1"
    exit 1
  fi

  # Strip "v" prefix: "v1.2" -> "1.2"
  local version="${version_raw#v}"

  echo "Completing milestone: $version_raw ($version)"

  # Invoke complete-milestone via claude with retry support
  local completion_prompt="/gsd:complete-milestone $version

IMPORTANT: This is running in autopilot mode. Auto-approve ALL interactive confirmations including:
- Milestone readiness verification
- Phase directory archival
- Any other confirmation prompts
Do not wait for human input at any step."

  local completion_exit=0
  run_step_with_retry "$completion_prompt" "milestone-completion" || completion_exit=$?

  if [[ $completion_exit -ne 0 ]]; then
    echo "ERROR: Milestone completion failed (exit $completion_exit)" >&2
    print_halt_report "Milestone completion failed after retries" "milestone-completion" "$completion_exit"
    exit 1
  fi

  print_banner "MILESTONE COMPLETE ✓"
  echo "Milestone $version_raw completed successfully."
  echo "Archival, PROJECT.md evolution, and commit performed."
  echo ""

  return 0
}

# ─── Step Execution ───────────────────────────────────────────────────────────

construct_debug_prompt() {
  local step_name="$1"
  local exit_code="$2"
  local error_context="$3"
  local phase="$4"
  local phase_dir="$5"
  local retry_num="$6"

  local slug="autopilot-${step_name}-retry-${retry_num}"

  local phase_files=""
  if [[ -n "$phase_dir" ]]; then
    local ctx_files
    ctx_files=$(ls "$PROJECT_DIR/$phase_dir"/*-CONTEXT.md 2>/dev/null | sed 's/^/- /' || true)
    local plan_files
    plan_files=$(ls "$PROJECT_DIR/$phase_dir"/*-PLAN.md 2>/dev/null | sed 's/^/- /' || true)
    local sum_files
    sum_files=$(ls "$PROJECT_DIR/$phase_dir"/*-SUMMARY.md 2>/dev/null | sed 's/^/- /' || true)
    phase_files="${ctx_files}
${plan_files}
${sum_files}"
  fi

  cat <<DBGPROMPT
<objective>
Investigate and fix: Autopilot step "${step_name}" failed during Phase ${phase}

**Summary:** Step "${step_name}" exited with code ${exit_code} during autonomous execution. This is debug retry ${retry_num}.
</objective>

<symptoms>
expected: Step "${step_name}" completes successfully with exit code 0
actual: Step failed with exit code ${exit_code}
errors: |
$(echo "${error_context}" | sed 's/^/  /')
reproduction: Run autopilot for Phase ${phase}, step ${step_name}
timeline: During autopilot execution
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/${slug}.md
</debug_file>

<files_to_read>
${phase_files}
- .planning/STATE.md
</files_to_read>
DBGPROMPT
}

write_failure_state() {
  local step_name="$1"
  local exit_code="$2"
  local retry_count="$3"
  local max_retries="$4"
  local output_file="$5"

  # Determine failure type
  local failure_type="exit_code"
  if [[ "$step_name" == "verify" || "$step_name" == "verify-gaps" ]]; then
    failure_type="gaps_found"
  fi

  # Collect debug session paths
  local debug_sessions
  debug_sessions=$(ls "$PROJECT_DIR/.planning/debug/autopilot-"*.md 2>/dev/null | tr '\n' ', ' | sed 's/,$//' || echo "None created")

  # Write failure state as a blocker in STATE.md
  local blocker_text="[Phase $CURRENT_PHASE FAILURE]: type=$failure_type | step=$step_name | retries=$retry_count/$max_retries | exit_code=$exit_code | debug_sessions=$debug_sessions"
  gsd_tools state add-blocker --text "$blocker_text" 2>/dev/null || {
    echo "WARNING: Could not write failure state to STATE.md" >&2
  }
}

clear_failure_state() {
  # Remove any failure blockers for the current phase
  local existing_blockers
  existing_blockers=$(gsd_tools state get blockers 2>/dev/null || echo "")

  if echo "$existing_blockers" | grep -q "Phase $CURRENT_PHASE FAILURE"; then
    local blocker_text
    blocker_text=$(echo "$existing_blockers" | grep "Phase $CURRENT_PHASE FAILURE" | head -1 | sed 's/^[[:space:]]*-[[:space:]]*//')
    gsd_tools state resolve-blocker --text "$blocker_text" 2>/dev/null || true
  fi
}

write_failure_report() {
  local step_name="$1"
  local exit_code="$2"
  local retry_count="$3"
  local max_retries="$4"
  local output_file="$5"

  local phase_dir
  phase_dir=$(get_phase_dir "$CURRENT_PHASE" 2>/dev/null || echo ".planning/phases/unknown")
  local padded_phase
  padded_phase=$(printf "%02d" "$CURRENT_PHASE" 2>/dev/null || echo "$CURRENT_PHASE")

  local failure_file="$PROJECT_DIR/$phase_dir/${padded_phase}-FAILURE.md"

  # Determine failure type
  local failure_type="exit_code"
  if [[ "$step_name" == "verify" || "$step_name" == "verify-gaps" ]]; then
    failure_type="gaps_found"
  fi

  # Collect debug sessions
  local debug_sessions_list
  debug_sessions_list=$(ls "$PROJECT_DIR/.planning/debug/autopilot-"*.md 2>/dev/null | sed 's/^/- /' || echo "- None created")

  # Collect last error output
  local last_error
  last_error=$(tail -50 "$output_file" 2>/dev/null || echo "Output not available")

  # Failure type description
  local type_desc
  case "$failure_type" in
    exit_code) type_desc="The step process returned a non-zero exit code, indicating a crash or error." ;;
    gaps_found) type_desc="Verification found gaps that could not be automatically fixed by the debugger." ;;
    *) type_desc="Unknown failure type." ;;
  esac

  cat > "$failure_file" <<FAILEOF
# Phase $CURRENT_PHASE: Failure Report

**Generated:** $(date -Iseconds 2>/dev/null || date)
**Failure Type:** $failure_type
**Step:** $step_name
**Exit Code:** $exit_code
**Retries:** $retry_count/$max_retries

## What Failed

Step "$step_name" in Phase $CURRENT_PHASE failed with exit code $exit_code.
After $retry_count debug retry attempts (max: $max_retries), the issue could not be automatically resolved.

## Failure Type

- **$failure_type**: $type_desc

## Last Error Output

\`\`\`
$last_error
\`\`\`

## Debug Sessions

$debug_sessions_list

## Resume

After manually fixing the issue, resume with:
\`\`\`
autopilot.sh --from-phase $CURRENT_PHASE --project-dir $PROJECT_DIR
\`\`\`

---
*Generated by autopilot.sh debug-retry exhaustion handler*
FAILEOF

  echo "Failure report written to: $failure_file" >&2
}

run_step_captured() {
  local prompt="$1"
  local step_name="$2"
  local output_file="$3"

  print_banner "Phase $CURRENT_PHASE > $step_name"

  local snapshot_before
  snapshot_before=$(take_progress_snapshot)

  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY RUN] Would execute: claude -p ..." | tee -a "$output_file"
    check_progress "$snapshot_before" "$snapshot_before" "$step_name (dry-run)"
    return 0
  fi

  # Execute Claude Code with output capture via tee
  # pipefail (set at top of script) ensures we get claude's exit code, not tee's
  local exit_code=0
  (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") 2>&1 | tee -a "$output_file" || exit_code=$?

  local snapshot_after
  snapshot_after=$(take_progress_snapshot)

  check_progress "$snapshot_before" "$snapshot_after" "$step_name"

  return $exit_code
}

run_step_with_retry() {
  local prompt="$1"
  local step_name="$2"
  local retry_count=0

  while true; do
    # Create temp file for output capture
    local output_file
    output_file=$(mktemp "/tmp/gsd-autopilot-XXXXXX")
    TEMP_FILES+=("$output_file")

    local step_exit=0
    run_step_captured "$prompt" "$step_name" "$output_file" || step_exit=$?

    if [[ $step_exit -eq 0 ]]; then
      # Success - clear any failure state
      clear_failure_state
      return 0
    fi

    retry_count=$((retry_count + 1))
    if [[ $retry_count -gt $MAX_DEBUG_RETRIES ]]; then
      echo ""
      echo "Debug retries exhausted ($retry_count/$MAX_DEBUG_RETRIES) for step '$step_name'." >&2
      write_failure_state "$step_name" "$step_exit" "$retry_count" "$MAX_DEBUG_RETRIES" "$output_file"
      write_failure_report "$step_name" "$step_exit" "$retry_count" "$MAX_DEBUG_RETRIES" "$output_file"
      return $step_exit
    fi

    echo ""
    echo "◆ Debug retry $retry_count/$MAX_DEBUG_RETRIES for step '$step_name'..." >&2
    echo ""

    # Extract last 100 lines of output for debugger context
    local error_context
    error_context=$(tail -100 "$output_file" 2>/dev/null || echo "No output captured")

    local phase_dir
    phase_dir=$(get_phase_dir "$CURRENT_PHASE" 2>/dev/null || echo "")

    # Construct and run debug prompt
    local debug_prompt
    debug_prompt=$(construct_debug_prompt "$step_name" "$step_exit" "$error_context" "$CURRENT_PHASE" "$phase_dir" "$retry_count")

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " GSD ► AUTOPILOT: Debug Retry $retry_count/$MAX_DEBUG_RETRIES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Spawn fresh debugger (failure of debugger itself is NOT fatal)
    (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || {
      echo "WARNING: Debugger itself returned non-zero. Continuing to next retry." >&2
    }

    # Loop continues - re-run the failed step on next iteration
  done
}

run_verify_with_debug_retry() {
  local phase="$1"
  local retry_count=0

  while true; do
    # Run verify step with output capture
    local output_file
    output_file=$(mktemp "/tmp/gsd-autopilot-XXXXXX")
    TEMP_FILES+=("$output_file")

    local verify_exit=0
    run_step_captured "/gsd:verify-work $phase" "verify" "$output_file" || verify_exit=$?

    # If verify step itself crashed, use the retry loop
    if [[ $verify_exit -ne 0 ]]; then
      retry_count=$((retry_count + 1))
      if [[ $retry_count -gt $MAX_DEBUG_RETRIES ]]; then
        echo "Debug retries exhausted for verify step." >&2
        write_failure_state "verify" "$verify_exit" "$retry_count" "$MAX_DEBUG_RETRIES" "$output_file"
        write_failure_report "verify" "$verify_exit" "$retry_count" "$MAX_DEBUG_RETRIES" "$output_file"
        return $verify_exit
      fi

      echo ""
      echo "◆ Debug retry $retry_count/$MAX_DEBUG_RETRIES for verify crash..." >&2
      local error_context
      error_context=$(tail -100 "$output_file" 2>/dev/null || echo "No output captured")
      local phase_dir
      phase_dir=$(get_phase_dir "$phase" 2>/dev/null || echo "")
      local debug_prompt
      debug_prompt=$(construct_debug_prompt "verify" "$verify_exit" "$error_context" "$phase" "$phase_dir" "$retry_count")

      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo " GSD ► AUTOPILOT: Debug Retry $retry_count/$MAX_DEBUG_RETRIES"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""

      (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || true
      continue
    fi

    # Verify succeeded (exit 0) - check for gaps in verification status
    local phase_dir verify_data verify_status
    phase_dir=$(get_phase_dir "$phase")
    verify_data=$(extract_verification_status "$phase_dir")
    verify_status=$(echo "$verify_data" | cut -d'|' -f1 | cut -d'=' -f2)

    if [[ "$verify_status" != "gaps_found" ]]; then
      # No gaps - verification passed, clear failure state
      clear_failure_state
      return 0
    fi

    # Gaps found - attempt debug retry
    retry_count=$((retry_count + 1))
    if [[ $retry_count -gt $MAX_DEBUG_RETRIES ]]; then
      echo ""
      echo "Debug retries exhausted ($retry_count/$MAX_DEBUG_RETRIES) for verification gaps." >&2
      write_failure_state "verify-gaps" "0" "$retry_count" "$MAX_DEBUG_RETRIES" "$output_file"
      write_failure_report "verify-gaps" "0" "$retry_count" "$MAX_DEBUG_RETRIES" "$output_file"
      # Return 0 so the human gate still presents (with exhaustion context)
      return 0
    fi

    echo ""
    echo "◆ Verification found gaps. Debug retry $retry_count/$MAX_DEBUG_RETRIES..." >&2
    echo ""

    local gaps_summary
    gaps_summary=$(extract_gaps_summary "$phase_dir")

    local error_context="Verification status: gaps_found
Gaps:
$gaps_summary"

    local debug_prompt
    debug_prompt=$(construct_debug_prompt "verify-gaps" "0" "$error_context" "$phase" "$phase_dir" "$retry_count")

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " GSD ► AUTOPILOT: Gap Fix $retry_count/$MAX_DEBUG_RETRIES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || true

    # Loop continues - re-run verification to check if gaps are fixed
  done
}

run_step() {
  local prompt="$1"
  local step_name="$2"

  print_banner "Phase $CURRENT_PHASE > $step_name"

  local snapshot_before
  snapshot_before=$(take_progress_snapshot)

  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY RUN] Would execute:"
    echo "  claude -p --dangerously-skip-permissions --output-format json \"$prompt\""
    echo ""
    # Still check progress (will be unchanged = no progress) to trigger circuit breaker
    check_progress "$snapshot_before" "$snapshot_before" "$step_name (dry-run)"
    return 0
  fi

  # Execute Claude Code with fresh context window
  # Let stdout/stderr flow directly to user (transparency)
  local exit_code=0
  (cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") || exit_code=$?

  local snapshot_after
  snapshot_after=$(take_progress_snapshot)

  check_progress "$snapshot_before" "$snapshot_after" "$step_name"

  if [[ $exit_code -ne 0 ]]; then
    # Check if artifacts changed despite non-zero exit (partial success)
    if [[ "$snapshot_before" == "$snapshot_after" ]]; then
      echo "ERROR: Step '$step_name' failed with exit code $exit_code and no artifacts created" >&2
      print_halt_report "Step failure with no progress" "$step_name" "$exit_code"
      exit 1
    else
      echo "WARNING: Step '$step_name' exited with code $exit_code but made progress. Continuing." >&2
    fi
  fi
}

# ─── Phase Navigation ────────────────────────────────────────────────────────

next_incomplete_phase() {
  local current="$1"
  local roadmap_json
  roadmap_json=$(gsd_tools roadmap analyze 2>/dev/null || echo '{"phases":[]}')

  # Get all phase numbers from roadmap
  local phases
  phases=$(echo "$roadmap_json" | jq -r '.phases[]?.number // empty' 2>/dev/null)

  local found_current=false
  for phase_num in $phases; do
    if [[ "$found_current" == true ]]; then
      # Check if this phase is incomplete
      local status_json
      status_json=$(get_phase_status "$phase_num" 2>/dev/null || echo '{}')
      local phase_complete
      phase_complete=$(echo "$status_json" | jq -r '.phase_complete // false' 2>/dev/null)

      if [[ "$phase_complete" != "true" ]]; then
        echo "$phase_num"
        return 0
      fi
    fi

    if [[ "$phase_num" == "$current" ]]; then
      found_current=true
    fi
  done

  # No more incomplete phases
  echo ""
}

find_first_incomplete_phase() {
  local roadmap_json
  roadmap_json=$(gsd_tools roadmap analyze 2>/dev/null || echo '{"phases":[]}')

  local phases
  phases=$(echo "$roadmap_json" | jq -r '.phases[]?.number // empty' 2>/dev/null)

  if [[ -z "$phases" ]]; then
    echo "Error: No phases found in ROADMAP.md" >&2
    exit 1
  fi

  for phase_num in $phases; do
    local status_json
    status_json=$(get_phase_status "$phase_num" 2>/dev/null || echo '{}')
    local phase_complete
    phase_complete=$(echo "$status_json" | jq -r '.phase_complete // false' 2>/dev/null)

    if [[ "$phase_complete" != "true" ]]; then
      echo "$phase_num"
      return 0
    fi
  done

  # All phases complete
  echo ""
}

# ─── Verification Gate ────────────────────────────────────────────────────────

get_phase_dir() {
  local phase="$1"
  local status_json
  status_json=$(get_phase_status "$phase")
  echo "$status_json" | jq -r '.phase_dir'
}

extract_autonomous_decisions() {
  local phase_dir="$1"
  local context_file
  context_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-CONTEXT.md" -type f 2>/dev/null | head -1)

  [[ -z "$context_file" || ! -f "$context_file" ]] && return 0

  # Only extract for auto-generated context
  if ! grep -qF "auto-context" "$context_file" && ! grep -qF "Auto-generated" "$context_file"; then
    return 0
  fi

  # Extract lines containing Claude's Decision annotation
  grep -F "(Claude's Decision:" "$context_file" | sed 's/^[[:space:]]*-[[:space:]]*/  - /' || true
}

extract_verification_status() {
  local phase_dir="$1"
  local verification_file

  # Check for VERIFICATION.md first (automated verify-phase)
  verification_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-VERIFICATION.md" -type f 2>/dev/null | head -1)

  # Fall back to UAT.md (interactive verify-work)
  if [[ -z "$verification_file" || ! -f "$verification_file" ]]; then
    verification_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-UAT.md" -type f 2>/dev/null | head -1)
  fi

  if [[ -z "$verification_file" || ! -f "$verification_file" ]]; then
    echo "status=unknown|score=N/A"
    return 1
  fi

  local status score
  status=$(node "$GSD_TOOLS" frontmatter get "$verification_file" --field status 2>/dev/null || echo "unknown")
  score=$(node "$GSD_TOOLS" frontmatter get "$verification_file" --field score 2>/dev/null || echo "N/A")

  echo "status=${status}|score=${score}"
}

extract_gaps_summary() {
  local phase_dir="$1"
  local verification_file

  # Check VERIFICATION.md first, then UAT.md
  verification_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-VERIFICATION.md" -type f 2>/dev/null | head -1)
  if [[ -z "$verification_file" || ! -f "$verification_file" ]]; then
    verification_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-UAT.md" -type f 2>/dev/null | head -1)
  fi

  [[ -z "$verification_file" || ! -f "$verification_file" ]] && return 0

  # Extract lines from gaps-related sections
  sed -n '/^## .*[Gg]ap/,/^## [^G]/p' "$verification_file" | grep -E "^[-*]|FAILED|MISSING|STUB|NOT_WIRED" | head -10 || true
}

print_verification_gate() {
  local phase="$1"
  local status="$2"
  local score="$3"
  local decisions="$4"
  local gaps="$5"

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  CHECKPOINT: Verification Required                          ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Phase $phase verification: $status (score: $score)"
  echo ""

  # Show gaps if present
  if [[ "$status" == "gaps_found" && -n "$gaps" ]]; then
    echo "Gaps found:"
    echo "$gaps"
    echo ""
  fi

  # Show autonomous decisions if present
  if [[ -n "$decisions" ]]; then
    echo "Decisions Made Autonomously:"
    echo "$decisions"
    echo ""
  fi

  echo "──────────────────────────────────────────────────────────────"
  echo "→ approve  — continue to next phase"
  echo "→ fix      — describe issues and trigger gap-closure cycle"
  echo "→ abort    — stop autopilot cleanly (state preserved)"
  echo "──────────────────────────────────────────────────────────────"
}

handle_abort() {
  local phase="$1"
  echo ""
  echo "Autopilot aborted by user at Phase $phase verification."
  echo ""
  echo "State preserved. To resume:"
  echo "  autopilot.sh --from-phase $phase --project-dir $PROJECT_DIR"
  echo ""
  exit 2
}

run_fix_cycle() {
  local phase="$1"
  local fix_desc

  read -r -p "Describe what to fix: " fix_desc < /dev/tty

  echo ""
  echo "Running gap-closure cycle for Phase $phase..."
  echo "Fix request: $fix_desc"
  echo ""

  # Reset circuit breaker for fix cycle (human-initiated, should not trigger breaker)
  NO_PROGRESS_COUNT=0

  run_step "/gsd:plan-phase $phase --gaps -- Human fix request: $fix_desc" "fix-plan"
  run_step "/gsd:execute-phase $phase --gaps-only -- Human fix request: $fix_desc" "fix-execute"
  run_step "/gsd:verify-work $phase" "fix-verify"

  # Reset circuit breaker after fix cycle
  NO_PROGRESS_COUNT=0
}

run_verification_gate() {
  local phase="$1"

  while true; do
    local phase_dir
    phase_dir=$(get_phase_dir "$phase")

    # Extract verification data
    local verify_data status score
    verify_data=$(extract_verification_status "$phase_dir")
    status=$(echo "$verify_data" | cut -d'|' -f1 | cut -d'=' -f2)
    score=$(echo "$verify_data" | cut -d'|' -f2 | cut -d'=' -f2)

    # Extract autonomous decisions
    local decisions
    decisions=$(extract_autonomous_decisions "$phase_dir")

    # Extract gaps if applicable
    local gaps=""
    if [[ "$status" == "gaps_found" ]]; then
      gaps=$(extract_gaps_summary "$phase_dir")
    fi

    # Display gate
    print_verification_gate "$phase" "$status" "$score" "$decisions" "$gaps"

    # Read human input
    local response
    read -r -p "→ " response < /dev/tty
    response=$(echo "$response" | tr '[:upper:]' '[:lower:]' | xargs)

    case "$response" in
      a|approve|yes|y)
        echo ""
        echo "✓ Phase $phase approved. Continuing..."
        return 0
        ;;
      f|fix)
        run_fix_cycle "$phase"
        # Loop continues — re-presents gate with updated verification
        ;;
      x|abort|quit|q)
        handle_abort "$phase"
        ;;
      *)
        echo ""
        echo "Unknown response: '$response'"
        echo "Enter: approve / fix / abort"
        echo ""
        ;;
    esac
  done
}

# ─── Signal Handling ──────────────────────────────────────────────────────────

cleanup_temp() {
  for f in "${TEMP_FILES[@]}"; do
    rm -f "$f" 2>/dev/null
  done
}

cleanup() {
  cleanup_temp
  echo ""
  echo ""
  echo "Autopilot interrupted (SIGINT)."
  echo "Phase $CURRENT_PHASE was in progress."
  echo ""
  echo "To resume: autopilot.sh --from-phase $CURRENT_PHASE --project-dir $PROJECT_DIR"
  echo ""
  exit 130
}

trap cleanup SIGINT SIGTERM
trap cleanup_temp EXIT

# ─── Configuration ────────────────────────────────────────────────────────────

CIRCUIT_BREAKER_THRESHOLD=$(get_config "autopilot.circuit_breaker_threshold" "3")
MAX_DEBUG_RETRIES=$(get_config "autopilot.max_debug_retries" "3")

# ─── Determine Starting Phase ────────────────────────────────────────────────

if [[ -n "$FROM_PHASE" ]]; then
  CURRENT_PHASE="$FROM_PHASE"
else
  CURRENT_PHASE=$(find_first_incomplete_phase)
  if [[ -z "$CURRENT_PHASE" ]]; then
    print_banner "ALL PHASES COMPLETE ✓"
    echo "All phases in the milestone are already complete."

    # All phases already complete — trigger milestone audit
    AUDIT_RESULT=0
    run_milestone_audit || AUDIT_RESULT=$?

    if [[ $AUDIT_RESULT -eq 0 ]]; then
      exit 0
    elif [[ $AUDIT_RESULT -eq 10 ]]; then
      # Gaps found — enter gap closure loop
      run_gap_closure_loop
      # If loop returns 0, audit passed
      exit 0
    else
      echo "ERROR: Milestone audit encountered an error" >&2
      exit 1
    fi
  fi
fi

# ─── Startup Banner ──────────────────────────────────────────────────────────

STATUS_JSON=$(get_phase_status "$CURRENT_PHASE")
CURRENT_STEP=$(echo "$STATUS_JSON" | jq -r '.step')

print_banner "STARTING"
echo "Project: $PROJECT_DIR"
echo "Starting phase: $CURRENT_PHASE"
echo "Starting step: $CURRENT_STEP"
echo "Circuit breaker: $CIRCUIT_BREAKER_THRESHOLD consecutive iterations"
echo "Debug retries: $MAX_DEBUG_RETRIES per step"
echo "Dry run: $DRY_RUN"
echo ""

# ─── Main Loop ────────────────────────────────────────────────────────────────

while true; do
  STATUS_JSON=$(get_phase_status "$CURRENT_PHASE")
  CURRENT_STEP=$(echo "$STATUS_JSON" | jq -r '.step')

  case "$CURRENT_STEP" in
    discuss)
      run_step "/gsd:discuss-phase $CURRENT_PHASE --auto" "discuss"
      ;;
    plan)
      run_step "/gsd:plan-phase $CURRENT_PHASE --auto" "plan"
      ;;
    execute)
      run_step_with_retry "/gsd:execute-phase $CURRENT_PHASE" "execute"
      exec_exit=$?
      if [[ $exec_exit -ne 0 ]]; then
        print_halt_report "Execution failed after debug retries" "execute" "$exec_exit"
        exit 1
      fi
      ;;
    verify)
      run_verify_with_debug_retry "$CURRENT_PHASE"
      verify_exit=$?
      if [[ $verify_exit -ne 0 ]]; then
        print_halt_report "Verification failed after debug retries" "verify" "$verify_exit"
        exit 1
      fi
      # Verification gate: block for human review (VRFY-01, VRFY-02, VRFY-03)
      if [[ "$DRY_RUN" == true ]]; then
        echo "[DRY RUN] Auto-approving verification gate"
      else
        run_verification_gate "$CURRENT_PHASE"
      fi
      # Mark phase complete after gate approval (INT-01 fix: closes FLOW-01)
      gsd_tools phase complete "$CURRENT_PHASE"
      ;;
    complete)
      print_banner "Phase $CURRENT_PHASE COMPLETE ✓"

      NEXT_PHASE=$(next_incomplete_phase "$CURRENT_PHASE")
      if [[ -z "$NEXT_PHASE" ]]; then
        print_final_report

        # All phases complete — trigger milestone audit
        AUDIT_RESULT=0
        run_milestone_audit || AUDIT_RESULT=$?

        if [[ $AUDIT_RESULT -eq 0 ]]; then
          # Audit passed (or tech debt accepted) — signal milestone completion
          exit 0
        elif [[ $AUDIT_RESULT -eq 10 ]]; then
          # Gaps found (or tech debt rejected) — enter gap closure loop
          run_gap_closure_loop
          # If loop returns 0, audit passed
          exit 0
        else
          # Audit failed with error
          echo "ERROR: Milestone audit encountered an error" >&2
          exit 1
        fi
      fi

      CURRENT_PHASE="$NEXT_PHASE"
      # Reset no-progress counter on phase advancement (this IS progress)
      NO_PROGRESS_COUNT=0
      ITERATION_LOG=()
      continue
      ;;
    *)
      echo "ERROR: Unknown step '$CURRENT_STEP' for phase $CURRENT_PHASE" >&2
      exit 1
      ;;
  esac
done
