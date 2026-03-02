# Project Research Summary

**Project:** GSD Autopilot — Autonomous Phase-Loop Orchestrator
**Domain:** Autonomous AI coding orchestration (CLI-based, file-state, subagent-spawning)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

GSD Autopilot is an autonomous orchestration layer that drives a software milestone from start to completion without continuous human supervision. The core technical challenge is survivability across context window boundaries: GSD's existing `auto_advance` + `mode: "yolo"` chain already runs the full discuss-plan-execute-verify-transition pipeline, but dies after 2-3 phases when the context window fills. The solution is a bash outer loop that runs outside Claude Code, reinvoking it with a fresh 200k-token context per phase. This is the proven "Ralph Loop" pattern, validated across 10+ implementations and confirmed by Anthropic's own harness research. GSD already provides 90% of the machinery; autopilot fills exactly three gaps: context exhaustion, discuss-phase human dependency, and lack of debug-retry on verification failure.

The recommended implementation is two-layered. Layer 1 is a bash script (`scripts/autopilot.sh`) that reads STATE.md between phases, invokes Claude Code for each phase lifecycle step, and handles circuit-breaking and human checkpoints. Layer 2 is the existing GSD workflow stack, which the bash loop calls unchanged. The only new GSD-native artifacts are: a thin `commands/gsd/autopilot.md` command entry point, a `agents/gsd-auto-context.md` agent that generates CONTEXT.md without human input, minor modifications to `verify-phase.md` for autopilot-aware pausing, and a new `lib/autopilot.cjs` module for state interrogation. No new npm packages are required.

The critical risks are: (1) auto-generated context producing decisions that drift from user intent without detection, and (2) the verification agent validating against its own AI-generated assumptions rather than real user intent. Both are addressed by the same mechanism — a mandatory human checkpoint at each phase's verification step that surfaces all autonomous decisions for review. Security-wise, the outer loop must never pass destructive flags (`--force`, `sudo`) and the auto-context agent must explicitly exclude secrets and `.env` files. Getting the core loop right is the foundational decision; everything else is additive.

## Key Findings

### Recommended Stack

GSD v1.22.0 provides the complete inner-loop machinery (workflows, agents, state files, config, and `gsd-tools.cjs` CLI). The autopilot builds on top of it using native GSD patterns throughout. The only non-markdown artifact requiring new infrastructure is a bash outer loop script, which is the correct choice because bash handles process lifecycle natively, has zero dependencies, and the Ralph Loop ecosystem has proven it at scale. Claude Code's headless `-p` flag with `--output-format json` and `--dangerously-skip-permissions` enables fully unattended execution. State between loop iterations is read from files, never carried in memory or environment variables.

**Core technologies:**
- **Bash 5.x outer loop**: Cross-session phase orchestration — survives context exhaustion, handles process lifecycle, zero dependencies
- **Claude Code CLI (`claude -p`)**: Per-phase AI agent invocation — headless mode with JSON output enables machine-parseable results
- **GSD command/workflow .md files**: Thin autopilot command + workflow following native GSD patterns
- **Node.js `gsd-tools.cjs` extension**: New `autopilot status` subcommand for state interrogation — centralizes STATE.md parsing outside bash
- **jq 1.6+**: Parse JSON output from Claude Code CLI in the bash outer loop

### Expected Features

**Must have (table stakes — autopilot is broken without these):**
- Phase loop with state reading — reads STATE.md, determines next step, executes, updates state, repeats
- Auto-context generation — replaces interactive discuss with AI-generated CONTEXT.md from PROJECT.md
- Auto-approval of gates — sets all confirmation gates to false and mode to yolo
- Resume capability — detects current position from STATE.md and phase artifacts after any interruption
- Bash outer loop script — reinvokes Claude Code with fresh context per phase
- Human checkpoint at verification — pauses the loop for human review at each phase's verify step
- Progress circuit breaker — detects stuck state via artifact-based progress detection (not just STATE.md changes)
- Human escalation after retries exhausted — stops cleanly when debug retries fail

**Should have (add after core loop validation):**
- Debug-first failure handling — spawns gsd-debugger on execution failures, applies fixes, retries
- Decision audit trail — enriches CONTEXT.md with explicit "Claude's Decision: X because Y" entries
- Smart phase-type routing — adapts auto-context behavior for UI vs API vs infrastructure phases
- Configurable autonomy level — per-phase pause configuration via config.json

**Defer (v2+):**
- Claude Agent SDK migration — replace bash outer loop after pattern is proven
- Cross-milestone learning — feedback from prior milestone outcomes
- Automated verification without human gate — AI-only verification via browser automation

