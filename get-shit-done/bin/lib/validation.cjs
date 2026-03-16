/**
 * Validation — Project health check registry and validation engine
 */

const fs = require('fs');
const path = require('path');
const { extractFrontmatter } = require('./frontmatter.cjs');
const { getMilestoneInfo, findPhaseInternal } = require('./core.cjs');
const { computePhaseStatus, findFirstIncompletePhase, extractPhaseNumbers } = require('./phase.cjs');

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
  // STATE-01: Milestone name match
  {
    id: 'STATE-01',
    category: 'state',
    severity: 'error',
    check: (cwd) => {
      try {
        const statePath = path.join(cwd, '.planning', 'STATE.md');
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        if (!fs.existsSync(statePath) || !fs.existsSync(roadmapPath)) {
          return { passed: true, message: 'Milestone name check skipped — STATE.md or ROADMAP.md not found' };
        }
        const stateContent = fs.readFileSync(statePath, 'utf-8');
        const fm = extractFrontmatter(stateContent);
        const stateMilestone = fm.milestone_name;
        if (!stateMilestone) {
          return { passed: true, message: 'Milestone name check skipped — no milestone_name in STATE.md' };
        }
        const milestoneInfo = getMilestoneInfo(cwd);
        const roadmapName = milestoneInfo.name;
        if (stateMilestone === roadmapName || stateMilestone.includes(roadmapName) || roadmapName.includes(stateMilestone)) {
          return { passed: true, message: `Milestone name matches: "${stateMilestone}"` };
        }
        return { passed: false, message: `STATE.md milestone "${stateMilestone}" does not match ROADMAP.md milestone "${roadmapName}"` };
      } catch {
        return { passed: true, message: 'Milestone name check skipped — error reading files' };
      }
    },
  },
  // STATE-02: Completed phases count
  {
    id: 'STATE-02',
    category: 'state',
    severity: 'warning',
    check: (cwd) => {
      try {
        const statePath = path.join(cwd, '.planning', 'STATE.md');
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        if (!fs.existsSync(statePath) || !fs.existsSync(roadmapPath)) {
          return { passed: true, message: 'Completed phases check skipped — STATE.md or ROADMAP.md not found' };
        }
        const stateContent = fs.readFileSync(statePath, 'utf-8');
        const fm = extractFrontmatter(stateContent);
        const stateCompleted = Number(fm.progress?.completed_phases);
        if (isNaN(stateCompleted)) {
          return { passed: true, message: 'Completed phases check skipped — no completed_phases in STATE.md' };
        }
        const counts = countRoadmapPhases(cwd);
        if (stateCompleted === counts.checked) {
          return { passed: true, message: `Completed phases count matches: ${stateCompleted}` };
        }
        return { passed: false, message: `STATE.md completed_phases (${stateCompleted}) does not match ROADMAP.md checked count (${counts.checked})` };
      } catch {
        return { passed: true, message: 'Completed phases check skipped — error reading files' };
      }
    },
  },
  // STATE-03: Total phases count
  {
    id: 'STATE-03',
    category: 'state',
    severity: 'warning',
    check: (cwd) => {
      try {
        const statePath = path.join(cwd, '.planning', 'STATE.md');
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        if (!fs.existsSync(statePath) || !fs.existsSync(roadmapPath)) {
          return { passed: true, message: 'Total phases check skipped — STATE.md or ROADMAP.md not found' };
        }
        const stateContent = fs.readFileSync(statePath, 'utf-8');
        const fm = extractFrontmatter(stateContent);
        const stateTotal = Number(fm.progress?.total_phases);
        if (isNaN(stateTotal)) {
          return { passed: true, message: 'Total phases check skipped — no total_phases in STATE.md' };
        }
        const counts = countRoadmapPhases(cwd);
        if (stateTotal === counts.total) {
          return { passed: true, message: `Total phases count matches: ${stateTotal}` };
        }
        return { passed: false, message: `STATE.md total_phases (${stateTotal}) does not match ROADMAP.md phase count (${counts.total})` };
      } catch {
        return { passed: true, message: 'Total phases check skipped — error reading files' };
      }
    },
  },
  // STATE-04: Status consistency
  {
    id: 'STATE-04',
    category: 'state',
    severity: 'warning',
    check: (cwd) => {
      try {
        const statePath = path.join(cwd, '.planning', 'STATE.md');
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        if (!fs.existsSync(statePath) || !fs.existsSync(roadmapPath)) {
          return { passed: true, message: 'Status consistency check skipped — STATE.md or ROADMAP.md not found' };
        }
        const stateContent = fs.readFileSync(statePath, 'utf-8');
        const fm = extractFrontmatter(stateContent);
        const status = fm.status;
        if (!status) {
          return { passed: true, message: 'Status consistency check skipped — no status in STATE.md' };
        }
        const counts = countRoadmapPhases(cwd);
        const unchecked = counts.total - counts.checked;
        if (status === 'completed' && unchecked > 0) {
          return { passed: false, message: `STATE.md status is "completed" but ${unchecked} unchecked phase(s) remain in ROADMAP.md` };
        }
        return { passed: true, message: `Status "${status}" is consistent with ROADMAP.md` };
      } catch {
        return { passed: true, message: 'Status consistency check skipped — error reading files' };
      }
    },
  },
  // NAV-01: computePhaseStatus returns valid data
  {
    id: 'NAV-01',
    category: 'navigation',
    severity: 'info',
    check: (cwd) => {
      try {
        const phasesDir = path.join(cwd, '.planning', 'phases');
        if (!fs.existsSync(phasesDir)) {
          return { passed: true, message: 'Phase status check skipped — phases/ not found' };
        }
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const firstDir = entries.find(e => e.isDirectory() && PHASE_DIR_REGEX.test(e.name));
        if (!firstDir) {
          return { passed: true, message: 'Phase status check skipped — no valid phase directories' };
        }
        const phaseNum = firstDir.name.match(/^(\d+(?:\.\d+)*)/)[1];
        const phaseInfo = findPhaseInternal(cwd, phaseNum);
        if (!phaseInfo) {
          return { passed: true, message: 'Phase status check skipped — phase not found' };
        }
        const status = computePhaseStatus(cwd, phaseInfo);
        if (status && status.step) {
          return { passed: true, message: `computePhaseStatus returns valid data (step: ${status.step})` };
        }
        return { passed: false, message: 'computePhaseStatus returned null or missing step' };
      } catch {
        return { passed: true, message: 'Phase status check skipped — error' };
      }
    },
  },
  // NAV-02: findFirstIncompletePhase returns result when milestone active
  {
    id: 'NAV-02',
    category: 'navigation',
    severity: 'warning',
    check: (cwd) => {
      try {
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        if (!fs.existsSync(roadmapPath)) {
          return { passed: true, message: 'Navigation check skipped — ROADMAP.md not found' };
        }
        const counts = countRoadmapPhases(cwd);
        if (counts.total - counts.checked === 0) {
          return { passed: true, message: 'Milestone complete — no unchecked phases' };
        }
        const result = findFirstIncompletePhase(cwd);
        if (result !== null) {
          return { passed: true, message: `First incomplete phase: ${result}` };
        }
        return { passed: false, message: 'Milestone active but findFirstIncompletePhase returned null' };
      } catch {
        return { passed: true, message: 'Navigation check skipped — error' };
      }
    },
  },
  // NAV-03: Each incomplete phase has deterministic lifecycle step
  {
    id: 'NAV-03',
    category: 'navigation',
    severity: 'error',
    check: (cwd) => {
      try {
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        const phasesDir = path.join(cwd, '.planning', 'phases');
        if (!fs.existsSync(roadmapPath) || !fs.existsSync(phasesDir)) {
          return { passed: true, message: 'Lifecycle step check skipped — ROADMAP.md or phases/ not found' };
        }
        const content = fs.readFileSync(roadmapPath, 'utf-8');
        const cleaned = content.replace(/<details>[\s\S]*?<\/details>/gi, '');
        const phases = extractPhaseNumbers(cleaned);
        const validSteps = ['discuss', 'plan', 'execute', 'verify', 'complete'];
        const problems = [];
        for (const phaseNum of phases) {
          const phaseInfo = findPhaseInternal(cwd, phaseNum);
          if (!phaseInfo) continue;
          const status = computePhaseStatus(cwd, phaseInfo);
          if (!status) continue;
          if (status.phase_complete) continue;
          if (!validSteps.includes(status.step)) {
            problems.push(`Phase ${phaseNum}: step "${status.step}" is not deterministic`);
          }
        }
        if (problems.length === 0) {
          return { passed: true, message: 'All incomplete phases have deterministic lifecycle steps' };
        }
        return { passed: false, message: problems.join('; ') };
      } catch {
        return { passed: true, message: 'Lifecycle step check skipped — error' };
      }
    },
  },
  // NAV-04: Disk vs ROADMAP phase sync
  {
    id: 'NAV-04',
    category: 'navigation',
    severity: 'warning',
    check: (cwd) => {
      try {
        const phasesDir = path.join(cwd, '.planning', 'phases');
        const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
        if (!fs.existsSync(phasesDir) || !fs.existsSync(roadmapPath)) {
          return { passed: true, message: 'Phase sync check skipped — phases/ or ROADMAP.md not found' };
        }
        const content = fs.readFileSync(roadmapPath, 'utf-8');
        const cleaned = content.replace(/<details>[\s\S]*?<\/details>/gi, '');
        const stripLeadingZeros = (s) => s.replace(/^0+/, '') || '0';
        const roadmapPhases = new Set(extractPhaseNumbers(cleaned).map(stripLeadingZeros));
        const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
        const diskPhases = new Set();
        for (const e of entries) {
          if (e.isDirectory() && PHASE_DIR_REGEX.test(e.name)) {
            const m = e.name.match(/^(\d+(?:\.\d+)*)/);
            if (m) diskPhases.add(stripLeadingZeros(m[1]));
          }
        }
        const issues = [];
        for (const p of diskPhases) {
          if (!roadmapPhases.has(p)) {
            issues.push(`Orphan directory: Phase ${p} on disk but not in ROADMAP`);
          }
        }
        for (const p of roadmapPhases) {
          if (!diskPhases.has(p)) {
            issues.push(`Missing directory: Phase ${p} in ROADMAP but not on disk`);
          }
        }
        if (issues.length === 0) {
          return { passed: true, message: 'Disk and ROADMAP phases are in sync' };
        }
        return { passed: false, message: issues.join('; ') };
      } catch {
        return { passed: true, message: 'Phase sync check skipped — error' };
      }
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function countRoadmapPhases(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const cleaned = content.replace(/<details>[\s\S]*?<\/details>/gi, '');
  const checked = (cleaned.match(/- \[x\]\s+\*?\*?Phase\s+\d+/gi) || []).length;
  const unchecked = (cleaned.match(/- \[ \]\s+\*?\*?Phase\s+\d+/gi) || []).length;
  return { checked, total: checked + unchecked };
}

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
