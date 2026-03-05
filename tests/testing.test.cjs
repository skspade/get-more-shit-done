/**
 * GSD Tools Tests - testing.cjs
 *
 * Tests for framework detection, test counting, config reading, and CLI integration.
 *
 * Requirements: FOUND-01, FOUND-02, FOUND-03, FOUND-05
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// Direct require for unit tests
const testing = require('../get-shit-done/bin/lib/testing.cjs');

// ─── Framework Detection ────────────────────────────────────────────────────

describe('detectFramework', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns vitest when vitest.config.ts exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.writeFileSync(path.join(tmpDir, 'vitest.config.ts'), 'export default {}');
    assert.strictEqual(testing.detectFramework(tmpDir), 'vitest');
  });

  test('returns jest when jest.config.js exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.writeFileSync(path.join(tmpDir, 'jest.config.js'), 'module.exports = {}');
    assert.strictEqual(testing.detectFramework(tmpDir), 'jest');
  });

  test('returns mocha when .mocharc.yml exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    fs.writeFileSync(path.join(tmpDir, '.mocharc.yml'), 'timeout: 5000');
    assert.strictEqual(testing.detectFramework(tmpDir), 'mocha');
  });

  test('returns jest when jest is in devDependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { jest: '^29.0.0' },
    }));
    assert.strictEqual(testing.detectFramework(tmpDir), 'jest');
  });

  test('returns vitest when vitest is in devDependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { vitest: '^1.0.0' },
    }));
    assert.strictEqual(testing.detectFramework(tmpDir), 'vitest');
  });

  test('returns mocha when mocha is in devDependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { mocha: '^10.0.0' },
    }));
    assert.strictEqual(testing.detectFramework(tmpDir), 'mocha');
  });

  test('returns node:test when scripts.test has node --test', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      scripts: { test: 'node --test tests/*.cjs' },
    }));
    assert.strictEqual(testing.detectFramework(tmpDir), 'node:test');
  });

  test('returns null for empty project without package.json', () => {
    assert.strictEqual(testing.detectFramework(tmpDir), null);
  });

  test('returns null for project with no test framework', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      scripts: { start: 'node index.js' },
    }));
    assert.strictEqual(testing.detectFramework(tmpDir), null);
  });

  test('config files take priority over package.json deps', () => {
    // vitest.config.ts exists but jest is in deps - config file wins
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { jest: '^29.0.0' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'vitest.config.ts'), 'export default {}');
    assert.strictEqual(testing.detectFramework(tmpDir), 'vitest');
  });

  test('returns node:test when wrapper script uses --test', () => {
    // Create wrapper script that uses --test
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'run-tests.cjs'),
      "execFileSync(process.execPath, ['--test', ...files]);"
    );
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      scripts: { test: 'node scripts/run-tests.cjs' },
    }));
    assert.strictEqual(testing.detectFramework(tmpDir), 'node:test');
  });
});

// ─── Test Counting ──────────────────────────────────────────────────────────

describe('countTestsInFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('counts test() calls correctly', () => {
    const testFile = path.join(tmpDir, 'sample.test.cjs');
    fs.writeFileSync(testFile, `
const { test } = require('node:test');
test('first test', () => {});
test('second test', () => {});
test('third test', () => {});
`);
    assert.strictEqual(testing.countTestsInFile(testFile), 3);
  });

  test('counts it() calls correctly', () => {
    const testFile = path.join(tmpDir, 'sample.test.cjs');
    fs.writeFileSync(testFile, `
const { it } = require('node:test');
it('should work', () => {});
it('should also work', () => {});
`);
    assert.strictEqual(testing.countTestsInFile(testFile), 2);
  });

  test('counts mixed test() and it() calls', () => {
    const testFile = path.join(tmpDir, 'sample.test.cjs');
    fs.writeFileSync(testFile, `
const { test, it } = require('node:test');
test('a test', () => {});
it('another test', () => {});
test('third one', () => {});
`);
    assert.strictEqual(testing.countTestsInFile(testFile), 3);
  });

  test('returns 0 for empty file', () => {
    const testFile = path.join(tmpDir, 'empty.test.cjs');
    fs.writeFileSync(testFile, '');
    assert.strictEqual(testing.countTestsInFile(testFile), 0);
  });

  test('returns 0 for non-existent file', () => {
    assert.strictEqual(testing.countTestsInFile(path.join(tmpDir, 'nope.test.cjs')), 0);
  });

  test('handles indented test calls', () => {
    const testFile = path.join(tmpDir, 'indented.test.cjs');
    fs.writeFileSync(testFile, `
describe('group', () => {
  test('nested test', () => {});
    test('deeply nested', () => {});
});
`);
    assert.strictEqual(testing.countTestsInFile(testFile), 2);
  });
});

describe('findTestFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('finds .test.cjs files', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'foo.test.cjs'), '');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'bar.test.cjs'), '');
    const files = testing.findTestFiles(tmpDir);
    assert.strictEqual(files.length, 2);
  });

  test('finds .spec.ts files', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'utils.spec.ts'), '');
    const files = testing.findTestFiles(tmpDir);
    assert.strictEqual(files.length, 1);
  });

  test('excludes node_modules', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.test.js'), '');
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'real.test.js'), '');
    const files = testing.findTestFiles(tmpDir);
    assert.strictEqual(files.length, 1);
    assert.ok(files[0].includes('real.test.js'));
  });

  test('returns empty array for project with no test files', () => {
    const files = testing.findTestFiles(tmpDir);
    assert.strictEqual(files.length, 0);
  });
});

describe('countTestsInProject', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns total and per-file breakdown', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'a.test.cjs'), `
test('one', () => {});
test('two', () => {});
`);
    fs.writeFileSync(path.join(tmpDir, 'tests', 'b.test.cjs'), `
test('three', () => {});
`);
    const result = testing.countTestsInProject(tmpDir);
    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.files.length, 2);
  });

  test('returns zero with warning for project with no tests', () => {
    const result = testing.countTestsInProject(tmpDir);
    assert.strictEqual(result.total, 0);
    assert.strictEqual(result.files.length, 0);
    assert.ok(result.warning);
  });

  test('excludes node_modules from count', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.test.js'), `
test('should not count', () => {});
`);
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'real.test.cjs'), `
test('should count', () => {});
`);
    const result = testing.countTestsInProject(tmpDir);
    assert.strictEqual(result.total, 1);
  });
});

// ─── Config Reading ─────────────────────────────────────────────────────────

describe('getTestConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns all defaults when no config exists', () => {
    const config = testing.getTestConfig(tmpDir);
    assert.strictEqual(config.hard_gate, true);
    assert.strictEqual(config.acceptance_tests, true);
    assert.strictEqual(config.budget.per_phase, 50);
    assert.strictEqual(config.budget.project, 800);
    assert.strictEqual(config.steward, true);
  });

  test('merges explicit config over defaults', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      test: {
        hard_gate: false,
        budget: { per_phase: 100 },
      },
    }, null, 2));
    const config = testing.getTestConfig(tmpDir);
    assert.strictEqual(config.hard_gate, false);
    assert.strictEqual(config.acceptance_tests, true); // default preserved
    assert.strictEqual(config.budget.per_phase, 100); // overridden
    assert.strictEqual(config.budget.project, 800); // default preserved
  });

  test('uses all explicit values when fully specified', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      test: {
        hard_gate: false,
        acceptance_tests: false,
        budget: { per_phase: 25, project: 400 },
        steward: false,
        command: 'npm test',
        framework: 'jest',
      },
    }, null, 2));
    const config = testing.getTestConfig(tmpDir);
    assert.strictEqual(config.hard_gate, false);
    assert.strictEqual(config.acceptance_tests, false);
    assert.strictEqual(config.budget.per_phase, 25);
    assert.strictEqual(config.budget.project, 400);
    assert.strictEqual(config.steward, false);
    assert.strictEqual(config.command, 'npm test');
    assert.strictEqual(config.framework, 'jest');
  });
});

// ─── CLI Integration ────────────────────────────────────────────────────────

describe('test-count CLI command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns 0 total for empty project', () => {
    const result = runGsdTools('test-count', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.total, 0);
    assert.ok(output.warning);
  });

  test('returns correct count for project with test files', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'sample.test.cjs'), `
test('one', () => {});
test('two', () => {});
`);
    const result = runGsdTools('test-count', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.total, 2);
    assert.strictEqual(output.files.length, 1);
  });

  test('raw mode returns total as string', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'sample.test.cjs'), `
test('one', () => {});
`);
    const result = runGsdTools('test-count --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.output, '1');
  });
});

describe('test-detect-framework CLI command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns framework as JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { jest: '^29.0.0' },
    }));
    const result = runGsdTools('test-detect-framework', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.framework, 'jest');
  });

  test('returns unknown in raw mode for empty project', () => {
    const result = runGsdTools('test-detect-framework --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.output, 'unknown');
  });

  test('detects node:test on this codebase', () => {
    // Run against the real codebase
    const result = runGsdTools('test-detect-framework');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.framework, 'node:test');
  });
});

describe('test-config CLI command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns valid JSON with all expected keys', () => {
    const result = runGsdTools('test-config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok('hard_gate' in output, 'has hard_gate');
    assert.ok('acceptance_tests' in output, 'has acceptance_tests');
    assert.ok('budget' in output, 'has budget');
    assert.ok('per_phase' in output.budget, 'has budget.per_phase');
    assert.ok('project' in output.budget, 'has budget.project');
    assert.ok('steward' in output, 'has steward');
  });
});

// ─── Config Defaults Integration ────────────────────────────────────────────

describe('config-ensure-section creates test.* defaults', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates config with test section and all defaults', () => {
    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    assert.ok(config.test, 'config has test section');
    assert.strictEqual(config.test.hard_gate, true, 'test.hard_gate defaults to true');
    assert.strictEqual(config.test.acceptance_tests, true, 'test.acceptance_tests defaults to true');
    assert.ok(config.test.budget, 'test has budget section');
    assert.strictEqual(config.test.budget.per_phase, 50, 'test.budget.per_phase defaults to 50');
    assert.strictEqual(config.test.budget.project, 800, 'test.budget.project defaults to 800');
    assert.strictEqual(config.test.steward, true, 'test.steward defaults to true');
  });
});
