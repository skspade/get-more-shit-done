/**
 * CLI — Project discovery, argument parsing, and output formatting for the gsd CLI
 */

const fs = require('fs');
const path = require('path');
const { getMilestoneInfo, comparePhaseNum } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');
const testing = require('./testing.cjs');

// ─── Project Discovery ──────────────────────────────────────────────────────

/**
 * Walk up from startDir looking for a .planning/ directory.
 * Returns the directory containing .planning/, or null if not found.
 */
function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, '.planning');
    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) {
        return dir;
      }
    } catch {
      // .planning/ doesn't exist here, keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root
      return null;
    }
    dir = parent;
  }
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

/**
 * Parse CLI arguments.
 * Returns { command, args, mode } where mode is 'json', 'plain', or 'rich'.
 */
function parseArgs(argv) {
  let mode = 'rich';
  const positional = [];

  for (const arg of argv) {
    if (arg === '--json') {
      mode = 'json';
    } else if (arg === '--plain') {
      mode = 'plain';
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return {
    command: positional[0],
    args: positional.slice(1),
    mode,
  };
}

// ─── Output Formatting ──────────────────────────────────────────────────────

/**
 * Format data for output based on mode.
 * - 'json': JSON.stringify the data
 * - 'plain': strip ANSI escape codes from string representation
 * - 'rich': pass through as-is
 */
function formatOutput(data, mode) {
  if (mode === 'json') {
    return JSON.stringify(data, null, 2);
  }

  const text = typeof data === 'string' ? data : (data && data.message ? data.message : JSON.stringify(data, null, 2));

  if (mode === 'plain') {
    // Strip ANSI escape sequences
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  // 'rich' mode — pass through
  return text;
}

// ─── Error Helper ────────────────────────────────────────────────────────────

/**
 * Write error to stderr and exit with code 1.
 */
function cliError(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// ─── Progress Command ───────────────────────────────────────────────────────

/**
 * Gather progress data from .planning/ directory state.
 * Returns structured data with milestone info, phase statuses, progress, and next action.
 */
function gatherProgressData(projectRoot) {
  const planningDir = path.join(projectRoot, '.planning');
  const phasesDir = path.join(planningDir, 'phases');

  // Milestone info from ROADMAP.md
  const milestoneRaw = getMilestoneInfo(projectRoot);
  let milestoneStatus = 'active';
  try {
    const stateContent = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    const fm = extractFrontmatter(stateContent);
    if (fm.status && fm.status !== 'unknown') {
      milestoneStatus = fm.status;
    }
  } catch {
    // STATE.md not found or unreadable
  }

  const milestone = {
    name: milestoneRaw.name,
    version: milestoneRaw.version,
    status: milestoneStatus,
  };

  // Read phases from disk
  const phases = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => {
      const aNum = a.match(/^(\d+(?:\.\d+)*)/);
      const bNum = b.match(/^(\d+(?:\.\d+)*)/);
      if (aNum && bNum) return comparePhaseNum(aNum[1], bNum[1]);
      return a.localeCompare(b);
    });

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)*)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
      const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');

      totalPlans += plans;
      totalSummaries += summaries;

      let statusIndicator;
      if (plans > 0 && summaries >= plans) statusIndicator = 'complete';
      else if (summaries > 0) statusIndicator = 'in_progress';
      else if (plans > 0) statusIndicator = 'planned';
      else statusIndicator = 'not_started';

      phases.push({
        number: phaseNum,
        name: phaseName,
        status_indicator: statusIndicator,
        plan_counts: plans > 0 ? `${summaries}/${plans} plans` : '0 plans',
        _hasContext: hasContext,
        _plans: plans,
        _summaries: summaries,
      });
    }
  } catch {
    // phases directory not found
  }

  // Progress
  const percent = totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0;
  const barWidth = 20;
  const filled = Math.round((percent / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  const progress = {
    percent,
    completed_plans: totalSummaries,
    total_plans: totalPlans,
    bar,
  };

  // Current position and next action
  const currentPhase = phases.find(p => p.status_indicator === 'in_progress')
    || phases.find(p => p.status_indicator === 'planned')
    || phases.find(p => p.status_indicator === 'not_started')
    || null;

  let nextAction;
  if (phases.length === 0) {
    nextAction = 'No phases found';
  } else if (phases.every(p => p.status_indicator === 'complete')) {
    nextAction = 'All phases complete -- milestone done';
  } else if (currentPhase) {
    if (currentPhase.status_indicator === 'not_started' && !currentPhase._hasContext) {
      nextAction = `Discuss phase ${currentPhase.number}: gsd discuss-phase ${currentPhase.number}`;
    } else if (currentPhase._plans === 0) {
      nextAction = `Plan phase ${currentPhase.number}: gsd plan-phase ${currentPhase.number}`;
    } else if (currentPhase._summaries < currentPhase._plans) {
      nextAction = `Execute phase ${currentPhase.number}: gsd execute-phase ${currentPhase.number}`;
    } else {
      nextAction = `Verify phase ${currentPhase.number}: gsd verify-phase ${currentPhase.number}`;
    }
  } else {
    nextAction = 'All phases complete -- milestone done';
  }

  const currentPosition = {
    phase: currentPhase ? currentPhase.number : null,
    plan: null,
  };

  // Strip internal fields from phases
  const cleanPhases = phases.map(({ _hasContext, _plans, _summaries, ...rest }) => rest);

  return { milestone, phases: cleanPhases, progress, current_position: currentPosition, next_action: nextAction };
}

function handleProgress(projectRoot) {
  const data = gatherProgressData(projectRoot || '.');

  // Build rich-mode formatted string
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const CYAN = '\x1b[36m';
  const DIM = '\x1b[2m';

  const statusColor = data.milestone.status === 'complete' ? GREEN : YELLOW;
  const lines = [];
  lines.push(`${BOLD}${data.milestone.name} ${data.milestone.version}${RESET} ${statusColor}(${data.milestone.status})${RESET}`);
  lines.push('');
  lines.push('Phases:');

  for (const phase of data.phases) {
    let icon;
    if (phase.status_indicator === 'complete') icon = `${GREEN}\u2713${RESET}`;
    else if (phase.status_indicator === 'in_progress') icon = `${YELLOW}\u25B6${RESET}`;
    else if (phase.status_indicator === 'planned') icon = `${CYAN}\u25CB${RESET}`;
    else icon = `${DIM}-${RESET}`;

    lines.push(`  ${icon} Phase ${phase.number}: ${phase.name}  ${phase.plan_counts}`);
  }

  lines.push('');
  lines.push(`Progress: [${data.progress.bar}] ${data.progress.completed_plans}/${data.progress.total_plans} plans (${data.progress.percent}%)`);
  lines.push('');

  if (data.current_position.phase) {
    lines.push(`Current: Phase ${data.current_position.phase}`);
  }
  lines.push(`Next: ${data.next_action}`);

  const message = lines.join('\n');

  return { command: 'progress', ...data, message };
}

// ─── Todos Command ─────────────────────────────────────────────────────────

/**
 * Read .planning/todos/pending/ and return structured todo data.
 * Optionally filter by area.
 */
function gatherTodosData(projectRoot, area) {
  const pendingDir = path.join(projectRoot, '.planning', 'todos', 'pending');
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        if (area && todoArea !== area) continue;

        todos.push({
          id: file.replace(/\.md$/, ''),
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory doesn't exist -- return empty list
  }

  return { count: todos.length, todos };
}

/**
 * Read a single todo file and return full details including body content.
 * Returns null if the todo file does not exist.
 */
function getTodoDetail(projectRoot, todoId) {
  const pendingDir = path.join(projectRoot, '.planning', 'todos', 'pending');
  const filePath = path.join(pendingDir, todoId + '.md');

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const createdMatch = raw.match(/^created:\s*(.+)$/m);
    const titleMatch = raw.match(/^title:\s*(.+)$/m);
    const areaMatch = raw.match(/^area:\s*(.+)$/m);

    // Extract body content after frontmatter closing ---
    const firstDash = raw.indexOf('---');
    const fmEnd = firstDash !== -1 ? raw.indexOf('---', firstDash + 3) : -1;
    const body = fmEnd !== -1 ? raw.slice(fmEnd + 3).trim() : '';

    return {
      id: todoId,
      title: titleMatch ? titleMatch[1].trim() : 'Untitled',
      area: areaMatch ? areaMatch[1].trim() : 'general',
      created: createdMatch ? createdMatch[1].trim() : 'unknown',
      content: body,
      path: path.join('.planning', 'todos', 'pending', todoId + '.md'),
    };
  } catch {
    return null;
  }
}

function handleTodos(projectRoot, args) {
  // Parse --area flag from process.argv (parseArgs drops it)
  let area = null;
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--area=')) {
      area = argv[i].slice('--area='.length);
    } else if (argv[i] === '--area' && i + 1 < argv.length) {
      area = argv[i + 1];
    }
  }

  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  const CYAN = '\x1b[36m';
  const DIM = '\x1b[2m';

  // Detail mode: gsd todos <id>
  if (args && args.length > 0) {
    const todoId = args[0];
    const todo = getTodoDetail(projectRoot, todoId);

    if (!todo) {
      const message = `Todo not found: ${todoId}\nRun gsd todos to see available IDs.`;
      return { command: 'todos', error: true, message };
    }

    const lines = [];
    lines.push(`${BOLD}${todo.title}${RESET}`);
    lines.push(`${DIM}ID:${RESET}      ${todo.id}`);
    lines.push(`${DIM}Area:${RESET}    ${CYAN}${todo.area}${RESET}`);
    lines.push(`${DIM}Created:${RESET} ${todo.created}`);
    lines.push(`${DIM}Path:${RESET}    ${todo.path}`);
    if (todo.content) {
      lines.push('');
      lines.push(todo.content);
    }

    return { command: 'todos', todo, message: lines.join('\n') };
  }

  // List mode: gsd todos [--area=X]
  const data = gatherTodosData(projectRoot, area);

  if (data.count === 0) {
    const emptyMsg = area
      ? `No pending todos matching area '${area}'`
      : 'No pending todos';
    return { command: 'todos', count: 0, todos: [], message: emptyMsg };
  }

  const lines = [];
  const header = area
    ? `${data.count} pending todo${data.count !== 1 ? 's' : ''} (area: ${area})`
    : `${data.count} pending todo${data.count !== 1 ? 's' : ''}`;
  lines.push(`${BOLD}${header}${RESET}`);
  lines.push('');

  for (const todo of data.todos) {
    lines.push(`  ${DIM}${todo.id}${RESET}  ${CYAN}[${todo.area}]${RESET}  ${todo.title}`);
  }

  return { command: 'todos', count: data.count, todos: data.todos, message: lines.join('\n') };
}

