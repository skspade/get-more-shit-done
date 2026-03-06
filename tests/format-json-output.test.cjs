/**
 * GSD Tests - format_json_output() bash function
 *
 * Tests the format_json_output helper in autopilot.sh covering:
 * - FMT-01: JSON pretty-printing via jq
 * - FMT-02: Non-JSON passthrough (raw fallback)
 * - INT-01: Exit code propagation with pipefail
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');

const AUTOPILOT_PATH = path.join(__dirname, '..', 'get-shit-done', 'scripts', 'autopilot.sh');

/**
 * Extract format_json_output() from autopilot.sh and run it with the given
 * input on stdin. Returns the stdout string.
 */
function runFormatJson(inputStr) {
  const script = `
set -uo pipefail
eval "$(sed -n '/^format_json_output()/,/^}/p' '${AUTOPILOT_PATH}')"
format_json_output
`;
  const result = execSync('bash -c ' + JSON.stringify(script), {
    encoding: 'utf-8',
    input: inputStr,
  });
  return result;
}

/**
 * Run a bash script that sources format_json_output and returns the exit code.
 * The script itself is expected to fail (non-zero exit).
 */
function runBashScript(script) {
  try {
    const result = execSync('bash -c ' + JSON.stringify(script), {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout: result };
  } catch (err) {
    return {
      exitCode: err.status,
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
    };
  }
}

describe('format_json_output - FMT-01: JSON pretty-printing', () => {
  test('compact JSON object becomes indented', () => {
    const input = '{"key":"value"}';
    const output = runFormatJson(input);
    const expected = '{\n  "key": "value"\n}\n';
    assert.strictEqual(output, expected);
  });

  test('JSON array becomes indented', () => {
    const input = '[1,2,3]';
    const output = runFormatJson(input);
    const expected = '[\n  1,\n  2,\n  3\n]\n';
    assert.strictEqual(output, expected);
  });

  test('nested JSON object produces multi-level indentation', () => {
    const input = '{"a":{"b":"c"}}';
    const output = runFormatJson(input);
    const expected = '{\n  "a": {\n    "b": "c"\n  }\n}\n';
    assert.strictEqual(output, expected);
  });
});

describe('format_json_output - FMT-02: non-JSON passthrough', () => {
  test('plain text passes through unchanged', () => {
    const input = 'hello world';
    const output = runFormatJson(input);
    assert.strictEqual(output.trim(), 'hello world');
  });

  test('partial/invalid JSON passes through unchanged', () => {
    const input = '{"broken';
    const output = runFormatJson(input);
    assert.strictEqual(output.trim(), '{"broken');
  });

  test('empty input produces empty output', () => {
    const input = '';
    const output = runFormatJson(input);
    assert.strictEqual(output.trim(), '');
  });
});

describe('format_json_output - INT-01: exit code propagation', () => {
  test('format_json_output itself always exits 0', () => {
    const script = `
set -uo pipefail
eval "$(sed -n '/^format_json_output()/,/^}/p' '${AUTOPILOT_PATH}')"
echo "not json at all" | format_json_output > /dev/null
echo $?
`;
    const result = runBashScript(script);
    assert.strictEqual(result.exitCode, 0, 'Script should exit 0');
    assert.strictEqual(result.stdout.trim(), '0', 'format_json_output exit code should be 0');
  });

  test('failing command piped through format_json_output propagates non-zero exit with pipefail', () => {
    const script = `
set -uo pipefail
eval "$(sed -n '/^format_json_output()/,/^}/p' '${AUTOPILOT_PATH}')"
(exit 1) | format_json_output
`;
    const result = runBashScript(script);
    assert.notStrictEqual(result.exitCode, 0, 'Should propagate non-zero exit code from failing command');
  });

  test('command that outputs then fails still propagates non-zero exit with pipefail', () => {
    const script = `
set -uo pipefail
eval "$(sed -n '/^format_json_output()/,/^}/p' '${AUTOPILOT_PATH}')"
(echo '{"ok":true}'; exit 1) | format_json_output
`;
    const result = runBashScript(script);
    assert.notStrictEqual(result.exitCode, 0, 'Should propagate non-zero exit code despite format_json_output succeeding');
  });
});
