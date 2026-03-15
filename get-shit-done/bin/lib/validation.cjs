/**
 * Validation — Project health check registry and validation engine
 */

const fs = require('fs');
const path = require('path');

// ─── Check Registry ──────────────────────────────────────────────────────────

const checks = [
  {
    id: 'STRUCT-01',
    category: 'structure',
    severity: 'error',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning'));
      return {
        passed: exists,
        message: exists ? '.planning/ directory exists' : '.planning/ directory not found',
      };
    },
  },
];

// ─── Check Execution ─────────────────────────────────────────────────────────

function runChecks(cwd, options = {}) {
  const { categories } = options;
  const toRun = categories
    ? checks.filter(c => categories.includes(c.category))
    : checks;

  const results = [];
  for (const entry of toRun) {
    const result = entry.check(cwd);
    results.push({
      id: entry.id,
      category: entry.category,
      severity: entry.severity,
      passed: result.passed,
      message: result.message,
      repairable: typeof entry.repair === 'function',
      repairAction: null,
    });
  }
  return results;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function validateProjectHealth(cwd, options = {}) {
  const { categories } = options;
  const results = runChecks(cwd, { categories });

  const errors = results.filter(r => !r.passed && r.severity === 'error');
  const warnings = results.filter(r => !r.passed && r.severity === 'warning');
  const healthy = errors.length === 0;

  return {
    healthy,
    checks: results,
    errors,
    warnings,
    repairs: [],
    nextPhase: null,
    phaseStep: null,
  };
}

module.exports = { validateProjectHealth, runChecks };
