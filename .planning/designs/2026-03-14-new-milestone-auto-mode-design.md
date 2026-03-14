# New-Milestone Auto Mode — Design

**Date:** 2026-03-14
**Approach:** Hybrid Flag + Config (mirrors discuss-phase pattern)

## Argument Parsing and Context Resolution

When `new-milestone.md` is invoked:

1. **Parse `--auto` flag** from `$ARGUMENTS` (same pattern as discuss-phase line 764)
2. **Read config** for `workflow.auto_advance` as `AUTO_CFG`
3. **If `--auto` present and `AUTO_CFG` is not true**, persist to config:
   ```bash
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config set workflow.auto_advance true
   ```
4. **Resolve milestone context** (in priority order):
   - If `MILESTONE-CONTEXT.md` exists → use it (existing behavior, e.g., from brainstorm routing)
   - If `@file` reference in args → read file as milestone goals
   - If inline text in args (after stripping `--auto`) → use as milestone goals
   - If none and auto mode → error: `"--auto requires milestone goals. Usage: /gsd:new-milestone --auto 'description' or provide MILESTONE-CONTEXT.md"`
   - If none and interactive → ask user (existing behavior)

## Auto-Skip Behavior at Each Decision Point

The 5 AskUserQuestion calls in new-milestone and their auto behavior:

| # | Question | Auto Behavior |
|---|----------|---------------|
| 1 | "What do you want to build next?" | Skip — use resolved context from args/file/MILESTONE-CONTEXT.md |
| 2 | Version suggestion confirmation | Skip — auto-accept suggested version (minor bump) |
| 3 | "Research the domain ecosystem?" | **Always research** — auto-select "Research first" option |
| 4 | Requirement scoping (multiSelect features) | Skip — include all features from context, select all categories |
| 5 | Roadmap approval | Skip — auto-approve generated roadmap |

**Pattern at each point:**
```
**If `--auto` flag present OR `AUTO_CFG` is true:**
  {auto behavior — skip question, use default/inferred value}

**Otherwise:**
  {existing interactive behavior unchanged}
```

The "identify gaps" AskUserQuestion (asking if user wants to add requirements) is auto-skipped with "No" — research should have covered it.

## Auto-Chain to Discuss Phase

After roadmap creation and commit (existing step 11), add auto-advance logic mirroring discuss-phase's transition pattern:

```
**If `--auto` flag present OR `AUTO_CFG` is true:**
  Display: "Auto-advancing to first phase..."
  Exit skill and invoke SlashCommand("/gsd:discuss-phase 1 --auto")

**If neither `--auto` nor config enabled:**
  Display existing completion message:
  "Milestone {version} created. Run /gsd:discuss-phase 1 to start."
```

This completes the autonomous pipeline: `new-milestone --auto` → research → requirements → roadmap → `discuss-phase 1 --auto` → plan → execute → verify (human checkpoint).

## Autopilot Integration

Update `autopilot.mjs` to pass `--auto` when invoking new-milestone. Currently autopilot doesn't create milestones (it operates within an existing one), but this enables a future flow where autopilot could chain milestone creation.

**Immediate change:** The `brainstorm.md` step 10 (milestone route) already creates MILESTONE-CONTEXT.md and runs new-milestone steps inline. With `--auto` support, brainstorm can simply invoke `/gsd:new-milestone --auto` instead of manually executing steps 1-11 inline — significantly simplifying brainstorm's routing code.

**Init command update:** `gsd-tools.cjs init new-milestone` JSON output should include an `auto_mode` field reflecting the parsed `--auto` flag, so model resolution and config happen in one place.
