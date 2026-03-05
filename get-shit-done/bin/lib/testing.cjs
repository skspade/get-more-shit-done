/**
 * Testing — Test infrastructure: framework detection, test counting, config reading
 */

const fs = require('fs');
const path = require('path');
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
  cmdTestCount,
  cmdTestDetectFramework,
  cmdTestConfig,
};
