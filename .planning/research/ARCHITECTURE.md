# Architecture Research

**Domain:** /gsd:test-review integration with existing GSD Autopilot framework
**Researched:** 2026-03-21
**Confidence:** HIGH

## System Overview

```
/gsd:test-review Command Flow
==============================

┌─────────────────────────────────────────────────────────────────┐
│                       Command Layer                              │
│  ┌──────────────────┐                                            │
│  │ test-review.md   │  Thin orchestrator: args, git diff,        │
│  │ (NEW)            │  gather data, spawn agent, write report,   │
│  │                  │  prompt user, route result                  │
│  └────────┬─────────┘                                            │
│           │ Task()                                               │
├───────────┴──────────────────────────────────────────────────────┤
│                       Agent Layer                                │
│  ┌──────────────────┐                                            │
│  │ gsd-test-reviewer│  Read-only analysis: diff parsing,         │
│  │ (NEW)            │  coverage gaps, staleness, consolidation   │
│  └────────┬─────────┘                                            │
│           │ returns structured report                            │
├───────────┴──────────────────────────────────────────────────────┤
│                    Existing Infrastructure                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │
│  │testing.  │  │gsd-tools │  │init.cjs  │  │quick task    │     │
│  │cjs       │  │.cjs      │  │          │  │infra         │     │
│  │(reuse)   │  │(reuse)   │  │(new init)│  │(reuse)       │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `commands/gsd/test-review.md` | Thin orchestrator: parse args, gather diff + test data, spawn agent, write report, user prompt, route to quick/milestone/done | **NEW** |
| `agents/gsd-test-reviewer.md` | Read-only analysis: parse diff, detect coverage gaps, detect stale tests, suggest consolidation, compile report | **NEW** |
| `init.cjs` cmdInitTestReview() | Resolve models, quick task numbering, timestamps, paths, file existence checks | **NEW function** (in existing file) |
| `gsd-tools.cjs` init test-review | Dispatch entry routing to cmdInitTestReview | **NEW case** (in existing file) |
| `testing.cjs` | findTestFiles(), countTestsInProject(), getTestConfig() | **REUSE as-is** |
| `gsd-tools.cjs` test-count, test-config | CLI dispatch for test data gathering | **REUSE as-is** |
| `gsd-tools.cjs` commit, generate-slug | Report commit, slug generation for quick tasks | **REUSE as-is** |
| Quick task directory structure | .planning/quick/{N}-{slug}/ with PLAN.md, SUMMARY.md | **REUSE as-is** |
| pr-review.md workflow patterns | Quick route and milestone route code patterns | **PATTERN REFERENCE** (not imported) |
| `commands/gsd/help.md` | Command reference table | **UPDATE** (add entry) |
| `USER-GUIDE.md`, `README.md` | User-facing documentation | **UPDATE** (add section) |

## New Components Required

### 1. `commands/gsd/test-review.md` (command spec)

Follows the `audit-tests.md` pattern: direct agent spawn, no workflow file needed.

**Why no workflow file:** The command's flow is linear (gather data, spawn agent, write report, prompt, route). No branching complexity that warrants a separate workflow. This matches `audit-tests.md` (direct spawn) rather than `pr-review.md` (which needs a workflow for its multi-step capture/parse/dedup/score pipeline).

**Key difference from audit-tests.md:** After the agent returns, this command has a routing step (quick/milestone/done). The routing logic lives inline in the command spec, not in a workflow. This is similar to how `linear.md` handles routing inline.

**Structure:**
```
---
name: gsd:test-review
description: Analyze branch diff and recommend test improvements
argument-hint: "[--report-only]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---
<objective>...</objective>
<execution_context>No workflow file -- direct agent spawn with inline routing.</execution_context>
<context>$ARGUMENTS</context>
<process>
  1. Parse --report-only flag
  2. Get changed files: git diff main...HEAD --name-only
  3. If empty, display "No changes" and exit
  4. Get full diff: git diff main...HEAD
  5. Gather test data (test-count, test-config, find test files)
  6. Display banner
  7. Spawn gsd-test-reviewer via Task()
  8. Write report to .planning/reviews/YYYY-MM-DD-test-review.md
  9. Commit report
  10. If --report-only, exit
  11. AskUserQuestion: "Fix these? (quick / milestone / done)"
  12. Route based on answer
