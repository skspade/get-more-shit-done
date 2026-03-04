---
quick_task: 5
description: "Replace the GSDC CLI alias with GMSD"
completed: "2026-03-04T16:55:21Z"
duration: "38s"
tasks_completed: 1
tasks_total: 1
key_files:
  modified:
    - package.json
    - package-lock.json
decisions: []
---

# Quick Task 5: Replace the GSDC CLI Alias with GMSD

Renamed the `gsdc` bin alias to `gmsd` in package.json to match the fork identity (get-more-shit-done).

## Task Summary

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Rename gsdc bin alias to gmsd in package.json | c353318 | Done |

## What Changed

- `package.json`: Replaced `"gsdc"` key with `"gmsd"` in the `bin` object, both pointing to `get-shit-done/bin/gsd-cli.cjs`
- `package-lock.json`: Updated automatically via `npm install` to reflect the new symlink

## Verification

- Bin keys confirmed: `["get-more-shit-done-cc", "gsd", "gmsd"]` (no `gsdc`)
- `npx gmsd --help` runs successfully

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] package.json updated with gmsd alias
- [x] gsdc alias removed
- [x] Commit c353318 exists
