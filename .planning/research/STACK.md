# Stack Research: Dual-Layer Test Architecture

**Domain:** Test architecture additions for autonomous AI agent orchestration framework
**Researched:** 2026-03-05
**Confidence:** HIGH
**Scope:** NEW capabilities only -- test steward, acceptance test execution, hard test gates, test budget counting, test framework auto-detection

## Executive Decision

**Zero new npm dependencies.** Every capability in the v1.6 design is implementable with Node.js built-ins, shell commands (grep/find), and the existing `gsd-tools.cjs` extension pattern. This is not a compromise -- it is the correct approach for a workflow/agent project that already runs with zero runtime dependencies.

## What Already Exists (Do NOT Rebuild, Do NOT Re-Research)

| Existing Component | v1.6 Relevance |
|---|---|
| `gsd-tools.cjs` CLI router (600 LOC) | New `test-count`, `test-detect` subcommands plug into existing switch/case dispatcher |
| `config.cjs` module (config-get/config-set/config-ensure) | Already supports dot-notation paths -- `test.command`, `test.budget.max_tests_per_phase` work out of the box |
| `node:test` runner + `scripts/run-tests.cjs` | GSD's own test suite (15 files, 618 test cases) validates that new lib modules don't break anything |
| `verify.cjs` module | Acceptance test verification extends existing verification patterns |
| `execute-plan.md` workflow | Hard gate inserts after existing task-commit step |
| `discuss-phase.md` workflow | Acceptance test gathering adds a new step after decision gathering |
| `audit-milestone.md` workflow | Test steward spawns as a Task subagent at audit time |
| `add-tests.md` workflow | Repurposed as "fill gaps" for pre-v1.6 phases |

**Confidence: HIGH** -- Direct codebase inspection. All 12 lib modules, 15 test files, package.json, dispatcher examined.

## New Capabilities: Implementation Stack

### 1. Test Framework Auto-Detection

**What:** Detect the project's test framework (jest, vitest, mocha, node:test, pytest, go test, etc.) from project files.

**Implementation:** New function in a new `get-shit-done/bin/lib/testing.cjs` module. Pure Node.js, no dependencies.

**Detection algorithm (ordered by specificity):**

```javascript
function detectTestFramework(cwd) {
  // 1. Check config.json for explicit override
  const config = loadConfig(cwd);
  if (config.test?.framework && config.test.framework !== 'auto') {
    return config.test.framework;
  }

  // 2. Check package.json devDependencies (most reliable for JS projects)
  const pkg = safeReadJson(path.join(cwd, 'package.json'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.vitest) return 'vitest';
  if (deps.jest) return 'jest';
  if (deps.mocha) return 'mocha';

  // 3. Check for framework config files
  if (exists('vitest.config.*')) return 'vitest';
  if (exists('jest.config.*') || pkg.jest) return 'jest';
  if (exists('.mocharc.*')) return 'mocha';

  // 4. Check test script content
  const testCmd = pkg.scripts?.test || '';
  if (testCmd.includes('vitest')) return 'vitest';
  if (testCmd.includes('jest')) return 'jest';
  if (testCmd.includes('mocha')) return 'mocha';
  if (testCmd.includes('node --test') || testCmd.includes('node:test')) return 'node:test';
  if (testCmd.includes('pytest')) return 'pytest';
  if (testCmd.includes('go test')) return 'go';

  // 5. Check for node:test usage in test files (GSD's own pattern)
  if (hasNodeTestImports(cwd)) return 'node:test';

  return 'unknown';
}
```

**Why this approach over an npm package:** No "detect-test-framework" package exists that covers this use case well. The detection logic is ~40 lines, stable, and specific to what GSD needs. Adding a dependency for this would be absurd.

**Confidence: HIGH** -- The detection signals (devDependencies keys, config file names, script content) are stable across framework versions and well-documented in each framework's official docs.

### 2. Test Case Counting

**What:** Count individual test cases (not files) across the project and optionally per-phase.

**Implementation:** Shell-based grep in `testing.cjs`, exposed as `gsd-tools.cjs test-count`.

**Counting patterns by framework:**

| Framework | Pattern | Notes |
|---|---|---|
| jest/vitest/mocha | `it(`, `test(`, `it.only(`, `test.only(` | Standard across all three |
| node:test | Same as above (node:test uses identical `test()`/`it()` API) | Verified against GSD's own 15 test files |
| pytest | `def test_` | Python convention |
| go | `func Test` | Go convention |

**Implementation approach:**

