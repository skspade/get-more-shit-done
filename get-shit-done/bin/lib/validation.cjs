/**
 * Validation — Project health check registry and validation engine
 */

const fs = require('fs');
const path = require('path');

// ─── Constants ──────────────────────────────────────────────────────────────

const KNOWN_SETTINGS_KEYS = ['model_profile', 'commit_docs', 'search_gitignored', 'branching_strategy',
  'workflow', 'parallelization', 'autopilot', 'mode', 'depth', 'model_overrides',
  'research', 'plan_checker', 'verifier', 'nyquist_validation', 'test'];

const VALID_PROFILES = ['quality', 'balanced', 'budget'];

const PHASE_DIR_REGEX = /^\d{2}(?:\.\d+)*-[\w-]+$/;

// ─── Check Registry ──────────────────────────────────────────────────────────

const checks = [
  // STRUCT-01a: .planning/ directory
  {
    id: 'STRUCT-01a',
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
  // STRUCT-01b: PROJECT.md
  {
    id: 'STRUCT-01b',
    category: 'structure',
    severity: 'error',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning', 'PROJECT.md'));
      return {
        passed: exists,
        message: exists ? 'PROJECT.md exists' : 'PROJECT.md not found',
      };
    },
  },
  // STRUCT-01c: ROADMAP.md
  {
    id: 'STRUCT-01c',
    category: 'structure',
    severity: 'error',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning', 'ROADMAP.md'));
      return {
        passed: exists,
        message: exists ? 'ROADMAP.md exists' : 'ROADMAP.md not found',
      };
    },
  },
  // STRUCT-01d: STATE.md
  {
    id: 'STRUCT-01d',
    category: 'structure',
    severity: 'error',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning', 'STATE.md'));
      return {
        passed: exists,
        message: exists ? 'STATE.md exists' : 'STATE.md not found',
      };
    },
  },
  // STRUCT-01e: config.json
  {
    id: 'STRUCT-01e',
    category: 'structure',
    severity: 'warning',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning', 'config.json'));
      return {
        passed: exists,
        message: exists ? 'config.json exists' : 'config.json not found',
      };
    },
  },
  // STRUCT-01f: phases/ directory
  {
    id: 'STRUCT-01f',
    category: 'structure',
    severity: 'warning',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning', 'phases'));
      return {
        passed: exists,
        message: exists ? 'phases/ directory exists' : 'phases/ directory not found',
      };
    },
  },
  // STRUCT-02: config.json validation (single check, dynamic severity)
  {
    id: 'STRUCT-02',
    category: 'structure',
    severity: 'warning',
    check: (cwd) => {
      const configPath = path.join(cwd, '.planning', 'config.json');
      if (!fs.existsSync(configPath)) {
        return { passed: true, message: 'config.json validation skipped — file not found' };
      }
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          return { passed: false, message: `config.json: JSON parse error — ${err.message}`, severity: 'error' };
        }
        const issues = [];
        let worstSeverity = 'info';
        if (parsed.model_profile && !VALID_PROFILES.includes(parsed.model_profile)) {
          issues.push(`invalid model_profile "${parsed.model_profile}" (valid: ${VALID_PROFILES.join(', ')})`);
          worstSeverity = 'warning';
        }
        const unknownKeys = Object.keys(parsed).filter(k => !KNOWN_SETTINGS_KEYS.includes(k));
        if (unknownKeys.length > 0) {
          issues.push(`unknown key(s): ${unknownKeys.join(', ')}`);
          if (worstSeverity === 'info') worstSeverity = 'info';
        }
        if (issues.length === 0) {
          return { passed: true, message: 'config.json valid' };
        }
        return { passed: false, message: `config.json: ${issues.join('; ')}`, severity: worstSeverity };
      } catch (err) {
        return { passed: false, message: `config.json: read error — ${err.message}`, severity: 'error' };
      }
    },
  },
  // STRUCT-03: Phase directory naming
  {
    id: 'STRUCT-03',
    category: 'structure',
    severity: 'warning',
    check: (cwd) => {
      const phasesDir = path.join(cwd, '.planning', 'phases');
      if (!fs.existsSync(phasesDir)) {
        return { passed: true, message: 'Phase directory check skipped — phases/ not found' };
      }
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const bad = [];
        for (const e of entries) {
          if (e.isDirectory() && !PHASE_DIR_REGEX.test(e.name)) {
            bad.push(e.name);
          }
        }
        if (bad.length === 0) {
          return { passed: true, message: 'All phase directories match NN-name format' };
        }
        return { passed: false, message: `Phase directories not matching NN-name format: ${bad.join(', ')}` };
      } catch {
        return { passed: true, message: 'Phase directory check skipped — read error' };
      }
    },
  },
  // STRUCT-04: Orphaned plans (PLAN without SUMMARY)
  {
    id: 'STRUCT-04',
    category: 'structure',
    severity: 'info',
    check: (cwd) => {
      const phasesDir = path.join(cwd, '.planning', 'phases');
      if (!fs.existsSync(phasesDir)) {
        return { passed: true, message: 'Orphaned plan check skipped — phases/ not found' };
      }
      try {
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const orphans = [];
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          const phaseFiles = fs.readdirSync(path.join(phasesDir, e.name));
          const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
          const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
          const summaryBases = new Set(summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));
          for (const plan of plans) {
            const planBase = plan.replace('-PLAN.md', '').replace('PLAN.md', '');
            if (!summaryBases.has(planBase)) {
              orphans.push(`${e.name}/${plan}`);
            }
          }
        }
        if (orphans.length === 0) {
          return { passed: true, message: 'No orphaned plans found' };
        }
        return { passed: false, message: `Orphaned plans (no SUMMARY.md): ${orphans.join(', ')}` };
      } catch {
        return { passed: true, message: 'Orphaned plan check skipped — read error' };
      }
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
      severity: result.severity || entry.severity,
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

module.exports = { validateProjectHealth, runChecks, KNOWN_SETTINGS_KEYS };
