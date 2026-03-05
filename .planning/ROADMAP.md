# Roadmap: GSD Autopilot

## Milestones

- ✅ **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- ✅ **v1.1 Remove Git Tagging** — Phases 8-9 (shipped 2026-03-03)
- ✅ **v1.2 Add Milestone Audit Loop** — Phases 10-13 (shipped 2026-03-03)
- ✅ **v1.3 CLI Utilities** — Phases 14-19 (shipped 2026-03-03)
- ✅ **v1.4 Linear Integration** — Phases 20-24 (shipped 2026-03-03)
- ✅ **v1.5 GSD Brainstorming Command** — Phases 25-29 (shipped 2026-03-04)
- [ ] **v1.6 Dual-Layer Test Architecture** — Phases 30-34

## Phases

<details>
<summary>✅ v1.0 GSD Autopilot (Phases 1-7) — SHIPPED 2026-03-02</summary>

- [x] Phase 1: Core Loop Infrastructure (3/3 plans) — completed 2026-03-02
- [x] Phase 2: Auto-Context Generation (2/2 plans) — completed 2026-03-02
- [x] Phase 3: Verification Gates (2/2 plans) — completed 2026-03-02
- [x] Phase 4: Failure Handling (2/2 plans) — completed 2026-03-02
- [x] Phase 5: Fix Autopilot Wiring Bugs (1/1 plan) — completed 2026-03-02 (Gap Closure)
- [x] Phase 6: Verify Phase 4 Implementation (1/1 plan) — completed 2026-03-02 (Gap Closure)
- [x] Phase 7: Fix Gap-Path Verify & Fix Cycle (1/1 plan) — completed 2026-03-02 (Gap Closure)

</details>

<details>
<summary>✅ v1.1 Remove Git Tagging (Phases 8-9) — SHIPPED 2026-03-03</summary>

- [x] Phase 8: Remove Git Tagging (2/2 plans) — completed 2026-03-02
- [x] Phase 9: Fix Residual Tag References (1/1 plan) — completed 2026-03-03 (Gap Closure)

</details>

<details>
<summary>✅ v1.2 Add Milestone Audit Loop (Phases 10-13) — SHIPPED 2026-03-03</summary>

- [x] Phase 10: Audit Trigger and Routing (1/1 plan) — completed 2026-03-03
- [x] Phase 11: Gap Closure Loop (1/1 plan) — completed 2026-03-03
- [x] Phase 12: Milestone Completion (1/1 plan) — completed 2026-03-03
- [x] Phase 13: Verify Phase 12 Milestone Completion (1/1 plan) — completed 2026-03-03 (Gap Closure)

</details>

<details>
<summary>✅ v1.3 CLI Utilities (Phases 14-19) — SHIPPED 2026-03-03</summary>

- [x] Phase 14: CLI Infrastructure (2/2 plans) — completed 2026-03-03
- [x] Phase 15: Progress Command (1/1 plan) — completed 2026-03-03
- [x] Phase 16: Todos Command (1/1 plan) — completed 2026-03-03
- [x] Phase 17: Health Command (1/1 plan) — completed 2026-03-03
- [x] Phase 18: Settings and Help Commands (2/2 plans) — completed 2026-03-03
- [x] Phase 19: Close Audit Gaps (2/2 plans) — completed 2026-03-03 (Gap Closure)

</details>

<details>
<summary>✅ v1.4 Linear Integration (Phases 20-24) — SHIPPED 2026-03-03</summary>

- [x] Phase 20: Foundation (1/1 plan) — completed 2026-03-04
- [x] Phase 21: Core Workflow (1/1 plan) — completed 2026-03-04
- [x] Phase 22: Completion Loop (1/1 plan) — completed 2026-03-04
- [x] Phase 23: Documentation (1/1 plan) — completed 2026-03-04
- [x] Phase 24: Close Audit Gaps (1/1 plan) — completed 2026-03-04 (Gap Closure)

</details>

<details>
<summary>✅ v1.5 GSD Brainstorming Command (Phases 25-29) — SHIPPED 2026-03-04</summary>

- [x] Phase 25: Command Spec and Workflow Foundation (1/1 plan) — completed 2026-03-04
- [x] Phase 26: Design Presentation and Output (1/1 plan) — completed 2026-03-04
- [x] Phase 27: GSD Routing Integration (1/1 plan) — completed 2026-03-04
- [x] Phase 28: Documentation (1/1 plan) — completed 2026-03-04
- [x] Phase 29: Close Audit Gaps (1/1 plan) — completed 2026-03-04 (Gap Closure)

