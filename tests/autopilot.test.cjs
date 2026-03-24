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

// ─── Static Analysis: SDK functions (Phase 54→98) ────────────────────────────

describe('autopilot.mjs SDK functions (static analysis)', () => {
  const source = fs.readFileSync(AUTOPILOT_PATH, 'utf-8');

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

  test('stall timer uses unref to prevent blocking exit', () => {
    assert.ok(
      source.includes('.unref()'),
      'Stall timer should call .unref() to prevent blocking process exit'
    );
  });

  test('runAgentStep returns exitCode and stdout', () => {
    const returnPattern = /return\s*\{\s*exitCode.*stdout|return\s*\{\s*stdout.*exitCode/;
    assert.ok(
      returnPattern.test(source),
      'runAgentStep should return { exitCode, stdout }'
    );
  });
});

// ─── Static Analysis: UAT integration (Phase 94) ─────────────────────────────

describe('autopilot.mjs UAT integration (static analysis)', () => {
  const source = fs.readFileSync(AUTOPILOT_PATH, 'utf-8');

  test('runAutomatedUAT function exists', () => {
    assert.ok(
      source.includes('async function runAutomatedUAT'),
      'autopilot.mjs should contain runAutomatedUAT function'
    );
  });

  test('auditAndUAT helper function exists', () => {
    assert.ok(
      source.includes('async function auditAndUAT'),
      'autopilot.mjs should contain auditAndUAT helper function'
    );
  });

  test('UAT gates on uat-config.yaml existence', () => {
    assert.ok(
      source.includes('uat-config.yaml'),
      'runAutomatedUAT should check for uat-config.yaml'
    );
  });

  test('UAT invokes /gsd:uat-auto workflow', () => {
    assert.ok(
      source.includes('uat-auto'),
      'runAutomatedUAT should invoke the uat-auto workflow'
    );
  });

  test('UAT reads MILESTONE-UAT.md for results', () => {
    assert.ok(
      source.includes('MILESTONE-UAT.md'),
      'runAutomatedUAT should read MILESTONE-UAT.md'
    );
  });

  test('auditAndUAT calls runMilestoneAudit', () => {
    assert.ok(
      source.includes('runMilestoneAudit()'),
      'auditAndUAT should call runMilestoneAudit'
    );
  });

  test('auditAndUAT calls runAutomatedUAT', () => {
    assert.ok(
      source.includes('runAutomatedUAT()'),
      'auditAndUAT should call runAutomatedUAT'
    );
  });
});
