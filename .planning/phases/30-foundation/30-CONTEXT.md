# Phase 30: Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the test infrastructure data layer for the GSD framework. Config reads `test.*` keys, tests are countable across arbitrary user projects, frameworks are auto-detected, and the GSD codebase's own test suite passes cleanly. This is framework infrastructure — it must work in any project that uses GSD, not just this codebase.

</domain>

<decisions>
## Implementation Decisions

### Test counting method
- Claude's discretion on the counting approach (source parsing vs output parsing vs hybrid), as long as it works across Jest, Vitest, Mocha, and node:test projects
- Best-effort counting for unsupported frameworks — most use it()/test() syntax, so attempt regex counting even for unrecognized frameworks
- Phase-to-test mapping: tests live in the project's source tree, `.planning/` only tracks references (via PLAN.md or CONTEXT.md links to test file paths). Tests must NEVER be placed in `.planning/` directory

### Framework auto-detection
- Detect from both package.json (devDependencies/dependencies) AND config files (jest.config.js, vitest.config.ts, .mocharc.yml, etc.)
- Cover monorepos and projects that don't list test deps in package.json

### Config schema defaults
- `test.hard_gate`: default **true** — projects with tests get immediate regression protection
- `test.acceptance_tests`: default **true** — acceptance tests prompted during discuss-phase by default
- `test.budget.per_phase`: default **50**
- `test.budget.project`: default **800**
- `test.steward`: default **true** — runs during audit-milestone automatically
- `test.command`: auto-detected, no default required
- `test.framework`: auto-detected, no default required
- All test.* keys support zero-config degradation — absent keys are treated as defaults

### Error handling
- Auto-detected config degrades gracefully: missing package.json, no test files, or no recognized framework → return zero counts with a warning, GSD continues working
- Explicitly configured settings error if broken: if user sets test.command and it fails to execute → error with command output so they can fix it
- Unsupported frameworks get best-effort counting (most use it()/test() syntax)

### Pre-existing test failures
- Fix the 2 known failures (codex-config expects 11 agents → update to 12; config expects 'balanced' → fix test to handle project-level config) — straightforward assertion updates

### Claude's Discretion
- Specific counting implementation approach (source parsing, output parsing, or hybrid)
- Whether project-level budget summary appears in `gsd test-count` output (without --phase)
- Internal module structure of testing.cjs
- Config file scanning patterns for framework detection

</decisions>

<specifics>
## Specific Ideas

- "This is an agent framework to build in other codebases. We shouldn't design this TDD approach tailored to this codebase." — All test infrastructure must be project-agnostic
- `.planning/` is rarely checked into source control — tests must live in the project's source tree, with `.planning/` only tracking references

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config.cjs`: cmdConfigGet/cmdConfigSet with dot-notation — testing.cjs config reading should use or mirror this pattern
- `cli.cjs`: routeCommand + COMMANDS object — `test-count` CLI command plugs in here
- `core.cjs`: output()/error() helpers — testing.cjs should use these for consistent output
- `run-tests.cjs`: existing test runner using node:test — reference for how tests are executed in this codebase

### Established Patterns
- All lib modules follow the same structure: exported cmd* functions, core.cjs output/error for IO
- gsd-tools.cjs dispatcher integrates all lib modules — testing.cjs follows this pattern
- CLI supports rich/plain/json output modes via --json and --plain flags
- Config uses dot-notation for nested keys (e.g., workflow.research)

### Integration Points
- `gsd-tools.cjs`: Add `testing.cjs` as a new require + route test-* commands through dispatcher
- `gsd-cli.cjs`: Add `test-count` to COMMANDS routing table
- `config.cjs`: cmdConfigEnsureSection needs to include test.* defaults when creating new configs
- Existing 15 test files in tests/ — 555 tests, 2 failing

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-foundation*
*Context gathered: 2026-03-05*
