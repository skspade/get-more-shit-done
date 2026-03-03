# Phase 12: Milestone Completion - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Autopilot automatically completes the milestone when the audit passes, performing archival and PROJECT.md evolution without human intervention. This phase replaces the four `exit 0` points in autopilot.sh (two after audit passes, two after gap closure succeeds) with a `complete-milestone` invocation before exiting. It is the final piece that closes the v1.2 loop: phases execute, audit runs, gaps close, and now the milestone archives itself.

</domain>

<decisions>
## Implementation Decisions

### Completion Trigger
- When audit returns "passed" (or tech debt accepted), autopilot invokes complete-milestone before exiting (from REQUIREMENTS.md COMP-01)
- Four code paths currently exit 0 after audit/gap-closure success (startup lines 1094/1099, main loop lines 1171/1176) -- all four must invoke completion instead of bare `exit 0` (from ROADMAP.md success criteria 1)
- Create a `run_milestone_completion` function that encapsulates the complete-milestone invocation, called from all four exit-0 paths (Claude's Decision: DRY -- single function avoids duplicating invocation logic across four call sites)

### Complete-Milestone Invocation
- Invoke `/gsd:complete-milestone` via `claude -p` with fresh context window, same pattern as audit and gap-planning invocations
- Pass the milestone version in the prompt so complete-milestone knows which version to archive (Claude's Decision: complete-milestone command expects a version argument per its command definition `argument-hint: <version>`)
- Extract milestone version from STATE.md frontmatter `milestone` field using `gsd_tools frontmatter get .planning/STATE.md --field milestone --raw` (Claude's Decision: STATE.md already has `milestone: v1.2` -- reliable source that gsd-tools can parse)
- Use `run_step_with_retry` for the completion invocation so debug-retry handles failures (Claude's Decision: complete-milestone is a multi-step workflow involving archival, PROJECT.md evolution, and commits -- failures are possible and should get the same resilience as audit/gap-planning)

### Autonomous Execution
- Milestone completion runs fully autonomously -- archival, PROJECT.md evolution, roadmap reorganization, and commit all happen without prompts (from REQUIREMENTS.md COMP-02)
- The complete-milestone workflow has a `<if mode="yolo">` gate at verify_readiness that auto-approves when config mode is "yolo" -- config.json already has `"mode": "yolo"` so this gate will auto-approve without changes (from codebase: config.json and complete-milestone.md)
- The workflow's `offer_next` step suggests `/gsd:new-milestone` -- in autopilot context this is informational only since autopilot exits after completion (Claude's Decision: autopilot does not start new milestones; it completes the current one and exits)
- Phase archival prompt ("Archive phase directories?") must be auto-approved in autopilot mode -- include directive in the prompt to auto-approve all interactive gates (Claude's Decision: autopilot is autonomous; any interactive prompts within complete-milestone must be bypassed)

### Clean Exit
- After milestone completion succeeds, autopilot exits with code 0 and a success banner (from ROADMAP.md success criteria 3)
- If milestone completion fails after retries, exit with code 1 and a halt report using the existing `print_halt_report` pattern (Claude's Decision: consistent with how other step failures are reported)
- Print a clear "MILESTONE COMPLETE" banner before exit 0 that includes the version and milestone name (Claude's Decision: operators need confirmation that the full cycle succeeded, not just that phases/audit passed)

### Error Handling
- If `run_step_with_retry` fails for complete-milestone (exhausts retries), autopilot should halt with an error report -- not silently exit 0 (Claude's Decision: a failed archival/evolution step should not be treated as success)
- If version extraction from STATE.md fails, halt with a clear error message rather than passing an empty version (Claude's Decision: complete-milestone with no version would produce broken archives)

### Claude's Discretion
- Exact banner text and formatting for milestone completion messages
- Variable naming for version and completion-related locals
- Whether to extract version once at script startup or read it just before completion invocation
- Exact wording of the prompt passed to `claude -p` for complete-milestone
- Whether to include `--auto` or equivalent directive in the prompt text vs relying on config mode

</decisions>

<specifics>
## Specific Ideas

- The complete-milestone command definition (`commands/gsd/complete-milestone.md`) accepts `{{version}}` as an argument: `/gsd:complete-milestone 1.2`. The version should be passed without the "v" prefix based on the argument-hint pattern.
- Config.json has `"mode": "yolo"` which triggers the auto-approve path in complete-milestone's verify_readiness step. No config changes needed for autonomous execution of the readiness gate.
- The complete-milestone workflow performs: verify readiness, gather stats, extract accomplishments, create MILESTONES.md entry, evolve PROJECT.md, reorganize ROADMAP.md, archive milestone (via `gsd-tools milestone complete`), delete REQUIREMENTS.md, write retrospective, update STATE.md, handle branches, git commit, offer next steps.
- The `gsd-tools milestone complete` CLI handles the heavy archival: creating milestones/ directory, archiving ROADMAP.md and REQUIREMENTS.md, moving audit file, creating MILESTONES.md entry, updating STATE.md.
- STATE.md frontmatter contains `milestone: v1.2` and `milestone_name: Add Milestone Audit Loop` -- both are extractable via `gsd_tools frontmatter get`.
- The complete-milestone workflow has an interactive "Archive phase directories?" prompt at the archive_milestone step. In autopilot mode, the prompt to `claude -p` should include a directive like "Auto-approve all confirmations including phase directory archival" to ensure fully autonomous execution.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `run_step_with_retry` function (autopilot.sh line 613): Runs Claude steps with debug-retry on failure -- use for complete-milestone invocation
- `run_milestone_audit` function (autopilot.sh line 227): Pattern reference for how milestone-level operations are invoked and result-checked
- `print_banner` function (autopilot.sh line 84): Consistent banner formatting -- use for completion banners
- `print_halt_report` function (autopilot.sh line 147): Formatted halt output -- use if completion fails
- `get_config` function (autopilot.sh line 97): Reads config.json with defaults -- could use to check mode if needed
- `gsd_tools frontmatter get` command: Parses YAML frontmatter -- use to extract milestone version from STATE.md

### Established Patterns
- All Claude invocations use `claude -p --dangerously-skip-permissions --output-format json` with fresh context windows
- Step invocations use `run_step_with_retry` for resilience (audit, gap-planning, execute all use this)
- Exit codes: 0 (success), 1 (error), 2 (user abort), 10 (gaps found), 130 (SIGINT)
- Failure handling writes blocker state then halts with `print_halt_report`
- Config mode "yolo" auto-approves interactive gates in GSD workflows

### Integration Points
- Startup all-complete audit-passed path (autopilot.sh line 1094): `exit 0` to be replaced with completion invocation
- Startup gap-closure-succeeded path (autopilot.sh line 1099): `exit 0` to be replaced with completion invocation
- Main loop audit-passed path (autopilot.sh line 1171): `exit 0` to be replaced with completion invocation
- Main loop gap-closure-succeeded path (autopilot.sh line 1176): `exit 0` to be replaced with completion invocation
- `/gsd:complete-milestone` command: Invoked via `claude -p` to perform archival and PROJECT.md evolution
- `.planning/STATE.md` frontmatter: Source for milestone version (`milestone: v1.2`)

</code_context>

<deferred>
## Deferred Ideas

- Starting the next milestone automatically after completion (out of scope -- autopilot completes one milestone per invocation)
- Partial gap closure or selective gap fixing (explicitly out of scope per REQUIREMENTS.md)
- Budget/cost reporting at milestone completion (out of scope per PROJECT.md)
- Persisting completion status across restarts (unnecessary -- if autopilot restarts after completion, the milestone is already archived and phases are done)

</deferred>

---

*Phase: 12-milestone-completion*
*Context gathered: 2026-03-03 via auto-context*