**Anti-features (explicitly excluded):**
- Token/cost budget caps — progress circuit breaker is strictly better; budget caps belong at the API billing layer
- Interactive discuss in autonomous mode — defeats the purpose; mutually exclusive with full autonomy
- Parallel phase execution — GSD phases are sequential by design
- Agent Teams / peer-to-peer coordination — thin orchestrator with specialists is simpler and more reliable

### Architecture Approach

The autopilot uses a two-component architecture: a bash outer loop that handles cross-session continuity and a set of GSD-native components that handle in-session logic. The outer loop is the only piece that must run outside Claude Code's context window; everything else follows existing GSD command/workflow/agent patterns. STATE.md is the single source of truth between invocations — the outer loop reads it before every Claude Code invocation and validates it afterward. No in-memory state persists across iterations.

**Major components:**
1. `scripts/autopilot.sh` — The outer loop heartbeat. Reads STATE.md, invokes Claude Code per phase step, handles circuit breaking, manages human checkpoints. The most critical new component.
2. `agents/gsd-auto-context.md` — Replaces interactive discuss phase. Generates CONTEXT.md from PROJECT.md + ROADMAP.md using layered decision logic (locked decisions from PROJECT.md, inferred decisions from requirements, discretionary decisions with documented reasoning).
3. `get-shit-done/bin/lib/autopilot.cjs` — New gsd-tools module providing `autopilot status` JSON command for the outer loop to query state without bash string parsing.
4. `commands/gsd/autopilot.md` — Thin entry point (~30-50 lines). Validates project state and launches autopilot.sh.
5. `get-shit-done/workflows/verify-phase.md` (modified) — Adds autopilot-aware pause gate; writes `autopilot_paused: true` to STATE.md when human review is needed.

**Build order (dependency-dictated):** auto-context agent → gsd-tools extensions → verify-phase modification → autopilot.sh outer loop → autopilot.md command.

### Critical Pitfalls

1. **Context rot in the orchestrator** — If the outer loop accumulates context between phases, routing decisions degrade by phase 3-4. Prevention: bash outer loop reconstructs prompt from scratch each iteration, reading only STATE.md and ROADMAP.md. Never carry forward in-memory state.

2. **Auto-context producing shallow or wrong decisions** — AI defaults to generic/conventional choices that diverge from user intent; damage compounds across phases. Prevention: layered decision approach in auto-context agent with explicit "review recommended" flags for non-trivial choices; human checkpoint reviews all flagged autonomous decisions.

3. **Verification self-check bias** — The verifier validates against AI-generated plans derived from AI-generated context; internally consistent but wrong relative to user intent. Prevention: VERIFICATION.md must include a "Decisions Made Autonomously" section; verifier checks against ROADMAP.md success criteria (human-approved) in addition to plan must-haves.

4. **Circuit breaker false positives** — Legitimate long-running executions trigger the breaker (no STATE.md change for N iterations). Prevention: measure progress via artifact creation (new SUMMARY.md files, new git commits) not STATE.md change timestamps.

5. **State file corruption from interrupted writes** — Force-killing Claude Code mid-write produces partial STATE.md; next loop iteration makes bad routing decisions. Prevention: write-then-rename pattern (atomic on most filesystems); validate STATE.md structure on every read; reconstruct from ROADMAP.md + phase directories on validation failure.

6. **Discuss phase ambiguity debt** — Unresolved ambiguities propagate from auto-context into plans into execution; each phase makes independent guesses producing an internally inconsistent system. Prevention: auto-context agent must explicitly detect and document ambiguities in a "Resolved Ambiguities" CONTEXT.md section.

7. **Debug-retry masking systemic failures** — Debugger patches symptoms rather than root causes; code passes verification but is architecturally wrong. Prevention: escalate to human if the same plan fails more than once; include retry history in VERIFICATION.md.

## Implications for Roadmap

Based on combined research, the architecture has a clear build-order dependency chain that directly maps to roadmap phases. The bash outer loop depends on all in-session components. Each in-session component can be built and tested independently before integration.

### Phase 1: Core Loop Infrastructure
**Rationale:** The bash outer loop + STATE.md state machine is the foundational architectural decision. Getting this wrong (e.g., keeping orchestrator context in-session, not using atomic writes) invalidates everything built on top. Must be correct before adding higher-level features.
**Delivers:** `scripts/autopilot.sh` with state reading, fresh-context invocation per phase, circuit breaker (artifact-based), state write atomicity, human checkpoint gate, clean exit on completion or escalation. Basic `/gsd:autopilot` command entry point.
**Addresses:** Phase loop with state reading, resume capability, progress circuit breaker, human escalation after retries exhausted, bash outer loop script.
**Avoids:** Context rot (pitfall 1), state file corruption (pitfall 5), circuit breaker false positives (pitfall 4).

