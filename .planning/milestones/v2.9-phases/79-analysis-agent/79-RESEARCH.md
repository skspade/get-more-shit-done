# Phase 79: Analysis Agent - Research

**Researched:** 2026-03-21
**Status:** Complete

## Phase Boundary

Create `agents/gsd-test-reviewer.md` — a read-only analysis agent that receives diff data from the `/gsd:test-review` command (Phase 78) and produces a structured markdown report identifying test coverage gaps, stale tests, missing test files, and consolidation opportunities.

## Existing Patterns

### Agent Template: gsd-test-steward.md

The test steward at `agents/gsd-test-steward.md` is the closest template:
- **Frontmatter:** name, description, tools (Read, Bash, Grep, Glob — no Write), color
- **Sections:** `<role>`, `<input>`, `<process>` (6 steps), `<output>`, `<success_criteria>`
- **CRITICAL CONSTRAINT block** in `<role>` — enforces read-only behavior
- **Mandatory Initial Read** instruction for `<files_to_read>` blocks
- **Structured return:** `## STEWARD COMPLETE` with mode, budget, findings count, then full report
- **Error return:** `## STEWARD SKIPPED` with reason
- **Strategy vocabulary:** prune, parameterize, promote, merge — each with trigger, proposal template, estimated reduction
- **Budget thresholds:** OK (<80%), Warning (80-99%), Over Budget (>=100%)

### Command Integration: test-review.md

The command at `~/.claude/commands/gsd/test-review.md` (Phase 78):
- Spawns agent via `Task()` with `subagent_type="gsd-test-reviewer"` and `model="{reviewer_model}"`
- Passes `<test-review-input>` XML block containing: mode (standard/large-diff), diff base, changed files list, test count, test config JSON, and either full diff or stat summary
- Writes agent's raw output as the report file — agent output IS the report
- Expects agent to first read its own agent file, then `<files_to_read>` block

### Key Differences from Test Steward

| Aspect | Test Steward | Test Reviewer (Phase 79) |
|--------|-------------|-------------------------|
| Scope | Full test suite | Diff-scoped (changed files only) |
| Trigger | Milestone audit / on-demand | PR/branch review |
| Input | `<steward_input>` XML | `<test-review-input>` XML |
| Redundancy | Full pair-wise scan | Not needed (diff-scoped) |
| Staleness | All test files | Only tests related to changed files |
| Coverage | Full suite budget | Gaps in changed/new exports |
| Return header | `## STEWARD COMPLETE` | `## REVIEWER COMPLETE` |

## Implementation Details

### 6-Step Process (from CONTEXT.md)

1. **Parse Diff** — Parse `<test-review-input>` XML, categorize changed files as new/modified/deleted
2. **Coverage Gap Analysis** — Map changed source files to test files (naming + import tracing), check for missing test files and untested exports
3. **Staleness Detection** — Cross-reference diff deletions (removed function defs) with test assertions in related test files
4. **Consolidation Analysis** — Apply prune/parameterize/promote/merge vocabulary to diff-related test files only
5. **Generate Recommendations** — Priority-ordered action list with estimated budget impact
6. **Compile Report** — Structured markdown with summary stats, categorized findings, budget context

### Source-to-Test Mapping (AGT-01)

Two signals required (not naming alone):
1. **Naming conventions:** `foo.ts` -> `foo.test.ts`, `foo.spec.ts`
2. **Import tracing:** Grep test files for `require`/`import` statements referencing the changed source module

### Large Diff Mode

When `mode: large-diff`, the input has stat + file list instead of full diff. Agent must use Read/Grep tools to inspect specific files rather than relying on inline diff content.

### Report Structure (for downstream routing in Phase 80)

Summary stats must be parseable — counts of gaps, stale tests, consolidation items. Phase 80 routing checks if findings are zero to skip routing entirely.

### Test File Discovery Patterns

`**/*.{test,spec}.{js,ts,cjs,mjs}` excluding: `node_modules`, `.git`, `.planning`, `dist`, `build`, `coverage`, `e2e/`

## Requirements Coverage

| Requirement | How Addressed |
|-------------|--------------|
| AGT-01 | Source-to-test mapping via naming + import tracing |
| AGT-02 | Coverage gaps — new/modified exports without test assertions |
| AGT-03 | Missing test files — changed source with no corresponding test |
| AGT-04 | Stale tests — assertions referencing removed/renamed functions |
| AGT-05 | Consolidation — prune/parameterize/promote/merge scoped to diff |
| AGT-06 | Structured report with summary, categorized findings, priority actions |
| AGT-07 | Read-only — no Write/Edit tools, explicit constraint block |
| AGT-08 | Budget context — test count, status, estimated impact |

## Risk Assessment

- **Low risk:** Single file creation following an established pattern (test steward)
- **No new dependencies:** Agent uses only Read, Bash, Grep, Glob
- **No test infrastructure needed:** Agent is a prompt file, not code

## RESEARCH COMPLETE

---
*Phase: 79-analysis-agent*
*Research completed: 2026-03-21*
