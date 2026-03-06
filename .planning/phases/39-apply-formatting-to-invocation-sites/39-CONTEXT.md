# Phase 39: Apply Formatting to Invocation Sites - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

All 5 direct Claude CLI invocation sites in autopilot.sh are piped through `format_json_output()` so that JSON output is human-readable in the terminal. The `run_step_captured` output capture chain (tee to log files) continues to work correctly with formatting inserted. End-to-end autopilot behavior is unchanged except for prettier output.

</domain>

<decisions>
## Implementation Decisions

### Pipe Insertion Strategy
- All 5 direct Claude invocation sites pipe through `format_json_output()` (from REQUIREMENTS.md FMT-03)
- Site 1 (run_step_captured, line 661): insert `format_json_output` between the subshell and `tee` in the `2>&1 | tee -a` chain (from design doc)
- Site 2 (run_step_with_retry debugger, line 721): insert `| format_json_output` after the subshell, before `|| {` (from design doc)
- Site 3 (run_verify_with_debug_retry crash path, line 766): insert `| format_json_output` after the subshell, before `|| true` (from design doc)
- Site 4 (run_verify_with_debug_retry gaps path, line 812): insert `| format_json_output` after the subshell, before `|| true` (from design doc)
- Site 5 (run_step, line 839): insert `| format_json_output` after the subshell, before `|| exit_code=$?` (from design doc)
- Dry-run echo lines (653, 829) are NOT modified -- they do not invoke Claude (Claude's Decision: dry-run paths produce plain text, not JSON)

### Output Capture Compatibility
- run_step_captured output flows: claude subshell -> format_json_output -> tee -> log file (from REQUIREMENTS.md INT-02)
- Formatted (indented) JSON is written to the log file via tee, which is acceptable since log files are for human review (Claude's Decision: formatted JSON is more readable in logs too, no reason to log raw)
- stderr from the Claude subshell is already merged via `2>&1` before reaching format_json_output, so error messages pass through the formatter's raw fallback unchanged

### Exit Code Preservation
- `set -uo pipefail` at line 11 of autopilot.sh already ensures pipe exit codes propagate through the formatter (from Phase 38 CONTEXT)
- format_json_output() always exits 0 due to its fallback design, so pipefail only surfaces Claude CLI failures (from Phase 38 CONTEXT)
- The `|| exit_code=$?` and `|| true` and `|| {` patterns at each site capture the pipe exit code, which under pipefail reflects the Claude process exit (from design doc)

### Testing Approach
- Test that format_json_output appears in the pipe for all 5 Claude invocation lines via grep/pattern matching on autopilot.sh (Claude's Decision: structural test confirms the pipe is wired without needing live Claude invocations)
- Test run_step_captured pipe chain end-to-end: mock a command that outputs JSON, pipe through format_json_output and tee to a temp file, verify both terminal output and file contain formatted JSON (Claude's Decision: directly validates INT-02 requirement)
- Test exit code propagation through the full pipe chain including format_json_output and tee (Claude's Decision: validates pipefail still works with the extra pipe stage)
- Use the established Phase 38 test pattern: extract function via sed, test with node:test and execSync (from Phase 38 test file)

### Claude's Discretion
- Exact ordering of test cases within the test file
- Whether to add tests to the existing format-json-output.test.cjs or create a separate test file
- Whitespace formatting around the modified pipe lines

</decisions>

<specifics>
## Specific Ideas

- Design doc provides exact before/after code for all 5 sites -- implementation is mechanical
- The run_step_captured site (line 661) is the most complex: `(cd "$PROJECT_DIR" && claude -p ... "$prompt") 2>&1 | format_json_output | tee -a "$output_file" || exit_code=$?`
- The 3 debug invocation sites (721, 766, 812) all use `|| true` or `|| {` error suppression, making them low-risk insertions
- REQUIREMENTS.md out-of-scope: human-readable summaries extracting specific fields, verbose/quiet mode toggle, formatting non-autopilot invocations

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `format_json_output()` (autopilot.sh lines 110-118): the function built in Phase 38, ready to pipe through
- `format-json-output.test.cjs`: existing test file with `runFormatJson()` and `runBashScript()` helpers that can be reused or extended for integration tests
- `FUNC_PREAMBLE` pattern in tests: sed-extracts format_json_output from autopilot.sh for isolated testing

### Established Patterns
- All Claude invocations use `--output-format json`, confirming output is JSON and format_json_output is the right fit
- `set -uo pipefail` (line 11): script-wide pipefail is active and critical for exit code propagation through added pipe stages
- Phase 38 tests use node:test with execSync to test bash function behavior -- same pattern applies here

### Integration Points
- Line 661 (`run_step_captured`): `(cd "$PROJECT_DIR" && claude -p ... "$prompt") 2>&1 | tee -a "$output_file"` -- format_json_output inserts between subshell output and tee
- Line 721 (`run_step_with_retry` debugger): `(cd "$PROJECT_DIR" && claude -p ... "$debug_prompt") || {` -- format_json_output inserts before error handler
- Line 766 (`run_verify_with_debug_retry` crash debugger): `(cd "$PROJECT_DIR" && claude -p ... "$debug_prompt") || true` -- format_json_output inserts before fallback
- Line 812 (`run_verify_with_debug_retry` gaps debugger): `(cd "$PROJECT_DIR" && claude -p ... "$debug_prompt") || true` -- format_json_output inserts before fallback
- Line 839 (`run_step`): `(cd "$PROJECT_DIR" && claude -p ... "$prompt") || exit_code=$?` -- format_json_output inserts before exit capture

</code_context>

<deferred>
## Deferred Ideas

- Human-readable summaries extracting specific JSON fields (out of scope per REQUIREMENTS.md)
- Verbose/quiet mode toggle for output formatting (out of scope per REQUIREMENTS.md)
- Formatting output from non-autopilot Claude invocations (out of scope per REQUIREMENTS.md)

</deferred>

---

*Phase: 39-apply-formatting-to-invocation-sites*
*Context gathered: 2026-03-06 via auto-context*
