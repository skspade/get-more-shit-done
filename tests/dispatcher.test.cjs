/**
 * GSD Tools Tests - Dispatcher
 *
 * Tests for gsd-tools.cjs dispatch routing and error paths.
 * Covers: no-command, unknown command, unknown subcommands for every command group,
 * --cwd parsing, and previously untouched routing branches.
 *
 * Requirements: DISP-01, DISP-02
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Dispatcher Error Paths ──────────────────────────────────────────────────

describe('dispatcher error paths', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // No command
  test('no-command invocation prints usage and exits non-zero', () => {
    const result = runGsdTools('', tmpDir);
    assert.strictEqual(result.success, false, 'Should exit non-zero');
    assert.ok(result.error.includes('Usage:'), `Expected "Usage:" in stderr, got: ${result.error}`);
  });

  // Unknown command
  test('unknown command produces clear error and exits non-zero', () => {
    const result = runGsdTools('nonexistent-cmd', tmpDir);
    assert.strictEqual(result.success, false, 'Should exit non-zero');
    assert.ok(result.error.includes('Unknown command'), `Expected "Unknown command" in stderr, got: ${result.error}`);
  });

  // --cwd= form with valid directory
  test('--cwd= form overrides working directory', () => {
    // Create STATE.md in tmpDir so state load can find it
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\n'
    );
    const result = runGsdTools(`--cwd=${tmpDir} state load`, process.cwd());
    assert.strictEqual(result.success, true, `Should succeed with --cwd=, got: ${result.error}`);
  });

  // --cwd= with empty value
  test('--cwd= with empty value produces error', () => {
    const result = runGsdTools('--cwd= state load', tmpDir);
    assert.strictEqual(result.success, false, 'Should exit non-zero');
    assert.ok(result.error.includes('Missing value for --cwd'), `Expected "Missing value for --cwd" in stderr, got: ${result.error}`);
  });

  // --cwd with nonexistent path
  test('--cwd with invalid path produces error', () => {
    const result = runGsdTools('--cwd /nonexistent/path/xyz state load', tmpDir);
    assert.strictEqual(result.success, false, 'Should exit non-zero');
    assert.ok(result.error.includes('Invalid --cwd'), `Expected "Invalid --cwd" in stderr, got: ${result.error}`);
  });

  // Unknown subcommand errors — parameterized
  const unknownSubcommandCases = [
    { command: 'template bogus', expected: 'Unknown template subcommand' },
    { command: 'frontmatter bogus file.md', expected: 'Unknown frontmatter subcommand' },
    { command: 'verify bogus', expected: 'Unknown verify subcommand' },
    { command: 'phases bogus', expected: 'Unknown phases subcommand' },
    { command: 'roadmap bogus', expected: 'Unknown roadmap subcommand' },
    { command: 'requirements bogus', expected: 'Unknown requirements subcommand' },
    { command: 'phase bogus', expected: 'Unknown phase subcommand' },
    { command: 'milestone bogus', expected: 'Unknown milestone subcommand' },
    { command: 'validate bogus', expected: 'Unknown validate subcommand' },
    { command: 'todo bogus', expected: 'Unknown todo subcommand' },
    { command: 'init bogus', expected: 'Unknown init workflow' },
  ];

  for (const { command, expected } of unknownSubcommandCases) {
    test(`${command.split(' ')[0]} unknown subcommand errors`, () => {
      const result = runGsdTools(command, tmpDir);
      assert.strictEqual(result.success, false, 'Should exit non-zero');
      assert.ok(result.error.includes(expected), `Expected "${expected}" in stderr, got: ${result.error}`);
    });
  }
});

// ─── Dispatcher Routing Branches ─────────────────────────────────────────────

describe('dispatcher routing branches', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Routing smoke tests — parameterized
  const routingCases = [
    {
      name: 'find-phase locates phase directory by number',
      command: 'find-phase 01',
      setup: (dir) => {
        fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-test-phase'), { recursive: true });
      },
      validate: (result) => {
        assert.ok(result.output.includes('01-test-phase'), `Expected "01-test-phase" in output, got: ${result.output}`);
      },
    },
    {
      name: 'init resume returns valid JSON',
      command: 'init resume',
      setup: (dir) => {
        fs.writeFileSync(
          path.join(dir, '.planning', 'STATE.md'),
          '# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nPlan: 01-01 complete\nStatus: Ready\nLast activity: 2026-01-01\n\nProgress: [##########] 100%\n\n## Session Continuity\n\nLast session: 2026-01-01\nStopped at: Test\nResume file: None\n'
        );
      },
      validate: (result) => {
        const parsed = JSON.parse(result.output);
        assert.ok(typeof parsed === 'object', 'Output should be valid JSON object');
      },
    },
    {
      name: 'init verify-work returns valid JSON',
      command: 'init verify-work 01',
      setup: (dir) => {
        fs.writeFileSync(
          path.join(dir, '.planning', 'STATE.md'),
          '# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nPlan: 01-01 complete\nStatus: Ready\nLast activity: 2026-01-01\n\nProgress: [##########] 100%\n\n## Session Continuity\n\nLast session: 2026-01-01\nStopped at: Test\nResume file: None\n'
        );
        fs.writeFileSync(
          path.join(dir, '.planning', 'ROADMAP.md'),
          '# Roadmap\n\n## Milestone: v1.0 Test\n\n### Phase 1: Test Phase\n**Goal**: Test goal\n**Depends on**: None\n**Requirements**: TEST-01\n**Success Criteria**:\n  1. Tests pass\n**Plans**: 1 plan\nPlans:\n- [x] 01-01-PLAN.md\n\n## Progress\n\n| Phase | Plans | Status | Date |\n|-------|-------|--------|------|\n| 1 | 1/1 | Complete | 2026-01-01 |\n'
        );
        fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-test'), { recursive: true });
      },
      validate: (result) => {
        const parsed = JSON.parse(result.output);
        assert.ok(typeof parsed === 'object', 'Output should be valid JSON object');
      },
    },
    {
      name: 'roadmap update-plan-progress updates phase progress',
      command: 'roadmap update-plan-progress 1',
      setup: (dir) => {
        fs.writeFileSync(
          path.join(dir, '.planning', 'ROADMAP.md'),
          '# Roadmap\n\n## Milestone: v1.0 Test\n\n### Phase 1: Test Phase\n**Goal**: Test goal\n**Depends on**: None\n**Requirements**: TEST-01\n**Success Criteria**:\n  1. Tests pass\n**Plans**: 1 plan\nPlans:\n- [ ] 01-01-PLAN.md\n\n## Progress\n\n| Phase | Plans | Status | Date |\n|-------|-------|--------|------|\n| 1 | 0/1 | Not Started | - |\n'
        );
        const phaseDir = path.join(dir, '.planning', 'phases', '01-test-phase');
        fs.mkdirSync(phaseDir, { recursive: true });
        fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-test-phase\nplan: "01"\n---\n\n# Plan\n');
        fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '---\nphase: 01-test-phase\nplan: "01"\n---\n\n# Summary\n');
      },
      validate: () => {},
    },
    {
      name: 'state with no subcommand calls cmdStateLoad',
      command: 'state',
      setup: (dir) => {
        fs.writeFileSync(
          path.join(dir, '.planning', 'STATE.md'),
          '# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nPlan: 01-01 complete\nStatus: Ready\nLast activity: 2026-01-01\n\nProgress: [##########] 100%\n\n## Session Continuity\n\nLast session: 2026-01-01\nStopped at: Test\nResume file: None\n'
        );
      },
      validate: (result) => {
        const parsed = JSON.parse(result.output);
        assert.ok(typeof parsed === 'object', 'Output should be valid JSON object');
      },
    },
    {
      name: 'summary-extract parses SUMMARY.md frontmatter',
      command: 'summary-extract .planning/phases/01-test/01-01-SUMMARY.md',
      setup: (dir) => {
        const phaseDir = path.join(dir, '.planning', 'phases', '01-test');
        fs.mkdirSync(phaseDir, { recursive: true });
        fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '---\nphase: 01-test\nplan: "01"\nsubsystem: testing\ntags: [node, test]\nduration: 5min\ncompleted: "2026-01-01"\nkey-decisions:\n  - "Used node:test"\nrequirements-completed: [TEST-01]\n---\n\n# Phase 1 Plan 01: Test Summary\n\n**Tests added for core module**\n');
      },
      validate: (result) => {
        const parsed = JSON.parse(result.output);
        assert.ok(typeof parsed === 'object', 'Output should be valid JSON object');
        assert.strictEqual(parsed.path, '.planning/phases/01-test/01-01-SUMMARY.md');
        assert.deepStrictEqual(parsed.requirements_completed, ['TEST-01']);
      },
    },
  ];

  for (const { name, command, setup, validate } of routingCases) {
    test(name, () => {
      setup(tmpDir);
      const result = runGsdTools(command, tmpDir);
      assert.strictEqual(result.success, true, `${command} failed: ${result.error}`);
      validate(result);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// phase find-next dispatch
// Requirements: REQ-27
// ─────────────────────────────────────────────────────────────────────────────

describe('phase find-next dispatch', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n## Phases\n### Phase 1: Foundation\n### Phase 2: API\n'
    );
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '.completed'), '');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns first incomplete phase', () => {
    const result = runGsdTools('phase find-next', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed, '2');
  });

  test('returns null when all phases complete', () => {
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-api');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '.completed'), '');

    const result = runGsdTools('phase find-next', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed, null);
  });

  test('--from returns next incomplete after given phase', () => {
    const result = runGsdTools('phase find-next --from 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed, '2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verify status/gaps dispatch
// Requirements: REQ-27
// ─────────────────────────────────────────────────────────────────────────────

describe('verify status/gaps dispatch', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n## Phases\n### Phase 1: Foundation\n'
    );
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, '01-VERIFICATION.md'),
      '---\nstatus: passed\nscore: 90\n---\n## Results\nAll good.\n## Gaps Found\n- Missing coverage\n## Summary\nDone.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('verify status returns status and score', () => {
    const result = runGsdTools('verify status 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.status, 'passed');
    assert.strictEqual(parsed.score, '90');
  });

  test('verify gaps returns gap lines', () => {
    const result = runGsdTools('verify gaps 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed), 'Output should be an array');
    assert.ok(parsed.includes('- Missing coverage'), `Expected "- Missing coverage" in: ${JSON.stringify(parsed)}`);
  });

  test('verify status errors without phase arg', () => {
    const result = runGsdTools('verify status', tmpDir);
    assert.strictEqual(result.success, false);
  });

  test('verify gaps errors without phase arg', () => {
    const result = runGsdTools('verify gaps', tmpDir);
    assert.strictEqual(result.success, false);
  });
});
