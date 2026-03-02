# Phase 5: Fix Autopilot Wiring Bugs - Research

**Researched:** 2026-03-02
**Domain:** Autopilot bash script bug fixes, gsd-tools CLI wiring, file pattern matching
**Confidence:** HIGH

## Summary

Phase 5 addresses three interconnected wiring bugs discovered during the v1.0 milestone audit. All three bugs are in existing code with clear root causes, clear fixes, and no external dependencies.

**Bug 1 (CRITICAL): `cmdPhaseStatus` missing from gsd-tools.cjs.** Plan 01-01 claimed to implement `phase-status` as a CLI command in gsd-tools.cjs with a backing `cmdPhaseStatus` function in phase.cjs. The 01-01-SUMMARY.md claims success, but neither the function nor the CLI route exist in the current codebase. The autopilot.sh `get_phase_status()` function calls `gsd_tools phase-status "$1"` which fails with "Unknown command: phase-status". This means the autopilot main loop cannot determine what step a phase is at -- the entire routing logic (`discuss|plan|execute|verify|complete`) is broken at the foundation.

**Bug 2 (CRITICAL): Verification gate bypassed in happy path.** Even after Bug 1 is fixed, the `cmdPhaseStatus` step inference logic (as specified in 01-01-PLAN.md) transitions to `step='complete'` when VERIFICATION.md exists. But `execute-phase.md` creates VERIFICATION.md internally via its `verify_phase_goal` step (spawning gsd-verifier). This means after execute-phase runs, the phase already has VERIFICATION.md, so `cmdPhaseStatus` returns `step='complete'`, bypassing the `verify)` case and `run_verification_gate` entirely. The fix requires either: (a) changing the step inference so VERIFICATION.md alone does not mean "complete", or (b) preventing execute-phase from creating VERIFICATION.md (deferring it to the verify step).

**Bug 3 (MODERATE): UAT/VERIFICATION file mismatch in debug-retry.** `run_verify_with_debug_retry` calls `extract_verification_status` which uses `find ... -name "*-VERIFICATION.md"` to locate the verification output. But `/gsd:verify-work` writes `*-UAT.md`, not VERIFICATION.md. The function returns `status=unknown`, which is treated as passed (not `gaps_found`), silently bypassing the debug-retry gap detection.

**Primary recommendation:** Implement `cmdPhaseStatus` as specified, but modify its step inference to require a completion marker (e.g., `phase_complete` flag from `phase complete` command, or a separate signal) beyond just VERIFICATION.md presence. Fix `extract_verification_status` to also search for `*-UAT.md` files.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FAIL-02 | Debug-retry loop attempts up to N fixes before escalating | Bug 3 fix: `extract_verification_status` must read UAT files so debug-retry can detect gaps_found status and actually retry |
| VRFY-01 | Orchestrator pauses at verification checkpoint for human review | Bug 1+2 fix: `cmdPhaseStatus` must exist AND return `step='verify'` (not `step='complete'`) after execute-phase, so the verification gate is reachable |
| VRFY-02 | Verification report surfaces autonomous decisions | Bug 1+2 fix: same -- gate must be reachable for decision surfacing to occur |
| VRFY-03 | Human can approve, request fixes, or abort at checkpoint | Bug 1+2 fix: same -- gate must be reachable for approve/fix/abort to work |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js (gsd-tools.cjs) | 18+ | CLI toolchain for phase status, config, state | Already in use, all phase operations route through gsd-tools.cjs |
| Bash (autopilot.sh) | 5.x | Outer loop orchestrator | Already in use, all three bugs involve autopilot.sh or its dependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jq | 1.6+ | JSON parsing in bash | Already used by autopilot.sh for parsing gsd-tools output |
| fs (Node.js built-in) | N/A | File system operations | Used by phase.cjs for artifact detection |

### Alternatives Considered

None. All fixes are to existing code. No new libraries needed.

**Installation:**
No installation required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure

No new files created. All changes are to existing files:

```
~/.claude/get-shit-done/
  bin/
    lib/
      phase.cjs          # Add cmdPhaseStatus function
    gsd-tools.cjs        # Add phase-status CLI route
  scripts/
    autopilot.sh         # Fix extract_verification_status file pattern
```

