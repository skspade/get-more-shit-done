# Roadmap: GSD Autopilot

## Milestones

- ✅ **v1.0 GSD Autopilot** — Phases 1-7 (shipped 2026-03-02)
- ✅ **v1.1 Remove Git Tagging** — Phases 8-9 (shipped 2026-03-03)
- ✅ **v1.2 Add Milestone Audit Loop** — Phases 10-13 (shipped 2026-03-03)
- 🚧 **v1.3 CLI Utilities** — Phases 14-18 (in progress)

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

### 🚧 v1.3 CLI Utilities (In Progress)

**Milestone Goal:** Replace token-expensive LLM-powered status commands with a deterministic CLI that reads .planning/ state and presents it instantly.

- [x] **Phase 14: CLI Infrastructure** - Binary entry point, project discovery, command routing, output flags, and error handling (completed 2026-03-03)
- [x] **Phase 15: Progress Command** - Milestone status dashboard showing phases, plans, progress bar, and current position (completed 2026-03-03)
- [ ] **Phase 16: Todos Command** - List, filter, and inspect pending todos from the .planning/todos directory
- [ ] **Phase 17: Health Command** - Validate .planning/ directory structure, config integrity, and state consistency
- [ ] **Phase 18: Settings and Help Commands** - View/update config values and display command reference

## Phase Details

### Phase 14: CLI Infrastructure
**Goal**: Users can invoke a standalone `gsd` binary from any directory within a GSD project, and the CLI routes to the correct subcommand
**Depends on**: Nothing (first v1.3 phase)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
**Success Criteria** (what must be TRUE):
  1. User runs `gsd` from any subdirectory of a GSD project and the command finds .planning/ without specifying a path
  2. User runs `gsd <unknown-command>` outside a GSD project and sees a clear error explaining where to run it
  3. User runs any command with `--json` and receives valid JSON output instead of formatted text
  4. User runs any command with `--plain` and receives ANSI-free text (no color codes)
  5. User runs `gsd progress` and the CLI dispatches to the progress handler, not an error
**Plans**: TBD

### Phase 15: Progress Command
**Goal**: Users can see the full milestone status at a glance — name, phases, plan counts, progress bar, and what to do next
**Depends on**: Phase 14
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROG-05
**Success Criteria** (what must be TRUE):
  1. User runs `gsd progress` and sees the current milestone name, version, and whether it is active or complete
  2. User sees each phase listed with a visual indicator of whether it is complete, in progress, or not started
  3. User sees plan completion counts (e.g., "2/3 plans") for each phase
  4. User sees a progress bar reflecting overall milestone completion percentage
  5. User sees the current phase/plan position and a suggested next action
**Plans**: TBD

### Phase 16: Todos Command
**Goal**: Users can list, filter, and inspect pending todos without opening the .planning/todos directory manually
**Depends on**: Phase 14
**Requirements**: TODO-01, TODO-02, TODO-03
**Success Criteria** (what must be TRUE):
  1. User runs `gsd todos` and sees all pending todos with ID, title, and area
  2. User runs `gsd todos --area=feature` and sees only todos matching that area
  3. User runs `gsd todos <id>` and sees the full contents of that todo
**Plans**: TBD

### Phase 17: Health Command
**Goal**: Users can validate their .planning/ directory is complete and consistent without manually inspecting files
**Depends on**: Phase 14
**Requirements**: HLTH-01, HLTH-02, HLTH-03, HLTH-04
**Success Criteria** (what must be TRUE):
  1. User runs `gsd health` and sees a pass/fail check for each required .planning/ file
  2. User sees config.json validated for correct structure and known key values
  3. User sees a consistency check between STATE.md phase position and ROADMAP.md phase status
  4. Any error or warning includes a description of what is wrong and which file is affected
**Plans**: TBD

### Phase 18: Settings and Help Commands
**Goal**: Users can view and update config values and access command reference documentation from the CLI
**Depends on**: Phase 14
**Requirements**: SETT-01, SETT-02, SETT-03, HELP-01, HELP-02
**Success Criteria** (what must be TRUE):
  1. User runs `gsd settings` and sees all current config.json key-value pairs
  2. User runs `gsd settings set <key> <value>` and the value is written to config.json after validation
  3. User runs `gsd settings set <key> <invalid-value>` and sees a validation error with no file written
  4. User runs `gsd help` and sees all available commands with one-line descriptions
  5. User runs `gsd help <command>` and sees detailed usage, flags, and examples for that command
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
| 14. CLI Infrastructure | 2/2 | Complete    | 2026-03-03 | - |
| 15. Progress Command | 1/1 | Complete    | 2026-03-03 | - |
| 16. Todos Command | v1.3 | 0/? | Not started | - |
| 17. Health Command | v1.3 | 0/? | Not started | - |
| 18. Settings and Help Commands | v1.3 | 0/? | Not started | - |
