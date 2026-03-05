# Phase 30: Foundation - Research

**Researched:** 2026-03-05
**Domain:** Node.js CLI test infrastructure -- config schema, test counting, framework auto-detection
**Confidence:** HIGH

## Summary

Phase 30 builds the test infrastructure data layer for the GSD framework. This phase is entirely internal to the existing codebase: a new `testing.cjs` lib module, config schema extensions, CLI command additions, and 2 test fixes. No external libraries are needed. All work follows well-established patterns already present in the codebase (lib module structure, gsd-tools dispatcher routing, config dot-notation, node:test framework).

The key technical challenges are: (1) counting test cases across arbitrary user projects using different test frameworks (Jest, Vitest, Mocha, node:test), (2) auto-detecting which framework a project uses from package.json and config files, and (3) extending the config schema with `test.*` keys while maintaining zero-config degradation. All of these are source-parsing problems solvable with regex and file system inspection -- no external dependencies required.

**Primary recommendation:** Build `testing.cjs` as a single lib module following the existing `config.cjs`/`commands.cjs` pattern, with cmd* exported functions for each operation, integrated via gsd-tools.cjs dispatcher and gsd-cli.cjs COMMANDS registry.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Test counting method: Claude's discretion on approach (source parsing vs output parsing vs hybrid), must work across Jest, Vitest, Mocha, and node:test
- Best-effort counting for unsupported frameworks -- most use it()/test() syntax, so attempt regex counting even for unrecognized frameworks
- Phase-to-test mapping: tests live in project source tree, .planning/ only tracks references. Tests must NEVER be placed in .planning/
- Framework auto-detection from both package.json (devDependencies/dependencies) AND config files (jest.config.js, vitest.config.ts, .mocharc.yml, etc.)
- Cover monorepos and projects that don't list test deps in package.json
- Config defaults: test.hard_gate=true, test.acceptance_tests=true, test.budget.per_phase=50, test.budget.project=800, test.steward=true, test.command=auto-detected, test.framework=auto-detected
- All test.* keys support zero-config degradation -- absent keys treated as defaults
- Auto-detected config degrades gracefully: missing package.json, no test files, or no recognized framework -> return zero counts with warning, GSD continues working
- Explicitly configured settings error if broken: if user sets test.command and it fails to execute -> error with command output
- Fix the 2 known failures: codex-config expects 11 agents -> update to 12; config expects 'balanced' -> fix test to handle project-level config
- All test infrastructure must be project-agnostic (this is a framework for use in other codebases)

### Claude's Discretion
- Specific counting implementation approach (source parsing, output parsing, or hybrid)
- Whether project-level budget summary appears in `gsd test-count` output (without --phase)
- Internal module structure of testing.cjs
- Config file scanning patterns for framework detection

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Config schema adds `test.*` section with `command`, `framework`, `hard_gate`, `acceptance_tests`, `budget`, and `steward` keys to config.json | Config pattern (dot-notation, cmdConfigEnsureSection defaults), architecture patterns section |
| FOUND-02 | `test-count` CLI command counts test cases (individual `it`/`test` blocks) across project, with `--phase` flag for per-phase counts | Test counting approach, CLI integration pattern, code examples |
| FOUND-03 | Test framework auto-detection from package.json or project files (Jest, Vitest, Mocha, node:test) | Framework detection pattern, detection matrix |
| FOUND-04 | Fix 2 pre-existing test failures (codex-config, config) so hard gate can activate cleanly | Root cause analysis of both failures |
| FOUND-05 | `testing.cjs` module consolidates all test functions (counting, framework detection, config reading) with dispatcher integration | Module pattern, dispatcher integration, CLI routing |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in (Node 25.6.1) | Test framework for this codebase | Already used by all 15 existing test files |
| node:assert | built-in | Assertions | Already used by all existing tests |
| node:fs | built-in | File system reading for test counting and framework detection | Standard Node.js API |
| node:path | built-in | Path resolution | Standard Node.js API |
| node:child_process | built-in | Executing test commands | Already used by run-tests.cjs |

