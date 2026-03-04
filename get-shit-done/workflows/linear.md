<purpose>
Route Linear issues to GSD workflows. Fetches issue data from Linear via MCP tools, auto-routes to quick task or new milestone based on complexity scoring heuristic, and delegates to the appropriate GSD workflow end-to-end.

- Parses issue IDs and flags from arguments
- Fetches issue data and comments via Linear MCP tools
- Scores issue complexity to determine routing (quick vs milestone)
- Accepts override flags: `--quick`, `--milestone`, `--full`
- Delegates to quick workflow (steps 2-8) or new-milestone workflow (steps 1-11)
- Posts summary comments back to Linear issues after completion
- Cleans up temporary `.planning/linear-context.md` after comment-back
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for:
- Issue IDs: tokens matching `/[A-Z]+-\d+/gi` (e.g., `LIN-123`, `ENG-456`, `PROJ-7`)
- `--quick` flag → store as `$FORCE_QUICK` (true/false)
- `--milestone` flag → store as `$FORCE_MILESTONE` (true/false)
- `--full` flag → store as `$FULL_MODE` (true/false)

**If both `--quick` and `--milestone` are present:** Error — "Cannot use both --quick and --milestone flags."

**If no issue ID found after parsing:**

```
AskUserQuestion(
  header: "Linear Issue",
  question: "Enter the Linear issue ID (e.g., LIN-123):",
  followUp: null
)
```

Parse the response for issue IDs using the same pattern. If still no match, re-prompt: "Please provide a valid issue ID (e.g., LIN-123)."

Store results:
- `$ISSUE_IDS` — array of issue identifier strings
- `$FORCE_QUICK` — boolean
- `$FORCE_MILESTONE` — boolean
- `$FULL_MODE` — boolean

---

**Step 2: Fetch issue data**

For each issue ID in `$ISSUE_IDS`:

1. Call `mcp__plugin_linear_linear__get_issue` with:
   - `id`: the issue identifier (e.g., "LIN-123")
   - `includeRelations`: true

2. Call `mcp__plugin_linear_linear__list_comments` with:
   - `issueId`: the issue UUID returned from get_issue

3. Store results in `$ISSUES` array with structure:
   ```
   {
     id: UUID,
     identifier: "LIN-123",
     title: "Issue title",
     state: "In Progress",
     labels: ["bug", "frontend"],
     description: "Full description text",
     comments: [{body: "comment text", ...}],
     children: [{id, title}],  // sub-issues
     relations: [{type, relatedIssue}]  // blocking/related
   }
   ```

**On fetch failure:** Error with "Failed to fetch issue {ISSUE_ID}. Verify the issue ID exists and you have access."

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LINEAR ISSUE FETCHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

For each issue, display:
```
◆ {identifier}: {title}
  State: {state}
  Labels: {comma-separated labels, or "none"}
  Comments: {count}
```

---

**Step 3: Route via heuristic**

**If `$FORCE_QUICK`:**
- Set `$ROUTE = "quick"`
- Display: "Route: QUICK (flag override)"
- Skip scoring, proceed to Step 4.

**If `$FORCE_MILESTONE`:**
- Set `$ROUTE = "milestone"`
- Display: "Route: MILESTONE (flag override)"
- Skip scoring, proceed to Step 4.

**Otherwise, compute `$MILESTONE_SCORE`:**

Start at 0, then apply:

| Condition | Points |
|-----------|--------|
| Multiple issues (`$ISSUE_IDS` length > 1) | +3 |
| Any issue has sub-issues/children | +2 |
| Any issue description > 500 words | +1 |
| Any label matches "feature" or "epic" (case-insensitive) | +2 |
| Any label matches "bug", "fix", "chore", or "docs" (case-insensitive) | -1 |
| Any blocking or related issue relations | +1 |

**Minimum score is 0** (do not go negative).

**Route decision:**
- `$MILESTONE_SCORE >= 3` → set `$ROUTE = "milestone"`
- `$MILESTONE_SCORE < 3` → set `$ROUTE = "quick"`

Display: "Routing: {$ROUTE} (score: {$MILESTONE_SCORE})"

---

**Step 4: Write linear-context.md**

Write `.planning/linear-context.md`:

```markdown
---
issue_ids: [{comma-separated issue identifiers}]
route: {quick|milestone}
score: {$MILESTONE_SCORE or "override"}
fetched: {ISO date}
---
# Linear Context

Issues fetched for this workflow run.
Consumed by Phase 22 completion loop.
```

---

**Step 5: Execute route**

### Quick Route (WKFL-05)

**If `$ROUTE == "quick"`:**

**5a. Synthesize description:**

Build `$DESCRIPTION` from issue data:
- Start with first issue title
- Append "\n\n" + first issue description (truncated to 1500 chars)
- Append "\n\nLinear comments:\n" + first 3 comment bodies (each truncated to 200 chars)
- Truncate total `$DESCRIPTION` to 2000 chars

