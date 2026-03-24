---
phase: quick-11
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/pr-review.md
autonomous: true
requirements:
  - QUICK-11
must_haves:
  truths:
    - "PR review diffs against the current remote base branch, not a stale local copy"
    - "Base branch is auto-detected from the PR (via gh pr view) with a fallback to the repo default branch"
    - "Existing workflow steps (parse args, capture review, etc.) continue to work unchanged"
  artifacts:
    - path: "get-shit-done/workflows/pr-review.md"
      provides: "New Step 2 that fetches and updates the base branch before review capture"
      contains: "git fetch origin"
  key_links:
    - from: "Step 2 (new): Fetch and update base branch"
      to: "Step 3 (old Step 2): Capture review"
      via: "Sequential step ordering — fetch completes before review begins"
      pattern: "git fetch origin.*base_branch"
---

<objective>
Add a new step to the PR review workflow that fetches and updates the local base branch from origin before the review capture step. This eliminates diff noise caused by stale local base branches showing already-merged changes in the review diff.

Purpose: When pr-review runs, the local main (or other base branch) is often behind origin, inflating the diff with irrelevant changes. Fetching before review ensures the diff only contains actual PR changes.
Output: Updated pr-review.md with a new "Step 2: Fetch and update base branch" inserted between the current Step 1 and Step 2.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/workflows/pr-review.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert base branch fetch step into pr-review workflow</name>
  <files>get-shit-done/workflows/pr-review.md</files>
  <action>
Insert a new **Step 2: Fetch and update base branch** between the current Step 1 (Parse arguments) and the current Step 2 (Capture review). Renumber all subsequent steps (old Step 2 becomes Step 3, old Step 3 becomes Step 4, etc. — there are currently Steps 1-11, so the final workflow will have Steps 1-12).

The new Step 2 content should be:

```
**Step 2: Fetch and update base branch**

Detect the base branch and update the local ref from origin so the review diffs against current remote state, not a stale local copy.

**2a. Detect base branch:**

```bash
BASE_BRANCH=$(gh pr view --json baseRefName --jq '.baseRefName' 2>/dev/null)
```

If `gh pr view` fails (no PR context, not on a PR branch, or gh not available), fall back:

```bash
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
```

If both fail, default: `BASE_BRANCH="main"`

Store `$BASE_BRANCH` for use in this step.

**2b. Fetch and update local ref:**

```bash
git fetch origin "$BASE_BRANCH"
```

Then update the local branch ref without checking it out:

```bash
git branch -f "$BASE_BRANCH" "origin/$BASE_BRANCH" 2>/dev/null || true
```

The `|| true` handles the case where we are currently on the base branch (git will refuse to force-update the checked-out branch, but in that case local is already up-to-date from the fetch).

Display: `"Base branch: ${BASE_BRANCH} (updated from origin)"`
```

IMPORTANT details for the edit:
- Insert the new step after the `---` separator following Step 1 and before the current Step 2.
- Renumber ALL subsequent steps: current Step 2 becomes Step 3, Step 3 becomes Step 4, ..., Step 11 becomes Step 12.
- Update any internal references to step numbers if they exist (e.g., "proceed to Step 8" would become "proceed to Step 9"). Specifically check:
  - Step 7a references "proceed to Step 8" (should become "proceed to Step 9")
  - Step 7b/7c references are relative and may not need changes
  - Step 8 references in routing should be updated
- Add a `---` separator after the new Step 2, consistent with the existing formatting between steps.
- Do NOT modify any step content beyond renumbering and updating cross-references.
  </action>
  <verify>
    <automated>grep -c "Step [0-9]*:" get-shit-done/workflows/pr-review.md | grep -q "12" && grep -q "git fetch origin" get-shit-done/workflows/pr-review.md && grep -q "gh pr view.*baseRefName" get-shit-done/workflows/pr-review.md && grep -q "BASE_BRANCH" get-shit-done/workflows/pr-review.md && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>
- New Step 2 exists with base branch detection (gh pr view with fallback) and git fetch
- All subsequent steps renumbered (12 total steps)
- All internal step cross-references updated
- No existing step content modified beyond renumbering
  </done>
</task>

</tasks>

<verification>
- The workflow file has exactly 12 step headers (Step 1 through Step 12)
- Step 2 contains `gh pr view --json baseRefName` for detection
- Step 2 contains `git fetch origin "$BASE_BRANCH"` for updating
- Step 2 contains `git branch -f` for local ref update
- Step 2 has a fallback chain: gh pr view -> git symbolic-ref -> default "main"
- Old Step 2 (Capture review) is now Step 3 and its content is unchanged
- All step cross-references are correctly updated
</verification>

<success_criteria>
The pr-review workflow now fetches and updates the base branch from origin before performing the review capture, ensuring diffs reflect the current state of the base branch rather than a stale local copy.
</success_criteria>

<output>
After completion, create `.planning/quick/11-add-git-fetch-and-base-branch-update-bef/11-SUMMARY.md`
</output>
