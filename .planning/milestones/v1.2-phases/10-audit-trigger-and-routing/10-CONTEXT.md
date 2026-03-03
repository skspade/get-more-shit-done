# Phase 10: Audit Trigger and Routing - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Autopilot detects when all planned phases are complete and automatically runs the milestone audit, then routes to the correct next action based on audit outcome. This phase adds the "all phases done, now what?" logic to autopilot.sh -- the bridge between the existing phase loop and the audit/completion workflows that currently require manual invocation. It does NOT implement the gap closure loop or milestone completion (Phases 11 and 12).

</domain>

<decisions>
## Implementation Decisions

### Completion Detection
- Detect all-phases-complete using `gsd-tools init milestone-op` which already returns `all_phases_complete` boolean (from REQUIREMENTS.md AUDIT-01)
- Trigger audit when `all_phases_complete` is true and the existing phase loop has no more incomplete phases to advance to
- Detection runs after the current `print_final_report` / `exit 0` point in the main loop -- the spot where autopilot currently exits when `next_incomplete_phase` returns empty (Claude's Decision: this is the natural insertion point where autopilot already knows all phases are done)

### Audit Invocation
- Invoke `/gsd:audit-milestone` via `claude -p` with fresh context window, same as all other step invocations
- Use `run_step_with_retry` for the audit invocation so debug-retry handles audit failures (Claude's Decision: audit is a complex multi-subagent operation that can fail; it deserves the same resilience as execute steps)
- Audit creates `.planning/v{version}-MILESTONE-AUDIT.md` with YAML frontmatter containing `status: passed | gaps_found | tech_debt`

### Audit Result Parsing
- Parse the MILESTONE-AUDIT.md frontmatter `status` field using `gsd-tools frontmatter get` with `--field status` (from REQUIREMENTS.md AUDIT-02)
- Locate the audit file via `ls -t .planning/v*-MILESTONE-AUDIT.md | head -1` -- consistent with how `plan-milestone-gaps` already finds it (Claude's Decision: reuse the established convention rather than inventing a new lookup)
- Three distinct status values to handle: `passed`, `gaps_found`, `tech_debt`

### Routing Logic
- `passed` --> exit with success signal for Phase 12 (milestone completion) to consume (Claude's Decision: Phase 12 handles the actual completion invocation; this phase just sets up the routing contract)
- `gaps_found` --> exit with signal for Phase 11 (gap closure loop) to consume
- `tech_debt` --> conditionally route based on `auto_accept_tech_debt` config value
- Routing outputs a structured status that downstream phases (11, 12) will wire into -- this phase establishes the contract but does not implement those downstream actions (Claude's Decision: clean phase boundary -- each phase owns its own scope)

### Tech Debt Configuration
- Read `auto_accept_tech_debt` from config.json via existing `get_config` helper with key `autopilot.auto_accept_tech_debt` and default `true` (from REQUIREMENTS.md CONF-02 and ROADMAP.md success criteria 3)
- When `auto_accept_tech_debt` is true, `tech_debt` status is treated as `passed`
- When `auto_accept_tech_debt` is false, `tech_debt` status is treated as `gaps_found`
- Config key follows existing `autopilot.*` namespace convention (e.g., `autopilot.circuit_breaker_threshold`)

### Integration with Phase Loop
- New logic must be reachable from the existing main `while true` loop in autopilot.sh -- no dead code paths (from ROADMAP.md success criteria 4)
- Insert audit trigger at the point where `next_incomplete_phase` returns empty (currently lines 931-935 of autopilot.sh) (Claude's Decision: this is the only place where autopilot knows all phases are done and would otherwise exit)
- Replace the current `print_final_report` / `exit 0` with: run audit, parse result, route accordingly
- After routing, the script either exits 0 (passed/accepted tech debt) or exits with a specific code that Phase 11's loop can detect (Claude's Decision: exit codes are the natural bash signaling mechanism for the outer loop)

### Exit Codes and Signaling
- Exit 0 for `passed` (or `tech_debt` when accepted) -- signals downstream that milestone completion can proceed (Claude's Decision: standard unix success convention)
- Exit 10 for `gaps_found` (or `tech_debt` when not accepted) -- signals downstream that gap closure is needed (Claude's Decision: distinct non-zero code avoids confusion with error exits 1/2/130 already used by autopilot)
- Print clear banner messages for each routing outcome so the human operator can see what happened in logs

### Claude's Discretion
- Exact banner text and formatting for audit trigger and routing messages
- Variable naming for audit-related local variables in autopilot.sh
- Whether to extract audit parsing into a helper function or inline it
- Exact location of the audit file path variable (local vs function-scoped)

</decisions>

<specifics>
## Specific Ideas

- The MILESTONE-AUDIT.md frontmatter format is well-established: `status: passed | gaps_found | tech_debt` in YAML frontmatter (see v1.0 and v1.1 audit files in `.planning/milestones/`)
- The audit file lives at `.planning/v{version}-MILESTONE-AUDIT.md` during active milestone, then gets archived to `.planning/milestones/` on completion
- `gsd-tools frontmatter get <file> --field status` returns the status value cleanly (supports `--raw` for plain text output)
- The `get_config` helper in autopilot.sh already handles missing keys with defaults: `get_config "autopilot.auto_accept_tech_debt" "true"`
- Config uses dot-notation traversal through nested JSON (e.g., `autopilot.auto_accept_tech_debt` navigates `{"autopilot": {"auto_accept_tech_debt": true}}`)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_config` function (autopilot.sh line 97): Reads config.json via `gsd-tools config-get` with default fallback -- use for `auto_accept_tech_debt`
- `run_step_with_retry` function (autopilot.sh line 398): Runs a Claude step with debug-retry on failure -- use for audit invocation
- `gsd-tools init milestone-op`: Returns `all_phases_complete` boolean -- use for completion detection
- `gsd-tools frontmatter get`: Parses YAML frontmatter from any markdown file -- use for reading audit status
- `print_banner` function (autopilot.sh line 84): Consistent banner formatting -- use for audit trigger/routing banners
- `print_final_report` function (autopilot.sh line 187): Currently the "all done" exit point -- will be replaced/wrapped

### Established Patterns
- Autopilot uses `claude -p --dangerously-skip-permissions --output-format json` for all step invocations with fresh context windows
- All config keys for autopilot live under the `autopilot.*` namespace in config.json
- Exit codes: 0 (success), 1 (error), 2 (user abort), 130 (SIGINT) -- new codes must not conflict
- Circuit breaker and progress tracking wrap every step -- audit step should participate in the same tracking

### Integration Points
- Main loop `complete` case (autopilot.sh lines 929-942): Where `next_incomplete_phase` returns empty and autopilot currently exits -- this is the insertion point for audit trigger
- `/gsd:audit-milestone` command: The existing command that performs the full audit -- invoked as a prompt string via `claude -p`
- `.planning/config.json`: Where `autopilot.auto_accept_tech_debt` will be read from (key may not exist yet, default applies)
- Phase 11 (Gap Closure Loop) will consume the exit code or state signal this phase produces

</code_context>

<deferred>
## Deferred Ideas

- Gap closure loop after audit finds gaps (Phase 11 scope)
- Milestone completion invocation after audit passes (Phase 12 scope)
- Max audit-fix iteration tracking and configuration (Phase 11 scope, CONF-01)
- Partial gap closure or selective gap fixing (explicitly out of scope per REQUIREMENTS.md)

</deferred>

---

*Phase: 10-audit-trigger-and-routing*
*Context gathered: 2026-03-02 via auto-context*
