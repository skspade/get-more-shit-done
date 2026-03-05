# Dual-Layer Test Architecture for GSD — Design

**Date:** 2026-03-05
**Approach:** Dual-Layer Test Architecture

## Acceptance Test Layer (Layer 1 — Human-Owned)

### Purpose
Human-defined acceptance tests that serve as the executable specification for each phase. Written during `discuss-phase`, stored in CONTEXT.md, and executed as hard gates before a phase can complete.

### Where Tests Are Defined
During `discuss-phase`, the workflow already captures decisions and acceptance criteria. This design adds a structured `<acceptance_tests>` block to CONTEXT.md:

```markdown
<acceptance_tests>
## Acceptance Tests

### AT-01: User can create a new project
- Given: No .planning/ directory exists
- When: User runs /gsd:new-project
- Then: .planning/PROJECT.md is created with project name and core value
- Verify: `test -f .planning/PROJECT.md && grep -q "Core Value" .planning/PROJECT.md`

### AT-02: State file tracks progress
- Given: A milestone is in progress
- When: A plan completes execution
- Then: STATE.md progress bar updates to reflect completed plans
- Verify: `node gsd-tools.cjs state update-progress && grep "Progress:" .planning/STATE.md`
</acceptance_tests>
```

### Format
Each acceptance test follows Given/When/Then with a `Verify` line containing a shell command or test runner invocation. The human writes the Given/When/Then (the *what*). The `Verify` line can be human-written or AI-suggested-and-approved during discuss-phase.

### Ownership Rule
- **Human writes:** Test name, Given/When/Then (the business spec)
- **AI may suggest:** `Verify` commands, but human must approve during discuss-phase
- **AI may NOT:** Add, remove, or modify acceptance tests after discuss-phase approval

### Integration with discuss-phase
The discuss-phase workflow adds a new question pass after existing decision gathering:

1. Present extracted requirements for the phase
2. For each requirement, ask: "What observable behavior proves this works?"
3. Structure responses into AT-{NN} format
4. Present full acceptance test list for approval before writing CONTEXT.md

## Unit/Regression Test Layer (Layer 2 — AI-Owned)

### Purpose
AI-generated unit tests that cover implementation details, edge cases, and regression prevention. Created during `plan-phase`, run continuously during execution, and managed for bloat by the test steward.

### When Tests Are Created
The `gsd-planner` agent generates test specs as part of each PLAN.md. For every task with testable logic, the planner produces a `<tests>` block:

```markdown
<task id="3" name="Create state parser" type="auto" tdd="true">
  <tests>
  - test: "parses valid STATE.md frontmatter"
    input: valid STATE.md content
    expected: parsed object with milestone, status, progress fields
  - test: "returns error for missing frontmatter"
    input: STATE.md without --- delimiters
    expected: error with descriptive message
  - test: "handles empty progress fields"
    input: STATE.md with null progress values
    expected: default values (0/0)
  </tests>
  ...
</task>
```

### Execution Model
When `execute-plan` encounters a `tdd="true"` task (which becomes the default for any task with a `<tests>` block):

1. **RED:** Write test from spec -> run -> must fail (confirms test is real)
2. **GREEN:** Implement -> run -> must pass
3. **Regression:** Run full project test suite -> all must pass (hard gate)

Step 3 is the key addition — today, TDD tasks only verify their own tests pass. The regression gate ensures new code doesn't break existing tests.

### What AI Owns
- Test implementation (translating specs into framework-specific test code)
- Edge case discovery (AI suggests additional tests beyond what planner specified)
- Test file placement (following project conventions discovered via `add-tests` classification)

### What AI Does NOT Own
- Acceptance test content (Layer 1 — human only)
- Test removal (only the test steward can remove/consolidate, with human approval)
- Skipping test failures (hard gate — no `--force` to bypass)

### Hard Gate Enforcement
In `execute-plan`, after each task commit:

```bash
# Run project test suite (discovered during plan-phase)
TEST_CMD=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get test.command)
eval "$TEST_CMD"
if [ $? -ne 0 ]; then
  echo "HARD GATE: Test suite failed after task ${TASK_NUM}"
  # Trigger debug-first failure handling (existing deviation Rule 1)
fi
```

If tests fail, the executor applies Rule 1 (Bug) deviation handling — debug, fix, re-run. If debug retries are exhausted, escalate to human.

## Test Steward Agent

### Purpose
A specialized agent (`gsd-test-steward`) that manages test suite health — consolidating redundant tests, enforcing budgets, and preventing bloat. Runs at milestone audit time and can be invoked manually.

### When It Runs
1. **Automatically:** During `audit-milestone`, after phase verifications are collected and before the final audit report
2. **Manually:** Via `/gsd:audit-tests` (new command) for on-demand suite health checks
3. **Advisory:** During `plan-phase`, the planner receives the current test budget status so it can plan tests within limits

### What It Does

**1. Test Budget Enforcement**
Each phase has a test budget defined in config.json:

