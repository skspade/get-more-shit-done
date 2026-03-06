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
const fs = require('fs');
const os = require('os');
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

describe('FMT-03: format_json_output wired to all Claude invocation sites', () => {
  const autopilotContent = fs.readFileSync(AUTOPILOT_PATH, 'utf-8');
  const lines = autopilotContent.split('\n');

  test('all 5 Claude invocation lines pipe through format_json_output', () => {
    // Find lines that are actual Claude CLI invocations (not comments, not dry-run echos)
    const claudeInvocationLines = lines.filter(line => {
      const trimmed = line.trim();
      // Must contain the actual invocation pattern
      if (!trimmed.includes('claude -p --dangerously-skip-permissions --output-format json')) return false;
      // Exclude comments
      if (trimmed.startsWith('#')) return false;
      // Exclude dry-run echo lines
      if (trimmed.includes('[DRY RUN]') || trimmed.includes('echo')) return false;
      return true;
    });

    assert.strictEqual(claudeInvocationLines.length, 5,
      `Expected 5 Claude invocation lines, found ${claudeInvocationLines.length}:\n${claudeInvocationLines.join('\n')}`);

    for (const line of claudeInvocationLines) {
      assert.ok(line.includes('format_json_output'),
        `Claude invocation line missing format_json_output:\n${line}`);
    }
  });

  test('dry-run lines do not pipe through format_json_output', () => {
    const dryRunLines = lines.filter(line => line.includes('[DRY RUN]'));
    assert.ok(dryRunLines.length > 0, 'Should find at least one dry-run line');

    for (const line of dryRunLines) {
      assert.ok(!line.includes('format_json_output'),
        `Dry-run line should NOT contain format_json_output:\n${line}`);
    }
  });
});

describe('INT-02: output capture works with format_json_output in pipe', () => {
  test('formatted JSON is captured by tee to output file', () => {
    const tmpFile = path.join(os.tmpdir(), `gsd-test-tee-${Date.now()}.log`);
    const script = [
      FUNC_PREAMBLE,
      `echo '{"key":"value"}' | format_json_output | tee "${tmpFile}" > /dev/null`,
      `cat "${tmpFile}"`,
      `rm -f "${tmpFile}"`,
    ].join('\n');
    const result = runBashScript(script);
    assert.strictEqual(result.exitCode, 0, 'Pipe chain should exit 0');
    assert.ok(result.stdout.includes('"key": "value"'),
      `Tee output file should contain formatted JSON, got:\n${result.stdout}`);
  });

  test('formatted JSON appears on stdout through tee', () => {
    const tmpFile = path.join(os.tmpdir(), `gsd-test-tee-stdout-${Date.now()}.log`);
    const script = [
      FUNC_PREAMBLE,
      `echo '{"key":"value"}' | format_json_output | tee "${tmpFile}"`,
      `rm -f "${tmpFile}"`,
    ].join('\n');
    const result = runBashScript(script);
    assert.strictEqual(result.exitCode, 0, 'Pipe chain should exit 0');
    assert.ok(result.stdout.includes('"key": "value"'),
      `stdout should contain formatted JSON, got:\n${result.stdout}`);
  });

  test('failing command exit code propagates through format_json_output and tee', () => {
    const script = [
      FUNC_PREAMBLE,
      '(echo \'{"ok":true}\'; exit 1) | format_json_output | tee /dev/null',
    ].join('\n');
    const result = runBashScript(script);
    assert.notStrictEqual(result.exitCode, 0,
      'Should propagate non-zero exit code through format_json_output and tee with pipefail');
  });
});
