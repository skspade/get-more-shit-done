# Linear Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/gsd:linear` slash command that reads Linear issues via MCP, auto-routes to quick or milestone, and posts summary comments back.

**Architecture:** A thin orchestrator workflow (`linear.md`) reads Linear issues via MCP tools, applies a routing heuristic to decide quick vs. milestone, synthesizes the issue data into the format expected by existing workflows, then delegates inline. An `init linear` CLI command provides initialization data. No new agents.

**Tech Stack:** Node.js (CJS), Claude Code slash commands (`.md` workflow files), Linear MCP tools (`get_issue`, `list_comments`, `create_comment`)

---

### Task 1: Add `cmdInitLinear` to init.cjs

**Files:**
- Modify: `get-shit-done/bin/lib/init.cjs` (add function before `module.exports`)
- Modify: `get-shit-done/bin/lib/init.cjs` (add to `module.exports`)
- Modify: `get-shit-done/bin/gsd-tools.cjs` (add `case 'linear'` to init switch)
- Test: `tests/init.test.cjs`

**Step 1: Write the failing test**

Add to `tests/init.test.cjs` before the closing of the file:

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// cmdInitLinear (INIT-LINEAR)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitLinear', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns models, paths, and quick init data', () => {
    // Create ROADMAP.md so validation passes
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');

    const result = runGsdTools('init linear', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.planner_model, 'should have planner_model');
    assert.ok(output.executor_model, 'should have executor_model');
    assert.strictEqual(output.roadmap_exists, true);
    assert.strictEqual(output.planning_exists, true);
    assert.ok(output.date, 'should have date');
    assert.ok(output.quick_dir, 'should have quick_dir');
    assert.ok(typeof output.next_quick_num === 'number', 'should have next_quick_num');
  });

  test('next_quick_num increments from existing quick entries', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');
    const quickDir = path.join(tmpDir, '.planning', 'quick');
    fs.mkdirSync(path.join(quickDir, '1-old-task'), { recursive: true });
    fs.mkdirSync(path.join(quickDir, '2-another'), { recursive: true });

    const result = runGsdTools('init linear', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next_quick_num, 3);
  });

  test('returns milestones_path and state_path', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');

    const result = runGsdTools('init linear', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestones_path, '.planning/MILESTONES.md');
    assert.strictEqual(output.state_path, '.planning/STATE.md');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/init.test.cjs --test-name-pattern "cmdInitLinear"`
Expected: FAIL — `Unknown init workflow: linear`

**Step 3: Write `cmdInitLinear` in init.cjs**

Add before `module.exports` in `get-shit-done/bin/lib/init.cjs`:

```javascript
function cmdInitLinear(cwd, raw) {
  const config = loadConfig(cwd);
  const now = new Date();

  // Find next quick task number (for quick routing)
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextQuickNum = 1;
  try {
    const existing = fs.readdirSync(quickDir)
      .filter(f => /^\d+-/.test(f))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(n => !isNaN(n));
    if (existing.length > 0) {
      nextQuickNum = Math.max(...existing) + 1;
    }
  } catch {}

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),

    // Config
    commit_docs: config.commit_docs,
    research_enabled: config.workflow?.research ?? false,

    // Quick task info (for quick routing)
    next_quick_num: nextQuickNum,
    quick_dir: '.planning/quick',

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    state_path: '.planning/STATE.md',
    milestones_path: '.planning/MILESTONES.md',
    project_path: '.planning/PROJECT.md',
    roadmap_path: '.planning/ROADMAP.md',
    requirements_path: '.planning/REQUIREMENTS.md',

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
  };

  output(result, raw);
}
```

**Step 4: Add to `module.exports` in init.cjs**

Add `cmdInitLinear,` to the exports object.

**Step 5: Wire up in gsd-tools.cjs**

Add `case 'linear':` to the init switch statement in `gsd-tools.cjs` (around line 556):

```javascript
        case 'linear':
          init.cmdInitLinear(cwd, raw);
          break;
```

**Step 6: Run test to verify it passes**

Run: `node --test tests/init.test.cjs --test-name-pattern "cmdInitLinear"`
Expected: PASS (all 3 tests)

**Step 7: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass

**Step 8: Commit**

```bash
git add get-shit-done/bin/lib/init.cjs get-shit-done/bin/gsd-tools.cjs tests/init.test.cjs
git commit -m "feat: add init linear command for Linear integration workflow"
```

---

### Task 2: Create the `/gsd:linear` command spec

**Files:**
- Create: `commands/gsd/linear.md`

**Step 1: Create the command spec**

Create `commands/gsd/linear.md`:

```markdown
---
name: gsd:linear
description: Create a GSD milestone or quick task from a Linear issue
argument-hint: "<ISSUE-ID> [ISSUE-ID...] [--quick] [--milestone] [--full]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
  - mcp__plugin_linear_linear__get_issue
  - mcp__plugin_linear_linear__list_comments
  - mcp__plugin_linear_linear__create_comment
