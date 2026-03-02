# Phase 6: Verify Phase 4 Implementation - Research

**Researched:** 2026-03-02
**Domain:** Phase verification, bash code inspection, requirement traceability
**Confidence:** HIGH

## Summary

Phase 6 is a verification-only phase. No new code needs to be written. The goal is to run the `verify-phase` workflow against Phase 4's failure handling implementation and produce a `04-VERIFICATION.md` file that closes the 4 unverified requirement gaps (FAIL-01 through FAIL-04) identified in the v1.0 milestone audit.

The audit (`v1.0-MILESTONE-AUDIT.md`) found that Phase 4 was executed and all plans completed (04-01-SUMMARY.md and 04-02-SUMMARY.md exist), but no phase-level verification was ever performed. The SUMMARY frontmatter claims requirements-completed: [FAIL-01, FAIL-02] and [FAIL-03, FAIL-04] respectively, but without a VERIFICATION.md, the audit correctly classifies all four as "partial" status. Phase 5 also fixed integration bugs that affected Phase 4's code (UAT.md/VERIFICATION.md filename mismatch, step inference), so the verification must examine the code as it exists after Phase 5's fixes.

**Primary recommendation:** Execute the verify-phase workflow against Phase 4, using the must_haves from 04-01-PLAN.md and 04-02-PLAN.md as the verification checklist, and write `04-VERIFICATION.md` to the Phase 4 directory. The Phase 6 plan should be a single plan that invokes verification on Phase 4 and creates the report.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FAIL-01 | On execution or verification failure, orchestrator spawns gsd-debugger to diagnose and attempt fix | Verify that `run_step_with_retry` in autopilot.sh calls `construct_debug_prompt` and spawns `claude -p` with gsd-debugger prompt on step failure. Check that failure detection works for both execute and verify steps. |
| FAIL-02 | Debug-retry loop attempts up to N fixes before escalating (N configurable, default 3) | Verify that `MAX_DEBUG_RETRIES` is loaded from `autopilot.max_debug_retries` config with default 3. Verify loop counter increments and exits at threshold. Verify `config.cjs` has `max_debug_retries: 3` in hardcoded defaults. |
| FAIL-03 | After debug retries exhausted, orchestrator stops cleanly and surfaces the problem for human review | Verify that `run_step_with_retry` and `run_verify_with_debug_retry` both call `write_failure_report` on exhaustion. Verify `print_halt_report` shows debug session info. Verify FAILURE.md report includes all required sections. |
| FAIL-04 | Failure state is written to STATE.md so the human can understand what went wrong and resume after fixing | Verify that `write_failure_state` calls `gsd_tools state add-blocker` with structured failure fields. Verify `clear_failure_state` removes blockers on success. Verify failure blocker format includes type, step, retries, exit_code, debug_sessions. |
</phase_requirements>

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| verify-phase.md | `~/.claude/get-shit-done/workflows/verify-phase.md` | Phase verification workflow | Standard GSD verification workflow; produces VERIFICATION.md |
| verification-report.md | `~/.claude/get-shit-done/templates/verification-report.md` | Report template | Standard format for all phase verification reports |
| verification-patterns.md | `~/.claude/get-shit-done/references/verification-patterns.md` | Verification patterns reference | Stub detection, wiring checks, substantive checks |
| gsd-tools verify | `~/.claude/get-shit-done/bin/lib/verify.cjs` | Artifact and key-link verification commands | `verify artifacts`, `verify key-links` for automated checks |
| gsd-tools frontmatter | `~/.claude/get-shit-done/bin/gsd-tools.cjs` | Frontmatter extraction | Extract must_haves from PLAN.md frontmatter |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| autopilot.sh | `~/.claude/get-shit-done/scripts/autopilot.sh` | Implementation to verify | Read to check all Phase 4 functions exist and are substantive |
| config.cjs | `~/.claude/get-shit-done/bin/lib/config.cjs` | Config defaults | Check `max_debug_retries` default is present |
| 04-01-PLAN.md | `.planning/phases/04-failure-handling/04-01-PLAN.md` | Plan with must_haves | Source of truths, artifacts, and key_links for FAIL-01/FAIL-02 |
| 04-02-PLAN.md | `.planning/phases/04-failure-handling/04-02-PLAN.md` | Plan with must_haves | Source of truths, artifacts, and key_links for FAIL-03/FAIL-04 |
| 04-01-SUMMARY.md | `.planning/phases/04-failure-handling/04-01-SUMMARY.md` | Execution summary | Cross-reference with actual code for deviations |
| 04-02-SUMMARY.md | `.planning/phases/04-failure-handling/04-02-SUMMARY.md` | Execution summary | Cross-reference with actual code for deviations |
| v1.0-MILESTONE-AUDIT.md | `.planning/v1.0-MILESTONE-AUDIT.md` | Audit findings | Defines the 4 gaps this phase closes |

