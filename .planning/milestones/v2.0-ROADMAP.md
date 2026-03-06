# Roadmap: GSD Autopilot

## Milestones

- ✅ **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- ✅ **v1.1 Remove Git Tagging** — Phases 8-9 (shipped 2026-03-03)
- ✅ **v1.2 Add Milestone Audit Loop** — Phases 10-13 (shipped 2026-03-03)
- ✅ **v1.3 CLI Utilities** — Phases 14-19 (shipped 2026-03-03)
- ✅ **v1.4 Linear Integration** — Phases 20-24 (shipped 2026-03-03)
- ✅ **v1.5 GSD Brainstorming Command** — Phases 25-29 (shipped 2026-03-04)
- ✅ **v1.6 Dual-Layer Test Architecture** — Phases 30-35 (shipped 2026-03-05)
- 🚧 **v2.0 README Rewrite** — Phases 36-37

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

<details>
<summary>✅ v1.5 GSD Brainstorming Command (Phases 25-29) — SHIPPED 2026-03-04</summary>

- [x] Phase 25: Command Spec and Workflow Foundation (1/1 plan) — completed 2026-03-04
- [x] Phase 26: Design Presentation and Output (1/1 plan) — completed 2026-03-04
- [x] Phase 27: GSD Routing Integration (1/1 plan) — completed 2026-03-04
- [x] Phase 28: Documentation (1/1 plan) — completed 2026-03-04
- [x] Phase 29: Close Audit Gaps (1/1 plan) — completed 2026-03-04 (Gap Closure)

</details>

<details>
<summary>✅ v1.6 Dual-Layer Test Architecture (Phases 30-35) — SHIPPED 2026-03-05</summary>

- [x] Phase 30: Foundation (2/2 plans) — completed 2026-03-05
- [x] Phase 31: Hard Test Gate (2/2 plans) — completed 2026-03-05
- [x] Phase 32: Acceptance Test Layer (3/3 plans) — completed 2026-03-05
- [x] Phase 33: Test Steward (3/3 plans) — completed 2026-03-05
- [x] Phase 34: Documentation (3/3 plans) — completed 2026-03-05
- [x] Phase 35: Close Verification Gaps (2/2 plans) — completed 2026-03-05 (Gap Closure)

</details>

### v2.0 README Rewrite (Complete)

**Milestone Goal:** Replace upstream README with a minimal quick start guide reflecting the fork's identity and features.

- [x] **Phase 36: README Rewrite** (1/1 plan) — completed 2026-03-06
- [x] **Phase 37: Close Verification Gaps** (1/1 plan) — completed 2026-03-06 (Gap Closure)

## Phase Details

### Phase 36: README Rewrite
**Goal**: Users landing on the repo see a clear, concise README that communicates what the fork does, how to install it, and how to use it — with no upstream branding residue
**Depends on**: Nothing (first phase of v2.0, no code dependencies)
**Requirements**: ID-01, ID-02, ID-03, CON-01, CON-02, CON-03, QS-01, QS-02, QS-03, QS-04, QS-05, CMD-01, CMD-02, CLN-01, CLN-02
**Success Criteria** (what must be TRUE):
  1. README opens with "GET MORE SHIT DONE" header, npm/license badges, and a one-sentence description — no upstream branding remains anywhere in the file
  2. A new user can follow the Quick Start section from install through project init, core loop, and milestone completion without needing any other documentation
  3. README includes a command table with exactly 10 core commands and links to User Guide and CLI Reference for discovery of the full command set
  4. README contains no upstream-specific content (no TACHES, $GSD token, star history, Discord, wave diagrams, XML examples, config tables, security, troubleshooting, testimonials, community ports, Who This Is For, Why I Built This)
  5. README total length is under 150 lines
**Plans**: 1

Plans:
- [x] 36-01: Replace README with fork-branded quick start guide — completed 2026-03-06

### Phase 37: Close Verification Gaps
**Goal**: Create formal verification artifact for Phase 36 and check off all 15 requirements in REQUIREMENTS.md
**Depends on**: Phase 36
**Requirements**: ID-01, ID-02, ID-03, CON-01, CON-02, CON-03, QS-01, QS-02, QS-03, QS-04, QS-05, CMD-01, CMD-02, CLN-01, CLN-02
**Gap Closure:** Closes all orphaned requirements from v2.0 audit (missing VERIFICATION.md)
**Success Criteria** (what must be TRUE):
  1. VERIFICATION.md exists for Phase 36 confirming all 15 requirements
  2. All 15 requirement checkboxes in REQUIREMENTS.md are checked
**Plans**: 1

Plans:
- [x] 37-01: Close Verification Gaps — completed 2026-03-06

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
| 25. Command Spec and Workflow Foundation | v1.5 | 1/1 | Complete | 2026-03-04 |
| 26. Design Presentation and Output | v1.5 | 1/1 | Complete | 2026-03-04 |
| 27. GSD Routing Integration | v1.5 | 1/1 | Complete | 2026-03-04 |
| 28. Documentation | v1.5 | 1/1 | Complete | 2026-03-04 |
| 29. Close Audit Gaps | v1.5 | 1/1 | Complete | 2026-03-04 |
| 30. Foundation | v1.6 | 2/2 | Complete | 2026-03-05 |
| 31. Hard Test Gate | v1.6 | 2/2 | Complete | 2026-03-05 |
| 32. Acceptance Test Layer | v1.6 | 3/3 | Complete | 2026-03-05 |
| 33. Test Steward | v1.6 | 3/3 | Complete | 2026-03-05 |
| 34. Documentation | v1.6 | 3/3 | Complete | 2026-03-05 |
| 35. Close Verification Gaps | v1.6 | 2/2 | Complete | 2026-03-05 |
| 36. README Rewrite | v2.0 | 1/1 | Complete | 2026-03-06 |
| 37. Close Verification Gaps | v2.0 | 1/1 | Complete | 2026-03-06 |
