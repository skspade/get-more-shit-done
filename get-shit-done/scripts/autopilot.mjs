#!/usr/bin/env zx
// GSD Autopilot — zx outer loop engine that drives GSD phases autonomously
// with fresh context windows per step and circuit-breaks on stalls.
//
// Usage:
//   autopilot.mjs [--from-phase N] [--project-dir PATH] [--dry-run]
//
// Each GSD lifecycle step (discuss, plan, execute, verify) is invoked as a
// separate `claude -p` process, ensuring fresh 200k-token context windows.

import { createRequire } from 'module';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';
import fs from 'fs';

// ─── Path Resolution ──────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const GSD_HOME = path.resolve(SCRIPT_DIR, '..');
const GSD_TOOLS = path.join(GSD_HOME, 'bin', 'gsd-tools.cjs');

// ─── CJS Imports ──────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const { findFirstIncompletePhase, nextIncompletePhase, computePhaseStatus } = require('../bin/lib/phase.cjs');
const { CONFIG_DEFAULTS } = require('../bin/lib/config.cjs');
const { findPhaseInternal } = require('../bin/lib/core.cjs');
const { getVerificationStatus, getGapsSummary } = require('../bin/lib/verify.cjs');

// ─── Argument Parsing ─────────────────────────────────────────────────────────

const knownFlags = new Set(['from-phase', 'fromPhase', 'project-dir', 'projectDir', 'dry-run', 'dryRun']);

// Check for positional args (unknown)
if (argv._.length > 0) {
  console.error(`Unknown argument: ${argv._[0]}`);
  console.error('Usage: autopilot.mjs [--from-phase N] [--project-dir PATH] [--dry-run]');
  process.exit(1);
}

// Check for unknown flags
for (const key of Object.keys(argv)) {
  if (key === '_') continue;
  if (!knownFlags.has(key)) {
    console.error(`Unknown argument: --${key}`);
    console.error('Usage: autopilot.mjs [--from-phase N] [--project-dir PATH] [--dry-run]');
    process.exit(1);
  }
}

const FROM_PHASE = argv['from-phase'] || argv.fromPhase || '';
const PROJECT_DIR = argv['project-dir'] || argv.projectDir || process.cwd();
const DRY_RUN = !!(argv['dry-run'] || argv.dryRun);

// ─── Prerequisites ────────────────────────────────────────────────────────────

try {
  await which('claude');
} catch {
  console.error('Error: claude CLI not found on PATH. Install Claude Code first.');
  process.exit(1);
}

try {
  await which('node');
} catch {
  console.error('Error: node not found on PATH. Node.js 18+ required.');
  process.exit(1);
}

if (!fs.existsSync(path.join(PROJECT_DIR, '.planning'))) {
  console.error(`Error: .planning/ directory not found in ${PROJECT_DIR}`);
  console.error('Run /gsd:new-project first to initialize.');
  process.exit(1);
}

if (!fs.existsSync(GSD_TOOLS)) {
  console.error(`Error: gsd-tools.cjs not found at ${GSD_TOOLS}`);
  process.exit(1);
}

// ─── Logging Infrastructure ──────────────────────────────────────────────────

fs.mkdirSync(path.join(PROJECT_DIR, '.planning', 'logs'), { recursive: true });

const now = new Date();
const pad2 = (n) => String(n).padStart(2, '0');
const logTimestamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
const LOG_FILE = path.join(PROJECT_DIR, '.planning', 'logs', `autopilot-${logTimestamp}.log`);

// Write session header
const sessionHeader = [
  '============================================',
  'GSD Autopilot Session Log',
  `Started: ${now.toISOString()}`,
  `Project: ${PROJECT_DIR}`,
  `From-phase: ${FROM_PHASE || 'auto-detect'}`,
  `Dry-run: ${DRY_RUN}`,
  '============================================',
  '',
  '',
].join('\n');
fs.writeFileSync(LOG_FILE, sessionHeader);

