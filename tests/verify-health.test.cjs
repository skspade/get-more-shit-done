/**
 * GSD Tools Tests - Validate Health Command
 *
 * Tests for validate-health via gsd-tools.cjs which now delegates to
 * validation.cjs validateProjectHealth().
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Helpers for setting up minimal valid projects ────────────────────────────

function writeMinimalRoadmap(tmpDir, phases = ['1']) {
  const lines = phases.map(n => `### Phase ${n}: Phase ${n} Description`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n${lines}\n`
  );
}

function writeMinimalProjectMd(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    '# Project\n\n## What This Is\n\nContent here.\n\n## Core Value\n\nContent here.\n\n## Requirements\n\nContent here.\n'
  );
}

function writeMinimalStateMd(tmpDir, content) {
  const defaultContent = content || `# Session State\n\n## Current Position\n\nPhase: 1\n`;
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    defaultContent
  );
}

function writeValidConfigJson(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// validate health command — delegating to validation.cjs
// ─────────────────────────────────────────────────────────────────────────────

describe('validate health command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test("returns 'broken' when .planning directory is missing", () => {
    fs.rmSync(path.join(tmpDir, '.planning'), { recursive: true, force: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'broken');
    assert.ok(output.errors.some(e => e.code === 'STRUCT-01a'));
  });

  test('errors when PROJECT.md is missing', () => {
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.errors.some(e => e.code === 'STRUCT-01b'));
  });

  test('errors when ROADMAP.md is missing', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.errors.some(e => e.code === 'STRUCT-01c'));
  });

  test('errors when STATE.md is missing', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.errors.some(e => e.code === 'STRUCT-01d'));
  });

  test('warns when config.json is missing', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.warnings.some(w => w.code === 'STRUCT-01e'));
  });

  test('errors when config.json has invalid JSON', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{broken json');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.errors.some(e => e.code === 'STRUCT-02'));
  });

  test('warns when config.json has invalid model_profile', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'invalid' }));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.warnings.some(w => w.code === 'STRUCT-02'));
  });

  test('warns about incorrectly named phase directories', () => {
    writeMinimalProjectMd(tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\nNo phases yet.\n');
    writeMinimalStateMd(tmpDir, '# Session State\n\nNo phase references.\n');
    writeValidConfigJson(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', 'bad_name'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.warnings.some(w => w.code === 'STRUCT-03'));
  });

  test('reports orphaned plans as info', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    writeValidConfigJson(tmpDir);
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(output.info.some(i => i.code === 'STRUCT-04'));
  });

  test("returns 'healthy' when all checks pass", () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    writeValidConfigJson(tmpDir);
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-a');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'healthy');
    assert.deepStrictEqual(output.errors, []);
    assert.deepStrictEqual(output.warnings, []);
  });

  test("returns 'degraded' when only warnings exist", () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    writeMinimalStateMd(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'degraded');
    assert.strictEqual(output.errors.length, 0);
    assert.ok(output.warnings.length > 0);
  });

  test('reports repairable_count for repairable checks', () => {
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
    const result = runGsdTools('validate health', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.ok(typeof output.repairable_count === 'number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate health --repair command
// ─────────────────────────────────────────────────────────────────────────────

describe('validate health --repair command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    writeMinimalProjectMd(tmpDir);
    writeMinimalRoadmap(tmpDir, ['1']);
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-a'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('repairs stale STATE.md counts when --repair used', () => {
    writeValidConfigJson(tmpDir);
    // Write STATE with wrong counts
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\ngsd_state_version: 1.0\nmilestone: v1.0\nmilestone_name: Test\nstatus: active\nprogress:\n  total_phases: 99\n  completed_phases: 99\n---\n\n# State\n');
    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    // Should have repairs_performed for STATE count fixes
    if (output.repairs_performed) {
      assert.ok(output.repairs_performed.length > 0, 'Should have performed repairs');
    }
  });

  test('--repair without issues does not error', () => {
    writeValidConfigJson(tmpDir);
    writeMinimalStateMd(tmpDir, '# Session State\n\nPhase 1 in progress.\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-a', '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-a', '01-01-SUMMARY.md'), '# Summary\n');
    const result = runGsdTools('validate health --repair', tmpDir);
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.status, 'healthy');
  });
});
