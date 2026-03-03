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

module.exports = {
  findProjectRoot,
  parseArgs,
  formatOutput,
  cliError,
};
