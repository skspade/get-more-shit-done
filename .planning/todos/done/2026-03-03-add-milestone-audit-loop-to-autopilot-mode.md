---
created: 2026-03-03T01:24:09.750Z
title: Add milestone audit loop to autopilot mode
area: planning
files:
  - .claude/get-shit-done/workflows/
---

## Problem

Autopilot mode currently finishes executing all phases but does not automatically run a milestone audit afterward. This means the user has to manually invoke `/gsd:audit-milestone` to verify completeness, and if gaps are found, manually plan fixes, execute them, and re-audit. This breaks the "hands-off" promise of autopilot.

## Solution

After autopilot finishes executing all phases in a milestone:
1. Automatically run the milestone audit (`/gsd:audit-milestone`)
2. If the audit passes — proceed to milestone completion
3. If the audit fails — automatically invoke `/gsd:plan-milestone-gaps` to create fix phases
4. Execute the generated fix phases
5. Re-run the milestone audit
6. Repeat the fix-audit loop until the audit passes (with a reasonable max iteration guard to prevent infinite loops)
