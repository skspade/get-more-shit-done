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

  test('validateProjectHealth runs structure, state, and navigation checks', () => {
    const result = validateProjectHealth(tmpDir);
    const categories = [...new Set(result.checks.map(c => c.category))];
    assert.ok(categories.includes('structure'));
    assert.ok(categories.includes('state'));
    assert.ok(categories.includes('navigation'));
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

// ─── READY-01: Incomplete Phases Exist ──────────────────────────────────────

describe('READY-01: incomplete phases exist', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when incomplete phases exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-01');
    assert.ok(check, 'READY-01 should exist');
    assert.strictEqual(check.category, 'readiness');
    assert.strictEqual(check.passed, true);
  });

  test('fails with info when no incomplete phases exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [x] **Phase 1: Setup** (completed 2026-03-15)');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '.completed'), '{}');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# Context with enough content');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'), '---\nplan: 01\n---\n<task type="auto">\ntest\n</task>');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-SUMMARY.md'), '# Summary');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-01');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'info');
  });

});

// ─── READY-02: Deterministic Step for Next Phase ────────────────────────────

describe('READY-02: deterministic step for next phase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when next phase has deterministic step (discuss)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-02');
    assert.ok(check, 'READY-02 should exist');
    assert.strictEqual(check.category, 'readiness');
    assert.strictEqual(check.severity, 'error');
    assert.strictEqual(check.passed, true);
  });

  test('passes when next phase has plan step', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# Context\n\nSome meaningful content here.');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes when no incomplete phase exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [x] **Phase 1: Setup** (completed 2026-03-15)');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '.completed'), '{}');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# Context with enough content');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'), '---\nplan: 01\n---\n<task type="auto">\ntest\n</task>');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-SUMMARY.md'), '# Summary');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-02');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

});

// ─── READY-03: No Truncated Artifacts ───────────────────────────────────────

describe('READY-03: no truncated artifacts', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when CONTEXT.md has sufficient content (> 50 bytes)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'),
      '# Context\n\nThis is meaningful content that exceeds fifty bytes easily.');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-03');
    assert.ok(check, 'READY-03 should exist');
    assert.strictEqual(check.category, 'readiness');
    assert.strictEqual(check.severity, 'error');
    assert.strictEqual(check.passed, true);
  });

  test('fails when CONTEXT.md is truncated (<= 50 bytes)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# C');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-03');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
    assert.ok(check.message.toLowerCase().includes('truncat'));
  });

  test('passes when PLAN.md has valid task tags', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'),
      '---\nplan: 01\n---\n<task type="auto">\nDo something\n</task>');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails when PLAN.md has no task tags or headings', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'),
      '---\nphase: test\n---\nSome content without tasks');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-03');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'error');
    assert.ok(check.message.toLowerCase().includes('truncat'));
  });

  test('passes when no artifacts exist in next phase', () => {
    // Empty phase dir — no artifacts to check
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('passes when no incomplete phase exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [x] **Phase 1: Setup** (completed)');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '.completed'), '{}');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# Context with enough content');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'), '---\nplan: 01\n---\n<task type="auto">\ntest\n</task>');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-SUMMARY.md'), '# Summary');
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-03');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });
});

// ─── READY-04: Config Autopilot Settings ────────────────────────────────────

describe('READY-04: config autopilot settings', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('passes when config has valid autopilot settings', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ autopilot: { circuit_breaker_threshold: 3 } }));
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-04');
    assert.ok(check, 'READY-04 should exist');
    assert.strictEqual(check.category, 'readiness');
    assert.strictEqual(check.passed, true);
  });

  test('passes when config has no autopilot section', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({}));
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-04');
    assert.ok(check);
    assert.strictEqual(check.passed, true);
  });

  test('fails with warning when autopilot has unknown keys', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ autopilot: { unknown_key: true } }));
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-04');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
    assert.ok(check.message.includes('unknown'));
  });

  test('fails with warning when numeric setting is non-positive', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ autopilot: { stall_timeout_ms: -1 } }));
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    const check = results.find(c => c.id === 'READY-04');
    assert.ok(check);
    assert.strictEqual(check.passed, false);
    assert.strictEqual(check.severity, 'warning');
  });

});

// ─── nextPhase and phaseStep Population ──────────────────────────────────────

describe('nextPhase and phaseStep population', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-setup'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('validateProjectHealth populates nextPhase and phaseStep when incomplete phases exist', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone_name: Test\nstatus: active\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.nextPhase, '1');
    assert.strictEqual(result.phaseStep, 'discuss');
  });

  test('nextPhase and phaseStep are null when all phases complete', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '### Phase 1: Setup\n\n- [x] **Phase 1: Setup** (completed 2026-03-15)');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '.completed'), '{}');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-CONTEXT.md'), '# Context with enough content');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-PLAN.md'), '---\nplan: 01\n---\n<task type="auto">\ntest\n</task>');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-setup', '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nmilestone_name: Test\nstatus: completed\n---\n# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');
    const result = validateProjectHealth(tmpDir);
    assert.strictEqual(result.nextPhase, null);
    assert.strictEqual(result.phaseStep, null);
  });
});

