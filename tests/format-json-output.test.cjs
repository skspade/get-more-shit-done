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
 * Build the preamble that extracts format_json_output() from autopilot.sh.
 * Uses sed to extract the function definition (from "format_json_output()" to
 * the closing "}" at the start of a line).
 */
const FUNC_PREAMBLE = [
  'set -uo pipefail',
  `eval "$(sed -n '/^format_json_output()/,/^}$/p' '${AUTOPILOT_PATH}')"`,
].join('\n');

/**
 * Extract format_json_output() from autopilot.sh and run it with the given
 * input on stdin. Uses FORMAT_INPUT env var to safely pass data without
 * shell escaping issues, then pipes it through the function.
 */
function runFormatJson(inputStr) {
  const script = FUNC_PREAMBLE + '\nprintf \'%s\' "$FORMAT_INPUT" | format_json_output';
  return execSync('bash', {
    encoding: 'utf-8',
    input: script + '\n',
    env: { ...process.env, FORMAT_INPUT: inputStr },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Run an arbitrary bash script and return exit code + output.
 * Script is passed via stdin to bash.
 */
function runBashScript(scriptBody) {
  try {
    const stdout = execSync('bash', {
      encoding: 'utf-8',
      input: scriptBody + '\n',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout };
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
    const output = runFormatJson('{"key":"value"}');
    assert.strictEqual(output, '{\n  "key": "value"\n}\n');
  });

  test('JSON array becomes indented', () => {
    const output = runFormatJson('[1,2,3]');
    assert.strictEqual(output, '[\n  1,\n  2,\n  3\n]\n');
  });

  test('nested JSON object produces multi-level indentation', () => {
    const output = runFormatJson('{"a":{"b":"c"}}');
    assert.strictEqual(output, '{\n  "a": {\n    "b": "c"\n  }\n}\n');
  });
});

describe('format_json_output - FMT-02: non-JSON passthrough', () => {
  test('plain text passes through unchanged', () => {
    const output = runFormatJson('hello world');
    assert.strictEqual(output.trim(), 'hello world');
  });

  test('partial/invalid JSON passes through unchanged', () => {
    const output = runFormatJson('{"broken');
    assert.strictEqual(output.trim(), '{"broken');
  });

  test('empty input produces empty output', () => {
    const output = runFormatJson('');
    assert.strictEqual(output.trim(), '');
  });
});

describe('format_json_output - INT-01: exit code propagation', () => {
  test('format_json_output itself always exits 0', () => {
    // Disable pipefail so the overall script does not fail,
    // then capture the exit code of the pipeline explicitly.
    const script = [
      FUNC_PREAMBLE,
      'set +o pipefail',
      'echo "not json at all" | format_json_output > /dev/null',
      'echo $?',
    ].join('\n');
    const result = runBashScript(script);
    assert.strictEqual(result.exitCode, 0, 'Script should exit 0');
    assert.strictEqual(result.stdout.trim(), '0', 'format_json_output exit code should be 0');
  });

  test('failing command piped through format_json_output propagates non-zero exit with pipefail', () => {
    const script = [
      FUNC_PREAMBLE,
      '(exit 1) | format_json_output',
    ].join('\n');
    const result = runBashScript(script);
    assert.notStrictEqual(result.exitCode, 0, 'Should propagate non-zero exit code from failing command');
  });

  test('command that outputs then fails still propagates non-zero exit with pipefail', () => {
    const script = [
      FUNC_PREAMBLE,
      '(echo \'{"ok":true}\'; exit 1) | format_json_output',
    ].join('\n');
    const result = runBashScript(script);
    assert.notStrictEqual(result.exitCode, 0, 'Should propagate non-zero exit code despite format_json_output succeeding');
  });
});
