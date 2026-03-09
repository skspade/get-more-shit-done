# PR Review Kit to GSD Workflow Integration — Design

**Date:** 2026-03-09
**Approach:** Standalone Workflow (Linear Pattern)

## Command Specification

`/gsd:pr-review` — a new GSD command that runs or ingests a PR review, captures findings, deduplicates via file-region grouping, scores complexity, and routes to quick task or milestone.

**Arguments:**
- No args → runs `/pr-review-toolkit:review-pr` fresh, captures output
- `--ingest` → prompts user to paste or provide a pre-existing review summary
- `--quick` / `--milestone` → force routing override (mutually exclusive, like Linear)
- `--full` → enables plan-checker and verifier (like Linear's `--full`)
- Review aspect args (e.g., `code errors tests`) → passed through to the toolkit when running fresh

**Command spec file:** `commands/pr-review.md` in the GSD directory, following the same YAML frontmatter pattern as `linear.md`'s command spec.

**Workflow file:** `workflows/pr-review.md` — the main workflow logic.

## Review Capture

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for:
- `--ingest` flag → `$INGEST_MODE` (true/false)
- `--quick` / `--milestone` flags → routing overrides
- `--full` flag → `$FULL_MODE`
- Remaining tokens → `$REVIEW_ASPECTS` (passed to toolkit)

Error if both `--quick` and `--milestone` present.

**Step 2: Run or ingest review**

**If NOT `$INGEST_MODE`:**
1. Run `git diff --name-only` to verify there are changes to review
2. If no changes, error: "No changes detected. Stage or commit changes before running a review."
3. Execute the PR review toolkit by invoking `/pr-review-toolkit:review-pr ${REVIEW_ASPECTS}` via the Skill tool
4. Capture the aggregated output (the "PR Review Summary" with Critical/Important/Suggestions sections)
5. Store as `$RAW_REVIEW`

**If `$INGEST_MODE`:**
1. Use `AskUserQuestion` to ask the user to paste the review output
2. Store response as `$RAW_REVIEW`

**Step 3: Parse findings**

Parse `$RAW_REVIEW` into structured findings array. Each finding has:
```
{
  severity: "critical" | "important" | "suggestion",
  agent: "code-reviewer" | "silent-failure-hunter" | etc,
  description: "Issue description text",
  file: "path/to/file.js",
  line: 42,
  fix_suggestion: "Concrete fix text"
}
```

Parsing uses the review toolkit's output format:
- Lines under `## Critical Issues` → severity "critical"
- Lines under `## Important Issues` → severity "important"
- Lines under `## Suggestions` → severity "suggestion"
- `[agent-name]:` prefix → agent field
- `[file:line]` suffix → file and line fields

If no findings parsed (empty review or all strengths), display "No actionable issues found." and exit.

## Deduplication and File-Region Grouping

**Step 4: Deduplicate and group findings**

Group findings by file proximity:

1. **Sort** all findings by `file` path, then by `line` number
2. **Group** findings that share the same file AND have lines within 20 lines of each other into a single "file-region group"
3. **Merge** overlapping groups (if finding A overlaps with B, and B overlaps with C, all three become one group)

Each file-region group becomes:
```
{
  id: "group-1",
  primary_file: "path/to/file.js",
  line_range: [start, end],
  findings: [array of original findings in this region],
  max_severity: "critical" | "important" | "suggestion",
  agents_involved: ["code-reviewer", "silent-failure-hunter"]
}
```

Findings with no file/line reference (general observations) get their own group each.

**Display dedup summary:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PR REVIEW FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Raw findings: {N}
After dedup: {N} file-region groups

◆ {group.primary_file}:{group.line_range} — {group.max_severity} ({N} findings from {agents})
◆ {group.primary_file}:{group.line_range} — {group.max_severity} ({N} findings from {agents})
...
```

## Persistence and Scoring

**Step 5: Write permanent review report**

Write to `.planning/reviews/YYYY-MM-DD-pr-review.md`:

```markdown
---
date: YYYY-MM-DD
source: pr-review-toolkit
total_findings: {N}
groups: {N}
critical: {N}
important: {N}
suggestions: {N}
---

# PR Review Report

## Summary

{N} findings from {agents list}, grouped into {N} file-region groups.

## Groups

### Group 1: {primary_file}:{line_range}

**Severity:** {max_severity}
**Agents:** {agents_involved}

| # | Severity | Agent | Description | Line | Fix |
|---|----------|-------|-------------|------|-----|
| 1 | critical | code-reviewer | ... | 42 | ... |
| 2 | important | silent-failure-hunter | ... | 45 | ... |

### Group 2: ...
```

Create directory if needed: `mkdir -p .planning/reviews`

**Step 6: Write temporary routing context**

Write `.planning/review-context.md`:

```markdown
---
review_report: .planning/reviews/YYYY-MM-DD-pr-review.md
route: {quick|milestone}
score: {N}
groups: {N}
---
# Review Context

Temporary file consumed by GSD routing. Deleted after task/milestone creation.
```

**Step 7: Score and route**

Compute `$REVIEW_SCORE`:

| Condition | Points |
|-----------|--------|
| Each critical finding | +2 |
| Each important finding | +1 |
| Each suggestion | +0 |
| Per 5 distinct files affected | +1 |

**Minimum score is 0.**

Route decision:
- `$FORCE_QUICK` → quick (override)
- `$FORCE_MILESTONE` → milestone (override)
- `$REVIEW_SCORE >= 5` → milestone
- `$REVIEW_SCORE < 5` → quick

Display: `Routing: {route} (score: {$REVIEW_SCORE})`

## Quick Route Execution

**Step 8: Quick route**

If `$ROUTE == "quick"`:

**8a. Synthesize description:**

Build `$DESCRIPTION` from the grouped findings:
- Title: "Fix PR review issues: {N} groups across {files}"
- Body: For each file-region group, include the primary file, severity, and a one-line summary of the findings
- Truncate total to 2000 chars

**8b. Initialize:**

```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "$DESCRIPTION")
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init pr-review)
```

Parse INIT JSON (same fields as `init linear`).

**8c. Create task directory:**

```bash
QUICK_DIR=".planning/quick/${next_num}-${SLUG}"
mkdir -p "$QUICK_DIR"
```

**8d. Spawn planner:**

The planner receives the full review report as context. Each file-region group maps to a plan task. The planner prompt includes:

```
<planning_context>
**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<review_findings>
${For each file-region group:}
### Group ${id}: ${primary_file}:${line_range}
Severity: ${max_severity}
Findings:
${For each finding in group:}
- [${agent}] ${description} (line ${line}) — Fix: ${fix_suggestion}
${end}
${end}
</review_findings>