</details>

### v1.6 Dual-Layer Test Architecture

- [x] **Phase 30: Foundation** - Config schema, testing.cjs module, test counting CLI, framework detection, fix pre-existing failures (completed 2026-03-05)
- [ ] **Phase 31: Hard Test Gate** - Post-commit gate in execute-plan, TDD awareness, baseline capture, output summarization
- [ ] **Phase 32: Acceptance Test Layer** - Discuss-phase AT gathering, CONTEXT.md storage, verify-phase execution, plan-checker coverage, ownership invariant
- [ ] **Phase 33: Test Steward** - Suite health agent, redundancy detection, consolidation proposals, budget enforcement, planner integration, audit-tests command
- [ ] **Phase 34: Documentation** - help.md, USER-GUIDE.md, README.md updates for test architecture

## Phase Details

### Phase 30: Foundation
**Goal**: All test infrastructure has a working data layer -- config is readable, tests are countable, frameworks are detected, and the existing suite passes cleanly
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. Running `gsd test-count` reports the number of test cases in the project, and `gsd test-count --phase N` reports per-phase counts
  2. Config.json accepts `test.*` keys (command, framework, hard_gate, acceptance_tests, budget, steward) with zero-config degradation when absent
  3. Running the test suite produces zero failures -- the 2 pre-existing failures in codex-config and config are fixed
  4. Framework auto-detection correctly identifies the test runner from package.json without manual configuration
  5. All test functions (counting, detection, config reading) are consolidated in a single `testing.cjs` module accessible via the gsd-tools dispatcher
**Plans:** 2/2 plans complete
Plans:
- [ ] 30-01-PLAN.md — Create testing.cjs module, config defaults, dispatcher/CLI wiring, and tests
- [ ] 30-02-PLAN.md — Fix 2 pre-existing test failures (codex-config agent count, config-get user defaults)

### Phase 31: Hard Test Gate
**Goal**: Every task commit during execute-plan is verified against the full test suite -- regressions are caught immediately, TDD workflows are preserved, and test output does not consume the executor's context window
**Depends on**: Phase 30 (config schema, testing.cjs, clean baseline)
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05
**Success Criteria** (what must be TRUE):
  1. After each task commit during execute-plan, the full test suite runs automatically and blocks the next task if any new test fails
  2. When a test failure is detected, the executor follows existing deviation Rule 1 (debug/fix/retry) and escalates to human after retries exhausted
  3. A TDD RED commit (intentional test failure) does not trigger the hard gate -- the gate recognizes the commit convention and skips regression checking
  4. The gate only blocks on NEW failures by comparing against a captured baseline, not on pre-existing known failures
  5. Test output shown to the executor is summarized to pass/fail counts and failure details only, not the full raw output
**Plans**: TBD

### Phase 32: Acceptance Test Layer
**Goal**: Humans define executable acceptance criteria during discuss-phase that the AI works against -- these criteria are stored, tracked, verified, and protected from AI modification throughout the phase lifecycle
**Depends on**: Phase 30 (config schema for acceptance_tests toggle)
**Requirements**: AT-01, AT-02, AT-03, AT-04, AT-05
**Success Criteria** (what must be TRUE):
  1. During discuss-phase, the user is prompted to define acceptance tests in Given/When/Then/Verify format for each requirement
  2. Acceptance tests appear in CONTEXT.md inside an `<acceptance_tests>` block with AT-{NN} identifiers that persist through plan and execute phases
  3. During verify-phase, each acceptance test's Verify command is executed and the result maps to a verification truth (pass/fail with evidence)
  4. Plan-checker validates that plans cover all acceptance tests from CONTEXT.md -- missing coverage is flagged before execution begins
  5. AI cannot add, remove, or modify acceptance tests after discuss-phase approval -- the ownership invariant is enforced in plan and execute workflows
**Plans**: TBD

