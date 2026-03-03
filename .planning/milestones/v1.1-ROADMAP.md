# Roadmap: GSD Autopilot

## Milestones

- **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- **v1.1 Remove Git Tagging** — Phases 8-9 (in progress)

## Phases

<details>
<summary>v1.0 GSD Autopilot (Phases 1-7) — SHIPPED 2026-03-02</summary>

- [x] Phase 1: Core Loop Infrastructure (3/3 plans) — completed 2026-03-02
- [x] Phase 2: Auto-Context Generation (2/2 plans) — completed 2026-03-02
- [x] Phase 3: Verification Gates (2/2 plans) — completed 2026-03-02
- [x] Phase 4: Failure Handling (2/2 plans) — completed 2026-03-02
- [x] Phase 5: Fix Autopilot Wiring Bugs (1/1 plan) — completed 2026-03-02 (Gap Closure)
- [x] Phase 6: Verify Phase 4 Implementation (1/1 plan) — completed 2026-03-02 (Gap Closure)
- [x] Phase 7: Fix Gap-Path Verify & Fix Cycle (1/1 plan) — completed 2026-03-02 (Gap Closure)

</details>

### v1.1 Remove Git Tagging (In Progress)

**Milestone Goal:** Strip automated git tag creation and push from complete-milestone workflow and all documentation references.

- [ ] **Phase 8: Remove Git Tagging** - Remove tag creation, tag push, and all documentation references to automated tagging
- [ ] **Phase 9: Fix Residual Tag References** - Close gaps from audit: remove missed tag references in workflow output and user guide examples (Gap Closure)

## Phase Details

### Phase 8: Remove Git Tagging
**Goal**: The complete-milestone workflow no longer creates or pushes git tags, and no documentation claims it does
**Depends on**: Phase 7 (v1.0 shipped)
**Requirements**: WF-01, WF-02, WF-03, DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. Running complete-milestone does not create any git tags
  2. Running complete-milestone does not prompt to push or push any git tags
  3. The complete-milestone command spec makes no mention of git tagging
  4. All user-facing documentation (help, README, user guide) makes no mention of automated git tagging during milestone completion
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Fix Residual Tag References
**Goal**: All residual tag references identified by v1.1 audit are removed from workflow output and documentation
**Depends on**: Phase 8
**Requirements**: WF-03, DOC-03
**Gap Closure**: Closes gaps from v1.1 milestone audit
**Success Criteria** (what must be TRUE):
  1. `complete-milestone.md` offer_next step output does not contain `Tag: v[X.Y]`
  2. `USER-GUIDE.md` usage examples do not contain `# Archive, tag, done`

Plans:
- [ ] 09-01: TBD

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
| 8. Remove Git Tagging | v1.1 | 0/0 | Not started | - |
| 9. Fix Residual Tag References | v1.1 | 0/0 | Not started | - |
