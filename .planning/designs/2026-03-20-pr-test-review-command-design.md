# PR Test Review Command — Design

**Date:** 2026-03-20
**Approach:** Diff-Aware Test Steward Agent

## Command Specification

`/gsd:test-review` — a command that analyzes the current branch's diff against main and produces test recommendations.

**Command file:** `commands/gsd/test-review.md`

**Arguments:** Free-text arguments are ignored (no arguments needed — always diffs against main).

**Flags:**
- `--report-only` — Skip routing prompt, just produce the report (for sharing with others)

**Process:**
1. Run `git diff main...HEAD --name-only` to get changed files
2. If no diff exists, display "No changes found vs main" and exit
3. Run `git diff main...HEAD` to get the full diff
4. Gather test data: `gsd-tools.cjs test-count`, `gsd-tools.cjs test-config`, find test files
5. Display banner with changed file count and test count
6. Spawn `gsd-test-reviewer` agent with diff + test data
7. Receive and display the structured report
8. Write report to `.planning/reviews/YYYY-MM-DD-test-review.md`
9. If `--report-only`, exit after writing report
10. Otherwise, ask user: "Fix these? (quick task / milestone / done)"
11. Route based on selection using existing quick task or milestone patterns

## Agent Definition

**Agent file:** `agents/gsd-test-reviewer.md`

**Type:** Read-only analysis agent (like gsd-test-steward — never modifies files)

**Tools:** Read, Bash, Grep, Glob

**Input block** (provided by the command):
```xml
<test-review-input>
  <diff>{full git diff main...HEAD}</diff>
  <changed_files>{newline-separated list of changed files}</changed_files>
  <test_count>{total test count}</test_count>
  <test_config>{test configuration JSON}</test_config>
  <test_files>{list of existing test files}</test_files>
</test-review-input>
```

**6-step process:**

1. **Parse Diff** — Extract changed files, functions, classes, and modules from the diff. Categorize as: new files, modified files, deleted files.

2. **Coverage Gap Analysis** — For each changed source file, check if a corresponding test file exists (naming conventions: `foo.ts` → `foo.test.ts`, `foo.spec.ts`). For new/modified functions, check if test cases covering them exist. Flag files and functions lacking test coverage.

3. **Staleness Detection** — For each existing test file that references changed source files, check if the test assertions still align with the changed code. Flag tests that reference renamed/removed functions, changed signatures, or deleted modules.

4. **Consolidation Analysis** — Across test files touched by or related to the diff, identify: duplicate test cases, overlapping coverage that could be parameterized, tests that could be merged. Uses same strategy vocabulary as test steward (prune, parameterize, promote, merge).

5. **Generate Recommendations** — Produce structured recommendations in three categories:
   - **Missing Tests:** `{file, function/export, reason, priority}`
   - **Stale Tests:** `{test_file, test_name, issue, suggested_action}`
   - **Consolidation:** `{strategy, source_tests, action, estimated_reduction}`

6. **Compile Report** — Assemble markdown report with summary stats, categorized findings, and priority-ordered action items.

**Output format:**
```markdown
# Test Review Report

**Branch:** {branch name}
**Changed files:** {count}
**Existing tests:** {count}

## Summary
- {N} missing test coverage gaps
- {N} stale tests needing updates
- {N} consolidation opportunities

## Missing Test Coverage
{table of gaps with file, function, priority}

## Stale Tests
{table of stale tests with file, issue, action}

## Consolidation Opportunities
{table of proposals with strategy, source, action, estimated reduction}

## Recommended Actions
{priority-ordered list of what to do}
```

## Report Persistence and Routing

**Report output:** `.planning/reviews/YYYY-MM-DD-test-review.md`
- Uses the same `reviews/` directory as pr-review reports
- Committed to git so it persists for reference

**Routing flow (when not `--report-only`):**

After displaying the report, prompt the user:
- **"Quick task"** — Create a quick task directory with the test recommendations as context. The planner gets the report as input and creates plan tasks for each recommendation group (missing tests → write tests, stale tests → update tests, consolidation → refactor tests).
- **"Milestone"** — Write MILESTONE-CONTEXT.md from the report findings and delegate to `/gsd:new-milestone --auto`. Used when the test gaps are substantial enough to warrant a full milestone.
- **"Done"** — Exit. The report is already written and committed — user can share it or act on it later.

**Quick task context format:**
```xml
<test-review-findings>
  <source>git diff main...HEAD</source>
  <report>.planning/reviews/YYYY-MM-DD-test-review.md</report>
  {For each recommendation group:}
  <group type="{missing|stale|consolidation}">
    <file>{file}</file>
    <action>{what to do}</action>
  </group>
</test-review-findings>
```

**Milestone context:** Same structure as brainstorm's MILESTONE-CONTEXT.md — each recommendation category becomes a feature section.

## Integration with Existing Infrastructure

**Reused components:**
- **`testing.cjs`** — `findTestFiles()`, `countTestsInProject()`, `getTestConfig()` for gathering test data
- **`gsd-tools.cjs`** — `test-count`, `test-config` dispatch entries for CLI access
- **`gsd-tools.cjs commit`** — For committing the report
- **Quick task infrastructure** — Same directory structure and planner/executor pattern as pr-review quick tasks

**No modifications to existing files needed** — This is purely additive:
- New: `commands/gsd/test-review.md` (command spec)
- New: `agents/gsd-test-reviewer.md` (agent definition)
- Updated: `commands/gsd/help.md` (add command to reference)
- Updated: `USER-GUIDE.md` and `README.md` (documentation)

**Test steward relationship:** The test-reviewer agent is independent from gsd-test-steward. They share vocabulary (prune/parameterize/promote/merge strategies) but serve different triggers — steward runs during milestone audits on the full test suite, reviewer runs on-demand scoped to PR changes. No code sharing needed; the agent prompt carries the strategy definitions.
