/**
 * GSD Tools Tests - Autopilot dry-run integration
 *
 * Requirements: REQ-28
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\n## What This Is\nTest\n\n## Core Value\nTest\n\n## Requirements\nTest\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' })
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

  test('there are exactly 2 claude -p shell invocations', () => {
    assert.strictEqual(
      shellInvocationLines.length,
      2,
      `Expected 2 claude -p shell invocations, found ${shellInvocationLines.length}:\n` +
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

// ─── Static Analysis: streaming functions (Phase 54) ─────────────────────────

describe('autopilot.mjs streaming functions (static analysis)', () => {
  const source = fs.readFileSync(AUTOPILOT_PATH, 'utf-8');

  test('runClaudeStreaming function exists', () => {
    assert.ok(
      source.includes('function runClaudeStreaming'),
      'autopilot.mjs should contain runClaudeStreaming function'
    );
  });

  test('displayStreamEvent function exists', () => {
    assert.ok(
      source.includes('function displayStreamEvent'),
      'autopilot.mjs should contain displayStreamEvent function'
    );
  });

  test('--quiet flag is in knownFlags', () => {
    const knownFlagsLine = source.split('\n').find(l => l.includes('knownFlags') && l.includes('new Set'));
    assert.ok(knownFlagsLine, 'knownFlags Set declaration should exist');
    assert.ok(
      knownFlagsLine.includes('quiet'),
      `knownFlags should include 'quiet', got: ${knownFlagsLine.trim()}`
    );
  });

  test('QUIET constant is defined', () => {
    assert.ok(
      source.includes('const QUIET'),
      'autopilot.mjs should define QUIET constant'
    );
  });

  test('stall timer uses getConfig for timeout', () => {
    assert.ok(
      source.includes('stall_timeout_ms'),
      'autopilot.mjs should reference stall_timeout_ms config key'
    );
  });

  test('streaming path uses --output-format stream-json', () => {
    assert.ok(
      source.includes('stream-json'),
      'autopilot.mjs should use --output-format stream-json'
    );
  });

  test('displayStreamEvent handles assistant events', () => {
    assert.ok(
      source.includes("event.type === 'assistant'") || source.includes('event.type === "assistant"'),
      'displayStreamEvent should handle assistant event type'
    );
  });

  test('displayStreamEvent handles tool_use events', () => {
    assert.ok(
      source.includes("event.type === 'tool_use'") || source.includes('event.type === "tool_use"'),
      'displayStreamEvent should handle tool_use event type'
    );
  });

  test('stall timer uses unref to prevent blocking exit', () => {
    assert.ok(
      source.includes('.unref()'),
      'Stall timer should call .unref() to prevent blocking process exit'
    );
  });

  test('runClaudeStreaming returns exitCode and stdout', () => {
    const returnPattern = /return\s*\{\s*exitCode.*stdout|return\s*\{\s*stdout.*exitCode/;
    assert.ok(
      returnPattern.test(source),
      'runClaudeStreaming should return { exitCode, stdout }'
    );
  });
});

// ─── Pre-flight Validation (TEST-03) ────────────────────────────────────────

const { validateProjectHealth } = require('../get-shit-done/bin/lib/validation.cjs');

describe('autopilot pre-flight validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-preflight-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(path.join(planningDir, 'phases', '01-setup'), { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'PROJECT.md'),
      '# Project\n\n## What This Is\nA test project\n\n## Core Value\nTesting\n\n## Requirements\n- REQ-01\n');
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'),
      '### v1.0 Test Milestone (In Progress)\n\n- [ ] Phase 1: Setup\n');
    fs.writeFileSync(path.join(planningDir, 'STATE.md'),
      '---\ngsd_state_version: 1.0\nmilestone: v1.0\nmilestone_name: Test Milestone\nstatus: active\nprogress:\n  total_phases: 1\n  completed_phases: 0\n---\n\n# State\n');
    fs.writeFileSync(path.join(planningDir, 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('healthy project passes pre-flight validation', () => {
    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    assert.strictEqual(result.healthy, true, `Expected healthy but got errors: ${JSON.stringify(result.errors)}`);
    assert.strictEqual(result.errors.length, 0);
  });

  test('unhealthy project fails pre-flight validation', () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'PROJECT.md'));
    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    assert.strictEqual(result.healthy, false);
    assert.ok(result.errors.length > 0, 'Should have errors for missing PROJECT.md');
  });

  test('repairable project repairs and passes pre-flight validation', () => {
    // Set stale STATE.md counts that auto-repair can fix
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\ngsd_state_version: 1.0\nmilestone: v1.0\nmilestone_name: Test Milestone\nstatus: active\nprogress:\n  total_phases: 99\n  completed_phases: 99\n---\n\n# State\n');
    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    assert.strictEqual(result.healthy, true, `Expected healthy after repair but got errors: ${JSON.stringify(result.errors)}`);
    assert.ok(result.repairs.length > 0, 'Should have performed repairs');
  });
});
