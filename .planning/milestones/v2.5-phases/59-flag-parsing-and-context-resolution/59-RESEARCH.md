# Phase 59: Flag Parsing and Context Resolution - Research

**Researched:** 2026-03-14
**Status:** Complete

## Research Question

What do I need to know to PLAN this phase well?

## Findings

### 1. Existing `--auto` Flag Pattern (discuss-phase.md)

The established pattern from `discuss-phase.md` (line 133):
- Parse `--auto` flag from `$ARGUMENTS`
- Read `workflow.auto_advance` config via `gsd-tools.cjs config-get workflow.auto_advance`
- If `--auto` flag present AND config is not true, persist via `gsd-tools.cjs config-set workflow.auto_advance true`
- Auto mode is active when either flag or config is true

This is the exact same pattern needed for new-milestone.md.

### 2. Existing `@file` Pattern (new-project.md)

`new-project.md` (lines 12-40) implements auto mode with document requirement:
- Check if `--auto` flag present in `$ARGUMENTS`
- Auto mode requires an idea document — either `@file` reference or inline text
- If no document content, error with usage message
- Pattern: strip `--auto` from args, remainder is context source

### 3. Files to Modify

**`get-shit-done/workflows/new-milestone.md`** — Two changes:
1. Add auto mode detection block (between step 1 and step 2) matching the `<auto_mode>` pattern from new-project.md
2. Add context resolution with priority order: MILESTONE-CONTEXT.md > @file > inline text > error

**`get-shit-done/bin/lib/init.cjs`** — One change:
1. Add `auto_mode` field to `cmdInitNewMilestone` (line 221-251), reading `workflow.auto_advance` from config

### 4. Config Infrastructure Already Exists

`workflow.auto_advance` is already:
- Registered in `KNOWN_SETTINGS_KEYS` (cli.cjs line 739)
- Validated as boolean (cli.cjs line 684)
- Has dot-notation traversal support (config.cjs line 163)

No config registration work needed.

### 5. Test Infrastructure

`tests/init.test.cjs` already has `cmdInitNewMilestone` tests (lines 794-844). Need to add:
- Test that `auto_mode` field exists in output
- Test that `auto_mode` reflects `workflow.auto_advance` config value

### 6. Context Resolution Logic

Priority order (from CONTEXT.md decisions):
1. Check `.planning/MILESTONE-CONTEXT.md` exists → use as context
2. Check for `@path/to/file.md` in remaining args → read file as context
3. Check for inline text in remaining args → use as context
4. If auto mode and no context → error with usage message
5. If interactive mode and no context → fall through to existing questioning

The validation must run BEFORE step 4 (Update PROJECT.md) to satisfy CTX-05.

### 7. Error Message Template

From design doc: `"--auto requires milestone goals. Usage: /gsd:new-milestone --auto 'description' or provide MILESTONE-CONTEXT.md"`

### 8. Scope Boundaries

This phase does NOT:
- Skip decision points (Phase 60)
- Auto-chain to discuss-phase (Phase 61)
- Simplify brainstorm routing (Phase 62)

## Key Risks

1. **Workflow markdown parsing**: new-milestone.md is a markdown instruction file read by orchestrators, not executable code. Changes must follow the existing step/instruction patterns exactly.
2. **Test scope**: Only `init.cjs` has testable code changes. The workflow markdown changes are tested via success criteria (integration tests are manual).

## RESEARCH COMPLETE