For multiple issues routed to quick (only possible via `--quick` flag override), use the first issue only.

**5b. Initialize:**

```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "$DESCRIPTION")
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init linear)
```

Parse INIT JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `next_num`, `date`, `timestamp`, `quick_dir`, `state_path`, `roadmap_path`, `planning_exists`, `roadmap_exists`.

**If `roadmap_exists` is false:** Error — "Quick mode requires an active project with ROADMAP.md. Run `/gsd:new-project` first."

**5c. Create task directory:**

```bash
mkdir -p "${quick_dir}"
QUICK_DIR=".planning/quick/${next_num}-${SLUG}"
mkdir -p "$QUICK_DIR"
```

Display:
```
Creating quick task ${next_num}: ${first issue title}
Directory: ${QUICK_DIR}
Linear: ${first issue identifier}
```

**5d. Spawn planner (quick mode):**

```
Task(
  prompt="
<planning_context>

**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md (Project State)
- ./CLAUDE.md (if exists — follow project-specific guidelines)
</files_to_read>

**Linear context:** Issue ${first issue identifier} — ${first issue title}

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
- No research phase
${FULL_MODE ? '- Target ~40% context usage (structured for verification)' : '- Target ~30% context usage (simple, focused)'}
${FULL_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: ${first issue title}"
)
```

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${next_num}-PLAN.md`
2. Report: "Plan created: ${QUICK_DIR}/${next_num}-PLAN.md"

If plan not found, error: "Planner failed to create ${next_num}-PLAN.md"

**5e. Plan-checker loop (only when `$FULL_MODE`):**

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
- Scope sanity: Is this appropriately sized for a quick task (1-3 tasks)?
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
  description="Check quick plan: ${first issue title}"
)
```

Handle checker return:
- **`## VERIFICATION PASSED`:** Display confirmation, proceed to 5f.
- **`## ISSUES FOUND`:** Display issues, enter revision loop (max 2 iterations).

Revision loop: spawn planner with revision context and checker issues, re-check. If max iterations reached, offer: 1) Force proceed, 2) Abort.

**5f. Spawn executor:**

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
  description="Execute: ${first issue title}"
)
```

After executor returns:
1. Verify summary exists at `${QUICK_DIR}/${next_num}-SUMMARY.md`
2. Extract commit hash from executor output
3. Report completion status

**Known Claude Code bug (classifyHandoffIfNeeded):** If executor reports "failed" with error `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Check if summary file exists and git log shows commits. If so, treat as successful.

If summary not found, error: "Executor failed to create ${next_num}-SUMMARY.md"

**5g. Verification (only when `$FULL_MODE`):**

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
  description="Verify: ${first issue title}"
)
```

Read verification status from `${QUICK_DIR}/${next_num}-VERIFICATION.md`.

| Status | Action |
|--------|--------|
| `passed` | Store `$VERIFICATION_STATUS = "Verified"`, continue |
| `human_needed` | Display items needing manual check, store `$VERIFICATION_STATUS = "Needs Review"`, continue |
| `gaps_found` | Display gap summary, offer: 1) Re-run executor, 2) Accept as-is. Store `$VERIFICATION_STATUS = "Gaps"` |

**5h. Update STATE.md:**

Read STATE.md. Check for `### Quick Tasks Completed` section.

If section doesn't exist, create it after `### Blockers/Concerns` section.

Check if table has a "Linear" column. If not, add it to header and separator rows:

```markdown
| # | Description | Date | Commit | Linear | Directory |
|---|-------------|------|--------|--------|-----------|
```

Append new row:
```markdown
| ${next_num} | ${first issue title} | ${date} | ${commit_hash} | ${first issue identifier} | [${next_num}-${SLUG}](./quick/${next_num}-${SLUG}/) |
```

If `$FULL_MODE` and table has Status column, include status.

Update "Last activity" line:
```
Last activity: ${date} - Completed quick task ${next_num}: ${first issue title}
```

**5i. Final commit and completion:**

Build file list:
- `${QUICK_DIR}/${next_num}-PLAN.md`
- `${QUICK_DIR}/${next_num}-SUMMARY.md`
- `.planning/STATE.md`
- `.planning/linear-context.md`
- If `$FULL_MODE` and verification exists: `${QUICK_DIR}/${next_num}-VERIFICATION.md`

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(quick-${next_num}): ${first issue title}" --files ${file_list}
```

Get commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LINEAR TASK COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: ${first issue identifier} — ${first issue title}
Route: Quick task
Directory: ${QUICK_DIR}
Commit: ${commit_hash}
```

### Milestone Route (WKFL-06)

**If `$ROUTE == "milestone"`:**

