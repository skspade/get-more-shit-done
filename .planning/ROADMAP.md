# Roadmap: GSD Autopilot

## Milestones

- ✅ **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- ✅ **v1.1 Remove Git Tagging** — Phases 8-9 (shipped 2026-03-03)
- ✅ **v1.2 Add Milestone Audit Loop** — Phases 10-13 (shipped 2026-03-03)
- ✅ **v1.3 CLI Utilities** — Phases 14-19 (shipped 2026-03-03)
- 🚧 **v1.4 Linear Integration** — Phases 20-23 (in progress)

## Phases

<details>
<summary>✅ v1.0 GSD Autopilot (Phases 1-7) — SHIPPED 2026-03-02</summary>

- [x] Phase 1: Core Loop Infrastructure (3/3 plans) — completed 2026-03-02
- [x] Phase 2: Auto-Context Generation (2/2 plans) — completed 2026-03-02
- [x] Phase 3: Verification Gates (2/2 plans) — completed 2026-03-02
- [x] Phase 4: Failure Handling (2/2 plans) — completed 2026-03-02
- [x] Phase 5: Fix Autopilot Wiring Bugs (1/1 plan) — completed 2026-03-02 (Gap Closure)
- [x] Phase 6: Verify Phase 4 Implementation (1/1 plan) — completed 2026-03-02 (Gap Closure)
- [x] Phase 7: Fix Gap-Path Verify & Fix Cycle (1/1 plan) — completed 2026-03-02 (Gap Closure)

</details>

<details>
<summary>✅ v1.1 Remove Git Tagging (Phases 8-9) — SHIPPED 2026-03-03</summary>

- [x] Phase 8: Remove Git Tagging (2/2 plans) — completed 2026-03-02
- [x] Phase 9: Fix Residual Tag References (1/1 plan) — completed 2026-03-03 (Gap Closure)

</details>

<details>
<summary>✅ v1.2 Add Milestone Audit Loop (Phases 10-13) — SHIPPED 2026-03-03</summary>

- [x] Phase 10: Audit Trigger and Routing (1/1 plan) — completed 2026-03-03
- [x] Phase 11: Gap Closure Loop (1/1 plan) — completed 2026-03-03
- [x] Phase 12: Milestone Completion (1/1 plan) — completed 2026-03-03
- [x] Phase 13: Verify Phase 12 Milestone Completion (1/1 plan) — completed 2026-03-03 (Gap Closure)

</details>

<details>
<summary>✅ v1.3 CLI Utilities (Phases 14-19) — SHIPPED 2026-03-03</summary>

- [x] Phase 14: CLI Infrastructure (2/2 plans) — completed 2026-03-03
- [x] Phase 15: Progress Command (1/1 plan) — completed 2026-03-03
- [x] Phase 16: Todos Command (1/1 plan) — completed 2026-03-03
- [x] Phase 17: Health Command (1/1 plan) — completed 2026-03-03
- [x] Phase 18: Settings and Help Commands (2/2 plans) — completed 2026-03-03
- [x] Phase 19: Close Audit Gaps (2/2 plans) — completed 2026-03-03 (Gap Closure)

</details>

### 🚧 v1.4 Linear Integration (In Progress)

**Milestone Goal:** Add a `/gsd:linear` slash command that reads Linear issues via MCP, auto-routes to quick or milestone, and posts summary comments back.

- [x] **Phase 20: Foundation** - CLI init command and command spec for Linear integration (completed 2026-03-04)
- [ ] **Phase 21: Core Workflow** - Linear workflow with argument parsing, issue fetching, routing heuristic, and delegation
- [ ] **Phase 22: Completion Loop** - Comment-back to Linear issues and temporary file cleanup
- [ ] **Phase 23: Documentation** - USER-GUIDE.md and README.md updates for /gsd:linear

## Phase Details

