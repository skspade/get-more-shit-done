# Architecture Patterns

**Domain:** /gsd:linear interview phase integration with existing workflow
**Researched:** 2026-03-22
**Confidence:** HIGH

## System Overview

```
/gsd:linear Workflow -- Current vs Refactored
=============================================

CURRENT (7 steps):                    REFACTORED (9 steps):

1. Parse arguments -----------------> 1. Parse arguments        [UNCHANGED]
2. Fetch issue data ----------------> 2. Fetch issue data       [UNCHANGED]
3. Route via heuristic ------+        3. Interview (3-5 Qs)     [NEW]
                             |        4. Route from interview    [NEW -- replaces 3]
                             x        5. Hybrid output           [NEW]
                                      5.5 Comment-back (pre)     [NEW]
4. Write linear-context.md ---------> 6. Write linear-context.md [MODIFIED]
5. Execute route -------------------> 7. Execute route           [MODIFIED]
6. Comment-back --------------------> 8. Completion comment-back [UNCHANGED]
7. Cleanup -------------------------> 9. Cleanup                 [UNCHANGED]
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `workflows/linear.md` Step 3 (old) | Complexity scoring heuristic ($MILESTONE_SCORE) | **DELETE** |
| `workflows/linear.md` Step 3 (new) | Interview: pre-scan ticket, ask 3-5 adaptive questions via AskUserQuestion | **NEW** |
| `workflows/linear.md` Step 4 (new) | Route decision from interview complexity signal question | **NEW** |
| `workflows/linear.md` Step 5 (new) | Hybrid output: confirmation summary (quick) or approach proposals (milestone) | **NEW** |
| `workflows/linear.md` Step 5.5 (new) | Pre-execution comment-back to Linear via MCP | **NEW** |
| `workflows/linear.md` Step 6 (was 4) | Write linear-context.md -- add `interview_summary` field | **MODIFIED** |
| `workflows/linear.md` Step 7 (was 5) | Execute route -- enriched descriptions from interview context | **MODIFIED** |
| `workflows/linear.md` Steps 8-9 | Completion comment-back + cleanup | **UNCHANGED** |
| `commands/gsd/linear.md` | Command spec -- update objective description | **MODIFIED** (minor) |
| `$INTERVIEW_CONTEXT` variable | Stores all Q&A from interview phase | **NEW data structure** |

## New Components Required

### 1. Interview Phase (New Step 3 in linear.md)

Replaces the `$MILESTONE_SCORE` calculation entirely. This is not a new file -- it is new content within the existing `linear.md` workflow.

**Structure within the step:**

1. **Pre-scan** -- Read ticket title, description, labels, comments. Build internal checklist of what is already clear (goal, scope, criteria, approach).

2. **Adaptive question loop** -- 3-5 questions via AskUserQuestion, each conditionally skipped:
   - Q1: Goal clarification (skip if description states goal)
   - Q2: Scope boundaries (skip if ticket names files/components)
   - Q3: Success criteria (skip if acceptance criteria exist)
   - Q4: Complexity signal (skip if --quick or --milestone flag; primary routing input)
   - Q5: Additional context (only if ambiguity remains)

3. **Output** -- Accumulate all answers into `$INTERVIEW_CONTEXT` string for downstream consumption.

**Why inline, not a separate agent:** AskUserQuestion cannot be called from within a Task() subagent -- it must be called from the top-level workflow. The interview is a direct user conversation, not analysis work. Extracting to an agent would fail at runtime.

### 2. Route Decision (New Step 4 in linear.md)

Replaces the scoring table with a direct mapping from the complexity signal answer:

| Answer | Route | Notes |
|--------|-------|-------|
| "Quick task (hours)" | quick | Straightforward |
| "Medium (1-2 sessions)" | quick + $FULL_MODE=true | Triggers plan-checking and verification |
| "Milestone (multi-phase)" | milestone | Full milestone creation |

**Override flags still bypass:** `--quick` and `--milestone` skip the complexity question but still run the other interview questions (goal, scope, criteria). Flags skip routing, not understanding.

**Inferred routing fallback:** If Q4 was skipped because the ticket was explicit enough, Claude infers the route and confirms with the user.

### 3. Hybrid Output (New Step 5 in linear.md)

Two presentation modes based on route:

**Quick route:** Confirmation summary (goal, scope, criteria, route). AskUserQuestion: "Yes, proceed" / "No, let me clarify". If "No", re-ask the relevant question and re-present.

**Milestone route:** 2-3 approach proposals with pros/cons, matching brainstorm Step 4. AskUserQuestion to select approach. Selected approach feeds MILESTONE-CONTEXT.md.

**Why diverge by route:** Quick tasks need validation ("did I understand you?"), milestone tasks need design input ("which direction?").

### 4. Pre-Execution Comment-Back (New Step 5.5 in linear.md)

Posts interview summary to Linear before execution starts. Uses `mcp__plugin_linear_linear__create_comment` already in allowed-tools.

**Failure handling:** Warning only, never blocks execution. Same pattern as completion comment-back.

**Result:** Each ticket gets two comments total -- interview summary before work, completion summary after work.

## Existing Components Modified

### 1. `workflows/linear.md` Step 6 (Write linear-context.md)

**Change:** Add `interview_summary` text field to YAML frontmatter. Remove `score` field.

```yaml
---
issue_ids: [LIN-123]
route: quick
interview_summary: "Goal: Fix the login redirect. Scope: auth module only. Criteria: Redirect works for all OAuth providers."
fetched: 2026-03-22
---
```

### 2. `workflows/linear.md` Step 7 (Execute route)

**Quick route 5a (description synthesis):** Replace `title + description[:1500]` truncation with interview-enriched context. `$DESCRIPTION` now includes goal, scope, and success criteria from interview.

**Milestone route 5a (MILESTONE-CONTEXT.md):** Add `## Selected Approach` section with the chosen approach name and description.