### Phase 33: Test Steward
**Goal**: Long-term test suite health is actively managed -- redundancy is detected, budgets are enforced, consolidation is proposed (not auto-applied), and the planner is budget-aware
**Depends on**: Phase 30 (counting, detection, budget functions), Phase 31 (test data from gate runs)
**Requirements**: STEW-01, STEW-02, STEW-03, STEW-04, STEW-05, STEW-06
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:audit-tests` produces a test health report covering redundancy, staleness, and budget status without requiring a full milestone audit
  2. During audit-milestone, the gsd-test-steward agent is spawned and its findings appear in the audit results
  3. The steward identifies duplicate assertions, overlapping test coverage, and stale tests referencing deleted code -- with specific consolidation proposals (parameterize, promote, prune, merge) that require human approval
  4. Per-phase budget (default: 50) and project budget (default: 800) are tracked, and budget overruns are surfaced as warnings during plan-phase and audit
  5. During plan-phase, the planner receives current budget status and generates test plans within the remaining budget allocation
**Plans**: TBD

### Phase 34: Documentation
**Goal**: All test architecture features are documented for users -- configuration, commands, workflows, and the dual-layer testing model are explained with examples
**Depends on**: Phase 30, Phase 31, Phase 32, Phase 33 (documents what was built)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. help.md includes test-count command reference, audit-tests command reference, and test.* configuration keys
  2. USER-GUIDE.md contains a test architecture usage guide explaining both layers (acceptance tests and unit/regression tests), the hard gate, the steward, and budget management
  3. README.md includes a test configuration section showing how to enable and configure the dual-layer test system
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Loop Infrastructure | v1.0 | 3/3 | Complete | 2026-03-02 |
| 2. Auto-Context Generation | v1.0 | 2/2 | Complete | 2026-03-02 |
| 3. Verification Gates | v1.0 | 2/2 | Complete | 2026-03-02 |
| 4. Failure Handling | v1.0 | 2/2 | Complete | 2026-03-02 |
| 5. Fix Autopilot Wiring Bugs | v1.0 | 1/1 | Complete | 2026-03-02 |
| 6. Verify Phase 4 Implementation | v1.0 | 1/1 | Complete | 2026-03-02 |
| 7. Fix Gap-Path Verify & Fix Cycle | v1.0 | 1/1 | Complete | 2026-03-02 |
| 8. Remove Git Tagging | v1.1 | 2/2 | Complete | 2026-03-02 |
| 9. Fix Residual Tag References | v1.1 | 1/1 | Complete | 2026-03-03 |
| 10. Audit Trigger and Routing | v1.2 | 1/1 | Complete | 2026-03-03 |
| 11. Gap Closure Loop | v1.2 | 1/1 | Complete | 2026-03-03 |
| 12. Milestone Completion | v1.2 | 1/1 | Complete | 2026-03-03 |
| 13. Verify Phase 12 Milestone Completion | v1.2 | 1/1 | Complete | 2026-03-03 |
| 14. CLI Infrastructure | v1.3 | 2/2 | Complete | 2026-03-03 |
| 15. Progress Command | v1.3 | 1/1 | Complete | 2026-03-03 |
| 16. Todos Command | v1.3 | 1/1 | Complete | 2026-03-03 |
| 17. Health Command | v1.3 | 1/1 | Complete | 2026-03-03 |
| 18. Settings and Help Commands | v1.3 | 2/2 | Complete | 2026-03-03 |
| 19. Close Audit Gaps | v1.3 | 2/2 | Complete | 2026-03-03 |
| 20. Foundation | v1.4 | 1/1 | Complete | 2026-03-04 |
| 21. Core Workflow | v1.4 | 1/1 | Complete | 2026-03-04 |
| 22. Completion Loop | v1.4 | 1/1 | Complete | 2026-03-04 |
| 23. Documentation | v1.4 | 1/1 | Complete | 2026-03-04 |
| 24. Close Audit Gaps | v1.4 | 1/1 | Complete | 2026-03-04 |
| 25. Command Spec and Workflow Foundation | v1.5 | 1/1 | Complete | 2026-03-04 |
| 26. Design Presentation and Output | v1.5 | 1/1 | Complete | 2026-03-04 |
| 27. GSD Routing Integration | v1.5 | 1/1 | Complete | 2026-03-04 |
| 28. Documentation | v1.5 | 1/1 | Complete | 2026-03-04 |
| 29. Close Audit Gaps | v1.5 | 1/1 | Complete | 2026-03-04 |
| 30. Foundation | 2/2 | Complete   | 2026-03-05 | - |
| 31. Hard Test Gate | v1.6 | 0/0 | Not started | - |
| 32. Acceptance Test Layer | v1.6 | 0/0 | Not started | - |
| 33. Test Steward | v1.6 | 0/0 | Not started | - |
| 34. Documentation | v1.6 | 0/0 | Not started | - |