// ─── Health Command ─────────────────────────────────────────────────────────

/**
 * Gather health data by validating .planning/ directory structure,
 * config integrity, and state consistency.
 * Returns { status, checks, errors, warnings, info }.
 */
function gatherHealthData(projectRoot) {
  const planningDir = path.join(projectRoot, '.planning');
  const checks = [];
  const errors = [];
  const warnings = [];
  const info = [];

  const addIssue = (severity, code, message, fix) => {
    const issue = { code, message, fix };
    if (severity === 'error') errors.push(issue);
    else if (severity === 'warning') warnings.push(issue);
    else info.push(issue);
  };

  // ─── HLTH-01: Required file checks ──────────────────────────────────────

  // Check .planning/ directory
  const planningExists = fs.existsSync(planningDir);
  checks.push({
    name: '.planning/',
    path: '.planning/',
    passed: planningExists,
    detail: planningExists ? 'Directory exists' : 'Directory not found',
  });
  if (!planningExists) {
    addIssue('error', 'E001', '.planning/ directory not found', 'Run /gsd:new-project to initialize');
    const status = 'broken';
    return { status, checks, errors, warnings, info };
  }

  // Check PROJECT.md
  const projectPath = path.join(planningDir, 'PROJECT.md');
  const projectExists = fs.existsSync(projectPath);
  checks.push({
    name: 'PROJECT.md',
    path: '.planning/PROJECT.md',
    passed: projectExists,
    detail: projectExists ? 'File exists' : 'File not found',
  });
  if (!projectExists) {
    addIssue('error', 'E002', 'PROJECT.md not found', 'Run /gsd:new-project to create');
  } else {
    const projectContent = fs.readFileSync(projectPath, 'utf-8');
    const requiredSections = ['## What This Is', '## Core Value', '## Requirements'];
    for (const section of requiredSections) {
      if (!projectContent.includes(section)) {
        addIssue('warning', 'W001', `PROJECT.md missing section: ${section}`, 'Add section manually');
      }
    }
  }

  // Check ROADMAP.md
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  const roadmapExists = fs.existsSync(roadmapPath);
  checks.push({
    name: 'ROADMAP.md',
    path: '.planning/ROADMAP.md',
    passed: roadmapExists,
    detail: roadmapExists ? 'File exists' : 'File not found',
  });
  if (!roadmapExists) {
    addIssue('error', 'E003', 'ROADMAP.md not found', 'Run /gsd:new-milestone to create roadmap');
  }

  // Check STATE.md
  const statePath = path.join(planningDir, 'STATE.md');
  const stateExists = fs.existsSync(statePath);
  checks.push({
    name: 'STATE.md',
    path: '.planning/STATE.md',
    passed: stateExists,
    detail: stateExists ? 'File exists' : 'File not found',
  });
  if (!stateExists) {
    addIssue('error', 'E004', 'STATE.md not found', 'Run /gsd:health --repair to regenerate');
  }

  // Check config.json
  const configPath = path.join(planningDir, 'config.json');
  const configExists = fs.existsSync(configPath);
  checks.push({
    name: 'config.json',
    path: '.planning/config.json',
    passed: configExists,
    detail: configExists ? 'File exists' : 'File not found',
  });
  if (!configExists) {
    addIssue('warning', 'W003', 'config.json not found', 'Run /gsd:health --repair to create with defaults');
  }

  // Check phases/ directory
  const phasesDir = path.join(planningDir, 'phases');
  const phasesExists = fs.existsSync(phasesDir);
  checks.push({
    name: 'phases/',
    path: '.planning/phases/',
    passed: phasesExists,
    detail: phasesExists ? 'Directory exists' : 'Directory not found',
  });

  // ─── HLTH-02: Config validation ─────────────────────────────────────────

  if (configExists) {
    try {
      const configRaw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(configRaw);

      const validProfiles = ['quality', 'balanced', 'budget'];
      if (parsed.model_profile && !validProfiles.includes(parsed.model_profile)) {
        addIssue('warning', 'W004', `config.json: invalid model_profile "${parsed.model_profile}"`, `Valid values: ${validProfiles.join(', ')}`);
      }

      const knownKeys = ['model_profile', 'commit_docs', 'search_gitignored', 'branching_strategy',
        'workflow', 'parallelization', 'autopilot', 'mode', 'depth', 'model_overrides',
        'research', 'plan_checker', 'verifier', 'nyquist_validation', 'test'];
      for (const key of Object.keys(parsed)) {
        if (!knownKeys.includes(key)) {
          addIssue('info', 'I001', `config.json: unknown key "${key}"`, 'May be a custom extension');
        }
      }
    } catch (err) {
      addIssue('error', 'E005', `config.json: JSON parse error - ${err.message}`, 'Fix JSON syntax or run /gsd:health --repair to reset');
    }
  }

  // ─── HLTH-03: State consistency ─────────────────────────────────────────

  if (stateExists && roadmapExists) {
    try {
      const stateContent = fs.readFileSync(statePath, 'utf-8');

      // Extract phase references from STATE.md
      const phaseRefs = [...stateContent.matchAll(/[Pp]hase:?\s+(\d+(?:\.\d+)*)/g)].map(m => m[1]);

      // Get phases on disk
      const diskPhases = new Set();
      if (phasesExists) {
        try {
          const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              const dm = e.name.match(/^(\d+(?:\.\d+)*)/);
              if (dm) diskPhases.add(dm[1]);
            }
          }
        } catch { /* ignore */ }
      }

      // Check for invalid phase references
      // Build a set of normalized disk phase numbers for comparison
      const normalizedDiskPhases = new Set([...diskPhases].map(p => String(parseInt(p, 10))));
      for (const ref of phaseRefs) {
        const normalizedRef = String(parseInt(ref, 10));
        if (diskPhases.size > 0 && !diskPhases.has(ref) && !normalizedDiskPhases.has(normalizedRef)) {
          addIssue('warning', 'W002', `STATE.md references Phase ${ref}, but no matching directory found`, 'Update STATE.md or create phase directory');
        }
      }

      // Check STATE.md current phase vs ROADMAP completion
      const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

      // Find current phase from STATE.md body text
      const currentPhaseMatch = stateContent.match(/Phase:\s*(\d+)\s+of\s+\d+/);
      if (currentPhaseMatch) {
        const currentPhaseNum = currentPhaseMatch[1];
        // Check if ROADMAP shows this phase as already completed
        const completedPattern = new RegExp(`\\[x\\]\\s+\\*\\*Phase\\s+${currentPhaseNum}:`, 'i');
        if (completedPattern.test(roadmapContent)) {
          addIssue('warning', 'W005', `STATE.md reports Phase ${currentPhaseNum} as current, but ROADMAP.md shows it completed`, 'Run /gsd:health --repair to sync state');
        }
      }
    } catch { /* ignore read errors */ }
  }

  // ─── Determine overall status ──────────────────────────────────────────

  let status;
  if (errors.length > 0) {
    status = 'broken';
  } else if (warnings.length > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  return { status, checks, errors, warnings, info };
}

