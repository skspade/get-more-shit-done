---
name: gsd:test-review
description: Analyze git diff for test coverage gaps, stale tests, and consolidation opportunities
argument-hint: "[--report-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
  - SlashCommand
---
<objective>
Gather the git diff vs main, display a banner with stats, spawn the gsd-test-reviewer agent for analysis, write the report to disk, and route to quick task or milestone based on user choice.

**This command IS the orchestrator.** It gathers diff data, spawns the reviewer agent, persists the report, handles edge cases (no diff, large diff, --report-only), and routes findings to quick task or milestone.
</objective>

<execution_context>
No workflow file needed -- this is a direct agent spawn.
</execution_context>

<context>
$ARGUMENTS

Core data resolved at runtime:
- Diff: gathered via `git diff` against resolved base branch
- Test count: via `gsd-tools.cjs test-count --raw`
- Test config: via `gsd-tools.cjs test-config`
- Reviewer model: via init JSON `reviewer_model`
- Quick task data: via init JSON `next_num`, `quick_dir`, `planner_model`, `executor_model`
</context>

<process>

## 1. Parse Arguments

Parse `$ARGUMENTS` for `--report-only` flag. Store as `$REPORT_ONLY` (true/false).

## 2. Initialize

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init test-review)
```

Extract from JSON: `reviewer_model`, `planner_model`, `executor_model`, `date`, `commit_docs`, `next_num`, `quick_dir`, `roadmap_exists`, `state_path`.

## 3. Resolve Diff Base

Fetch and find a valid base reference:

```bash
git fetch origin main --quiet 2>/dev/null || true

DIFF_BASE=""
for ref in origin/main origin/master main master; do
  if git rev-parse --verify "$ref" >/dev/null 2>&1; then
    DIFF_BASE="$ref"
    break
  fi
done
```

**If no base found:** Display error and exit:
```
No base branch found. Tried: origin/main, origin/master, main, master.
```

## 4. Gather Diff

```bash
DIFF=$(git diff "$DIFF_BASE"...HEAD)
```

**If diff is empty:** Display message and exit gracefully:
```
No changes found vs ${DIFF_BASE}. Nothing to review.
```

## 5. Measure Diff and Extract Files

```bash
DIFF_LINES=$(echo "$DIFF" | wc -l | tr -d ' ')
CHANGED_FILES=$(echo "$DIFF" | grep '^diff --git' | sed 's|.*b/||')
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
```

**If DIFF_LINES > 2000 (large diff mode):**
```bash
DIFF_STAT=$(git diff "$DIFF_BASE"...HEAD --stat)
LARGE_DIFF=true
```

Otherwise set `LARGE_DIFF=false`.

## 6. Gather Test Data

```bash
TEST_COUNT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-count --raw 2>/dev/null || echo "0")
TEST_CONFIG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-config 2>/dev/null || echo "{}")
```

Parse budget from TEST_CONFIG: extract `budget.project` value (default 800). Calculate budget percentage: `TEST_COUNT / budget * 100`.

## 7. Display Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changed files: {FILE_COUNT}
Test count: {TEST_COUNT}/{budget} ({percentage}%)
Diff size: {DIFF_LINES} lines {(summarized) if LARGE_DIFF}

◆ Spawning test reviewer...
```

## 8. Spawn Agent

```
Task(
  prompt="First, read /Users/seanspade/.claude/agents/gsd-test-reviewer.md for your role and instructions.

<files_to_read>
- ./CLAUDE.md (if exists -- project instructions)
</files_to_read>

<test-review-input>
**Mode:** {standard | large-diff}
**Diff base:** {DIFF_BASE}
**Changed files ({FILE_COUNT}):**
{CHANGED_FILES list, one per line}

**Test count:** {TEST_COUNT}
**Test config:** {TEST_CONFIG JSON}

{If LARGE_DIFF is false:}
**Full diff:**
```
{DIFF content}
```

{If LARGE_DIFF is true:}
**Diff stat:**
```
{DIFF_STAT}
```
NOTE: Full diff exceeds 2000 lines. Use Read and Grep tools to inspect specific files as needed.
</test-review-input>

Analyze the diff and produce a structured test review report.",
  subagent_type="gsd-test-reviewer",
  model="{reviewer_model}",
  description="Test review analysis"
)
```

## 9. Write Report

```bash
mkdir -p .planning/reviews
```

Write the agent's output to `.planning/reviews/{date}-test-review.md`.

## 10. Commit Report

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs: test review report" --files ".planning/reviews/{date}-test-review.md"
```

## 11. Handle --report-only Exit

**If `$REPORT_ONLY` is true:**

Display:
```
Report written to .planning/reviews/{date}-test-review.md
```

Exit. Do NOT proceed to routing.

## 12. Route Findings

### 12a. Parse Report Summary

After the agent returns its structured output (starting with `## REVIEWER COMPLETE`), parse the Summary table from the report. The Summary table has `| Metric | Value |` rows.

Extract numeric values for these four metrics:
- `Missing test files` -> `MISSING_COUNT`
- `Coverage gaps` -> `GAPS_COUNT`
- `Stale tests` -> `STALE_COUNT`
- `Consolidation opportunities` -> `CONSOLIDATION_COUNT`

Calculate `TOTAL_FINDINGS = MISSING_COUNT + GAPS_COUNT + STALE_COUNT + CONSOLIDATION_COUNT`.

**If agent returned `## REVIEWER SKIPPED` instead of `## REVIEWER COMPLETE`:** Display the skip reason and show completion banner (same as zero-recommendation path below). Do NOT attempt routing.

### 12b. Zero-Recommendation Check

