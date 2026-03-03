#!/usr/bin/env node

/**
 * GSD CLI — Standalone command-line interface for GSD projects
 *
 * Usage: gsd <command> [options]
 *
 * Commands: progress, todos, health, settings, help
 * Options: --json, --plain
 */

const { findProjectRoot, parseArgs, formatOutput, cliError, routeCommand, COMMANDS } = require('./lib/cli.cjs');

const { command, args, mode } = parseArgs(process.argv.slice(2));

// Help does not require a project root
if (!command || command === 'help') {
  const result = routeCommand('help', null, args, mode);
  process.stdout.write(formatOutput(result, mode) + '\n');
  process.exit(0);
}

// All other commands require a project root
const projectRoot = findProjectRoot(process.cwd());
if (!projectRoot) {
  cliError('Not a GSD project (no .planning/ directory found).\nRun this command from within a GSD project directory.');
}

// Route to command handler
const result = routeCommand(command, projectRoot, args, mode);
if (!result) {
  const available = Object.keys(COMMANDS).join(', ');
  cliError('Unknown command \'' + command + '\'.\n\nAvailable commands: ' + available);
}

process.stdout.write(formatOutput(result, mode) + '\n');
