# Feature Research

**Domain:** Autonomous AI coding orchestrator (milestone-to-completion loop)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must work or the orchestrator is fundamentally broken. An autopilot that cannot do these is just a fancy alias for running commands manually.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Phase loop with state reading | Core value proposition. The orchestrator reads STATE.md, determines the current phase, and drives the next step forward. Without this, there is no autonomy. Every competitor (Ralphy, Devin, Cursor Background Agents, Composio Orchestrator) has an equivalent loop. | MEDIUM | GSD already has `auto_advance` chaining within a session. The gap is surviving context window exhaustion and looping across the full milestone lifecycle. The bash outer loop pattern (reinvoke Claude Code with fresh context per phase) is the proven approach per Anthropic's own harness research. |
| Cold-start capability | User invokes `/gsd:autopilot` on a new milestone and the orchestrator runs from initialization through completion. If it only works mid-milestone, the entry point is confusing. | LOW | Reads STATE.md to determine position. If no state exists or milestone is fresh, starts at discuss/plan. Routing logic, not new infrastructure. |
| Resume capability | Context windows exhaust. Sessions crash. The user closes their laptop. The orchestrator must pick up from wherever it stopped. Anthropic's harness research calls this "the core challenge of long-running agents." | MEDIUM | STATE.md + git history + progress files already provide the persistence layer. The challenge is reliable state detection: which sub-step within a phase was the agent on? GSD's existing `Session Continuity` section in STATE.md was designed for this. |
| Auto-context generation (replacing discuss) | The discuss phase requires interactive human input (gray area identification, multi-select questions, deep-dive Q&A). In autonomous mode, the AI must generate its own CONTEXT.md by reading PROJECT.md, ROADMAP.md, and prior phase artifacts. | HIGH | This is the most novel feature. No competitor does this well because most don't have GSD's structured discuss-then-plan pipeline. The layered approach from PROJECT.md (front-load known decisions, Claude decides remaining ambiguities with documented reasoning) is the right pattern. Must produce a CONTEXT.md identical in structure to the human-generated version so downstream agents work unchanged. |
| Auto-approval of planning and execution | In autonomous mode, all confirmation gates (confirm_plan, confirm_breakdown, execute_next_plan, confirm_transition) must be bypassed. Without this, the loop halts at every gate waiting for a human who is not there. | LOW | GSD already has `mode: "yolo"` which auto-approves everything and `gates` config which can disable individual confirmation points. Autopilot sets all gates to false and mode to yolo. Config manipulation, not new logic. |
| Human checkpoint at verification | The one place where human judgment adds irreplaceable value: reviewing what was actually built. Every serious orchestrator maintains this (Devin opens PRs for review, Cursor produces PRs, Composio requires PR review before merge). Fully autonomous verification without any human gate leads to uncaught regressions. | MEDIUM | Modify verify-work workflow to pause and present results when running in autopilot mode. The existing `checkpoint:human-verify` pattern is the mechanism. The challenge is presenting a useful summary of what was built across potentially many plans. |
| Debug-first failure handling | When execution or verification fails, the orchestrator must attempt self-repair before escalating. Anthropic's harness research identifies "undocumented half-finished work" as a primary failure mode. Every autonomous system (Ralphy, Devin, OpenHands) has retry-with-diagnosis loops. | MEDIUM | GSD already has gsd-debugger agent. The autopilot spawns it on failure, feeds it error context, gets back a diagnosis, and retries. The integration pattern (spawn debugger, apply fix, re-execute) is straightforward. The subtlety is knowing WHEN to retry vs escalate. |
| Human escalation after retries exhausted | When debug retries fail (default 3), the orchestrator must stop cleanly and surface the problem to the human. An agent that loops forever on an unsolvable error is worse than useless. | LOW | Write progress state, present error summary, exit the loop. The human resumes with `/gsd:resume-work` or manually fixes and re-invokes. |
| Progress circuit breaker | Detect when the orchestrator is stuck: N consecutive iterations with no state change (no new commits, no phase advancement, no plan completion). This is the primary runaway prevention mechanism. Ralphy uses `--max-iterations`, Anthropic's harness uses feature-list completion tracking. | MEDIUM | Monitor: did the last iteration produce a new SUMMARY.md, advance STATE.md, or create new commits? If 3 consecutive iterations show no progress, pause and escalate. More meaningful than token budgets because it detects semantic stuckness, not just resource consumption. |

