#!/usr/bin/env node

/**
 * GSD CLI — Standalone command-line interface for GSD projects
 *
 * Usage: gsd <command> [options]
 *
 * Commands: progress, todos, health, settings, help
 * Options: --json, --plain
 */

const { findProjectRoot, parseArgs, formatOutput, cliError } = require('./lib/cli.cjs');

const { command, args, mode } = parseArgs(process.argv.slice(2));

// Help does not require a project root
if (!command || command === 'help') {
  const helpText = [
    'gsd - GSD CLI Utilities',
    '',
    'Usage: gsd <command> [options]',
    '',
    'Commands:',
    '  progress    Show milestone progress and status',
    '  todos       List and inspect pending todos',
    '  health      Validate .planning/ directory integrity',
    '  settings    View and update configuration',
    '  help        Show available commands and usage',
    '',
    'Options:',
    '  --json      Output as JSON',
    '  --plain     Output as plain text (no colors)',
  ].join('\n');

  const result = { command: 'help', message: helpText };
  process.stdout.write(formatOutput(result, mode) + '\n');
  process.exit(0);
}

// All other commands require a project root
const projectRoot = findProjectRoot(process.cwd());
if (!projectRoot) {
  cliError('Not a GSD project (no .planning/ directory found).\nRun this command from within a GSD project directory.');
}

// Placeholder dispatch — replaced by Plan 02 with full routing
const result = { command, message: `Command '${command}' received. Routing not yet implemented.` };
process.stdout.write(formatOutput(result, mode) + '\n');
