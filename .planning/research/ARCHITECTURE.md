# Architecture: Dual-Layer Test Integration

**Domain:** Test architecture integration into existing GSD autopilot framework
**Researched:** 2026-03-05
**Confidence:** HIGH (analysis based on direct reading of all touched workflows, agents, and config)

## Integration Overview

The dual-layer test architecture adds test concerns to five existing workflows (`discuss-phase`, `plan-phase`, `execute-plan`, `verify-phase`, `audit-milestone`), introduces one new agent (`gsd-test-steward`), extends `gsd-tools.cjs` with test-counting commands, and adds a `test` section to `config.json`. Every change is additive -- existing behavior is preserved when test config is absent.

The critical architectural constraint: **subagents cannot spawn subagents**. The test steward must be spawned by the audit-milestone orchestrator (which already spawns the integration checker), not by another agent. The hard gate in execute-plan runs inline within the executor context, not as a subagent.

## Component Map: New vs Modified

### New Components

| Component | Type | File Location | Spawned By |
|-----------|------|---------------|------------|
| `gsd-test-steward` | Agent | `agents/gsd-test-steward.md` | `audit-milestone.md` orchestrator |
| `test-count` command | gsd-tools CLI | `get-shit-done/bin/gsd-tools.cjs` | Planner prompt, steward, settings |
| `test` config section | Config schema | `.planning/config.json` | User via settings, read by workflows |
| `/gsd:audit-tests` | Command spec | `commands/gsd/audit-tests.md` | User invocation (manual) |

### Modified Components

| Component | Type | Change Scope | Risk |
|-----------|------|-------------|------|
| `discuss-phase.md` | Workflow | New step after `discuss_areas` | LOW -- additive step |
| `gsd-auto-context.md` | Agent | Generate `<acceptance_tests>` from requirements | LOW -- additive output |
| `plan-phase.md` | Workflow | Pass test budget to planner prompt | LOW -- additional context |
| `gsd-planner.md` | Agent | Generate `<tests>` blocks in tasks | MEDIUM -- new output format |
| `gsd-plan-checker.md` | Agent | New dimension: AT coverage check | LOW -- additive dimension |
| `execute-plan.md` | Workflow | Hard gate after task commits | MEDIUM -- new failure path |
| `gsd-executor.md` | Agent | Run test suite after TDD GREEN | MEDIUM -- new step in loop |
| `verify-phase.md` | Workflow | Execute AT Verify commands | MEDIUM -- new verification source |
| `gsd-verifier.md` | Agent | Map AT results to truths | MEDIUM -- new data source |
| `audit-milestone.md` | Workflow | Spawn test steward | LOW -- additional subagent |
| `gsd-tools.cjs` | CLI tool | `test-count`, `config-get test.*` | LOW -- additive commands |
| `config.json` | Config | New `test` section | LOW -- additive schema |
| `gsd settings` | CLI command | Display test config | LOW -- new display section |

## Integration Point 1: Acceptance Tests in CONTEXT.md

### Where It Fits

CONTEXT.md currently uses XML sections: `<domain>`, `<decisions>`, `<code_context>`, `<specifics>`, `<deferred>`. The design adds `<acceptance_tests>` as a new sibling section.

### Structural Integration

```markdown
# Phase [X]: [Name] - Context

<domain>...</domain>
<decisions>...</decisions>
<code_context>...</code_context>
<specifics>...</specifics>

<acceptance_tests>
## Acceptance Tests

### AT-01: [Test name]
- Given: [precondition]
- When: [action]
- Then: [expected outcome]
- Verify: `[shell command]`
</acceptance_tests>

<deferred>...</deferred>
```

### Discuss-Phase Integration

Current flow: `analyze_phase` -> `present_gray_areas` -> `discuss_areas` -> `write_context` -> `confirm_creation` -> `git_commit`.

New step inserted between `discuss_areas` and `write_context`:

```
discuss_areas -> [NEW: gather_acceptance_tests] -> write_context
```

