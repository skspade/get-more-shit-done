# Phase 3: Verification Gates - Research

**Researched:** 2026-03-02
**Domain:** Bash scripting — interactive terminal gates, text parsing, control flow
**Confidence:** HIGH

## Summary

Phase 3 modifies the existing `autopilot.sh` bash script (~375 lines) to add a human verification gate after the verify step completes. The gate blocks on stdin, surfaces autonomous decisions extracted from CONTEXT.md, and routes to approve/fix/abort paths. This is purely a bash scripting task with no external dependencies — the existing script provides all patterns needed.

The core challenge is splitting the existing `verify` case into two operations (run verification, then present gate) while keeping the script's stateless design. The CONTEXT.md parsing uses grep to extract `(Claude's Decision:` annotations. The fix path reuses the existing gap-closure cycle (`plan-phase --gaps` + `execute-phase --gaps-only`).

**Primary recommendation:** Add a `run_verification_gate()` function to autopilot.sh that reads VERIFICATION.md status, extracts autonomous decisions from CONTEXT.md, presents a formatted terminal gate, and blocks on `read` for human input. Keep all new logic in this single function to minimize changes to the main loop.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- After execution completes, the bash outer loop blocks waiting for human input before proceeding to the next phase (from VRFY-01)
- The pause happens in autopilot.sh at the verify step — after `/gsd:verify-work` runs and produces VERIFICATION.md, the script reads stdin for the human response (Claude's Decision: bash `read` is the simplest blocking mechanism)
- The verify step becomes a two-part operation: first run verification, then present the report and block for input (Claude's Decision: separating verify-run from verify-gate keeps existing verify-phase workflow unchanged)
- Dry-run mode skips the human gate and auto-approves
- The verification report includes a "Decisions Made Autonomously" section listing every auto-context decision with its reasoning (from VRFY-02)
- Extract autonomous decisions by parsing CONTEXT.md for lines containing `(Claude's Decision:` (Claude's Decision: CONTEXT.md already has structured annotations)
- Autonomous decisions section appears in terminal output, not buried in VERIFICATION.md
- Each decision presented with reasoning on single line, grouped by category from CONTEXT.md
- If CONTEXT.md was human-generated (no `Source: Auto-generated` header), decisions section is omitted
- Human can type "approve" to continue, "fix" to trigger debug-retry, "abort" to stop cleanly (from VRFY-03)
- Input is case-insensitive with aliases: a/approve/yes/y, f/fix, x/abort/quit/q
- "fix" prompts for description, invokes plan-phase --gaps + execute-phase --gaps-only, re-runs verification
- "abort" writes resume command to stdout, exits with code 2
- After "fix" completes, human gate re-presents updated report and blocks again
- Verification gate uses distinct visual box clearly different from progress banners
- Gate shows: verification status, score, autonomous decisions summary, three options
- When status is "gaps_found", gaps summary included in gate display

### Claude's Discretion
- Exact wording of verification gate prompt text
- Visual formatting of autonomous decisions section (bullet list vs table)
- Whether to show a countdown or timestamp at the verification gate
- Internal structure of the verification gate function in autopilot.sh

### Deferred Ideas (OUT OF SCOPE)
- Configurable per-phase human gates (AUTO-01 from v2 requirements)
- Streaming progress updates through verification (SDK-02 from v2 requirements)
- Timeout on human response at verification gate
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VRFY-01 | Orchestrator pauses at each phase's verification checkpoint for human review | Bash `read` blocking in verify case after run_step completes; gate function reads VERIFICATION.md |
| VRFY-02 | Verification report surfaces which decisions were made autonomously | grep extraction of `(Claude's Decision:` from CONTEXT.md; check `Source: Auto-generated` header |
| VRFY-03 | Human can approve, request fixes, or abort at verification checkpoint | Case statement on read input with aliases; fix path reuses gap-closure cycle; abort exits code 2 |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| bash | 5.x | Script language for autopilot.sh | Already used; all patterns established |
| grep | GNU | Extract autonomous decisions from CONTEXT.md | Standard text extraction; `-P` for Perl regex available but basic `-E` sufficient |
| jq | 1.6+ | Parse VERIFICATION.md frontmatter (if needed) | Already a prerequisite in autopilot.sh |
| node + gsd-tools.cjs | existing | Phase status queries, gap-closure invocation | Already used throughout autopilot.sh |

### Supporting
No additional libraries or tools needed. Phase 3 is entirely additive to the existing bash script.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bash `read` | Node.js readline | Would require rewriting autopilot in JS; bash `read` is simpler and matches existing script |
| grep for CONTEXT.md parsing | awk/sed | More powerful but grep is sufficient for line-level extraction |

## Architecture Patterns

### Recommended Structure Change

The main loop's `verify)` case currently runs a single `run_step`. It becomes:

```
verify)
  run_step "/gsd:verify-work $CURRENT_PHASE" "verify"   # existing
  run_verification_gate "$CURRENT_PHASE"                  # NEW
  ;;
```

New functions added to autopilot.sh:

```
autopilot.sh (modified)
├── existing functions (unchanged)
│   ├── gsd_tools()
│   ├── print_banner()
│   ├── get_phase_status()
│   ├── get_config()
│   ├── take_progress_snapshot()
│   ├── check_progress()
│   ├── print_halt_report()
│   ├── print_final_report()
│   ├── run_step()
│   ├── next_incomplete_phase()
│   └── find_first_incomplete_phase()
├── NEW functions
│   ├── extract_autonomous_decisions()   # grep CONTEXT.md
│   ├── extract_verification_summary()   # parse VERIFICATION.md
│   ├── print_verification_gate()        # formatted terminal box
│   ├── run_verification_gate()          # orchestrates gate flow
│   └── run_fix_cycle()                  # gap-closure + re-verify
└── main loop (verify case modified)
```

### Pattern 1: Two-Phase Verify Step
**What:** Split verify into run + gate. The run_step call produces VERIFICATION.md. The gate reads it and blocks.
**When to use:** Always in autopilot mode. Dry-run skips the gate.
**Example:**
```bash
# In main loop verify case:
run_step "/gsd:verify-work $CURRENT_PHASE" "verify"
if [[ "$DRY_RUN" == true ]]; then
  echo "[DRY RUN] Auto-approving verification gate"
else
  run_verification_gate "$CURRENT_PHASE"
fi
```

### Pattern 2: Blocking Read with Input Normalization
**What:** Use bash `read` to block for human input, normalize with tr/case.
**When to use:** At the verification gate prompt.
**Example:**
```bash
local response
read -r -p "→ " response
response=$(echo "$response" | tr '[:upper:]' '[:lower:]' | xargs)  # lowercase + trim

case "$response" in
  a|approve|yes|y) return 0 ;;
  f|fix)           run_fix_cycle "$phase" ;;
  x|abort|quit|q)  handle_abort "$phase" ;;
  *)               echo "Unknown response. Enter: approve / fix / abort" ;;
esac
```

### Pattern 3: CONTEXT.md Autonomous Decision Extraction
**What:** Parse CONTEXT.md for auto-generated marker and Claude's Decision annotations.
**When to use:** When building the verification gate display (VRFY-02).
**Example:**
```bash
extract_autonomous_decisions() {
  local phase_dir="$1"
  local context_file
  context_file=$(ls "$phase_dir"/*-CONTEXT.md 2>/dev/null | head -1)

  [[ -z "$context_file" ]] && return 1

  # Check if auto-generated
  if ! grep -q "Source: Auto-generated\|Source:.*auto-context" "$context_file"; then
    return 1  # Human-generated, skip
  fi

  # Extract decisions with their reasoning
  grep "(Claude's Decision:" "$context_file" | sed 's/.*(\(Claude'\''s Decision:.*\))/\1/'
}
```

### Pattern 4: Fix Cycle with Re-gate
**What:** Run gap-closure, re-run verification, then re-present gate.
**When to use:** When human types "fix".
**Example:**
```bash
run_fix_cycle() {
  local phase="$1"
  read -r -p "Describe what to fix: " fix_desc

  run_step "/gsd:plan-phase $phase --gaps" "fix-plan"
  run_step "/gsd:execute-phase $phase --gaps-only" "fix-execute"
  run_step "/gsd:verify-work $phase" "fix-verify"

  # Re-present gate with updated results
  run_verification_gate "$phase"
}
```

### Anti-Patterns to Avoid
- **Modifying verify-phase.md or verify-work.md:** These workflows produce VERIFICATION.md unchanged. The gate is purely in autopilot.sh.
- **Storing gate state in STATE.md:** The gate is transient — it blocks the bash loop. No need to persist gate state.
- **Using `select` for menu:** `select` has numbered options that feel different from the approve/fix/abort prompt. Plain `read` with string matching is better.
- **Recursive run_verification_gate:** The fix cycle naturally calls run_verification_gate at the end. Ensure this is a loop, not unbounded recursion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom sed/awk parser | gsd-tools.cjs frontmatter commands | Already handles edge cases |
| Phase status detection | Manual file existence checks | gsd-tools.cjs phase-status | Canonical source of phase state |
| Gap-closure orchestration | Custom plan + execute | `/gsd:plan-phase --gaps` + `/gsd:execute-phase --gaps-only` | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: Stdin Redirection in Subshell
**What goes wrong:** `read` inside a pipe or subshell reads from the pipe, not the terminal.
**Why it happens:** Bash redirects stdin for pipes and command substitution.
**How to avoid:** Use `read` directly in the main script flow, not inside `$()` or pipes. If needed, explicitly read from `/dev/tty`:
```bash
read -r -p "→ " response < /dev/tty
```
**Warning signs:** `read` returns immediately with empty string.

### Pitfall 2: Circuit Breaker False Positive During Fix Cycle
**What goes wrong:** The fix cycle runs plan+execute+verify, which are 3 iterations. If the fix doesn't produce new commits, the circuit breaker triggers.
**Why it happens:** Each `run_step` calls `check_progress`, which increments `NO_PROGRESS_COUNT`.
**How to avoid:** Reset `NO_PROGRESS_COUNT` at the start of a fix cycle, or count the entire fix cycle as a single progress check.
**Warning signs:** Circuit breaker halts during legitimate fix attempts.