### Phase 2: Auto-Context Agent
**Rationale:** Cannot validate the full autopilot loop without auto-context, since the discuss phase would block every loop iteration. The auto-context agent can be built and tested in isolation (run against any GSD project, check CONTEXT.md output) before integrating with the outer loop.
**Delivers:** `agents/gsd-auto-context.md` with layered decision logic, "review recommended" flagging, explicit ambiguity detection, CONTEXT.md output that downstream agents consume identically to human-generated context.
**Addresses:** Auto-context generation, decision audit trail foundation.
**Avoids:** Shallow auto-decisions (pitfall 2), discuss phase ambiguity debt (pitfall 6).

### Phase 3: Verification Integration
**Rationale:** The human checkpoint at verification is the quality gate that makes autonomous decision-making safe. Must be built before the full loop runs end-to-end, because the verification report content determines what the human reviewer sees.
**Delivers:** Modified `verify-phase.md` with autopilot pause gate, VERIFICATION.md "Decisions Made Autonomously" section, STATE.md `autopilot_paused: true` marker, resume-from-pause capability.
**Addresses:** Human checkpoint at verification, verification self-check bias mitigation.
**Avoids:** Verification self-check bias (pitfall 3).

### Phase 4: gsd-tools State API
**Rationale:** The outer loop needs structured JSON state interrogation that is more reliable than bash string parsing of STATE.md. This can be developed in parallel with Phase 3 or before Phase 1 if the loop design is finalized first. Placed here because it is a dependency-free extension to an existing module.
**Delivers:** `lib/autopilot.cjs` with `autopilot status` command returning `{next_action, phase, phase_status, retry_count, stall_detected}` JSON.
**Addresses:** Reliable state interrogation for the outer loop.
**Avoids:** Fragile bash STATE.md parsing (explicit anti-pattern from STACK.md).

### Phase 5: Debug-Retry Integration
**Rationale:** Once the core loop runs end-to-end, failure handling is the first production-readiness enhancement. The gsd-debugger already exists; autopilot needs the retry orchestration logic and failure pattern tracking.
**Delivers:** Failure detection in outer loop, gsd-debugger invocation on gap closure failures, retry count tracking, failure categorization (implementation bug vs architectural issue), escalation after repeated failure of same plan.
**Addresses:** Debug-first failure handling (P2 feature).
**Avoids:** Debug-retry masking (pitfall 7).

### Phase 6: Enhancements and Hardening
**Rationale:** Post-validation refinements that improve reliability and user experience after the core loop is proven end-to-end.
**Delivers:** Smart phase-type routing in auto-context (UI vs API vs infrastructure), configurable autonomy level (per-phase pause config), enhanced decision audit trail, config isolation (restore pre-autopilot config values on completion), security rails (no destructive flags, secrets exclusion in auto-context).
**Addresses:** Smart phase-type routing, configurable autonomy level (P3 features), security mistakes from PITFALLS.md.

### Phase Ordering Rationale