function logMsg(msg) {
  const ts = new Date().toTimeString().slice(0, 8);
  fs.appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`);
}

// ─── Mutable State ────────────────────────────────────────────────────────────

let CURRENT_PHASE = '';
let noProgressCount = 0;
let iterationLog = [];
let totalIterations = 0;
const tempFiles = [];

// ─── Signal Handling ──────────────────────────────────────────────────────────

function cleanupTemp() {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
}

process.on('SIGINT', () => {
  cleanupTemp();
  console.log('');
  console.log('');
  console.log('Autopilot interrupted (SIGINT).');
  console.log(`Phase ${CURRENT_PHASE} was in progress.`);
  console.log('');
  console.log(`To resume: gsd-autopilot --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}`);
  console.log('');
  process.exit(130);
});

process.on('SIGTERM', () => {
  cleanupTemp();
  console.log('');
  console.log('');
  console.log('Autopilot interrupted (SIGTERM).');
  console.log(`Phase ${CURRENT_PHASE} was in progress.`);
  console.log('');
  console.log(`To resume: gsd-autopilot --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}`);
  console.log('');
  process.exit(0);
});

process.on('exit', cleanupTemp);

// ─── Helper Functions ─────────────────────────────────────────────────────────

function printBanner(text) {
  console.log('');
  console.log('\u2501'.repeat(53));
  console.log(` GSD \u25b6 AUTOPILOT: ${text}`);
  console.log('\u2501'.repeat(53));
  console.log('');
  logMsg(`BANNER: ${text}`);
}

async function gsdTools(...args) {
  const result = await $`node ${GSD_TOOLS} ${args} --cwd ${PROJECT_DIR}`.nothrow().quiet();
  return result.stdout.trim();
}

// ─── Config Loading ───────────────────────────────────────────────────────────

function getConfig(key, defaultVal) {
  try {
    const configPath = path.join(PROJECT_DIR, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const keys = key.split('.');
      let val = config;
      for (const k of keys) {
        if (val === undefined || val === null) break;
        val = val[k];
      }
      if (val !== undefined && val !== null) return val;
    }
  } catch {}
  if (CONFIG_DEFAULTS[key] !== undefined) return CONFIG_DEFAULTS[key];
  return defaultVal;
}

const CIRCUIT_BREAKER_THRESHOLD = getConfig('autopilot.circuit_breaker_threshold', 3);
const MAX_DEBUG_RETRIES = getConfig('autopilot.max_debug_retries', 3);

// ─── Progress Tracking (Circuit Breaker) ──────────────────────────────────────

async function takeProgressSnapshot() {
  const commits = await $`cd ${PROJECT_DIR} && git rev-list --count HEAD`.nothrow().quiet();
  const commitCount = commits.stdout.trim() || '0';
  const phasesDir = path.join(PROJECT_DIR, '.planning', 'phases');
  const artifactFiles = await $`find ${phasesDir} -name "*.md" 2>/dev/null | wc -l`.nothrow().quiet();
  const artifactCount = artifactFiles.stdout.trim().replace(/\s/g, '') || '0';
  return `${commitCount}|${artifactCount}`;
}

function checkProgress(before, after, stepDesc) {
  totalIterations++;
  logMsg(`PROGRESS CHECK: step=${stepDesc} before=${before} after=${after}`);

  if (before === after) {
    noProgressCount++;
    iterationLog.push(`Iteration ${totalIterations} (${stepDesc}): NO PROGRESS - snapshot unchanged (${before})`);
    logMsg(`NO PROGRESS: count=${noProgressCount}/${CIRCUIT_BREAKER_THRESHOLD}`);

    if (noProgressCount >= CIRCUIT_BREAKER_THRESHOLD) {
      logMsg(`CIRCUIT BREAKER TRIGGERED at step=${stepDesc}`);
      printHaltReport('Circuit breaker triggered', stepDesc, 'N/A');
      process.exit(1);
    }
    console.error(`WARNING: No progress detected (${noProgressCount}/${CIRCUIT_BREAKER_THRESHOLD} consecutive)`);
  } else {
    noProgressCount = 0;
    iterationLog = [];
    logMsg('PROGRESS DETECTED: snapshot changed');
  }
}

function printHaltReport(reason, step, exitCode) {
  logMsg(`HALT REPORT: reason=${reason} phase=${CURRENT_PHASE} step=${step} exit_code=${exitCode}`);
  logMsg(`HALT: total_iterations=${totalIterations} no_progress_count=${noProgressCount}`);

  for (const entry of iterationLog) {
    logMsg(`ITERATION: ${entry}`);
  }

  console.log('');
  console.log('\u2554' + '\u2550'.repeat(62) + '\u2557');
  console.log('\u2551  AUTOPILOT HALTED                                           \u2551');
  console.log('\u255a' + '\u2550'.repeat(62) + '\u255d');
  console.log('');
  console.log(`Reason: ${reason}`);
  console.log(`Phase: ${CURRENT_PHASE}`);
  console.log(`Step: ${step}`);
  console.log(`Exit code: ${exitCode}`);
  console.log(`Total iterations: ${totalIterations}`);
  console.log(`Consecutive no-progress: ${noProgressCount}`);
  console.log('');
  console.log('Last iterations:');
  for (const entry of iterationLog) {
    console.log(`  - ${entry}`);
  }
  console.log('');
  console.log('Progress signals checked:');
  console.log('  - Git commit count');
  console.log('  - Artifact file count in .planning/phases/');
  console.log('');
  console.log(`To resume: gsd-autopilot --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}`);
  console.log(`Log file: ${LOG_FILE}`);
  console.log('');
}

// ─── Step Execution ───────────────────────────────────────────────────────────

async function runStep(prompt, stepName) {
  printBanner(`Phase ${CURRENT_PHASE} > ${stepName}`);

  const snapshotBefore = await takeProgressSnapshot();

  if (DRY_RUN) {
    logMsg(`STEP DRY-RUN: ${stepName}`);
    console.log('[DRY RUN] Would execute:');
    console.log(`  claude -p --dangerously-skip-permissions --output-format json "${prompt}"`);
    console.log('');
    checkProgress(snapshotBefore, snapshotBefore, `${stepName} (dry-run)`);
    return 0;
  }

  logMsg(`STEP START: phase=${CURRENT_PHASE} step=${stepName}`);

  const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt}`.nothrow();

  const exitCode = result.exitCode;
  logMsg(`STEP DONE: step=${stepName} exit_code=${exitCode}`);

  if (result.stdout) process.stdout.write(result.stdout);

  const snapshotAfter = await takeProgressSnapshot();
  checkProgress(snapshotBefore, snapshotAfter, stepName);

  if (exitCode !== 0) {
    if (snapshotBefore === snapshotAfter) {
      console.error(`ERROR: Step '${stepName}' failed with exit code ${exitCode} and no artifacts created`);
      printHaltReport('Step failure with no progress', stepName, exitCode);
      process.exit(1);
    } else {
      console.error(`WARNING: Step '${stepName}' exited with code ${exitCode} but made progress. Continuing.`);
    }
  }

  return exitCode;
}

