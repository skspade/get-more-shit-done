/**
 * CLI — Project discovery, argument parsing, and output formatting for the gsd CLI
 */

const fs = require('fs');
const path = require('path');

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

// ─── Stub Handlers ──────────────────────────────────────────────────────────

function handleProgress() {
  return { command: 'progress', message: 'Progress command not yet implemented. See Phase 15.' };
}

function handleTodos() {
  return { command: 'todos', message: 'Todos command not yet implemented. See Phase 16.' };
}

function handleHealth() {
  return { command: 'health', message: 'Health command not yet implemented. See Phase 17.' };
}

function handleSettings() {
  return { command: 'settings', message: 'Settings command not yet implemented. See Phase 18.' };
}

function handleHelp() {
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

// ─── Command Registry ───────────────────────────────────────────────────────

const COMMANDS = {
  progress: { description: 'Show milestone progress and status', handler: handleProgress },
  todos: { description: 'List and inspect pending todos', handler: handleTodos },
  health: { description: 'Validate .planning/ directory integrity', handler: handleHealth },
  settings: { description: 'View and update configuration', handler: handleSettings },
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
