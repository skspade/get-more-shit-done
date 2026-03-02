# Phase 7: Fix Gap-Path Verify & Fix Cycle - Research

**Researched:** 2026-03-02
**Domain:** Autopilot bash script bug fixes — verify loop completion and fix-cycle prompt interpolation
**Confidence:** HIGH

## Summary

Phase 7 addresses two integration bugs in autopilot.sh identified in the v1.0 milestone audit (INT-01, INT-02) and their corresponding flow breakages (FLOW-01, FLOW-02). Both bugs are in the same file (`get-shit-done/scripts/autopilot.sh`), have clear root causes visible in the current code, and have deterministic fixes.

**Bug 1 (INT-01, P1): Missing `phase complete` call after verification gate approval.** After `run_verification_gate` returns 0 (human approved) in the `verify)` case of the main loop (line 923), autopilot.sh does not call `gsd_tools phase complete`. The next iteration calls `get_phase_status`, which returns `step='verify'` again (because the phase is not marked complete in ROADMAP.md), creating an infinite verify loop. The circuit breaker catches this after 3 no-progress iterations, but the expected behavior (advance to next phase) never occurs. The fix is a single line: call `gsd_tools phase complete "$CURRENT_PHASE"` after `run_verification_gate` returns successfully.

**Bug 2 (INT-02, P2): `fix_desc` captured but not passed to agents.** `run_fix_cycle` (lines 760-780) reads the human's fix description via `read -r -p "Describe what to fix: " fix_desc` but does not interpolate `$fix_desc` into the `/gsd:plan-phase` or `/gsd:execute-phase` prompts on lines 774-775. The description is echoed to console then discarded. The fix is to append the fix description to the prompts so agents receive it as context.

Both bugs are in `get-shit-done/scripts/autopilot.sh`. No other files need modification. No new dependencies. No architectural changes.

**Primary recommendation:** Add `gsd_tools phase complete "$CURRENT_PHASE"` after the verification gate in the main loop, and interpolate `$fix_desc` into the plan-phase and execute-phase prompts in `run_fix_cycle`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VRFY-01 | Orchestrator pauses at each phase's verification checkpoint for human review | INT-01 fix: after gate approval, `phase complete` advances the phase so the verify loop terminates normally instead of circuit-breaking. The gate is already reachable (Phase 5 fix); this phase ensures post-gate behavior is correct. |
| VRFY-03 | Human can approve (continue), request fixes (triggers debug-retry), or abort at verification checkpoint | INT-01 fix: "approve" now actually advances the phase (not infinite loop). INT-02 fix: "fix" now passes the human's description to agents so the fix cycle is effective, not blind. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bash (autopilot.sh) | 5.x | Outer loop orchestrator — the only file that needs changes | Both bugs are in autopilot.sh bash functions |
| gsd-tools.cjs `phase complete` | N/A (existing CLI) | Marks phase complete in ROADMAP.md and STATE.md | Already used by execute-phase.md and transition.md; autopilot.sh already has the `gsd_tools` helper function |

### Supporting

No new supporting libraries needed. All changes are edits to existing bash code.

### Alternatives Considered

None. Both fixes are deterministic code changes to existing functions. No design alternatives exist.

**Installation:**
No installation required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure

No new files. All changes are to one existing file:

```
get-shit-done/scripts/
  autopilot.sh         # Fix verify case (INT-01) and run_fix_cycle (INT-02)
```

### Pattern 1: Phase Complete After Gate Approval

**What:** After the human verification gate returns 0 (approved), the autopilot must call `gsd_tools phase complete` to mark the phase done in ROADMAP.md before the next loop iteration.

**When to use:** Every time the verification gate approves — whether on the initial verify pass or after a fix cycle.

**Why this works:** `cmdPhaseStatus` determines the current step by checking ROADMAP.md for a `(completed YYYY-MM-DD)` marker. Without this marker, `cmdPhaseStatus` returns `step='verify'` again (because all plans have summaries but the phase is not marked complete). The `phase complete` command is what sets this marker.

**Current code (buggy) — autopilot.sh lines 912-924:**
```bash
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
      ;;
```

**Fixed code:**
```bash
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
      # Mark phase complete after gate approval (INT-01 fix)
      gsd_tools phase complete "$CURRENT_PHASE"
      ;;
```

**Key detail:** `run_verification_gate` only returns 0 when the human approves. If the human aborts, `handle_abort` calls `exit 2` and never returns. If the human chooses "fix", `run_fix_cycle` runs and then the gate re-presents (the while loop inside `run_verification_gate`). So by the time control returns to the verify case, the human has approved — it is safe to call `phase complete`.

### Pattern 2: Fix Description Interpolation in Prompts

**What:** When the human chooses "fix" at the verification gate and describes what to fix, that description must be included in the `/gsd:plan-phase` and `/gsd:execute-phase` prompts so the agents know what to fix.

**When to use:** Inside `run_fix_cycle` when constructing the Claude prompts.