</process>
```

### 2. `agents/gsd-test-reviewer.md` (agent definition)

Follows the `gsd-test-steward.md` pattern: read-only analysis agent.

**Tools:** Read, Bash, Grep, Glob (same as test steward -- no Write needed, agent is read-only)

**Input:** Receives `<test-review-input>` XML block from the command with diff, changed files, test count, test config, and test file list.

**6-step process:**
1. Parse diff (extract changed files, functions, modules)
2. Coverage gap analysis (check for corresponding test files)
3. Staleness detection (test refs to changed/deleted code)
4. Consolidation analysis (duplicate/overlapping tests in diff scope)
5. Generate structured recommendations
6. Compile markdown report

**Output:** Structured markdown report returned to orchestrator.

### 3. `init.cjs` cmdInitTestReview() (init function)

Near-identical to `cmdInitPrReview()`. Resolves: planner_model, executor_model, checker_model, verifier_model, commit_docs, next_num, date, timestamp, paths, file existence.

**Why a separate init function vs reusing pr-review init:** The design doc states the command is "purely additive" with no modifications to existing files beyond docs. A separate init function keeps the concerns clean and allows future divergence (e.g., test-review might need test-specific config data that pr-review doesn't).

### 4. `gsd-tools.cjs` dispatch entries

Two additions:
- `case 'test-review':` under the `init` switch -- routes to `cmdInitTestReview`
- Update the error message's "Available:" list to include `test-review`

## Existing Components Reused (No Modification)

| Component | What's Reused | How |
|-----------|---------------|-----|
| `testing.cjs` findTestFiles() | Discover all test files in project | Called via gsd-tools test-count or directly in agent |
| `testing.cjs` getTestConfig() | Get test budget/config for context | Called via gsd-tools test-config |
| `gsd-tools.cjs` test-count | CLI access to test counts | Bash call in command |
| `gsd-tools.cjs` test-config | CLI access to test config | Bash call in command |
| `gsd-tools.cjs` commit | Commit report file | Bash call in command |
| `gsd-tools.cjs` generate-slug | Generate directory slug for quick tasks | Bash call in routing |
| `gsd-tools.cjs` resolve-model | Resolve agent model from config | Bash call in command |
| Quick task infrastructure | .planning/quick/{N}-{slug}/ directory, STATE.md update | Pattern from pr-review.md steps 8a-8i |
| Milestone infrastructure | MILESTONE-CONTEXT.md, /gsd:new-milestone --auto | Pattern from pr-review.md step 9 |
| .planning/reviews/ directory | Report storage alongside pr-review reports | Shared directory |

## Architectural Patterns

### Pattern 1: Direct Agent Spawn (audit-tests pattern)

**What:** Command gathers data, spawns a single agent via Task(), displays results. No workflow file.
**When to use:** Linear flow with no complex branching. The command IS the orchestrator.
**Trade-offs:** Simpler (fewer files), but routing logic must be inline in the command.

This is the right pattern for test-review because:
- Data gathering is straightforward (git diff + gsd-tools calls)
- Agent does all the analysis work
- Routing is a simple 3-way user choice, not computed scoring

### Pattern 2: XML Context Block (pr-review/linear pattern)

**What:** Command passes structured data to agent/planner via XML blocks (`<test-review-input>`, `<test-review-findings>`).
**When to use:** When structured data needs to cross the command-to-agent boundary.
**Trade-offs:** Verbose but unambiguous. Agents parse XML blocks reliably.

### Pattern 3: User-Choice Routing (linear pattern, NOT pr-review scoring)

**What:** After analysis, ask user what to do (quick/milestone/done) rather than auto-scoring.
**When to use:** When the decision requires human judgment about scope. Test recommendations don't have a natural numeric scoring heuristic like pr-review findings do.
**Trade-offs:** Requires human interaction (blocks autopilot), but test review is explicitly an on-demand tool, not part of the autonomous pipeline.

## Data Flow

### Primary Flow

```
User runs /gsd:test-review [--report-only]
    |
    v
