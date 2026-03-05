/**
 * Testing — Test infrastructure: framework detection, test counting, config reading, test execution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { output, error, loadConfig, findPhaseInternal } = require('./core.cjs');

// ─── Framework Detection ────────────────────────────────────────────────────

/**
 * Detect the test framework used in a project.
 * Priority: config files > package.json deps > scripts.test heuristic
 * Returns: 'vitest' | 'jest' | 'mocha' | 'node:test' | null
 */
function detectFramework(cwd) {
  // 1. Check config files (highest confidence)
  const vitestConfigs = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'];
  for (const cfg of vitestConfigs) {
    if (fs.existsSync(path.join(cwd, cfg))) return 'vitest';
  }

  const jestConfigs = ['jest.config.js', 'jest.config.ts', 'jest.config.cjs', 'jest.config.mjs'];
  for (const cfg of jestConfigs) {
    if (fs.existsSync(path.join(cwd, cfg))) return 'jest';
  }

  const mochaConfigs = ['.mocharc.yml', '.mocharc.yaml', '.mocharc.json', '.mocharc.js', '.mocharc.cjs'];
  for (const cfg of mochaConfigs) {
    if (fs.existsSync(path.join(cwd, cfg))) return 'mocha';
  }

  // 2. Check package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }

  // Check devDependencies and dependencies
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.vitest) return 'vitest';
  if (deps.jest || deps['@jest/core']) return 'jest';
  if (deps.mocha) return 'mocha';

  // 3. Check scripts.test for node:test pattern (direct or via wrapper script)
  const testScript = pkg.scripts && pkg.scripts.test;
  if (testScript && /node\s+--test/.test(testScript)) return 'node:test';

  // 4. Check if scripts.test runs a wrapper script that uses node --test
  if (testScript) {
    const wrapperMatch = testScript.match(/node\s+(\S+\.(?:cjs|mjs|js))/);
    if (wrapperMatch) {
      try {
        const wrapperPath = path.join(cwd, wrapperMatch[1]);
        const wrapperContent = fs.readFileSync(wrapperPath, 'utf-8');
        if (/['"]--test['"]/.test(wrapperContent) || /\['--test'/.test(wrapperContent)) return 'node:test';
      } catch {
        // Wrapper not readable, continue
      }
    }
  }

  // 5. Check if test files import node:test
  try {
    const testFiles = findTestFiles(cwd);
    if (testFiles.length > 0) {
      // Check first test file for node:test import
      const firstContent = fs.readFileSync(testFiles[0], 'utf-8');
      if (/require\s*\(\s*['"]node:test['"]\s*\)/.test(firstContent) || /from\s+['"]node:test['"]/.test(firstContent)) {
        return 'node:test';
      }
    }
  } catch {
    // Ignore errors in test file scanning
  }

  return null;
}

// ─── Test File Discovery ────────────────────────────────────────────────────

const TEST_FILE_PATTERNS = /\.(test|spec)\.(js|ts|cjs|mjs)$/;
const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.planning', 'dist', 'build', 'coverage']);

/**
 * Recursively find test files in a directory.
 */
function findTestFiles(cwd) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile() && TEST_FILE_PATTERNS.test(entry.name)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  walk(cwd);
  return results;
}

// ─── Test Counting ──────────────────────────────────────────────────────────

/**
 * Count test cases (it()/test() calls) in a single file.
 */
function countTestsInFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return 0;
  }

  // Match it( and test( at start of line (with optional whitespace)
  // This is a simple regex approach — does not handle comments or strings perfectly
  // but is good enough for counting purposes.
  const matches = content.match(/^\s*(?:test|it)\s*\(/gm);
  return matches ? matches.length : 0;
}

/**
 * Count tests across a project or filtered by phase.
 * Returns: { total, files: [{ file, count }], warning? }
 */
function countTestsInProject(cwd, options = {}) {
  let testFiles;

  if (options.phase) {
    // Find test files referenced in phase plans
    testFiles = findPhaseTestFiles(cwd, options.phase);
    if (testFiles.length === 0) {
      // Fall back to all project tests with a note
      testFiles = findTestFiles(cwd);
      if (testFiles.length === 0) {
        return { total: 0, files: [], warning: 'No test files found in project' };
      }
      return countFilesAndAggregate(cwd, testFiles, 'No test file references found in phase plans; showing all project tests');
    }
  } else {
    testFiles = findTestFiles(cwd);
    if (testFiles.length === 0) {
      return { total: 0, files: [], warning: 'No test files found in project' };
    }
  }

  return countFilesAndAggregate(cwd, testFiles);
}

function countFilesAndAggregate(cwd, testFiles, warning) {
  let total = 0;
  const files = [];

  for (const filePath of testFiles) {
    const count = countTestsInFile(filePath);
    const relPath = path.relative(cwd, filePath);
    total += count;
    files.push({ file: relPath, count });
  }

  const result = { total, files };
  if (warning) result.warning = warning;
  return result;
}

/**
 * Find test files referenced in phase PLAN.md files.
 */
function findPhaseTestFiles(cwd, phaseNum) {
  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) return [];

  const phaseDir = path.join(cwd, phaseInfo.directory);
  const plans = phaseInfo.plans || [];
  const testFiles = new Set();

  for (const planFile of plans) {
    try {
      const content = fs.readFileSync(path.join(phaseDir, planFile), 'utf-8');
      // Find test file references in files_modified frontmatter and file paths in content
      const fileRefs = content.match(/[\w/.-]+\.(test|spec)\.(js|ts|cjs|mjs)/g) || [];
      for (const ref of fileRefs) {
        const fullPath = path.join(cwd, ref);
        if (fs.existsSync(fullPath)) {
          testFiles.add(fullPath);
        }
      }
    } catch {
      // Skip unreadable plans
    }
  }

  return [...testFiles];
}