// ─── Debug Retry Infrastructure ────────────────────────────────────────────

function constructDebugPrompt(stepName, exitCode, errorContext, phase, phaseDir, retryNum) {
  const slug = `autopilot-${stepName}-retry-${retryNum}`;

  let phaseFiles = '';
  if (phaseDir) {
    const fullDir = path.join(PROJECT_DIR, phaseDir);
    try {
      const files = fs.readdirSync(fullDir);
      const ctx = files.filter(f => f.endsWith('-CONTEXT.md')).map(f => `- ${path.join(fullDir, f)}`);
      const plans = files.filter(f => f.endsWith('-PLAN.md')).map(f => `- ${path.join(fullDir, f)}`);
      const sums = files.filter(f => f.endsWith('-SUMMARY.md')).map(f => `- ${path.join(fullDir, f)}`);
      phaseFiles = [...ctx, ...plans, ...sums].join('\n');
    } catch {}
  }

  const indentedErrors = errorContext.split('\n').map(l => `  ${l}`).join('\n');

  return `<objective>
Investigate and fix: Autopilot step "${stepName}" failed during Phase ${phase}

**Summary:** Step "${stepName}" exited with code ${exitCode} during autonomous execution. This is debug retry ${retryNum}.
</objective>

<symptoms>
expected: Step "${stepName}" completes successfully with exit code 0
actual: Step failed with exit code ${exitCode}
errors: |
${indentedErrors}
reproduction: Run autopilot for Phase ${phase}, step ${stepName}
timeline: During autopilot execution
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/${slug}.md
</debug_file>

<files_to_read>
${phaseFiles}
- .planning/STATE.md
</files_to_read>`;
}

async function writeFailureState(stepName, exitCode, retryCount, maxRetries) {
  const failureType = (stepName === 'verify' || stepName === 'verify-gaps') ? 'gaps_found' : 'exit_code';

  let debugSessions = 'None created';
  try {
    const debugDir = path.join(PROJECT_DIR, '.planning', 'debug');
    const files = fs.readdirSync(debugDir).filter(f => f.startsWith('autopilot-') && f.endsWith('.md'));
    if (files.length > 0) debugSessions = files.map(f => path.join(debugDir, f)).join(', ');
  } catch {}

  const blockerText = `[Phase ${CURRENT_PHASE} FAILURE]: type=${failureType} | step=${stepName} | retries=${retryCount}/${maxRetries} | exit_code=${exitCode} | debug_sessions=${debugSessions}`;
  try {
    await gsdTools('state', 'add-blocker', '--text', blockerText);
  } catch {
    console.error('WARNING: Could not write failure state to STATE.md');
  }
}

async function clearFailureState() {
  try {
    const existing = await gsdTools('state', 'get', 'blockers');
    if (existing.includes(`Phase ${CURRENT_PHASE} FAILURE`)) {
      const lines = existing.split('\n');
      const match = lines.find(l => l.includes(`Phase ${CURRENT_PHASE} FAILURE`));
      if (match) {
        const blockerText = match.replace(/^\s*-\s*/, '');
        await gsdTools('state', 'resolve-blocker', '--text', blockerText);
      }
    }
  } catch {}
}

function writeFailureReport(stepName, exitCode, retryCount, maxRetries, outputFile) {
  const phaseInfo = findPhaseInternal(PROJECT_DIR, CURRENT_PHASE);
  const phaseDir = phaseInfo ? phaseInfo.directory : '.planning/phases/unknown';
  const paddedPhase = String(CURRENT_PHASE).padStart(2, '0');
  const failureFile = path.join(PROJECT_DIR, phaseDir, `${paddedPhase}-FAILURE.md`);

  const failureType = (stepName === 'verify' || stepName === 'verify-gaps') ? 'gaps_found' : 'exit_code';

  let debugSessionsList = '- None created';
  try {
    const debugDir = path.join(PROJECT_DIR, '.planning', 'debug');
    const files = fs.readdirSync(debugDir).filter(f => f.startsWith('autopilot-') && f.endsWith('.md'));
    if (files.length > 0) debugSessionsList = files.map(f => `- ${path.join(debugDir, f)}`).join('\n');
  } catch {}

  let lastError = 'Output not available';
  try {
    const content = fs.readFileSync(outputFile, 'utf-8');
    const lines = content.split('\n');
    lastError = lines.slice(-50).join('\n');
  } catch {}

  const typeDesc = failureType === 'exit_code'
    ? 'The step process returned a non-zero exit code, indicating a crash or error.'
    : 'Verification found gaps that could not be automatically fixed by the debugger.';

  const report = `# Phase ${CURRENT_PHASE}: Failure Report

**Generated:** ${new Date().toISOString()}
**Failure Type:** ${failureType}
**Step:** ${stepName}
**Exit Code:** ${exitCode}
**Retries:** ${retryCount}/${maxRetries}

## What Failed

Step "${stepName}" in Phase ${CURRENT_PHASE} failed with exit code ${exitCode}.
After ${retryCount} debug retry attempts (max: ${maxRetries}), the issue could not be automatically resolved.

## Failure Type

- **${failureType}**: ${typeDesc}

## Last Error Output

\`\`\`
${lastError}
\`\`\`

## Debug Sessions

${debugSessionsList}

## Resume

After manually fixing the issue, resume with:
\`\`\`
gsd-autopilot --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}
\`\`\`

---
*Generated by autopilot.mjs debug-retry exhaustion handler*
`;

  fs.writeFileSync(failureFile, report);
  console.error(`Failure report written to: ${failureFile}`);
}

