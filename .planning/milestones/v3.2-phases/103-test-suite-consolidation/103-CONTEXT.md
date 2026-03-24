# Phase 103: Test Suite Consolidation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Bring the test suite under the 800-test budget by pruning stale tests that reference deleted functions and promoting unit tests subsumed by integration tests. The audit identified 2 consolidation proposals (prune stale streaming tests, promote routeCommand unit tests) plus additional stale stdin redirect tests discovered during scouting. This is a gap closure phase -- code changes are limited to test file deletions and renames.

</domain>

<decisions>
## Implementation Decisions

### Stale Test Pruning (autopilot.test.cjs)
- Delete 5 failing tests in the `autopilot.mjs streaming functions (static analysis)` describe block that reference deleted `runClaudeStreaming` and `displayStreamEvent` functions: "runClaudeStreaming function exists", "displayStreamEvent function exists", "streaming path uses --output-format stream-json", "displayStreamEvent handles assistant events", "displayStreamEvent handles tool_use events" (from MILESTONE-AUDIT.md test_consolidation proposal 1)
- Retain the 5 passing tests in that block: "--quiet flag is in knownFlags", "QUIET constant is defined", "stall timer uses getConfig for timeout", "stall timer uses unref to prevent blocking exit", "runClaudeStreaming returns exitCode and stdout" (Claude's Decision: these assertions validate constructs that still exist in autopilot.mjs after SDK migration)
- Rename the describe block from `autopilot.mjs streaming functions (static analysis)` to `autopilot.mjs SDK functions (static analysis)` (from MILESTONE-AUDIT.md test_consolidation proposal 1)
- Rename test "runClaudeStreaming returns exitCode and stdout" to "runAgentStep returns exitCode and stdout" (Claude's Decision: the assertion is valid for the replacement function but the test name references the deleted function)

### Stale Stdin Redirect Test Fix (autopilot.test.cjs)
- Delete or fix the failing test "there are exactly 2 claude -p shell invocations" in the `autopilot.mjs stdin redirect (regression)` describe block -- the SDK migration removed all `claude -p` shell invocations so the expected count of 2 is wrong (Claude's Decision: this test is stale for the same reason as the streaming tests -- SDK replaced shell invocations)
- Delete the entire `autopilot.mjs stdin redirect (regression)` describe block (4 tests) since all tests in this block validate `claude -p` shell invocations that no longer exist after SDK migration (Claude's Decision: with zero shell invocations remaining, the "every invocation includes < /dev/null" and "count matches" tests are vacuously true and provide no value)

### Subsumed Unit Test Promotion (cli.test.cjs)
- Remove the 5 `routeCommand` unit tests that are subsumed by the `gsd-cli binary` integration tests: "routes progress to handler with real data", "routes todos to handler with structured data", "routes health to handler with structured data", "routes settings to handler", "routes help to handler with all command names" (from MILESTONE-AUDIT.md test_consolidation proposal 2)
- Retain "returns null for unknown command" since the integration test for unknown commands tests exit code 1, not the null return value from routeCommand (Claude's Decision: the null return path is only covered by this unit test)

### Budget Projection
- Current test count: 795 tests
- Pruning stale streaming tests: -5
- Pruning stale stdin redirect tests: -4
- Promoting subsumed routeCommand tests: -5
- Post-consolidation projection: 781 tests (97.6% of 800 budget)

### Claude's Discretion
- Whether to add a comment explaining why the retained tests are still valid post-SDK-migration
- Exact wording of renamed describe block and test names
- Whether to keep the routeCommand describe block header or remove it entirely after pruning

</decisions>

<specifics>
## Specific Ideas

- The audit identified 5 stale streaming tests but scouting found a 6th implicit stale group: the stdin redirect block (4 tests) validates `claude -p` shell invocations that were entirely removed during SDK migration -- zero `$\`` + `claude -p` lines remain in autopilot.mjs
- Test "runClaudeStreaming returns exitCode and stdout" passes coincidentally because `runAgentStep()` uses the same `return { exitCode, ... stdout }` pattern -- the test validates the right thing but has the wrong name
- The `routeCommand` unit tests duplicate coverage from integration tests: `gsd-cli binary` tests invoke the full binary with `execSync` and verify the same commands (progress, todos, health, settings, help) with deeper assertions on JSON output
- The retained routeCommand test ("returns null for unknown command") validates the library function's return value, which the integration test doesn't check (it checks exit code and stderr message instead)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/autopilot.test.cjs`: Contains the streaming describe block (lines 208-283) and stdin redirect block (lines 113-168) targeted for pruning
- `tests/cli.test.cjs`: Contains the routeCommand describe block (lines 155-201) targeted for promotion

### Established Patterns
- **Test parameterization**: Prior consolidation (Phase 70, Phase 97) used `for...of` loops with case arrays to reduce test count while preserving coverage
- **Static analysis test pattern**: Tests read source with `fs.readFileSync()` and assert on content patterns -- retained tests continue this pattern
- **Describe block organization**: Test files use section comments (`// ───`) and describe blocks to group related tests

### Integration Points
- `testing.cjs countTestsInProject()`: Counts tests by scanning `test(` and `it(` patterns -- test count change will be reflected automatically
- `gsd-tools.cjs audit-tests`: The test steward reads test files to detect redundancy -- removing stale tests eliminates false-positive redundancy reports
- Budget enforcement in `testing.cjs`: Project budget of 800 is checked by the hard test gate during execution

</code_context>

<deferred>
## Deferred Ideas

- Adding static analysis tests for new SDK constructs (runAgentStep, handleMessage, buildStepHooks, STEP_MCP_SERVERS, cumulativeCostUsd, TURNS_CONFIG) -- the audit noted this as a coverage gap but it is not part of the consolidation scope
- Further test parameterization to reduce count below 780 -- current projection of 781 is comfortably under budget

</deferred>

---

*Phase: 103-test-suite-consolidation*
*Context gathered: 2026-03-24 via auto-context*