function handleHealth(projectRoot) {
  const data = gatherHealthData(projectRoot || '.');

  // Build rich-mode formatted string
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const RED = '\x1b[31m';
  const DIM = '\x1b[2m';

  const lines = [];

  // Header with status
  const statusColors = { healthy: GREEN, degraded: YELLOW, broken: RED };
  const statusLabels = { healthy: 'Healthy', degraded: 'Degraded', broken: 'Broken' };
  const color = statusColors[data.status] || RED;
  lines.push(`${BOLD}Health Check${RESET}  ${color}${statusLabels[data.status] || data.status}${RESET}`);
  lines.push('');

  // File checks
  lines.push('Files:');
  for (const check of data.checks) {
    const icon = check.passed ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
    const detail = check.passed ? '' : `  ${DIM}${check.detail}${RESET}`;
    lines.push(`  ${icon} ${check.name}${detail}`);
  }

  // Issues
  if (data.errors.length > 0) {
    lines.push('');
    lines.push(`${RED}Errors:${RESET}`);
    for (const err of data.errors) {
      lines.push(`  ${RED}${err.code}${RESET} ${err.message}`);
      lines.push(`       ${DIM}Fix: ${err.fix}${RESET}`);
    }
  }

  if (data.warnings.length > 0) {
    lines.push('');
    lines.push(`${YELLOW}Warnings:${RESET}`);
    for (const warn of data.warnings) {
      lines.push(`  ${YELLOW}${warn.code}${RESET} ${warn.message}`);
      lines.push(`       ${DIM}Fix: ${warn.fix}${RESET}`);
    }
  }

  // Summary
  lines.push('');
  const parts = [];
  if (data.errors.length > 0) parts.push(`${data.errors.length} error${data.errors.length !== 1 ? 's' : ''}`);
  if (data.warnings.length > 0) parts.push(`${data.warnings.length} warning${data.warnings.length !== 1 ? 's' : ''}`);
  if (data.info.length > 0) parts.push(`${data.info.length} info`);
  lines.push(parts.length > 0 ? parts.join(', ') : 'No issues found');

  const message = lines.join('\n');

  return { command: 'health', ...data, message };
}

