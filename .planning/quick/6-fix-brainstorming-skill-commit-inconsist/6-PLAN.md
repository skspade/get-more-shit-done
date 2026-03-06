---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/brainstorm.md
  - get-shit-done/workflows/add-tests.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "brainstorm.md uses gsd-tools commit CLI instead of raw git commands for .planning files"
    - "add-tests.md uses gsd-tools commit CLI instead of raw git commands for .planning files"
    - "Both workflows respect commit_docs config and .planning gitignore status"
  artifacts:
    - path: "get-shit-done/workflows/brainstorm.md"
      provides: "Design file commit via gsd-tools CLI"
      contains: "gsd-tools.cjs.*commit"
    - path: "get-shit-done/workflows/add-tests.md"
      provides: "Test file commit via gsd-tools CLI"
      contains: "gsd-tools.cjs.*commit"
  key_links: []
---

<objective>
Fix commit inconsistency in brainstorm.md and add-tests.md workflows. Both use raw `git add` + `git commit` for .planning files instead of the `gsd-tools.cjs commit` CLI that all other workflows use. The gsd-tools CLI checks `commit_docs` config and `.planning/` gitignore status before committing, so raw git commands will fail silently or error when .planning is gitignored.

Purpose: Consistent commit behavior across all workflows -- respects user's commit_docs setting and gitignore configuration.
Output: Updated workflow files with gsd-tools CLI commit calls.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/references/git-planning-commit.md
@get-shit-done/workflows/brainstorm.md
@get-shit-done/workflows/add-tests.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace raw git commits with gsd-tools CLI in brainstorm.md and add-tests.md</name>
  <files>get-shit-done/workflows/brainstorm.md, get-shit-done/workflows/add-tests.md</files>
  <action>
In `get-shit-done/workflows/brainstorm.md`, replace the Step 8 commit block (lines 214-221):

REPLACE:
```bash
git add ".planning/designs/{date}-{topic-slug}-design.md"
git commit -m "docs(brainstorm): design for {topic}"
```

Do NOT use `git add .` or `git add -A`.

WITH:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(brainstorm): design for {topic}" --files ".planning/designs/{date}-{topic-slug}-design.md"
```

Keep the "Display" section after it unchanged.

In `get-shit-done/workflows/add-tests.md`, replace the commit block (lines 302-307):

REPLACE:
If there are passing tests to commit:

```bash
git add {test files}
git commit -m "test(phase-${phase_number}): add unit and E2E tests from add-tests command"
```

WITH:
If there are passing tests to commit:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "test(phase-${phase_number}): add unit and E2E tests from add-tests command" --files {test files}
```

NOTE: add-tests.md commits TEST files (not .planning files), so using raw git is actually fine there. However, for consistency across all workflows and because gsd-tools commit handles the git operations cleanly, use the CLI. The gsd-tools commit CLI only skips commits for .planning/ files when gitignored -- it will still commit non-.planning files normally.

Actually -- CORRECTION: Re-read the gsd-tools commit reference. It says "The CLI will return skipped (with reason) if commit_docs is false or .planning/ is gitignored." This means gsd-tools commit is specifically for .planning files. Test files are NOT .planning files, so add-tests.md should keep using raw git for test file commits. Only fix brainstorm.md.

FINAL ACTION: Only modify `get-shit-done/workflows/brainstorm.md`. Leave `add-tests.md` unchanged.
  </action>
  <verify>
    <automated>grep -n "gsd-tools.cjs.*commit.*brainstorm" get-shit-done/workflows/brainstorm.md && ! grep -n "git add.*\.planning" get-shit-done/workflows/brainstorm.md && echo "PASS"</automated>
  </verify>
  <done>brainstorm.md Step 8 uses gsd-tools commit CLI instead of raw git add/commit. No raw git commands remain for .planning file commits in brainstorm.md.</done>
</task>

</tasks>

<verification>
- `grep -n "git add\|git commit" get-shit-done/workflows/brainstorm.md` shows NO raw git commands for .planning files
- `grep -n "gsd-tools" get-shit-done/workflows/brainstorm.md` shows the commit CLI call
- The commit message format matches existing patterns: `"docs(brainstorm): design for {topic}"`
</verification>

<success_criteria>
- brainstorm.md uses `gsd-tools.cjs commit` for .planning/designs/ file commits
- The gsd-tools call uses `--files` flag with the specific design file path
- Commit message format preserved: "docs(brainstorm): design for {topic}"
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-brainstorming-skill-commit-inconsist/6-SUMMARY.md`
</output>
