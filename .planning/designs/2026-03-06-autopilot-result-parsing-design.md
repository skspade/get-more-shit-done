# Add Result Parsing to CLI Autopilot Steps — Design

**Date:** 2026-03-06
**Approach:** Helper function wrapping jq

## Helper Function Definition

A `format_json_output()` function in the Helper Functions section of `autopilot.sh`. It reads stdin, attempts `jq .` for pretty-printing with color, and falls back to `cat` if the input isn't valid JSON.

```bash
format_json_output() {
  local input
  input=$(cat)
  if echo "$input" | jq . >/dev/null 2>&1; then
    echo "$input" | jq .
  else
    echo "$input"
  fi
}
```

Placed after `get_config()` around line 107.

## Invocation Site Changes

All 6 `claude -p` invocations get piped through `format_json_output`. Here are the specific changes:

**1. `run_step_captured` (line 650):**
```bash
# Before:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") 2>&1 | tee -a "$output_file" || exit_code=$?
# After:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") 2>&1 | format_json_output | tee -a "$output_file" || exit_code=$?
```

**2. Debug prompt in `run_step_with_retry` (line 710):**
```bash
# Before:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || {
# After:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") | format_json_output || {
```

**3. Debug prompt in `run_verify_with_debug_retry` crash path (line 755):**
```bash
# Before:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || true
# After:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") | format_json_output || true
```

**4. Debug prompt in `run_verify_with_debug_retry` gaps path (line 801):**
```bash
# Before:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") || true
# After:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$debug_prompt") | format_json_output || true
```

**5. `run_step` (line 828):**
```bash
# Before:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") || exit_code=$?
# After:
(cd "$PROJECT_DIR" && claude -p --dangerously-skip-permissions --output-format json "$prompt") | format_json_output || exit_code=$?
```

Total: 5 direct pipe additions. The remaining invocations (milestone audit, milestone completion) delegate to `run_step_with_retry` which calls `run_step_captured`, so they are already covered.

## Exit Code Preservation

When piping through `format_json_output`, bash's default behavior uses the exit code of the last command in the pipe. Since `autopilot.sh` already has `set -uo pipefail` at line 11, the pipe will correctly propagate Claude's non-zero exit codes through `format_json_output`. No additional changes needed — `pipefail` handles this.

One caveat: for `run_step` line 828, the pattern `|| exit_code=$?` captures the pipe's exit code. With `pipefail`, if Claude exits non-zero, the pipe fails and `exit_code` captures it correctly. If Claude exits 0 but `jq`/`format_json_output` fails (shouldn't happen with the fallback), `pipefail` would report that — but the `cat` fallback in `format_json_output` ensures it always exits 0.
