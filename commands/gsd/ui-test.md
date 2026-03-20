---
name: gsd:ui-test
description: Generate and run Playwright E2E tests against your application
argument-hint: "[phase] [url] [--scaffold] [--run-only] [--headed]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---
<objective>
Spawn the gsd-playwright agent to generate and run Playwright E2E tests. This command IS the orchestrator — it parses arguments, gathers pre-flight data, spawns the agent, and presents results.

**This command is a thin wrapper.** All logic lives in the `gsd-playwright` agent.
</objective>

<execution_context>
No workflow file needed -- this is a direct agent spawn.
</execution_context>

<context>
**Arguments from `$ARGUMENTS`:**
- Phase number: first numeric token (optional) -> `$PHASE_ARG`
- URL: token matching `http://` or `https://` (defaults to `http://localhost:3000`) -> `$BASE_URL`
- `--scaffold` flag -> `$FORCE_SCAFFOLD` (true/false)
- `--run-only` flag -> `$RUN_ONLY` (true/false)
- `--headed` flag -> `$HEADED_MODE` (true/false)
- Remaining tokens -> `$INSTRUCTIONS` (free-text passed to agent)

Core data resolved at runtime:
- Phase metadata: resolved via `gsd-tools.cjs init phase-op` (when phase provided)
- Playwright state: detected via `gsd-tools.cjs playwright-detect --raw`
- Agent model: resolved via `gsd-tools.cjs resolve-model gsd-playwright --raw`
</context>

<process>

## 1. Parse Arguments

Parse `$ARGUMENTS` into tokens:
- First numeric token -> `$PHASE_ARG` (optional)
- Token matching `http://` or `https://` -> `$BASE_URL` (default: `http://localhost:3000`)
- `--scaffold` -> `$FORCE_SCAFFOLD`
- `--run-only` -> `$RUN_ONLY`
- `--headed` -> `$HEADED_MODE`
- All other non-flag tokens -> `$INSTRUCTIONS`

**Mutual exclusion check:**
If both `--scaffold` and `--run-only` are present, display error and stop:
```
Error: --scaffold and --run-only are mutually exclusive.
--scaffold forces Playwright setup; --run-only skips generation and runs existing tests.
```

## 2. Resolve Phase (if provided)

**If `$PHASE_ARG` is present:**

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PHASE_ARG}" --raw 2>/dev/null)
```

Extract `directory` as `$PHASE_DIR`, `phase_number`, `phase_name` from JSON.

**If phase not found:** Display error:
```
Error: Phase {PHASE_ARG} not found. Check available phases with /gsd:progress.
```

**If `$PHASE_ARG` is omitted:** Set `$PHASE_DIR` to null.

## 3. Detect Playwright State

```bash
DETECT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" playwright-detect --raw 2>/dev/null || echo '{"status":"not-detected"}')
```

Extract `status` from JSON for display in banner.

## 4. Display Banner

**When phase is provided:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI TEST — Phase {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When no phase:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Display context:
- Playwright: `{status}` (configured / installed / not-detected)
- URL: `{base_url}`
- Mode: scaffold | run-only | generate & run

Then: `◆ Spawning playwright agent...`

## 5. Spawn Agent

```bash
PLAYWRIGHT_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-playwright --raw 2>/dev/null || echo "sonnet")
```

Determine mode from flags:
- `--scaffold` present: mode = `scaffold`
- `--run-only` present: mode = `ui-test`, add `--run-only` to flags
- Neither: mode = `ui-test`

Build flags string from active flags (`--scaffold`, `--run-only`, `--headed`).

```
Task(
  prompt="First, read agents/gsd-playwright.md for your role and instructions.

<files_to_read>
- ./CLAUDE.md (if exists -- project instructions)
{- {PHASE_DIR}/*-CONTEXT.md (if phase provided)}
</files_to_read>

<playwright_input>
**Mode:** {mode}
**Phase Dir:** {PHASE_DIR or 'null'}
**Base URL:** {BASE_URL}
**Flags:** {flags string}
{**Instructions:** {INSTRUCTIONS} (if provided)}
</playwright_input>

Generate and execute Playwright E2E tests.",
  subagent_type="gsd-playwright",
  model="{PLAYWRIGHT_MODEL}",
  description="Playwright E2E{: Phase {phase_number} (if provided)}"
)
```

## 6. Present Results

Parse the agent's return block.

**On `## PLAYWRIGHT COMPLETE`:**

Extract Status, Mode, Scaffolded, Generated, Results fields.

**GREEN status:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI TEST COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Results: {passed} passed, {failed} failed, {skipped} skipped
```

**RED status:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI TEST FAILED ✗
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Results: {passed} passed, {failed} failed, {skipped} skipped

{Failure Details table from agent output}
```

**BLOCKED status:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI TEST BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reason: {reason from agent output}
```

**On `## PLAYWRIGHT BLOCKED`:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI TEST BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{Reason from agent output}
```

</process>