// ─── Settings Command ───────────────────────────────────────────────────────

/**
 * Flatten a nested object to dot-notation key-value pairs.
 * e.g., { workflow: { research: true } } -> [{ key: 'workflow.research', value: true }]
 */
function flattenConfig(obj, prefix) {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result.push(...flattenConfig(val, fullKey));
    } else {
      result.push({ key: fullKey, value: val });
    }
  }
  return result;
}

/**
 * Validate a setting key-value pair.
 * Returns null if valid, or an error message string if invalid.
 */
function validateSetting(key, value) {
  const validProfiles = ['quality', 'balanced', 'budget'];
  const validStrategies = ['none', 'phase', 'milestone'];
  const booleanKeys = ['commit_docs', 'search_gitignored', 'parallelization',
    'workflow.research', 'workflow.plan_check', 'workflow.verifier', 'workflow.auto_advance'];

  if (key === 'model_profile') {
    if (!validProfiles.includes(value)) {
      return `Invalid model_profile '${value}'. Valid values: ${validProfiles.join(', ')}`;
    }
  } else if (key === 'branching_strategy') {
    if (!validStrategies.includes(value)) {
      return `Invalid branching_strategy '${value}'. Valid values: ${validStrategies.join(', ')}`;
    }
  } else if (booleanKeys.includes(key)) {
    if (typeof value !== 'boolean') {
      return `'${key}' must be a boolean (true or false)`;
    }
  } else if (key === 'autopilot.circuit_breaker_threshold') {
    if (!Number.isInteger(value) || value <= 0) {
      return `'autopilot.circuit_breaker_threshold' must be a positive integer`;
    }
  }

  return null;
}

