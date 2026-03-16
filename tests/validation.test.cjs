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
    const results = runChecks(tmpDir, { categories: ['nonexistent'] });
    assert.ok(Array.isArray(results));
    assert.strictEqual(results.length, 0);
  });

  test('runChecks with no categories runs all checks', () => {
    const results = runChecks(tmpDir);
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  test('validateProjectHealth with categories filters checks', () => {
    const result = validateProjectHealth(tmpDir, { categories: ['nonexistent'] });
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

// ─── STATE-01: Milestone Name Match ─────────────────────────────────────────

describe('STATE-01: milestone name match', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when milestone names match', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test Milestone\nstatus: active\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test Milestone\n\n## Phases\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-01');
    assert.ok(check, 'STATE-01 should exist');
    assert.strictEqual(check.passed, true);
  });

  test('fails with error when milestone names differ', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Wrong Name\nstatus: active\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test Milestone\n\n## Phases\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-01');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
  });

  test('passes (skipped) when STATE.md missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-01');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when ROADMAP.md missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\n---\n# State');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-01');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── STATE-02: Completed Phases Count ───────────────────────────────────────

describe('STATE-02: completed phases count', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when completed count matches', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: active\nprogress:\n  completed_phases: 2\n  total_phases: 3\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [x] **Phase 2: Build**\n- [ ] **Phase 3: Test**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-02');
    assert.ok(check, 'STATE-02 should exist');
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when counts differ', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: active\nprogress:\n  completed_phases: 3\n  total_phases: 3\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [x] **Phase 2: Build**\n- [ ] **Phase 3: Test**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-02');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });

  test('passes (skipped) when STATE.md missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── STATE-03: Total Phases Count ───────────────────────────────────────────

describe('STATE-03: total phases count', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when total count matches', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: active\nprogress:\n  completed_phases: 1\n  total_phases: 3\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [ ] **Phase 2: Build**\n- [ ] **Phase 3: Test**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-03');
    assert.ok(check, 'STATE-03 should exist');
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when counts differ', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: active\nprogress:\n  completed_phases: 1\n  total_phases: 5\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [ ] **Phase 2: Build**\n- [ ] **Phase 3: Test**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-03');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });

  test('passes (skipped) when ROADMAP.md missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nprogress:\n  total_phases: 3\n---\n# State');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── STATE-04: Status Consistency ───────────────────────────────────────────

describe('STATE-04: status consistency', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when status completed and all phases checked', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: completed\nprogress:\n  completed_phases: 2\n  total_phases: 2\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [x] **Phase 2: Build**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-04');
    assert.ok(check, 'STATE-04 should exist');
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when status completed but unchecked phases exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: completed\nprogress:\n  completed_phases: 2\n  total_phases: 3\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [x] **Phase 2: Build**\n- [ ] **Phase 3: Test**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-04');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });

  test('passes when status active and unchecked phases exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone_name: Test\nstatus: active\nprogress:\n  completed_phases: 1\n  total_phases: 3\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Milestone v1.0: Test\n\n## Phases\n\n- [x] **Phase 1: Setup**\n- [ ] **Phase 2: Build**\n- [ ] **Phase 3: Test**');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when STATE.md missing', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    const results = runChecks(tmpDir, { categories: ['state'] });
    const check = results.find(c => c.id === 'STATE-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── State Category Filtering ───────────────────────────────────────────────

describe('state category filtering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runChecks with state category returns only state checks', () => {
    const results = runChecks(tmpDir, { categories: ['state'] });
    assert.ok(results.length > 0, 'should have state checks');
    for (const r of results) {
      assert.strictEqual(r.category, 'state');
    }
  });

  test('validateProjectHealth runs structure, state, navigation, and readiness checks', () => {
    const result = validateProjectHealth(tmpDir);
    const categories = [...new Set(result.checks.map(c => c.category))];
    assert.ok(categories.includes('structure'));
    assert.ok(categories.includes('state'));
    assert.ok(categories.includes('navigation'));
    assert.ok(categories.includes('readiness'));
  });
});

// ─── NAV-01: computePhaseStatus Validation ──────────────────────────────────

describe('NAV-01: computePhaseStatus validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when phase directory has artifacts and computePhaseStatus returns valid data', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# Context\n\nSome content here that is meaningful.');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-01');
    assert.ok(check, 'NAV-01 should exist');
    assert.strictEqual(check.category, 'navigation');
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when phases/ directory missing', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-01');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── NAV-02: findFirstIncompletePhase Validation ────────────────────────────

describe('NAV-02: findFirstIncompletePhase validation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when incomplete phase exists and milestone is active', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-02');
    assert.ok(check, 'NAV-02 should exist');
    assert.strictEqual(check.category, 'navigation');
    assert.strictEqual(check.passed, true);
  });

  test('passes when milestone is complete (all phases checked)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [x] **Phase 1: Setup** (completed 2026-03-15)');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '.completed'), '{}');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when ROADMAP.md missing', () => {
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── NAV-03: Deterministic Lifecycle Step ────────────────────────────────────

describe('NAV-03: deterministic lifecycle step', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when all incomplete phases have deterministic step', () => {
    // Empty dir = discuss step (deterministic)
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-03');
    assert.ok(check, 'NAV-03 should exist');
    assert.strictEqual(check.category, 'navigation');
    assert.strictEqual(check.severity, 'error');
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when ROADMAP.md missing', () => {
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when phases/ missing', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── NAV-04: Disk vs ROADMAP Phase Sync ──────────────────────────────────────

describe('NAV-04: disk vs ROADMAP phase sync', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when disk directories match ROADMAP phases', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-build'));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n### Phase 2: Build\n\n- [ ] **Phase 1: Setup**\n- [ ] **Phase 2: Build**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-04');
    assert.ok(check, 'NAV-04 should exist');
    assert.strictEqual(check.category, 'navigation');
    assert.strictEqual(check.passed, true);
  });

  test('fails when orphan directory exists on disk but not in ROADMAP', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-orphan'));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-04');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
    assert.ok(check.message.includes('orphan') || check.message.includes('Orphan'));
  });

  test('fails when ROADMAP phase has no disk directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n### Phase 2: Build\n\n- [ ] **Phase 1: Setup**\n- [ ] **Phase 2: Build**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-04');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
    assert.ok(check.message.includes('missing') || check.message.includes('Missing'));
  });

  test('ignores phases inside <details> blocks (shipped milestones)', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-current'));
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '<details>\n<summary>v1.0</summary>\n\n- [x] **Phase 1: Old**\n\n</details>\n\n### Phase 2: Current\n\n- [ ] **Phase 2: Current**');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-04');
    assert.ok(check);
    // Phase 1 is in <details> so should be ignored; only Phase 2 is active and has a directory
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when phases/ missing', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes (skipped) when ROADMAP.md missing', () => {
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    const check = results.find(c => c.id === 'NAV-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── Navigation Category Filtering ──────────────────────────────────────────

describe('navigation category filtering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runChecks with navigation category returns only navigation checks', () => {
    const results = runChecks(tmpDir, { categories: ['navigation'] });
    assert.ok(results.length > 0, 'should have navigation checks');
    for (const r of results) {
      assert.strictEqual(r.category, 'navigation');
    }
  });
});