## Architecture Patterns

### Pattern 1: Goal-Backward Verification from PLAN must_haves
**What:** Extract `must_haves` (truths, artifacts, key_links) from each PLAN.md frontmatter using `gsd-tools frontmatter get`. Use these as the verification checklist rather than deriving truths from the ROADMAP goal.
**When to use:** When plans have structured must_haves in their frontmatter (Phase 4 plans do).
**Why:** PLAN.md must_haves are more specific than ROADMAP success criteria. They include concrete file paths, expected patterns, and specific function names. The verify-phase workflow prefers this source (Option A in verify-phase.md step "establish_must_haves").

**Verification flow:**
```
1. Extract must_haves from 04-01-PLAN.md and 04-02-PLAN.md
2. For each truth: check if autopilot.sh implements it
3. For each artifact: run gsd-tools verify artifacts
4. For each key_link: run gsd-tools verify key-links
5. Check requirements coverage: map FAIL-01..04 to truths
6. Scan for anti-patterns in modified files
7. Write VERIFICATION.md to Phase 4 directory
```

### Pattern 2: Code Inspection for Bash Functions
**What:** Since Phase 4 is a bash implementation (autopilot.sh), verification checks function existence, parameter handling, and control flow rather than React/API wiring patterns.
**When to use:** For verifying bash script implementations.

**Specific checks for Phase 4:**
```bash
# Function existence and line counts
grep -c "construct_debug_prompt\|run_step_with_retry\|run_verify_with_debug_retry\|write_failure_state\|clear_failure_state\|write_failure_report\|run_step_captured\|cleanup_temp" autopilot.sh

# Key wiring: retry loop calls debugger
grep "claude -p" autopilot.sh | grep -v "^#"  # Should find spawn calls

# Key wiring: failure state writes to STATE.md
grep "add-blocker\|resolve-blocker" autopilot.sh  # Should find state commands

# Key wiring: main loop uses retry-enabled functions
grep "run_step_with_retry\|run_verify_with_debug_retry" autopilot.sh | grep -v "^#\|^[[:space:]]*#"

# Config integration
grep "max_debug_retries" autopilot.sh config.cjs

# Syntax check
bash -n autopilot.sh
```

### Pattern 3: Cross-Reference Verification with SUMMARY
**What:** Compare what the SUMMARY claims was implemented against what actually exists in the code. The audit found that SUMMARY frontmatter claims are not sufficient evidence -- the verification must confirm against actual code.
**When to use:** When the audit specifically flagged "no phase-level verification was performed" and "verification_status: missing."

**Key cross-references:**
- SUMMARY 04-01 claims 5 new functions added: verify each exists in autopilot.sh
- SUMMARY 04-01 claims 8 min execution, 557->934 lines: verify line count is in range
- SUMMARY 04-02 claims 3 new functions added: verify each exists
- SUMMARY 04-02 claims 11 references to failure state functions: verify count

