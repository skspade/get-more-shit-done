<purpose>
Route Linear issues to GSD workflows. Fetches issue data from Linear via MCP tools, asks adaptive interview questions to gather context, routes to quick task or new milestone based on complexity signal, and delegates to the appropriate GSD workflow end-to-end.

- Parses issue IDs and flags from arguments
- Fetches issue data and comments via Linear MCP tools
- Asks 3-5 adaptive interview questions (skipping those answered by ticket data)
- Routes based on complexity signal from interview (quick vs milestone)
- Accepts override flags: `--quick`, `--milestone`, `--full`
- Presents confirmation summary (quick) or approach proposals (milestone) before execution
- Posts interview summary to Linear issues before execution starts
- Delegates to quick workflow (steps 3-10) or new-milestone workflow (steps 1-11)
- Posts completion comments back to Linear issues after execution
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

**Step 3: Interview**

After fetching issue data, pre-scan the primary issue to determine which questions to skip, then ask adaptive interview questions to gather context.

**3a. Pre-scan ticket data:**

Read `$ISSUES[0]` (primary issue) and build a skip checklist:

- `$SKIP_GOAL = true` ONLY if description contains a markdown section `## Goal` or `## Objective` with content beneath it
- `$SKIP_SCOPE = true` ONLY if description explicitly names files or components (e.g., path references like `src/`, component names) OR has a `## Scope` section
- `$SKIP_CRITERIA = true` ONLY if description contains a `## Acceptance Criteria` or `## Done When` section with list items
- `$SKIP_COMPLEXITY = true` if `$FORCE_QUICK` or `$FORCE_MILESTONE` is true (from Step 1 flag parsing)
- If `$SKIP_COMPLEXITY` is false, also check: if description or labels explicitly contain "quick fix", "small change", "epic", or "milestone" — set `$SKIP_COMPLEXITY = true` and store `$INFERRED_COMPLEXITY` with the matched value (e.g., "quick fix" → "Quick task", "epic" → "Milestone")

Display pre-scan results:
```
◆ Pre-scan: {N} of 5 questions will be skipped (ticket provides answers)
```

**3b. Adaptive interview questions:**

Initialize `$INTERVIEW_CONTEXT = ""`. Ask questions one at a time using AskUserQuestion. After each answer, incorporate the response before deciding on the next question.

**Q1: Goal clarification** (skip if `$SKIP_GOAL`)

If skipped: Extract goal text from the ticket's `## Goal` or `## Objective` section. Append to `$INTERVIEW_CONTEXT`:
```
**Goal:** (from ticket) {extracted goal text}
```

If asked:
```
AskUserQuestion(
  header: "Interview: Goal",
  question: "What's the core outcome you want from {$ISSUES[0].identifier}?",
  options: [
    {2-3 interpretations derived from the issue title, if title is ambiguous},
    "Something else — let me describe"
  ],
  followUp: null
)
```
If user selects "Something else", their free-text response becomes the goal.
Append to `$INTERVIEW_CONTEXT`:
```
**Goal:** {answer}
```

**Q2: Scope boundaries** (skip if `$SKIP_SCOPE`)

If skipped: Extract scope from ticket's file references or `## Scope` section. Append:
```
**Scope:** (from ticket) {extracted scope — files/components named}
```

If asked: Derive options from ticket context — mention component areas, file patterns, or subsystems referenced in the description or comments.
```
AskUserQuestion(
  header: "Interview: Scope",
  question: "How much of the codebase should this touch?",
  options: [
    {2-3 scope options derived from ticket context, e.g., "Just {component}" or "The {area} subsystem"},
    "Broader — touches multiple areas",
    "Not sure yet"
  ],
  followUp: null
)
```
Append:
```
**Scope:** {answer}
```

**Q3: Success criteria** (skip if `$SKIP_CRITERIA`)

If skipped: Extract criteria from ticket's `## Acceptance Criteria` or `## Done When` section. Append:
```
**Success Criteria:** (from ticket) {extracted criteria}
```

If asked: Synthesize options from the goal answer (Q1).
```
AskUserQuestion(
  header: "Interview: Success Criteria",
  question: "How will you know this is done?",
  options: [
    {2-3 criteria synthesized from the Q1 goal answer},
    "I'll define these after seeing the approach"
  ],
  followUp: null
)
```
Append:
```
**Success Criteria:** {answer}
```

**Q4: Complexity signal** (skip if `$SKIP_COMPLEXITY`)

If skipped via flag: Append:
```
**Complexity:** (flag override) {$FORCE_QUICK ? "Quick task" : "Milestone"}
```

If skipped via ticket inference: Append:
```
**Complexity:** (from ticket) {$INFERRED_COMPLEXITY}
```