### Supporting
No external libraries needed. This phase is pure Node.js built-in modules.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex source parsing for test counting | AST parsing (acorn, babel) | AST is more accurate but adds dependency and complexity; regex is sufficient for it()/test() counting across all 4 frameworks |
| File-based framework detection | Running `npx jest --version` etc | File detection is faster, has no side effects, works without installed deps |

**Installation:**
```bash
# No installation needed -- all built-in Node.js modules
```

## Architecture Patterns

### Recommended Module Structure
```
get-shit-done/bin/
├── gsd-tools.cjs          # Add testing.cjs require + route test-* commands
├── gsd-cli.cjs            # Unchanged (delegates to cli.cjs)
└── lib/
    ├── testing.cjs        # NEW: all test infrastructure functions
    ├── config.cjs         # MODIFY: add test.* defaults to cmdConfigEnsureSection
    ├── cli.cjs            # MODIFY: add test-count to COMMANDS registry
    └── [existing modules] # Unchanged
```

### Pattern 1: Lib Module Convention
**What:** Every lib module exports `cmd*` functions that accept `(cwd, ...args, raw)` and use `output()`/`error()` from core.cjs for IO.
**When to use:** All new commands in the GSD framework.
**Example:**
```javascript
// Source: Verified from existing config.cjs, commands.cjs, state.cjs
const { output, error } = require('./core.cjs');

function cmdTestCount(cwd, options, raw) {
  // ... business logic ...
  const result = { total: count, files: fileList };
  output(result, raw, String(count));
}

module.exports = { cmdTestCount, cmdTestDetectFramework, /* ... */ };
```

### Pattern 2: Dispatcher Integration
**What:** gsd-tools.cjs imports the lib module and routes commands via switch/case.
**When to use:** Adding any new gsd-tools command.
**Example:**
```javascript
// Source: Verified from gsd-tools.cjs switch statement pattern
// In gsd-tools.cjs:
const testing = require('./lib/testing.cjs');

// Inside main() switch:
case 'test-count': {
  const phaseIdx = args.indexOf('--phase');
  const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
  testing.cmdTestCount(cwd, { phase }, raw);
  break;
}
```

### Pattern 3: CLI COMMANDS Registry
**What:** gsd-cli.cjs uses a COMMANDS object mapping command names to { description, handler } pairs.
**When to use:** Adding user-facing CLI commands (as opposed to gsd-tools agent commands).
**Example:**
```javascript
// Source: Verified from cli.cjs COMMANDS object
// In cli.cjs COMMANDS:
'test-count': { description: 'Count test cases in project', handler: handleTestCount },
```

### Pattern 4: Config Dot-Notation with Defaults
**What:** Config uses nested JSON with dot-notation access (e.g., `test.hard_gate`). `cmdConfigEnsureSection` writes defaults on first creation. `loadConfig()` in core.cjs provides runtime defaults.
**When to use:** Adding any new config section.
**Example:**
```javascript
// Source: Verified from config.cjs cmdConfigEnsureSection
const hardcoded = {
  // ... existing keys ...
  test: {
    hard_gate: true,
    acceptance_tests: true,
    budget: { per_phase: 50, project: 800 },
    steward: true,
    // command and framework: omitted (auto-detected, no default needed)
  },
};
```

### Pattern 5: Zero-Config Degradation
**What:** When config keys are absent, functions use hardcoded defaults. When auto-detection fails, return sensible empty/zero values with warnings rather than errors.
**When to use:** All test.* config reading and framework detection.
**Example:**
```javascript
// Source: Verified pattern from core.cjs loadConfig()
function getTestConfig(cwd) {
  const config = loadConfig(cwd);
  const testConfig = config.test || {};
  return {
    hard_gate: testConfig.hard_gate !== undefined ? testConfig.hard_gate : true,
    command: testConfig.command || detectTestCommand(cwd),
    framework: testConfig.framework || detectFramework(cwd),
    // ... etc
  };
}
```