```json
{
  "test": {
    "command": "npm test",
    "budget": {
      "max_tests_per_phase": 30,
      "max_total_tests": 200,
      "warn_at_percentage": 80
    }
  }
}
```

The steward counts tests per phase and total. When a phase plan would exceed the budget, the planner is informed and must either consolidate or justify the overage.

**2. Redundancy Detection**
The steward analyzes test files for:
- Duplicate assertions (same function, same inputs, different test names)
- Overlapping coverage (integration test that covers what 3 unit tests already test)
- Stale tests (test references functions/files that no longer exist)

**3. Consolidation Proposals**
When redundancy is found, the steward produces a consolidation report:

```markdown
## Test Consolidation Proposal

### Redundant (3 tests -> 1)
- `state.test.cjs:45` and `state.test.cjs:62` and `state.test.cjs:78` all test `parseState()` with valid input
- **Proposal:** Keep `state.test.cjs:45` (most comprehensive), remove others

### Stale (2 tests)
- `config.test.cjs:120` references `loadLegacyConfig()` which was removed in phase 15
- **Proposal:** Delete test

### Over-budget (Phase 18: 35/30)
- **Proposal:** Merge 3 edge-case tests into parameterized test, consolidate 2 overlapping integration tests
```

**4. Human Approval Required**
The steward NEVER auto-deletes or auto-modifies tests. It produces proposals that require human approval (consistent with the "don't let AI fully own your tests" principle).

### Agent Specification
- **Model:** Same as plan-checker (verification-class work)
- **Input:** Test file paths, test budget config, coverage data (if available)
- **Output:** Consolidation report with specific proposals
- **Constraint:** Read-only analysis — no file modifications without human approval

## Workflow Integration Points

### Purpose
Map exactly which existing workflows change and how, to implement the dual-layer test architecture without breaking the current phase lifecycle.

### Workflow Changes

| Workflow | Change | Scope |
|----------|--------|-------|
| `discuss-phase.md` | Add acceptance test gathering pass after decision gathering | New step |
| `plan-phase.md` | Planner receives test budget; generates `<tests>` blocks in tasks | Modified prompt |
| `execute-plan.md` | Hard test gate after each task; regression suite run after task commits | New step in `execute` |
| `verify-phase.md` | Run acceptance tests (Layer 1) as verification truths; report pass/fail | Modified `verify_truths` |
| `audit-milestone.md` | Spawn test steward; include test health in audit report | New step before report |
| `add-tests.md` | Becomes "fill gaps" — generates Layer 2 tests for phases that were planned before this design existed | Modified purpose |

### New Artifacts

| Artifact | Location | Created By | Consumed By |
|----------|----------|------------|-------------|
| `<acceptance_tests>` in CONTEXT.md | Phase dir | discuss-phase (human) | verify-phase, execute-plan |
| `<tests>` blocks in PLAN.md | Phase dir | plan-phase (AI) | execute-plan |
| Test budget config | `config.json` | User/settings | plan-phase, test steward |
| Test health report | Audit file | test steward | audit-milestone |

### New Config Keys

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

### Backward Compatibility
- Projects without `test.command` in config: test gates are skipped with a warning ("No test command configured — test gates inactive")
- Phases with no `<acceptance_tests>` in CONTEXT.md: verification falls back to current behavior (grep/file-existence)
- Plans without `<tests>` blocks: execute as today (no TDD enforcement for that task)
- This means existing projects continue working unchanged until they opt in

## Execution Flow End-to-End

### Purpose
Show the complete lifecycle of a phase under the new dual-layer test architecture, from discuss through audit.

### Flow

```
discuss-phase
  |
  +- Gather decisions (existing)
  +- NEW: Gather acceptance tests from human
  |   +- Present requirements
  |   +- Ask "What proves this works?" per requirement
  |   +- Write <acceptance_tests> to CONTEXT.md
  |
  +- CONTEXT.md (with acceptance tests)

plan-phase
  |
  +- Researcher reads CONTEXT.md + acceptance tests (existing)
  +- Planner generates plans (existing)
  |   +- NEW: Each testable task gets <tests> block
  |   +- NEW: Planner checks test budget before generating
  +- Plan-checker verifies (existing)
  |   +- NEW: Checks that acceptance tests are covered by plan tasks
  |
  +- PLAN.md files (with test specs)

execute-phase
  |
  +- Per task:
  |   +- If tdd="true": RED -> GREEN -> REFACTOR (existing)
  |   +- NEW: Run full test suite after task commit (hard gate)
  |   |   +- Pass -> continue
  |   |   +- Fail -> Rule 1 deviation (debug/fix/retry)
  |   |       +- Exhausted -> escalate to human
  |   +- Commit (existing)
  |
  +- SUMMARY.md (with test results)

verify-phase
  |
  +- Establish must-haves (existing)
  +- NEW: Execute acceptance tests from CONTEXT.md
  |   +- Run each AT-{NN} Verify command
  |   +- Map results to truths (AT passes -> truth VERIFIED)
  |   +- Any AT failure -> gaps_found
  +- Verify artifacts + wiring (existing)
  |
  +- VERIFICATION.md (with acceptance test results)

audit-milestone
  |
  +- Collect phase verifications (existing)
  +- NEW: Spawn test steward
  |   +- Count tests per phase vs budget
  |   +- Detect redundancy
  |   +- Produce consolidation proposals
  |   +- Report test suite health
  +- Integration checker (existing)
  |
  +- MILESTONE-AUDIT.md (with test health section)
```