---
<objective>
Read one or more Linear issues via MCP, auto-route to quick task or milestone based on issue complexity, then delegate to the existing /gsd:quick or /gsd:new-milestone workflow.

After completion, post a summary comment back to the Linear issue(s).

**Routing:**
- Single small issue → quick task
- Single large issue or multiple issues → milestone
- `--quick` / `--milestone` flags override auto-routing
- `--full` flag passes through to quick workflow

**Creates/Updates:**
- Quick path: `.planning/quick/` artifacts, STATE.md
- Milestone path: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/linear.md
</execution_context>

<context>
$ARGUMENTS

Linear issue IDs and flags are parsed inside the workflow.
</context>

<process>
Execute the linear workflow from @~/.claude/get-shit-done/workflows/linear.md end-to-end.
Preserve all workflow gates (Linear data fetch, routing, synthesis, delegation, comment-back).
</process>
```

**Step 2: Verify command spec follows existing patterns**

Check that the file structure matches `commands/gsd/quick.md` (frontmatter with name, description, argument-hint, allowed-tools, then objective/execution_context/context/process sections).

**Step 3: Commit**

```bash
git add commands/gsd/linear.md
git commit -m "feat: add /gsd:linear command spec"
```

---

### Task 3: Create the `linear.md` workflow

**Files:**
- Create: `get-shit-done/workflows/linear.md`

This is the core workflow. It follows the same `<purpose>/<required_reading>/<process>/<success_criteria>` structure as `quick.md` and `new-milestone.md`.

**Step 1: Create the workflow file**

Create `get-shit-done/workflows/linear.md`:

```markdown
<purpose>
Read Linear issue(s) via MCP tools, auto-route to quick task or milestone based on issue complexity, synthesize issue data into the format expected by existing workflows, delegate to /gsd:quick or /gsd:new-milestone inline, and post a summary comment back to the Linear issue(s).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for:
- Issue IDs → any token matching a letter-number pattern (e.g., `LIN-123`, `ENG-456`) → store as `$ISSUE_IDS` array
- `--quick` flag → store as `$FORCE_QUICK` (true/false)
- `--milestone` flag → store as `$FORCE_MILESTONE` (true/false)
- `--full` flag → store as `$FULL_MODE` (true/false)

If `$ISSUE_IDS` is empty, prompt user:

```
AskUserQuestion(
  header: "Linear Issue",
  question: "Which Linear issue(s) should I work from? (e.g., LIN-123 or LIN-123 LIN-456)",
  followUp: null
)
```

Parse response for issue IDs. If still empty, error: "Please provide at least one Linear issue ID."

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LINEAR INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Reading ${ISSUE_IDS.length} issue(s) from Linear...
```

---

**Step 2: Fetch Linear data**

For each issue ID in `$ISSUE_IDS`:

```
issue_data = mcp__plugin_linear_linear__get_issue(
  id: ISSUE_ID,
  includeRelations: true
)
```

```
comments_data = mcp__plugin_linear_linear__list_comments(
  issueId: issue_data.id
)
```

Store results as `$ISSUES` array (each with issue data + comments).

If any issue fetch fails, error: "Could not find Linear issue: ${ISSUE_ID}. Check the ID and try again."

Display fetched issues:
```
Fetched:
  ${ISSUE_ID}: ${issue.title} (${issue.state}, ${issue.labels})
  Comments: ${comments.length}
```

---

**Step 3: Route decision**

**If `$FORCE_QUICK`:** Set `$ROUTE = "quick"`, skip heuristic.
**If `$FORCE_MILESTONE`:** Set `$ROUTE = "milestone"`, skip heuristic.

**Otherwise, apply heuristic:**

Initialize `$MILESTONE_SCORE = 0`:

1. **Multiple issues:** If `$ISSUE_IDS.length > 1` → `$MILESTONE_SCORE += 3`
2. **Sub-issues:** If any issue has child issues / sub-issues → `$MILESTONE_SCORE += 2`
3. **Description length:** If any issue description > 500 words → `$MILESTONE_SCORE += 1`
4. **Labels:** If any issue has label matching "feature" or "epic" → `$MILESTONE_SCORE += 2`. If labels match "bug", "fix", "chore", "docs" → `$MILESTONE_SCORE -= 1`
5. **Relations:** If any issue has blocking or related issues → `$MILESTONE_SCORE += 1`

**Route:**
- `$MILESTONE_SCORE >= 3` → `$ROUTE = "milestone"`
- `$MILESTONE_SCORE < 3` → `$ROUTE = "quick"`

Display routing decision:
```
Route: ${ROUTE} (score: ${MILESTONE_SCORE})
${FORCE_QUICK || FORCE_MILESTONE ? '(forced via flag)' : ''}
```

---

**Step 4: Initialize**

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init linear)
```

