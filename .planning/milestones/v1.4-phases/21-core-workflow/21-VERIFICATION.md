---
phase: 21-core-workflow
status: passed
verified: 2026-03-03
score: 12/12
---

# Phase 21: Core Workflow - Verification

## Phase Goal
Users can invoke `/gsd:linear ISSUE-ID` to fetch a Linear issue, have it auto-routed to quick or milestone, and have the appropriate GSD workflow execute end-to-end.

## Must-Have Verification

### Truths (9/9 verified)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workflow parses issue IDs matching letter-dash-number patterns | PASS | `/[A-Z]+-\d+/gi` pattern in Step 1 |
| 2 | If no issue ID found, workflow prompts user via AskUserQuestion | PASS | AskUserQuestion with header "Linear Issue" in Step 1 |
| 3 | Workflow calls mcp get_issue with includeRelations:true | PASS | `mcp__plugin_linear_linear__get_issue` with `includeRelations: true` in Step 2 |
| 4 | Workflow calls list_comments for each issue | PASS | `mcp__plugin_linear_linear__list_comments` in Step 2 |
| 5 | Workflow displays fetched issue title, state, labels, and comment count | PASS | Display block in Step 2 |
| 6 | Routing heuristic scores and chooses quick (< 3) or milestone (>= 3) | PASS | Scoring table with 6 factors and threshold in Step 3 |
| 7 | Flag overrides bypass heuristic entirely | PASS | --quick and --milestone checks before scoring in Step 3 |
| 8 | Quick route synthesizes description and executes quick steps 2-8 | PASS | Steps 5a-5i implement full quick delegation |
| 9 | Milestone route builds MILESTONE-CONTEXT.md and executes new-milestone steps 1-11 | PASS | Steps 5a-5c implement full milestone delegation |

### Artifacts (1/1 verified)

| Artifact | Status | Evidence |
|----------|--------|----------|
| `get-shit-done/workflows/linear.md` | EXISTS | 510 lines, contains all workflow sections |

### Key Links (3/3 verified)

| From | To | Status | Evidence |
|------|-----|--------|----------|
| `commands/gsd/linear.md` | `workflows/linear.md` | LINKED | `@` reference in execution_context |
| `linear.md` | `quick.md` | DELEGATED | Quick route steps 5d-5i inline quick steps 2-8 |
| `linear.md` | `new-milestone.md` | DELEGATED | Milestone route steps 5a-5c inline new-milestone steps 1-11 |

## Requirement Coverage

| Requirement | Description | Plan | Status |
|-------------|-------------|------|--------|
| WKFL-01 | Parse issue IDs and flags from arguments | 21-01 | COVERED |
| WKFL-02 | Fetch issue data and comments via MCP | 21-01 | COVERED |
| WKFL-03 | Route via scoring heuristic | 21-01 | COVERED |
| WKFL-04 | Flag overrides bypass heuristic | 21-01 | COVERED |
| WKFL-05 | Quick route synthesizes and delegates | 21-01 | COVERED |
| WKFL-06 | Milestone route writes context and delegates | 21-01 | COVERED |

## Roadmap Success Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Workflow parses issue IDs and flags from arguments, prompting if no issue ID provided | PASS |
| 2 | Workflow fetches issue data and comments from Linear via MCP tools and displays what was fetched | PASS |
| 3 | Routing heuristic scores issues on count, sub-issues, description length, labels, and relations | PASS |
| 4 | Flag overrides bypass the heuristic entirely | PASS |
| 5 | Quick route synthesizes description and delegates; milestone route writes MILESTONE-CONTEXT.md and delegates | PASS |

## Human Verification

None required -- workflow file is a markdown prompt document, not executable code. Functional verification occurs when users invoke `/gsd:linear` with a real Linear issue.

---
*Phase: 21-core-workflow*
*Verified: 2026-03-03*