### Anti-Patterns to Avoid
- **Importing testing.cjs from config.cjs:** Keep config.cjs focused on config CRUD. testing.cjs can import from config.cjs (and core.cjs), but not vice versa. Config defaults for test.* are static values, not computed.
- **Placing test files in .planning/:** Tests belong in the project's source tree. .planning/ only tracks references to test file paths.
- **Hard-failing on missing test infrastructure:** Auto-detected values must degrade gracefully. Only explicitly-configured values should error when broken.
- **Framework-specific parsing logic as separate files:** Keep all detection/counting logic in a single testing.cjs module, not split across framework-specific files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON config CRUD | Custom config parser | Existing config.cjs cmdConfigGet/cmdConfigSet | Already handles dot-notation, validation, file I/O |
| CLI output formatting | Custom formatters | Existing core.cjs output()/error() | Handles JSON/raw modes, large payload detection |
| Phase directory lookup | Custom phase finder | Existing core.cjs findPhaseInternal() | Handles archived phases, decimal numbering, normalization |
| Git operations | Shell exec git commands | Existing core.cjs execGit() | Safe argument escaping, structured return |

**Key insight:** The GSD codebase has a mature utility layer (core.cjs, config.cjs, frontmatter.cjs). testing.cjs should compose existing utilities, not duplicate them.

## Common Pitfalls

### Pitfall 1: Test Counting Regex Edge Cases
**What goes wrong:** Naive regex `test(` matches non-test function calls (e.g., `performance.test(`, comments, string literals).
**Why it happens:** JavaScript has no reserved keywords for test functions.
**How to avoid:** Match test/it at the start of a line (with optional whitespace), followed by `(` and a string delimiter. Pattern: `/^\s*(?:test|it)\s*\(/m`. This is intentionally inclusive -- best-effort counting accepts some false positives over false negatives.
**Warning signs:** Count significantly exceeds actual test count reported by runner.

### Pitfall 2: Framework Detection Priority Conflicts
**What goes wrong:** A project has both Jest and Vitest installed (migration scenario). Detection returns wrong framework.
**Why it happens:** Multiple frameworks present simultaneously.
**How to avoid:** Use priority ordering: config file presence beats package.json. Vitest config beats Jest config (Vitest is typically the migration target). Explicit `test.framework` in config.json overrides all detection.
**Warning signs:** `test.command` auto-detection runs wrong runner.

### Pitfall 3: Config Schema Backward Compatibility
**What goes wrong:** Existing config.json files (without test.* keys) break after upgrade.
**Why it happens:** Code assumes test.* keys exist.
**How to avoid:** Always default missing keys at read-time, never assume structure exists. `loadConfig()` pattern already does this -- follow it for test.* keys.
**Warning signs:** `TypeError: Cannot read property 'hard_gate' of undefined`.

### Pitfall 4: User-Level Defaults Leaking into Tests
**What goes wrong:** Tests that call `config-ensure-section` get unexpected values because `~/.gsd/defaults.json` overrides hardcoded defaults.
**Why it happens:** `cmdConfigEnsureSection` merges user-level defaults from `~/.gsd/defaults.json`.
**How to avoid:** This is exactly what causes the existing config test failure. The fix: test should read the actually-created config and assert properties of it, rather than hardcoding expected values that assume no user defaults exist.
**Warning signs:** Tests pass in CI but fail locally (or vice versa).

### Pitfall 5: Monorepo Test File Discovery
**What goes wrong:** Test counting misses tests in workspace packages or scans node_modules.
**Why it happens:** Glob patterns are too narrow or too broad.
**How to avoid:** Use framework-appropriate glob patterns. Default to common conventions (`**/*.test.{js,ts,cjs,mjs}`, `**/*.spec.{js,ts,cjs,mjs}`). Always exclude `node_modules/`.
**Warning signs:** Count is 0 in a project with many tests, or count is astronomically high.

