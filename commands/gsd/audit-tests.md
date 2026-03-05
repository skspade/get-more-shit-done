---
name: gsd:audit-tests
description: Run an on-demand test suite health check -- redundancy, staleness, and budget status
argument-hint: ""
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---
<objective>
Run the gsd-test-steward agent for an on-demand test suite health check. Produces a report covering redundancy, staleness, and budget status without requiring a full milestone audit.

**This command IS the orchestrator.** It gathers test data, spawns the steward agent, and presents the report.
</objective>

<execution_context>
No workflow file needed -- this is a direct agent spawn.
</execution_context>

<context>
No arguments required. Operates on the current project's test suite.

Core data resolved at runtime:
- Test files: discovered via `gsd-tools.cjs test-count`
- Test config: read via `gsd-tools.cjs test-config`
- Steward model: resolved via `gsd-tools.cjs resolve-model gsd-test-steward --raw`
</context>

<process>

## 1. Check Prerequisites

```bash
STEWARD_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get test.steward 2>/dev/null || echo "true")
```

**If `STEWARD_ENABLED` is "false":**
Display: "Test steward is disabled in config. Enable with: `gsd settings set test.steward true`" and exit.

## 2. Check for Test Files

```bash
TEST_COUNT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-count --raw 2>/dev/null || echo "0")
```

**If `TEST_COUNT` is "0":**
Display: "No test files found in project." and exit.

## 3. Gather Data

```bash
TEST_CONFIG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-config 2>/dev/null)
STEWARD_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-test-steward --raw 2>/dev/null || echo "sonnet")
```

## 4. Display Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUDITING TEST SUITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning test steward...
```

## 5. Spawn Steward

```
Task(
  prompt="First, read /home/seans/.claude/agents/gsd-test-steward.md for your role and instructions.

<files_to_read>
- ./CLAUDE.md (if exists -- project instructions)
</files_to_read>

<steward_input>
**Mode:** on-demand (audit-tests command)
**Test count:** {TEST_COUNT}
**Test config:** {TEST_CONFIG}
</steward_input>

Analyze the test suite and produce a health report.",
  subagent_type="gsd-test-steward",
  model="{STEWARD_MODEL}",
  description="Audit test suite health"
)
```

## 6. Present Report

Display the steward's full report to the user.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST AUDIT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>