/**
 * Gather settings data from .planning/config.json.
 * Returns { settings: [...] } or { error: true, message: '...' }.
 */
function gatherSettingsData(projectRoot) {
  const configPath = path.join(projectRoot, '.planning', 'config.json');

  if (!fs.existsSync(configPath)) {
    return { error: true, message: 'config.json not found. Run /gsd:health --repair to create defaults.' };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const settings = flattenConfig(config);
    return { settings };
  } catch (err) {
    return { error: true, message: `Failed to read config.json: ${err.message}` };
  }
}

/**
 * List of known top-level and dot-notation config keys for unknown-key detection.
 */
const KNOWN_SETTINGS_KEYS = [
  'model_profile', 'commit_docs', 'search_gitignored', 'branching_strategy',
  'phase_branch_template', 'milestone_branch_template',
  'workflow', 'workflow.research', 'workflow.plan_check', 'workflow.verifier',
  'workflow.auto_advance', 'workflow.nyquist_validation',
  'parallelization', 'brave_search',
  'autopilot', 'autopilot.circuit_breaker_threshold',
  'mode', 'depth', 'model_overrides',
  'research', 'plan_checker', 'verifier', 'nyquist_validation',
  'test', 'test.hard_gate', 'test.acceptance_tests', 'test.budget',
  'test.budget.per_phase', 'test.budget.project', 'test.steward',
  'test.command', 'test.framework',
];