### Pattern 4: Write VERIFICATION.md to Phase 4 Directory (Not Phase 6)
**What:** The output VERIFICATION.md goes in `.planning/phases/04-failure-handling/04-VERIFICATION.md`, NOT in the Phase 6 directory. Phase 6 is the verification action; the report belongs with the phase being verified.
**When to use:** Always for verification phases that verify other phases.
**Why:** The audit checks for VERIFICATION.md in each phase's directory. The gap is "Phase 4 has no VERIFICATION.md." Writing it to Phase 6's directory would not close the gap.

### Anti-Patterns to Avoid
- **Trusting SUMMARY claims without code inspection:** The entire reason Phase 6 exists is that SUMMARY claims were accepted without verification. Every truth must be confirmed against actual code.
- **Skipping key_links verification:** The audit found that Phase 4's PLAN.md frontmatter includes key_links. The `gsd-tools verify key-links` command can check these automatically.
- **Writing VERIFICATION.md to Phase 6 directory:** The report must go in the Phase 4 directory to close the audit gap.
- **Verifying against pre-Phase-5 code:** Phase 5 modified autopilot.sh (fixed extract_verification_status and extract_gaps_summary). Verification must check the current code, which includes Phase 5 fixes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact verification | Manual file-exists checks | `gsd-tools verify artifacts 04-01-PLAN.md` | Checks existence, line count, pattern presence automatically |
| Key link verification | Manual grep chains | `gsd-tools verify key-links 04-01-PLAN.md` | Checks pattern presence in source/target files |
| Must-haves extraction | Manual YAML parsing | `gsd-tools frontmatter get PLAN.md --field must_haves` | Returns structured JSON from frontmatter |
| Report formatting | Freeform markdown | verification-report.md template | Standard format matching all other VERIFICATION.md files |

**Key insight:** The verification tooling already exists and was used for Phases 1-3. Phase 4 simply never had it run. Phase 6 runs the same process.

## Common Pitfalls

### Pitfall 1: Artifact Paths Use Tilde (~) in PLAN Frontmatter
**What goes wrong:** The 04-01-PLAN.md lists artifact paths as `~/.claude/get-shit-done/scripts/autopilot.sh`. The `gsd-tools verify artifacts` command resolves paths relative to cwd. Tilde paths may not resolve correctly.
**Why it happens:** Phase 4 artifacts are in the user's home directory, not the project directory. Most phases have artifacts in the project's `src/` directory.
**How to avoid:** When running `gsd-tools verify artifacts`, check if it handles tilde expansion. If not, manually verify the artifacts by reading the files at their resolved paths. The actual paths are: `$HOME/.claude/get-shit-done/scripts/autopilot.sh` and `$HOME/.claude/get-shit-done/bin/lib/config.cjs`.
**Warning signs:** `gsd-tools verify artifacts` returns "File not found" for paths starting with `~/`.