## Code Examples

Verified patterns from the existing codebase.

### Test Counting via Source Parsing
```javascript
// Recommended approach: regex-based source parsing
// Counts it() and test() calls at statement level
function countTestsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match test/it at line start (with indent), followed by ( and string delimiter
  const testPattern = /^\s*(?:test|it)\s*\(/gm;
  const matches = content.match(testPattern);
  return matches ? matches.length : 0;
}

function countTestsInProject(cwd, options) {
  const testFiles = findTestFiles(cwd);
  let total = 0;
  const fileCounts = [];
  for (const file of testFiles) {
    const count = countTestsInFile(path.join(cwd, file));
    total += count;
    fileCounts.push({ file, count });
  }
  return { total, files: fileCounts };
}
```

### Framework Detection Logic
```javascript
// Source: Derived from established patterns in package.json/config file detection
const FRAMEWORK_CONFIGS = {
  vitest: {
    packages: ['vitest'],
    configs: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'],
  },
  jest: {
    packages: ['jest', '@jest/core'],
    configs: ['jest.config.js', 'jest.config.ts', 'jest.config.cjs', 'jest.config.mjs'],
  },
  mocha: {
    packages: ['mocha'],
    configs: ['.mocharc.yml', '.mocharc.yaml', '.mocharc.json', '.mocharc.js', '.mocharc.cjs'],
  },
  'node:test': {
    packages: [],  // built-in, detected by test script or file patterns
    configs: [],
  },
};

function detectFramework(cwd) {
  // 1. Check config files first (highest confidence)
  for (const [framework, info] of Object.entries(FRAMEWORK_CONFIGS)) {
    for (const configFile of info.configs) {
      if (fs.existsSync(path.join(cwd, configFile))) {
        return framework;
      }
    }
  }

  // 2. Check package.json dependencies
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [framework, info] of Object.entries(FRAMEWORK_CONFIGS)) {
      if (info.packages.some(p => p in allDeps)) {
        return framework;
      }
    }
  } catch { /* no package.json */ }

  // 3. Check test script for node:test pattern
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    if (pkg.scripts?.test && /node\s+--test/.test(pkg.scripts.test)) {
      return 'node:test';
    }
  } catch { /* ignore */ }

  return null;  // unknown framework
}
```

### Config Defaults for test.* Section
```javascript
// Source: Follows pattern from config.cjs cmdConfigEnsureSection
// Added to the hardcoded defaults object:
const hardcoded = {
  // ... existing keys ...
  test: {
    hard_gate: true,
    acceptance_tests: true,
    budget: {
      per_phase: 50,
      project: 800,
    },
    steward: true,
    // command and framework are intentionally omitted -- auto-detected at runtime
  },
};
```

### Test File Discovery
```javascript
// Discover test files using common conventions
function findTestFiles(cwd) {
  const results = [];
  const extensions = ['.test.js', '.test.ts', '.test.cjs', '.test.mjs',
                      '.spec.js', '.spec.ts', '.spec.cjs', '.spec.mjs'];

  function walk(dir, relPath) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      const rel = path.join(relPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, rel);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(rel);
      }
    }
  }

  walk(cwd, '');
  return results;
}
```