function handleSettings(projectRoot, args) {
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  const DIM = '\x1b[2m';
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';

  // Set mode: gsd settings set <key> <value>
  if (args && args.length > 0 && args[0] === 'set') {
    const key = args[1];
    const rawValue = args[2];

    if (!key || rawValue === undefined || rawValue === null) {
      return { command: 'settings', error: true, message: 'Usage: gsd settings set <key> <value>' };
    }

    // Parse value: booleans and numbers
    let parsedValue = rawValue;
    if (rawValue === 'true') parsedValue = true;
    else if (rawValue === 'false') parsedValue = false;
    else if (!isNaN(rawValue) && rawValue !== '') parsedValue = Number(rawValue);

    // Validate
    const validationError = validateSetting(key, parsedValue);
    if (validationError) {
      const message = `${RED}Error:${RESET} ${validationError}`;
      return { command: 'settings', error: true, key, value: rawValue, message };
    }

    // Read config
    const configPath = path.join(projectRoot, '.planning', 'config.json');
    let config = {};
    try {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch (err) {
      return { command: 'settings', error: true, message: `Failed to read config.json: ${err.message}` };
    }

    // Set nested value using dot notation
    const keys = key.split('.');
    let current = config;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current[k] === undefined || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    current[keys[keys.length - 1]] = parsedValue;

    // Write back
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
      return { command: 'settings', error: true, message: `Failed to write config.json: ${err.message}` };
    }

    // Build confirmation message
    const isUnknown = !KNOWN_SETTINGS_KEYS.includes(key);
    const lines = [];
    if (isUnknown) {
      lines.push(`${DIM}Note: '${key}' is not a recognized setting${RESET}`);
    }
    lines.push(`${GREEN}${key}${RESET} = ${BOLD}${parsedValue}${RESET} (updated)`);

    return { command: 'settings', updated: true, key, value: parsedValue, message: lines.join('\n') };
  }

  // View mode: gsd settings
  const data = gatherSettingsData(projectRoot);

  if (data.error) {
    return { command: 'settings', error: true, message: data.message };
  }

  const lines = [];
  lines.push(`${BOLD}Settings (.planning/config.json)${RESET}`);
  lines.push('');
  for (const setting of data.settings) {
    lines.push(`  ${DIM}${setting.key}${RESET} = ${BOLD}${setting.value}${RESET}`);
  }

  return { command: 'settings', settings: data.settings, message: lines.join('\n') };
}

