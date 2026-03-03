# Roadmap: GSD Autopilot

## Milestones

- ✅ **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- ✅ **v1.1 Remove Git Tagging** — Phases 8-9 (shipped 2026-03-03)
- 🚧 **v1.2 Add Milestone Audit Loop** — Phases 10-12 (in progress)

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

### 🚧 v1.2 Add Milestone Audit Loop (In Progress)

**Milestone Goal:** Close the autopilot loop — after all phases execute, automatically audit the milestone and fix gaps until the audit passes, then complete the milestone.

- [x] **Phase 10: Audit Trigger and Routing** - Autopilot triggers milestone audit after phases complete and routes based on result (completed 2026-03-03)
- [x] **Phase 11: Gap Closure Loop** - Autopilot plans fixes, executes them, re-audits, and repeats with iteration limits (completed 2026-03-03)
- [x] **Phase 12: Milestone Completion** - Autopilot invokes complete-milestone autonomously when audit passes (completed 2026-03-03)

## Phase Details

### Phase 10: Audit Trigger and Routing
**Goal**: Autopilot detects when all planned phases are complete and automatically runs the milestone audit, then routes to the correct next action based on audit outcome
**Depends on**: Phase 9 (v1.1 complete)
**Requirements**: AUDIT-01, AUDIT-02, CONF-02
**Success Criteria** (what must be TRUE):
  1. When all roadmap phases show complete, autopilot automatically invokes the milestone audit without human intervention
  2. Autopilot correctly distinguishes between "passed", "gaps_found", and "tech_debt" audit outcomes and takes a different action for each
  3. When `auto_accept_tech_debt` is true, tech-debt-only audit results are treated as passing; when false, they are treated as gaps
  4. Audit trigger and routing logic is reachable from the existing autopilot phase loop (no dead code path)
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: Gap Closure Loop
**Goal**: Autopilot automatically plans fixes for audit gaps, executes fix phases, re-audits, and repeats until the audit passes or iteration limits are exhausted
**Depends on**: Phase 10
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, CONF-01
**Success Criteria** (what must be TRUE):
  1. When audit finds gaps, autopilot invokes plan-milestone-gaps to generate fix phases and executes them using the existing phase loop
  2. After fix phases complete, autopilot re-runs the milestone audit automatically
  3. The audit-fix cycle repeats until audit passes (no manual re-triggering needed)
  4. When max iterations (configurable, default 3) are exhausted without a passing audit, autopilot pauses and escalates to the human operator
  5. Max audit-fix iterations can be configured via config.json and defaults to 3 when not set
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Milestone Completion
**Goal**: Autopilot automatically completes the milestone when the audit passes, performing archival and PROJECT.md evolution without human intervention
**Depends on**: Phase 11
**Requirements**: COMP-01, COMP-02
**Success Criteria** (what must be TRUE):
  1. When audit returns "passed", autopilot automatically invokes complete-milestone without waiting for human input
  2. Milestone completion runs fully autonomously — archival, PROJECT.md evolution, and commit all happen without prompts
  3. After milestone completion, autopilot exits cleanly with a success status
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

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
| 10. Audit Trigger and Routing | 1/1 | Complete    | 2026-03-03 | - |
| 11. Gap Closure Loop | v1.2 | Complete    | 2026-03-03 | - |
| 12. Milestone Completion | 1/1 | Complete   | 2026-03-03 | - |