Command: git diff main...HEAD --name-only
    |
    v (if empty, exit "No changes")
    |
Command: git diff main...HEAD (full diff)
    |
Command: gsd-tools test-count, test-config
    |
Command: resolve-model gsd-test-reviewer
    |
    v
Task(gsd-test-reviewer) with <test-review-input>
    |
    v
Agent: 6-step analysis
    |
    v (returns structured report)
    |
Command: Write .planning/reviews/YYYY-MM-DD-test-review.md
Command: gsd-tools commit
    |
    v (if --report-only, exit)
    |
AskUserQuestion: "quick / milestone / done"
    |
    ├── done: exit
    |
    ├── quick: gsd-tools init test-review -> spawn planner -> executor -> STATE.md update
    |
    └── milestone: write MILESTONE-CONTEXT.md -> /gsd:new-milestone --auto
```

### Quick Route Data Flow (reuses pr-review pattern)

```
User selects "quick"
    |
    v
gsd-tools init test-review -> {models, next_num, paths}
    |
gsd-tools generate-slug "{description}"
    |
mkdir .planning/quick/{N}-{slug}/
    |
Task(gsd-planner) with <test-review-findings> XML
    |  -> creates {N}-PLAN.md (one task per recommendation group)
    |
Task(gsd-executor) with plan
    |  -> executes tasks, creates {N}-SUMMARY.md
    |
Update STATE.md quick tasks table (Source: test-review)
    |
gsd-tools commit
```

### Milestone Route Data Flow

```
User selects "milestone"
    |
    v
Write .planning/MILESTONE-CONTEXT.md from report findings
    |  (each category becomes a feature section)
    |
Delegate to /gsd:new-milestone --auto
    |  (consumes MILESTONE-CONTEXT.md, creates roadmap)