// ─── Help Command ───────────────────────────────────────────────────────────

const COMMAND_DETAILS = {
  progress: {
    usage: 'gsd progress [--json] [--plain]',
    description: 'Show milestone progress and status. Displays the current milestone name, version, phase list with completion status, plan counts, progress bar, and suggested next action.',
    flags: [
      { flag: '--json', description: 'Output as JSON' },
      { flag: '--plain', description: 'Output as plain text (no colors)' },
    ],
    examples: [
      'gsd progress',
      'gsd progress --json',
    ],
  },
  todos: {
    usage: 'gsd todos [<id>] [--area=<area>] [--json] [--plain]',
    description: 'List and inspect pending todos. Shows all pending todos by default. Use an ID to see full details of a specific todo, or filter by area.',
    flags: [
      { flag: '<id>', description: 'Show full details for a specific todo' },
      { flag: '--area=<area>', description: 'Filter todos by area' },
      { flag: '--json', description: 'Output as JSON' },
      { flag: '--plain', description: 'Output as plain text (no colors)' },
    ],
    examples: [
      'gsd todos',
      'gsd todos fix-login-bug',
      'gsd todos --area=bugfix',
    ],
  },
  health: {
    usage: 'gsd health [--json] [--plain]',
    description: 'Validate .planning/ directory integrity. Checks that required files exist, config.json is valid, and STATE.md is consistent with ROADMAP.md.',
    flags: [
      { flag: '--json', description: 'Output as JSON' },
      { flag: '--plain', description: 'Output as plain text (no colors)' },
    ],
    examples: [
      'gsd health',
      'gsd health --json',
    ],
  },
  settings: {
    usage: 'gsd settings [set <key> <value>] [--json] [--plain]',
    description: 'View and update configuration. Shows all config.json settings by default. Use "set" to update a value with validation.',
    flags: [
      { flag: 'set <key> <value>', description: 'Set a config value (dot notation for nested keys)' },
      { flag: '--json', description: 'Output as JSON' },
      { flag: '--plain', description: 'Output as plain text (no colors)' },
    ],
    examples: [
      'gsd settings',
      'gsd settings set model_profile quality',
      'gsd settings set workflow.research false',
    ],
  },
  'test-count': {
    usage: 'gsd test-count [--phase N] [--json] [--plain]',
    description: 'Count test cases in the project. Shows total count and per-file breakdown. Optionally filter by phase to see only tests referenced in that phase\'s plans.',
    flags: [
      { flag: '--phase N', description: 'Filter to tests referenced in phase N plans' },
      { flag: '--json', description: 'Output as JSON' },
      { flag: '--plain', description: 'Output as plain text (no colors)' },
    ],
    examples: [
      'gsd test-count',
      'gsd test-count --phase 30',
      'gsd test-count --json',
    ],
  },
  help: {
    usage: 'gsd help [<command>]',
    description: 'Show available commands and usage. Without arguments, lists all commands. With a command name, shows detailed usage information.',
    flags: [
      { flag: '<command>', description: 'Show detailed help for a specific command' },
    ],
    examples: [
      'gsd help',
      'gsd help progress',
    ],
  },
};

