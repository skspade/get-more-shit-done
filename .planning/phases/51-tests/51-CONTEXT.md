# Phase 51: Tests - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

All new CJS functions added in Phase 47 (`findFirstIncompletePhase`, `nextIncompletePhase`, `getVerificationStatus`, `getGapsSummary`, `CONFIG_DEFAULTS` fallback) and the `gsd-tools` dispatch entries added for `phase find-next` and `verify status/gaps` get comprehensive unit test coverage. An integration test verifies `autopilot.mjs --dry-run` completes without error on a valid `.planning/` structure.

</domain>

<decisions>
## Implementation Decisions

### Test Framework and Patterns (REQ-24, REQ-25, REQ-26, REQ-27, REQ-28)
- Use `node:test` and `node:assert` matching every existing test file in the project
- Use `createTempProject()` and `cleanup()` from `tests/helpers.cjs` for temp directory lifecycle
- Use `runGsdTools()` from `tests/helpers.cjs` for CLI dispatch tests (REQ-27)
- Direct `require()` imports of CJS modules for unit-level tests where CLI dispatch is not the subject under test (Claude's Decision: direct imports allow testing return values without JSON parse overhead and match the pattern used in testing.test.cjs)

### File Organization
- Phase navigation tests go in `tests/phase.test.cjs` as a new `describe` block appended to the existing file (Claude's Decision: tests for `findFirstIncompletePhase` and `nextIncompletePhase` belong with the other phase tests rather than a separate file)
- Verification status tests go in `tests/verify.test.cjs` as a new `describe` block appended to the existing file (Claude's Decision: same rationale -- `getVerificationStatus` and `getGapsSummary` belong with existing verify tests)
- Config defaults tests go in `tests/config.test.cjs` as a new `describe` block appended to the existing file (Claude's Decision: `CONFIG_DEFAULTS` fallback is a config-get behavior, tested alongside existing config-get tests)
- Dispatch tests for `phase find-next` and `verify status/gaps` go in `tests/dispatcher.test.cjs` as a new `describe` block (Claude's Decision: dispatcher.test.cjs already tests gsd-tools dispatch routing for other subcommands)
- `autopilot.mjs --dry-run` integration test goes in a new `tests/autopilot.test.cjs` file (Claude's Decision: autopilot is a standalone script with different execution requirements -- it needs `node` invocation rather than `runGsdTools`, so a separate file avoids conflating test concerns)

### Phase Navigation Tests (REQ-24)
- Test `findFirstIncompletePhase`: all phases complete returns null, one incomplete returns that phase number, multiple incomplete returns the first one, decimal phase numbers sort correctly
- Test `nextIncompletePhase`: returns next incomplete after given phase, skips completed phases between, returns null when no more incomplete phases exist, handles decimal phase numbers
- Temp projects use a minimal ROADMAP.md with `### Phase N: Name` headings and `.completed` marker files to control completion status (Claude's Decision: `.completed` marker is the primary completion signal and avoids needing ROADMAP checkbox formatting in test fixtures)

### Verification Status Tests (REQ-25)
- Test `getVerificationStatus`: VERIFICATION.md with frontmatter returns `{ status, score }`, UAT.md fallback when no VERIFICATION.md, returns null when neither file exists, parses `gaps_found` status correctly
- Test `getGapsSummary`: extracts gap lines from `## Gap` sections, returns empty array when no gap sections exist, returns empty array when no verification file exists
- Verification test fixtures use minimal markdown files with frontmatter blocks (Claude's Decision: real VERIFICATION.md files are large; minimal fixtures isolate the parsing logic being tested)

### Config Defaults Tests (REQ-26)
- Test `config-get` via `runGsdTools`: unset key with a CONFIG_DEFAULTS entry returns the default value, explicitly set key returns the configured value overriding default
- Test all four CONFIG_DEFAULTS keys: `autopilot.circuit_breaker_threshold`, `autopilot.max_debug_retries`, `autopilot.max_audit_fix_iterations`, `autopilot.auto_accept_tech_debt`

### Dispatch Tests (REQ-27)
- Test `phase find-next` via `runGsdTools`: returns first incomplete phase, returns null/empty when all complete, `--from N` returns next incomplete after N
- Test `verify status <phase>` via `runGsdTools`: returns JSON with status and score fields
- Test `verify gaps <phase>` via `runGsdTools`: returns JSON array of gap strings
- Test error paths: `verify status` with no phase arg, `verify gaps` with no phase arg, `verify status` with nonexistent phase

### Autopilot Dry-Run Integration Test (REQ-28)
- Run `node autopilot.mjs --dry-run --project-dir <tmpDir>` via `execSync` with a valid `.planning/` structure containing ROADMAP.md with one incomplete phase
- Assert exit code 0 (or circuit breaker exit which is also acceptable in dry-run since no real progress occurs) (Claude's Decision: dry-run exercises the full code path including circuit breaker which triggers because no artifacts change -- the test should accept either clean exit or circuit breaker exit)
- Assert log file is created in `.planning/logs/`
- Temp project needs: `.planning/ROADMAP.md` with a phase, `.planning/phases/<phase-dir>/.gitkeep`, and `gsd-tools.cjs` accessible on the path (Claude's Decision: minimal fixture that satisfies autopilot prerequisites checks)

### Test Budget
- Estimated new tests: ~35-40 across all five files
- Current passing: 611 tests (2 pre-existing failures)
- Budget ceiling: 800 tests (project constraint from PROJECT.md)
- Post-phase estimate: ~650 tests, well within budget

### Claude's Discretion
- Exact test names and describe block titles
- Whether to use `beforeEach`/`afterEach` or `before`/`after` for shared setup within new describe blocks
- Exact ROADMAP.md fixture content and phase naming in test fixtures
- Whether decimal phase tests use `2.1` or `1.1` as the decimal phase number
- Internal helper functions within test files for fixture creation

</decisions>

<specifics>
## Specific Ideas

- `findFirstIncompletePhase` reads ROADMAP.md phases via regex `#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)` -- test fixtures must use this heading format
- `computePhaseStatus` checks three completion signals: `.completed` marker file, ROADMAP checkbox `- [x] ... (completed YYYY-MM-DD)`, and artifact-complete (all plans have summaries) -- test fixtures should use the `.completed` marker as the simplest path
- `getVerificationStatus` searches for files ending in `-VERIFICATION.md` or exact `VERIFICATION.md`, then `-UAT.md` or `UAT.md` -- test fixtures should use the prefixed form (e.g., `01-VERIFICATION.md`) matching real project convention
- `getGapsSummary` enters gap collection mode on lines matching `/^## .*[Gg]ap/` and exits on the next `## ` heading -- test fixtures need sections like `## Gaps Found` with indented bullet content
- `CONFIG_DEFAULTS` keys use dot-notation (`autopilot.circuit_breaker_threshold`) which `cmdConfigGet` traverses as nested object keys -- but the defaults are stored as flat dot-notation keys, so the fallback only fires when the key is completely absent from config.json
- The `phase find-next` dispatch in `gsd-tools.cjs` checks for `--from` flag in the args array at `args.indexOf('--from')` -- tests should pass `phase find-next --from 2` as the command string
- `autopilot.mjs` requires `claude` on PATH (checked via `which`) -- the integration test should either mock this check or accept a skip when claude is not installed (Claude's Decision: the test should handle missing `claude` gracefully since CI environments may not have it)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/helpers.cjs` (`runGsdTools`, `createTempProject`, `createTempGitProject`, `cleanup`): Standard test infrastructure used by all 16 existing test files
- `tests/phase.test.cjs`: 611+ lines covering phase list, decimal sort, plan index, add, insert, remove, complete, status -- new navigation tests append here
- `tests/verify.test.cjs`: Covers validate consistency, plan-structure, phase-completeness, references, commits, artifacts, key-links -- new verification status tests append here
- `tests/config.test.cjs`: Covers config-ensure-section, config-set, config-get -- new defaults tests append here
- `tests/dispatcher.test.cjs`: Covers no-command, unknown command, --cwd parsing, subcommand routing -- new dispatch tests append here
- `get-shit-done/bin/lib/phase.cjs`: Exports `findFirstIncompletePhase(cwd)` and `nextIncompletePhase(cwd, currentPhase)` at lines 1002-1063
- `get-shit-done/bin/lib/verify.cjs`: Exports `getVerificationStatus(cwd, phaseDir)` and `getGapsSummary(cwd, phaseDir)` at lines 786-849
- `get-shit-done/bin/lib/config.cjs`: Exports `CONFIG_DEFAULTS` map (4 keys) and `cmdConfigGet` with fallback at lines 174-181
- `get-shit-done/scripts/autopilot.mjs`: 1116-line zx script supporting `--dry-run` mode

### Established Patterns
- All test files use `node:test` (`test`, `describe`, `beforeEach`, `afterEach`) with `node:assert`
- Test fixtures use `createTempProject()` for a temp dir with `.planning/phases/` structure, cleaned up in `afterEach`
- CLI-level tests use `runGsdTools('command args', tmpDir)` which returns `{ success, output, error }`
- JSON output parsed via `JSON.parse(result.output)` for structured assertions
- Test IDs referenced in file headers (e.g., `Requirements: TEST-13`) for traceability

### Integration Points
- `tests/phase.test.cjs`: Append new `describe('findFirstIncompletePhase')` and `describe('nextIncompletePhase')` blocks
- `tests/verify.test.cjs`: Append new `describe('getVerificationStatus')` and `describe('getGapsSummary')` blocks
- `tests/config.test.cjs`: Append new `describe('CONFIG_DEFAULTS fallback')` block
- `tests/dispatcher.test.cjs`: Append new `describe('phase find-next dispatch')` and `describe('verify status/gaps dispatch')` blocks
- `tests/autopilot.test.cjs`: New file for autopilot.mjs integration test

</code_context>

<deferred>
## Deferred Ideas

- Performance benchmarks for autopilot.mjs vs autopilot-legacy.sh (not a test requirement)
- End-to-end test with actual Claude CLI invocation (would require API access and is not in scope)
- Testing autopilot.mjs signal handling (SIGINT/SIGTERM) which requires process management that is fragile in test suites
- Testing autopilot.mjs TTY verification gate (requires TTY simulation not available in `node:test`)

</deferred>

---

*Phase: 51-tests*
*Context gathered: 2026-03-10 via auto-context*
