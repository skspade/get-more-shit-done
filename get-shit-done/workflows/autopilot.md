<purpose>
Run an entire milestone end-to-end within a single chat session. Orchestrator stays ultra-lean — reads metadata via CLI, dispatches each lifecycle step as a subagent, checks disk artifacts for progress, advances to next phase.

Context budget: ~5% orchestrator. Never read plan files, code, or summaries in main context.
</purpose>

<core_principle>
Orchestrator coordinates, never executes. Each phase step (discuss, plan, execute, verify) runs as a fresh subagent via Task(). Progress is verified by checking disk artifacts through gsd-tools CLI, NOT by reading subagent output text. This prevents context bleed across phases.
</core_principle>

<process>

<step name="parse_arguments" priority="first">
Parse flags from $ARGUMENTS:

- `--from-phase N` → STARTING_PHASE = N
- `--dry-run` → DRY_RUN = true
- `--skip-verify-gate` → SKIP_GATE = true

Defaults: STARTING_PHASE = null (auto-detect), DRY_RUN = false, SKIP_GATE = false.
</step>

<step name="initialize">
Load project state in one call:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init progress)
```

Parse JSON for: `project_exists`, `roadmap_exists`, `state_exists`, `milestone_version`, `milestone_name`, `phase_count`, `completed_count`.

**Guard rails:**
- If `project_exists` is false: Error — "No .planning/PROJECT.md found. Run /gsd:new-project first."
- If `roadmap_exists` is false: Error — "No .planning/ROADMAP.md found. Run /gsd:new-milestone first."
- If `phase_count` is 0: Error — "No phases in roadmap."

Determine starting phase:

```bash
if [ -n "$STARTING_PHASE" ]; then
  CURRENT_PHASE="$STARTING_PHASE"
else
  CURRENT_PHASE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase find-next --raw)
fi
```

If CURRENT_PHASE is empty: "All phases complete. Run /gsd:audit-milestone or /gsd:complete-milestone."

Initialize tracking variables:
- `NO_PROGRESS_COUNT = 0`
- `PHASES_COMPLETED = 0`
- `CIRCUIT_BREAKER_THRESHOLD = 3`

Read threshold from config if available:
```bash
THRESHOLD=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get autopilot.circuit_breaker_threshold 2>/dev/null || echo "3")
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IN-SESSION AUTOPILOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone: {milestone_version} — {milestone_name}
Phases: {completed_count}/{phase_count} complete
Starting at: Phase {CURRENT_PHASE}
Mode: {DRY_RUN ? "Dry Run" : "Live"} | Verify gate: {SKIP_GATE ? "Skipped" : "Enabled"}
```
</step>

<step name="dry_run_check">
**If DRY_RUN is true:**

Get roadmap analysis:
```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze --raw)
```

Display the execution plan showing each phase and its current status, then stop:
```
## Dry Run — Execution Plan

| Phase | Name | Current Step | Actions |
|-------|------|-------------|---------|
| 1 | ... | discuss | discuss → plan → execute → verify |
| 2 | ... | complete | skip |
| 3 | ... | execute | execute → verify |