function handleHelp(projectRoot, args) {
  void projectRoot;
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  const DIM = '\x1b[2m';

  // Per-command detail mode: gsd help <command>
  if (args && args.length > 0) {
    const cmdName = args[0];
    const detail = COMMAND_DETAILS[cmdName];

    if (!detail) {
      const available = Object.keys(COMMANDS).join(', ');
      return { command: 'help', error: true, message: `Unknown command: '${cmdName}'\n\nAvailable commands: ${available}` };
    }

    const lines = [];
    lines.push(`${BOLD}${detail.usage}${RESET}`);
    lines.push('');
    lines.push(detail.description);
    lines.push('');
    lines.push(`${BOLD}Arguments and flags:${RESET}`);
    for (const f of detail.flags) {
      lines.push(`  ${f.flag.padEnd(20)}  ${DIM}${f.description}${RESET}`);
    }
    lines.push('');
    lines.push(`${BOLD}Examples:${RESET}`);
    for (const ex of detail.examples) {
      lines.push(`  ${DIM}${ex}${RESET}`);
    }

    return { command: 'help', detail: { name: cmdName, ...detail }, message: lines.join('\n') };
  }

  // Overview mode: gsd help
  const lines = [
    'gsd - GSD CLI Utilities',
    '',
    'Usage: gsd <command> [options]',
    '',
    'Commands:',
  ];
  for (const [name, entry] of Object.entries(COMMANDS)) {
    lines.push('  ' + name.padEnd(12) + entry.description);
  }
  lines.push('');
  lines.push('Options:');
  lines.push('  --json      Output as JSON');
  lines.push('  --plain     Output as plain text (no colors)');
  return { command: 'help', message: lines.join('\n') };
}

// ─── Test Count Command ─────────────────────────────────────────────────────

function handleTestCount(projectRoot, args) {
  // Parse --phase flag from process.argv
  let phaseArg = null;
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--phase=')) {
      phaseArg = argv[i].slice('--phase='.length);
    } else if (argv[i] === '--phase' && i + 1 < argv.length) {
      phaseArg = argv[i + 1];
    }
  }

  const result = testing.countTestsInProject(projectRoot || '.', { phase: phaseArg || null });

  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  const DIM = '\x1b[2m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';

  const lines = [];
  const phaseLabel = phaseArg ? ` (Phase ${phaseArg})` : '';
  lines.push(`${BOLD}Test Count${phaseLabel}${RESET}`);
  lines.push('');

  if (result.warning) {
    lines.push(`${YELLOW}${result.warning}${RESET}`);
    lines.push('');
  }

  lines.push(`${BOLD}Total: ${GREEN}${result.total}${RESET}${BOLD} test cases${RESET}`);
  lines.push('');

  if (result.files.length > 0) {
    lines.push('Files:');
    for (const f of result.files) {
      lines.push(`  ${DIM}${f.file}${RESET}  ${f.count} tests`);
    }
  }

  const framework = testing.detectFramework(projectRoot || '.');
  if (framework) {
    lines.push('');
    lines.push(`${DIM}Framework: ${framework}${RESET}`);
  }

  const message = lines.join('\n');

  return { command: 'test-count', ...result, framework, message };
}

// ─── Command Registry ───────────────────────────────────────────────────────

const COMMANDS = {
  progress: { description: 'Show milestone progress and status', handler: handleProgress },
  todos: { description: 'List and inspect pending todos', handler: handleTodos },
  health: { description: 'Validate .planning/ directory integrity', handler: handleHealth },
  settings: { description: 'View and update configuration', handler: handleSettings },
  'test-count': { description: 'Count test cases in project', handler: handleTestCount },
  help: { description: 'Show available commands and usage', handler: handleHelp },
};

// ─── Command Router ─────────────────────────────────────────────────────────

/**
 * Route a command to its handler.
 * Returns the handler result, or null if command not found.
 */
function routeCommand(command, projectRoot, args, mode) {
  const entry = COMMANDS[command];
  if (!entry) {
    return null;
  }
  return entry.handler(projectRoot, args, mode);
}

module.exports = {
  findProjectRoot,
  parseArgs,
  formatOutput,
  cliError,
  COMMANDS,
  routeCommand,
};
