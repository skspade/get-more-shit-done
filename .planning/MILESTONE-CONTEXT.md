# Milestone Context

**Source:** Brainstorm session (Test Steward Consolidation Bridge)
**Design:** .planning/designs/2026-03-20-test-steward-consolidation-bridge-design.md

## Milestone Goal

Bridge the test steward's consolidation proposals into actionable cleanup phases during milestone gap closure. Currently, the steward produces proposals (parameterize, promote, prune, merge) that are recorded in the audit document but never acted on. This milestone makes them flow through plan-milestone-gaps as a fourth gap type, creating an executable test consolidation phase.

## Features

### Audit-Milestone Signal Change

Add `gaps.test_consolidation` array to MILESTONE-AUDIT.md frontmatter alongside existing gap types. When consolidation proposals exist but all other gaps pass, set audit status to `tech_debt` instead of `passed` to route to plan-milestone-gaps.

### Plan-Milestone-Gaps Extension

Extend plan-milestone-gaps to parse `gaps.test_consolidation` from the audit, group all proposals into a single "Test Suite Consolidation" phase (always last in gap closure sequence), and present it alongside other gap closure phases.

### Proposal-to-Task Mapping

Define how each steward strategy (prune, parameterize, promote, merge) maps to executable plan tasks with specific file targets, actions, and reduction estimates. CONTEXT.md seeding ensures the planner has full proposal details.

### Edge Cases and No-Op Behavior

Handle: no proposals (skip), steward disabled (skip), only test gaps (create phase), autopilot flow (natural routing), budget still over after consolidation (existing audit-fix loop).
