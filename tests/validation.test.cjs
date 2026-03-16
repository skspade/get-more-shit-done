/**
 * GSD Tools Tests - validation.cjs
 *
 * Tests for the validation module: check registry, category filtering,
 * three-tier severity model, and validateProjectHealth entry point.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { validateProjectHealth, runChecks, KNOWN_SETTINGS_KEYS } = require('../get-shit-done/bin/lib/validation.cjs');

// ─── Module Exports ──────────────────────────────────────────────────────────

describe('module exports', () => {
  test('validateProjectHealth is a function', () => {
    assert.strictEqual(typeof validateProjectHealth, 'function');
  });

  test('runChecks is a function', () => {
    assert.strictEqual(typeof runChecks, 'function');
  });

  test('KNOWN_SETTINGS_KEYS is an array with expected length', () => {
    assert.ok(Array.isArray(KNOWN_SETTINGS_KEYS));
    assert.strictEqual(KNOWN_SETTINGS_KEYS.length, 15);
  });
});

// ─── validateProjectHealth Return Type ───────────────────────────────────────

describe('validateProjectHealth return type', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns object with all required fields', () => {
    const result = validateProjectHealth(tmpDir);
    assert.ok(result !== null && typeof result === 'object');
    assert.ok('healthy' in result);
    assert.ok('checks' in result);
    assert.ok('errors' in result);
    assert.ok('warnings' in result);
    assert.ok('repairs' in result);
    assert.ok('nextPhase' in result);
    assert.ok('phaseStep' in result);
  });

  test('healthy is boolean', () => {
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(typeof result.healthy, 'boolean');
  });

  test('checks is an array', () => {
    const result = validateProjectHealth(tmpDir);
    assert.ok(Array.isArray(result.checks));
  });

  test('errors is an array', () => {
    const result = validateProjectHealth(tmpDir);
    assert.ok(Array.isArray(result.errors));
  });

  test('warnings is an array', () => {
    const result = validateProjectHealth(tmpDir);
    assert.ok(Array.isArray(result.warnings));
  });

  test('repairs is an empty array', () => {
    const result = validateProjectHealth(tmpDir);
    assert.ok(Array.isArray(result.repairs));
    assert.strictEqual(result.repairs.length, 0);
  });

  test('nextPhase is null', () => {
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.nextPhase, null);
  });

  test('phaseStep is null', () => {
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.phaseStep, null);
  });
});

// ─── STRUCT-01a through STRUCT-01f: File Existence Checks ───────────────────

describe('STRUCT-01a: .planning/ directory', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when .planning/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01a');
    assert.ok(check, 'STRUCT-01a should exist');
    assert.strictEqual(check.passed, true);
  });

  test('fails when .planning/ missing', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01a');
    assert.ok(check, 'STRUCT-01a should exist');
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
    assert.strictEqual(check.category, 'structure');
  });

  test('old STRUCT-01 ID no longer exists', () => {
    const results = runChecks(tmpDir);
    const old = results.find(c => c.id === 'STRUCT-01');
    assert.strictEqual(old, undefined, 'STRUCT-01 should not exist (replaced by STRUCT-01a)');
  });
});

describe('STRUCT-01b: PROJECT.md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when PROJECT.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01b');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails when PROJECT.md missing', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01b');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
  });
});

describe('STRUCT-01c: ROADMAP.md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when ROADMAP.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01c');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails when ROADMAP.md missing', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01c');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
  });
});

describe('STRUCT-01d: STATE.md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when STATE.md exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01d');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails when STATE.md missing', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01d');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
  });
});

describe('STRUCT-01e: config.json', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when config.json exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01e');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when config.json missing', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01e');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });
});

describe('STRUCT-01f: phases/ directory', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when phases/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01f');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when phases/ missing', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-01f');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });
});

// ─── STRUCT-02: Config Validation ───────────────────────────────────────────

describe('STRUCT-02: config.json validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when config.json is valid with known keys', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'balanced' }));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when config.json does not exist', () => {
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails with error severity when config.json has invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{bad json}');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-02');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
    assert.ok(check.message.includes('parse error') || check.message.includes('Parse') || check.message.includes('JSON'));
  });

  test('fails with warning when model_profile is invalid', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'invalid' }));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-02');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
    assert.ok(check.message.includes('invalid'));
  });

  test('fails with info when config has unknown keys', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ unknown_key: true }));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-02');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'info');
    assert.ok(check.message.includes('unknown'));
  });
});

// ─── STRUCT-03: Phase Directory Naming ──────────────────────────────────────

describe('STRUCT-03: phase directory naming', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when all directories match NN-name format', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-build'));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when directory does not match format', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'foo'));
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-03');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });

  test('passes (skipped) when phases/ does not exist', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── STRUCT-04: Orphaned Plans ──────────────────────────────────────────────

describe('STRUCT-04: orphaned plan detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('fails with info when PLAN.md has no SUMMARY.md', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md'), '---\nplan: 01\n---');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-04');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'info');
  });

  test('passes when PLAN.md has matching SUMMARY.md', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md'), '---\nplan: 01\n---');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md'), '# Summary');
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when phases/ does not exist', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    const results = runChecks(tmpDir);
    const check = results.find(c => c.id === 'STRUCT-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── Category Filtering ──────────────────────────────────────────────────────

describe('category filtering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runChecks with categories filters to matching checks', () => {
    const results = runChecks(tmpDir, { categories: ['structure'] });
    assert.ok(Array.isArray(results));
    for (const r of results) {
      assert.strictEqual(r.category, 'structure');
    }
  });

  test('runChecks with non-matching category returns empty', () => {
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });

  test('runChecks with no categories runs all checks', () => {
    const results = runChecks(tmpDir);
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  test('validateProjectHealth with categories filters checks', () => {
    const result = validateProjectHealth(tmpDir, { categories: ['readiness'] });
    assert.strictEqual(result.checks.length, 0);
    assert.strictEqual(result.healthy, true);
  });
});

// ─── Three-Tier Severity Model ───────────────────────────────────────────────

describe('three-tier severity model', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('error-severity failure makes healthy false', () => {
    // .planning/ missing triggers STRUCT-01a (error severity)
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.healthy, false);
  });

  test('warning-only failures keep healthy true', () => {
    // Create .planning/ with required error-level files but missing config.json (warning) and phases/ (warning)
    const planning = path.join(tmpDir, '.planning');
    fs.mkdirSync(planning);
    fs.writeFileSync(path.join(planning, 'PROJECT.md'), '# Project');
    fs.writeFileSync(path.join(planning, 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(planning, 'STATE.md'), '# State');
    // config.json missing = warning, phases/ missing = warning
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.healthy, true);
    assert.ok(result.warnings.length > 0, 'should have warnings');
  });

  test('errors array contains only failed error-severity checks', () => {
    const result = validateProjectHealth(tmpDir);
    for (const e of result.errors) {
      assert.strictEqual(e.severity, 'error');
      assert.strictEqual(e.passed, false);
    }
  });

  test('warnings array contains only failed warning-severity checks', () => {
    const planning = path.join(tmpDir, '.planning');
    fs.mkdirSync(planning);
    fs.writeFileSync(path.join(planning, 'PROJECT.md'), '# Project');
    fs.writeFileSync(path.join(planning, 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(planning, 'STATE.md'), '# State');
    const result = validateProjectHealth(tmpDir);
    for (const w of result.warnings) {
      assert.strictEqual(w.severity, 'warning');
      assert.strictEqual(w.passed, false);
    }
  });
});