// ─── Readiness Category Filtering ───────────────────────────────────────────

describe('readiness category filtering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runChecks with readiness category returns only readiness checks', () => {
    const results = runChecks(tmpDir, { categories: ['readiness'] });
    assert.ok(results.length > 0, 'should have readiness checks');
    for (const r of results) {
      assert.strictEqual(r.category, 'readiness');
    }
  });
});

// ─── All Categories Present ─────────────────────────────────────────────────

describe('all categories present', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('validateProjectHealth runs all four categories', () => {
    const result = validateProjectHealth(tmpDir);
    const categories = [...new Set(result.checks.map(c => c.category))];
    assert.ok(categories.includes('structure'));
    assert.ok(categories.includes('state'));
    assert.ok(categories.includes('navigation'));
    assert.ok(categories.includes('readiness'));
  });
});

// ─── Skip-Guard Tests (Parameterized) ────────────────────────────────────────

describe('skip-guard: passes (skipped) when prerequisite missing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-skip-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const skipGuardCases = [
    { checkId: 'STRUCT-02', description: 'config.json does not exist', category: undefined,
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); } },
    { checkId: 'STRUCT-03', description: 'phases/ does not exist', category: undefined,
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); } },
    { checkId: 'STRUCT-04', description: 'phases/ does not exist', category: undefined,
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); } },
    { checkId: 'STATE-01', description: 'STATE.md missing', category: 'state',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap'); } },
    { checkId: 'STATE-01', description: 'ROADMAP.md missing', category: 'state',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '---\nmilestone_name: Test\n---\n# State'); } },
    { checkId: 'STATE-02', description: 'STATE.md missing', category: 'state',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap'); } },
    { checkId: 'STATE-03', description: 'ROADMAP.md missing', category: 'state',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'STATE.md'), '---\nmilestone_name: Test\nprogress:\n  total_phases: 3\n---\n# State'); } },
    { checkId: 'STATE-04', description: 'STATE.md missing', category: 'state',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap'); } },
    { checkId: 'NAV-01', description: 'phases/ directory missing', category: 'navigation',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); } },
    { checkId: 'NAV-02', description: 'ROADMAP.md missing', category: 'navigation',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-setup'), { recursive: true }); } },
    { checkId: 'NAV-03', description: 'ROADMAP.md missing', category: 'navigation',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-setup'), { recursive: true }); } },
    { checkId: 'NAV-03', description: 'phases/ missing', category: 'navigation',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '### Phase 1: Setup\n\n- [ ] **Phase 1: Setup**'); } },
    { checkId: 'NAV-04', description: 'phases/ missing', category: 'navigation',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '# Roadmap'); } },
    { checkId: 'NAV-04', description: 'ROADMAP.md missing', category: 'navigation',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true }); } },
    { checkId: 'READY-01', description: 'ROADMAP.md missing', category: 'readiness',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-setup'), { recursive: true }); } },
    { checkId: 'READY-02', description: 'ROADMAP.md missing', category: 'readiness',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-setup'), { recursive: true }); } },
    { checkId: 'READY-04', description: 'config.json missing', category: 'readiness',
      setup: (dir) => { fs.mkdirSync(path.join(dir, '.planning')); } },
  ];

  for (const { checkId, description, category, setup } of skipGuardCases) {
    test(`${checkId}: passes (skipped) when ${description}`, () => {
      setup(tmpDir);
      const opts = category ? { categories: [category] } : undefined;
      const results = runChecks(tmpDir, opts);
      const check = results.find(c => c.id === checkId);
      assert.ok(check, `${checkId} should exist`);
      assert.strictEqual(check.passed, true);
    });
  }
});

// ─── Auto-Repair ──────────────────────────────────────────────────────────────