### 3. `commands/gsd/linear.md`

**Change:** Update `<objective>` text to mention interview phase. No tool changes -- AskUserQuestion is already allowed.

### 4. Success criteria in `workflows/linear.md`

**Remove:**
- "Routing heuristic scores on issue count, sub-issues, description, labels, relations (WKFL-03)"
- "Score >= 3 routes to milestone, < 3 routes to quick (WKFL-03)"

**Add:**
- "Interview asks 3-5 adaptive questions, skipping answered ones"
- "Route determined from interview complexity signal"
- "Quick route shows confirmation, milestone route shows approach proposals"
- "Interview summary posted to Linear before execution"

## Existing Components Reused (No Modification)

| Component | What's Reused | How |
|-----------|---------------|-----|
| AskUserQuestion | Interview questions + confirmation/selection | Already in allowed-tools |
| mcp create_comment | Pre-execution comment-back | Same API, second call point |
| mcp get_issue + list_comments | Ticket data for pre-scan | Already fetched in Step 2 |
| Quick task infrastructure | Steps 5b-5i (init, planner, executor, STATE.md) | Unchanged |
| Milestone infrastructure | MILESTONE-CONTEXT.md, new-milestone steps 1-11 | Unchanged except content |
| gsd-tools.cjs (init, commit, slug) | All CLI tooling | No changes |
| Completion comment-back (Step 8) | Post-execution summary | Unchanged |
| Cleanup (Step 9) | Delete linear-context.md | Unchanged |

## Architectural Patterns

### Pattern 1: Adaptive Skip (interview design)

**What:** Each question checks a precondition before asking. If the answer is already known from ticket data or previous answers, skip it.
**When to use:** When gathering information that may already be partially available from context.

**Implementation approach:**
```
For each question:
  1. Check if ticket data already answers this
  2. Check if a previous answer covers this
  3. If either YES, log "Skipping Q{N}: already answered by {source}"
  4. If NO, ask via AskUserQuestion
  5. After answer, update $INTERVIEW_CONTEXT
```

### Pattern 2: Dual-Mode Presentation (hybrid output)

**What:** Present different UI based on the routing decision -- lightweight confirmation for simple tasks, rich proposals for complex tasks.
**When to use:** When the same workflow serves both low-complexity and high-complexity paths with fundamentally different user needs.

### Pattern 3: Pre-Execution Comment-Back (audit trail)

**What:** Post understanding to the external system before starting work, not just after completion.
**When to use:** When work takes significant time and stakeholders need visibility into what will happen.

## Data Flow

### Full Flow (Interview Path)

```
User: /gsd:linear LIN-123
    |
    v
Step 1: Parse "LIN-123", no flags
    |
    v
Step 2: MCP get_issue + list_comments -> $ISSUES
    |
    v
Step 3: Pre-scan ticket data
    |   -> Goal clear? Scope bounded? Criteria stated? Approach indicated?
    |
    v
Step 3: AskUserQuestion loop (3-5 questions, skipping answered)
    |   -> $INTERVIEW_CONTEXT accumulated
    |
    v
Step 4: Route from complexity signal answer
    |   -> $ROUTE = "quick" | "milestone"
    |   -> $FULL_MODE = true (if "Medium")
    |
    +--- quick -----------------+
    |                           |
    v                           v
Step 5: Confirmation        Step 5: Approach proposals (2-3)
    |   "Does this look         |   "Which approach?"
    |    right?" -> Yes/No      |   -> Selected approach
    |                           |
    v                           v
Step 5.5: MCP create_comment (interview summary)
    |
    v
Step 6: Write linear-context.md (with interview_summary)
    |
    v
Step 7: Execute route
    |   Quick: enriched $DESCRIPTION from interview
    |   Milestone: MILESTONE-CONTEXT.md with selected approach
    |
    v
Step 8: MCP create_comment (completion summary)
    |
    v
Step 9: Cleanup linear-context.md
```

### Flag Override Data Flow

```
User: /gsd:linear LIN-123 --quick
    |
    v
Steps 1-2: Same as above
    |
    v
Step 3: Pre-scan + Questions Q1, Q2, Q3, Q5 (SKIP Q4 -- route predetermined)
    |   -> $INTERVIEW_CONTEXT still gathered
    |
    v
Step 4: $ROUTE = "quick" (flag override, no complexity question needed)
    |
    v
Steps 5-9: Same as above (confirmation summary path)
```