**If `TOTAL_FINDINGS == 0`:**

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST REVIEW COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No issues found. All changed code has adequate test coverage.

Report: .planning/reviews/{date}-test-review.md
```

Exit. Do NOT proceed to routing.

### 12c. User Choice Prompt

Display the report content to the user, then prompt:

```
AskUserQuestion(
  header: "Test Review Routing",
  question: "How would you like to handle these findings?\n\nMissing test files: {MISSING_COUNT}\nCoverage gaps: {GAPS_COUNT}\nStale tests: {STALE_COUNT}\nConsolidation opportunities: {CONSOLIDATION_COUNT}\n\nChoose a route:",
  options: [
    "Quick task -- create a quick task to address findings now",
    "Milestone -- create a new milestone for comprehensive test improvement",
    "Done -- keep the report, no further action"
  ]
)
```

**If user chose "Done":** Display completion banner and exit:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST REVIEW COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report: .planning/reviews/{date}-test-review.md
```

Exit.

### 12d. Quick Task Route

**If user chose "Quick task":**

**Generate slug and create directory:**

```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "Fix test review findings")
QUICK_DIR=".planning/quick/${next_num}-${SLUG}"
mkdir -p "$QUICK_DIR"
```

Display:
```
Creating quick task ${next_num}: Fix test review findings
Directory: ${QUICK_DIR}
Source: test-review
```

**Build findings context.** Organize the agent's report findings by category into a `<review_findings>` block. Include only non-empty categories:

```
<review_findings>
### Missing Test Coverage
{List each missing test file finding from the report -- file, exports, priority}

### Coverage Gaps
{List each coverage gap finding -- function, source file, test file, priority}

### Stale Tests
{List each stale test finding -- test file, removed function, source file, priority}

### Consolidation Opportunities
{List each consolidation finding -- strategy, files, action, estimated impact}
</review_findings>
```

**Spawn planner (quick mode):**

```
Task(
  prompt="First, read /Users/seanspade/.claude/agents/gsd-planner.md for your role and instructions.

<planning_context>
**Mode:** quick
**Directory:** ${QUICK_DIR}
**Description:** Fix test review findings: ${TOTAL_FINDINGS} issues across ${MISSING_COUNT} missing, ${GAPS_COUNT} gaps, ${STALE_COUNT} stale, ${CONSOLIDATION_COUNT} consolidation

{review_findings block from above}

<files_to_read>
- .planning/reviews/{date}-test-review.md (Full review report)
- .planning/STATE.md
- ./CLAUDE.md (if exists)
</files_to_read>
</planning_context>

<constraints>
- Create a SINGLE plan with one task per non-empty finding category
- Each task addresses one category: missing coverage, coverage gaps, stale tests, or consolidation
- Tasks should reference the specific recommendations from the review report
- Target ~30% context usage (simple, focused)
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: Fix test review findings"
)
```

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${next_num}-PLAN.md`
2. Report: `Plan created: ${QUICK_DIR}/${next_num}-PLAN.md`

If plan not found, error: `Planner failed to create ${next_num}-PLAN.md`

**Spawn executor:**

```
Task(
  prompt="
Execute quick task ${next_num}.

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Plan)
- .planning/STATE.md (Project state)
- ./CLAUDE.md (Project instructions, if exists)
</files_to_read>

<constraints>
- Execute all tasks in the plan
- Commit each task atomically
- Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  description="Execute: Fix test review findings"
)
```

After executor returns:
1. Verify summary exists at `${QUICK_DIR}/${next_num}-SUMMARY.md`
2. Extract commit hash from executor output

**Known Claude Code bug (classifyHandoffIfNeeded):** If executor reports "failed" with error `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug -- not a real failure. Check if summary file exists and git log shows commits. If so, treat as successful.

If summary not found, error: `Executor failed to create ${next_num}-SUMMARY.md`

**Update STATE.md:**

Read STATE.md. Find the `### Quick Tasks Completed` table. Append a new row:

```markdown
| ${next_num} | Fix test review findings: ${TOTAL_FINDINGS} issues | ${date} | ${commit_hash} | test-review | [${next_num}-${SLUG}](./quick/${next_num}-${SLUG}/) |
```

Update the "Last activity" line:
```
Last activity: ${date} - Completed quick task ${next_num}: Fix test review findings
```

**Final commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(quick-${next_num}): fix test review findings" --files "${QUICK_DIR}/${next_num}-PLAN.md ${QUICK_DIR}/${next_num}-SUMMARY.md .planning/STATE.md"
```

Get commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

**Display completion banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TEST REVIEW COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Route: Quick task
Report: .planning/reviews/{date}-test-review.md
Directory: ${QUICK_DIR}
Commit: ${commit_hash}
```

### 12e. Milestone Route

**If user chose "Milestone":**

**Write MILESTONE-CONTEXT.md:**

Write to `.planning/MILESTONE-CONTEXT.md`:

```markdown
# Milestone Context

**Source:** Test Review (.planning/reviews/{date}-test-review.md)
**Findings:** {TOTAL_FINDINGS} issues

## Goal

Address test coverage gaps and cleanup identified by test review across {FILE_COUNT} files

## Features

{For each non-empty category:}

### Missing Coverage
{List each missing test file finding with source file and exported symbols}

### Coverage Gaps
{List each gap finding with function name, source file, and test file}

### Stale Tests
{List each stale test finding with test file and removed function references}

### Consolidation
{List each consolidation finding with strategy, files, and recommended action}
```

Only include category sections that have findings.

**Display:**
```
MILESTONE-CONTEXT.md written. Handing off to new-milestone...
```

**Delegate:**

Exit and invoke `SlashCommand("/gsd:new-milestone --auto")`

</process>
