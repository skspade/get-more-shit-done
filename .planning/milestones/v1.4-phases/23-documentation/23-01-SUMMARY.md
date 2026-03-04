---
phase: 23
plan: 1
title: Document /gsd:linear in USER-GUIDE.md and README.md
status: complete
started: "2026-03-03"
completed: "2026-03-03"
requirements_completed: [DOCS-01, DOCS-02]
---

# Summary: 23-01 Document /gsd:linear

Added `/gsd:linear` documentation to both USER-GUIDE.md and README.md. Three commits, one per task:

1. **Command reference table entry** -- Added `/gsd:linear <issue-id> [flags]` row to the "Brownfield & Utilities" table in USER-GUIDE.md with purpose and when-to-use columns.

2. **Linear Integration section** -- Added a new subsection under Usage Examples in USER-GUIDE.md with:
   - Flags table (none, --quick, --milestone, --full)
   - Routing heuristic explanation (6 scoring factors, threshold at score >= 3)
   - 6 usage examples covering all flags and the multi-issue case
   - Comment-back behavior note

3. **README.md Utilities table** -- Added `/gsd:linear <issue-id> [flags]` row to the Utilities command table with one-line description.

## Self-Check: PASSED

- [x] USER-GUIDE.md Brownfield & Utilities table has /gsd:linear row
- [x] USER-GUIDE.md has Linear Integration section with flags, heuristic, examples
- [x] README.md Utilities table has /gsd:linear row
- [x] All content matches CONTEXT.md locked decisions
- [x] No code changes, documentation only

## Key Files

### Modified
- `docs/USER-GUIDE.md` -- Command reference + Linear Integration section
- `README.md` -- Utilities table entry

## Decisions Made

- Placed Linear Integration section after "Mid-Milestone Scope Changes" and before "Troubleshooting" separator -- logical grouping with other usage examples
- Used 6 examples (exceeds CONTEXT.md minimum of 4-5) to cover all flags and multi-issue case
- Kept section at ~40 lines (within CONTEXT.md target of 30-50)
