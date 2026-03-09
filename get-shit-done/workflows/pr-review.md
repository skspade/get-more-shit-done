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

**Steps 7-11: Scoring, Routing, and Cleanup**

(Implemented in Phases 42-43)

</process>