- **Dependencies drive order:** The bash outer loop (Phase 1) depends on the state API (Phase 4) and verification gate (Phase 3) and auto-context (Phase 2). But auto-context, state API, and verification gate are independent of each other and can be developed in parallel if capacity allows.
- **Test isolation enables parallel development:** Each component in Phases 2-4 can be tested standalone before outer loop integration, reducing integration risk.
- **Pitfall prevention front-loaded:** The three Phase 1 pitfalls (context rot, state corruption, circuit breaker false positives) are architectural — they cannot be fixed post-hoc without significant rework. Correct design from the start is mandatory.
- **Anti-features reinforce sequencing:** Token budgets, parallel phases, and Agent SDK are explicitly deferred (per FEATURES.md anti-features section). This prevents scope creep during early phases.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Core Loop):** Claude Code CLI behavior under `--dangerously-skip-permissions` in long-running bash loops needs empirical validation. The `--resume` bug (GitHub #3138) means fresh invocations are required, but edge cases around concurrent session detection may emerge during implementation.
- **Phase 3 (Verification Integration):** The exact STATE.md schema extension for `autopilot_paused` and how resume detection works needs careful design to avoid conflicts with existing verify-phase.md logic.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Auto-Context Agent):** Follows existing GSD agent pattern exactly. The layered decision approach is fully specified in ARCHITECTURE.md. Direct implementation.
- **Phase 4 (gsd-tools Extension):** Extends existing CJS module pattern. No novel patterns.
- **Phase 5 (Debug-Retry):** gsd-debugger already exists; integration pattern is straightforward. The retry loop logic is specified in ARCHITECTURE.md.
- **Phase 6 (Enhancements):** Incremental additions to already-built components. Standard extension work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection + Ralph Loop pattern verified across 10+ implementations + Claude Code official docs. No gaps. |
| Features | HIGH | Competitor analysis (Ralphy, Devin, Cursor, Composio), Anthropic harness research, existing GSD codebase analysis. MVP definition is clear and well-justified. |
| Architecture | HIGH | Directly derived from GSD codebase inspection and PROJECT.md constraints. Component boundaries are precise. Build order is dependency-verified. |
| Pitfalls | HIGH | Multiple authoritative sources including Anthropic engineering blog, context rot academic research, real codebase bug reports. 7 specific pitfalls with prevention strategies and recovery costs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Claude Code CLI edge cases in long-running bash loops:** How does Claude Code behave when the bash loop runs overnight? Are there session reuse behaviors or rate limiting patterns that create unexpected failures? Validate during Phase 1 implementation with a real end-to-end test.
- **STATE.md schema extension protocol:** Adding `autopilot_paused` and retry tracking fields to STATE.md must be backward-compatible (existing GSD workflows must not break). Define the exact schema extension in Phase 1 before Phase 3 depends on it.
- **Auto-context quality threshold:** There is no quantitative standard for "good enough" auto-generated CONTEXT.md. The "compare against human-discuss-generated one" checklist item from PITFALLS.md needs a concrete rubric during Phase 2.
- **Config isolation after completion:** Which config values does autopilot touch (auto_advance, mode, gates) and exactly how are they restored? This needs a defined protocol, not just a checklist item. Address in Phase 6 but design the restoration contract in Phase 1.

## Sources

### Primary (HIGH confidence)
- GSD v1.22.0 codebase (commands/, agents/, workflows/, bin/lib/) — direct inspection of all relevant components
- [Claude Code subagent documentation](https://code.claude.com/docs/en/sub-agents) — headless mode, `--agent` flag, tool restrictions, permission modes
- [Claude Code best practices](https://www.anthropic.com/engineering/claude-code-best-practices) — headless mode, `-p` flag, `--output-format json`
- [Ralph Loop (snarktank/ralph)](https://github.com/snarktank/ralph) — outer loop pattern verification
- [Ralph Claude Code (frankbria)](https://github.com/frankbria/ralph-claude-code) — Claude Code-specific implementation, circuit breaker, JSON output parsing
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — context management pitfalls
- [Anthropic: Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — autonomy patterns
- [VSCode Issue #279589](https://github.com/microsoft/vscode/issues/279589) — concurrent agent file corruption documentation
- [Ralphy: Autonomous AI Coding Loop](https://github.com/michaelshimeles/ralphy) — real-world bash outer loop implementation

### Secondary (MEDIUM confidence)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — bash outer loop validation, progress file pattern
- [Addy Osmani: Conductors to Orchestrators](https://addyosmani.com/blog/future-agentic-coding/) — table stakes features, failure modes
- [Mike Mason: AI Coding Agents 2026](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) — coherence through orchestration, DORA data
- [Context Rot research (Hong et al., 2025; Paulsen, 2025)](https://www.producttalk.org/context-rot/) — context degradation across task types
- [Ralph Claude Code circuit breaker](https://dev.to/tumf/ralph-claude-code-the-technology-to-stop-ai-agents-how-the-circuit-breaker-pattern-prevents-3di4) — practical circuit breaker patterns
- [Claude Code `--resume` bug (GitHub #3138)](https://github.com/anthropics/claude-code/issues/3138) — justifies fresh invocation approach
- [Cursor Long-Running Agents](https://www.adwaitx.com/cursor-long-running-agents-autonomous-coding/) — competitor context window management
- [Composio Agent Orchestrator](https://github.com/ComposioHQ/agent-orchestrator) — parallel agent patterns (and why they don't apply here)

### Tertiary (LOW confidence)
- [tick-md: Multi-agent coordination with markdown](https://purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown) — STATE.md concurrent write concern (single source, but directly relevant)
- [The Ralph Loop: Context as Resource](https://www.ikangai.com/the-ralph-loop-how-a-bash-script-is-forcing-developers-to-rethink-context-as-a-resource/) — architectural rationale (blog analysis, not primary)

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