Parse JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `roadmapper_model`, `researcher_model`, `synthesizer_model`, `commit_docs`, `research_enabled`, `next_quick_num`, `quick_dir`, `date`, `timestamp`, `state_path`, `milestones_path`, `project_path`, `roadmap_path`, `requirements_path`, `roadmap_exists`, `planning_exists`.

**If `planning_exists` is false:** Error — "No .planning/ directory found. Run `/gsd:new-project` first."

---

**Step 5: Synthesize context**

**If `$ROUTE == "quick"`:**

Build `$DESCRIPTION` from the first (or only) issue:
```
${issue.title}

${issue.description}

${comments.length > 0 ? 'Context from comments:\n' + comments.map(c => '- ' + c.body).join('\n') : ''}
```

Truncate to 2000 chars if longer (planner can read the full issue if needed).

Generate slug:
```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" slug "${issue.title}")
```

Store: `$QUICK_DIR = ".planning/quick/${next_quick_num}-${SLUG}"`

**If `$ROUTE == "milestone"`:**

Build `$MILESTONE_CONTEXT`:

For each issue, extract:
- Title → feature name
- Description → feature details / acceptance criteria
- Comments → additional context, decisions, constraints

Format as:
```markdown
## Linear Issues

${ISSUES.map(i => `### ${i.identifier}: ${i.title}\n\n${i.description}\n\n**Labels:** ${i.labels}\n**Priority:** ${i.priority}\n\n**Comments:**\n${i.comments.map(c => '> ' + c.body).join('\n\n')}`).join('\n\n---\n\n')}
```

Write to `.planning/MILESTONE-CONTEXT.md` (consumed by new-milestone workflow).

Also build `$MILESTONE_NAME` from the issue titles (use the first issue's title if single, or a summary if multiple).

---

**Step 6: Store Linear reference**

Write `.planning/linear-context.md`:
```markdown
---
linear_issues:
${ISSUE_IDS.map(id => '  - ' + id).join('\n')}
route: ${ROUTE}
created: ${date}
---

# Linear Context

Issue data fetched from Linear for GSD workflow.
This file is consumed during execution and cleaned up after.
```

---

**Step 7: Delegate to existing workflow**

**If `$ROUTE == "quick"`:**

Follow the quick workflow (from `~/.claude/get-shit-done/workflows/quick.md`) starting from Step 2 (Initialize is already done), using:
- `$DESCRIPTION` from step 5
- `$FULL_MODE` from step 1
- Skip Step 1 of quick workflow (we already have the description)
- In Step 4 (planner prompt), append to `<planning_context>`: `\n**Linear issue:** ${ISSUE_IDS[0]}\n**Linear comments:** Available for additional context`

Continue through quick steps 2-8 as-is.

**If `$ROUTE == "milestone"`:**

Follow the new-milestone workflow (from `~/.claude/get-shit-done/workflows/new-milestone.md`) starting from Step 1, with:
- MILESTONE-CONTEXT.md already written (step 5) — the workflow will detect and use it
- `$MILESTONE_NAME` passed as the milestone name argument
- The new-milestone workflow handles everything from there (questioning, research, requirements, roadmap)

Continue through new-milestone steps 1-11 as-is.

---

**Step 8: Comment back to Linear**

After the delegated workflow completes:

**If `$ROUTE == "quick"`:**

Read `${QUICK_DIR}/${next_quick_num}-SUMMARY.md` for summary content.

Get commit hash:
```bash
commit_hash=$(git rev-parse --short HEAD)
```

Build comment:
```markdown
## GSD Quick Task Complete

**Task:** ${DESCRIPTION}
**Commit:** \`${commit_hash}\`
**Summary:** [Extract first 2-3 sentences from SUMMARY.md body]

Artifacts: \`.planning/quick/${next_quick_num}-${SLUG}/\`
```

**If `$ROUTE == "milestone"`:**

Read `.planning/ROADMAP.md` for phase count. Read `.planning/REQUIREMENTS.md` for requirement count.

Build comment:
```markdown
## GSD Milestone Initialized

**Milestone:** ${milestone_version} ${milestone_name}
**Phases:** ${phase_count} planned
**Requirements:** ${requirement_count} mapped

Roadmap: \`.planning/ROADMAP.md\`
```

Post comment to each Linear issue:
```
mcp__plugin_linear_linear__create_comment(
  issueId: issue.id,
  body: comment_markdown
)
```

Display:
```
Posted summary comment to ${ISSUE_IDS.join(', ')}
```

---

**Step 9: Cleanup**

