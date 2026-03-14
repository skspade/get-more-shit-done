# Technology Stack: New-Milestone Auto Mode (v2.5)

**Project:** GSD Autopilot
**Researched:** 2026-03-14
**Confidence:** HIGH

## Scope

This research covers ONLY what's needed for adding `--auto` flag to `/gsd:new-milestone`. The existing validated stack (zx autopilot, CJS modules, gsd-tools.cjs CLI, config system, AskUserQuestion, `--auto` on discuss/plan/execute workflows) is NOT re-evaluated.

## Verdict: No New Dependencies

This milestone requires zero new libraries, frameworks, or tools. All implementation uses existing patterns and infrastructure. The work is purely workflow-level changes to markdown instruction files and minor additions to existing CJS modules.

## Existing Stack to Reuse

### Argument Parsing Pattern (from discuss-phase.md)

| Component | Location | Pattern | Reuse |
|-----------|----------|---------|-------|
| `--auto` flag parsing | discuss-phase.md line 764 | `Parse --auto flag from $ARGUMENTS` | Exact same pattern in new-milestone.md |
| Config read | discuss-phase.md line 767 | `gsd-tools.cjs config-get workflow.auto_advance` | Identical command |
| Config persist | discuss-phase.md line 771 | `gsd-tools.cjs config-set workflow.auto_advance true` | Identical command |
| Conditional logic | discuss-phase.md line 775 | `If --auto flag present OR AUTO_CFG is true` | Same boolean OR pattern |

### Config Infrastructure (already registered)

| Touch Point | File | Status |
|-------------|------|--------|
| `CONFIG_DEFAULTS` | `config.cjs` line 9 | `workflow.auto_advance` NOT in defaults (intentional -- defaults to unset/false) |
| `KNOWN_SETTINGS_KEYS` | `cli.cjs` line 739 | `workflow.auto_advance` already registered |
| `validateSetting` | `cli.cjs` line 684 | `workflow.auto_advance` in booleanKeys list |

No config registration changes needed -- `workflow.auto_advance` is already a known boolean setting.

### Init Command (gsd-tools.cjs)

| Command | File | Current Output | Needed Addition |
|---------|------|----------------|-----------------|
| `init new-milestone` | `init.cjs` line 221 | Models, config, milestone info, file paths | Add `auto_mode` field (boolean from parsed args or config) |

The `cmdInitNewMilestone` function currently does not accept or parse `--auto` from arguments. It needs a minor addition to detect `--auto` in process args or accept a parameter, and include `auto_mode: true/false` in its JSON output.

### AskUserQuestion Skip Pattern

The 5 AskUserQuestion calls in new-milestone.md each need conditional wrapping:

```
If --auto flag present OR AUTO_CFG is true:
  {auto behavior}
Otherwise:
  {existing AskUserQuestion call}
```

This is the exact pattern used in discuss-phase.md (auto_context_check step) and plan-phase.md (step 14 auto-advance check). No new tooling needed.

### Auto-Chain Pattern (from discuss-phase.md auto_advance step)

The auto-chain from new-milestone to discuss-phase uses the same Task-spawning pattern already proven in discuss-phase.md lines 786-817:

```
Task(
  prompt="...",
  subagent_type="general-purpose",
  description="..."
)
```

With `@~/.claude/get-shit-done/workflows/discuss-phase.md` file reference and `ARGUMENTS='${PHASE} --auto'`.

## Changes Required (by file)

### Workflow Files (Markdown)

| File | Change | Complexity |
|------|--------|------------|
| `workflows/new-milestone.md` | Add --auto parsing, conditional skip at 5 AskUserQuestion points, auto-chain to discuss-phase | Medium |
| `workflows/brainstorm.md` | Replace step 10c inline execution with `/gsd:new-milestone --auto` invocation | Low |
| `commands/gsd/new-milestone.md` | Update argument-hint to include `--auto` flag | Trivial |

### CJS Modules

| File | Change | Complexity |
|------|--------|------------|
| `bin/lib/init.cjs` | Add `auto_mode` field to `cmdInitNewMilestone` output (read from config or args) | Trivial |

### No Changes Needed

| File | Why Not |
|------|---------|
| `config.cjs` | `workflow.auto_advance` not in CONFIG_DEFAULTS by design (defaults false) |
| `cli.cjs` | `workflow.auto_advance` already in KNOWN_SETTINGS_KEYS and booleanKeys |
| `autopilot.mjs` | Does not invoke new-milestone (operates within existing milestones) |
| `gsd-tools.cjs` | Routing already handles `init new-milestone`, no new commands needed |

## Config Commands Reference

Commands the workflow will use (all existing, no additions):

```bash
# Read auto_advance config
AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")

# Persist auto_advance when --auto flag used
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.auto_advance true

# Persist research choice
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.research true

# Init command for model resolution
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-milestone)

# Commit artifacts
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: ..." --files ...
```

## Alternatives Considered

| What | Alternative | Why Not |
|------|-------------|---------|
| New CLI flag parser | Dedicated arg-parsing library (yargs, commander) | Overkill -- workflow markdown parses $ARGUMENTS as text, same as discuss-phase |
| New config key | `milestone.auto_create` separate from `workflow.auto_advance` | Unnecessary -- auto_advance already covers "skip confirmations" semantics across all workflows |
| New gsd-tools command | `gsd-tools.cjs auto-milestone` | Unnecessary -- init + config-get/set is sufficient |

## Sources

All findings based on direct codebase inspection (HIGH confidence):

- `get-shit-done/workflows/discuss-phase.md` -- auto_context_check step (line 133) and auto_advance step (line 761)
- `get-shit-done/workflows/plan-phase.md` -- step 14 auto-advance check (line 485)
- `get-shit-done/workflows/new-milestone.md` -- current workflow (steps 1-11)
- `get-shit-done/workflows/brainstorm.md` -- step 10 milestone routing
- `get-shit-done/bin/lib/init.cjs` -- cmdInitNewMilestone (line 221)
- `get-shit-done/bin/lib/config.cjs` -- CONFIG_DEFAULTS, cmdConfigGet, cmdConfigSet
- `get-shit-done/bin/lib/cli.cjs` -- KNOWN_SETTINGS_KEYS (line 735), validateSetting booleanKeys (line 684)
