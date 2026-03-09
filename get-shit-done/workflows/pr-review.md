<purpose>
Run a PR review workflow that captures findings from a fresh toolkit review or ingests a pre-existing review summary, then extracts structured findings, deduplicates by file proximity, and persists results for downstream scoring and routing.

- Parses arguments for mode flags (--ingest, --quick, --milestone, --full) and review aspect args
- Captures review output via fresh toolkit invocation or user-pasted ingest
- Parses raw review into structured findings with severity, agent, file, line, and fix suggestion
- Exits cleanly when no actionable issues are found
- Deduplicates findings by file proximity (20-line threshold) with transitive merging
- Writes permanent review report and temporary routing context
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for:
- `--ingest` flag -> `$INGEST_MODE` (true/false)
- `--quick` flag -> `$FORCE_QUICK` (true/false)
- `--milestone` flag -> `$FORCE_MILESTONE` (true/false)
- `--full` flag -> `$FULL_MODE` (true/false)
- Remaining tokens (not flags) -> `$REVIEW_ASPECTS` (array of aspect strings, e.g., ["security", "performance"])

**If both `--quick` and `--milestone` are present:** Error — "Cannot use both --quick and --milestone flags."

Store results:
- `$INGEST_MODE` — boolean
- `$FORCE_QUICK` — boolean
- `$FORCE_MILESTONE` — boolean
- `$FULL_MODE` — boolean
- `$REVIEW_ASPECTS` — array of aspect strings

---

**Step 2: Capture review**

**Fresh mode** (when `$INGEST_MODE` is false):

Invoke `/pr-review-toolkit:review-pr` via the Skill tool, passing `$REVIEW_ASPECTS` as aspect arguments. If `$FULL_MODE` is true, pass `--full` to the toolkit as well.

Capture the aggregated output as `$RAW_REVIEW`.

**Ingest mode** (when `$INGEST_MODE` is true):

```
AskUserQuestion(
  header: "PR Review Ingest",
  question: "Paste or provide the PR review summary:",
  followUp: null
)
```

Store the user's response as `$RAW_REVIEW`.

---

**Step 3: Parse findings**

Parse `$RAW_REVIEW` into a structured findings array. Track the current severity section as you scan through the review output.

**Severity mapping from section headers:**
- `## Critical Issues` -> severity: "critical"
- `## Important Issues` -> severity: "important"
- `## Suggestions` -> severity: "suggestion"

**For each finding within a severity section, extract:**
- `severity`: From the current section header (mapped above)
- `agent`: Extract from `[agent-name]:` prefix pattern at the start of the finding text. If no agent prefix, set to null.
- `description`: The finding text content (after agent prefix, before file reference)
- `file`: Extract from file path reference patterns like `path/to/file.ext:123` or `[path/to/file.ext:123]`. Set to null if no file reference found.
- `line`: Extract the line number from the file reference. Set to null if no line number found.
- `fix_suggestion`: Extract suggested fix text if present (often after "Fix:" or "Suggestion:" prefix within the finding). Set to null if no fix suggestion found.

**Result:** `$FINDINGS` — array of structured finding objects:
```
{
  severity: "critical" | "important" | "suggestion",
  agent: string | null,
  description: string,
  file: string | null,
  line: number | null,
  fix_suggestion: string | null
}
```

**If `$FINDINGS` is empty (no findings parsed):**

Display: "No actionable issues found."

Exit the workflow cleanly. This is a success condition — the review ran but found nothing to act on.

---

**Step 4: Deduplicate and group findings**

Group `$FINDINGS` by file proximity to reduce noise and cluster related issues.

**4a. Sort findings:**

Sort `$FINDINGS` by `file` path (alphabetical), then by `line` number (ascending). Findings with null `file` or `line` go last.

**4b. Group by proximity:**

Iterate sorted findings. For each finding:
- If it shares the same `file` as the previous finding AND the `line` difference is <= 20, add it to the current group.
- Otherwise, start a new group.
- Findings with null `file` or `line` each become their own single-finding group.

**4c. Merge overlapping groups transitively:**

After initial grouping, check if any adjacent groups share the same file and have overlapping or touching line ranges (group A's max line + 20 >= group B's min line). If so, merge them into one group. Repeat until no more merges occur.

**4d. Assign group metadata:**

For each group, compute:
- `id`: `"group-N"` (sequential from 1)
- `primary_file`: the shared file path (or null for general observations)
- `line_range`: `[min_line, max_line]` across all findings in the group
- `findings`: array of original finding objects in this group
- `max_severity`: highest severity using priority order: critical > important > suggestion
- `agents_involved`: deduplicated list of agent names from findings in this group

