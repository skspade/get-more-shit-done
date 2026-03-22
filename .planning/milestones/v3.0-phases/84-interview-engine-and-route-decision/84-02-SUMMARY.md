# Plan 84-02: Routing Decision + Heuristic Removal + Step Renumbering — Summary

**Completed:** 2026-03-22
**Status:** Complete
**Commits:** fee6c8e, ed2f751
**Requirements completed:** ROUT-01, ROUT-02, ROUT-03, ROUT-04, WKFL-01

## What Was Built

1. **Routing Decision (new Step 4):** Three-tier routing fallback — flag override (Tier 1), interview answer (Tier 2), ticket inference with confirmation (Tier 3). Maps complexity signal: "Quick task" -> quick, "Medium" -> quick + $FULL_MODE, "Milestone" -> milestone.

2. **Scoring Heuristic Removal:** Deleted the entire $MILESTONE_SCORE 6-factor scoring table and threshold logic. No scoring remnants in functional code.

3. **Step Renumbering:** Old steps 4-7 became new steps 5-8. Sub-steps renumbered (5a-5i -> 6a-6i). Cross-references updated throughout.

4. **linear-context.md Update:** Removed `score` field from frontmatter template, added `interview: true` field.

5. **Command Spec Update:** Updated `commands/gsd/linear.md` objective and process to reference interview-driven routing instead of complexity scoring.

6. **Success Criteria Update:** Replaced scoring-related criteria with interview-related criteria referencing INTV-* and ROUT-* requirement IDs.

## Key Decisions

- Step count is 8 (not 9 as originally estimated): Steps 1-2 (unchanged) + 3 (interview) + 4 (routing) + 5 (write context) + 6 (execute) + 7 (comment-back) + 8 (cleanup)
- The only MILESTONE_SCORE reference remaining is in success criteria documenting its removal (ROUT-02 check)
- Tier 3 routing uses AskUserQuestion for confirmation rather than silent inference

## Self-Check: PASSED

- [x] $MILESTONE_SCORE scoring table fully deleted
- [x] No score field in linear-context.md frontmatter
- [x] Step 4 has three-tier routing
- [x] Steps renumbered correctly (5, 6, 7, 8)
- [x] Sub-steps renumbered (6a through 6i)
- [x] Command spec references interview-driven routing
- [x] Success criteria updated

## Key Files

### Modified
- `/Users/seanspade/.claude/get-shit-done/workflows/linear.md` — Routing decision, step renumbering, frontmatter update, success criteria
- `/Users/seanspade/.claude/commands/gsd/linear.md` — Command spec updated for interview routing
