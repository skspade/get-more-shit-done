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

const {
  findProjectRoot,
  parseArgs,
  formatOutput,
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