**5a. Build MILESTONE-CONTEXT.md:**

```markdown
# Milestone Context

**Source:** Linear issues (${comma-separated identifiers})
**Fetched:** ${ISO date}

## Features

${For each issue in $ISSUES:}
### ${issue.title}

${issue.description}

${end for each}

## Additional Context

${For each issue with comments:}
### ${issue.identifier} Comments
${For each of first 5 comments:}
- ${comment.body truncated to 300 chars}
${end for each}
${end for each}
```

Write to `.planning/MILESTONE-CONTEXT.md`.

**5b. Initialize milestone models:**

```bash
MINIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-milestone)
```

Parse MINIT JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.

**5c. Execute new-milestone workflow steps 1-11 inline:**

Follow the new-milestone workflow (`new-milestone.md`) from Step 1 through Step 11:

1. Load context (PROJECT.md, MILESTONES.md, STATE.md)
2. Gather milestone goals — MILESTONE-CONTEXT.md exists, use it
3. Determine milestone version
4. Update PROJECT.md
5. Update STATE.md
6. Cleanup and commit (delete MILESTONE-CONTEXT.md after consuming)
7. Resolve models from MINIT
8. Research decision (ask user)
9. Define requirements
10. Create roadmap (spawn gsd-roadmapper)
11. Done — display completion

Use models from MINIT JSON for spawned agents:
- Researchers: `researcher_model`
- Synthesizer: `synthesizer_model`
- Roadmapper: `roadmapper_model`

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LINEAR MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issues: ${comma-separated identifiers}
Route: Milestone
```

Display next step from new-milestone workflow Step 11 output.

---

**Step 6: Comment-back to Linear issues**

Post a summary comment to each Linear issue that triggered this workflow.

**Build comment body based on route:**

**If `$ROUTE == "quick"`:**

Read `${QUICK_DIR}/${next_num}-SUMMARY.md`. Extract the first paragraph after the title line (the line starting with `#`) as `$SUMMARY_EXCERPT` (2-3 sentences).

Build comment body:

```markdown
## GSD Quick Task Complete
**Task:** {$DESCRIPTION truncated to 100 chars}
**Commit:** `{$commit_hash}`
**Summary:** {$SUMMARY_EXCERPT}
Artifacts: `{$QUICK_DIR}/`
```

**If `$ROUTE == "milestone"`:**

Read `.planning/ROADMAP.md`. Extract the latest milestone line (the `**v{X.Y} {Name}**` entry under `## Milestones`). Count phases under that milestone section. Read `.planning/REQUIREMENTS.md` and count requirements mapped to those phases.

Build comment body:

```markdown
## GSD Milestone Initialized
**Milestone:** v{version} {name}
**Phases:** {N} planned
**Requirements:** {N} mapped
Roadmap: `.planning/ROADMAP.md`
```

**Post comment to each issue:**

For each issue in `$ISSUES`:

```
mcp__plugin_linear_linear__create_comment(
  issueId: issue.id,
  body: comment_body
)
```

Display: `✓ Comment posted to {issue.identifier}`

**On MCP failure:** Display warning but do not fail:
```
⚠ Failed to post comment to {issue.identifier}. The task completed successfully.
```
Continue to next issue (do not abort the loop).

---

**Step 7: Cleanup**

Delete the temporary linear-context.md file:

```bash
rm -f .planning/linear-context.md
```

Display: `✓ Cleaned up .planning/linear-context.md`

</process>

<success_criteria>
- [ ] Issue IDs parsed from arguments matching letter-dash-number pattern (WKFL-01)
- [ ] Flags --quick, --milestone, --full parsed from arguments (WKFL-01)
- [ ] User prompted via AskUserQuestion when no issue ID provided (WKFL-01)
- [ ] Issue data fetched via mcp get_issue with includeRelations:true (WKFL-02)
- [ ] Comments fetched via mcp list_comments (WKFL-02)
- [ ] Fetched issue title, state, labels, and comment count displayed (WKFL-02)
- [ ] Routing heuristic scores on issue count, sub-issues, description, labels, relations (WKFL-03)
- [ ] Score >= 3 routes to milestone, < 3 routes to quick (WKFL-03)
- [ ] --quick and --milestone flags bypass heuristic entirely (WKFL-04)
- [ ] Quick route synthesizes description and delegates to quick workflow steps 2-8 (WKFL-05)
- [ ] Milestone route writes MILESTONE-CONTEXT.md and delegates to new-milestone workflow (WKFL-06)
- [ ] .planning/linear-context.md written with issue IDs and route decision
- [ ] STATE.md quick tasks table extended with Linear column for quick route
- [ ] Summary comment posted to each Linear issue after completion (WKFL-07)
- [ ] .planning/linear-context.md deleted after comment-back (WKFL-08)
</success_criteria>