describe('auto-repair', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-val-repair-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeState(fm) {
    const lines = ['---'];
    for (const [k, v] of Object.entries(fm)) {
      if (typeof v === 'object' && !Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const [sk, sv] of Object.entries(v)) {
          lines.push(`  ${sk}: ${sv}`);
        }
      } else {
        lines.push(`${k}: ${v}`);
      }
    }
    lines.push('---', '', '# Project State', '');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), lines.join('\n'));
  }

  function writeRoadmap(phases) {
    const lines = ['# Roadmap', '', '## Active Milestone', '', '**v1.0 Test**', '', '## Phases', ''];
    for (const p of phases) {
      const check = p.done ? 'x' : ' ';
      lines.push(`- [${check}] **Phase ${p.num}: ${p.name}**`);
    }
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), lines.join('\n'));
  }

  function writeProject() {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Project\n\n## What This Is\nTest\n\n## Core Value\nTest\n\n## Requirements\nTest\n');
  }

  function writeConfig() {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'balanced' }));
  }

  function readStateFm() {
    const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    return extractFrontmatter(content);
  }

  test('STATE-02 repair: fixes stale completed_phases count', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: true },
      { num: 3, name: 'three', done: true },
      { num: 4, name: 'four', done: false },
      { num: 5, name: 'five', done: false },
    ]);
    for (let i = 1; i <= 5; i++) {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `0${i}-phase-${i}`), { recursive: true });
    }
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 5, completed_phases: 0 },
    });

    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    const repair = result.repairs.find(r => r.checkId === 'STATE-02');
    assert.ok(repair, 'STATE-02 repair should be in repairs array');
    assert.strictEqual(repair.success, true);

    // Verify file was actually fixed
    const fm = readStateFm();
    assert.strictEqual(String(fm.progress?.completed_phases), '3');
  });

  test('STATE-03 repair: fixes stale total_phases count', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: false },
      { num: 3, name: 'three', done: false },
      { num: 4, name: 'four', done: false },
      { num: 5, name: 'five', done: false },
    ]);
    for (let i = 1; i <= 5; i++) {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `0${i}-phase-${i}`), { recursive: true });
    }
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 2, completed_phases: 1 },
    });

    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    const repair = result.repairs.find(r => r.checkId === 'STATE-03');
    assert.ok(repair, 'STATE-03 repair should be in repairs array');
    assert.strictEqual(repair.success, true);

    const fm = readStateFm();
    assert.strictEqual(String(fm.progress?.total_phases), '5');
  });

  test('STATE-04 repair: fixes status from completed to active when unchecked phases remain', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: false },
    ]);
    for (let i = 1; i <= 2; i++) {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `0${i}-phase-${i}`), { recursive: true });
    }
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'completed',
      progress: { total_phases: 2, completed_phases: 1 },
    });

    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    const repair = result.repairs.find(r => r.checkId === 'STATE-04');
    assert.ok(repair, 'STATE-04 repair should be in repairs array');
    assert.strictEqual(repair.success, true);

    const fm = readStateFm();
    assert.strictEqual(fm.status, 'active');
  });

  test('NAV-04 repair: creates missing phase directories', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: false },
      { num: 3, name: 'three', done: false },
    ]);
    // Only create dir for phase 1, leaving 2 and 3 missing
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-one'), { recursive: true });
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 3, completed_phases: 1 },
    });

    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    const repair = result.repairs.find(r => r.checkId === 'NAV-04');
    assert.ok(repair, 'NAV-04 repair should be in repairs array');
    assert.strictEqual(repair.success, true);

    // Verify directories were created
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    const dirs = fs.readdirSync(phasesDir);
    assert.ok(dirs.some(d => d.startsWith('02')), 'Phase 2 directory should be created');
    assert.ok(dirs.some(d => d.startsWith('03')), 'Phase 3 directory should be created');
  });

  test('NAV-04 repair: does NOT delete orphan directories', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
    ]);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-one'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '99-orphan'), { recursive: true });
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 1, completed_phases: 1 },
    });

    validateProjectHealth(tmpDir, { autoRepair: true });

    // Orphan directory should still exist
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '99-orphan')));
  });

  test('repairs are independent: failure in one does not block others', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: true },
      { num: 3, name: 'three', done: false },
    ]);
    for (let i = 1; i <= 3; i++) {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `0${i}-phase-${i}`), { recursive: true });
    }
    // Write STATE.md with wrong counts (both STATE-02 and STATE-03 will fail)
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 1, completed_phases: 0 },
    });

    // Make STATE.md read-only to cause repair failure
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.chmodSync(statePath, 0o444);

    const result = validateProjectHealth(tmpDir, { autoRepair: true });

    // Restore permissions for cleanup
    fs.chmodSync(statePath, 0o644);

    // Should have attempted repairs even though they failed
    assert.ok(result.repairs.length > 0, 'Should have attempted repairs');
    // At least some repairs should have success: false
    const failed = result.repairs.filter(r => !r.success);
    assert.ok(failed.length > 0, 'At least one repair should have failed');
  });

  test('without autoRepair flag: no repairs performed', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: false },
    ]);
    for (let i = 1; i <= 2; i++) {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `0${i}-phase-${i}`), { recursive: true });
    }
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 2, completed_phases: 0 },
    });

    const result = validateProjectHealth(tmpDir);
    assert.deepStrictEqual(result.repairs, []);

    // Verify file was NOT changed
    const fm = readStateFm();
    assert.strictEqual(String(fm.progress?.completed_phases), '0');
  });

  test('repair results have correct shape: { checkId, action, success, detail }', () => {
    writeProject();
    writeConfig();
    writeRoadmap([
      { num: 1, name: 'one', done: true },
      { num: 2, name: 'two', done: false },
    ]);
    for (let i = 1; i <= 2; i++) {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', `0${i}-phase-${i}`), { recursive: true });
    }
    writeState({
      gsd_state_version: '1.0',
      milestone: 'v1.0',
      milestone_name: 'Test',
      status: 'active',
      progress: { total_phases: 2, completed_phases: 0 },
    });

    const result = validateProjectHealth(tmpDir, { autoRepair: true });
    assert.ok(result.repairs.length > 0, 'Should have repairs');
    for (const repair of result.repairs) {
      assert.ok('checkId' in repair, 'repair should have checkId');
      assert.ok('action' in repair, 'repair should have action');
      assert.ok('success' in repair, 'repair should have success');
      assert.ok('detail' in repair, 'repair should have detail');
    }
  });
});
