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
import { fileURLToPath } from 'url';
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
  console.log(`To resume: autopilot.sh --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}`);
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
  console.log(`To resume: autopilot.sh --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}`);
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
  console.log(`To resume: autopilot.sh --from-phase ${CURRENT_PHASE} --project-dir ${PROJECT_DIR}`);
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
    // Stub: milestone audit is Phase 49 scope
    logMsg('ALL PHASES COMPLETE: milestone audit stub (Phase 49)');
    console.log('Milestone audit not yet implemented (Phase 49 scope).');
    process.exit(0);
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

    case 'execute':
      // Phase 48: simple runStep (Phase 49 adds runStepWithRetry)
      await runStep(`/gsd:execute-phase ${CURRENT_PHASE}`, 'execute');
      break;

    case 'verify':
      // Phase 48: simple runStep (Phase 49 adds runVerifyWithDebugRetry + verification gate)
      await runStep(`/gsd:verify-work ${CURRENT_PHASE}`, 'verify');

      // Mark phase complete after verify
      // Uses gsdTools shell-out per CONTEXT.md decision
      if (DRY_RUN) {
        console.log('[DRY RUN] Auto-approving verification gate');
      }
      await gsdTools('phase', 'complete', CURRENT_PHASE);
      break;

    case 'complete': {
      printBanner(`Phase ${CURRENT_PHASE} COMPLETE`);

      // Direct CJS call — no shell-out (REQ-10)
      const nextPhase = nextIncompletePhase(PROJECT_DIR, CURRENT_PHASE);
      if (!nextPhase) {
        printFinalReport();
        // Stub: milestone audit is Phase 49 scope
        logMsg('ALL PHASES COMPLETE: milestone audit stub (Phase 49)');
        console.log('Milestone audit not yet implemented (Phase 49 scope).');
        process.exit(0);
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