<files_to_read>
- .planning/reviews/YYYY-MM-DD-pr-review.md (Full review report)
- .planning/STATE.md
- ./CLAUDE.md (if exists)
</files_to_read>
</planning_context>

<constraints>
- Create a SINGLE plan with one task per file-region group
- Each task targets one file-region group — include ALL findings from that group
- Tasks should reference the specific fix suggestions from the review
- Do NOT split a file-region group across multiple tasks
${FULL_MODE constraints if applicable}
</constraints>
```

**8e-8i:** Follow the same plan-checker (if `$FULL_MODE`), executor, verification, STATE.md update, and final commit steps as the Linear quick route — substituting "PR Review" for "Linear" in labels and banners.

STATE.md row includes a "Source" notation of `pr-review` instead of a Linear issue ID.

## Milestone Route and Cleanup

**Step 9: Milestone route**

If `$ROUTE == "milestone"`:

**9a. Build MILESTONE-CONTEXT.md:**

```markdown
# Milestone Context

**Source:** PR Review (.planning/reviews/YYYY-MM-DD-pr-review.md)
**Findings:** {N} issues in {N} file-region groups
**Score:** {$REVIEW_SCORE}

## Milestone Goal

Resolve all critical and important issues identified by PR review across {N} files.

## Features

${For each file-region group:}
### Fix: ${primary_file} (${max_severity})

${For each finding in group:}
- [${agent}] ${description} (line ${line})
  Fix: ${fix_suggestion}
${end}
${end}
```

Write to `.planning/MILESTONE-CONTEXT.md`.

**9b. Initialize and execute new-milestone workflow:**

Same as Linear milestone route — call `gsd-tools.cjs init new-milestone`, parse JSON, execute new-milestone workflow steps 1-11 inline. The MILESTONE-CONTEXT.md provides the goal and features, replacing the questioning phase.

**Step 10: Cleanup**

Delete temporary routing context:
```bash
rm -f .planning/review-context.md
```

The permanent review report at `.planning/reviews/YYYY-MM-DD-pr-review.md` is **kept** — it serves as an audit trail.

**Step 11: Completion display**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PR REVIEW COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: PR Review ({N} findings → {N} groups)
Route: {quick|milestone}
Report: .planning/reviews/YYYY-MM-DD-pr-review.md
{If quick: Directory: ${QUICK_DIR}}
{If quick: Commit: ${commit_hash}}
{If milestone: Milestone: v{X.Y} {name}}
```