**`gather_acceptance_tests` step behavior:**
1. Check `config-get test.acceptance_tests` -- if false or missing, skip with no output
2. Present extracted requirements for the phase (from ROADMAP.md + REQUIREMENTS.md)
3. For each requirement, ask: "What observable behavior proves this works?"
4. Structure responses into AT-{NN} format with Given/When/Then
5. AI may suggest `Verify` commands; human approves
6. Present full acceptance test list for approval
7. Pass approved tests to `write_context` for inclusion in CONTEXT.md

**Auto-context agent integration:** `gsd-auto-context.md` must also generate `<acceptance_tests>` when running autonomously (`--auto` flag). The auto-context agent derives acceptance tests from SUCCESS CRITERIA in ROADMAP.md. Each success criterion becomes an AT with AI-generated Given/When/Then and Verify commands. The `<acceptance_tests>` section includes an annotation: `<!-- Auto-generated from success criteria. Review during verification. -->`

### Downstream Consumers

| Consumer | How It Uses `<acceptance_tests>` |
|----------|----------------------------------|
| `gsd-planner` | Reads ATs to ensure plan tasks cover all acceptance criteria |
| `gsd-plan-checker` | Verifies all ATs have covering tasks (new dimension) |
| `gsd-executor` | Does NOT run ATs during execution (that is verify-phase's job) |
| `gsd-verifier` | Runs each AT's Verify command as truth verification |

### Key Constraint

**ATs are human-owned.** After discuss-phase writes them to CONTEXT.md and commits, no downstream agent may add, remove, or modify `<acceptance_tests>` content. The planner references them; the verifier executes them; neither mutates them.

## Integration Point 2: Test Specs in PLAN.md Tasks

### Where It Fits

PLAN.md tasks currently use XML format with `<task id="N" name="..." type="auto|checkpoint:*" tdd="true|false">`. The `<tests>` block is a new child element inside `<task>` when `tdd="true"`.

### Structural Integration

```xml
<task id="3" name="Create state parser" type="auto" tdd="true">
  <tests>
  - test: "parses valid STATE.md frontmatter"
    input: valid STATE.md content
    expected: parsed object with milestone, status, progress fields
  - test: "returns error for missing frontmatter"
    input: STATE.md without --- delimiters
    expected: error with descriptive message
  </tests>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>Implement parseState function...</action>
  <verify>Run test suite</verify>
  <done>All tests pass</done>
</task>
```

### Plan-Phase Integration

The planner prompt in `plan-phase.md` step 8 already passes context including CONTEXT.md. The integration adds:

1. **Budget awareness in planner prompt:** Append test budget status to the `<planning_context>`:
   ```
   <test_budget>
   Current test count: {N}/{max_total_tests}
   Per-phase budget: {max_tests_per_phase}
   Warning threshold: {warn_at_percentage}%
   </test_budget>
   ```
   Budget data comes from `gsd-tools.cjs test-count` (new command).

2. **Planner agent modification:** `gsd-planner.md` instructions updated to:
   - Generate `<tests>` blocks for tasks with testable logic
   - Default `tdd="true"` for any task with a `<tests>` block
   - Stay within per-phase budget (justify if exceeding)
   - Reference acceptance tests from CONTEXT.md when creating test specs

3. **Plan-checker new dimension:** `gsd-plan-checker.md` gets a new verification dimension:
   ```
   Dimension 9: Acceptance Test Coverage
   - Every AT-{NN} in CONTEXT.md must have at least one covering task
   - AT coverage tracked similarly to requirement coverage
   - Missing AT coverage is a blocker
   ```

### Data Flow

```
CONTEXT.md (<acceptance_tests>) ------+
                                      v
config.json (test.budget) --> gsd-tools test-count --> planner prompt
                                      |
                                      v
                            gsd-planner generates
                            <tests> blocks in PLAN.md
                                      |
                                      v
                            gsd-plan-checker verifies
                            AT coverage (new dimension)
```

## Integration Point 3: Hard Gate in Execute-Plan

### Where It Fits

The execute-plan workflow currently has this per-task flow: load task -> execute (with TDD if applicable) -> verify done criteria -> commit -> next task. The hard gate inserts after the commit step.

### Current Execute Flow (execute-plan.md step "execute")

```
Per task:
  1. type="auto" with tdd="true" -> TDD execution (RED -> GREEN -> REFACTOR)
  2. type="auto" without tdd -> standard execution
  3. Verify done criteria
  4. Commit (task_commit step)
  5. [NEW: hard_test_gate]
  6. Next task
```

### Hard Gate Implementation

The hard gate runs **inline in the executor context**, not as a subagent. This is critical because:
- The executor is already a subagent spawned by execute-plan orchestrator
- Subagents cannot spawn subagents
- The test suite run is a simple bash command, not an agent-level operation

**In `gsd-executor.md`, after the task_commit logic:**

```bash
# Hard test gate (skip if no test command configured)
TEST_CMD=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get test.command 2>/dev/null)
HARD_GATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get test.hard_gate 2>/dev/null)

if [ -n "$TEST_CMD" ] && [ "$TEST_CMD" != "null" ] && [ "$HARD_GATE" != "false" ]; then
  eval "$TEST_CMD"
  if [ $? -ne 0 ]; then
    echo "HARD GATE: Test suite failed after task ${TASK_NUM}"
    # Apply Rule 1 (Bug) deviation handling
  fi
fi
```

### Interaction with Existing Deviation Rules

Test failures trigger **Rule 1 (Bug)** deviation handling, which already exists in execute-plan.md:
- Fix -> test -> verify -> track `[Rule 1 - Bug]`
- Permission: Auto (no human approval needed)
- If debug retries exhausted -> escalate to human

This means no new failure handling logic is needed. The hard gate feeds into the existing deviation rule system.

### Interaction with Subagent Spawning

**Pattern A (fully autonomous, no checkpoints):** The executor subagent runs the hard gate inline. If tests fail, it applies Rule 1 within the same subagent context. The orchestrator is not involved until the subagent returns.

**Pattern B (segmented with checkpoints):** Each segment's subagent runs the hard gate independently. If tests fail in segment 2, that segment's executor handles it. The orchestrator only sees the final result.

**Pattern C (main context execution):** Hard gate runs in main context. Same behavior as Pattern A but without subagent overhead.

No changes to spawning patterns are needed. The hard gate is a synchronous bash operation that happens between task commit and the next task.

### Graceful Degradation

| Config State | Hard Gate Behavior |
|-------------|-------------------|
| `test.command` is null | Skip with warning: "No test command configured -- test gates inactive" |
| `test.command` set, `test.hard_gate` is true | Full gate: run suite, fail on errors |
| `test.command` set, `test.hard_gate` is false | Advisory: run suite, warn on errors but continue |
| `config.json` missing entirely | Skip silently (backward compatible) |

### TDD Task Enhancement

For tasks with `tdd="true"` and `<tests>` blocks, the current flow is RED -> GREEN -> REFACTOR. The enhancement adds:

```
RED       -> tests fail (confirms test is real)
GREEN     -> tests pass (implementation works)
REFACTOR  -> tests still pass
[NEW] REGRESSION -> full suite passes (new code doesn't break existing)
```

The REGRESSION step IS the hard gate. It runs after REFACTOR (or after commit for non-TDD tasks). This is the same `eval "$TEST_CMD"` call -- it is not a separate mechanism.

## Integration Point 4: Test Steward Agent

### How It Fits the Agent Pattern

Existing agents follow a consistent pattern:

```markdown
---
name: gsd-{role}
description: {one-line purpose}
tools: {tool list}
color: {color}
---

<role>...</role>
<project_context>...</project_context>
<process>...</process>
<output>...</output>
<success_criteria>...</success_criteria>
```

The test steward follows this pattern exactly. It is a **read-only analysis agent** similar to `gsd-integration-checker` -- it produces a report but does not modify files.

### Agent Specification

```markdown
---
name: gsd-test-steward
description: Manages test suite health -- redundancy detection, budget enforcement, consolidation proposals. Spawned during audit-milestone or manually via /gsd:audit-tests.
tools: Read, Bash, Grep, Glob
color: green
---
```

**Key difference from other agents:** The test steward is explicitly **read-only**. It does not have the `Write` or `Edit` tools. It produces a report; consolidation changes require human approval and a separate execution phase.

### Spawning Context

**During audit-milestone (step 3.5, new):**

The steward is spawned after phase verifications are collected (step 2) and before the audit report is generated (step 6). Its report is included as a section in the `v{version}-MILESTONE-AUDIT.md`.

```
Task(
  prompt="Analyze test suite health for milestone {version}.

<files_to_read>
- .planning/config.json
- {all test files discovered via glob}
</files_to_read>

<test_budget>
max_tests_per_phase: {from config}
max_total_tests: {from config}
warn_at_percentage: {from config}
</test_budget>

Phase directories: {list}

Produce a test health report with:
1. Test count per phase vs budget
2. Redundancy analysis
3. Stale test detection
4. Consolidation proposals (if needed)",
  subagent_type="gsd-test-steward",
  model="{checker_model}",
  description="Test suite health analysis"
)
```

**Via `/gsd:audit-tests` (manual invocation):**

A new command spec that spawns the steward independently of milestone audit. The command reads config, discovers test files, and spawns the agent. This follows the same pattern as other GSD commands -- a `commands/gsd/audit-tests.md` file that defines the command.

### Model Resolution

The steward uses the same model tier as verification agents (`gsd-plan-checker`, `gsd-verifier`). In the model profiles table:

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| `gsd-test-steward` | opus (inherit) | sonnet | haiku |

### Output Format

The steward returns a structured markdown report:

```markdown
## TEST STEWARD REPORT

**Status:** healthy | warning | over_budget
**Total tests:** {N}/{max_total}

### Per-Phase Budget

| Phase | Tests | Budget | Status |
|-------|-------|--------|--------|
| 30    | 12    | 30     | OK     |
| 31    | 35    | 30     | OVER   |

### Redundancy Analysis

{N} potentially redundant test groups found.

### Consolidation Proposals

{Structured proposals if any}

### Stale Tests

{Tests referencing deleted code}
```

This output is consumed by `audit-milestone.md` and included in the audit report. The orchestrator presents consolidation proposals to the human during the audit review.

## Integration Point 5: Config.json Schema Extension

### Current Schema

```json
{
  "mode": "yolo",
  "depth": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true
  },
  "autopilot": {
    "circuit_breaker_threshold": 3
  }
}
```

### Extended Schema

```json
{
  "mode": "yolo",
  "depth": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true
  },
  "autopilot": {
    "circuit_breaker_threshold": 3
  },
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

### Config Access Pattern

All config reads use the existing `gsd-tools.cjs config-get` command with dot-notation paths:

```bash
# Read test command
node gsd-tools.cjs config-get test.command
# Returns: null (default) or "npm test" (configured)

# Read nested budget value
node gsd-tools.cjs config-get test.budget.max_tests_per_phase
# Returns: 30

# Set test command
node gsd-tools.cjs config-set test.command "npm test"
```

The existing `config-get` and `config-set` commands in gsd-tools.cjs already support dot-notation paths for nested values. No changes to the config access layer are needed -- only the schema understanding of which keys are valid and their defaults.

### Settings Display Integration

The `gsd settings` CLI command (in the standalone `gsd` binary) displays config values. A new "Test Configuration" section is added:

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

This requires changes to the `gsd` CLI binary's settings handler (`handleSettings` function), not to gsd-tools.cjs.

### Default Handling

When `test` section is missing from config.json entirely:
- All `config-get test.*` calls return null/undefined
- Workflows check for null and degrade gracefully
- No workflow breaks, no errors -- just warnings where test gates would normally run

When `test.command` is null but other test settings exist:
- Hard gate skips with warning
- Acceptance tests can still be gathered (they are structure, not execution)
- Test steward skips (nothing to count)
- Budget tracking is dormant

## Data Flow: End-to-End Phase Lifecycle Under Test Architecture

```
DISCUSS-PHASE
  |
  +-- Gray area discussion (existing)
  +-- [NEW] Acceptance test gathering
  |     +-- Present requirements
  |     +-- Ask "What proves this works?" per requirement
  |     +-- Human approves Given/When/Then + Verify
  +-- Write CONTEXT.md with <acceptance_tests> section
  |
  v
PLAN-PHASE
  |
  +-- [NEW] Read test budget from config
  +-- Pass budget + ATs to planner
  +-- Planner generates PLAN.md
  |     +-- [NEW] <tests> blocks in TDD tasks
  |     +-- [NEW] Budget-aware test planning
  +-- Plan-checker verifies
  |     +-- [NEW] Dimension 9: AT coverage
  |
  v
EXECUTE-PLAN
  |
  +-- Per task:
  |     +-- TDD: RED -> GREEN -> REFACTOR (existing)
  |     +-- Standard: implement + verify (existing)
  |     +-- Commit (existing)
  |     +-- [NEW] Hard gate: run test suite
  |           +-- Pass -> continue to next task
  |           +-- Fail -> Rule 1 deviation (debug/fix/retry)
  |                 +-- Retries exhausted -> human escalation
  |
  v
VERIFY-PHASE
  |
  +-- Establish must-haves (existing)
  +-- [NEW] Execute acceptance tests
  |     +-- Parse <acceptance_tests> from CONTEXT.md
  |     +-- Run each AT-{NN} Verify command
  |     +-- Map results to truths
  |     +-- AT failure -> gaps_found
  +-- Verify artifacts + wiring (existing)
  +-- Create VERIFICATION.md (existing, with AT results added)
  |
  v
AUDIT-MILESTONE
  |
  +-- Collect phase verifications (existing)
  +-- [NEW] Spawn test steward
  |     +-- Count tests per phase vs budget
  |     +-- Detect redundancy
  |     +-- Produce consolidation proposals
  +-- Integration checker (existing)
  +-- Create MILESTONE-AUDIT.md (existing, with test health section)
```

## gsd-tools.cjs Extensions

### New Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `test-count` | Count test cases across project | `{ total: N, by_phase: {...} }` |
| `test-count --phase N` | Count test cases for a specific phase | `{ phase: N, count: M }` |

### Implementation Approach

The `test-count` command uses grep-based counting (not test runner output) to count `it(`, `test(`, `it.only(`, `test.only(` patterns across test files. This is framework-agnostic and works for Jest, Vitest, Mocha, and node:test.

Phase attribution uses git blame or commit-based attribution (phase number extracted from commit message prefixes like `test(30-01):`).

### Existing Commands Used (Unchanged)

| Command | Used By | Purpose |
|---------|---------|---------|
| `config-get test.*` | All workflows | Read test configuration |
| `config-set test.*` | Settings, user | Write test configuration |
| `init phase-op` | All phase workflows | Unchanged, returns existing phase context |
| `verify artifacts` | Verifier | Unchanged, runs artifact verification |
| `verify key-links` | Verifier | Unchanged, runs key link verification |

## Build Order (Dependency-Driven)

The features have clear dependency relationships. Build order must respect them.

### Layer 0: Foundation (no dependencies)

**1. Config schema extension**
- Add `test` section to config.json schema
- Implement default handling in `config-get`/`config-set`
- Update `gsd settings` display
- Why first: Every other feature reads config to decide whether to activate

**2. `test-count` command in gsd-tools.cjs**
- Grep-based test counting
- Phase attribution via git
- Why first: Planner and steward both need this data

### Layer 1: CONTEXT.md Integration (depends on Layer 0)

**3. Acceptance test gathering in discuss-phase**
- New `gather_acceptance_tests` step
- `<acceptance_tests>` XML block in CONTEXT.md output
- Config check: `test.acceptance_tests` enables/disables
- Update `gsd-auto-context.md` for autonomous AT generation
- Depends on: Config schema (to check if ATs enabled)

### Layer 2: PLAN.md Integration (depends on Layers 0-1)

**4. `<tests>` blocks in gsd-planner**
- Planner generates test specs per task
- Budget awareness in planner prompt
- Plan-checker AT coverage dimension
- Depends on: `test-count` (for budget data), AT format (to reference in plans)

### Layer 3: Execution Integration (depends on Layers 0-2)

**5. Hard gate in execute-plan / gsd-executor**
- Post-commit test suite run
- Rule 1 deviation routing on failure
- Graceful degradation when no test command
- Depends on: Config schema (hard_gate setting), `<tests>` blocks (TDD regression step)

**6. Acceptance test execution in verify-phase / gsd-verifier**
- Parse `<acceptance_tests>` from CONTEXT.md
- Run Verify commands
- Map results to verification truths
- Depends on: AT format in CONTEXT.md (from step 3)

### Layer 4: Stewardship (depends on Layers 0-2)

**7. Test steward agent**
- Agent file: `agents/gsd-test-steward.md`
- Spawning integration in `audit-milestone.md`
- `/gsd:audit-tests` command spec
- Depends on: `test-count` (for counting), config schema (for budget thresholds)

### Dependency Graph

```
[0] Config schema ----------------+
[0] test-count -------------------+
                                  v
[1] AT gathering ------> [2] <tests> blocks -------> [3] Hard gate
    (discuss-phase)       (plan-phase)                (execute-plan)
         |                                                 |
         +-------------------------------------------> [3] AT execution
                                                       (verify-phase)
[0] Config + [0] test-count -------------------------->[4] Test steward
                                                       (audit-milestone)
```

### Recommended Phase Structure for Roadmap

**Phase 30:** Config schema + test-count command (Layer 0)
- Small, foundational, enables everything else
- Estimated: 2 plans (config extension + CLI command)

**Phase 31:** Acceptance test layer in discuss/plan (Layers 1-2)
- CONTEXT.md `<acceptance_tests>` + planner `<tests>` blocks + plan-checker dimension
- Estimated: 3 plans (discuss integration, auto-context update, planner/checker updates)

**Phase 32:** Hard gate + verification (Layer 3)
- execute-plan hard gate + verify-phase AT execution
- Estimated: 2 plans (executor gate, verifier AT integration)

**Phase 33:** Test steward + audit integration (Layer 4)
- Agent file + audit-milestone spawning + /gsd:audit-tests command
- Estimated: 2 plans (agent implementation, audit integration)

## Invariants (Must Not Be Violated)

1. **No phase completes without all existing tests passing** -- hard gate in execute-plan blocks on test failure
2. **No acceptance test is added/modified/removed by AI** -- ATs are human-owned, written during discuss-phase, frozen after commit
3. **No test is deleted without human approval** -- steward proposes, human approves, separate execution applies
4. **Backward compatible** -- all gates degrade gracefully when `test.command` is null or `test` section is absent from config
5. **No subagent spawns subagent** -- hard gate runs inline in executor; steward spawned by audit orchestrator
6. **Existing phase lifecycle unchanged** -- new steps are inserted, not replacing existing steps; same artifact flow (CONTEXT -> PLAN -> SUMMARY -> VERIFICATION)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hard gate slows execution significantly | MEDIUM | LOW | Test command is user-configured; fast suites are the user's responsibility |
| Test budget too restrictive for complex phases | LOW | LOW | Budget is configurable; justification override mechanism exists |
| AT Verify commands brittle across environments | MEDIUM | MEDIUM | ATs are optional; Verify commands are reviewed by human during discuss |
| Steward false positives on redundancy | MEDIUM | LOW | Steward is read-only; human approves all changes |
| Auto-context generates poor ATs | LOW | LOW | ATs are advisory in auto mode; verify-phase catches failures |
| Config migration for existing projects | LOW | LOW | Missing config section degrades gracefully; no migration needed |

## Sources

- Direct reading: `get-shit-done/workflows/execute-plan.md`, `discuss-phase.md`, `verify-phase.md`, `plan-phase.md`, `audit-milestone.md`
- Direct reading: `agents/gsd-executor.md`, `gsd-verifier.md`, `gsd-plan-checker.md`, `gsd-auto-context.md`
- Direct reading: `.planning/config.json`, `get-shit-done/bin/gsd-tools.cjs` (config-get/set, resolve-model commands)
- Direct reading: `.planning/designs/2026-03-05-dual-layer-test-architecture-design.md` (approved design)
- Direct reading: `get-shit-done/references/tdd.md`, `get-shit-done/workflows/add-tests.md`