Store result as `$GROUPS` array.

**4e. Display dedup summary:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PR REVIEW FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Raw findings: {N}
After dedup: {N} file-region groups

◆ {group.primary_file}:{group.line_range[0]}-{group.line_range[1]} — {group.max_severity} ({N} findings from {agents_involved joined with ", "})
◆ ...
```

For single-line groups (where line_range start equals end), display as `{file}:{line}` without the range dash. For groups with null file (general observations), display as `(general observation)`.

---

**Step 5: Write permanent review report**

Create the reviews directory if it does not exist:

```bash
mkdir -p .planning/reviews
```

Write to `.planning/reviews/YYYY-MM-DD-pr-review.md` (using today's date):

```markdown
---
date: YYYY-MM-DD
source: pr-review-toolkit
total_findings: {total count of original findings}
groups: {count of groups}
critical: {count of findings with severity "critical"}
important: {count of findings with severity "important"}
suggestions: {count of findings with severity "suggestion"}
---

# PR Review Report

## Summary

{total_findings} findings from {unique agents list}, grouped into {groups} file-region groups.

## Groups

### Group {id}: {primary_file}:{line_range[0]}-{line_range[1]}

**Severity:** {max_severity}
**Agents:** {agents_involved joined with ", "}

| # | Severity | Agent | Description | Line | Fix |
|---|----------|-------|-------------|------|-----|
| 1 | {severity} | {agent} | {description} | {line} | {fix_suggestion or "—"} |

{repeat ### Group section for each group}
```

For groups with null file (general observations), use the group's description text as the header instead of file:line_range.

---

**Step 6: Write temporary routing context**

Write `.planning/review-context.md`:

```markdown
---
review_report: .planning/reviews/YYYY-MM-DD-pr-review.md
route: ""
score: ""
groups: {count of groups}
---
# Review Context

Temporary file consumed by GSD routing. Deleted after task/milestone creation.
```

The `route` and `score` fields are empty placeholders — Phase 42 populates them after scoring.

---

**Step 7: Score and route**

**7a. Check flag overrides first:**

**If `$FORCE_QUICK`:**
- Set `$ROUTE = "quick"`
- Set `$REVIEW_SCORE = "override"`
- Display: "Route: QUICK (flag override)"
- Skip scoring, proceed to Step 8.

**If `$FORCE_MILESTONE`:**
- Set `$ROUTE = "milestone"`
- Set `$REVIEW_SCORE = "override"`
- Display: "Route: MILESTONE (flag override)"
- Skip scoring, proceed to Step 8.

**7b. Compute score from `$GROUPS`:**

Start `$REVIEW_SCORE` at 0. Iterate all findings across all groups:
- For each finding with severity "critical": +2
- For each finding with severity "important": +1
- For each finding with severity "suggestion": +0

Then count distinct files across all groups (deduplicate `primary_file` values, excluding null). Add +1 per 5 distinct files (integer division: `Math.floor(distinct_files / 5)`).

Minimum score is 0 (cannot go negative).

**7c. Route decision:**
- If `$REVIEW_SCORE >= 5`: set `$ROUTE = "milestone"`
- If `$REVIEW_SCORE < 5`: set `$ROUTE = "quick"`

Display: `Routing: {$ROUTE} (score: {$REVIEW_SCORE})`

**7d. Update review-context.md:**

Read `.planning/review-context.md`. Update the YAML frontmatter:
- Set `route:` to `$ROUTE` (replacing the empty placeholder)
- Set `score:` to `$REVIEW_SCORE` (replacing the empty placeholder)

Write the updated file back.

---

**Step 8: Quick route**

If `$ROUTE == "quick"`:

**8a. Synthesize description:**

Build `$DESCRIPTION` from the grouped findings:
- Title line: `"Fix PR review issues: {N} groups across {distinct_files_count} files"`
- Body: For each file-region group, append: `"- {primary_file}:{line_range} ({max_severity}, {findings_count} findings)"`
- Truncate total `$DESCRIPTION` to 2000 chars

**8b. Initialize:**

```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "$DESCRIPTION")
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init pr-review)
```

Parse INIT JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `next_num`, `date`, `timestamp`, `quick_dir`, `state_path`, `roadmap_path`, `planning_exists`, `roadmap_exists`.

**If `roadmap_exists` is false:** Error — "Quick mode requires an active project with ROADMAP.md. Run `/gsd:new-project` first."

**8c. Create task directory:**

```bash
mkdir -p "${quick_dir}"
QUICK_DIR=".planning/quick/${next_num}-${SLUG}"
mkdir -p "$QUICK_DIR"
```

Display:
```
Creating quick task ${next_num}: Fix PR review issues
Directory: ${QUICK_DIR}
Source: pr-review
```

**8d. Spawn planner (quick mode):**

The planner prompt includes review findings as context. Each file-region group maps to one plan task.

```
Task(
  prompt="
<planning_context>

**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<review_findings>
${For each file-region group:}
### Group ${id}: ${primary_file}:${line_range[0]}-${line_range[1]}
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
${FULL_MODE ? '- Target ~40% context usage (structured for verification)' : '- Target ~30% context usage (simple, focused)'}
${FULL_MODE ? '- MUST generate must_haves in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have files, action, verify, done fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: Fix PR review issues"
)
```

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${next_num}-PLAN.md`
2. Report: "Plan created: ${QUICK_DIR}/${next_num}-PLAN.md"

If plan not found, error: "Planner failed to create ${next_num}-PLAN.md"

**8e. Plan-checker loop (only when `$FULL_MODE`):**

Skip if NOT `$FULL_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Checker prompt:

```markdown
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Plan to verify)
</files_to_read>

