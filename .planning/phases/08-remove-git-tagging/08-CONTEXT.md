# Phase 8: Remove Git Tagging - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The complete-milestone workflow no longer creates or pushes git tags, and no documentation claims it does. This is a focused removal phase -- stripping the `git_tag` step from the workflow, removing the tag push prompt, and updating all user-facing documentation (command spec, help, README, user guide) to eliminate references to automated git tagging during milestone completion.

</domain>

<decisions>
## Implementation Decisions

### Workflow Code Removal (WF-01, WF-02)
- Remove the entire `<step name="git_tag">` section from `get-shit-done/workflows/complete-milestone.md`
- Remove the tag creation command (`git tag -a v[X.Y] ...`) and the "Push tag to remote?" prompt and push logic
- Update the `<purpose>` line to remove "and tags the release in git"
- Update references in `handle_branches` step that say "Skip to git_tag" to skip to the next applicable step (Claude's Decision: references to a removed step must point to the correct successor step)
- Remove the `Git tag created (v[X.Y])` line from the workflow success criteria checklist

### Command Spec Cleanup (WF-03)
- Remove "git tagged" from the `<objective>` output line in `commands/gsd/complete-milestone.md`
- Remove step 7's tag creation and push prompt (lines 107-108) from the `<process>` section
- Remove "Git tag v{{version}} created" from the command spec's `<success_criteria>`

### Documentation Updates (DOC-01, DOC-02, DOC-03)
- Remove "Creates git tag for the release" from the `/gsd:complete-milestone` entry in `get-shit-done/workflows/help.md`
- Update the `/gsd:complete-milestone` description in `help.md` to reflect archive-only behavior
- Update `README.md` line "archives the milestone and tags the release" to remove the tag reference
- Update `README.md` command table entry for `/gsd:complete-milestone` to remove "tag release"
- Update `docs/USER-GUIDE.md` command table entry for `/gsd:complete-milestone` to remove "tag release"

### Editing Approach
- Edit files in place -- remove tag-related lines/sections, do not leave stubs or TODOs (Claude's Decision: clean removal leaves no dead code or confusing references)
- Preserve all non-tag-related functionality in each file exactly as-is (Claude's Decision: minimal-diff approach reduces risk of unintended changes)
- The `handle_branches` step references "Skip to git_tag" in two places -- update these to "Skip to git_commit_milestone" since that is the next step after git_tag is removed (Claude's Decision: git_commit_milestone is the step that follows git_tag in the current workflow sequence)

### Claude's Discretion
- Exact wording of updated `/gsd:complete-milestone` descriptions after tag references are removed
- Whether to renumber step 7 in the command spec or leave a gap after removing the tag step
- Minor formatting adjustments to maintain consistent whitespace after removals

</decisions>

<specifics>
## Specific Ideas

Exact locations identified for each requirement:

**WF-01 (tag creation removal):**
- `get-shit-done/workflows/complete-milestone.md` lines 646-672: entire `<step name="git_tag">` block

**WF-02 (tag push removal):**
- Same block as WF-01 -- the push logic is lines 665-670 within the git_tag step

**WF-03 (command spec cleanup):**
- `commands/gsd/complete-milestone.md` line 16: "git tagged" in objective output
- `commands/gsd/complete-milestone.md` lines 107-108: tag creation and push prompt in step 7
- `commands/gsd/complete-milestone.md` line 122: "Git tag v{{version}} created" in success criteria

**DOC-01 (help.md):**
- `get-shit-done/workflows/help.md` line 182: "Creates git tag for the release"

**DOC-02 (README.md):**
- `README.md` line 349: "archives the milestone and tags the release"
- `README.md` line 475: "Archive milestone, tag release"

**DOC-03 (USER-GUIDE.md):**
- `docs/USER-GUIDE.md` line 169: "Archive milestone, tag release"

**Additionally in workflow (supports WF-01/WF-02):**
- `get-shit-done/workflows/complete-milestone.md` line 3: purpose mentions "tags the release in git"
- `get-shit-done/workflows/complete-milestone.md` lines 536, 552: "Skip to git_tag" references in handle_branches step
- `get-shit-done/workflows/complete-milestone.md` line 754: "Git tag created (v[X.Y])" in success criteria

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No new code is being written -- this is purely a removal/edit phase

### Established Patterns
- Workflow files use XML-like `<step name="...">` sections -- removal means deleting the entire step block including open/close tags
- Command specs use `<process>`, `<objective>`, and `<success_criteria>` sections -- edits are inline within these sections
- Documentation files use markdown tables for command references -- edits are cell-level within existing rows

### Integration Points
- `get-shit-done/workflows/complete-milestone.md` is the authoritative workflow; `commands/gsd/complete-milestone.md` is the command entry point that loads it
- `get-shit-done/workflows/help.md` is loaded by `commands/gsd/help.md` -- only the workflow file contains the actual content
- `README.md` and `docs/USER-GUIDE.md` are standalone documentation files with no code dependencies
- `milestone.cjs` is explicitly out of scope per REQUIREMENTS.md -- it handles file archival, not git tags
- The `handle_branches` step currently routes to `git_tag` as its next step -- after removal, it should route to `git_commit_milestone`

</code_context>

<deferred>
## Deferred Ideas

- CHANGELOG link updates -- historical links to upstream tags left as-is (from REQUIREMENTS.md Out of Scope)
- Removing version numbering -- versions still useful for milestone tracking, just not as git tags (from REQUIREMENTS.md Out of Scope)
- milestone.cjs changes -- the code does not create git tags, only handles file archival (from REQUIREMENTS.md Out of Scope)
- README.md line 180 `"Bash(git tag:*)"` in the permissions example -- this is a generic Claude Code permissions snippet, not a GSD feature claim (Claude's Decision: this documents a Claude Code permission, not an automated GSD behavior -- removing it would break the security example)

</deferred>

---

*Phase: 08-remove-git-tagging*
*Context gathered: 2026-03-02 via auto-context*