If asked:
```
AskUserQuestion(
  header: "Interview: Complexity",
  question: "How much work does this feel like?",
  options: [
    "Quick task (hours)",
    "Medium (1-2 sessions)",
    "Milestone (multi-phase)"
  ],
  followUp: null
)
```
Append:
```
**Complexity:** {answer}
```

**Q5: Additional context** (conditional)

Only ask if previous answers surfaced ambiguity: Q1 answer was "Something else", Q2 was "Not sure yet", Q3 was "I'll define these after seeing the approach", or any answer contradicts the ticket data.

If asked:
```
AskUserQuestion(
  header: "Interview: Additional",
  question: "Anything else I should know about this task?",
  followUp: null
)
```
Append:
```
**Additional:** {answer}
```

If not asked: Append:
```
**Additional:** none
```

Display completion:
```
✓ Interview complete ({N} questions asked, {M} skipped from ticket)
```

---

**Step 4: Route decision**

Three-tier routing fallback: flag override → interview answer → ticket inference with confirmation.

**Tier 1: Flag override** (already set in Step 1)

**If `$FORCE_QUICK`:**
- Set `$ROUTE = "quick"`
- Display: "Route: QUICK (flag override)"
- Proceed to Step 5.

**If `$FORCE_MILESTONE`:**
- Set `$ROUTE = "milestone"`
- Display: "Route: MILESTONE (flag override)"
- Proceed to Step 5.

**Tier 2: Interview answer** (from Step 3 Q4)

If the complexity question was answered (not skipped), parse the complexity answer from `$INTERVIEW_CONTEXT`:
- "Quick task (hours)" → set `$ROUTE = "quick"`
- "Medium (1-2 sessions)" → set `$ROUTE = "quick"`, set `$FULL_MODE = true`
- "Milestone (multi-phase)" → set `$ROUTE = "milestone"`

Display: "Route: {$ROUTE}{$FULL_MODE ? ' (full mode)' : ''} (from interview)"
Proceed to Step 5.

**Tier 3: Ticket inference with confirmation** (when Q4 was skipped by ticket content)

If `$SKIP_COMPLEXITY` is true AND no flag override (Tier 1 did not fire):

Use `$INFERRED_COMPLEXITY` from Step 3 pre-scan to determine the proposed route:
- "quick fix" / "small change" → propose `$ROUTE = "quick"`
- "epic" / "milestone" → propose `$ROUTE = "milestone"`

Ask for confirmation:
```
AskUserQuestion(
  header: "Route Confirmation",
  question: "Based on the ticket, this looks like a {proposed route}. Is that right?",
  options: [
    "Yes, {proposed route}",
    "No, it's a quick task (hours)",
    "No, it's medium (1-2 sessions)",
    "No, it's a milestone (multi-phase)"
  ],
  followUp: null
)
```

Map the confirmation answer to `$ROUTE` and `$FULL_MODE` using the same mapping as Tier 2.
Update `$INTERVIEW_CONTEXT`: replace the Complexity line with the confirmed answer.

Display: "Route: {$ROUTE} (confirmed from ticket inference)"