// ─── Config Reading ─────────────────────────────────────────────────────────

const TEST_CONFIG_DEFAULTS = {
  hard_gate: true,
  acceptance_tests: true,
  budget: {
    per_phase: 50,
    project: 800,
  },
  steward: true,
};

/**
 * Get merged test config (explicit config + defaults).
 */
function getTestConfig(cwd) {
  const config = loadConfig(cwd);
  const testConfig = config.test || {};

  // Deep merge with defaults
  const merged = {
    hard_gate: testConfig.hard_gate !== undefined ? testConfig.hard_gate : TEST_CONFIG_DEFAULTS.hard_gate,
    acceptance_tests: testConfig.acceptance_tests !== undefined ? testConfig.acceptance_tests : TEST_CONFIG_DEFAULTS.acceptance_tests,
    budget: {
      per_phase: (testConfig.budget && testConfig.budget.per_phase !== undefined)
        ? testConfig.budget.per_phase
        : TEST_CONFIG_DEFAULTS.budget.per_phase,
      project: (testConfig.budget && testConfig.budget.project !== undefined)
        ? testConfig.budget.project
        : TEST_CONFIG_DEFAULTS.budget.project,
    },
    steward: testConfig.steward !== undefined ? testConfig.steward : TEST_CONFIG_DEFAULTS.steward,
  };

  // Add auto-detected fields
  if (testConfig.command) {
    merged.command = testConfig.command;
  } else {
    const framework = detectFramework(cwd);
    if (framework) {
      merged.command = getDefaultCommand(framework);
    }
  }

  if (testConfig.framework) {
    merged.framework = testConfig.framework;
  } else {
    merged.framework = detectFramework(cwd) || null;
  }

  return merged;
}

function getDefaultCommand(framework) {
  switch (framework) {
    case 'vitest': return 'npx vitest run';
    case 'jest': return 'npx jest';
    case 'mocha': return 'npx mocha';
    case 'node:test': return 'node --test';
    default: return null;
  }
}

// ─── Test Execution ──────────────────────────────────────────────────────────

const DEFAULT_TEST_TIMEOUT = 120000; // 2 minutes

/**
 * Parse test runner output to extract counts and failing test names.
 * Framework-specific parsing with fallback to empty results.
 * Returns: { total, passed, failed, failedTests: string[] }
 */
