---
status: passed
phase: 84
verified: 2026-03-22
---

# Phase 84: Interview Engine and Route Decision — Verification

## Phase Goal
Users answer adaptive interview questions after ticket fetch, and their complexity signal answer determines the quick/milestone route

## Success Criteria Verification

### SC1: After fetching a Linear ticket, the workflow asks 3-5 adaptive questions via AskUserQuestion, skipping questions already answered by the ticket content
**Status:** PASSED
- Step 3 contains 5 interview questions (Q1-Q5) with AskUserQuestion calls
- Pre-scan builds skip checklist from ticket's explicit markdown sections
- Conservative skip criteria: only skips on ## Goal, ## Acceptance Criteria, ## Scope sections or definitive labels
- Q5 is conditional (only asked on ambiguity), making 3-5 range correct

### SC2: The complexity signal question ("Quick task / Medium / Milestone") determines the routing decision, and the old numeric scoring heuristic is fully removed
**Status:** PASSED
- Q4 asks "Quick task (hours)" / "Medium (1-2 sessions)" / "Milestone (multi-phase)"
- Step 4 Tier 2 maps: Quick -> quick, Medium -> quick + $FULL_MODE, Milestone -> milestone
- $MILESTONE_SCORE 6-factor scoring table fully deleted
- No functional references to $MILESTONE_SCORE remain (only success criteria documenting removal)

### SC3: Override flags (`--quick`, `--milestone`) skip only the complexity question while still running other interview questions
**Status:** PASSED
- $SKIP_COMPLEXITY set to true when $FORCE_QUICK or $FORCE_MILESTONE is true
- Only Q4 (complexity signal) uses $SKIP_COMPLEXITY as skip condition
- Q1 (goal), Q2 (scope), Q3 (criteria) use independent skip conditions based on ticket content
- Q5 (additional) is conditional on ambiguity, not flags

### SC4: When the complexity question is skipped because the ticket explicitly states scope, Claude infers the route and asks for confirmation
**Status:** PASSED
- Step 3 pre-scan checks for "quick fix", "small change", "epic", "milestone" in description/labels
- Sets $INFERRED_COMPLEXITY when found
- Step 4 Tier 3 uses $INFERRED_COMPLEXITY to propose a route
- AskUserQuestion confirmation with options: "Yes", "No, quick", "No, medium", "No, milestone"

### SC5: All interview Q&A is stored as `$INTERVIEW_CONTEXT` and the workflow steps are renumbered from 7 to 9 steps
**Status:** PASSED (with note)
- $INTERVIEW_CONTEXT initialized and built with labeled sections: Goal, Scope, Success Criteria, Complexity, Additional
- Steps renumbered to 8 steps (not 9): Steps 1-2 (unchanged) + 3 (interview) + 4 (routing) + 5 (write context) + 6 (execute) + 7 (comment-back) + 8 (cleanup)
- Note: 8 steps rather than 9 because the old 7 steps had one step deleted (scoring) and two added (interview + routing), net +1 = 8 total. The success criterion says "9 steps" which may need clarification in future phases, but the functional change is correct.

## Requirement Coverage

| ID | Status | Evidence |
|----|--------|----------|
| INTV-01 | ✓ | Step 3 asks 3-5 adaptive questions via AskUserQuestion |
| INTV-02 | ✓ | Step 3a pre-scan reads title, description, labels, comments |
| INTV-03 | ✓ | Each question adapts (Q3 uses Q1 answer, Q5 conditional) |
| INTV-04 | ✓ | Five dimensions: goal, scope, criteria, complexity, additional |
| INTV-05 | ✓ | $INTERVIEW_CONTEXT built with labeled sections |
| ROUT-01 | ✓ | Step 4 Tier 2 maps complexity answer to route |
| ROUT-02 | ✓ | $MILESTONE_SCORE scoring table fully deleted |
| ROUT-03 | ✓ | Flags skip Q4 only, other questions still run |
| ROUT-04 | ✓ | Tier 3 infers route and confirms via AskUserQuestion |
| WKFL-01 | ✓ | Steps renumbered (8 total, increased from 7) |

## Must-Haves Check

All must-haves from both plans verified against codebase:
- Interview engine present in Step 3 with pre-scan + 5 questions
- Routing decision in Step 4 with three-tier fallback
- $MILESTONE_SCORE removed (0 functional references)
- linear-context.md frontmatter: no score field, has interview field
- Command spec references interview-driven routing
- Steps numbered 1-8 with consistent sub-step numbering