### Pattern 1: Artifact-Based State Inference

**What:** Phase lifecycle step is determined by which files exist in the phase directory. The `cmdPhaseStatus` function scans for CONTEXT.md, PLAN.md, SUMMARY.md, and VERIFICATION.md to infer where the phase is in its lifecycle.

**When to use:** Autopilot routing -- determining which GSD command to run next.

**Current specification (from 01-01-PLAN.md):**
```
- "discuss"  if !has_context
- "plan"     if has_context AND !has_plans
- "execute"  if has_plans AND !all_plans_have_summaries
- "verify"   if all_plans_have_summaries AND !has_verification
- "complete" if has_verification
```

**Problem:** The `execute-phase` workflow creates VERIFICATION.md internally (via `verify_phase_goal` step), so after execute-phase runs, the phase immediately looks "complete" to `cmdPhaseStatus`, skipping the `verify` step in the autopilot loop.

**Corrected specification:**
```
- "discuss"  if !has_context
- "plan"     if has_context AND !has_plans
- "execute"  if has_plans AND !all_plans_have_summaries
- "verify"   if all_plans_have_summaries AND !phase_complete
- "complete" if phase_complete
```

Where `phase_complete` is determined by the `phase complete` CLI command having run (which updates ROADMAP.md checkbox to `[x]`). This can be detected by checking ROADMAP.md for a completion marker on the phase, or by a dedicated marker file.

**Why this works:** The `phase complete` command (in phase.cjs `cmdPhaseComplete`) is only called after the verification gate approves. It marks the ROADMAP.md checkbox `[x]` and updates STATE.md. So `phase_complete` is true only after human approval, not just after execute-phase creates VERIFICATION.md.

### Pattern 2: Dual File Pattern Matching

**What:** When searching for verification output, check both `*-VERIFICATION.md` and `*-UAT.md` patterns because different workflows write different file types.

**When to use:** `extract_verification_status` in autopilot.sh and any code that needs to find verification results.

**Why:** `/gsd:verify-work` writes `*-UAT.md` (interactive user acceptance testing). The `verify_phase_goal` step in execute-phase writes `*-VERIFICATION.md` (automated goal verification). Both represent verification output. The autopilot needs to handle both.

### Anti-Patterns to Avoid

- **Assuming file presence equals workflow completion:** VERIFICATION.md being present does NOT mean the phase went through the verification gate. It means execute-phase's internal verifier ran. The gate is a separate human checkpoint.
- **Hard-coding a single file pattern for verification output:** Both UAT.md and VERIFICATION.md patterns must be checked. Future workflows may produce additional verification file types.
- **Modifying execute-phase.md to remove verify_phase_goal:** This is the internal quality check. Removing it would degrade execution quality. The fix is in `cmdPhaseStatus` step inference, not in execute-phase behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting phase completion | Custom state file | Check ROADMAP.md `[x]` via `roadmap analyze` or `roadmap get-phase` | ROADMAP.md is already the source of truth for phase completion. `cmdPhaseComplete` marks it. No new state needed. |
| Finding verification files | Multiple hardcoded find commands | Single function with configurable patterns | Centralizes the pattern list, future-proofs for new verification file types |

**Key insight:** The existing `searchPhaseInDir` function in core.cjs already detects `has_verification` by checking for `*-VERIFICATION.md`. This detection logic is available to `cmdPhaseStatus` but needs augmenting for the complete/verify distinction.

## Common Pitfalls

### Pitfall 1: VERIFICATION.md as Completion Signal

**What goes wrong:** `cmdPhaseStatus` returns `step='complete'` when VERIFICATION.md exists, but execute-phase creates VERIFICATION.md before the human verification gate runs.

**Why it happens:** The original design assumed VERIFICATION.md would only exist after the full verify workflow completed. But execute-phase.md has an internal `verify_phase_goal` step that creates VERIFICATION.md as part of execution, not as a separate verify step.

**How to avoid:** Use `phase_complete` (ROADMAP.md `[x]` marker) as the completion signal, not VERIFICATION.md presence.