### Phase 20: Foundation
**Goal**: Linear integration has its CLI plumbing and command entry point ready for the workflow
**Depends on**: Phase 19 (v1.3 complete)
**Requirements**: INIT-01, CMD-01
**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools.cjs init linear` returns JSON with models, paths, quick task numbering, and config data
  2. The `/gsd:linear` command spec exists and is discoverable by Claude Code with correct allowed-tools (including Linear MCP tools)
  3. All existing tests pass after adding the new init subcommand
**Plans**: 1 plan

Plans:
- [ ] 20-01-PLAN.md — Init linear command, gsd-tools routing, tests, and /gsd:linear command spec

### Phase 21: Core Workflow
**Goal**: Users can invoke `/gsd:linear ISSUE-ID` to fetch a Linear issue, have it auto-routed to quick or milestone, and have the appropriate GSD workflow execute end-to-end
**Depends on**: Phase 20
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04, WKFL-05, WKFL-06
**Success Criteria** (what must be TRUE):
  1. Workflow parses issue IDs and flags (--quick, --milestone, --full) from arguments, prompting if no issue ID provided
  2. Workflow fetches issue data and comments from Linear via MCP tools and displays what was fetched
  3. Routing heuristic scores issues on count, sub-issues, description length, labels, and relations, choosing quick (score < 3) or milestone (score >= 3)
  4. Flag overrides (--quick, --milestone) bypass the heuristic entirely
  5. Quick route synthesizes a description and delegates to the quick workflow; milestone route writes MILESTONE-CONTEXT.md and delegates to new-milestone workflow
**Plans**: TBD

Plans:
- [ ] 21-01: TBD

### Phase 22: Completion Loop
**Goal**: After workflow delegation completes, Linear issues receive a summary comment and temporary files are cleaned up
**Depends on**: Phase 21
**Requirements**: WKFL-07, WKFL-08
**Success Criteria** (what must be TRUE):
  1. After quick task completion, a summary comment with task description, commit hash, and summary excerpt is posted to each Linear issue via MCP
  2. After milestone initialization, a summary comment with milestone name, phase count, and requirement count is posted to each Linear issue via MCP
  3. The temporary `.planning/linear-context.md` file is deleted after completion
**Plans**: TBD

Plans:
- [ ] 22-01: TBD

### Phase 23: Documentation
**Goal**: Users can find /gsd:linear usage, flags, and examples in the project documentation
**Depends on**: Phase 21
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. USER-GUIDE.md includes /gsd:linear in the command reference table with argument hints
  2. USER-GUIDE.md has a Linear Integration section with flag descriptions and usage examples
  3. README.md mentions the Linear integration capability
**Plans**: TBD

Plans:
- [ ] 23-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Loop Infrastructure | v1.0 | 3/3 | Complete | 2026-03-02 |
| 2. Auto-Context Generation | v1.0 | 2/2 | Complete | 2026-03-02 |
| 3. Verification Gates | v1.0 | 2/2 | Complete | 2026-03-02 |
| 4. Failure Handling | v1.0 | 2/2 | Complete | 2026-03-02 |
| 5. Fix Autopilot Wiring Bugs | v1.0 | 1/1 | Complete | 2026-03-02 |
| 6. Verify Phase 4 Implementation | v1.0 | 1/1 | Complete | 2026-03-02 |
| 7. Fix Gap-Path Verify & Fix Cycle | v1.0 | 1/1 | Complete | 2026-03-02 |
| 8. Remove Git Tagging | v1.1 | 2/2 | Complete | 2026-03-02 |
| 9. Fix Residual Tag References | v1.1 | 1/1 | Complete | 2026-03-03 |
| 10. Audit Trigger and Routing | v1.2 | 1/1 | Complete | 2026-03-03 |
| 11. Gap Closure Loop | v1.2 | 1/1 | Complete | 2026-03-03 |
| 12. Milestone Completion | v1.2 | 1/1 | Complete | 2026-03-03 |
| 13. Verify Phase 12 Milestone Completion | v1.2 | 1/1 | Complete | 2026-03-03 |
| 14. CLI Infrastructure | v1.3 | 2/2 | Complete | 2026-03-03 |
| 15. Progress Command | v1.3 | 1/1 | Complete | 2026-03-03 |
| 16. Todos Command | v1.3 | 1/1 | Complete | 2026-03-03 |
| 17. Health Command | v1.3 | 1/1 | Complete | 2026-03-03 |
| 18. Settings and Help Commands | v1.3 | 2/2 | Complete | 2026-03-03 |
| 19. Close Audit Gaps | v1.3 | 2/2 | Complete | 2026-03-03 |
| 20. Foundation | 1/1 | Complete   | 2026-03-04 | - |
| 21. Core Workflow | v1.4 | 0/0 | Not started | - |
| 22. Completion Loop | v1.4 | 0/0 | Not started | - |
| 23. Documentation | v1.4 | 0/0 | Not started | - |
