# Roadmap: GSD Autopilot

## Milestones

- ✅ **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- ✅ **v1.1 Remove Git Tagging** — Phases 8-9 (shipped 2026-03-03)
- ✅ **v1.2 Add Milestone Audit Loop** — Phases 10-13 (shipped 2026-03-03)
- ✅ **v1.3 CLI Utilities** — Phases 14-19 (shipped 2026-03-03)
- ✅ **v1.4 Linear Integration** — Phases 20-24 (shipped 2026-03-03)
- 🚧 **v1.5 GSD Brainstorming Command** — Phases 25-29 (in progress)

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

<details>
<summary>✅ v1.4 Linear Integration (Phases 20-24) — SHIPPED 2026-03-03</summary>

- [x] Phase 20: Foundation (1/1 plan) — completed 2026-03-04
- [x] Phase 21: Core Workflow (1/1 plan) — completed 2026-03-04
- [x] Phase 22: Completion Loop (1/1 plan) — completed 2026-03-04
- [x] Phase 23: Documentation (1/1 plan) — completed 2026-03-04
- [x] Phase 24: Close Audit Gaps (1/1 plan) — completed 2026-03-04 (Gap Closure)

</details>

### 🚧 v1.5 GSD Brainstorming Command (Phases 25-29, In Progress)

**Milestone Goal:** Add `/gsd:brainstorm` command that runs a collaborative brainstorming process, writes a design doc, then auto-routes into GSD milestone/project creation — bridging idea exploration to execution without manual handoff.

- [x] **Phase 25: Command Spec and Workflow Foundation** - Command file, workflow file, and brainstorming process through approach proposals (completed 2026-03-04)
- [x] **Phase 26: Design Presentation and Output** - Interactive design sections, revision loop, and design doc writing to `.planning/designs/` (completed 2026-03-04)
- [x] **Phase 27: GSD Routing Integration** - Auto-detect PROJECT.md and seed design context into new-milestone or new-project flow (completed 2026-03-04)
- [x] **Phase 28: Documentation** - help.md, USER-GUIDE.md, and README.md updates (completed 2026-03-04)
- [ ] **Phase 29: Close Audit Gaps** - Create missing Phase 27 verification artifacts, fix stale REQUIREMENTS.md checkboxes (Gap Closure)

### Phase 29: Close Audit Gaps
**Goal**: Create missing Phase 27 verification artifacts and fix stale REQUIREMENTS.md checkboxes so all requirements are formally verified
**Depends on**: Phase 28
**Requirements**: ROUTE-01, ROUTE-02 (verification), BRAIN-04, BRAIN-05, DESIGN-01, DESIGN-02 (checkbox fix)
**Gap Closure**: Closes gaps from v1.5 audit
**Success Criteria** (what must be TRUE):
  1. `27-01-SUMMARY.md` exists with plan outcomes from EXECUTION.md
  2. `27-VERIFICATION.md` exists confirming ROUTE-01 and ROUTE-02
  3. REQUIREMENTS.md checkboxes for BRAIN-04, BRAIN-05, DESIGN-01, DESIGN-02 are checked
  4. Traceability table statuses updated to Complete for all satisfied requirements
**Plans**: TBD

## Phase Details

### Phase 25: Command Spec and Workflow Foundation
**Goal**: User can invoke `/gsd:brainstorm [topic]` and the workflow explores project context, asks clarifying questions one at a time, and proposes 2-3 approaches with trade-offs
**Depends on**: Phase 24 (v1.4 complete)
**Requirements**: CMD-01, CMD-02, BRAIN-01, BRAIN-02, BRAIN-03
**Success Criteria** (what must be TRUE):
  1. User can invoke `/gsd:brainstorm` with no arguments and the session starts
  2. User can invoke `/gsd:brainstorm <topic>` and the topic is used to seed the session immediately
  3. The workflow reads project files, docs, and recent commits before asking any questions
  4. The workflow asks clarifying questions one at a time, preferring multiple choice format
  5. The workflow presents 2-3 distinct approaches with trade-offs and a stated recommendation
**Plans**: TBD

### Phase 26: Design Presentation and Output
**Goal**: User can approve a design presented in sections, request revisions, and the approved design is written to `.planning/designs/` and committed to git
**Depends on**: Phase 25
**Requirements**: BRAIN-04, BRAIN-05, DESIGN-01, DESIGN-02
**Success Criteria** (what must be TRUE):
  1. The workflow presents the design in sections scaled to complexity, pausing for approval after each section
  2. User can request revisions to any design section before approving it
  3. Approved design is written to `.planning/designs/YYYY-MM-DD-<topic>-design.md`
  4. Design doc is committed to git after writing
**Plans**: TBD

### Phase 27: GSD Routing Integration
**Goal**: After design approval, the workflow automatically detects project state and routes into the correct GSD creation flow with design context replacing the questioning phase
**Depends on**: Phase 26
**Requirements**: ROUTE-01, ROUTE-02
**Success Criteria** (what must be TRUE):
  1. When PROJECT.md exists, the workflow automatically routes into new-milestone flow after design approval
  2. When PROJECT.md does not exist, the workflow automatically routes into new-project flow after design approval
  3. The design doc content is seeded into the creation flow so the questioning phase is skipped or pre-answered
**Plans**: TBD

### Phase 28: Documentation
**Goal**: The `/gsd:brainstorm` command is discoverable and documented in all user-facing reference materials
**Depends on**: Phase 27
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. `help.md` command reference lists `/gsd:brainstorm` with its purpose and usage
  2. `USER-GUIDE.md` contains a brainstorm section with usage instructions and at least one example
  3. `README.md` includes an entry for the brainstorm command
**Plans**: TBD

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
| 20. Foundation | v1.4 | 1/1 | Complete | 2026-03-04 |
| 21. Core Workflow | v1.4 | 1/1 | Complete | 2026-03-04 |
| 22. Completion Loop | v1.4 | 1/1 | Complete | 2026-03-04 |
| 23. Documentation | v1.4 | 1/1 | Complete | 2026-03-04 |
| 24. Close Audit Gaps | v1.4 | 1/1 | Complete | 2026-03-04 |
| 25. Command Spec and Workflow Foundation | 1/1 | Complete    | 2026-03-04 | - |
| 26. Design Presentation and Output | 1/1 | Complete    | 2026-03-04 | - |
| 27. GSD Routing Integration | v1.5 | 1/1 | Complete | 2026-03-04 |
| 28. Documentation | 1/1 | Complete    | 2026-03-04 | - |
| 29. Close Audit Gaps | v1.5 | 0/1 | Pending | - |