**Warning signs:** The `verify)` case in the main loop never executes. The human verification gate is never presented.

### Pitfall 2: UAT vs VERIFICATION File Naming

**What goes wrong:** `extract_verification_status` searches for `*-VERIFICATION.md` but `/gsd:verify-work` writes `*-UAT.md`.

**Why it happens:** Two different verification workflows (automated verify-phase vs interactive verify-work) use different file naming conventions. The autopilot code only looks for one pattern.

**How to avoid:** Search for both `*-VERIFICATION.md` and `*-UAT.md` patterns. If both exist, prefer the most recently modified one.

**Warning signs:** `extract_verification_status` returns `status=unknown|score=N/A` even after verify-work has completed successfully.

### Pitfall 3: Missing cmdPhaseStatus Breaking All Routing

**What goes wrong:** `gsd_tools phase-status "$1"` returns "Unknown command: phase-status" error, and the autopilot cannot determine the current step for any phase.

**Why it happens:** Plan 01-01 claimed implementation but the code was never actually written (or was lost). The SUMMARY.md claims success but the artifact does not exist.

**How to avoid:** Implement `cmdPhaseStatus` in phase.cjs and wire it in gsd-tools.cjs as both `phase-status` (top-level) and `phase status` (subcommand).

**Warning signs:** Running `node gsd-tools.cjs phase-status 1` returns an error instead of JSON.

### Pitfall 4: Checking Phase Completion via ROADMAP.md

**What goes wrong:** ROADMAP.md parsing for `[x]` markers can be fragile if the markdown format changes.

**Why it happens:** ROADMAP.md is free-form markdown with conventions rather than strict schema.

**How to avoid:** Use `roadmap get-phase` or `roadmap analyze` which already parse ROADMAP.md and return structured JSON with a `status` field. Alternatively, detect completion by checking for the presence of the completion date in the progress table (the `phase complete` command writes this).

**Warning signs:** Completion detection returns inconsistent results for different phases.

## Code Examples

### Example 1: cmdPhaseStatus Implementation

```javascript
// Source: Derived from 01-01-PLAN.md specification + corrected step inference
function cmdPhaseStatus(cwd, phaseArg, raw) {
  if (!phaseArg) {
    error('phase required for phase-status');
  }

  const phaseInfo = findPhaseInternal(cwd, phaseArg);
  if (!phaseInfo) {
    output({
      phase: phaseArg,
      phase_dir: null,
      step: 'unknown',
      error: 'Phase not found'
    }, raw);
    return;
  }

  const hasContext = phaseInfo.has_context;
  const hasPlans = phaseInfo.plans.length > 0;
  const hasSummaries = phaseInfo.summaries.length > 0;
  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;
  const allPlansHaveSummaries = planCount > 0 && summaryCount >= planCount;
  const hasVerification = phaseInfo.has_verification;

  // Check if phase is marked complete in ROADMAP.md
  // Use roadmap analyze or check for completion marker
  const roadmapPhase = getRoadmapPhaseInternal(cwd, phaseArg);
  const phaseComplete = roadmapPhase?.status === 'complete'
    || (roadmapPhase?.section && /\(completed\s+\d{4}-\d{2}-\d{2}\)/.test(roadmapPhase.section));

  // Infer step (corrected: requires phase_complete for 'complete')
  let step;
  if (phaseComplete) {
    step = 'complete';
  } else if (!hasContext) {
    step = 'discuss';
  } else if (!hasPlans) {
    step = 'plan';
  } else if (!allPlansHaveSummaries) {
    step = 'execute';
  } else {
    step = 'verify';
  }

  output({
    phase: phaseInfo.phase_number,
    phase_dir: phaseInfo.directory,
    step,
    has_context: hasContext,
    has_research: phaseInfo.has_research,
    has_plans: hasPlans,
    plan_count: planCount,
    has_summaries: hasSummaries,
    summary_count: summaryCount,
    all_plans_have_summaries: allPlansHaveSummaries,
    has_verification: hasVerification,
    phase_complete: phaseComplete,
  }, raw);
}
```

### Example 2: Fixed extract_verification_status