**Display route banner:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ROUTE: {$ROUTE}{$FULL_MODE ? ' (FULL MODE)' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**Step 5: Hybrid output**

Initialize `$SELECTED_APPROACH = ""`.

### Quick Route

**If `$ROUTE == "quick"`:**

**5a. Display confirmation summary:**

Display a banner with the confirmation summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CONFIRMATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue:    {$ISSUES[0].identifier} — {$ISSUES[0].title}
Goal:     {extracted from $INTERVIEW_CONTEXT **Goal:** line}
Scope:    {extracted from $INTERVIEW_CONTEXT **Scope:** line}
Criteria: {extracted from $INTERVIEW_CONTEXT **Success Criteria:** line}
Route:    {$ROUTE}{$FULL_MODE ? ' (full mode)' : ''}
```

**5b. Ask for confirmation:**

```
AskUserQuestion(
  header: "Confirm",
  question: "Does this look right?",
  options: [
    "Yes, proceed",
    "No, let me clarify"
  ],
  followUp: null
)
```

**If "Yes, proceed":** Continue to Step 7.

**If "No, let me clarify":** Proceed to 5c.

**5c. Dimension picker:**

```
AskUserQuestion(
  header: "Clarify",
  question: "Which part would you like to revisit?",
  options: [
    "Goal",
    "Scope",
    "Success Criteria",
    "Complexity",
    "Cancel — proceed as-is"
  ],
  followUp: null
)
```

**If "Cancel — proceed as-is":** Continue to Step 7.

**Otherwise:** Re-ask the selected dimension's interview question using the same AskUserQuestion format from Step 3:
- "Goal" → re-ask Q1 (Interview: Goal)
- "Scope" → re-ask Q2 (Interview: Scope)
- "Success Criteria" → re-ask Q3 (Interview: Success Criteria)
- "Complexity" → re-ask Q4 (Interview: Complexity)

After the user answers, update the corresponding `**{Dimension}:**` line in `$INTERVIEW_CONTEXT` with the new answer. If the user changes Complexity, also update `$ROUTE` and `$FULL_MODE` using the same mapping as Step 4 Tier 2.

Then return to 5a to re-display the updated confirmation summary with the same Yes/No prompt. This loop continues until the user selects "Yes, proceed" or "Cancel — proceed as-is".

### Milestone Route

**If `$ROUTE == "milestone"`:**

**5d. Synthesize approach proposals:**

Based on `$INTERVIEW_CONTEXT` (goal, scope, criteria) and `$ISSUES` (title, description, labels), synthesize 2-3 distinct implementation approaches. Each approach should represent a meaningfully different strategy for achieving the goal.

Display:

```
## Proposed Approaches

### Approach 1: {Name}

{Description — 2-3 sentences explaining the approach and how it addresses the goal}

**Pros:**
- {Advantage}
- {Advantage}

**Cons:**
- {Disadvantage}
- {Disadvantage}

### Approach 2: {Name}

{Description}

**Pros:**
- {Advantage}
- {Advantage}

**Cons:**
- {Disadvantage}
- {Disadvantage}

### Approach 3: {Name} (if warranted by complexity)

{Description}

**Pros:**
- {Advantage}

**Cons:**
- {Disadvantage}

### Recommendation

I recommend **Approach {N}: {Name}** because {reasoning tied to user's stated goal and constraints from interview}.
```

**5e. Ask user to select approach:**

```
AskUserQuestion(
  header: "Approach Selection",
  question: "Which approach would you like to go with?",
  options: [
    "Approach 1: {Name}",
    "Approach 2: {Name}",
    {"Approach 3: {Name}" if 3 approaches presented},
    "Let me suggest modifications"
  ],
  followUp: null
)
```

**If user selects an approach:** Store the selected approach in `$SELECTED_APPROACH`:

```
$SELECTED_APPROACH = "
## Selected Approach

### {Approach Name}

{Description}

**Pros:**
- {pros list}

**Cons:**
- {cons list}
"
```

Display: `✓ Approach selected: {Name}`

Proceed to Step 7.

**If user selects "Let me suggest modifications":**

```
AskUserQuestion(
  header: "Modifications",
  question: "What would you like to change about the proposed approaches?",
  followUp: null
)
```

Incorporate the user's feedback, revise the approach proposals, and return to 5d to re-present the updated proposals. This loop continues until the user selects a specific approach.

---

**Step 6: Pre-execution comment-back**

Post interview summary to Linear before execution starts.

**Build comment body based on route:**

**If `$ROUTE == "quick"`:**

Build comment body:

```markdown
## GSD Interview Summary

**Goal:** {extracted from $INTERVIEW_CONTEXT **Goal:** line}
**Scope:** {extracted from $INTERVIEW_CONTEXT **Scope:** line}
**Success criteria:** {extracted from $INTERVIEW_CONTEXT **Success Criteria:** line}
**Route:** Quick task

Execution starting...
```

**If `$ROUTE == "milestone"`:**

Build comment body:

```markdown
## GSD Interview Summary

**Goal:** {extracted from $INTERVIEW_CONTEXT **Goal:** line}
**Scope:** {extracted from $INTERVIEW_CONTEXT **Scope:** line}
**Success criteria:** {extracted from $INTERVIEW_CONTEXT **Success Criteria:** line}
**Route:** Milestone
**Selected approach:** {approach name extracted from $SELECTED_APPROACH}

{2-3 sentence approach description extracted from $SELECTED_APPROACH}

Milestone creation starting...
```

**Post comment to each issue (non-blocking):**

For each issue in `$ISSUES`:

```
mcp__plugin_linear_linear__create_comment(
  issueId: issue.id,
  body: comment_body
)
```

Display: `✓ Pre-execution summary posted to {issue.identifier}`

**On MCP failure:** Display warning but do not fail:
```
⚠ Failed to post pre-execution summary to {issue.identifier}. Continuing...
```
Continue to next issue (do not abort the loop).

---

**Step 7: Write linear-context.md**

Write `.planning/linear-context.md`:

```markdown
---
issue_ids: [{comma-separated issue identifiers}]
route: {quick|milestone}
interview: true
fetched: {ISO date}
---
# Linear Context

Issues fetched for this workflow run.
Consumed by Phase 22 completion loop.
```

---

**Step 8: Execute route**

### Quick Route (WKFL-05)

**If `$ROUTE == "quick"`:**

**8a. Synthesize description:**

Build `$DESCRIPTION` from issue data:
- Start with first issue title
- Append "\n\n" + first issue description (truncated to 1500 chars)
- Append "\n\nLinear comments:\n" + first 3 comment bodies (each truncated to 200 chars)
- Truncate total `$DESCRIPTION` to 2000 chars

For multiple issues routed to quick (only possible via `--quick` flag override), use the first issue only.

**8b. Initialize:**

```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "$DESCRIPTION")
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init linear)
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
Creating quick task ${next_num}: ${first issue title}
Directory: ${QUICK_DIR}
Linear: ${first issue identifier}
```

**8d. Spawn planner (quick mode):**

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
- **`## VERIFICATION PASSED`:** Display confirmation, proceed to 8f.
- **`## ISSUES FOUND`:** Display issues, enter revision loop (max 2 iterations).

