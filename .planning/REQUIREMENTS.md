# Requirements — v1.6 Dual-Layer Test Architecture

## Foundation

- [ ] **FOUND-01**: Config schema adds `test.*` section with `command`, `framework`, `hard_gate`, `acceptance_tests`, `budget`, and `steward` keys to config.json
- [ ] **FOUND-02**: `test-count` CLI command counts test cases (individual `it`/`test` blocks) across project, with `--phase` flag for per-phase counts
- [ ] **FOUND-03**: Test framework auto-detection from package.json or project files (Jest, Vitest, Mocha, node:test)
- [ ] **FOUND-04**: Fix 2 pre-existing test failures (codex-config, config) so hard gate can activate cleanly
- [ ] **FOUND-05**: `testing.cjs` module consolidates all test functions (counting, framework detection, config reading) with dispatcher integration

## Hard Gate

- [x] **GATE-01**: Post-commit test gate in execute-plan runs full test suite after each task commit
- [x] **GATE-02**: Test failure triggers existing deviation Rule 1 (debug/fix/retry) with human escalation after retries exhausted
- [x] **GATE-03**: TDD awareness: gate recognizes TDD RED commits (intentional failures) and skips regression check for that commit
- [x] **GATE-04**: Baseline capture: snapshot existing test state so hard gate only blocks on NEW failures, not pre-existing ones
- [x] **GATE-05**: Output summarization: test results condensed to pass/fail counts + failure details only, preventing context window bloat in executor

## Acceptance Tests (Layer 1)

- [x] **AT-01**: Discuss-phase gathers human-defined acceptance tests per requirement in Given/When/Then/Verify format
- [x] **AT-02**: Acceptance tests stored as `<acceptance_tests>` block in CONTEXT.md with AT-{NN} identifiers
- [x] **AT-03**: Verify-phase executes acceptance test Verify commands and maps results to verification truths
- [x] **AT-04**: Plan-checker verifies that plans cover all acceptance tests from CONTEXT.md
- [x] **AT-05**: AI cannot add, remove, or modify acceptance tests after discuss-phase approval (ownership invariant)

## Test Steward

- [ ] **STEW-01**: `gsd-test-steward` agent analyzes test suite health (redundancy, staleness, budget status) during audit-milestone
- [ ] **STEW-02**: Redundancy detection identifies duplicate assertions, overlapping coverage, and stale tests referencing deleted code
- [ ] **STEW-03**: Consolidation proposals with specific actions (parameterize, promote, prune, merge) requiring human approval
- [ ] **STEW-04**: Per-phase budget (default: 50) and project budget (default: 800) with configurable thresholds
- [ ] **STEW-05**: Planner receives budget status during plan-phase and plans tests within limits
- [ ] **STEW-06**: `/gsd:audit-tests` command for on-demand test suite health checks outside milestone audit

## Documentation

- [ ] **DOC-01**: help.md updated with test-related commands and configuration
- [ ] **DOC-02**: USER-GUIDE.md updated with test architecture usage guide
- [ ] **DOC-03**: README.md updated with test configuration section

## Future Requirements (Deferred)

- Auto-consolidation without human approval (steward.auto_consolidate remains false)
- Coverage percentage targets (code coverage tools integration)
- Visual test reports (HTML/dashboard output)
- Per-file test-to-code mapping
- Acceptance test generation in autopilot auto-mode (interactive-only for v1.6)

## Out of Scope

- Runtime sandboxing for test execution — shell commands run in project context
- Flaky test quarantine system — too complex for v1; retry-before-debug handles transient failures
- Test mutation analysis (Stryker) — AI-driven redundancy detection is simpler and sufficient
- Coverage enforcement gates — budget system handles growth; coverage % is a different concern

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FOUND-01 | Phase 30 | Pending |
| FOUND-02 | Phase 30 | Pending |
| FOUND-03 | Phase 30 | Pending |
| FOUND-04 | Phase 30 | Pending |
| FOUND-05 | Phase 30 | Pending |
| GATE-01 | Phase 31 | Complete |
| GATE-02 | Phase 31 | Complete |
| GATE-03 | Phase 31 | Complete |
| GATE-04 | Phase 31 | Complete |
| GATE-05 | Phase 31 | Complete |
| AT-01 | Phase 32 | Complete |
| AT-02 | Phase 32 | Complete |
| AT-03 | Phase 32 | Complete |
| AT-04 | Phase 32 | Complete |
| AT-05 | Phase 32 | Complete |
| STEW-01 | Phase 33 | Pending |
| STEW-02 | Phase 33 | Pending |
| STEW-03 | Phase 33 | Pending |
| STEW-04 | Phase 33 | Pending |
| STEW-05 | Phase 33 | Pending |
| STEW-06 | Phase 33 | Pending |
| DOC-01 | Phase 34 | Pending |
| DOC-02 | Phase 34 | Pending |
| DOC-03 | Phase 34 | Pending |