// ─── Output-Capturing Step Execution ───────────────────────────────────────

async function runStepCaptured(prompt, stepName, outputFile) {
  printBanner(`Phase ${CURRENT_PHASE} > ${stepName}`);

  const snapshotBefore = await takeProgressSnapshot();

  if (DRY_RUN) {
    logMsg(`STEP DRY-RUN: ${stepName}`);
    const msg = `[DRY RUN] Would execute: claude -p --dangerously-skip-permissions --output-format json "${prompt}"`;
    console.log(msg);
    console.log('');
    fs.appendFileSync(outputFile, msg + '\n');
    checkProgress(snapshotBefore, snapshotBefore, `${stepName} (dry-run)`);
    return 0;
  }

  logMsg(`STEP START: phase=${CURRENT_PHASE} step=${stepName}`);

  const result = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${prompt}`.nothrow();

  const exitCode = result.exitCode;
  logMsg(`STEP DONE: step=${stepName} exit_code=${exitCode}`);

  if (result.stdout) {
    process.stdout.write(result.stdout);
    fs.appendFileSync(outputFile, result.stdout);
  }

  const snapshotAfter = await takeProgressSnapshot();
  checkProgress(snapshotBefore, snapshotAfter, stepName);

  return exitCode;
}

// ─── Retry Loop ─────────────────────────────────────────────────────────────

async function runStepWithRetry(prompt, stepName) {
  let retryCount = 0;

  while (true) {
    const outputFile = path.join(os.tmpdir(), `gsd-autopilot-${Date.now()}`);
    fs.writeFileSync(outputFile, '');
    tempFiles.push(outputFile);

    const stepExit = await runStepCaptured(prompt, stepName, outputFile);

    if (stepExit === 0) {
      await clearFailureState();
      return 0;
    }

    retryCount++;
    logMsg(`RETRY: step=${stepName} attempt=${retryCount}/${MAX_DEBUG_RETRIES} exit_code=${stepExit}`);

    if (retryCount > MAX_DEBUG_RETRIES) {
      logMsg(`RETRY EXHAUSTED: step=${stepName}`);
      console.error('');
      console.error(`Debug retries exhausted (${retryCount}/${MAX_DEBUG_RETRIES}) for step '${stepName}'.`);
      await writeFailureState(stepName, stepExit, retryCount, MAX_DEBUG_RETRIES);
      writeFailureReport(stepName, stepExit, retryCount, MAX_DEBUG_RETRIES, outputFile);
      return stepExit;
    }

    console.log('');
    logMsg(`DEBUG PROMPT: invoking debugger for step=${stepName} retry=${retryCount}`);
    console.error(`\u25c6 Debug retry ${retryCount}/${MAX_DEBUG_RETRIES} for step '${stepName}'...`);
    console.log('');

    let errorContext = 'No output captured';
    try {
      const content = fs.readFileSync(outputFile, 'utf-8');
      const lines = content.split('\n');
      errorContext = lines.slice(-100).join('\n');
    } catch {}

    const phaseInfo = findPhaseInternal(PROJECT_DIR, CURRENT_PHASE);
    const phaseDir = phaseInfo ? phaseInfo.directory : '';

    const debugPrompt = constructDebugPrompt(stepName, stepExit, errorContext, CURRENT_PHASE, phaseDir, retryCount);

    console.log('\u2501'.repeat(53));
    console.log(` GSD \u25b6 AUTOPILOT: Debug Retry ${retryCount}/${MAX_DEBUG_RETRIES}`);
    console.log('\u2501'.repeat(53));
    console.log('');

    const debugResult = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${debugPrompt}`.nothrow();
    if (debugResult.stdout) process.stdout.write(debugResult.stdout);
    if (debugResult.exitCode !== 0) {
      console.error('WARNING: Debugger itself returned non-zero. Continuing to next retry.');
    }
  }
}