### Key Data Structures

**$INTERVIEW_CONTEXT** (string, accumulated):
```
Goal: Fix the login redirect loop for OAuth providers
Scope: auth module (src/auth/) -- specifically the callback handler
Success criteria: All three OAuth providers (Google, GitHub, GitLab) redirect correctly after login
Complexity: Quick task (hours)
Additional: The issue only affects the production environment, not local dev
```

**linear-context.md frontmatter** (modified):
```yaml
---
issue_ids: [LIN-123]
route: quick
interview_summary: "Goal: Fix login redirect loop. Scope: auth module. Criteria: All OAuth providers redirect correctly."
fetched: 2026-03-22T10:30:00Z
---
```

**MILESTONE-CONTEXT.md** (enriched for milestone route):
```markdown
# Milestone Context
...existing content...

## Selected Approach
**Approach 2: Event-Driven Refactor**
Restructure the notification pipeline to use an event bus pattern,
decoupling producers from consumers and enabling per-channel configuration.
```

## Anti-Patterns

### Anti-Pattern 1: Extracting Interview into a Separate Agent

**What people do:** Create a `gsd-interviewer` agent spawned via Task() that handles the question-asking.
**Why it's wrong:** AskUserQuestion cannot be called from within a Task() subagent -- it must be called from the top-level workflow. The interview is a direct user conversation, not analysis work. Spawning an agent would fail at runtime.
**Do this instead:** Keep interview logic inline in the workflow step.

### Anti-Pattern 2: Keeping the Scoring Heuristic as Fallback

**What people do:** Retain the $MILESTONE_SCORE calculation as a fallback when interview is inconclusive.
**Why it's wrong:** Two routing mechanisms create ambiguity and maintenance burden. The scoring heuristic was the problem being solved.
**Do this instead:** Remove the scoring table completely. If the interview is inconclusive, ask a follow-up question.

### Anti-Pattern 3: Storing Interview State in a Separate File

**What people do:** Write `.planning/interview-context.md` as a temporary file consumed later.
**Why it's wrong:** The interview data is consumed immediately within the same workflow execution. Writing to disk adds file lifecycle management for data that never leaves the workflow's scope.
**Do this instead:** Keep `$INTERVIEW_CONTEXT` as an in-memory variable. Persist only the summary into linear-context.md's frontmatter.

### Anti-Pattern 4: Making All Questions Mandatory

**What people do:** Always ask all 5 questions regardless of ticket clarity.
**Why it's wrong:** Well-written tickets already contain goal, scope, and criteria. Forcing users to re-state what is written creates friction.
**Do this instead:** Pre-scan the ticket and skip questions whose answers are already clear.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Step 2 -> Step 3 | $ISSUES data feeds pre-scan | Pre-scan reads title, description, labels, comments from already-fetched data |
| Step 3 -> Step 4 | $INTERVIEW_CONTEXT string | Complexity signal answer is primary routing input |
| Step 3 -> Step 5 | $INTERVIEW_CONTEXT string | Goal, scope, criteria feed confirmation/proposals |
| Step 5 -> Step 5.5 | Confirmed understanding or selected approach | Comment body built from confirmed interview answers |
| Step 5 -> Step 6 | interview_summary field | Persisted to linear-context.md frontmatter |
| Step 3 -> Step 7 (quick) | $INTERVIEW_CONTEXT enriches $DESCRIPTION | Replaces truncated ticket text with structured interview output |
| Step 5 -> Step 7 (milestone) | Selected approach name + description | Added to MILESTONE-CONTEXT.md as new section |

### External Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Workflow -> User | AskUserQuestion (3-5 times in interview + 1 in hybrid output) | More user interaction than current workflow (which has 0-1 questions) |
| Workflow -> Linear MCP | create_comment (Step 5.5, NEW) | Second comment-back call; first is pre-execution, existing is post-execution |

### No Interaction Points

| Component | Why No Integration |
|-----------|-------------------|
| gsd-tools.cjs | No new CLI commands needed; interview is pure workflow logic |
| init.cjs | No new init functions; routing infrastructure unchanged |
| autopilot.mjs | Linear workflow is interactive (AskUserQuestion); not part of autonomous pipeline |
| testing.cjs | No test-related changes |
| brainstorm.md | Approach proposals pattern is replicated, not imported |

## Sources

- Design doc: `.planning/designs/2026-03-22-refactor-linear-ticket-flow-interview-design.md` (HIGH confidence)
- Existing workflow: `get-shit-done/workflows/linear.md` (HIGH confidence)
- Command spec: `commands/gsd/linear.md` (HIGH confidence)
- PROJECT.md v3.0 requirements (HIGH confidence)
- brainstorm.md approach proposals pattern (HIGH confidence)

---
*Architecture research for: /gsd:linear interview phase integration*
*Researched: 2026-03-22*