**Scope:** This is a quick task, not a full phase. Skip checks that require a ROADMAP phase goal.
</verification_context>

<check_dimensions>
- Requirement coverage: Does the plan address the task description?
- Task completeness: Do tasks have files, action, verify, done fields?
- Key links: Are referenced files real?
- Scope sanity: Is this appropriately sized for a quick task (1 task per file-region group)?
- must_haves derivation: Are must_haves traceable to the task description?

Skip: context compliance (no CONTEXT.md), cross-plan deps (single plan), ROADMAP alignment
</check_dimensions>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Check quick plan: Fix PR review issues"
)
```

Handle checker return:
- `## VERIFICATION PASSED`: Display confirmation, proceed to 8f.
- `## ISSUES FOUND`: Display issues, enter revision loop (max 2 iterations).

**8f. Spawn executor:**

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
  description="Execute: Fix PR review issues"
)
```

After executor returns:
1. Verify summary exists at `${QUICK_DIR}/${next_num}-SUMMARY.md`
2. Extract commit hash from executor output
3. Report completion status

**Known Claude Code bug (classifyHandoffIfNeeded):** If executor reports "failed" with error `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Check if summary file exists and git log shows commits. If so, treat as successful.

If summary not found, error: "Executor failed to create ${next_num}-SUMMARY.md"

**8g. Verification (only when `$FULL_MODE`):**

Skip if NOT `$FULL_MODE`.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning verifier...
```

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Plan)
</files_to_read>

Check must_haves against actual codebase. Create VERIFICATION.md at ${QUICK_DIR}/${next_num}-VERIFICATION.md.",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify: Fix PR review issues"
)
```

Handle verification status:
- `passed`: Store `$VERIFICATION_STATUS = "Verified"`, continue
- `human_needed`: Display items needing manual check, store `$VERIFICATION_STATUS = "Needs Review"`, continue
- `gaps_found`: Display gap summary, offer: 1) Re-run executor, 2) Accept as-is. Store `$VERIFICATION_STATUS = "Gaps"`

**8h. Update STATE.md:**

Read STATE.md. Check for `### Quick Tasks Completed` section.

If section does not exist, create it after `### Blockers/Concerns` section.

Check if table has a "Source" column. If not, add it to header and separator rows. The table format should be:

```markdown
| # | Description | Date | Commit | Source | Directory |
|---|-------------|------|--------|--------|-----------|
```

If table currently has a "Linear" column instead of "Source", rename the column header from "Linear" to "Source" so the table accommodates both linear and pr-review entries.

Append new row:
```markdown
| ${next_num} | Fix PR review issues: ${groups_count} groups | ${date} | ${commit_hash} | pr-review | [${next_num}-${SLUG}](./quick/${next_num}-${SLUG}/) |
```

Update "Last activity" line:
```
Last activity: ${date} - Completed quick task ${next_num}: Fix PR review issues
```

**8i. Final commit and completion:**

Build file list:
- `${QUICK_DIR}/${next_num}-PLAN.md`
- `${QUICK_DIR}/${next_num}-SUMMARY.md`
- `.planning/STATE.md`
- `.planning/review-context.md`
- If `$FULL_MODE` and verification exists: `${QUICK_DIR}/${next_num}-VERIFICATION.md`

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(quick-${next_num}): Fix PR review issues" --files ${file_list}
```

Get commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PR REVIEW QUICK TASK COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: PR Review ({N} findings -> {N} groups)
Route: Quick task
Directory: ${QUICK_DIR}
Commit: ${commit_hash}
```

---

**Steps 9-11: Milestone Route and Cleanup**

(Implemented in Phase 43)

</process>
