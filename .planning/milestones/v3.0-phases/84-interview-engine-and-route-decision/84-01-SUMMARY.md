# Plan 84-01: Interview Engine — Summary

**Completed:** 2026-03-22
**Status:** Complete
**Commit:** 1c6eec7
**Requirements completed:** INTV-01, INTV-02, INTV-03, INTV-04, INTV-05

## What Was Built

Added a new Step 3 (Interview) to the linear workflow between ticket fetch (Step 2) and the routing heuristic. The interview engine:

1. **Pre-scans** the primary issue's title, description, labels, and comments to build a conservative skip checklist — only skips questions when the ticket has explicit markdown sections (## Goal, ## Acceptance Criteria, ## Scope) or definitive content
2. **Asks 3-5 adaptive questions** via AskUserQuestion covering five dimensions: goal clarification, scope boundaries, success criteria, complexity signal, and additional context
3. **Assembles `$INTERVIEW_CONTEXT`** as a structured string with labeled sections (Goal, Scope, Success Criteria, Complexity, Additional)

## Key Decisions

- Questions adapt based on previous answers (Q3 uses Q1 goal answer, Q5 only asked if ambiguity detected)
- Skip criteria are conservative: explicit markdown sections or definitive labels only, never LLM inference
- `$SKIP_COMPLEXITY` set by flags (--quick/--milestone) or ticket content ("quick fix", "epic", etc.)
- `$INFERRED_COMPLEXITY` stored when ticket explicitly states scope, used by routing (Plan 02)

## Self-Check: PASSED

- [x] New Step 3 exists between Step 2 and old Step 3
- [x] Pre-scan reads title, description, labels, comments from $ISSUES[0]
- [x] 5 interview questions with adaptive logic
- [x] $INTERVIEW_CONTEXT assembled as labeled sections
- [x] Conservative skip criteria (explicit sections only)

## Key Files

### Created
(none — modified existing file)

### Modified
- `/Users/seanspade/.claude/get-shit-done/workflows/linear.md` — Added Step 3: Interview section (~120 lines)