### Pitfall 3: VERIFICATION.md Not Found After run_step
**What goes wrong:** The gate tries to read VERIFICATION.md but it doesn't exist.
**Why it happens:** The verify step may have failed or produced no output.
**How to avoid:** Check VERIFICATION.md existence before parsing. If missing, show "Verification did not produce a report" and offer abort only.
**Warning signs:** Errors when trying to extract status/score from non-existent file.

### Pitfall 4: Exit Code 2 Conflicts
**What goes wrong:** The abort exit code (2) might be interpreted differently by callers.
**Why it happens:** The workflow autopilot.md needs to handle exit codes 0, 1, 2, 130.
**How to avoid:** Update autopilot.md workflow to recognize exit code 2 as clean abort (distinct from halt=1 and interrupt=130).
**Warning signs:** Abort displays wrong message in Claude session.

### Pitfall 5: Grep Pattern Matching Parentheses
**What goes wrong:** `grep "(Claude's Decision:"` may need escaping depending on the grep variant.
**Why it happens:** Parentheses are special in extended regex mode.
**How to avoid:** Use `grep -F "(Claude's Decision:"` for fixed-string matching (no regex interpretation).
**Warning signs:** Empty results when decisions clearly exist in CONTEXT.md.

## Code Examples

### Verification Gate Display Box
```bash
print_verification_gate() {
  local status="$1"    # passed | gaps_found | human_needed
  local score="$2"     # e.g., "5/5"
  local phase="$3"

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  CHECKPOINT: Verification Required                          ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Phase $phase verification: $status (score: $score)"
  echo ""

  # Show gaps if present
  if [[ "$status" == "gaps_found" ]]; then
    echo "Gaps:"
    # Extract gap lines from VERIFICATION.md
    echo ""
  fi

  # Show autonomous decisions if auto-generated context
  local decisions
  decisions=$(extract_autonomous_decisions "$PHASE_DIR")
  if [[ -n "$decisions" ]]; then
    echo "Decisions Made Autonomously:"
    echo "$decisions"
    echo ""
  fi

  echo "──────────────────────────────────────────────────────────────"
  echo "→ approve  — continue to next phase"
  echo "→ fix      — describe issues and trigger gap-closure"
  echo "→ abort    — stop autopilot (state preserved)"
  echo "──────────────────────────────────────────────────────────────"
}
```

### VERIFICATION.md Status Extraction
```bash
extract_verification_summary() {
  local phase_dir="$1"
  local padded_phase="$2"
  local verification_file="$phase_dir/${padded_phase}-VERIFICATION.md"

  if [[ ! -f "$verification_file" ]]; then
    echo "status=unknown|score=N/A"
    return 1
  fi

  # Extract frontmatter fields using gsd-tools
  local status score
  status=$(node "$GSD_TOOLS" frontmatter get "$verification_file" --field status 2>/dev/null || echo "unknown")
  score=$(node "$GSD_TOOLS" frontmatter get "$verification_file" --field score 2>/dev/null || echo "N/A")

  echo "status=${status}|score=${score}"
}
```

### Clean Abort with Resume Command
```bash
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
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| autopilot.sh runs verify non-interactively | Phase 3 adds blocking human gate after verify | This phase | Human review before phase advancement |
| Exit codes: 0, 1, 130 | Exit codes: 0, 1, 2, 130 | This phase | Callers distinguish abort from halt |
| Autonomous decisions hidden in CONTEXT.md | Surfaced at verification gate | This phase | Transparency for human reviewer |

## Open Questions

1. **VERIFICATION.md frontmatter parsing reliability**
   - What we know: gsd-tools.cjs has `frontmatter get` command that works with PLAN.md files
   - What's unclear: Whether it works identically with VERIFICATION.md frontmatter format
   - Recommendation: Use gsd-tools if available, fall back to grep-based extraction

2. **Fix cycle progress counting**
   - What we know: Each run_step increments the circuit breaker counter
   - What's unclear: Whether fix cycle steps should count toward circuit breaker or be exempt
   - Recommendation: Reset NO_PROGRESS_COUNT before fix cycle; the fix cycle is human-initiated so it should not trigger circuit breaker

## Sources

### Primary (HIGH confidence)
- `autopilot.sh` source code — direct inspection of existing patterns and functions
- `verify-phase.md` workflow — produces VERIFICATION.md with status/score frontmatter
- `verify-work.md` workflow — conversational UAT, separate from phase verification
- Phase 1 verification report — confirms all existing autopilot behavior
- Phase 2 verification report — confirms auto-context annotation patterns
- `03-CONTEXT.md` — locked decisions and design constraints

### Secondary (MEDIUM confidence)
- Bash `read` builtin documentation — stdin blocking behavior, `/dev/tty` fallback
- GNU grep `-F` flag — fixed-string matching for parentheses in patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new tools, pure bash additions to existing script
- Architecture: HIGH — clear function decomposition, single file modification, patterns established by Phase 1
- Pitfalls: HIGH — identified from direct code analysis of existing script

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — stable bash patterns)
