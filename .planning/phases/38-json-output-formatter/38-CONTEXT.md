# Phase 38: JSON Output Formatter - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Autopilot gets a reliable JSON formatting function that pretty-prints valid JSON and passes through non-JSON output unchanged, without swallowing exit codes. This phase delivers `format_json_output()` as a self-contained helper in autopilot.sh, covering requirements FMT-01, FMT-02, and INT-01. Integration into the 5 Claude invocation sites is deferred to Phase 39.

</domain>

<decisions>
## Implementation Decisions

### Function Design
- `format_json_output()` reads all stdin into a variable, attempts `jq .` for pretty-printing, and falls back to echoing raw input if jq fails (from design doc)
- Function is placed in the Helper Functions section of autopilot.sh, after `get_config()` (from design doc)
- The function always exits 0 -- jq failure triggers the raw echo fallback, never a non-zero exit (from design doc)
- Function uses `cat` to buffer stdin, not line-by-line read (Claude's Decision: JSON payloads from Claude CLI are multi-line and must be captured atomically)

### Exit Code Preservation
- `set -uo pipefail` at the top of autopilot.sh already ensures pipe exit codes propagate correctly -- no additional pipefail configuration needed (from design doc)
- format_json_output() itself always exits 0 due to the fallback, so pipefail only surfaces Claude CLI failures (from design doc)

### jq Dependency
- jq is already a prerequisite of autopilot.sh (checked at line 57-59) -- no new dependency needed
- jq validation check uses `jq . >/dev/null 2>&1` to test JSON validity before pretty-printing (from design doc)
- No `--color-output` flag on jq (Claude's Decision: output is often piped to tee/files where ANSI codes would be noise)

### Testing Approach
- Test format_json_output() directly with valid JSON input and verify indented output (from success criteria)
- Test with non-JSON input (plain text, partial JSON, empty string) and verify passthrough (from success criteria)
- Test exit code propagation: simulate a failing command piped through format_json_output with pipefail and verify the non-zero exit code surfaces (from success criteria)
- Tests should source the function from autopilot.sh or extract it into a testable form (Claude's Decision: function must be testable in isolation without running the full autopilot script)

### Claude's Discretion
- Exact indentation level used by jq (jq defaults to 2-space indent)
- Internal variable naming within format_json_output()
- Whether to add a comment block above the function or just a one-liner

</decisions>

<specifics>
## Specific Ideas

- Design doc provides the exact implementation: `input=$(cat)` then conditional `jq .` with echo fallback
- The design doc mentions "with color" in the prose but the code sample does not use `--color-output`, and the REQUIREMENTS.md says "pretty-prints" without mentioning color -- plain jq is sufficient
- REQUIREMENTS.md out-of-scope explicitly excludes: human-readable summaries extracting specific fields, verbose/quiet mode toggle, formatting non-autopilot invocations

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `autopilot.sh` Helper Functions section (lines 78-107): established location for utility functions like `gsd_tools()`, `print_banner()`, `get_phase_status()`, `get_config()` -- format_json_output() slots in here
- jq prerequisite check (lines 57-59): already validates jq availability at startup

### Established Patterns
- `set -uo pipefail` (line 11): script-wide pipefail is already active, which is critical for INT-01 exit code propagation
- Helper functions are simple, single-purpose bash functions with no external dependencies beyond the tools checked in Prerequisites
- All Claude invocations use `--output-format json`, confirming the output is expected to be JSON (making format_json_output the right fit)

### Integration Points
- The function will be defined in autopilot.sh between `get_config()` (line ~107) and the Progress Tracking section (line ~109)
- Phase 39 will pipe the function into 5 Claude invocation sites at lines 650, 710, 755, 801, and 828
- `run_step_captured` (line 650) is the most complex integration point because it chains `2>&1 | tee -a` -- Phase 39 will insert format_json_output between the subshell and tee

</code_context>

<deferred>
## Deferred Ideas

- Applying format_json_output to the 5 invocation sites (Phase 39, FMT-03)
- Output capture compatibility with run_step_captured and tee (Phase 39, INT-02)
- Human-readable summaries extracting specific JSON fields (out of scope per REQUIREMENTS.md)
- Verbose/quiet mode toggle for output formatting (out of scope per REQUIREMENTS.md)
- Formatting output from non-autopilot Claude invocations (out of scope per REQUIREMENTS.md)

</deferred>

---

*Phase: 38-json-output-formatter*
*Context gathered: 2026-03-06 via auto-context*