### Fixing the Two Known Test Failures
```javascript
// Fix 1: codex-config.test.cjs line 174
// Change: assert.strictEqual(agentNames.length, 11, 'has 11 agents');
// To:     assert.strictEqual(agentNames.length, 12, 'has 12 agents');

// Fix 2: config.test.cjs line 303-308
// The test creates a config via config-ensure-section which merges ~/.gsd/defaults.json.
// The test then hardcodes 'balanced' but user defaults may override to 'quality'.
// Fix: read the created config and assert against what was actually written,
// or write a known config before testing config-get.
// Simplest fix: write explicit config before config-get assertions
// beforeEach(() => {
//   tmpDir = createTempProject();
//   // Write a config with known values instead of relying on config-ensure-section
//   const configPath = path.join(tmpDir, '.planning', 'config.json');
//   fs.writeFileSync(configPath, JSON.stringify({
//     model_profile: 'balanced',
//     workflow: { research: true },
//   }, null, 2));
// });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shell-based test running | node:test built-in | Node 18+ | No external test runner dependency |
| Jest/Mocha for all projects | Vitest gaining dominance | 2023-2024 | Detection should prioritize Vitest over Jest when both present |
| Manual test count tracking | Automated counting from source | Current phase | Enables budget enforcement in later phases |

**Deprecated/outdated:**
- `require('test')` syntax: Use `require('node:test')` protocol prefix (standard since Node 16.17)
- Jest `moduleNameMapper` for CJS: Vitest handles ESM natively

## Open Questions

1. **Per-phase test counting granularity**
   - What we know: `--phase N` should report per-phase counts. PLAN.md or CONTEXT.md can reference test file paths.
   - What's unclear: How exactly does the mapping from phase number to test files work? Does it scan PLAN.md for test file references, or does it use directory conventions?
   - Recommendation: Start with scanning PLAN.md files in the phase directory for test file path references. The planner should define the exact format of these references during plan creation.

2. **Test command auto-detection**
   - What we know: `test.command` should be auto-detected from the framework. For node:test projects, it's `node --test`. For Jest, `npx jest`. For Vitest, `npx vitest run`. For Mocha, `npx mocha`.
   - What's unclear: Should auto-detection also check `package.json scripts.test`?
   - Recommendation: Check `package.json scripts.test` first (highest user intent), then fall back to framework-based command construction.

3. **Nested describe/test counting**
   - What we know: `describe()` blocks contain `test()`/`it()` calls. The regex approach counts leaf tests correctly regardless of nesting.
   - What's unclear: Should `describe.skip()` or `test.skip()` be excluded from counts?
   - Recommendation: Count all test/it calls including skipped ones. Budget tracking should reflect total defined tests, not just active ones.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `get-shit-done/bin/lib/config.cjs` -- config CRUD patterns, cmdConfigEnsureSection defaults
- Codebase inspection: `get-shit-done/bin/gsd-tools.cjs` -- dispatcher routing pattern
- Codebase inspection: `get-shit-done/bin/lib/cli.cjs` -- COMMANDS registry, handleProgress/handleHealth patterns
- Codebase inspection: `get-shit-done/bin/lib/core.cjs` -- output/error helpers, loadConfig pattern
- Codebase inspection: `scripts/run-tests.cjs` -- existing node:test runner
- Codebase inspection: `tests/helpers.cjs` -- test helper pattern (runGsdTools, createTempProject, cleanup)
- Codebase inspection: `tests/config.test.cjs` and `tests/codex-config.test.cjs` -- root cause of 2 failures
- Codebase inspection: `~/.gsd/defaults.json` -- confirmed user-level defaults causing config test failure

### Secondary (MEDIUM confidence)
- Node.js built-in `node:test` module documentation -- describe/test/it API
- Framework config file conventions for Jest, Vitest, Mocha -- standard file names verified against training data

### Tertiary (LOW confidence)
- Vitest-over-Jest priority recommendation -- based on ecosystem trends, not verified with current adoption data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely built-in Node.js modules, no external dependencies
- Architecture: HIGH -- follows established patterns directly observable in the codebase
- Pitfalls: HIGH -- 2 test failures verified by running tests; edge cases identified from codebase analysis
- Test counting approach: MEDIUM -- regex counting is well-understood but edge cases exist across diverse project structures

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- internal infrastructure, no external dependencies)