Would execute {N} phases with up to {N*4} subagent dispatches.
```

**Return without executing.**
</step>

<step name="phase_loop">
**Main loop — repeat until no phases remain or halt condition:**

**1. Get phase status:**
```bash
STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase status ${CURRENT_PHASE} --raw)
```
Parse: `step`, `phase`, `phase_dir`, `plan_count`, `summary_count`, `phase_complete`.

**2. Handle based on step:**

**IF step == "complete":**
```
Phase {CURRENT_PHASE}: already complete — skipping
```
Increment PHASES_COMPLETED. Find next phase:
```bash
NEXT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase find-next --from ${CURRENT_PHASE} --raw)
```
If NEXT is empty → go to `milestone_completion` step.
Set CURRENT_PHASE = NEXT, reset NO_PROGRESS_COUNT = 0, continue loop.

**IF step == "discuss":**
Record BEFORE_STEP = "discuss".
Dispatch discuss subagent (see `dispatch_discuss`).
Check progress (see `check_progress`).

**IF step == "plan":**
Record BEFORE_STEP = "plan".
Dispatch plan subagent (see `dispatch_plan`).
Check progress (see `check_progress`).

**IF step == "execute":**
Record BEFORE_STEP = "execute".
Dispatch execute subagent (see `dispatch_execute`).
Check progress (see `check_progress`).
On error: attempt debug retry (see `debug_retry`).

**IF step == "verify":**
Record BEFORE_STEP = "verify".
Dispatch verify subagent (see `dispatch_verify`).
Read verification result (see `handle_verification`).
</step>

<step name="dispatch_discuss">
```
Task(
  prompt="
    <objective>
    You are the discuss-phase orchestrator. Gather context for Phase ${CURRENT_PHASE} in autopilot mode.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/discuss-phase.md
    @~/.claude/get-shit-done/templates/context.md
    </execution_context>

    <arguments>
    ARGUMENTS='${CURRENT_PHASE} --auto'
    </arguments>

    <instructions>
    1. Read discuss-phase.md for your complete workflow
    2. Follow all steps through auto_context_check (--auto flag is set)
    3. Create CONTEXT.md with auto-generated decisions
    4. Do NOT auto-advance to plan-phase — return control to caller
    5. Return: CONTEXT COMPLETE or ERROR with details
    </instructions>
  ",
  description="Discuss Phase ${CURRENT_PHASE}"
)
```

Log: `Phase ${CURRENT_PHASE} discuss: done`
</step>

<step name="dispatch_plan">
```
Task(
  prompt="
    <objective>
    You are the plan-phase orchestrator. Create executable plans for Phase ${CURRENT_PHASE}.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/plan-phase.md
    @~/.claude/get-shit-done/references/ui-brand.md
    @~/.claude/get-shit-done/references/model-profile-resolution.md
    </execution_context>

    <arguments>
    ARGUMENTS='${CURRENT_PHASE} --auto'
    </arguments>

    <instructions>
    1. Read plan-phase.md for your complete workflow
    2. Follow all steps: initialize, validate, load context, research, plan, verify
    3. Do NOT auto-advance to execute-phase — return control to caller
    4. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
    5. Return: PLANNING COMPLETE, PLANNING INCONCLUSIVE, or ERROR with details
    </instructions>
  ",
  description="Plan Phase ${CURRENT_PHASE}"
)
```

Log: `Phase ${CURRENT_PHASE} plan: done`
</step>

<step name="dispatch_execute">
```
Task(
  prompt="
    <objective>
    You are the execute-phase orchestrator. Execute all plans in Phase ${CURRENT_PHASE} with wave-based parallelization.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/execute-phase.md
    @~/.claude/get-shit-done/references/ui-brand.md
    @~/.claude/get-shit-done/references/model-profile-resolution.md
    </execution_context>

    <arguments>
    PHASE_ARG='${CURRENT_PHASE}'
    ARGUMENTS='${CURRENT_PHASE} --no-transition'
    </arguments>

    <instructions>
    1. Read execute-phase.md for your complete workflow
    2. Follow all steps: initialize, discover plans, group waves, spawn executors
    3. Pass --no-transition — do NOT auto-advance or run transition after completion
    4. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
    5. Return: EXECUTION COMPLETE, GAPS FOUND, or ERROR with details
    </instructions>
  ",
  description="Execute Phase ${CURRENT_PHASE}"
)
```

Log: `Phase ${CURRENT_PHASE} execute: done`
</step>

<step name="dispatch_verify">
Spawn verification as a subagent using the execute-phase's inline verify pattern (gsd-verifier agent):

```
Task(
  prompt="Verify phase ${CURRENT_PHASE} goal achievement.

Read the phase directory and check must-haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md.
Create VERIFICATION.md with results.

Phase directory can be found via:
node \"$HOME/.claude/get-shit-done/bin/gsd-tools.cjs\" find-phase ${CURRENT_PHASE}

Files to consult:
- Phase PLAN.md files (for must-haves and requirement IDs)
- Phase SUMMARY.md files (for what was built)
- .planning/REQUIREMENTS.md (for requirement definitions)
- .planning/ROADMAP.md (for phase goal)
",
  subagent_type="gsd-verifier",
  description="Verify Phase ${CURRENT_PHASE}"
)
```

Log: `Phase ${CURRENT_PHASE} verify: done`
</step>

<step name="handle_verification">
Read verification status from disk:

```bash
PHASE_DIR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase ${CURRENT_PHASE} --raw | grep -o '"directory":"[^"]*"' | cut -d'"' -f4)
VERIFY_STATUS=$(grep "^status:" ".planning/${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**IF status == "passed":**
Proceed to verification gate.

**IF status == "gaps_found":**
Run gap closure loop (see `gap_closure`).

**IF status == "human_needed":**
If SKIP_GATE is true: treat as passed.
Otherwise: use AskUserQuestion to present items needing human testing. On "approved" → proceed. On issue report → run gap closure.

**Verification gate (unless --skip-verify-gate):**
If NOT SKIP_GATE:
  Use AskUserQuestion: "Phase ${CURRENT_PHASE} verification passed. Approve and continue? (approve / abort)"
  If "abort" → halt autopilot.

**Mark phase complete:**
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase complete ${CURRENT_PHASE}
```

Increment PHASES_COMPLETED. Find next phase:
```bash
NEXT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase find-next --from ${CURRENT_PHASE} --raw)
```

If NEXT is empty → go to `milestone_completion`.
Set CURRENT_PHASE = NEXT, reset NO_PROGRESS_COUNT = 0, continue loop.
</step>

<step name="gap_closure">
Gap closure loop — max 3 iterations:

**For each iteration:**

1. Plan gap fixes:
```
Task(
  prompt="
    <objective>
    Create gap closure plans for Phase ${CURRENT_PHASE}.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/plan-phase.md
    @~/.claude/get-shit-done/references/ui-brand.md
    </execution_context>

    <arguments>
    ARGUMENTS='${CURRENT_PHASE} --gaps --auto'
    </arguments>

    <instructions>
    1. Read plan-phase.md for your complete workflow
    2. Use --gaps mode: read VERIFICATION.md for gap details, create fix plans
    3. Do NOT auto-advance — return control to caller
    4. Return: PLANNING COMPLETE or ERROR
    </instructions>
  ",
  description="Plan Gap Fixes Phase ${CURRENT_PHASE}"
)
```

2. Execute gap fixes:
```
Task(
  prompt="
    <objective>
    Execute gap closure plans for Phase ${CURRENT_PHASE}.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/execute-phase.md
    @~/.claude/get-shit-done/references/ui-brand.md
    </execution_context>

    <arguments>
    PHASE_ARG='${CURRENT_PHASE}'
    ARGUMENTS='${CURRENT_PHASE} --gaps-only --no-transition'
    </arguments>

    <instructions>
    1. Read execute-phase.md for your complete workflow
    2. Use --gaps-only mode: only execute plans with gap_closure: true
    3. Do NOT auto-advance — return control to caller
    4. Return: EXECUTION COMPLETE or ERROR
    </instructions>
  ",
  description="Execute Gap Fixes Phase ${CURRENT_PHASE}"
)
```

3. Re-verify (dispatch_verify again).

4. Re-read verification status.
   If "passed" → break loop, proceed to verification gate.
   If still "gaps_found" and iterations < 3 → continue loop.
   If iterations exhausted → halt with gap summary:
   ```
   ## ⚠ Autopilot Halted — Persistent Gaps

   Phase ${CURRENT_PHASE} has unresolved gaps after 3 closure attempts.
   Review: .planning/${PHASE_DIR}/*-VERIFICATION.md

   Resume: /gsd:autopilot --from-phase ${CURRENT_PHASE}
   ```
</step>

<step name="check_progress">
After each dispatch, re-check phase status:

```bash
AFTER_STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase status ${CURRENT_PHASE} --raw)
```

Parse AFTER_STEP from result.

**If BEFORE_STEP == AFTER_STEP (no progress):**
Increment NO_PROGRESS_COUNT.

**If BEFORE_STEP != AFTER_STEP (progress made):**
Reset NO_PROGRESS_COUNT = 0.

**Circuit breaker — if NO_PROGRESS_COUNT >= CIRCUIT_BREAKER_THRESHOLD:**
```
## ⚠ Autopilot Halted — No Progress

Phase ${CURRENT_PHASE} stuck at step "${BEFORE_STEP}" for ${NO_PROGRESS_COUNT} consecutive attempts.
No new artifacts detected on disk.

**Diagnostics:**
- Phase directory: .planning/${PHASE_DIR}
- Expected artifact: {CONTEXT.md for discuss, PLAN.md for plan, SUMMARY.md for execute, VERIFICATION.md for verify}
- Last status: ${AFTER_STATUS}

Resume after fixing: /gsd:autopilot --from-phase ${CURRENT_PHASE}
```

**Halt autopilot.**
</step>

<step name="debug_retry">
When execute dispatch returns an error (subagent output contains "ERROR"):

**Max 3 retries per phase.**

For each retry:
1. Log: `Phase ${CURRENT_PHASE} execute: error — debug retry ${N}/3`
2. Spawn debugger:
```
Task(
  prompt="Investigate execution failure for Phase ${CURRENT_PHASE}.

Phase directory: .planning/${PHASE_DIR}
Read SUMMARY.md files and recent git log to identify what failed.
Fix the issue and commit the fix.

Return: FIXED (describe fix) or UNFIXABLE (describe blocker)
",
  subagent_type="gsd-debugger",
  description="Debug Phase ${CURRENT_PHASE}"
)
```
3. Re-dispatch execute (dispatch_execute).
4. If still failing after 3 retries → halt:
```
## ⚠ Autopilot Halted — Execution Failure

Phase ${CURRENT_PHASE} failed after 3 debug retries.
Review .planning/${PHASE_DIR} for details.

Resume: /gsd:autopilot --from-phase ${CURRENT_PHASE}
```
</step>

<step name="milestone_completion">
All phases complete. Run milestone audit and completion.

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ALL PHASES COMPLETE — MILESTONE FINALIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phases completed: {PHASES_COMPLETED}
Milestone: {milestone_version}
```

**1. Run milestone audit:**
```
Task(
  prompt="
    <objective>
    Audit milestone ${milestone_version} completion against original intent.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/audit-milestone.md
    </execution_context>

    <arguments>
    ARGUMENTS='${milestone_version}'
    </arguments>

    <instructions>
    1. Read audit-milestone.md for your complete workflow
    2. Check requirements coverage, cross-phase integration, E2E flows
    3. Create MILESTONE-AUDIT.md with results
    4. Return: AUDIT PASSED, TECH DEBT ONLY, or GAPS FOUND
    </instructions>
  ",
  description="Audit Milestone ${milestone_version}"
)
```

**2. Check audit result:**
```bash
AUDIT_STATUS=$(grep "^status:" .planning/v*-MILESTONE-AUDIT.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

If "passed" or "tech_debt" → proceed to completion.
If "gaps_found" → use AskUserQuestion: "Milestone audit found gaps. Create fix phases? (yes/no)"
  If yes → run /gsd:plan-milestone-gaps via Task, then re-run autopilot for new phases.
  If no → proceed to completion (accept as tech debt).

**3. Run milestone completion:**
```
Task(
  prompt="
    <objective>
    Complete milestone ${milestone_version}. Archive phases, update PROJECT.md.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/complete-milestone.md
    @~/.claude/get-shit-done/templates/milestone-archive.md
    </execution_context>

    <arguments>
    ARGUMENTS='${milestone_version}'
    </arguments>

    <instructions>
    1. Read complete-milestone.md for your complete workflow
    2. Archive milestone and create historical record
    3. Return: MILESTONE COMPLETE or ERROR
    </instructions>
  ",
  description="Complete Milestone ${milestone_version}"
)
```

**4. Final report:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE ${milestone_version} COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phases executed: {PHASES_COMPLETED}
Audit: {AUDIT_STATUS}

Next: /gsd:new-milestone
```
</step>

</process>

<progress_log>
Maintain a terse append-only progress log in main context. One line per event:

```
[Phase 1] discuss: complete
[Phase 1] plan: complete (2 plans)
[Phase 1] execute: complete (2/2 plans)
[Phase 1] verify: passed
[Phase 1] COMPLETE
[Phase 2] discuss: complete
...
```

This log is the ONLY state the orchestrator accumulates. Everything else lives on disk.
</progress_log>