function parseTestOutput(stdout, stderr, framework) {
  const combined = (stdout || '') + '\n' + (stderr || '');
  const result = { total: 0, passed: 0, failed: 0, failedTests: [] };

  switch (framework) {
    case 'node:test': {
      // TAP format: # tests N, # pass N, # fail N, not ok N - description
      const totalMatch = combined.match(/#\s*tests\s+(\d+)/);
      const passMatch = combined.match(/#\s*pass\s+(\d+)/);
      const failMatch = combined.match(/#\s*fail\s+(\d+)/);
      if (totalMatch) result.total = parseInt(totalMatch[1], 10);
      if (passMatch) result.passed = parseInt(passMatch[1], 10);
      if (failMatch) result.failed = parseInt(failMatch[1], 10);

      // Extract failing test names from "not ok N - description"
      const failedLines = combined.match(/^not ok \d+ - (.+)$/gm);
      if (failedLines) {
        for (const line of failedLines) {
          const nameMatch = line.match(/^not ok \d+ - (.+)$/);
          if (nameMatch) result.failedTests.push(nameMatch[1].trim());
        }
      }
      break;
    }

    case 'jest': {
      // Jest: Tests:  N failed, N passed, N total
      const jestMatch = combined.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
      if (jestMatch) {
        result.failed = jestMatch[1] ? parseInt(jestMatch[1], 10) : 0;
        result.passed = parseInt(jestMatch[2], 10);
        result.total = parseInt(jestMatch[3], 10);
      }
      break;
    }

    case 'vitest': {
      // Vitest: Tests  N failed | N passed (total)
      const vitestMatch = combined.match(/Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed/);
      if (vitestMatch) {
        result.failed = vitestMatch[1] ? parseInt(vitestMatch[1], 10) : 0;
        result.passed = parseInt(vitestMatch[2], 10);
        result.total = result.failed + result.passed;
      }
      break;
    }

    case 'mocha': {
      // Mocha: N passing, N failing
      const passMatch = combined.match(/(\d+)\s+passing/);
      const failMatch = combined.match(/(\d+)\s+failing/);
      if (passMatch) result.passed = parseInt(passMatch[1], 10);
      if (failMatch) result.failed = parseInt(failMatch[1], 10);
      result.total = result.passed + result.failed;
      break;
    }

    default:
      // Unknown framework: cannot parse, return zeros
      break;
  }

  return result;
}

/**
 * Execute a test command and capture output.
 * Returns: { exitCode, stdout, stderr }
 */
function runTestCommand(cwd, command, timeout) {
  try {
    const stdout = execSync(command, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeout || DEFAULT_TEST_TIMEOUT,
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout || '', stderr: '' };
  } catch (err) {
    if (err.killed) {
      // Timeout
      return {
        exitCode: -1,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        timeout: true,
      };
    }
    return {
      exitCode: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

/**
 * Run the test suite and return structured results.
 * Supports baseline capture, baseline comparison, and TDD RED detection.
 *
 * Options:
 *   baseline: boolean — capture baseline data
 *   baselineData: object — previous baseline for comparison
 *   commitMsg: string — commit message to check for TDD RED pattern
 *
 * Returns JSON via output():
 *   { status, total, passed, failed, new_failures, baseline_failures, summary, raw_length, baseline? }
 */
function cmdTestRun(cwd, options, raw) {
  const opts = options || {};
  const config = getTestConfig(cwd);

  // 1. Check hard_gate config
  if (!config.hard_gate) {
    output({
      status: 'skip',
      total: 0, passed: 0, failed: 0,
      new_failures: [], baseline_failures: [],
      summary: 'Hard gate disabled',
      raw_length: 0,
    }, raw, 'Hard gate disabled');
    return; // output() calls process.exit, but return for clarity
  }

  // 2. Check for TDD RED commit
  if (opts.commitMsg && /^test\(/.test(opts.commitMsg)) {
    output({
      status: 'skip',
      total: 0, passed: 0, failed: 0,
      new_failures: [], baseline_failures: [],
      summary: 'TDD RED commit detected -- gate skipped',
      raw_length: 0,
    }, raw, 'TDD RED commit detected -- gate skipped');
    return;
  }

  // 3. Check for test command
  const command = config.command;
  if (!command) {
    output({
      status: 'skip',
      total: 0, passed: 0, failed: 0,
      new_failures: [], baseline_failures: [],
      summary: 'No test command available',
      raw_length: 0,
    }, raw, 'No test command available');
    return;
  }

  // 4. Run tests
  const testResult = runTestCommand(cwd, command);

  // Handle timeout
  if (testResult.timeout) {
    output({
      status: 'error',
      total: 0, passed: 0, failed: 0,
      new_failures: [], baseline_failures: [],
      summary: 'Test execution timed out',
      raw_length: (testResult.stdout || '').length + (testResult.stderr || '').length,
    }, raw, 'Test execution timed out');
    return;
  }

  // 5. Parse output
  const parsed = parseTestOutput(testResult.stdout, testResult.stderr, config.framework);
  const rawLength = (testResult.stdout || '').length + (testResult.stderr || '').length;

  // If parsing didn't extract counts but we have an exit code, use exit code
  if (parsed.total === 0 && testResult.exitCode === 0) {
    parsed.total = 0;
    parsed.passed = 0;
    parsed.failed = 0;
  }

  // 6. Build result
  const result = {
    status: testResult.exitCode === 0 ? 'pass' : 'fail',
    total: parsed.total,
    passed: parsed.passed,
    failed: parsed.failed,
    new_failures: [],
    baseline_failures: [],
    summary: '',
    raw_length: rawLength,
  };

  // 7. Handle baseline capture
  if (opts.baseline) {
    result.baseline = {
      exitCode: testResult.exitCode,
      total: parsed.total,
      passed: parsed.passed,
      failed: parsed.failed,
      failedTests: parsed.failedTests,
    };
  }

  // 8. Handle baseline comparison
  if (opts.baselineData) {
    const baselineFailedSet = new Set(opts.baselineData.failedTests || []);
    const currentFailedTests = parsed.failedTests || [];

    const newFailures = currentFailedTests.filter(t => !baselineFailedSet.has(t));
    const baselineFailures = currentFailedTests.filter(t => baselineFailedSet.has(t));

    result.new_failures = newFailures;
    result.baseline_failures = baselineFailures;

    // If no new failures, status is pass (pre-existing failures are OK)
    if (newFailures.length === 0 && testResult.exitCode !== 0) {
      result.status = 'pass';
    }
  }

  // 9. Build summary
  if (result.status === 'pass') {
    if (parsed.total > 0) {
      result.summary = `${parsed.passed}/${parsed.total} tests passed`;
    } else {
      result.summary = 'Tests passed';
    }
    if (result.baseline_failures.length > 0) {
      result.summary += ` (${result.baseline_failures.length} pre-existing failure(s) in baseline)`;
    }
  } else if (result.status === 'fail') {
    if (result.new_failures.length > 0) {
      result.summary = `${result.new_failures.length} new failure(s): ${result.new_failures.join(', ')}`;
    } else if (parsed.failed > 0) {
      result.summary = `${parsed.failed} test(s) failed`;
    } else {
      result.summary = 'Tests failed (exit code ' + testResult.exitCode + ')';
    }
  }

  output(result, raw, result.summary);
}

// ─── Exported Cmd Functions ─────────────────────────────────────────────────

function cmdTestCount(cwd, options, raw) {
  const result = countTestsInProject(cwd, options || {});
  output(result, raw, String(result.total));
}

function cmdTestDetectFramework(cwd, raw) {
  const framework = detectFramework(cwd);
  output({ framework }, raw, framework || 'unknown');
}

function cmdTestConfig(cwd, raw) {
  const config = getTestConfig(cwd);
  output(config, raw, JSON.stringify(config));
}

module.exports = {
  detectFramework,
  findTestFiles,
  countTestsInFile,
  countTestsInProject,
  getTestConfig,
  parseTestOutput,
  cmdTestCount,
  cmdTestDetectFramework,
  cmdTestConfig,
  cmdTestRun,
};