```

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Command -> Agent | Task() spawn with XML input block | Agent returns markdown report as text |
| Command -> gsd-tools | Bash calls to gsd-tools.cjs | test-count, test-config, commit, generate-slug, init, resolve-model |
| Command -> git | Direct bash calls | git diff main...HEAD, git diff main...HEAD --name-only |
| Command -> Quick infra | Follows pr-review Steps 8a-8i inline | Same planner/executor spawn pattern |
| Command -> Milestone infra | Writes MILESTONE-CONTEXT.md, calls /gsd:new-milestone | Same as pr-review Step 9 |
| Agent -> codebase | Read, Grep, Glob tools | Agent reads test files and source files to analyze coverage |
| Report -> reviews/ dir | Shared with pr-review reports | Different filename suffix: -test-review.md vs -pr-review.md |
| STATE.md Source column | "test-review" value | Uses existing generic Source column (already renamed from "Linear") |

### No Interaction Points

| Component | Why No Integration |
|-----------|-------------------|
| gsd-test-steward | Independent agent. Same vocabulary but different trigger (milestone audit vs on-demand diff review). No code sharing needed. |
| audit-milestone workflow | test-review is on-demand, not part of milestone audit pipeline |
| autopilot.mjs | test-review is interactive (user prompt), not part of autonomous pipeline |
| execute-plan workflow | Quick task routing uses direct planner/executor spawns, not the full execute-plan workflow |

## Anti-Patterns

### Anti-Pattern 1: Sharing Agent Logic Between Steward and Reviewer

**What people do:** Extract shared analysis functions into a common module used by both gsd-test-steward and gsd-test-reviewer.
**Why it's wrong:** Both are LLM agents defined in markdown prompt files, not code modules. Their analysis happens in-context, not in shared functions. The strategy vocabulary (prune/parameterize/promote/merge) is carried in each agent's prompt independently.
**Do this instead:** Keep agents fully self-contained. Duplicate the strategy definitions in the reviewer's prompt. This is not DRY violation -- it is prompt engineering best practice.

### Anti-Pattern 2: Auto-Scoring for Route Decision

**What people do:** Copy pr-review's numeric scoring heuristic to auto-route test recommendations.
**Why it's wrong:** PR review findings have natural severity levels (critical/important/suggestion) that map to numeric scores. Test recommendations don't -- a single missing test for a critical function is more important than 10 consolidation suggestions. The decision requires human judgment.
**Do this instead:** Use AskUserQuestion for the routing decision. The report gives the user enough context to decide.

### Anti-Pattern 3: Creating a Workflow File for Simple Linear Flow

**What people do:** Create a workflow .md file because other complex commands (pr-review, linear) have them.
**Why it's wrong:** test-review's flow is linear: gather, analyze, report, route. No complex branching, no multi-step capture/parse/dedup pipeline. A workflow file adds indirection without value.
**Do this instead:** Keep all logic in the command spec. Follow the audit-tests.md pattern (direct agent spawn).

### Anti-Pattern 4: Modifying testing.cjs for Diff-Aware Functions

**What people do:** Add diff-aware test analysis functions to testing.cjs so the agent can call them.
**Why it's wrong:** The agent's analysis is LLM-powered (reading diffs, understanding code semantics). CJS utility functions can't do semantic analysis. Adding functions would create dead code or incomplete heuristics.
**Do this instead:** Let the agent do the analysis using its Read/Grep/Glob tools. testing.cjs provides data (test counts, config, file lists), the agent provides intelligence.

## Suggested Build Order

Based on dependency analysis and the ability to test incrementally:

### Phase 1: Agent Definition + Command Spec (core functionality)

1. **`agents/gsd-test-reviewer.md`** -- No dependencies. Can be written and reviewed standalone. The 6-step analysis process is the intellectual core of the feature.

2. **`commands/gsd/test-review.md`** -- Depends on agent existing. This is the orchestrator that gathers data, spawns the agent, writes the report, and handles --report-only exit. Routing (quick/milestone/done) is also here but can be tested last.

**Why together:** These two files are the minimum viable feature. With just these, a user can run `/gsd:test-review` and get a report. The init function is only needed for the quick task route.

### Phase 2: Init + Dispatch (routing infrastructure)

3. **`init.cjs` cmdInitTestReview()** -- Near-copy of cmdInitPrReview. Needed for quick task routing.

4. **`gsd-tools.cjs` init test-review case** -- One-line dispatch entry. Needed for the command to call init.

**Why after Phase 1:** Routing is only needed when the user selects "quick task" or "milestone". The report-only flow works without init.

### Phase 3: Documentation

5. **`commands/gsd/help.md`** -- Add test-review to command reference table.

6. **`USER-GUIDE.md`** -- Add usage section.

7. **`README.md`** -- Add to command table.

**Why last:** Documentation doesn't block functionality. Update after the command works end-to-end.

### Phase 4: Tests

8. **Tests for new functionality** -- Init function tests (mirrors pr-review init tests), command behavior validation.

**Why separate:** Tests validate the implementation. Write after the implementation is stable.

## Sources

- Design doc: `.planning/designs/2026-03-20-pr-test-review-command-design.md` (HIGH confidence -- approved design)
- Existing patterns: `commands/gsd/audit-tests.md`, `commands/gsd/pr-review.md`, `agents/gsd-test-steward.md` (HIGH confidence -- production code)
- Infrastructure: `get-shit-done/bin/lib/testing.cjs`, `get-shit-done/bin/lib/init.cjs`, `get-shit-done/bin/gsd-tools.cjs` (HIGH confidence -- production code)
- PROJECT.md active requirements (HIGH confidence -- canonical source)

---
*Architecture research for: /gsd:test-review integration with GSD Autopilot framework*
*Researched: 2026-03-21*