### Differentiators (Competitive Advantage)

Features that make GSD Autopilot better than running Ralphy or a bare Claude Code loop. These leverage GSD's unique structured pipeline.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Decision audit trail | When the AI auto-decides (replacing human discuss input), every decision is documented with reasoning in CONTEXT.md. Users can review WHY the AI chose cards over list, infinite scroll over pagination, etc. No competitor provides this level of autonomous decision transparency. | LOW | The auto-context agent writes CONTEXT.md sections with explicit "Claude's Decision: X because Y" entries. Low implementation cost, high trust value. Anthropic's own research emphasizes that audit trails for agent decisions are critical for adoption. |
| Structured phase pipeline preservation | Unlike Ralphy (flat task list) or bare agent loops (unstructured), GSD Autopilot preserves the full discuss-research-plan-execute-verify pipeline per phase. This means each phase gets proper context gathering, dependency-aware planning, wave-based parallel execution, and structured verification. The AI gets the same quality pipeline that human-driven GSD provides. | LOW | This is architectural -- the autopilot loop calls existing GSD commands/workflows in sequence. The structure already exists; autopilot is a new entry point into it. The key insight: preserving this structure IS the differentiator over flat loops. |
| Incremental human review (not just end-state) | While competitors produce a PR at the end (Devin, Cursor), GSD Autopilot pauses at each phase's verification checkpoint. The human reviews phase-by-phase, catching drift early rather than reviewing a massive diff at the end. This is the "front-loaded and back-loaded effort" pattern from orchestration research, applied at phase granularity. | LOW | The verify-work workflow already has the checkpoint mechanism. Autopilot just ensures it pauses there in autonomous mode. The user can approve, request fixes (which trigger the debug-retry loop), or abort. |
| Context window hygiene by design | GSD's thin orchestrator pattern keeps main context at 10-15% usage. Each subagent gets a fresh 200k-token window. Autopilot inherits this: each phase execution is a fresh context window via the bash outer loop. No context rot across phases. Competitors like Cursor's long-running agents fight context degradation over 25-52 hour sessions. GSD avoids the problem architecturally. | LOW | Already built into GSD's subagent pattern. The bash outer loop (reinvoke with fresh context per phase) is the only new piece, and it is a simple shell script. Anthropic's harness research validates this exact approach. |
| Smart phase-type routing | Auto-context generation adapts to what KIND of phase is being built: visual UI phases get layout/interaction decisions, API phases get contract/error decisions, infrastructure phases might skip discuss entirely. The discuss-phase workflow already has domain-aware gray area identification; the auto-context agent inherits this intelligence. | MEDIUM | The discuss-phase workflow's domain categorization (users SEE/CALL/RUN/READ/ORGANIZE) becomes the routing logic for auto-context. Infrastructure phases produce minimal CONTEXT.md. UI phases produce detailed layout/interaction decisions. This is genuine intelligence, not just skipping the human. |
| Progress resumption with full state reconstruction | When resuming mid-milestone, the orchestrator reconstructs full context from STATE.md, git history, existing phase artifacts (CONTEXT.md, PLANs, SUMMARYs, UAT.md). This is richer than Ralphy's progress.txt or Anthropic's claude-progress.txt because GSD has structured artifacts at every stage. | MEDIUM | Read STATE.md for position. Check phase directory for which artifacts exist (has_context, has_plans, has_verification from gsd-tools init). Determine exact resumption point. This leverages the existing artifact structure rather than needing a separate progress tracking system. |
| Configurable autonomy level | Allow users to configure which phases get human checkpoints vs full autonomy. Maybe the user trusts autopilot for infrastructure phases but wants to review UI phases. A single `autopilot.pause_phases: [4, 7]` config could enable selective human-in-the-loop without stopping the whole pipeline. | LOW | Config addition to .planning/config.json. The autopilot loop checks before each phase: is this a pause phase? If yes, present summary and wait. If no, proceed autonomously. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but would hurt the system. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Token/cost budget caps | "I don't want it spending too much on API calls." Seems like responsible resource management. | Token counting is unreliable across sessions (outer loop spawns fresh processes). Cost caps create arbitrary stopping points mid-phase, leaving half-built artifacts. The progress circuit breaker is strictly better: it detects when the agent is stuck (semantically meaningful) rather than when it has spent N tokens (arbitrary). Budget enforcement belongs in the API billing layer, not the orchestrator. | Progress circuit breaker (N iterations with no state change). If users want hard cost limits, set them at the Anthropic API key level. |
| Interactive discuss in autonomous mode | "What if the AI gets a decision wrong? Let me intervene during discuss." | This defeats the entire purpose of autonomous execution. If the user wants to make discuss decisions, they should use normal GSD (`/gsd:discuss-phase`), not autopilot. Mixing interactive and autonomous modes creates unpredictable pause points. | Auto-context with documented reasoning + human review at verification. If decisions were wrong, the human catches it during phase verification and the debug-retry loop fixes it. Review decisions in CONTEXT.md after generation if desired. |
| Parallel phase execution | "If phases are independent, run them simultaneously." | GSD phases are sequential by design (each builds on the prior). Parallel phase execution would require dependency analysis, merge conflict resolution, and cross-phase coordination that contradicts the sequential pipeline model. Composio Orchestrator handles this for independent tasks, but GSD phases are NOT independent tasks. | Wave-based parallel execution WITHIN phases (already exists). Plans within a phase can run in parallel when they are independent. Phase-level parallelism adds complexity with no benefit for the sequential milestone model. |
| Agent teams / peer-to-peer coordination | "Multiple agents discussing and deciding together, like a virtual team." | GSD uses a thin orchestrator with specialized subagents, not a peer-to-peer team model. Multi-agent coordination introduces consensus overhead, message passing complexity, and non-deterministic outcomes. The orchestrator pattern (one coordinator spawning specialists) is simpler, more debuggable, and more reliable. | GSD's existing pattern: thin orchestrator spawns specialized agents (researcher, planner, executor, debugger) in fresh context windows. Each agent has a clear role and returns structured results. No negotiation needed. |
| Claude Agent SDK harness | "Use the Agent SDK instead of bash outer loop." | The Agent SDK is powerful but adds a dependency layer. GSD's native command/workflow/agent pattern already provides orchestration. A bash outer loop is simpler, more debuggable, and doesn't require SDK versioning concerns. The SDK is a valid future option once the core autopilot pattern is validated, but starting with it adds unnecessary coupling. | Bash helper script for the outer loop (reinvoke Claude Code with `--resume` per phase). Migrate to Agent SDK later if needed, after the pattern is proven. |
| Automatic scope expansion | "If the AI discovers it needs a new feature during execution, it should add phases to the roadmap." | Scope creep is the enemy of completion. An autonomous agent that expands its own scope will never finish. GSD's scope guardrail (discuss-phase: "that belongs in its own phase") must be preserved in autonomous mode. The agent should note discovered requirements but NOT act on them. | Capture in `Deferred Ideas` section of CONTEXT.md or as pending todos. The human reviews these at the verification checkpoint and can add phases to the roadmap manually for the next milestone. |
| Real-time streaming dashboard | "Show me live what the agent is doing." | Adds significant infrastructure (WebSocket server, UI frontend) for a CLI-first tool. The value is observability, but simpler approaches achieve this. Cursor provides a dashboard because it is an IDE; GSD is a CLI framework. | Tail the log output. Use tmux split panes (like Ralphy). The progress command (`/gsd:progress`) already shows current state. Add a `--watch` flag to progress for polling if needed. |

