---
phase: quick-9
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/brainstorm.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Step 8 of brainstorm.md uses gsd-tools.cjs commit CLI instead of raw git add/commit"
    - "Design file commits respect commit_docs config and .planning/ gitignore status"
  artifacts:
    - path: "get-shit-done/workflows/brainstorm.md"
      provides: "Brainstorm workflow with consistent commit pattern"
      contains: "gsd-tools.cjs"
  key_links:
    - from: "get-shit-done/workflows/brainstorm.md"
      to: "get-shit-done/bin/gsd-tools.cjs"
      via: "commit CLI invocation in step 8"
      pattern: 'gsd-tools\.cjs.*commit.*brainstorm'
---

<objective>
Replace the remaining raw `git add` + `git commit` commands in Step 8 of brainstorm.md with the `gsd-tools.cjs commit` CLI.

Purpose: Step 8 still uses raw git commands to commit design files to `.planning/designs/`. This bypasses the `commit_docs` config which controls whether `.planning/` files should be committed. Step 10b already uses the correct `gsd-tools.cjs commit` pattern. This fix makes Step 8 consistent.

Output: Updated brainstorm.md with gsd-tools CLI in Step 8.
</objective>

<context>
@get-shit-done/workflows/brainstorm.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace raw git commands with gsd-tools CLI in brainstorm.md Step 8</name>
  <files>get-shit-done/workflows/brainstorm.md</files>
  <action>
In `get-shit-done/workflows/brainstorm.md`, find Step 8 ("Commit Design File") around lines 214-221.

Replace the raw git commands:
```bash
git add ".planning/designs/{date}-{topic-slug}-design.md"
git commit -m "docs(brainstorm): design for {topic}"
```

With the gsd-tools commit CLI (matching the pattern already used in Step 10b of the same file):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(brainstorm): design for {topic}" --files ".planning/designs/{date}-{topic-slug}-design.md"
```

Also remove the line "Do NOT use `git add .` or `git add -A`." since the gsd-tools CLI handles staging internally and this warning is no longer relevant.
  </action>
  <verify>
    <automated>grep -c "gsd-tools.cjs" get-shit-done/workflows/brainstorm.md | grep -q "2" && grep -c "git add\|git commit" get-shit-done/workflows/brainstorm.md | grep -q "0" && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Step 8 uses gsd-tools.cjs commit CLI. No raw git add/commit commands remain in brainstorm.md. The file contains exactly 2 gsd-tools.cjs references (Step 8 and Step 10b).</done>
</task>

</tasks>

<verification>
- `grep "git add\|git commit" get-shit-done/workflows/brainstorm.md` returns no matches
- `grep "gsd-tools.cjs" get-shit-done/workflows/brainstorm.md` returns exactly 2 matches (Step 8 and Step 10b)
- Step 8 commit command follows the same `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "message" --files "path"` pattern as Step 10b
</verification>

<success_criteria>
brainstorm.md Step 8 uses gsd-tools.cjs commit CLI. All .planning file commits in brainstorm.md now respect commit_docs config.
</success_criteria>

<output>
After completion, create `.planning/quick/9-fix-brainstorm-md-to-use-gsd-tools-commi/9-SUMMARY.md`
</output>
