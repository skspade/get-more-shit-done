# Roadmap: GSD Autopilot

## Overview

GSD Autopilot extends the existing GSD framework with a single command that drives milestones from start to completion autonomously. The build progresses from a working outer loop (bash script + state machine + circuit breaker) through the auto-context agent that replaces interactive discuss, then verification gates for human review, and finally debug-retry failure handling. Each phase delivers a coherent, independently testable capability. The outer loop can be validated with manual discuss/verify before auto-context and verification integration replace those manual steps.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Loop Infrastructure** - Bash outer loop that reads state, drives phases with fresh context windows, and circuit-breaks on stalls (completed 2026-03-02)
- [x] **Phase 2: Auto-Context Generation** - Agent that replaces interactive discuss with autonomous CONTEXT.md generation (completed 2026-03-02)
- [x] **Phase 3: Verification Gates** - Human checkpoint at verification with autonomous decision surfacing and approve/fix/abort controls (completed 2026-03-02)
- [x] **Phase 4: Failure Handling** - Debug-retry loop that spawns gsd-debugger on failures, retries with limits, and escalates cleanly (completed 2026-03-02)
- [x] **Phase 5: Fix Autopilot Wiring Bugs** - Fix verification gate bypass and UAT/VERIFICATION file mismatch (Gap Closure) (completed 2026-03-02)
- [ ] **Phase 6: Verify Phase 4 Implementation** - Run phase-level verification on Phase 4 failure handling code (Gap Closure)
- [x] **Phase 7: Fix Gap-Path Verify & Fix Cycle** - Add missing phase complete after gate approval, pass fix_desc to agents (Gap Closure) (completed 2026-03-02)

## Phase Details

### Phase 1: Core Loop Infrastructure
**Goal**: User can invoke a single command that autonomously loops through GSD phases with fresh context windows, reading and updating state between iterations, and stopping safely when stuck
**Depends on**: Nothing (first phase)
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07, LOOP-08, SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. User runs `/gsd:autopilot` on a new milestone and the orchestrator progresses through at least discuss-plan-execute-verify for the first phase without human intervention (cold-start)
  2. User runs `/gsd:autopilot` on a milestone that already has Phase 1 complete and the orchestrator picks up at Phase 2 without repeating completed work (resume)
  3. Each phase iteration runs in a fresh Claude Code invocation -- context usage stays flat across phases, never accumulating (observable via `--output-format json` metadata)
  4. When the orchestrator makes no meaningful progress for 3 consecutive iterations (no new commits, no phase advancement, no plan completion), it stops itself and presents a summary of what it attempted
  5. All confirmation gates are bypassed during autonomous execution -- no prompts appear, no human input is requested between phase start and verification
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Auto-Context Generation
**Goal**: The discuss phase runs autonomously, producing a CONTEXT.md that downstream agents consume identically to a human-generated one, with every autonomous decision documented
**Depends on**: Phase 1
**Requirements**: ACTX-01, ACTX-02, ACTX-03, ACTX-04, ACTX-05
**Success Criteria** (what must be TRUE):
  1. When autopilot reaches a discuss step, it produces a CONTEXT.md without any human input -- the file appears in the phase directory with all required sections populated
  2. The generated CONTEXT.md is structurally valid: plan-phase and execute-phase agents consume it without errors or missing-field failures (same schema as human-generated)
  3. Every decision in the generated CONTEXT.md that was not explicitly stated in PROJECT.md or ROADMAP.md includes a "Claude's Decision: X because Y" annotation
  4. Auto-context adapts to the phase domain -- a UI-focused phase gets layout and interaction decisions, an API phase gets contract and error-handling decisions (observable by comparing CONTEXT.md content across different phase types)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Verification Gates
