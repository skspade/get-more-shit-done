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

  test('routes todos to handler', () => {
    const result = routeCommand('todos', '/tmp', [], 'rich');
    assert.strictEqual(result.command, 'todos');
  });

  test('routes health to handler', () => {
    const result = routeCommand('health', '/tmp', [], 'rich');
    assert.strictEqual(result.command, 'health');
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