**Current code (buggy) — autopilot.sh lines 760-780:**
```bash
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

  run_step "/gsd:plan-phase $phase --gaps" "fix-plan"
  run_step "/gsd:execute-phase $phase --gaps-only" "fix-execute"
  run_step "/gsd:verify-work $phase" "fix-verify"

  # Reset circuit breaker after fix cycle
  NO_PROGRESS_COUNT=0
}
```

**Fixed code:**
```bash
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
```

**Key detail:** The `--` separator is a convention that tells the skill parser "everything after this is additional context, not flags." The plan-phase and execute-phase workflows receive the full prompt string; the human fix request becomes additional context that agents can use to focus their work. The verify-work prompt does NOT need the fix description — it verifies the result, not the intent.

**Alternative approach:** Instead of appending to the prompt with `--`, the fix description could be passed as a dedicated flag (e.g., `--fix-desc "..."`) if the skill parsers support it. However, the skill workflows parse `$ARGUMENTS` as a string and can read trailing context. The `--` approach is simpler and requires no changes to skill parsers.

### Anti-Patterns to Avoid

- **Calling `phase complete` inside `run_verification_gate`:** The gate function handles the interactive loop (approve/fix/abort). Completion logic belongs in the main loop's `verify)` case, not inside the gate, because the gate may be called from different contexts in the future.
- **Omitting `phase complete` for dry-run mode:** The dry-run path also needs to mark the phase complete (or at least log what it would do). Since dry-run auto-approves the gate, it should also simulate or execute `phase complete`.
- **Quoting `$fix_desc` unsafely:** The fix description comes from user input and could contain special characters. When interpolated into a double-quoted string as part of the prompt, it is safe because `run_step` passes the entire string as a single argument to `claude -p`. However, if the description contains double quotes, they must not break the bash string. The current interpolation within double-quoted strings handles this correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marking phase complete | Custom ROADMAP.md editing in bash | `gsd_tools phase complete "$CURRENT_PHASE"` | `cmdPhaseComplete` already handles ROADMAP checkbox, STATE.md update, REQUIREMENTS.md traceability — 160+ lines of logic |
| Passing context to Claude agents | Custom env vars, temp files, or config | Append to the prompt string | Claude receives the full prompt; extra context after `--` is the standard pattern for additional instructions |

**Key insight:** Both fixes are wiring changes — connecting existing functionality that was already implemented but not called. No new functionality needs to be created.

## Common Pitfalls

### Pitfall 1: Infinite Verify Loop After Gate Approval

**What goes wrong:** After human approves at verification gate, the main loop iterates, `cmdPhaseStatus` returns `step='verify'` again, and the same gate is presented. This repeats until the circuit breaker halts after 3 iterations.

**Why it happens:** `run_verification_gate` returns 0 (success) but the verify case does not call `phase complete`. Since the phase is not marked complete, `cmdPhaseStatus` still returns `step='verify'` (all summaries exist but no completion marker).

**How to avoid:** Call `gsd_tools phase complete "$CURRENT_PHASE"` after the verification gate returns successfully.

**Warning signs:** The autopilot presents the verification gate multiple times for the same phase. The circuit breaker triggers with "no progress detected" during verify.

### Pitfall 2: Fix Description Lost in Transit

**What goes wrong:** Human describes what to fix at the gate, but the plan-phase and execute-phase agents have no knowledge of the fix request. They re-plan and re-execute generically, potentially not addressing the specific issue the human identified.

**Why it happens:** `$fix_desc` is read from stdin and echoed to console, but never interpolated into the prompt strings passed to `run_step`.

**How to avoid:** Include `$fix_desc` in the prompt strings for plan-phase and execute-phase steps.

**Warning signs:** After a "fix" cycle, the same gaps persist because the agents did not know what the human wanted fixed.

### Pitfall 3: Phase Complete Called Before Gate Returns

**What goes wrong:** If `phase complete` is called before or during the verification gate (e.g., inside `run_verification_gate`), the phase gets marked complete even if the human subsequently aborts.

**Why it happens:** Premature placement of the `phase complete` call.

**How to avoid:** Place `phase complete` AFTER the verification gate returns (in the verify case of the main loop), not inside the gate function. The gate only returns 0 on "approve" — abort calls `exit`, fix loops internally.

**Warning signs:** Phase marked complete in ROADMAP.md but human aborted at the gate.

### Pitfall 4: Dry-Run Path Missing Phase Complete

**What goes wrong:** In dry-run mode, the verification gate is auto-approved but `phase complete` may not be called, causing the same infinite loop in dry-run.

**Why it happens:** The dry-run branch handles the gate but not the subsequent phase completion.

**How to avoid:** Ensure `phase complete` is called (or dry-run logged) in both the normal and dry-run paths. Since `phase complete` is placed AFTER the if/else block for the gate, it executes in both paths.

**Warning signs:** Dry-run loops infinitely on the verify step.

## Code Examples

### Example 1: Fixed Verify Case in Main Loop

```bash
# Source: autopilot.sh main loop — verify case with INT-01 fix
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
```

### Example 2: Fixed run_fix_cycle with Prompt Interpolation

```bash
# Source: autopilot.sh — run_fix_cycle with INT-02 fix
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
```

### Example 3: gsd_tools phase complete Call Convention

