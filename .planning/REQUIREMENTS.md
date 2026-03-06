# Requirements: v2.1 Autopilot Result Parsing

## Formatting

- [ ] **FMT-01**: `format_json_output()` helper function exists in autopilot.sh that pretty-prints valid JSON via `jq .`
- [ ] **FMT-02**: `format_json_output()` falls back to raw output when input is not valid JSON
- [ ] **FMT-03**: All 5 direct Claude invocation sites in autopilot.sh pipe through `format_json_output()`

## Integration

- [ ] **INT-01**: Exit codes from Claude CLI propagate correctly through the formatting pipe (pipefail)
- [ ] **INT-02**: Output capture in `run_step_captured` works correctly with formatting (tee still receives formatted output)

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| FMT-01 | — | — | — |
| FMT-02 | — | — | — |
| FMT-03 | — | — | — |
| INT-01 | — | — | — |
| INT-02 | — | — | — |

## Out of Scope

- Human-readable summaries extracting specific fields from JSON (future enhancement)
- Verbose/quiet mode toggle for output formatting
- Formatting output from non-autopilot Claude invocations