async function runVerifyWithDebugRetry(phase) {
  let retryCount = 0;

  while (true) {
    const outputFile = path.join(os.tmpdir(), `gsd-autopilot-${Date.now()}`);
    fs.writeFileSync(outputFile, '');
    tempFiles.push(outputFile);

    const verifyExit = await runStepCaptured(`/gsd:verify-work ${phase}`, 'verify', outputFile);

    if (verifyExit !== 0) {
      retryCount++;
      if (retryCount > MAX_DEBUG_RETRIES) {
        console.error('Debug retries exhausted for verify step.');
        await writeFailureState('verify', verifyExit, retryCount, MAX_DEBUG_RETRIES);
        writeFailureReport('verify', verifyExit, retryCount, MAX_DEBUG_RETRIES, outputFile);
        return verifyExit;
      }

      console.log('');
      console.error(`\u25c6 Debug retry ${retryCount}/${MAX_DEBUG_RETRIES} for verify crash...`);

      let errorContext = 'No output captured';
      try {
        const content = fs.readFileSync(outputFile, 'utf-8');
        errorContext = content.split('\n').slice(-100).join('\n');
      } catch {}

      const phaseInfo = findPhaseInternal(PROJECT_DIR, phase);
      const phaseDir = phaseInfo ? phaseInfo.directory : '';
      const debugPrompt = constructDebugPrompt('verify', verifyExit, errorContext, phase, phaseDir, retryCount);

      console.log('\u2501'.repeat(53));
      console.log(` GSD \u25b6 AUTOPILOT: Debug Retry ${retryCount}/${MAX_DEBUG_RETRIES}`);
      console.log('\u2501'.repeat(53));
      console.log('');

      const debugResult = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${debugPrompt}`.nothrow();
      if (debugResult.stdout) process.stdout.write(debugResult.stdout);
      continue;
    }

    // Verify succeeded — check for gaps
    const phaseInfo = findPhaseInternal(PROJECT_DIR, phase);
    const phaseDir = phaseInfo ? phaseInfo.directory : '';
    const verifyStatus = getVerificationStatus(PROJECT_DIR, phaseDir);

    if (verifyStatus.status !== 'gaps_found') {
      await clearFailureState();
      return 0;
    }

    // Gaps found — attempt debug retry
    retryCount++;
    if (retryCount > MAX_DEBUG_RETRIES) {
      console.log('');
      console.error(`Debug retries exhausted (${retryCount}/${MAX_DEBUG_RETRIES}) for verification gaps.`);
      await writeFailureState('verify-gaps', 0, retryCount, MAX_DEBUG_RETRIES);
      writeFailureReport('verify-gaps', 0, retryCount, MAX_DEBUG_RETRIES, outputFile);
      return 0; // Return 0 so verification gate still presents
    }

    console.log('');
    logMsg(`VERIFY GAPS: retry=${retryCount}/${MAX_DEBUG_RETRIES}`);
    console.error(`\u25c6 Verification found gaps. Debug retry ${retryCount}/${MAX_DEBUG_RETRIES}...`);
    console.log('');

    const gapsSummary = getGapsSummary(PROJECT_DIR, phaseDir).join('\n');
    const errorContext = `Verification status: gaps_found\nGaps:\n${gapsSummary}`;
    const debugPrompt = constructDebugPrompt('verify-gaps', 0, errorContext, phase, phaseDir, retryCount);

    console.log('\u2501'.repeat(53));
    console.log(` GSD \u25b6 AUTOPILOT: Gap Fix ${retryCount}/${MAX_DEBUG_RETRIES}`);
    console.log('\u2501'.repeat(53));
    console.log('');

    const debugResult = await $`cd ${PROJECT_DIR} && claude -p --dangerously-skip-permissions --output-format json ${debugPrompt}`.nothrow();
    if (debugResult.stdout) process.stdout.write(debugResult.stdout);
  }
}

// ─── TTY Input ──────────────────────────────────────────────────────────────

function askTTY(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: fs.createReadStream('/dev/tty'),
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Verification Gate ──────────────────────────────────────────────────────

function extractAutonomousDecisions(phaseDir) {
  try {
    const fullDir = path.join(PROJECT_DIR, phaseDir);
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('-CONTEXT.md'));
    if (files.length === 0) return '';

    const content = fs.readFileSync(path.join(fullDir, files[0]), 'utf-8');
    if (!content.includes('auto-context') && !content.includes('Auto-generated')) return '';

    return content.split('\n')
      .filter(l => l.includes("(Claude's Decision:"))
      .map(l => `  - ${l.replace(/^\s*-\s*/, '')}`)
      .join('\n');
  } catch {
    return '';
  }
}

function printVerificationGate(phase, status, score, decisions, gaps) {
  console.log('');
  console.log('\u2554' + '\u2550'.repeat(62) + '\u2557');
  console.log('\u2551  CHECKPOINT: Verification Required                          \u2551');
  console.log('\u255a' + '\u2550'.repeat(62) + '\u255d');
  console.log('');
  console.log(`Phase ${phase} verification: ${status} (score: ${score})`);
  console.log('');

  if (status === 'gaps_found' && gaps) {
    console.log('Gaps found:');
    console.log(gaps);
    console.log('');
  }

  if (decisions) {
    console.log('Decisions Made Autonomously:');
    console.log(decisions);
    console.log('');
  }

  console.log('\u2500'.repeat(62));
  console.log('\u2192 approve  \u2014 continue to next phase');
  console.log('\u2192 fix      \u2014 describe issues and trigger gap-closure cycle');
  console.log('\u2192 abort    \u2014 stop autopilot cleanly (state preserved)');
  console.log('\u2500'.repeat(62));
}

function handleAbort(phase) {
  console.log('');
  console.log(`Autopilot aborted by user at Phase ${phase} verification.`);
  console.log('');
  console.log('State preserved. To resume:');
  console.log(`  gsd-autopilot --from-phase ${phase} --project-dir ${PROJECT_DIR}`);
  console.log('');
  process.exit(2);
}

async function runFixCycle(phase) {
  const fixDesc = await askTTY('Describe what to fix: ');

  console.log('');
  console.log(`Running gap-closure cycle for Phase ${phase}...`);
  console.log(`Fix request: ${fixDesc}`);
  console.log('');

  noProgressCount = 0;

  await runStep(`/gsd:plan-phase ${phase} --gaps -- Human fix request: ${fixDesc}`, 'fix-plan');
  await runStep(`/gsd:execute-phase ${phase} --gaps-only -- Human fix request: ${fixDesc}`, 'fix-execute');
  await runStep(`/gsd:verify-work ${phase}`, 'fix-verify');

  noProgressCount = 0;
}

async function runVerificationGate(phase) {
  while (true) {
    const phaseInfo = findPhaseInternal(PROJECT_DIR, phase);
    const phaseDir = phaseInfo ? phaseInfo.directory : '';
    const verifyStatus = getVerificationStatus(PROJECT_DIR, phaseDir);
    const decisions = extractAutonomousDecisions(phaseDir);

    let gaps = '';
    if (verifyStatus.status === 'gaps_found') {
      gaps = getGapsSummary(PROJECT_DIR, phaseDir).join('\n');
    }

    printVerificationGate(phase, verifyStatus.status, verifyStatus.score, decisions, gaps);

    const response = (await askTTY('\u2192 ')).toLowerCase();

    switch (response) {
      case 'a': case 'approve': case 'yes': case 'y':
        console.log('');
        console.log(`\u2713 Phase ${phase} approved. Continuing...`);
        return;
      case 'f': case 'fix':
        await runFixCycle(phase);
        break; // Loop continues — re-presents gate
      case 'x': case 'abort': case 'quit': case 'q':
        handleAbort(phase);
        break;
      default:
        console.log('');
        console.log(`Unknown response: '${response}'`);
        console.log('Enter: approve / fix / abort');
        console.log('');
        break;
    }
  }
}

// ─── Milestone Audit and Completion ─────────────────────────────────────────

function printEscalationReport(iterations, maxIterations) {
  logMsg(`ESCALATION: gap closure exhausted iterations=${iterations}/${maxIterations}`);

  let auditFile = '';
  try {
    const planningDir = path.join(PROJECT_DIR, '.planning');
    const files = fs.readdirSync(planningDir)
      .filter(f => /^v.*-MILESTONE-AUDIT\.md$/.test(f))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(planningDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 0) auditFile = path.join(planningDir, files[0].name);
  } catch {}

  console.log('');
  console.log('\u2554' + '\u2550'.repeat(62) + '\u2557');
  console.log('\u2551  AUTOPILOT ESCALATION                                       \u2551');
  console.log('\u255a' + '\u2550'.repeat(62) + '\u255d');
  console.log('');
  console.log(`Gap closure exhausted: ${iterations}/${maxIterations} iterations completed`);
  console.log(`Audit gaps persist after ${iterations} fix cycles.`);
  console.log('');
  if (auditFile) {
    console.log(`Latest audit: ${auditFile}`);
    console.log('');
  }
  console.log('The autopilot could not converge to a passing audit.');
  console.log('Human review is required to diagnose remaining gaps.');
  console.log('');
  console.log('To resume after manual fixes:');
  console.log(`  gsd-autopilot --project-dir ${PROJECT_DIR}`);
  console.log('');
}

async function runMilestoneAudit() {
  printBanner('MILESTONE AUDIT');
  logMsg('AUDIT: starting milestone audit');

  const auditExit = await runStepWithRetry('/gsd:audit-milestone', 'milestone-audit');
  if (auditExit !== 0) {
    logMsg(`AUDIT: failed with exit=${auditExit}`);
    console.error(`ERROR: Milestone audit failed (exit ${auditExit})`);
    return 1;
  }

  // Locate most recent audit file
  let auditFile = '';
  try {
    const planningDir = path.join(PROJECT_DIR, '.planning');
    const files = fs.readdirSync(planningDir)
      .filter(f => /^v.*-MILESTONE-AUDIT\.md$/.test(f))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(planningDir, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 0) auditFile = path.join(planningDir, files[0].name);
  } catch {}

  if (!auditFile) {
    console.error('ERROR: No MILESTONE-AUDIT.md file found after audit');
    return 1;
  }

  const auditStatus = (await gsdTools('frontmatter', 'get', auditFile, '--field', 'status', '--raw')).trim();
  if (!auditStatus) {
    console.error(`ERROR: Could not parse status from ${auditFile}`);
    return 1;
  }

  logMsg(`AUDIT: result=${auditStatus}`);
  console.log(`Audit result: ${auditStatus}`);

  const autoAcceptTechDebt = getConfig('autopilot.auto_accept_tech_debt', true);

  switch (auditStatus) {
    case 'passed':
      printBanner('MILESTONE AUDIT PASSED \u2713');
      console.log('All requirements satisfied. Ready for milestone completion.');
      return 0;
    case 'gaps_found':
      printBanner('MILESTONE AUDIT: GAPS FOUND');
      console.log('Audit found gaps that need fixing.');
      return 10;
    case 'tech_debt':
      if (autoAcceptTechDebt) {
        printBanner('MILESTONE AUDIT PASSED \u2713 (tech debt accepted)');
        console.log('Audit found tech debt only. auto_accept_tech_debt=true \u2014 treating as passed.');
        return 0;
      }
      printBanner('MILESTONE AUDIT: GAPS FOUND (tech debt rejected)');
      console.log('Audit found tech debt. auto_accept_tech_debt=false \u2014 treating as gaps.');
      return 10;
    default:
      console.error(`ERROR: Unknown audit status '${auditStatus}'`);
      return 1;
  }
}

async function runGapClosureLoop() {
  const maxIterations = getConfig('autopilot.max_audit_fix_iterations', 3);
  let iteration = 0;

  while (true) {
    if (iteration >= maxIterations) {
      printEscalationReport(iteration, maxIterations);
      process.exit(1);
    }

    iteration++;
    logMsg(`GAP CLOSURE: iteration=${iteration}/${maxIterations}`);
    printBanner(`GAP CLOSURE: Iteration ${iteration}/${maxIterations}`);

    noProgressCount = 0;
    iterationLog = [];

    const gapPlanExit = await runStepWithRetry('/gsd:plan-milestone-gaps --auto', 'gap-planning');
    if (gapPlanExit !== 0) {
      console.error(`ERROR: Gap planning failed (exit ${gapPlanExit})`);
      printEscalationReport(iteration, maxIterations);
      process.exit(1);
    }

    // Execute fix phases through full lifecycle
    while (true) {
      const fixPhase = findFirstIncompletePhase(PROJECT_DIR);
      if (!fixPhase) break;

      CURRENT_PHASE = fixPhase;
      noProgressCount = 0;
      iterationLog = [];

      while (true) {
        const step = getPhaseStep(CURRENT_PHASE);

        switch (step) {
          case 'discuss':
            await runStep(`/gsd:discuss-phase ${CURRENT_PHASE} --auto`, 'discuss');
            break;
          case 'plan':
            await runStep(`/gsd:plan-phase ${CURRENT_PHASE} --auto`, 'plan');
            break;
          case 'execute': {
            const execExit = await runStepWithRetry(`/gsd:execute-phase ${CURRENT_PHASE}`, 'execute');
            if (execExit !== 0) {
              printHaltReport('Fix phase execution failed after debug retries', 'execute', execExit);
              process.exit(1);
            }
            break;
          }
          case 'verify': {
            const verifyExit = await runVerifyWithDebugRetry(CURRENT_PHASE);
            if (verifyExit !== 0) {
              printHaltReport('Fix phase verification failed after debug retries', 'verify', verifyExit);
              process.exit(1);
            }
            if (DRY_RUN) {
              console.log('[DRY RUN] Auto-approving verification gate');
            } else {
              await runVerificationGate(CURRENT_PHASE);
            }
            await gsdTools('phase', 'complete', CURRENT_PHASE);
            break;
          }
          case 'complete':
            printBanner(`Fix Phase ${CURRENT_PHASE} COMPLETE \u2713`);
            break;
          default:
            console.error(`ERROR: Unknown step '${step}' for fix phase ${CURRENT_PHASE}`);
            process.exit(1);
        }

        if (step === 'complete') break;
      }
    }

    // Re-audit after fix phases
    printBanner(`RE-AUDIT: After iteration ${iteration}`);

    const auditResult = await runMilestoneAudit();
    if (auditResult === 0) {
      printBanner('GAP CLOSURE COMPLETE \u2713');
      console.log(`Audit passed after ${iteration} iteration(s).`);
      return;
    } else if (auditResult === 10) {
      console.log(`Gaps remain after iteration ${iteration}. Continuing...`);
      continue;
    } else {
      console.error('ERROR: Milestone audit encountered an error during re-audit');
      process.exit(1);
    }
  }
}

async function runMilestoneCompletion() {
  printBanner('MILESTONE COMPLETION');

  const versionRaw = (await gsdTools('frontmatter', 'get', '.planning/STATE.md', '--field', 'milestone', '--raw')).trim();
  if (!versionRaw) {
    console.error('ERROR: Could not extract milestone version from STATE.md');
    console.error("Expected frontmatter field 'milestone' (e.g., 'milestone: v1.2')");
    printHaltReport('Milestone version extraction failed', 'milestone-completion', '1');
    process.exit(1);
  }

  const version = versionRaw.replace(/^v/, '');
  console.log(`Completing milestone: ${versionRaw} (${version})`);

  const completionPrompt = `/gsd:complete-milestone ${version}

IMPORTANT: This is running in autopilot mode. Auto-approve ALL interactive confirmations including:
- Milestone readiness verification
- Phase directory archival
- Any other confirmation prompts
Do not wait for human input at any step.`;

  const completionExit = await runStepWithRetry(completionPrompt, 'milestone-completion');
  if (completionExit !== 0) {
    console.error(`ERROR: Milestone completion failed (exit ${completionExit})`);
    printHaltReport('Milestone completion failed after retries', 'milestone-completion', completionExit);
    process.exit(1);
  }

  printBanner('MILESTONE COMPLETE \u2713');
  console.log(`Milestone ${versionRaw} completed successfully.`);
  console.log('Archival, PROJECT.md evolution, and commit performed.');
  console.log('');
}

function printFinalReport() {
  logMsg(`COMPLETE: all phases done, total_iterations=${totalIterations}`);

  console.log('');
  console.log('\u2501'.repeat(53));
  console.log(' GSD \u25b6 AUTOPILOT COMPLETE \u2713');
  console.log('\u2501'.repeat(53));
  console.log('');
  console.log('All phases complete.');
  console.log(`Total iterations: ${totalIterations}`);
  console.log('');
}

// ─── Phase Navigation ────────────────────────────────────────────────────────

function getPhaseStep(phaseNum) {
  const phaseInfo = findPhaseInternal(PROJECT_DIR, phaseNum);
  if (!phaseInfo) return 'discuss';
  const status = computePhaseStatus(PROJECT_DIR, phaseInfo);
  if (!status) return 'discuss';
  return status.step;
}

// ─── Determine Starting Phase ────────────────────────────────────────────────

if (FROM_PHASE) {
  CURRENT_PHASE = FROM_PHASE;
} else {
  CURRENT_PHASE = findFirstIncompletePhase(PROJECT_DIR);
  if (!CURRENT_PHASE) {
    printBanner('ALL PHASES COMPLETE');
    console.log('All phases in the milestone are already complete.');
    console.log('');

    const auditResult = await runMilestoneAudit();
    if (auditResult === 0) {
      await runMilestoneCompletion();
      process.exit(0);
    } else if (auditResult === 10) {
      await runGapClosureLoop();
      await runMilestoneCompletion();
      process.exit(0);
    } else {
      console.error('ERROR: Milestone audit encountered an error');
      process.exit(1);
    }
  }
}

// ─── Startup Banner ──────────────────────────────────────────────────────────

let currentStep = getPhaseStep(CURRENT_PHASE);

printBanner('STARTING');
console.log(`Project: ${PROJECT_DIR}`);
console.log(`Starting phase: ${CURRENT_PHASE}`);
console.log(`Starting step: ${currentStep}`);
console.log(`Circuit breaker: ${CIRCUIT_BREAKER_THRESHOLD} consecutive iterations`);
console.log(`Dry run: ${DRY_RUN}`);
console.log(`Log file: ${LOG_FILE}`);
console.log('');

logMsg(`STARTUP: phase=${CURRENT_PHASE} step=${currentStep} circuit_breaker=${CIRCUIT_BREAKER_THRESHOLD}`);

// ─── Main Loop ────────────────────────────────────────────────────────────────

while (true) {
  currentStep = getPhaseStep(CURRENT_PHASE);
  logMsg(`MAIN LOOP: phase=${CURRENT_PHASE} step=${currentStep}`);

  switch (currentStep) {
    case 'discuss':
      await runStep(`/gsd:discuss-phase ${CURRENT_PHASE} --auto`, 'discuss');
      break;

    case 'plan':
      await runStep(`/gsd:plan-phase ${CURRENT_PHASE} --auto`, 'plan');
      break;

    case 'execute': {
      const execExit = await runStepWithRetry(`/gsd:execute-phase ${CURRENT_PHASE}`, 'execute');
      if (execExit !== 0) {
        printHaltReport('Execution failed after debug retries', 'execute', execExit);
        process.exit(1);
      }
      break;
    }

    case 'verify': {
      const verifyExit = await runVerifyWithDebugRetry(CURRENT_PHASE);
      if (verifyExit !== 0) {
        printHaltReport('Verification failed after debug retries', 'verify', verifyExit);
        process.exit(1);
      }
      if (DRY_RUN) {
        console.log('[DRY RUN] Auto-approving verification gate');
      } else {
        await runVerificationGate(CURRENT_PHASE);
      }
      await gsdTools('phase', 'complete', CURRENT_PHASE);
      break;
    }

    case 'complete': {
      printBanner(`Phase ${CURRENT_PHASE} COMPLETE`);

      // Direct CJS call — no shell-out (REQ-10)
      const nextPhase = nextIncompletePhase(PROJECT_DIR, CURRENT_PHASE);
      if (!nextPhase) {
        printFinalReport();

        const auditResult = await runMilestoneAudit();
        if (auditResult === 0) {
          await runMilestoneCompletion();
          process.exit(0);
        } else if (auditResult === 10) {
          await runGapClosureLoop();
          await runMilestoneCompletion();
          process.exit(0);
        } else {
          console.error('ERROR: Milestone audit encountered an error');
          process.exit(1);
        }
      }

      CURRENT_PHASE = nextPhase;
      // Reset no-progress counter on phase advancement (this IS progress)
      noProgressCount = 0;
      iterationLog = [];
      logMsg(`PHASE ADVANCE: new_phase=${CURRENT_PHASE}`);
      continue;
    }

    default:
      console.error(`ERROR: Unknown step '${currentStep}' for phase ${CURRENT_PHASE}`);
      process.exit(1);
  }
}