```javascript
function countTests(cwd, framework) {
  const patterns = getTestPatterns(framework);  // file globs for test files
  const countRegex = getCountRegex(framework);  // what to grep for

  // Use grep -r with --include for file filtering
  // This is what the design doc already specifies and it works
  const result = execSync(
    `grep -r -c "${countRegex}" ${testDirs} ${includeFlags} 2>/dev/null | awk -F: '{sum+=$2} END{print sum}'`,
    { cwd, encoding: 'utf-8' }
  ).trim();

  return parseInt(result, 10) || 0;
}
```

**Why grep over AST parsing:** The design doc's grep approach is correct. AST parsing would require `@babel/parser` or `acorn` (new dependencies) and would be slower for a simple count. Grep handles 99% of cases -- the 1% edge case (test name containing `test(` as a string) is noise in a count used for budget advisory, not billing.

**Per-phase counting:** The design mentions "by commit attribution" but this is complex (git log parsing per file, mapping commits to phases). Simpler alternative: count tests in files that live under phase directories, or count tests in files modified during a phase's commits. The commit-based approach adds complexity without proportional value for a budget advisory. Recommend: count all tests project-wide for budget, defer per-phase attribution to the steward's analysis.

**Confidence: HIGH** -- Verified the grep pattern against GSD's own 618 test cases. `grep -r -c "it(\|test(" tests/ --include="*.test.*"` returns correct counts.

### 3. Hard Test Gate in execute-plan

**What:** After each task commit during plan execution, run the project's full test suite. Fail = trigger debug-retry.

**Implementation:** Pure shell in the execute-plan workflow. Zero new code in gsd-tools.cjs.

```bash
# Fetch test command from config (existing config-get works today)
TEST_CMD=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get test.command 2>/dev/null)

if [ -n "$TEST_CMD" ] && [ "$TEST_CMD" != "null" ]; then
  eval "$TEST_CMD"
  if [ $? -ne 0 ]; then
    echo "HARD GATE: Test suite failed after task ${TASK_NUM}"
    # Existing Rule 1 deviation handling kicks in
  fi
else
  echo "Warning: No test command configured -- test gates inactive"
fi
```

**Why no wrapper library:** The hard gate is 8 lines of bash in a markdown workflow file. It uses `config-get` which already exists. Adding a "test runner abstraction" would be over-engineering.

**What about `test.hard_gate` config toggle:** The workflow should also check `config-get test.hard_gate` before running. If false, skip the gate. This is a one-line addition.

**Confidence: HIGH** -- `config-get` tested and working. Shell eval of test commands is the standard pattern used by npm, CI systems, and every task runner.

### 4. Acceptance Test Execution (Given/When/Then/Verify)

**What:** Parse `<acceptance_tests>` blocks from CONTEXT.md, execute `Verify:` shell commands, report pass/fail.

**Implementation:** New functions in `testing.cjs`, exposed as `gsd-tools.cjs test-acceptance --phase N`.

**Parser approach:**

```javascript
function parseAcceptanceTests(contextMdContent) {
  // Extract <acceptance_tests>...</acceptance_tests> block
  const match = contextMdContent.match(/<acceptance_tests>([\s\S]*?)<\/acceptance_tests>/);
  if (!match) return [];

  // Parse AT-NN sections with regex
  const tests = [];
  const atRegex = /### (AT-\d+):\s*(.+)\n([\s\S]*?)(?=### AT-|\z)/g;
  // Extract Given/When/Then/Verify from each section
  // ...
  return tests;
}

function runAcceptanceTests(tests, cwd) {
  const results = [];
  for (const at of tests) {
    const { stdout, stderr, status } = spawnSync('sh', ['-c', at.verify], {
      cwd, timeout: 30000, encoding: 'utf-8'
    });
    results.push({
      id: at.id,
      name: at.name,
      passed: status === 0,
      output: stdout || stderr
    });
  }
  return results;
}
```

**Why `spawnSync` over `exec`:** Synchronous execution is correct here -- acceptance tests run sequentially, each must complete before the next. `spawnSync` with a 30-second timeout prevents hanging commands from blocking the workflow.

**Why not a BDD library (cucumber, gherkin):** The acceptance tests are human-readable markdown with a `Verify:` shell command. The Given/When/Then is for humans to read; only the `Verify:` line is executable. Bringing in cucumber would require a gherkin parser, step definitions, a runner -- massive complexity for what is fundamentally `sh -c "$VERIFY_CMD" && echo PASS || echo FAIL`.

**Confidence: HIGH** -- The format is defined in the design doc. Regex parsing of markdown sections is a well-established pattern in this codebase (see `frontmatter.cjs`, `state.cjs`).

### 5. Test Steward Agent

**What:** Analysis agent that detects redundancy, counts budgets, proposes consolidation.

**Implementation:** A new GSD agent file (`agents/gsd-test-steward.md`) + supporting functions in `testing.cjs`.

**What testing.cjs provides to the steward:**