## Feature Dependencies

```
[Phase Loop with State Reading]
    |-- requires --> [Resume Capability] (must read state to know where to resume)
    |-- requires --> [Progress Circuit Breaker] (loop needs stuck detection)
    |-- requires --> [Auto-Approval of Gates] (loop cannot halt at confirmations)
    |
    |-- drives --> [Auto-Context Generation] (loop invokes auto-context when discuss is next)
    |-- drives --> [Debug-First Failure Handling] (loop invokes debugger on failures)
    |-- drives --> [Human Checkpoint at Verification] (loop pauses at verify)

[Auto-Context Generation]
    |-- requires --> [Phase Loop] (triggered by the loop, not standalone)
    |-- produces --> CONTEXT.md (consumed by existing research/plan pipeline)
    |-- enables --> [Decision Audit Trail] (decisions are documented in CONTEXT.md)

[Debug-First Failure Handling]
    |-- requires --> [Phase Loop] (triggered by execution/verification failures)
    |-- requires --> gsd-debugger agent (already exists)
    |-- feeds into --> [Human Escalation] (after retries exhausted)

[Human Checkpoint at Verification]
    |-- requires --> verify-work workflow modifications
    |-- enables --> [Incremental Human Review] (per-phase, not end-state)

[Resume Capability]
    |-- requires --> STATE.md (already exists)
    |-- requires --> Phase artifact detection (gsd-tools init already provides has_context, has_plans, etc.)

[Auto-Approval of Gates]
    |-- requires --> config.json gate manipulation (already exists)
    |-- conflicts with --> [Interactive Discuss] (anti-feature -- these are mutually exclusive modes)
```