```bash
# Source: autopilot.sh - fixed to check both VERIFICATION.md and UAT.md
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
```

### Example 3: gsd-tools.cjs CLI Route

```javascript
// Source: 01-01-PLAN.md specification
// In gsd-tools.cjs switch statement, add two routes:

// Top-level alias
case 'phase-status': {
  phase.cmdPhaseStatus(cwd, args[1], raw);
  break;
}

// In existing case 'phase':
} else if (subcommand === 'status') {
  phase.cmdPhaseStatus(cwd, args[2], raw);
}
```

### Example 4: extract_gaps_summary Fix

```bash
# Source: autopilot.sh - fixed to check both file types
extract_gaps_summary() {
  local phase_dir="$1"
  local verification_file

  # Check VERIFICATION.md first, then UAT.md
  verification_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-VERIFICATION.md" -type f 2>/dev/null | head -1)
  if [[ -z "$verification_file" || ! -f "$verification_file" ]]; then
    verification_file=$(find "$PROJECT_DIR/$phase_dir" -name "*-UAT.md" -type f 2>/dev/null | head -1)
  fi

  [[ -z "$verification_file" || ! -f "$verification_file" ]] && return 0

  sed -n '/^## .*[Gg]ap/,/^## [^G]/p' "$verification_file" | grep -E "^[-*]|FAILED|MISSING|STUB|NOT_WIRED" | head -10 || true
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VERIFICATION.md = complete | phase_complete from ROADMAP.md = complete | This phase | Fixes verify step bypass; allows VERIFICATION.md to coexist with verify gate |
| Search only *-VERIFICATION.md | Search *-VERIFICATION.md then *-UAT.md | This phase | Fixes debug-retry gap detection for verify-work output |

**Deprecated/outdated:**
- `step='complete' when has_verification` logic: Must be replaced with ROADMAP.md completion check

## Open Questions

1. **How does `getRoadmapPhaseInternal` report phase completion status?**
   - What we know: `cmdPhaseComplete` updates ROADMAP.md with `(completed DATE)` and marks checkbox `[x]`. `roadmap analyze` returns structured phase data.
   - What's unclear: Whether `getRoadmapPhaseInternal` already returns a `status` field or if completion must be inferred from the section text.
   - Recommendation: During implementation, check `getRoadmapPhaseInternal` return structure. If it includes a status field, use it directly. If not, pattern-match for `(completed YYYY-MM-DD)` in the section text. LOW risk -- the function exists and the data is there, just need to verify the exact field name.

2. **Should `extract_verification_status` prefer VERIFICATION.md or UAT.md when both exist?**
   - What we know: Both files can exist in the same phase directory. VERIFICATION.md is from automated checks, UAT.md is from interactive testing.
   - What's unclear: Which should take precedence for debug-retry decisions.
   - Recommendation: Prefer VERIFICATION.md (automated) as it's the primary completion signal. UAT.md is a fallback for when only interactive testing has been done. If both exist, VERIFICATION.md status is authoritative.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** - Direct reading of autopilot.sh (935 lines), phase.cjs, gsd-tools.cjs, config.cjs, core.cjs, verify.cjs, execute-phase.md, verify-work.md, verify-phase.md
- **v1.0-MILESTONE-AUDIT.md** - Integration issues section documenting all three bugs with evidence
- **01-01-PLAN.md** - Original `cmdPhaseStatus` specification with step inference logic
- **01-01-SUMMARY.md** - Claims implementation exists (contradicted by codebase)
- **03-01-PLAN.md** - Verification gate implementation referencing `extract_verification_status`
- **04-01-PLAN.md** - Debug-retry implementation referencing `run_verify_with_debug_retry`

### Secondary (MEDIUM confidence)

- **ROADMAP.md Phase 5 Success Criteria** - Defines the three acceptance tests for this phase

### Tertiary (LOW confidence)

None. All findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All changes to existing files with known interfaces
- Architecture: HIGH - Root causes identified by direct code reading, fixes are deterministic
- Pitfalls: HIGH - All pitfalls documented from actual observed bugs, not theoretical

**Research date:** 2026-03-02
**Valid until:** N/A (codebase-specific, valid until the files change)
