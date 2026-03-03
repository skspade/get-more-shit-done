/**
 * GSD Tools Tests - cli.cjs
 *
 * Tests for the CLI utility module: project discovery, argument parsing,
 * and output formatting.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { execSync } = require('child_process');

const {
  findProjectRoot,
  parseArgs,
  formatOutput,
  COMMANDS,
  routeCommand,
} = require('../get-shit-done/bin/lib/cli.cjs');

// ─── findProjectRoot ─────────────────────────────────────────────────────────

describe('findProjectRoot', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cli-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns project root when .planning/ exists in current directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const result = findProjectRoot(tmpDir);
    assert.strictEqual(result, tmpDir);
  });

  test('returns project root when .planning/ exists in ancestor directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const subDir = path.join(tmpDir, 'src', 'components');
    fs.mkdirSync(subDir, { recursive: true });
    const result = findProjectRoot(subDir);
    assert.strictEqual(result, tmpDir);
  });

  test('returns null when no .planning/ found', () => {
    // tmpDir has no .planning/ directory
    const result = findProjectRoot(tmpDir);
    assert.strictEqual(result, null);
  });
});

// ─── parseArgs ──────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('extracts --json flag and sets mode to json', () => {
    const result = parseArgs(['progress', '--json']);
    assert.strictEqual(result.mode, 'json');
    assert.strictEqual(result.command, 'progress');
  });

  test('extracts --plain flag and sets mode to plain', () => {
    const result = parseArgs(['todos', '--plain']);
    assert.strictEqual(result.mode, 'plain');
    assert.strictEqual(result.command, 'todos');
  });

  test('defaults to rich mode when no flag', () => {
    const result = parseArgs(['health']);
    assert.strictEqual(result.mode, 'rich');
  });

  test('extracts subcommand as first non-flag argument', () => {
    const result = parseArgs(['settings']);
    assert.strictEqual(result.command, 'settings');
  });

  test('handles no arguments', () => {
    const result = parseArgs([]);
    assert.strictEqual(result.command, undefined);
    assert.deepStrictEqual(result.args, []);
    assert.strictEqual(result.mode, 'rich');
  });

  test('handles subcommand with additional positional args', () => {
    const result = parseArgs(['todos', 'TODO-001', '--json']);
    assert.strictEqual(result.command, 'todos');
    assert.deepStrictEqual(result.args, ['TODO-001']);
    assert.strictEqual(result.mode, 'json');
  });
});

// ─── formatOutput ───────────────────────────────────────────────────────────

describe('formatOutput', () => {
  test('json mode returns valid JSON string', () => {
    const data = { command: 'test', message: 'hello' };
    const result = formatOutput(data, 'json');
    const parsed = JSON.parse(result);
    assert.deepStrictEqual(parsed, data);
  });

  test('plain mode strips ANSI escape codes', () => {
    const data = '\x1b[32mgreen text\x1b[0m and \x1b[1;31mred bold\x1b[0m';
    const result = formatOutput(data, 'plain');
    assert.strictEqual(result, 'green text and red bold');
    assert.ok(!result.includes('\x1b'));
  });

  test('rich mode passes through unchanged', () => {
    const data = '\x1b[32mgreen text\x1b[0m';
    const result = formatOutput(data, 'rich');
    assert.strictEqual(result, data);
  });

  test('json mode handles nested objects', () => {
    const data = { items: [{ id: 1 }, { id: 2 }], count: 2 };
    const result = formatOutput(data, 'json');
    const parsed = JSON.parse(result);
    assert.deepStrictEqual(parsed, data);
  });

  test('plain mode extracts message from object', () => {
    const data = { command: 'test', message: 'hello world' };
    const result = formatOutput(data, 'plain');
    assert.strictEqual(result, 'hello world');
  });
});

// ─── COMMANDS registry ──────────────────────────────────────────────────────

describe('COMMANDS', () => {
  test('all five commands are registered', () => {
    const expected = ['progress', 'todos', 'health', 'settings', 'help'];
    for (const name of expected) {
      assert.ok(COMMANDS[name], `Command '${name}' should be registered`);
    }
  });

  test('each command has description and handler', () => {
    for (const [name, entry] of Object.entries(COMMANDS)) {
      assert.strictEqual(typeof entry.description, 'string', `${name} should have string description`);
      assert.strictEqual(typeof entry.handler, 'function', `${name} should have function handler`);
    }
  });
});

// ─── routeCommand ───────────────────────────────────────────────────────────

describe('routeCommand', () => {
  test('routes progress to handler with real data', () => {
    const result = routeCommand('progress', '/tmp', [], 'rich');
    assert.strictEqual(result.command, 'progress');
    assert.ok(result.message);
    assert.ok(result.milestone, 'Should have milestone data');
    assert.ok(Array.isArray(result.phases), 'Should have phases array');
    assert.ok(result.progress, 'Should have progress data');
  });

  test('routes todos to handler with structured data', () => {
    const result = routeCommand('todos', '/tmp', [], 'rich');
    assert.strictEqual(result.command, 'todos');
    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.todos, []);
  });

  test('routes health to handler with structured data', () => {
    const result = routeCommand('health', '/tmp', [], 'rich');
    assert.strictEqual(result.command, 'health');
    assert.ok(result.status, 'Should have status');
    assert.ok(Array.isArray(result.checks), 'Should have checks array');
    assert.ok(Array.isArray(result.errors), 'Should have errors array');
    assert.ok(Array.isArray(result.warnings), 'Should have warnings array');
    assert.ok(Array.isArray(result.info), 'Should have info array');
    assert.ok(result.message, 'Should have message');
  });

  test('routes settings to handler', () => {
    const result = routeCommand('settings', '/tmp', [], 'rich');
    assert.strictEqual(result.command, 'settings');
  });

  test('routes help to handler with all command names', () => {
    const result = routeCommand('help', null, [], 'rich');
    assert.strictEqual(result.command, 'help');
    assert.ok(result.message.includes('progress'));
    assert.ok(result.message.includes('todos'));
    assert.ok(result.message.includes('health'));
    assert.ok(result.message.includes('settings'));
    assert.ok(result.message.includes('help'));
  });

  test('returns null for unknown command', () => {
    const result = routeCommand('nonexistent', '/tmp', [], 'rich');
    assert.strictEqual(result, null);
  });
});

// ─── Integration tests (CLI binary) ────────────────────────────────────────

describe('gsd-cli binary', () => {
  const cliPath = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-cli.cjs');
  const projectRoot = path.resolve(__dirname, '..');

  test('help command exits 0 and lists commands', () => {
    const output = execSync(`node "${cliPath}" help`, { cwd: projectRoot, encoding: 'utf-8' });
    assert.ok(output.includes('progress'));
    assert.ok(output.includes('todos'));
    assert.ok(output.includes('health'));
    assert.ok(output.includes('settings'));
  });

  test('bare invocation shows help', () => {
    const output = execSync(`node "${cliPath}"`, { cwd: projectRoot, encoding: 'utf-8' });
    assert.ok(output.includes('Usage:'));
    assert.ok(output.includes('Commands:'));
  });

  test('progress --json returns valid JSON with real milestone data', () => {
    const output = execSync(`node "${cliPath}" progress --json`, { cwd: projectRoot, encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.command, 'progress');
    assert.ok(parsed.milestone, 'Should have milestone');
    assert.ok(parsed.milestone.name, 'Should have milestone name');
    assert.ok(parsed.milestone.version, 'Should have milestone version');
    assert.ok(Array.isArray(parsed.phases), 'Should have phases array');
    assert.ok(parsed.progress, 'Should have progress');
  });

  test('progress --plain returns no ANSI codes', () => {
    const output = execSync(`node "${cliPath}" progress --plain`, { cwd: projectRoot, encoding: 'utf-8' });
    assert.ok(!output.includes('\x1b'));
  });

  test('unknown command exits 1 with error', () => {
    try {
      execSync(`node "${cliPath}" badcommand`, { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      assert.ok(err.stderr.includes('Unknown command'));
      assert.ok(err.stderr.includes('badcommand'));
    }
  });

  test('todos --json returns valid JSON with count and todos array', () => {
    const output = execSync(`node "${cliPath}" todos --json`, { cwd: projectRoot, encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.command, 'todos');
    assert.strictEqual(typeof parsed.count, 'number');
    assert.ok(Array.isArray(parsed.todos));
  });

  test('todos --area filters by area (TODO-02)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-area-test-'));
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(path.join(pendingDir, 'bug-one.md'),
      '---\ntitle: Bug One\narea: bugfix\ncreated: 2026-01-01\n---\nBug details\n');
    fs.writeFileSync(path.join(pendingDir, 'feat-one.md'),
      '---\ntitle: Feature One\narea: feature\ncreated: 2026-01-02\n---\nFeature details\n');
    try {
      const output = execSync(`node "${cliPath}" todos --area=bugfix --json`, { cwd: tmpDir, encoding: 'utf-8' });
      const parsed = JSON.parse(output);
      assert.strictEqual(parsed.command, 'todos');
      assert.strictEqual(parsed.count, 1);
      assert.ok(Array.isArray(parsed.todos));
      for (const todo of parsed.todos) {
        assert.strictEqual(todo.area, 'bugfix', 'Every returned todo should have area=bugfix');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('health --json returns valid JSON with status field', () => {
    const output = execSync(`node "${cliPath}" health --json`, { cwd: projectRoot, encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.command, 'health');
    assert.ok(['healthy', 'degraded', 'broken'].includes(parsed.status));
    assert.ok(Array.isArray(parsed.checks));
    assert.ok(Array.isArray(parsed.errors));
    assert.ok(Array.isArray(parsed.warnings));
  });

  test('health --plain returns no ANSI codes', () => {
    const output = execSync(`node "${cliPath}" health --plain`, { cwd: projectRoot, encoding: 'utf-8' });
    assert.ok(!output.includes('\x1b'));
    assert.ok(output.includes('Health Check'));
  });

  test('settings --json returns valid JSON with settings array', () => {
    const output = execSync(`node "${cliPath}" settings --json`, { cwd: projectRoot, encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.command, 'settings');
    assert.ok(Array.isArray(parsed.settings));
  });

  test('help progress shows detailed usage', () => {
    const output = execSync(`node "${cliPath}" help progress`, { cwd: projectRoot, encoding: 'utf-8' });
    assert.ok(output.includes('gsd progress'));
    assert.ok(output.includes('--json'));
  });

  test('help nonexistent shows error', () => {
    const output = execSync(`node "${cliPath}" help nonexistent`, { cwd: projectRoot, encoding: 'utf-8' });
    assert.ok(output.includes('nonexistent'));
  });

  test('exits 1 when run outside GSD project', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cli-int-'));
    try {
      execSync(`node "${cliPath}" progress`, { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 1);
      assert.ok(err.stderr.includes('.planning/'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── handleProgress ─────────────────────────────────────────────────────────

describe('handleProgress', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-progress-test-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(path.join(planningDir, 'phases', '01-setup'), { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'phases', '02-feature'), { recursive: true });
    // ROADMAP.md with milestone info
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'),
      '### v1.0 Test Milestone (In Progress)\n\n- [ ] Phase 1: Setup\n- [ ] Phase 2: Feature\n');
    // STATE.md with frontmatter
    fs.writeFileSync(path.join(planningDir, 'STATE.md'),
      '---\nmilestone: v1.0\nmilestone_name: Test Milestone\nstatus: active\n---\n');
    // Phase 1: 2 plans, 2 summaries (complete)
    fs.writeFileSync(path.join(planningDir, 'phases', '01-setup', '01-01-PLAN.md'), '---\nplan: 01\n---\n');
    fs.writeFileSync(path.join(planningDir, 'phases', '01-setup', '01-02-PLAN.md'), '---\nplan: 02\n---\n');
    fs.writeFileSync(path.join(planningDir, 'phases', '01-setup', '01-01-SUMMARY.md'), 'done');
    fs.writeFileSync(path.join(planningDir, 'phases', '01-setup', '01-02-SUMMARY.md'), 'done');
    // Phase 2: 2 plans, 1 summary (in progress)
    fs.writeFileSync(path.join(planningDir, 'phases', '02-feature', '02-01-PLAN.md'), '---\nplan: 01\n---\n');
    fs.writeFileSync(path.join(planningDir, 'phases', '02-feature', '02-02-PLAN.md'), '---\nplan: 02\n---\n');
    fs.writeFileSync(path.join(planningDir, 'phases', '02-feature', '02-01-SUMMARY.md'), 'done');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('json mode returns milestone info (PROG-01)', () => {
    const result = routeCommand('progress', tmpDir, [], 'json');
    assert.strictEqual(result.milestone.version, 'v1.0');
    assert.strictEqual(result.milestone.name, 'Test Milestone');
    assert.strictEqual(result.milestone.status, 'active');
  });

  test('json mode returns phases with status indicators (PROG-02)', () => {
    const result = routeCommand('progress', tmpDir, [], 'json');
    assert.ok(Array.isArray(result.phases));
    assert.strictEqual(result.phases.length, 2);
    const phase1 = result.phases.find(p => p.number === '01');
    const phase2 = result.phases.find(p => p.number === '02');
    assert.strictEqual(phase1.status_indicator, 'complete');
    assert.strictEqual(phase2.status_indicator, 'in_progress');
  });

  test('json mode returns plan counts per phase (PROG-03)', () => {
    const result = routeCommand('progress', tmpDir, [], 'json');
    const phase1 = result.phases.find(p => p.number === '01');
    const phase2 = result.phases.find(p => p.number === '02');
    assert.strictEqual(phase1.plan_counts, '2/2 plans');
    assert.strictEqual(phase2.plan_counts, '1/2 plans');
  });

  test('json mode returns progress bar data (PROG-04)', () => {
    const result = routeCommand('progress', tmpDir, [], 'json');
    assert.strictEqual(typeof result.progress.percent, 'number');
    assert.strictEqual(result.progress.total_plans, 4);
    assert.strictEqual(result.progress.completed_plans, 3);
    assert.strictEqual(result.progress.percent, 75);
    assert.ok(result.progress.bar.length > 0);
  });

  test('json mode returns current position and next action (PROG-05)', () => {
    const result = routeCommand('progress', tmpDir, [], 'json');
    assert.ok(result.current_position);
    assert.strictEqual(result.current_position.phase, '02');
    assert.ok(result.next_action);
    assert.strictEqual(typeof result.next_action, 'string');
    assert.ok(result.next_action.includes('02'));
  });

  test('rich mode returns message with ANSI codes', () => {
    const result = routeCommand('progress', tmpDir, [], 'rich');
    assert.ok(result.message);
    assert.ok(result.message.includes('\x1b['));
    assert.ok(result.message.includes('Test Milestone'));
  });

  test('handles missing .planning directory gracefully', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-progress-empty-'));
    try {
      const result = routeCommand('progress', emptyDir, [], 'json');
      assert.ok(result.milestone);
      assert.ok(Array.isArray(result.phases));
      assert.strictEqual(result.phases.length, 0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  test('all complete phases shows milestone done', () => {
    // Make phase 2 complete too
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '02-feature', '02-02-SUMMARY.md'), 'done');
    const result = routeCommand('progress', tmpDir, [], 'json');
    assert.strictEqual(result.progress.percent, 100);
    assert.ok(result.next_action.includes('complete'));
  });

  test('phase with no plans shows not_started', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-empty'), { recursive: true });
    const result = routeCommand('progress', tmpDir, [], 'json');
    const phase3 = result.phases.find(p => p.number === '03');
    assert.strictEqual(phase3.status_indicator, 'not_started');
    assert.strictEqual(phase3.plan_counts, '0 plans');
  });
});

// ─── handleTodos ─────────────────────────────────────────────────────────────

describe('handleTodos', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-todos-test-'));
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    // Create test todo files
    fs.writeFileSync(path.join(pendingDir, 'fix-login-bug.md'),
      '---\ncreated: 2026-03-01\ntitle: Fix login bug\narea: bugfix\n---\n\n## Description\n\nLogin fails on mobile.\n');
    fs.writeFileSync(path.join(pendingDir, 'add-dark-mode.md'),
      '---\ncreated: 2026-03-02\ntitle: Add dark mode\narea: feature\n---\n\n## Description\n\nUsers want dark mode.\n');
    fs.writeFileSync(path.join(pendingDir, 'update-docs.md'),
      '---\ncreated: 2026-03-03\ntitle: Update documentation\narea: docs\n---\n\n## Description\n\nDocs are outdated.\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('list mode returns all pending todos with ID, title, area (TODO-01)', () => {
    const result = routeCommand('todos', tmpDir, [], 'json');
    assert.strictEqual(result.command, 'todos');
    assert.strictEqual(result.count, 3);
    assert.ok(Array.isArray(result.todos));
    for (const todo of result.todos) {
      assert.ok(todo.id, 'Each todo should have an id');
      assert.ok(todo.title, 'Each todo should have a title');
      assert.ok(todo.area, 'Each todo should have an area');
      assert.ok(todo.created, 'Each todo should have a created date');
    }
  });

  test('detail mode returns full todo content (TODO-03)', () => {
    const result = routeCommand('todos', tmpDir, ['fix-login-bug'], 'json');
    assert.strictEqual(result.command, 'todos');
    assert.ok(result.todo, 'Should have todo object');
    assert.strictEqual(result.todo.id, 'fix-login-bug');
    assert.strictEqual(result.todo.title, 'Fix login bug');
    assert.strictEqual(result.todo.area, 'bugfix');
    assert.ok(result.todo.content.includes('Login fails on mobile'));
    assert.ok(result.todo.path.includes('fix-login-bug.md'));
  });

  test('detail mode returns error for non-existent ID', () => {
    const result = routeCommand('todos', tmpDir, ['nonexistent'], 'json');
    assert.strictEqual(result.command, 'todos');
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('nonexistent'));
    assert.ok(result.message.includes('gsd todos'));
  });

  test('rich mode list shows count header and todo lines', () => {
    const result = routeCommand('todos', tmpDir, [], 'rich');
    assert.ok(result.message.includes('3 pending todos'));
    assert.ok(result.message.includes('Fix login bug'));
    assert.ok(result.message.includes('Add dark mode'));
    assert.ok(result.message.includes('Update documentation'));
  });

  test('rich mode detail shows title and content', () => {
    const result = routeCommand('todos', tmpDir, ['add-dark-mode'], 'rich');
    assert.ok(result.message.includes('Add dark mode'));
    assert.ok(result.message.includes('Users want dark mode'));
  });

  test('empty state shows no pending todos message', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-todos-empty-'));
    fs.mkdirSync(path.join(emptyDir, '.planning', 'todos', 'pending'), { recursive: true });
    try {
      const result = routeCommand('todos', emptyDir, [], 'rich');
      assert.strictEqual(result.count, 0);
      assert.ok(result.message.includes('No pending todos'));
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  test('handles missing todos directory gracefully', () => {
    const noTodosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-todos-nodir-'));
    fs.mkdirSync(path.join(noTodosDir, '.planning'), { recursive: true });
    try {
      const result = routeCommand('todos', noTodosDir, [], 'json');
      assert.strictEqual(result.count, 0);
      assert.deepStrictEqual(result.todos, []);
    } finally {
      fs.rmSync(noTodosDir, { recursive: true, force: true });
    }
  });
});

// ─── handleHealth ────────────────────────────────────────────────────────────

describe('handleHealth', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-health-test-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(path.join(planningDir, 'phases', '01-setup'), { recursive: true });
    // PROJECT.md with required sections
    fs.writeFileSync(path.join(planningDir, 'PROJECT.md'),
      '# Project\n\n## What This Is\nA test project\n\n## Core Value\nTesting\n\n## Requirements\n- REQ-01\n');
    // ROADMAP.md
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'),
      '### v1.0 Test Milestone (In Progress)\n\n- [ ] Phase 1: Setup\n');
    // STATE.md
    fs.writeFileSync(path.join(planningDir, 'STATE.md'),
      '---\nmilestone: v1.0\nmilestone_name: Test Milestone\nstatus: active\n---\n\nPhase: 1 of 1 (Setup)\n');
    // config.json
    fs.writeFileSync(path.join(planningDir, 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }, null, 2));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // HLTH-01: File existence checks

  test('healthy state when all required files present (HLTH-01)', () => {
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'healthy');
    assert.ok(result.checks.every(c => c.passed), 'All checks should pass');
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('broken status when PROJECT.md missing (HLTH-01)', () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'PROJECT.md'));
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'broken');
    const projectCheck = result.checks.find(c => c.name === 'PROJECT.md');
    assert.strictEqual(projectCheck.passed, false);
    const err = result.errors.find(e => e.code === 'E002');
    assert.ok(err, 'Should have E002 error');
    assert.ok(err.fix, 'Error should have fix suggestion');
  });

  test('broken status when ROADMAP.md missing (HLTH-01)', () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'ROADMAP.md'));
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'broken');
    const err = result.errors.find(e => e.code === 'E003');
    assert.ok(err, 'Should have E003 error');
  });

  test('broken status when STATE.md missing (HLTH-01)', () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'STATE.md'));
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'broken');
    const err = result.errors.find(e => e.code === 'E004');
    assert.ok(err, 'Should have E004 error');
  });

  test('degraded status when config.json missing (HLTH-01)', () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'config.json'));
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'degraded');
    const warn = result.warnings.find(w => w.code === 'W003');
    assert.ok(warn, 'Should have W003 warning');
  });

  test('phases/ directory check shows failed when missing (HLTH-01)', () => {
    fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    const result = routeCommand('health', tmpDir, [], 'json');
    const phasesCheck = result.checks.find(c => c.name === 'phases/');
    assert.strictEqual(phasesCheck.passed, false);
  });

  test('broken status when .planning/ entirely missing (HLTH-01)', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-health-empty-'));
    try {
      const result = routeCommand('health', emptyDir, [], 'json');
      assert.strictEqual(result.status, 'broken');
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].code, 'E001');
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  // HLTH-02: Config validation

  test('no config errors with valid config.json (HLTH-02)', () => {
    const result = routeCommand('health', tmpDir, [], 'json');
    const configErrors = result.errors.filter(e => e.code === 'E005');
    assert.strictEqual(configErrors.length, 0);
  });

  test('error E005 when config.json has invalid JSON (HLTH-02)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{bad json');
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'broken');
    const err = result.errors.find(e => e.code === 'E005');
    assert.ok(err, 'Should have E005 error');
    assert.ok(err.message.includes('parse error'), 'Should mention parse error');
  });

  test('warning W004 when model_profile invalid (HLTH-02)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'invalid-profile' }));
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.status, 'degraded');
    const warn = result.warnings.find(w => w.code === 'W004');
    assert.ok(warn, 'Should have W004 warning');
    assert.ok(warn.message.includes('invalid-profile'));
  });

  // HLTH-03: State consistency

  test('no consistency warnings when state matches roadmap (HLTH-03)', () => {
    const result = routeCommand('health', tmpDir, [], 'json');
    const consistencyWarnings = result.warnings.filter(w => w.code === 'W002' || w.code === 'W005');
    assert.strictEqual(consistencyWarnings.length, 0);
  });

  test('warning W002 when STATE.md references non-existent phase (HLTH-03)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v1.0\nstatus: active\n---\n\nPhase: 99 of 99 (Missing)\n');
    const result = routeCommand('health', tmpDir, [], 'json');
    const warn = result.warnings.find(w => w.code === 'W002');
    assert.ok(warn, 'Should have W002 warning');
    assert.ok(warn.message.includes('99'));
  });

  // HLTH-04: Error/warning reporting

  test('each issue has code, message, and fix fields (HLTH-04)', () => {
    // Create a state with issues
    fs.unlinkSync(path.join(tmpDir, '.planning', 'config.json'));
    const result = routeCommand('health', tmpDir, [], 'json');
    for (const warn of result.warnings) {
      assert.ok(warn.code, 'Warning should have code');
      assert.ok(warn.message, 'Warning should have message');
      assert.ok(warn.fix, 'Warning should have fix');
    }
  });

  test('PROJECT.md missing required sections produces warnings (HLTH-04)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\nSome content\n');
    const result = routeCommand('health', tmpDir, [], 'json');
    const sectionWarnings = result.warnings.filter(w => w.code === 'W001');
    assert.ok(sectionWarnings.length > 0, 'Should warn about missing sections');
    assert.ok(sectionWarnings[0].message.includes('PROJECT.md'));
  });

  // Output modes

  test('rich mode returns message with ANSI codes', () => {
    const result = routeCommand('health', tmpDir, [], 'rich');
    assert.ok(result.message.includes('\x1b['));
    assert.ok(result.message.includes('Health Check'));
  });

  test('JSON mode returns all structured fields', () => {
    const result = routeCommand('health', tmpDir, [], 'json');
    assert.strictEqual(result.command, 'health');
    assert.ok(['healthy', 'degraded', 'broken'].includes(result.status));
    assert.ok(Array.isArray(result.checks));
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
    assert.ok(Array.isArray(result.info));
  });

  test('plain mode message contains no ANSI escape sequences', () => {
    const result = routeCommand('health', tmpDir, [], 'rich');
    const plain = formatOutput(result, 'plain');
    assert.ok(!plain.includes('\x1b'), 'Should have no ANSI codes');
    assert.ok(plain.includes('Health Check'));
  });
});

// ─── handleSettings ──────────────────────────────────────────────────────────

describe('handleSettings', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-settings-test-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'config.json'),
      JSON.stringify({ model_profile: 'balanced', commit_docs: true, workflow: { research: true, plan_check: true } }, null, 2));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('view mode returns all settings as flat key-value pairs (SETT-01)', () => {
    const result = routeCommand('settings', tmpDir, [], 'json');
    assert.strictEqual(result.command, 'settings');
    assert.ok(Array.isArray(result.settings), 'Should have settings array');
    const keys = result.settings.map(s => s.key);
    assert.ok(keys.includes('model_profile'), 'Should include model_profile');
    assert.ok(keys.includes('commit_docs'), 'Should include commit_docs');
    assert.ok(keys.includes('workflow.research'), 'Should include workflow.research');
    assert.ok(keys.includes('workflow.plan_check'), 'Should include workflow.plan_check');
  });

  test('view mode shows error when config.json missing (SETT-01)', () => {
    fs.unlinkSync(path.join(tmpDir, '.planning', 'config.json'));
    const result = routeCommand('settings', tmpDir, [], 'json');
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('config.json'));
  });

  test('set mode writes valid value to config (SETT-02)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'model_profile', 'quality'], 'json');
    assert.strictEqual(result.updated, true);
    assert.strictEqual(result.key, 'model_profile');
    assert.strictEqual(result.value, 'quality');
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.model_profile, 'quality');
  });

  test('set mode parses boolean values correctly (SETT-02)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'commit_docs', 'false'], 'json');
    assert.strictEqual(result.value, false);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.commit_docs, false);
  });

  test('set mode validates model_profile against allowed values (SETT-03)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'model_profile', 'invalid'], 'json');
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('quality'));
    assert.ok(result.message.includes('balanced'));
    assert.ok(result.message.includes('budget'));
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.model_profile, 'balanced');
  });

  test('set mode validates boolean settings reject non-boolean (SETT-03)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'commit_docs', 'yes'], 'json');
    assert.strictEqual(result.error, true);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.commit_docs, true);
  });

  test('set mode validates branching_strategy (SETT-03)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'branching_strategy', 'invalid'], 'json');
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('none'));
    assert.ok(result.message.includes('phase'));
    assert.ok(result.message.includes('milestone'));
  });

  test('set mode validates autopilot.circuit_breaker_threshold is positive integer (SETT-03)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ autopilot: { circuit_breaker_threshold: 3 } }, null, 2));
    const result = routeCommand('settings', tmpDir, ['set', 'autopilot.circuit_breaker_threshold', '0'], 'json');
    assert.strictEqual(result.error, true);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.autopilot.circuit_breaker_threshold, 3);
  });

  test('set mode allows unknown keys with info notice (SETT-02)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'custom_key', 'custom_value'], 'json');
    assert.strictEqual(result.updated, true);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.custom_key, 'custom_value');
  });

  test('set mode returns error when key or value missing', () => {
    const result = routeCommand('settings', tmpDir, ['set'], 'json');
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('Usage'));
  });

  test('rich mode view shows formatted output', () => {
    const result = routeCommand('settings', tmpDir, [], 'rich');
    assert.ok(result.message.includes('\x1b['));
    assert.ok(result.message.includes('Settings'));
  });

  test('set mode writes nested key via dot notation (SETT-02)', () => {
    const result = routeCommand('settings', tmpDir, ['set', 'workflow.research', 'false'], 'json');
    assert.strictEqual(result.updated, true);
    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.strictEqual(config.workflow.research, false);
  });
});

// ─── handleHelp ──────────────────────────────────────────────────────────────

describe('handleHelp', () => {
  test('overview mode lists all commands with descriptions (HELP-01)', () => {
    const result = routeCommand('help', null, [], 'json');
    assert.strictEqual(result.command, 'help');
    assert.ok(result.message.includes('progress'));
    assert.ok(result.message.includes('todos'));
    assert.ok(result.message.includes('health'));
    assert.ok(result.message.includes('settings'));
    assert.ok(result.message.includes('help'));
    assert.ok(result.message.includes('Usage:'));
  });

  test('per-command detail returns usage, description, flags, examples (HELP-02)', () => {
    const result = routeCommand('help', null, ['progress'], 'json');
    assert.strictEqual(result.command, 'help');
    assert.ok(result.detail, 'Should have detail object');
    assert.strictEqual(result.detail.name, 'progress');
    assert.ok(result.detail.usage.includes('gsd progress'));
    assert.ok(result.detail.description.length > 0);
    assert.ok(Array.isArray(result.detail.flags));
    assert.ok(result.detail.flags.length > 0);
    assert.ok(Array.isArray(result.detail.examples));
    assert.ok(result.detail.examples.length > 0);
  });

  test('per-command detail works for all commands (HELP-02)', () => {
    for (const cmd of ['progress', 'todos', 'health', 'settings', 'help']) {
      const result = routeCommand('help', null, [cmd], 'json');
      assert.ok(result.detail, `Should have detail for '${cmd}'`);
      assert.ok(result.detail.usage.length > 0, `Usage should be non-empty for '${cmd}'`);
    }
  });

  test('unknown command returns error with available commands (HELP-02)', () => {
    const result = routeCommand('help', null, ['nonexistent'], 'json');
    assert.strictEqual(result.error, true);
    assert.ok(result.message.includes('nonexistent'));
    assert.ok(result.message.includes('progress'));
  });

  test('per-command detail rich mode includes ANSI formatting', () => {
    const result = routeCommand('help', null, ['todos'], 'rich');
    assert.ok(result.message.includes('\x1b['));
    assert.ok(result.message.includes('gsd todos'));
  });

  test('help --json returns structured data for overview', () => {
    const result = routeCommand('help', null, [], 'json');
    assert.strictEqual(result.command, 'help');
    assert.strictEqual(typeof result.message, 'string');
  });
});
