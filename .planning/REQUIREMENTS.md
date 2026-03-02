# Requirements: GSD Autopilot

**Defined:** 2026-03-01
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Loop

- [ ] **LOOP-01**: Orchestrator reads STATE.md and ROADMAP.md to determine the current phase and its status
- [ ] **LOOP-02**: Orchestrator drives the next GSD phase forward (discuss → plan → execute → verify) based on current state
- [ ] **LOOP-03**: Orchestrator loops until all phases in the milestone are verified or a halt condition is reached
- [ ] **LOOP-04**: User can invoke autopilot on a fresh milestone and it runs from initialization through completion (cold-start)
- [ ] **LOOP-05**: User can invoke autopilot mid-milestone and it picks up from the current STATE.md position (resume)
- [ ] **LOOP-06**: Bash outer loop reinvokes Claude Code with a fresh context window for each phase iteration
- [ ] **LOOP-07**: All confirmation gates are disabled in autopilot mode (mode: yolo, all gates false)
- [ ] **LOOP-08**: Each phase execution gets a clean 200k-token context window to prevent context rot

### Auto-Context

- [ ] **ACTX-01**: Auto-context agent generates CONTEXT.md replacing interactive discuss phase
- [ ] **ACTX-02**: Auto-context uses layered approach: front-load decisions from PROJECT.md and ROADMAP.md, Claude decides remaining ambiguities
- [ ] **ACTX-03**: Generated CONTEXT.md is structurally identical to human-generated version (downstream agents work unchanged)
- [ ] **ACTX-04**: Every autonomous decision includes explicit reasoning ("Claude's Decision: X because Y")
- [ ] **ACTX-05**: Auto-context adapts to phase domain — UI phases get layout/interaction decisions, API phases get contract/error decisions, infrastructure phases get minimal context

### Verification

- [ ] **VRFY-01**: Orchestrator pauses at each phase's verification checkpoint for human review
- [ ] **VRFY-02**: Verification report surfaces which decisions were made autonomously, not just pass/fail results
- [ ] **VRFY-03**: Human can approve (continue), request fixes (triggers debug-retry), or abort at verification checkpoint

### Failure Handling

- [ ] **FAIL-01**: On execution or verification failure, orchestrator spawns gsd-debugger to diagnose and attempt fix
- [ ] **FAIL-02**: Debug-retry loop attempts up to N fixes before escalating (N configurable, default 3)
- [ ] **FAIL-03**: After debug retries exhausted, orchestrator stops cleanly and surfaces the problem for human review
- [ ] **FAIL-04**: Failure state is written to STATE.md so the human can understand what went wrong and resume after fixing

### Safety

- [ ] **SAFE-01**: Progress circuit breaker detects N consecutive iterations with no state change (configurable, default 3)
- [ ] **SAFE-02**: Circuit breaker monitors meaningful progress: new commits, phase advancement, or plan completion
- [ ] **SAFE-03**: When circuit breaker triggers, orchestrator pauses and presents a summary of what it attempted

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Autonomy Configuration

- **AUTO-01**: User can configure which phases get human checkpoints vs full autonomy via `autopilot.pause_phases` config
- **AUTO-02**: Default is auto-everything with human verify; configurable per-phase overrides

### SDK Migration

- **SDK-01**: Replace bash outer loop with Claude Agent SDK harness for richer session management
- **SDK-02**: Support streaming progress updates through SDK callbacks

### Learning

- **LRNG-01**: Autopilot learns from prior milestones (which decisions worked, which caused rework)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Token/cost budget caps | Progress circuit breaker is strictly better — detects semantic stuckness, not arbitrary resource consumption. Budget enforcement belongs in API billing layer. |
| Interactive discuss in autonomous mode | Defeats the purpose. If you want interactive discuss, use normal GSD commands. |
| Parallel phase execution | GSD phases are sequential by design. Wave-based parallelism within phases already exists. |
| Agent Teams integration | Phases are sequential, not requiring peer-to-peer coordination. Adds complexity with no benefit. |
| Automatic scope expansion | Scope creep is the enemy of completion. Discovered requirements are captured but not acted on. |
| Real-time streaming dashboard | CLI-first tool. Tail logs, use tmux, or use `/gsd:progress --watch`. |
| Upstream contribution | This is a fork. Freedom to modify core workflows without PR review cycles. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOOP-01 | — | Pending |
| LOOP-02 | — | Pending |
| LOOP-03 | — | Pending |
| LOOP-04 | — | Pending |
| LOOP-05 | — | Pending |
| LOOP-06 | — | Pending |
| LOOP-07 | — | Pending |
| LOOP-08 | — | Pending |
| ACTX-01 | — | Pending |
| ACTX-02 | — | Pending |
| ACTX-03 | — | Pending |
| ACTX-04 | — | Pending |
| ACTX-05 | — | Pending |
| VRFY-01 | — | Pending |
| VRFY-02 | — | Pending |
| VRFY-03 | — | Pending |
| FAIL-01 | — | Pending |
| FAIL-02 | — | Pending |
| FAIL-03 | — | Pending |
| FAIL-04 | — | Pending |
| SAFE-01 | — | Pending |
| SAFE-02 | — | Pending |
| SAFE-03 | — | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after initial definition*