### Dependency Notes

- **Phase Loop requires Resume Capability:** The outer loop must detect where to resume after each fresh context window. Without resume, the loop restarts from the beginning every time.
- **Auto-Context requires Phase Loop:** Auto-context is not a standalone feature. It is triggered when the loop reaches the discuss step for a phase. Running auto-context outside the loop is just regular discuss-phase with `--auto`.
- **Debug-First requires Phase Loop:** The loop detects failures and routes to the debugger. Without the loop, debug-retry is manual (which GSD already supports via verify-work's diagnose_issues step).
- **Auto-Approval conflicts with Interactive Discuss:** These are mutually exclusive modes. Autopilot means auto-approve everything. If you want interactive discuss, use normal GSD commands.
- **Decision Audit Trail is enhanced by Auto-Context:** The audit trail is most valuable when AI is making decisions autonomously. In human-driven mode, the decisions are already documented because the human made them interactively.

## MVP Definition

### Launch With (v1)

Minimum viable autopilot -- what is needed to validate the core loop concept.

- [ ] **Phase loop with state reading** -- The core loop: read STATE.md, determine next step, execute, update state, repeat. Without this, there is no product.
- [ ] **Auto-context generation** -- Replace interactive discuss with AI-generated CONTEXT.md. Without this, the loop halts at the first discuss step.
- [ ] **Auto-approval of gates** -- Set all gates to false, mode to yolo. Without this, the loop halts at every confirmation prompt.
- [ ] **Resume capability** -- Detect current position from STATE.md and phase artifacts. Without this, context window exhaustion kills the loop.
- [ ] **Bash outer loop script** -- Shell script that reinvokes Claude Code with fresh context per phase. Without this, a single context window must hold the entire milestone.
- [ ] **Human checkpoint at verification** -- Pause at verify-work for human review. Without this, there is no quality gate.
- [ ] **Progress circuit breaker** -- Detect stuck state (N iterations with no progress). Without this, failures loop forever.
- [ ] **Human escalation after retries** -- Stop cleanly when debug retries are exhausted. Without this, unrecoverable errors loop forever.

### Add After Validation (v1.x)

Features to add once the core loop is proven to work end-to-end.

- [ ] **Debug-first failure handling** -- Spawn gsd-debugger on execution failures, apply fixes, retry. Trigger: first failed autopilot run where manual debugging would have been avoidable.
- [ ] **Decision audit trail** -- Enrich auto-context CONTEXT.md with explicit "Claude's Decision: X because Y" entries. Trigger: user feedback that autonomous decisions are opaque.
- [ ] **Smart phase-type routing** -- Adapt auto-context behavior based on phase domain (UI vs API vs infrastructure). Trigger: auto-context producing irrelevant decisions for non-UI phases.
- [ ] **Configurable autonomy level** -- Per-phase pause configuration. Trigger: users wanting selective human review for certain phase types.

### Future Consideration (v2+)

Features to defer until the core pattern is battle-tested.

- [ ] **Claude Agent SDK migration** -- Replace bash outer loop with SDK harness for richer session management. Why defer: bash loop is simpler and more debuggable; migrate once the pattern is stable.
- [ ] **Cross-milestone learning** -- Autopilot learns from prior milestones (which decisions worked, which caused rework). Why defer: requires a feedback mechanism that does not exist yet.
- [ ] **Automated verification (no human gate)** -- AI-only verification using browser automation (Puppeteer MCP) and test suites. Why defer: trust must be established first; human checkpoint is the quality guarantee.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Phase loop with state reading | HIGH | MEDIUM | P1 |
| Auto-context generation | HIGH | HIGH | P1 |
| Auto-approval of gates | HIGH | LOW | P1 |
| Resume capability | HIGH | MEDIUM | P1 |
| Bash outer loop script | HIGH | LOW | P1 |
| Human checkpoint at verification | HIGH | MEDIUM | P1 |
| Progress circuit breaker | HIGH | MEDIUM | P1 |
| Human escalation after retries | MEDIUM | LOW | P1 |
| Debug-first failure handling | HIGH | MEDIUM | P2 |
| Decision audit trail | MEDIUM | LOW | P2 |
| Smart phase-type routing | MEDIUM | MEDIUM | P2 |
| Configurable autonomy level | LOW | LOW | P3 |
| Agent SDK migration | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- autopilot is broken without these
- P2: Should have, add after core loop is validated
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Ralphy | Devin | Cursor Background Agent | Composio Orchestrator | GSD Autopilot (planned) |
|---------|--------|-------|------------------------|----------------------|------------------------|
| Autonomous loop | Bash loop with PRD checkboxes | Cloud-hosted persistent agent | IDE-integrated background task | Parallel agent spawner | Bash outer loop with GSD phase pipeline |
| State persistence | .ralphy/progress.txt + PRD checkboxes | Cloud state (opaque) | Git + Memories feature | Git worktrees + PR tracking | STATE.md + structured phase artifacts (CONTEXT, PLAN, SUMMARY, UAT) |
| Context window management | Fresh context per task | Managed by Cognition's infra | Fresh agent per task (long-running mode) | Fresh agent per worktree | Fresh context per phase via bash reinvocation |
| Stuck detection | --max-iterations, fatal error detection | Unknown (cloud managed) | Unknown | CI failure detection | Progress circuit breaker (N iterations, no state change) |
| Failure recovery | Retry with backoff, fallback to sandbox | Self-healing code (iterates on errors) | Unknown | CI fix agents, review comment agents | gsd-debugger agent, retry loop, human escalation |
| Human checkpoints | None (fully autonomous) | PR review, Slack notifications | PR review | PR review | Per-phase verification checkpoint |
| Decision documentation | None | PR descriptions | None | None | CONTEXT.md with decision reasoning (audit trail) |
| Structured pipeline | Flat task list | Opaque internal planning | Single task at a time | Parallel independent tasks | Full discuss-research-plan-execute-verify pipeline per phase |
| Multi-agent | Single engine per task (parallel tasks) | Single agent | Single agent per background task | Multiple parallel agents | Thin orchestrator spawning specialized subagents |

## Sources

- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) -- PRIMARY. Validates bash outer loop, progress file pattern, fresh context per session, artifact-based memory. HIGH confidence.
- [Addy Osmani: Conductors to Orchestrators: The Future of Agentic Coding](https://addyosmani.com/blog/future-agentic-coding/) -- Defines conductor vs orchestrator spectrum, table stakes features, failure modes. MEDIUM confidence.
- [Ralphy: Autonomous AI Coding Loop](https://github.com/michaelshimeles/ralphy) -- Real-world implementation of bash outer loop with PRD tracking, circuit breakers, retry logic. HIGH confidence (open source, code verified).
- [Composio Agent Orchestrator](https://github.com/ComposioHQ/agent-orchestrator) -- Parallel agent spawning, CI fix automation, PR-based workflow. MEDIUM confidence.
- [Devin AI Guide 2026](https://aitoolsdevpro.com/ai-tools/devin-guide/) -- Self-healing code, PR workflow, multi-modal context. MEDIUM confidence (marketing material).
- [Cursor Long-Running Agents](https://www.adwaitx.com/cursor-long-running-agents-autonomous-coding/) -- 25-52 hour autonomous sessions, Memories feature, PR-based output. MEDIUM confidence.
- [Mike Mason: AI Coding Agents 2026](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) -- Coherence through orchestration, not raw autonomy. MEDIUM confidence.
- Existing GSD codebase (commands, workflows, agents, config) -- PRIMARY. Direct code analysis of discuss-phase.md, verify-work.md, transition.md, execute-phase.md, state template, checkpoints reference, config template. HIGH confidence.

---
*Feature research for: Autonomous AI coding orchestrator (GSD Autopilot)*
*Researched: 2026-03-01*
