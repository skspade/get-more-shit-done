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

const { validateProjectHealth, runChecks } = require('../get-shit-done/bin/lib/validation.cjs');

// ─── Module Exports ──────────────────────────────────────────────────────────

describe('module exports', () => {
  test('validateProjectHealth is a function', () => {
    assert.strictEqual(typeof validateProjectHealth, 'function');
  });

  test('runChecks is a function', () => {
    assert.strictEqual(typeof runChecks, 'function');
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

// ─── STRUCT-01 Check ─────────────────────────────────────────────────────────

describe('STRUCT-01 check', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('healthy is true when .planning/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'));
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.healthy, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('healthy is false when .planning/ missing', () => {
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.healthy, false);
    assert.ok(result.errors.length > 0);
  });

  test('error contains STRUCT-01 check when .planning/ missing', () => {
    const result = validateProjectHealth(tmpDir);
    const structCheck = result.errors.find(e => e.id === 'STRUCT-01');
    assert.ok(structCheck, 'STRUCT-01 should be in errors');
  });

  test('check result has correct shape', () => {
    const result = validateProjectHealth(tmpDir);
    const check = result.checks[0];
    assert.ok(check !== undefined, 'should have at least one check');
    assert.ok('id' in check);
    assert.ok('category' in check);
    assert.ok('severity' in check);
    assert.ok('passed' in check);
    assert.ok('message' in check);
    assert.ok('repairable' in check);
    assert.ok('repairAction' in check);
  });

  test('STRUCT-01 has correct metadata', () => {
    const result = validateProjectHealth(tmpDir);
    const check = result.checks.find(c => c.id === 'STRUCT-01');
    assert.ok(check, 'STRUCT-01 check should exist');
    assert.strictEqual(check.category, 'structure');
    assert.strictEqual(check.severity, 'error');
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
    // .planning/ missing triggers STRUCT-01 (error severity)
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.healthy, false);
  });

  test('no failures makes healthy true', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'));
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.healthy, true);
  });

  test('errors array contains only failed error-severity checks', () => {
    const result = validateProjectHealth(tmpDir);
    for (const e of result.errors) {
      assert.strictEqual(e.severity, 'error');
      assert.strictEqual(e.passed, false);
    }
  });

  test('warnings array contains only failed warning-severity checks', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'));
    const result = validateProjectHealth(tmpDir);
    for (const w of result.warnings) {
      assert.strictEqual(w.severity, 'warning');
      assert.strictEqual(w.passed, false);
    }
  });
});