| Function | Purpose | Implementation |
|---|---|---|
| `countTests(cwd, framework)` | Total test count for budget check | grep-based (see #2 above) |
| `detectTestFramework(cwd)` | Framework detection for pattern matching | file-inspection (see #1 above) |
| `listTestFiles(cwd)` | Enumerate all test files | `glob` via `fs.readdirSync` recursive |
| `getTestBudget(cwd)` | Read budget config | `config-get test.budget.*` |

**What the steward does as an AI agent (not code):**
- Reads test files (using its Read tool)
- Identifies redundancy through semantic analysis (AI is better at this than AST diffing)
- Produces markdown consolidation proposals
- Reports budget status

**Why AI-driven redundancy detection over static analysis:** Tools like `jscpd` (copy-paste detector) find syntactic duplication, not semantic redundancy. Two tests that test the same behavior with different code structures are semantically redundant but syntactically unique. The AI agent reads the tests, understands intent, and identifies overlap -- which is exactly what this codebase already does with its other agents (gsd-researcher, gsd-verifier). No new dependency needed.

**Confidence: HIGH** -- Agent-as-markdown is the established GSD pattern. The steward's supporting functions are trivial Node.js.

### 6. Test Budget Management

**What:** Track test counts against configurable per-phase and project-wide limits.

**Implementation:** Functions in `testing.cjs` + `gsd-tools.cjs test-budget` subcommand.

```javascript
function getTestBudgetStatus(cwd) {
  const framework = detectTestFramework(cwd);
  const total = countTests(cwd, framework);
  const config = loadConfig(cwd);
  const budget = config.test?.budget || { max_total_tests: 200, warn_at_percentage: 80 };

  return {
    total,
    max: budget.max_total_tests,
    percentage: Math.round((total / budget.max_total_tests) * 100),
    warning: total >= budget.max_total_tests * (budget.warn_at_percentage / 100),
    exceeded: total >= budget.max_total_tests
  };
}
```

**Exposed as:** `node gsd-tools.cjs test-budget` (returns JSON with budget status).

**Confidence: HIGH** -- Composition of counting + config reading, both already validated.

## New Module: `testing.cjs`

All test-related functions consolidated in one new lib module, following the existing pattern (one module per domain: `state.cjs`, `phase.cjs`, `verify.cjs`, etc.).

| Export | CLI Command | Purpose |
|---|---|---|
| `cmdTestCount` | `test-count [--framework F]` | Count test cases project-wide |
| `cmdTestDetect` | `test-detect` | Auto-detect test framework |
| `cmdTestBudget` | `test-budget` | Budget status (count vs limits) |
| `cmdTestAcceptance` | `test-acceptance --phase N` | Parse and run acceptance tests from CONTEXT.md |
| `detectTestFramework` | (internal) | Framework detection logic |
| `countTests` | (internal) | Grep-based counting |
| `parseAcceptanceTests` | (internal) | CONTEXT.md AT block parser |
| `runAcceptanceTests` | (internal) | Execute Verify commands |
| `getTestBudgetStatus` | (internal) | Budget calculation |

**Integration with gsd-tools.cjs dispatcher:** Add 4 new cases to the switch statement (lines 180-600), following the exact same pattern as existing commands. Import `testing` module alongside `config`, `state`, etc.

## New Config Schema Keys

Added to `config-ensure-section` defaults in `config.cjs`:

```json
{
  "test": {
    "command": null,
    "framework": "auto",
    "hard_gate": true,
    "acceptance_tests": true,
    "budget": {
      "max_tests_per_phase": 30,
      "max_total_tests": 200,
      "warn_at_percentage": 80
    },
    "steward": {
      "enabled": true,
      "redundancy_threshold": 0.15,
      "stale_threshold": 0.05,
      "auto_consolidate": false
    }
  }
}
```

**Backward compatibility:** Existing `config-ensure-section` only writes config.json if it does not exist. Existing projects keep their current config. New projects get the test defaults. Projects upgrading can add the `test` key via `config-set` or `/gsd:settings`.

## What NOT to Add

| Temptation | Why NOT | Instead |
|---|---|---|
| `@babel/parser` or `acorn` for AST-based test counting | Adds 2+ MB of dependencies for a count that grep handles in <100ms. Test counting is advisory, not billing-grade. | grep with `--include` patterns |
| `cucumber` / `@cucumber/cucumber` for BDD | Acceptance tests have one executable line (`Verify:`), not step definitions. Cucumber's value is in parameterized step reuse across scenarios -- GSD ATs are standalone shell commands. | Regex parse + `spawnSync('sh', ['-c', cmd])` |
| `jscpd` for copy-paste detection in tests | Finds syntactic duplication only. AI steward agent finds semantic redundancy, which is what actually matters for test consolidation. | gsd-test-steward agent reads tests, proposes consolidation |
| `istanbul` / `nyc` for coverage | GSD already has `c8` in devDependencies for coverage. The test steward doesn't need coverage data -- it analyzes test intent, not line coverage. | Existing `c8` if coverage is ever needed |
| `jest` or `vitest` as GSD's test runner | GSD uses `node:test` (built-in, zero-dep). All 15 test files, 618 cases run via `node --test`. Switching frameworks adds dependency and migration cost for no benefit. | Keep `node:test` + `scripts/run-tests.cjs` |
| A generic "test runner adapter" abstraction | The hard gate just runs `eval "$TEST_CMD"`. The project's test command is configured once in `test.command`. Abstracting over different runners adds complexity for a single `eval` call. | `config-get test.command` + `eval` |
| `glob` npm package for test file discovery | Node.js `fs.readdirSync` with `recursive: true` (stable since Node 18.17) handles this. The project requires Node >=16.7.0 but runs on v25.6.1 in practice. | `fs.readdirSync(dir, { recursive: true })` |
| Separate test database/state file | Test counts are derived from source files on demand. Caching counts in a state file creates staleness bugs. The grep-based count runs in <100ms for typical projects. | Compute on demand, never cache |

## File Changes Summary

| File | Change Type | Scope |
|---|---|---|
| `get-shit-done/bin/lib/testing.cjs` | **NEW** | ~200-300 LOC. All test functions. |
| `get-shit-done/bin/gsd-tools.cjs` | MODIFY | Add `require('./lib/testing.cjs')` + 4 switch cases (~30 LOC) |
| `get-shit-done/bin/lib/config.cjs` | MODIFY | Add test defaults to `cmdConfigEnsureSection` (~15 LOC) |
| `get-shit-done/agents/gsd-test-steward.md` | **NEW** | Agent markdown file (~200-300 lines) |
| `get-shit-done/workflows/execute-plan.md` | MODIFY | Add hard gate step (~15 LOC markdown) |
| `get-shit-done/workflows/discuss-phase.md` | MODIFY | Add acceptance test gathering step (~30 LOC markdown) |
| `get-shit-done/workflows/verify-phase.md` | MODIFY | Add AT execution in verification (~20 LOC markdown) |
| `get-shit-done/workflows/audit-milestone.md` | MODIFY | Spawn test steward step (~15 LOC markdown) |
| `tests/testing.test.cjs` | **NEW** | Tests for testing.cjs module |

## Installation

```bash
# No new npm packages needed.
# The only new code artifacts are:
#   1. testing.cjs (Node.js lib module)
#   2. gsd-test-steward.md (agent markdown)
#   3. Workflow modifications (markdown edits)
#   4. testing.test.cjs (tests)

# Verify existing tests still pass after changes:
npm test
```

## Version Compatibility

| Component | Required | Actual | Notes |
|---|---|---|---|
| Node.js | >=16.7.0 (package.json) | v25.6.1 (installed) | `fs.readdirSync` recursive needs 18.17+, but actual Node version is well above |
| `node:test` | Node >=18 (stable) | v25.6.1 | Built-in, zero-dep. All 15 existing test files use it. |
| `child_process.spawnSync` | Node >=0.12 | v25.6.1 | For acceptance test execution |
| `child_process.execSync` | Node >=0.12 | v25.6.1 | For grep-based test counting |
| grep | Any POSIX grep | System grep | For test case counting. Available on all dev machines. |
| c8 | ^11.0.0 (devDep) | Installed | Existing coverage tool, unchanged |

## Sources

- GSD codebase direct inspection: `package.json` (zero runtime deps, devDeps: c8 + esbuild), `gsd-tools.cjs` (600 LOC dispatcher), `lib/config.cjs` (dot-notation config-get/set), `scripts/run-tests.cjs` (node:test runner), all 15 `tests/*.test.cjs` files (618 test cases using `require('node:test')`). **HIGH confidence.**
- [Node.js test runner API](https://nodejs.org/api/test.html) -- Verified `test()` / `it()` / `describe()` API matches grep counting patterns. Built-in reporters (spec, tap, junit) available. No dry-run/list-tests API exists. **HIGH confidence.**
- [Jest CLI docs](https://jestjs.io/docs/cli) -- Confirmed `test(` / `it(` as universal test case markers. **HIGH confidence.**
- Design doc (`.planning/designs/2026-03-05-dual-layer-test-architecture-design.md`) -- All requirements, config schema, workflow integration points defined. **HIGH confidence** (first-party design).

---
*Stack research for: GSD Dual-Layer Test Architecture (v1.6)*
*Researched: 2026-03-05*