```bash
# Source: autopilot.sh helper + transition.md pattern
# The gsd_tools helper wraps node invocation:
gsd_tools() {
  node "$GSD_TOOLS" "$@" --cwd "$PROJECT_DIR" 2>/dev/null
}

# Usage (same pattern as transition.md line 126):
gsd_tools phase complete "$CURRENT_PHASE"

# This calls cmdPhaseComplete in phase.cjs, which:
# 1. Marks ROADMAP.md checkbox [x] with (completed DATE)
# 2. Updates ROADMAP.md progress table
# 3. Updates STATE.md (current phase, status, last activity)
# 4. Updates REQUIREMENTS.md traceability
# 5. Returns JSON with next_phase, is_last_phase, etc.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Verify gate returns but no phase completion | Phase complete called after gate approval | This phase | Eliminates infinite verify loop (FLOW-01) |
| fix_desc captured but discarded | fix_desc interpolated into agent prompts | This phase | Human fix intent reaches agents (FLOW-02) |

**Deprecated/outdated:**
- Relying on the circuit breaker to catch the verify loop: The loop should never occur. Circuit breaker is a safety net, not normal flow control.

## Open Questions

1. **Should `phase complete` output be captured and used?**
   - What we know: `cmdPhaseComplete` returns JSON with `next_phase`, `is_last_phase`, `date`, etc. The `complete)` case in the main loop does not use this data — it calls `next_incomplete_phase` separately.
   - What's unclear: Whether capturing the output and using `next_phase` directly would be more efficient.
   - Recommendation: Do NOT change the `complete)` case. It already works correctly. Adding `phase complete` to the `verify)` case should just call it for its side effects (marking ROADMAP/STATE). The `complete)` case handles the phase advancement logic. Keep the two concerns separate. LOW risk.

2. **Should `run_fix_cycle` use `run_step_with_retry` instead of `run_step`?**
   - What we know: `run_fix_cycle` currently uses `run_step` (no retry on failure). If the fix-plan or fix-execute step fails, `run_step` halts the autopilot.
   - What's unclear: Whether failures in the fix cycle should get retry treatment.
   - Recommendation: OUT OF SCOPE for Phase 7. The current behavior (halt on failure) is acceptable for a human-initiated fix cycle. The human can re-run. This is a potential enhancement for v2.

3. **How will the prompt `-- Human fix request: $fix_desc` be parsed by plan-phase and execute-phase?**
   - What we know: Both workflows receive the full prompt string as `$ARGUMENTS`. The plan-phase workflow (step 2) extracts phase number, flags like `--gaps`, `--skip-research`, etc. Content after `--` is not a recognized flag and will remain in the arguments string. Claude (the agent executing the workflow) reads the full prompt and can use trailing context.
   - What's unclear: Whether Claude reliably uses trailing free-text context in prompts.
   - Recommendation: HIGH confidence this works. Claude processes the entire prompt string. The `-- Human fix request:` prefix clearly labels the context. The plan-phase workflow's step 2 extracts known flags but the remaining text is available to the agent. This is the same pattern used by `--auto` flag which is also free text in the prompt.

## Sources

### Primary (HIGH confidence)

- **Direct code inspection** - `get-shit-done/scripts/autopilot.sh` (946 lines): main loop verify case (lines 912-924), `run_fix_cycle` (lines 760-780), `run_verification_gate` (lines 782-834), `gsd_tools` helper (lines 80-82)
- **Direct code inspection** - `get-shit-done/bin/lib/phase.cjs` (962 lines): `cmdPhaseComplete` (lines 701-867), `cmdPhaseStatus` (lines 869-950)
- **v1.0-MILESTONE-AUDIT.md** - INT-01 (P1), INT-02 (P2), FLOW-01, FLOW-02 definitions with file/line references and evidence
- **Phase 5 VERIFICATION.md** - Confirms verify step is reachable after Phase 5 fixes; confirms `cmdPhaseStatus` returns `step='verify'` when all plans have summaries but phase not marked complete
- **Phase 5 RESEARCH.md** - Pattern 1 (corrected step inference) and Pattern 2 (dual file pattern matching) establish the current architecture that Phase 7 builds upon
- **transition.md** - Line 126 shows the canonical `phase complete` call pattern: `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete "${current_phase}"`
- **execute-phase.md** - Line 361 shows the same `phase complete` call pattern used after internal verification passes

### Secondary (MEDIUM confidence)

- **plan-phase.md** - Step 2 argument parsing confirms `--gaps` flag is recognized; step 5 confirms research is skipped for `--gaps` mode
- **execute-phase.md** - Confirms `--gaps-only` flag filters to gap_closure plans only

### Tertiary (LOW confidence)

None. All findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Single file change (autopilot.sh), no new dependencies
- Architecture: HIGH - Both bugs have deterministic fixes visible in current code; `phase complete` pattern already exists in execute-phase.md and transition.md
- Pitfalls: HIGH - All pitfalls derived from actual observed behavior documented in the milestone audit

**Research date:** 2026-03-02
**Valid until:** N/A (codebase-specific, valid until autopilot.sh changes)
