# Phase 3: Verification Gates - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The autopilot pauses at each verification checkpoint so a human can review what was built, see which decisions were made autonomously, and choose to continue, fix, or abort. This phase modifies the bash outer loop to block for human input after execution completes, adds a verification report that surfaces autonomous decisions with reasoning, and implements the approve/fix/abort control flow. This phase does NOT change debug-retry logic (Phase 4) or auto-context generation (Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Verification pause mechanism
- After execution completes, the bash outer loop blocks waiting for human input before proceeding to the next phase (from VRFY-01)
- The pause happens in autopilot.sh at the verify step -- after `/gsd:verify-work` runs and produces VERIFICATION.md, the script reads stdin for the human response (Claude's Decision: bash `read` is the simplest blocking mechanism and keeps the pause in the outer loop where it belongs rather than inside a Claude session)
- The verify step in the main loop becomes a two-part operation: first run verification, then present the report and block for input (Claude's Decision: separating verify-run from verify-gate keeps the existing verify-phase workflow unchanged)
- Dry-run mode skips the human gate and auto-approves, consistent with existing dry-run behavior (Claude's Decision: dry-run should remain non-interactive for testing)

### Verification report with autonomous decisions
- The verification report includes a "Decisions Made Autonomously" section listing every auto-context decision with its reasoning (from VRFY-02)
- Extract autonomous decisions by parsing the phase's CONTEXT.md for lines containing `(Claude's Decision:` (Claude's Decision: CONTEXT.md already has structured annotations -- parsing beats duplicating the data)
- The autonomous decisions section appears in the human-facing verification summary printed to the terminal, not buried in the VERIFICATION.md file (Claude's Decision: human must see decisions without opening files since this is a terminal-based checkpoint)
- Each decision is presented with its reasoning on a single line, grouped by category from CONTEXT.md (Claude's Decision: preserving category grouping aids scanability)
- If the CONTEXT.md was human-generated (no `Source: Auto-generated` header), the decisions section is omitted (Claude's Decision: only auto-context decisions need surfacing since human-generated ones were already reviewed)

### Human control flow (approve/fix/abort)
- Human can type "approve" to continue to the next phase (from VRFY-03)
- Human can type "fix" to trigger a debug-retry cycle on specific issues (from VRFY-03)
- Human can type "abort" to stop the autopilot cleanly with state preserved (from VRFY-03)
- Input is case-insensitive and accepts short aliases: "a"/"approve"/"yes"/"y" for approve, "f"/"fix" for fix, "x"/"abort"/"quit"/"q" for abort (Claude's Decision: loose matching reduces friction at a terminal prompt where typos happen)
- "fix" prompts the human for a brief description of what to fix, then invokes `/gsd:plan-phase {N} --gaps` followed by `/gsd:execute-phase {N} --gaps-only` and re-runs verification (Claude's Decision: reuses existing gap-closure cycle rather than inventing a new fix mechanism)
- "abort" writes the current phase and step to stdout as a resume command, then exits with code 2 (Claude's Decision: distinct exit code from circuit-breaker halt (1) and interrupt (130) lets callers distinguish clean abort)
- After "fix" completes and re-verifies, the human gate re-presents the updated report and blocks again (Claude's Decision: human should see the fix results before approving)

### Terminal presentation
- Verification gate uses a distinct visual box that is clearly different from progress banners, making it obvious the autopilot is waiting (Claude's Decision: visual differentiation prevents the human from thinking it is still running)
- The gate display shows: verification status (passed/gaps_found), score, autonomous decisions summary, and the three options (approve/fix/abort)
- When verification status is "gaps_found", the gaps summary from VERIFICATION.md is included in the gate display so the human can decide fix vs abort without opening files (Claude's Decision: enough context at the prompt to make an informed decision)

### Claude's Discretion
- Exact wording of the verification gate prompt text
- Visual formatting of the autonomous decisions section (bullet list vs table)
- Whether to show a countdown or timestamp at the verification gate
- Internal structure of the verification gate function in autopilot.sh

</decisions>

<specifics>
## Specific Ideas

- The existing verify step in autopilot.sh (`run_step "/gsd:verify-work $CURRENT_PHASE" "verify"`) runs verification non-interactively. Phase 3 adds a post-verify gate that reads the VERIFICATION.md result and blocks for human input.
- VRFY-02 specifically requires surfacing auto-context decisions, not just pass/fail. The CONTEXT.md files generated by gsd-auto-context already contain `(Claude's Decision: ...)` annotations that can be grep-extracted.
- The fix path reuses the existing gap-closure cycle: `/gsd:plan-phase {N} --gaps` reads VERIFICATION.md and creates gap plans, then `/gsd:execute-phase {N} --gaps-only` executes them and re-verifies. This is already implemented in execute-phase.md.
- PROJECT.md states "Human checkpoint at verification only" as a key decision -- this phase implements that checkpoint.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `autopilot.sh` (~280 lines): The bash outer loop engine. Has `run_step`, `print_banner`, progress tracking, circuit breaker. The verify step currently just calls `run_step` with no human gate -- this is where the pause logic goes.
- `verify-phase.md` workflow: Runs goal-backward verification and produces VERIFICATION.md with status, score, gaps, and human verification items. Already returns `passed`, `gaps_found`, or `human_needed`.
- `verify-work.md` workflow: Conversational UAT for human testing. Already handles issue diagnosis and gap-closure planning. The "fix" path can leverage its diagnose/plan/execute cycle.
- `gsd-tools.cjs phase-status`: Returns phase lifecycle state JSON. Can be used to detect when verify step produces VERIFICATION.md.
- `gsd-tools.cjs config-get`: Already reads config values. Can be extended for `autopilot.verify_gate` settings if needed.
- CONTEXT.md annotation format: `(Claude's Decision: [reason])` is a consistent parseable pattern across all auto-generated context files.

### Established Patterns
- Stateless orchestration: autopilot.sh queries state each iteration, never caches -- the verification gate should follow the same pattern (re-read VERIFICATION.md each time)
- Thin command dispatch: command.md -> workflow.md -> bash script. No new command needed; autopilot.sh is already the execution engine.
- Progress snapshot comparison: before/after commit+artifact counts. The fix cycle should count as progress to avoid tripping the circuit breaker.
- Gap-closure cycle: plan-phase --gaps -> execute-phase --gaps-only -> re-verify. Already implemented and tested.
- Exit codes: 0=complete, 1=halted, 130=interrupted. Phase 3 adds 2=aborted.

### Integration Points
- Modified: `.claude/get-shit-done/scripts/autopilot.sh` -- add verification gate logic after verify step, human input handling, fix/abort paths
- Reads: `{phase_dir}/{padded_phase}-VERIFICATION.md` -- verification status and gaps
- Reads: `{phase_dir}/{padded_phase}-CONTEXT.md` -- autonomous decision annotations for VRFY-02
- Unchanged: `verify-phase.md`, `verify-work.md` -- verification workflows run as-is
- Unchanged: `gsd-auto-context.md` -- annotation format is already parseable

</code_context>

<deferred>
## Deferred Ideas

- Configurable per-phase human gates (AUTO-01 from v2 requirements) -- this phase implements the default "always gate at verify"
- Streaming progress updates through verification (SDK-02 from v2 requirements) -- terminal output is sufficient for v1
- Timeout on human response at verification gate -- the whole point is to block until the human responds

</deferred>

---

*Phase: 03-verification-gates*
*Context gathered: 2026-03-02 via auto-context*
