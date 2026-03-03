# Phase 19: Close Audit Gaps - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Close all documentation and test gaps identified by the v1.3 milestone audit so all 23 requirements reach "satisfied" status. This phase performs four targeted fixes: (1) add `requirements-completed` frontmatter to Phase 14 SUMMARY files listing CLI-01 through CLI-06, (2) create Phase 17 VERIFICATION.md confirming HLTH-01 through HLTH-04, (3) add `requirements-completed` frontmatter to Phase 18 SUMMARY files listing SETT-01-03 and HELP-01-02, and (4) add an automated test for the `--area` flag on `gsd todos` (TODO-02). No new features or code logic changes -- this is documentation debt and one test gap.

</domain>

<decisions>
## Implementation Decisions

### Phase 14 SUMMARY Frontmatter (Gap 1)
- Add `requirements-completed` field to `14-01-SUMMARY.md` frontmatter listing: CLI-01, CLI-02, CLI-04, CLI-05, CLI-06 (from audit evidence: these are the requirements addressed in Plan 01's body text)
- Add `requirements-completed` field to `14-02-SUMMARY.md` frontmatter listing: CLI-03 (from audit evidence: Plan 02 addresses CLI-03 routing)
- Follow the exact YAML list format established in Phase 15 and 16 SUMMARYs: `requirements-completed:` followed by indented `- REQ-ID` entries (from established pattern in 15-01-SUMMARY.md and 16-01-SUMMARY.md)
- Both SUMMARY files currently use a simpler frontmatter schema (no `subsystem`, `tags`, `requires`, `provides`, etc.) -- add only the `requirements-completed` field without restructuring the rest of the frontmatter (Claude's Decision: minimal change reduces risk; the audit only requires the requirements-completed field to be present)

### Phase 17 VERIFICATION.md (Gap 2)
- Create `17-VERIFICATION.md` in `.planning/phases/17-health-command/` following the same format as the existing Phase 16, 14, and 18 VERIFICATION files
- Include YAML frontmatter with `phase: 17`, `status: passed`, `verified: 2026-03-03`
- Include a goal statement, success criteria table, requirements coverage table, must-haves verification checklist, and test results section (from established VERIFICATION.md pattern in Phases 14, 16, 18)
- Content drawn from the existing `17-01-SUMMARY.md` which already documents all HLTH-01 through HLTH-04 as completed with 17 tests passing, plus the Phase 18 VERIFICATION which reports 17 handleHealth tests passing
- The SUMMARY already has `requirements-completed` listing HLTH-01 through HLTH-04 -- the gap is only the missing VERIFICATION.md file (from audit: "No VERIFICATION.md for Phase 17; SUMMARY frontmatter lists requirement as completed")

### Phase 18 SUMMARY Frontmatter (Gap 3)
- Add `requirements-completed` field to `18-01-SUMMARY.md` frontmatter listing: SETT-01, SETT-02, SETT-03 (from audit evidence and SUMMARY body text which already lists these requirements)
- Add `requirements-completed` field to `18-02-SUMMARY.md` frontmatter listing: HELP-01, HELP-02 (from audit evidence and SUMMARY body text which already lists these requirements)
- Both SUMMARY files currently use a minimal frontmatter schema (phase, plan, title, status, started, completed) -- add only the `requirements-completed` field (Claude's Decision: same minimal-change approach as Phase 14 fix)

### TODO-02 Automated Test (Gap 4)
- Add an integration test in `tests/cli.test.cjs` that invokes the CLI binary with `todos --area=<value> --json` and verifies filtered results (from audit: "TODO-02 area filter: no automated test for --area flag path")
- Test should use `execSync` to call `node gsd-cli.cjs todos --area=<value> --json` against the real project directory, matching the existing integration test pattern for `todos --json` (from established pattern in cli.test.cjs line 251-257)
- Verify that the returned JSON has `command: "todos"` and that every item in the `todos` array has the expected area value (Claude's Decision: asserts both the filtering mechanism and the JSON output shape, covering the end-to-end path)
- Use an area value that exists in the project's actual `.planning/todos/pending/` directory, or create a temp directory fixture with controlled todo files (Claude's Decision: using a temp directory with controlled fixtures is more reliable than depending on project state, and matches the unit test pattern already used in the handleTodos test suite)

### Claude's Discretion
- Exact wording of verification evidence strings in the Phase 17 VERIFICATION.md
- Order of must-haves checklist items in VERIFICATION.md
- Exact test description string for the new TODO-02 test
- Whether the TODO-02 integration test uses the real project directory or a temp fixture directory

</decisions>

<specifics>
## Specific Ideas

- The audit report (`v1.3-MILESTONE-AUDIT.md`) explicitly identifies all four gaps with root causes: SUMMARY frontmatter missing `requirements_completed` in Phases 14 and 18, Phase 17 missing VERIFICATION.md entirely, and no automated test for the `--area` CLI flag path
- Phase 15 (`15-01-SUMMARY.md`) and Phase 16 (`16-01-SUMMARY.md`) demonstrate the correct `requirements-completed` frontmatter format -- a YAML list under `requirements-completed:` key
- Phase 14 SUMMARY files use a simpler frontmatter schema without `subsystem`, `tags`, `requires`, `provides` -- the fix should add only the missing field, not restructure the entire frontmatter
- Phase 18 SUMMARY files use an even simpler frontmatter schema (just phase, plan, title, status, started, completed) -- same minimal-addition approach
- Phase 17 SUMMARY already has `requirements-completed` listing HLTH-01 through HLTH-04 in its frontmatter, so the SUMMARY is correct -- only the VERIFICATION.md is missing
- The existing `handleTodos` integration test (`todos --json returns valid JSON with count and todos array`) tests the list path but not the `--area` filter path
- The `handleTodos` function parses `--area` from `process.argv` directly (not from `parseArgs`), which means an integration test calling the binary with `--area=X` is the only way to exercise this code path end-to-end

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/phases/15-progress-command/15-01-SUMMARY.md`: Reference for correct `requirements-completed` frontmatter format (YAML list with `- REQ-ID` entries)
- `.planning/phases/16-todos-command/16-VERIFICATION.md`: Reference for VERIFICATION.md format (frontmatter, goal, requirement table, success criteria table, must-haves, test results, result)
- `.planning/phases/14-cli-infrastructure/14-VERIFICATION.md`: Another VERIFICATION.md reference with requirement verification table and success criteria verification
- `.planning/phases/18-settings-and-help-commands/18-VERIFICATION.md`: Reference showing test count breakdown by suite
- `.planning/phases/17-health-command/17-01-SUMMARY.md`: Source of truth for Phase 17 accomplishments, test counts (17 tests), and requirement completion claims
- `tests/cli.test.cjs`: Existing test suite with integration test patterns using `execSync` against the CLI binary

### Established Patterns
- SUMMARY frontmatter `requirements-completed`: YAML list format, one requirement ID per line with `- ` prefix
- VERIFICATION.md: YAML frontmatter (phase, status, verified), followed by goal, requirement coverage table, success criteria table, must-haves checklist, test results, and final result verdict
- Integration tests: `execSync(node "${cliPath}" <args>, { cwd: projectRoot, encoding: 'utf-8' })` pattern with JSON parsing for `--json` mode tests
- Unit tests for handleTodos: use temp directories with controlled fixture todo files, `beforeEach`/`afterEach` cleanup

### Integration Points
- `.planning/phases/14-cli-infrastructure/14-01-SUMMARY.md`: Add `requirements-completed` to existing frontmatter
- `.planning/phases/14-cli-infrastructure/14-02-SUMMARY.md`: Add `requirements-completed` to existing frontmatter
- `.planning/phases/17-health-command/17-VERIFICATION.md`: New file (does not exist yet)
- `.planning/phases/18-settings-and-help-commands/18-01-SUMMARY.md`: Add `requirements-completed` to existing frontmatter
- `.planning/phases/18-settings-and-help-commands/18-02-SUMMARY.md`: Add `requirements-completed` to existing frontmatter
- `tests/cli.test.cjs`: Add new test case in the `gsd-cli binary` integration test suite or the `handleTodos` unit test suite

</code_context>

<deferred>
## Deferred Ideas

- The 2 pre-existing test failures in unrelated modules (codex-config.test.cjs, config.test.cjs) are noted by the audit as "not caused by v1.3" and are not in scope for this gap closure phase
- Restructuring Phase 14 and 18 SUMMARY frontmatter to match the richer schema used by Phases 15-17 (with `subsystem`, `tags`, `requires`, `provides`, `affects`, `patterns-established`) -- not required by the audit, would be a formatting consistency improvement for a future pass

</deferred>

---

*Phase: 19-close-audit-gaps*
*Context gathered: 2026-03-03 via auto-context*