### Pitfall 2: Verification Status Confusion with Phase 5 Changes
**What goes wrong:** Phase 5 modified some of the same functions that Phase 4 created (specifically `extract_verification_status` and `extract_gaps_summary`). The verifier might attribute Phase 5 code changes to Phase 4.
**Why it happens:** Both phases modified autopilot.sh. The current code is the merged result of both.
**How to avoid:** Verify what Phase 4 was responsible for (the 8 new functions listed in the plans/summaries) against what Phase 5 changed (only `extract_verification_status`, `extract_gaps_summary`, and the separate `phase.cjs` changes). Phase 4's functions are: `construct_debug_prompt`, `run_step_captured`, `run_step_with_retry`, `run_verify_with_debug_retry`, `write_failure_state`, `clear_failure_state`, `write_failure_report`, `cleanup_temp`.
**Warning signs:** Crediting Phase 4 for the UAT.md fallback pattern (that was Phase 5's fix).

### Pitfall 3: VERIFICATION.md Written to Wrong Directory
**What goes wrong:** The plan writes VERIFICATION.md to the Phase 6 directory instead of the Phase 4 directory.
**Why it happens:** Natural assumption that phase output goes in its own directory.
**How to avoid:** Explicitly specify the output path as `.planning/phases/04-failure-handling/04-VERIFICATION.md` in the plan.
**Warning signs:** After phase completes, `ls .planning/phases/04-failure-handling/` still has no VERIFICATION.md.

### Pitfall 4: Incomplete Requirements Mapping
**What goes wrong:** The VERIFICATION.md confirms functions exist but doesn't map them back to the specific FAIL-xx requirement they satisfy.
**Why it happens:** Focusing on code-level checks without tracing back to requirements.
**How to avoid:** Include a "Requirements Coverage" section in VERIFICATION.md that maps each FAIL-xx to the specific truths/artifacts/links that prove it is satisfied. The audit expects this traceability.
**Warning signs:** VERIFICATION.md has "passed" status but requirements section is missing or vague.

## Code Examples

### Must-Haves Extraction from Phase 4 Plans
```bash
# Extract must_haves from each plan
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter get \
  ".planning/phases/04-failure-handling/04-01-PLAN.md" --field must_haves

node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter get \
  ".planning/phases/04-failure-handling/04-02-PLAN.md" --field must_haves
```

### Automated Artifact Verification
```bash
# Run artifact checks against plan must_haves
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify artifacts \
  ".planning/phases/04-failure-handling/04-01-PLAN.md"

node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify artifacts \
  ".planning/phases/04-failure-handling/04-02-PLAN.md"
```

### Automated Key Link Verification
```bash
# Run key link checks against plan must_haves
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links \
  ".planning/phases/04-failure-handling/04-01-PLAN.md"

node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links \
  ".planning/phases/04-failure-handling/04-02-PLAN.md"
```

### Manual Bash Function Verification
```bash
AUTOPILOT="$HOME/.claude/get-shit-done/scripts/autopilot.sh"

# Syntax check
bash -n "$AUTOPILOT" && echo "Syntax OK"

# Function existence (all 8 Phase 4 functions)
for fn in construct_debug_prompt run_step_captured run_step_with_retry \
          run_verify_with_debug_retry write_failure_state clear_failure_state \
          write_failure_report cleanup_temp; do
  grep -q "^${fn}()" "$AUTOPILOT" && echo "FOUND: $fn" || echo "MISSING: $fn"
done

# Config default exists
grep "max_debug_retries" "$HOME/.claude/get-shit-done/bin/lib/config.cjs"

# Main loop integration
grep -A2 "execute)" "$AUTOPILOT" | head -5  # Should show run_step_with_retry
grep -A2 "verify)" "$AUTOPILOT" | head -5   # Should show run_verify_with_debug_retry
```

### VERIFICATION.md Output Path
```bash
# The VERIFICATION.md goes in Phase 4's directory, not Phase 6's
REPORT_PATH=".planning/phases/04-failure-handling/04-VERIFICATION.md"
```

## Phase 4 Implementation Inventory

The following is the complete inventory of Phase 4 implementation artifacts to verify, compiled from the plans and summaries:

### Functions Added to autopilot.sh (Plan 01)
| Function | Purpose | Lines (approx) |
|----------|---------|-----------------|
| `construct_debug_prompt()` | Builds debugger spawn prompt with failure context | ~200-253 |
| `run_step_captured()` | Output capture variant of run_step using tee | ~369-396 |
| `run_step_with_retry()` | Wraps run_step_captured with debug-retry loop | ~398-454 |
| `run_verify_with_debug_retry()` | Handles verify step with crash retry and gaps retry | ~456-543 |
| `cleanup_temp()` | Removes temp files tracked in TEMP_FILES array | ~838-842 |

### Functions Added to autopilot.sh (Plan 02)
| Function | Purpose | Lines (approx) |
|----------|---------|-----------------|
| `write_failure_state()` | Writes failure blocker to STATE.md | ~255-277 |
| `clear_failure_state()` | Removes phase-specific failure blocker | ~279-289 |
| `write_failure_report()` | Generates FAILURE.md in phase directory | ~291-367 |

### Config Changes (Plan 01)
| File | Change |
|------|--------|
| `config.cjs` | Added `max_debug_retries: 3` to autopilot hardcoded defaults |

### Main Loop Changes (Plan 01)
| Case | Before | After |
|------|--------|-------|
| `execute)` | `run_step` | `run_step_with_retry` |
| `verify)` | `run_step` | `run_verify_with_debug_retry` |

### Extended Functions (Plan 02)
| Function | Extension |
|----------|-----------|
| `print_halt_report()` | Added debug session info display |
| `run_step_with_retry()` | Added `write_failure_state` and `write_failure_report` on exhaustion, `clear_failure_state` on success |
| `run_verify_with_debug_retry()` | Added failure state/report calls on crash and gap exhaustion |

### Global Variables Added (Plan 01)
| Variable | Default | Source |
|----------|---------|--------|
| `TEMP_FILES` | `()` (empty array) | Declared at line 115 |
| `MAX_DEBUG_RETRIES` | `3` | Loaded from config at line 862 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SUMMARY claims as verification evidence | Phase-level VERIFICATION.md with code inspection | v1.0 audit (this session) | Establishes traceability standard |
| Manual review of plan completion | Automated must_haves checking via gsd-tools verify | Verify tooling exists since Phase 1 | Consistent, repeatable verification |

## Open Questions

1. **Tilde path resolution in gsd-tools verify artifacts**
   - What we know: Phase 4 artifacts use `~/` paths in plan frontmatter. `gsd-tools verify artifacts` resolves paths relative to cwd.
   - What's unclear: Whether `~/.claude/...` paths are resolved by the verify command, or if they need to be absolute paths.
   - Recommendation: Try automated verification first. If it fails on path resolution, fall back to manual verification of the two artifact files. This is LOW risk since there are only 2 artifact files to check.

2. **Phase 6 completion artifact**
   - What we know: Phase 6's success criteria is "Phase 4 has a VERIFICATION.md." The primary output goes in Phase 4's directory.
   - What's unclear: What goes in Phase 6's own directory (`.planning/phases/06-verify-phase4-implementation/`)?
   - Recommendation: Phase 6 should have its own PLAN.md and SUMMARY.md in its directory, plus the verification action writes 04-VERIFICATION.md to Phase 4's directory. The Phase 6 SUMMARY documents that the verification was performed.

## Sources

### Primary (HIGH confidence)
- `~/.claude/get-shit-done/scripts/autopilot.sh` — Full source read, 946 lines. All Phase 4 functions confirmed present.
- `~/.claude/get-shit-done/bin/lib/config.cjs` — Source read. `max_debug_retries: 3` confirmed in hardcoded defaults (line 63).
- `.planning/phases/04-failure-handling/04-01-PLAN.md` — Plan with must_haves for FAIL-01, FAIL-02.
- `.planning/phases/04-failure-handling/04-02-PLAN.md` — Plan with must_haves for FAIL-03, FAIL-04.
- `.planning/phases/04-failure-handling/04-01-SUMMARY.md` — Execution record claiming FAIL-01, FAIL-02 complete.
- `.planning/phases/04-failure-handling/04-02-SUMMARY.md` — Execution record claiming FAIL-03, FAIL-04 complete.
- `.planning/v1.0-MILESTONE-AUDIT.md` — Audit identifying all 4 gaps as "verification_status: missing."
- `~/.claude/get-shit-done/workflows/verify-phase.md` — Standard verification workflow.
- `~/.claude/get-shit-done/templates/verification-report.md` — VERIFICATION.md template.
- `.planning/phases/05-fix-autopilot-wiring-bugs/05-VERIFICATION.md` — Example of a completed verification report in this project.

### Secondary (MEDIUM confidence)
- `~/.claude/get-shit-done/bin/lib/verify.cjs` — Automated verification commands source code.
- `~/.claude/get-shit-done/references/verification-patterns.md` — Verification pattern reference.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All verification tooling read from source; same toolchain used for Phases 1-3
- Architecture: HIGH - verify-phase workflow is well-documented; Phase 5 VERIFICATION.md provides a concrete example
- Pitfalls: HIGH - Identified from direct analysis of plan frontmatter (tilde paths) and audit findings (directory placement)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable infrastructure, no external dependencies)
