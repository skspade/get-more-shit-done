---
plan: 89-01
phase: 89
title: Fix 3 routing lines in linear.md
status: complete
completed: "2026-03-22"
duration: ~1min
---

# Summary: 89-01 Fix 3 routing lines in linear.md

## What was done

Changed three Step 5 exit references from "Step 7" to "Step 6" in `~/.claude/get-shit-done/workflows/linear.md`:

1. **Line 353** (quick route, "Yes, proceed"): "Continue to Step 7" -> "Continue to Step 6"
2. **Line 374** (quick route, "Cancel -- proceed as-is"): "Continue to Step 7" -> "Continue to Step 6"
3. **Line 474** (milestone route, approach selected): "Proceed to Step 7" -> "Proceed to Step 6"

## Key files

### Modified
- `~/.claude/get-shit-done/workflows/linear.md` — 3 lines changed

## Self-Check: PASSED

- [x] Line 353 says "Continue to Step 6"
- [x] Line 374 says "Continue to Step 6"
- [x] Line 474 says "Proceed to Step 6"
- [x] No remaining "Step 7" references in Step 5 section
- [x] Step 6 (line 490) is reachable from all Step 5 exits
- [x] Step 6 still flows to Step 7 (unchanged)
- [x] E2E flow: 1-2-3-4-5-6-7-8-9-10

## Deviations

None.
