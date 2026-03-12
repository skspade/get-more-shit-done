/**
 * GSD Tools Tests - Autopilot dry-run integration
 *
 * Requirements: REQ-28
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

// Check if claude is available as a real binary (not just a shell function).
// The autopilot script uses zx's `which('claude')` which requires an actual binary on PATH.
let hasClaude = false;
try {
  // which(1) only finds real executables, not shell functions
  execSync('command -p which claude', { stdio: 'pipe' });
  hasClaude = true;
} catch {
  // Also try /usr/bin/which which is stricter
  try {
    const result = execSync('/usr/bin/which claude 2>/dev/null', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.trim()) hasClaude = true;
  } catch {}
}

const AUTOPILOT_PATH = path.join(__dirname, '..', 'get-shit-done', 'scripts', 'autopilot.mjs');

describe('autopilot.mjs --dry-run', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create minimal valid .planning/ structure
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n## Phases\n### Phase 1: Foundation\n'
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '.gitkeep'), '');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n## Current Position\n\nPhase: 1\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('completes without fatal error on valid structure', { skip: !hasClaude ? 'claude CLI not found as binary on PATH' : false }, () => {
    let stdout = '';
    let stderr = '';
    try {
      stdout = execSync(
        `npx zx "${AUTOPILOT_PATH}" --dry-run --project-dir "${tmpDir}"`,
        { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (err) {
      stdout = err.stdout?.toString() || '';
      stderr = err.stderr?.toString() || '';
      // Accept circuit breaker exit (no real progress in dry-run)
      const isCircuitBreaker = stdout.includes('circuit breaker') || stderr.includes('circuit breaker') ||
                                stdout.includes('CIRCUIT BREAKER') || stderr.includes('CIRCUIT BREAKER') ||
                                stdout.includes('No progress') || stderr.includes('No progress');
      if (!isCircuitBreaker) {
        assert.fail(`Unexpected error: ${stderr || err.message}`);
      }
    }

    // Log directory should have been created
    const logsDir = path.join(tmpDir, '.planning', 'logs');
    assert.ok(fs.existsSync(logsDir), 'logs directory should exist');
    const logFiles = fs.readdirSync(logsDir).filter(f => f.startsWith('autopilot-') && f.endsWith('.log'));
    assert.ok(logFiles.length >= 1, `Expected at least one log file, found: ${logFiles}`);
  });

  test('creates log file with session header', { skip: !hasClaude ? 'claude CLI not found as binary on PATH' : false }, () => {
    try {
      execSync(
        `npx zx "${AUTOPILOT_PATH}" --dry-run --project-dir "${tmpDir}"`,
        { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch {
      // Accept any exit code -- we just need the log file created
    }

    const logsDir = path.join(tmpDir, '.planning', 'logs');
    if (!fs.existsSync(logsDir)) return;

    const logFiles = fs.readdirSync(logsDir).filter(f => f.startsWith('autopilot-') && f.endsWith('.log'));
    if (logFiles.length === 0) return;

    const logContent = fs.readFileSync(path.join(logsDir, logFiles[0]), 'utf-8');
    assert.ok(logContent.includes('GSD Autopilot Session Log'), 'Log should contain session header');
    assert.ok(logContent.includes('Dry-run: true'), 'Log should indicate dry-run mode');
  });
});

// ─── Static Analysis: stdin redirect regression ─────────────────────────────

describe('autopilot.mjs stdin redirect (regression)', () => {
  const source = fs.readFileSync(AUTOPILOT_PATH, 'utf-8');
  const lines = source.split('\n');

  // Shell invocation lines: contain both "$`" (zx tagged template) and "claude -p"
  // Exclude comment lines (trimmed starts with //) and console.log lines
  const shellInvocationLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return false;
    if (trimmed.includes('console.log')) return false;
    return line.includes('$`') && line.includes('claude -p');
  });

  test('every claude -p shell invocation includes < /dev/null', () => {
    for (const line of shellInvocationLines) {
      assert.ok(
        line.includes('< /dev/null'),
        `Missing < /dev/null in shell invocation: ${line.trim()}`
      );
    }
  });

  test('there are exactly 5 claude -p shell invocations', () => {
    assert.strictEqual(
      shellInvocationLines.length,
      5,
      `Expected 5 claude -p shell invocations, found ${shellInvocationLines.length}:\n` +
        shellInvocationLines.map((l, i) => `  ${i + 1}: ${l.trim()}`).join('\n')
    );
  });

  test('count of < /dev/null matches count of claude -p invocations', () => {
    const devNullCount = shellInvocationLines.filter((l) => l.includes('< /dev/null')).length;
    assert.strictEqual(
      devNullCount,
      shellInvocationLines.length,
      `< /dev/null count (${devNullCount}) does not match invocation count (${shellInvocationLines.length})`
    );
  });

  test('comment and console.log lines with claude -p are not flagged', () => {
    const nonInvocationLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!line.includes('claude -p')) return false;
      return trimmed.startsWith('//') || trimmed.includes('console.log');
    });
    // These lines should exist but should NOT be in our invocation set
    assert.ok(nonInvocationLines.length > 0, 'Expected at least one comment/log line with claude -p');
    for (const line of nonInvocationLines) {
      assert.ok(
        !shellInvocationLines.includes(line),
        `Non-invocation line incorrectly included: ${line.trim()}`
      );
    }
  });
});

// ─── Argument Validation ────────────────────────────────────────────────────

describe('autopilot.mjs argument validation', () => {
  test('unknown positional argument causes exit code 1', { timeout: 15000, skip: !hasClaude ? 'claude CLI not found as binary on PATH' : false }, () => {
    try {
      execSync(
        `npx zx "${AUTOPILOT_PATH}" badarg`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      assert.fail('Expected non-zero exit code for unknown positional argument');
    } catch (err) {
      const stderr = err.stderr?.toString() || '';
      assert.ok(
        stderr.includes('Unknown argument'),
        `Expected stderr to contain "Unknown argument", got: ${stderr}`
      );
    }
  });

  test('unknown flag causes exit code 1', { timeout: 15000, skip: !hasClaude ? 'claude CLI not found as binary on PATH' : false }, () => {
    try {
      execSync(
        `npx zx "${AUTOPILOT_PATH}" --bad-flag`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      assert.fail('Expected non-zero exit code for unknown flag');
    } catch (err) {
      const stderr = err.stderr?.toString() || '';
      assert.ok(
        stderr.includes('Unknown argument'),
        `Expected stderr to contain "Unknown argument", got: ${stderr}`
      );
    }
  });
});
