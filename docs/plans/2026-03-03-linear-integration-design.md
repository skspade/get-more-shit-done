# Linear Integration Design

**Date:** 2026-03-03
**Status:** Approved

## Problem

GMSD milestones and quicks are bootstrapped manually — the user re-types or copies issue details from Linear into `/gsd:new-milestone` or `/gsd:quick` commands. This loses context from Linear comments, linked issues, and acceptance criteria.

## Solution

A new `/gsd:linear` slash command that reads Linear issues via MCP tools, auto-decides whether to create a milestone or quick, delegates to the existing workflow, and posts a summary comment back to Linear.

## Command Interface

```
/gsd:linear LIN-123              # Single issue → auto-routes to quick or milestone
/gsd:linear LIN-123 LIN-456      # Multiple issues → groups into milestone
/gsd:linear LIN-123 --quick      # Force quick mode
/gsd:linear LIN-123 --milestone  # Force milestone mode
/gsd:linear LIN-123 --full       # Pass-through to quick's --full flag
```

## Routing Heuristic

**Route to Quick when:**
- Single issue with no sub-issues
- Description < 500 words
- No linked child issues or dependencies
- Labels include "bug", "fix", "chore", "docs"
- Low complexity (single concern, clear scope)

**Route to Milestone when:**
- Multiple issues passed as arguments
- Single issue with sub-issues/child issues
- Description > 500 words with multiple sections
- Labels include "feature", "epic"
- Issue has linked blocking/related issues

Simple weighted scoring. Ambiguous cases default to quick.

## Data Flow

```
/gsd:linear LIN-123
    ↓
Read Linear (get_issue + list_comments)
    ↓
Route Decision (heuristic or flag override)
    ↓
    ├── Quick Path: Synthesize task description → execute quick workflow inline
    └── Milestone Path: Synthesize feature list + proto-requirements → execute new-milestone workflow inline
    ↓
Post summary comment to Linear issue(s)
    ↓
Cleanup
```

## Context Synthesis

**For Quick path:** Build a concise task description from issue title + description + key comments. Pass as `$DESCRIPTION` to the quick workflow.

**For Milestone path:** Extract feature list from issue description, pull acceptance criteria as proto-requirements, identify scope boundaries from comments. Pre-populate milestone goals so the new-milestone workflow skips the "what do you want to build?" questioning phase.

## Linear Issue ID Traceability

- Quick: Linear issue ID stored in STATE.md quick task table (new column)
- Milestone: Linear issue ID(s) stored in REQUIREMENTS.md metadata

## Comment-Back Format

**Quick completion:**
```markdown
## GSD Quick Task Complete

**Task:** [description]
**Commit:** `[hash]`
**Summary:** [2-3 sentences from SUMMARY.md]

Artifacts: `.planning/quick/[N]-[slug]/`
```

**Milestone initialized:**
```markdown
## GSD Milestone Initialized

**Milestone:** v[X.Y] [Name]
**Phases:** [N] planned
**Requirements:** [N] mapped

Roadmap: `.planning/ROADMAP.md`
```

**Milestone complete:**
```markdown
## GSD Milestone Complete

**Milestone:** v[X.Y] [Name]
**Result:** All requirements verified
**Phases:** [N]/[N] complete, [N]/[N] plans shipped

Archived: `.planning/milestones/v[X.Y]-phases/`
```

## Implementation

Single new workflow file: `get-shit-done/workflows/linear.md`

**No new agents.** The orchestrator workflow reads Linear data and synthesizes context directly — lightweight enough that a dedicated agent would be overkill.

### Process Steps

1. Parse arguments — extract issue IDs and flags
2. Fetch Linear data — `get_issue` (with relations) + `list_comments` per issue
3. Analyze and route — apply heuristic; flag overrides heuristic
4. Synthesize context — format for target workflow
5. Store Linear reference — write issue ID(s) to `.planning/linear-context.md`
6. Delegate — execute quick or new-milestone workflow steps inline
7. Comment back — post summary to Linear via `create_comment`
8. Cleanup — remove `.planning/linear-context.md`

## Approach

Thin Orchestrator (Approach A) — leverages all existing infrastructure, no new agents, no new lib code. Can graduate to a full agent later if routing logic gets complex.

## Scope

- Works with any Linear team/project
- Supports single issue → quick, single large issue → milestone, multiple issues → milestone
- Comment-back posts summaries but does not change Linear issue status