**Goal**: The autopilot pauses at each verification checkpoint so a human can review what was built, see which decisions were made autonomously, and choose to continue, fix, or abort
**Depends on**: Phase 2
**Requirements**: VRFY-01, VRFY-02, VRFY-03
**Success Criteria** (what must be TRUE):
  1. After each phase's execution completes, the autopilot loop pauses and does not proceed to the next phase until the human responds (the bash outer loop blocks waiting for input)
  2. The verification report includes a "Decisions Made Autonomously" section listing every auto-context decision with its reasoning -- not just pass/fail test results
  3. The human can type "approve" to continue to the next phase, "fix" to trigger a debug-retry cycle on specific issues, or "abort" to stop the autopilot cleanly with state preserved
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Failure Handling
**Goal**: When execution or verification fails, the autopilot automatically diagnoses and attempts fixes before escalating to the human, with full failure context preserved in state
**Depends on**: Phase 3
**Requirements**: FAIL-01, FAIL-02, FAIL-03, FAIL-04
**Success Criteria** (what must be TRUE):
  1. When a plan execution fails (non-zero exit, failed tests, incomplete gaps), the orchestrator spawns gsd-debugger to diagnose the failure and attempt a fix -- not just report the error
  2. The debug-retry loop attempts up to N fixes (default 3, configurable) before giving up -- each attempt is a fresh debugger invocation with the failure context
  3. After retries are exhausted, the orchestrator stops cleanly with a human-readable summary of what failed, what was tried, and why it could not be fixed
  4. Failure state is written to STATE.md with enough detail that a human can understand the problem and resume after manually fixing it (failure type, retry count, last error, affected plan)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Fix Autopilot Wiring Bugs
**Goal**: Fix the verification gate bypass so the autopilot's verify step is reachable in the happy path, and fix the UAT/VERIFICATION file mismatch so debug-retry correctly detects verification status
**Depends on**: Phase 4
**Requirements**: FAIL-02, VRFY-01, VRFY-02, VRFY-03
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):
  1. After execute-phase completes, `cmdPhaseStatus` returns `step='verify'` (not `step='complete'`), allowing the autopilot verify case and `run_verification_gate` to execute
  2. `run_verify_with_debug_retry` correctly reads the verification output file written by `verify-work` (matching file pattern)
  3. The E2E flow "execute → verify → human gate" completes without skipping the verify step

Plans:
- [ ] 05-01: Fix step inference and UAT file pattern matching

### Phase 6: Verify Phase 4 Implementation
**Goal**: Run phase-level verification on Phase 4's failure handling implementation to close the 4 unverified requirement gaps
**Depends on**: Phase 5
**Requirements**: FAIL-01, FAIL-02, FAIL-03, FAIL-04
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):
  1. Phase 4 has a VERIFICATION.md confirming FAIL-01 through FAIL-04 are satisfied
  2. All verification evidence is traceable to actual code behavior, not just SUMMARY claims

Plans:
- [ ] 06-01: Verify Phase 4 failure handling implementation against FAIL-01 through FAIL-04

### Phase 7: Fix Gap-Path Verify & Fix Cycle
**Goal**: Fix the two wiring bugs in the autopilot gap/fix path: add missing phase complete after verification gate approval (INT-01), and pass the human's fix description to agents (INT-02)
**Depends on**: Phase 6
**Requirements**: VRFY-01, VRFY-03
**Gap Closure:** Closes integration gaps INT-01, INT-02 and flow gaps FLOW-01, FLOW-02 from audit
**Success Criteria** (what must be TRUE):
  1. After `run_verification_gate` returns 0 (human approved), autopilot.sh calls `gsd_tools phase complete` — the gap path no longer loops infinitely on verify
  2. `run_fix_cycle` interpolates `$fix_desc` into the `/gsd:plan-phase --gaps` and `/gsd:execute-phase --gaps-only` prompts — the human's fix description reaches the agents
  3. The E2E flow "execute gaps → verify → human gate approve → next phase" completes without the circuit breaker intervening

**Plans:** 1/1 plans complete

Plans:
- [ ] 07-01-PLAN.md — Fix verify case phase complete and fix_desc prompt interpolation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Loop Infrastructure | 0/TBD | Complete    | 2026-03-02 |
| 2. Auto-Context Generation | 0/TBD | Complete    | 2026-03-02 |
| 3. Verification Gates | 0/TBD | Complete    | 2026-03-02 |
| 4. Failure Handling | 2/2 | Complete    | 2026-03-02 |
| 5. Fix Autopilot Wiring Bugs | 1/1 | Complete   | 2026-03-02 |
| 6. Verify Phase 4 Implementation | 0/1 | Planned | - |
| 7. Fix Gap-Path Verify & Fix Cycle | 0/TBD | Complete    | 2026-03-02 |