### Key Invariants
1. **No phase completes without all existing tests passing** (hard gate in execute-plan)
2. **No acceptance test is added/modified/removed by AI** (human-owned in CONTEXT.md)
3. **No test is deleted without human approval** (steward proposes, human approves)
4. **Backward compatible** — all gates degrade gracefully when test config is absent

## Test Budget & Bloat Management

### Purpose
Prevent unbounded test growth while ensuring adequate coverage. Define the budget model, enforcement points, and escalation paths.

### Budget Model

Tests are budgeted at two levels:

**Per-Phase Budget:** `max_tests_per_phase` (default: 30)
- Counts test cases (individual `it`/`test` blocks), not test files
- Planner receives current count during plan-phase and plans within budget
- If a phase genuinely needs more tests, planner must include a justification in the plan

**Project Budget:** `max_total_tests` (default: 200)
- Total test cases across all phases
- Warning at `warn_at_percentage` (default: 80%) — planner sees "Warning: 160/200 tests used"
- At 100%, steward must run consolidation before new tests can be added

### Counting Mechanism

```bash
# Count test cases (not files) — works for Jest/Vitest/Mocha
TEST_COUNT=$(grep -r -c "it(\|test(\|it\.only(\|test\.only(" tests/ --include="*.test.*" --include="*.spec.*" | awk -F: '{sum+=$2} END{print sum}')
```

The `gsd-tools.cjs` binary exposes this as:
```bash
node gsd-tools.cjs test-count          # total
node gsd-tools.cjs test-count --phase 5  # for phase 5 (by commit attribution)
```

### Enforcement Points

| Point | What Happens | Blocker? |
|-------|-------------|----------|
| plan-phase | Planner sees budget status in prompt | No — advisory |
| plan-checker | Flags if planned tests exceed per-phase budget | Warning |
| execute-plan | After TDD GREEN, checks cumulative count | No — tests already written |
| audit-milestone | Steward reports budget status + proposes consolidation | Soft — proposals only |

### Consolidation Triggers

The test steward proposes consolidation when:
1. Per-phase budget exceeded by >20%
2. Project budget at or above 100%
3. Redundancy ratio > 15% (more than 15% of tests overlap)
4. Stale test ratio > 5% (tests referencing deleted code)

### Consolidation Strategies

| Strategy | When | Example |
|----------|------|---------|
| Parameterize | Multiple tests with same logic, different inputs | 5 `parseState` tests -> 1 parameterized with 5 cases |
| Promote | Unit tests fully covered by integration test | 3 unit tests + 1 integration -> keep integration, remove units |
| Prune stale | Test references deleted code | Remove test, update count |
| Merge files | Phase has >5 test files for related functionality | Consolidate into 1-2 files |

### Human Approval Flow
Steward produces a markdown report. Human reviews during milestone audit:
- "Approve all" — steward applies all consolidations
- "Cherry-pick" — human selects which proposals to apply
- "Reject" — no changes (budget overage remains as tech debt)

## Configuration & Defaults

### Purpose
Define the complete configuration schema for the test architecture, including sensible defaults that allow zero-config adoption.

### Config Schema Addition (`config.json`)

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

### Key Defaults

| Key | Default | Rationale |
|-----|---------|-----------|
| `test.command` | `null` | Must be set by user — no guessing. When null, all test gates degrade gracefully with warnings |
| `test.framework` | `"auto"` | Auto-detect from package.json / project files. Used for test counting and file conventions |
| `test.hard_gate` | `true` | Default to strict — can be softened per-project |
| `test.acceptance_tests` | `true` | Enable acceptance test layer by default |
| `test.budget.*` | `30/200/80%` | Conservative defaults. Can be raised for large projects |
| `test.steward.enabled` | `true` | Runs during audit. Minimal overhead since it's analysis-only |
| `test.steward.auto_consolidate` | `false` | Never auto-modify tests without human approval |

### Settings Integration

`/gsd:settings` exposes test configuration:

```
Test Configuration:
  Command:          npm test
  Framework:        jest (auto-detected)
  Hard gate:        enabled
  Acceptance tests: enabled
  Budget:           23/200 tests (12%)
    Per-phase max:  30
  Steward:          enabled
    Auto-consolidate: disabled (proposals require approval)
```

### Zero-Config Experience

A new project using GSD for the first time:
1. `test.command` is null -> all test gates show "Warning: No test command configured" and skip
2. User runs `/gsd:settings` -> sets `test.command` to `npm test`
3. Next phase execution: hard gate activates, runs `npm test` after each task
4. Discuss-phase starts asking for acceptance test criteria
5. Test steward runs at milestone audit

No workflow breaks. No mandatory setup. Progressive opt-in.