Delete `.planning/linear-context.md`:
```bash
rm -f .planning/linear-context.md
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► LINEAR INTEGRATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Route: ${ROUTE}
Issues: ${ISSUE_IDS.join(', ')}
${ROUTE === 'quick' ? 'Summary: ' + QUICK_DIR + '/' + next_quick_num + '-SUMMARY.md' : 'Roadmap: .planning/ROADMAP.md'}
Linear: Comment posted ✓

${ROUTE === 'quick' ? 'Ready for next task: /gsd:quick or /gsd:linear' : 'Next: /gsd:plan-phase [N]'}
```

</process>

<success_criteria>
- [ ] At least one Linear issue ID provided or prompted
- [ ] All issues fetched successfully via MCP
- [ ] Routing decision made (heuristic or flag override)
- [ ] Context synthesized for target workflow
- [ ] linear-context.md created with issue references
- [ ] Quick path: all quick workflow steps completed (plan, execute, state update, commit)
- [ ] Milestone path: all new-milestone workflow steps completed (context, requirements, roadmap)
- [ ] Summary comment posted to all Linear issues
- [ ] linear-context.md cleaned up
- [ ] User knows next step
</success_criteria>
```

**Step 2: Verify the workflow follows existing patterns**

Compare structure against `quick.md` and `new-milestone.md` — uses same `<purpose>/<required_reading>/<process>/<success_criteria>` tags, same banner formatting, same delegation patterns.

**Step 3: Commit**

```bash
git add get-shit-done/workflows/linear.md
git commit -m "feat: add linear.md workflow for Linear issue integration"
```

---

### Task 4: Add Linear issue ID column to STATE.md quick task table

**Files:**
- Modify: `get-shit-done/workflows/linear.md` (already handles this in step 7 via quick workflow)
- Modify: `get-shit-done/workflows/quick.md` (minor — document that Linear-originated quicks may have an extra column)

This task is about ensuring the quick workflow's STATE.md update (Step 7) can accommodate a Linear issue ID. The linear workflow handles this by modifying the quick workflow's state update step inline.

**Step 1: Identify the change**

In the linear workflow's Step 7 (delegated quick workflow's Step 7), when updating STATE.md, the linear workflow should add the Linear issue ID to the table row. This means:

- If the Quick Tasks Completed table doesn't have a "Linear" column, add one
- Add the issue ID to the new row

The linear workflow already handles this inline — no change to `quick.md` is needed since the linear workflow executes the quick steps itself and can modify the STATE.md update.

**Step 2: No code change needed**

The workflow file from Task 3 already describes the STATE.md update with Linear context in Step 7 (via the delegated quick workflow). The linear-context.md file provides the issue ID reference.

**Step 3: Commit (skip — no changes)**

No additional code changes needed for this task. The workflow handles it.

---

### Task 5: Integration test — end-to-end verification

**Files:**
- Test: Manual integration test (not automated — requires live Linear MCP)

**Step 1: Verify the command spec is discoverable**

Run: `ls commands/gsd/linear.md`
Expected: File exists

**Step 2: Verify init linear works**

Run from project root:
```bash
node get-shit-done/bin/gsd-tools.cjs init linear
```
Expected: JSON output with models, paths, dates, `next_quick_num`

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing + new init linear tests)

**Step 4: Commit (if any fixes needed)**

Only commit if fixes were required during integration testing.

---

### Task 6: Update USER-GUIDE.md with `/gsd:linear` command

**Files:**
- Modify: `docs/USER-GUIDE.md`

**Step 1: Add `/gsd:linear` to the command reference table**

Find the command reference table in `docs/USER-GUIDE.md` and add:

```markdown
| `/gsd:linear` | Create milestone or quick from Linear issue(s) | `ISSUE-ID [ISSUE-ID...] [--quick] [--milestone] [--full]` |
```

**Step 2: Add a brief section about Linear integration**

Add a new section (after the Quick Tasks section or similar):

```markdown
### Linear Integration

`/gsd:linear ISSUE-ID` reads a Linear issue and its comments, auto-decides whether to create a quick task or milestone, then delegates to the appropriate workflow. After completion, a summary comment is posted back to the Linear issue.

**Flags:**
- `--quick` — Force quick task mode
- `--milestone` — Force milestone mode
- `--full` — Enable plan-checking and verification (quick mode only)

**Examples:**
```
/gsd:linear ENG-123              # Auto-route single issue
/gsd:linear ENG-123 ENG-456      # Group into milestone
/gsd:linear ENG-123 --quick      # Force quick
```
```

**Step 3: Commit**

```bash
git add docs/USER-GUIDE.md
git commit -m "docs: add /gsd:linear to USER-GUIDE command reference"
```

---

### Task 7: Update README.md with Linear integration mention

**Files:**
- Modify: `README.md`

**Step 1: Add `/gsd:linear` to the commands list**

Find the commands/features section in `README.md` and add a line about the Linear integration command.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: mention /gsd:linear in README"
```