Revision loop: spawn planner with revision context and checker issues, re-check. If max iterations reached, offer: 1) Force proceed, 2) Abort.

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
  description="Execute: ${first issue title}"
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
  description="Verify: ${first issue title}"
)
```

Read verification status from `${QUICK_DIR}/${next_num}-VERIFICATION.md`.

| Status | Action |
|--------|--------|
| `passed` | Store `$VERIFICATION_STATUS = "Verified"`, continue |
| `human_needed` | Display items needing manual check, store `$VERIFICATION_STATUS = "Needs Review"`, continue |
| `gaps_found` | Display gap summary, offer: 1) Re-run executor, 2) Accept as-is. Store `$VERIFICATION_STATUS = "Gaps"` |

**8h. Update STATE.md:**

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

**8i. Final commit and completion:**

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

**8a. Build MILESTONE-CONTEXT.md:**

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

${$SELECTED_APPROACH}
```

Write to `.planning/MILESTONE-CONTEXT.md`.

**8b. Initialize milestone models:**

```bash
MINIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-milestone)
```

Parse MINIT JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.

**8c. Execute new-milestone workflow steps 1-11 inline:**

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

**Step 9: Comment-back to Linear issues**

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

**Step 10: Cleanup**

Delete the temporary linear-context.md file:

```bash
rm -f .planning/linear-context.md
```

Display: `✓ Cleaned up .planning/linear-context.md`

</process>

<success_criteria>
- [ ] Issue IDs parsed from arguments matching letter-dash-number pattern
- [ ] Flags --quick, --milestone, --full parsed from arguments
- [ ] User prompted via AskUserQuestion when no issue ID provided
- [ ] Issue data fetched via mcp get_issue with includeRelations:true
- [ ] Comments fetched via mcp list_comments
- [ ] Fetched issue title, state, labels, and comment count displayed
- [ ] Interview asks 3-5 adaptive questions after ticket fetch, skipping questions already answered by ticket (INTV-01)
- [ ] Pre-scan reads ticket title, description, labels, comments to build skip checklist (INTV-02)
- [ ] Each interview question adapts based on previous answers (INTV-03)
- [ ] Interview covers five dimensions: goal, scope, success criteria, complexity, additional context (INTV-04)
- [ ] All interview Q&A stored as $INTERVIEW_CONTEXT with labeled sections (INTV-05)
- [ ] Complexity signal from interview determines route: Quick/Medium/Milestone (ROUT-01)
- [ ] $MILESTONE_SCORE heuristic fully removed (ROUT-02)
- [ ] Override flags skip complexity question but still run other interview questions (ROUT-03)
- [ ] When complexity skipped by ticket, Claude infers route and asks for confirmation (ROUT-04)
- [ ] Workflow steps renumbered to 9 steps (WKFL-01)
- [ ] --quick and --milestone flags bypass complexity question only
- [ ] Quick route displays confirmation summary (issue, goal, scope, criteria, route) with "Yes, proceed" / "No, let me clarify" (OUTP-01)
- [ ] "No, let me clarify" re-enters relevant interview question via dimension picker (OUTP-02)
- [ ] Milestone route displays 2-3 approach proposals with pros/cons and recommendation, user selects via AskUserQuestion (OUTP-03)
- [ ] Selected approach written to MILESTONE-CONTEXT.md under ## Selected Approach (OUTP-04)
- [ ] Quick route synthesizes description and delegates to quick workflow
- [ ] Milestone route writes MILESTONE-CONTEXT.md and delegates to new-milestone workflow
- [ ] .planning/linear-context.md written with issue IDs and route decision (no score field)
- [ ] STATE.md quick tasks table extended with Linear column for quick route
- [ ] Summary comment posted to each Linear issue after completion
- [ ] .planning/linear-context.md deleted after comment-back
</success_criteria>
