# Pitfalls Research

**Domain:** Autonomous AI coding orchestration (converting human-in-the-loop framework to autonomous loop)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Context Rot Across Phase Boundaries

**What goes wrong:**
The autonomous loop runs multiple phases in sequence. Each phase's subagents produce artifacts (SUMMARY.md, VERIFICATION.md, STATE.md updates). The outer orchestrator accumulates context from reading these artifacts between phases. By phase 3 or 4, the orchestrator's context window is 60-80% full. Its ability to correctly parse state files, make routing decisions, and detect anomalies degrades measurably. Research from Chroma (Hong et al., 2025) and Paulsen (2025) confirmed that context degradation affects all task types and worsens with complexity, not just length.

**Why it happens:**
GSD's existing `auto_advance` already chains within a session but is documented as not surviving context window exhaustion. The autopilot's outer loop inherits this problem at a larger scale. The orchestrator reads STATE.md, ROADMAP.md, VERIFICATION.md results, and SUMMARY.md outputs between each phase. This read-aggregate-route pattern grows linearly with phases completed.

**How to avoid:**
The outer loop must be a bash script (or lightweight process) that reinvokes Claude Code with a fresh context window for each phase. The orchestrator prompt for each invocation should be reconstructed from scratch by reading only STATE.md and ROADMAP.md -- never carry forward in-memory state. This is already identified in PROJECT.md as the intended approach. The critical detail: the bash helper must NOT try to pass rich context between invocations via environment variables or pipe. Let the fresh orchestrator discover state from files.

**Warning signs:**
- Orchestrator makes incorrect routing decisions (e.g., trying to execute a phase that already passed verification)
- STATE.md position does not match actual phase directory contents
- Orchestrator "forgets" that a previous phase had gaps and re-executes instead of gap-closing
- Token usage reports show orchestrator context above 50% before spawning any subagents

**Phase to address:**
Phase 1 (core loop implementation). The bash outer loop is the foundational architectural decision. Getting this wrong means every subsequent feature builds on a rotting foundation.

---

### Pitfall 2: Auto-Decided Context Replacing Human Judgment Produces Shallow Decisions

**What goes wrong:**
The discuss phase exists because implementation decisions have multiple valid approaches and human judgment selects the best one for the specific situation. When autopilot auto-generates CONTEXT.md from PROJECT.md, it makes "reasonable default" decisions that are locally correct but may not match the user's actual intent. The auto-context agent picks "cards layout" because it is common, but the project needed "timeline layout" for its specific domain. These shallow decisions compound across phases -- each phase builds on the previous phase's auto-decided context, and drift from user intent accumulates silently.

**Why it happens:**
The discuss phase was designed as a conversation: identify gray areas, present options, let the user choose. An auto-context agent has no mechanism for knowing which decisions the user would care about versus which are truly "Claude's discretion." Research shows AI agents "failed to understand the implications and goals embedded in social conversations" and "lacked the common sense and background knowledge to infer implicit assumptions." The auto-context agent will err toward convention over innovation.

**How to avoid:**
The auto-context agent must use a "layered decision" approach (already noted in PROJECT.md). Concretely: (1) Decisions that are explicitly stated or strongly implied in PROJECT.md are adopted directly. (2) Decisions where PROJECT.md provides enough domain signal to make an informed choice are decided with documented reasoning. (3) Decisions where the choice would significantly change the user experience or architecture are flagged as "auto-decided: review recommended" in CONTEXT.md. The autopilot should log these auto-decisions prominently so the human checkpoint at verification can catch bad ones.

**Warning signs:**
- CONTEXT.md contains only generic/conventional decisions with no project-specific reasoning
- Multiple phases have nearly identical CONTEXT.md structure (copy-paste thinking)
- Verification reveals features that work correctly but don't match what the user actually wanted
- Auto-decided items consistently pick the "safest" option rather than the one best suited to the domain

**Phase to address:**
Phase 2 (auto-context generation). This is where the auto-context agent is built. The layered decision approach and "review recommended" flagging must be designed into the agent from the start, not bolted on later.

---

### Pitfall 3: Verification Self-Check Bias (The Agent Verifying Its Own Work)

**What goes wrong:**
In normal GSD, the verify phase catches gaps because the verifier is a fresh agent with no knowledge of what the executor intended -- it checks what the codebase actually does against what the phase goal requires. In autonomous mode, the risk is that the verification becomes a rubber stamp. Not because the verifier agent is literally the same instance (GSD already uses separate subagents), but because the auto-decided context that guided execution also guides verification. If the auto-context decided "pagination" but the user wanted "infinite scroll," the verifier checks for pagination, finds it, and reports "passed." The gap between intent and implementation goes undetected.

Research confirms this: AI "often tests its own assumptions, not human intent, generating tests that rarely include complex edge cases, domain-specific constraints, or legacy system interactions." Google's 2025 DORA Report found 90% AI adoption correlates with 9% higher bug rates, partly because AI-generated verification reflects AI-generated assumptions.

**Why it happens:**
The verification agent derives must-haves from PLAN frontmatter, which was generated from auto-decided CONTEXT.md. The entire chain is self-consistent but potentially wrong. There is no external reference point that breaks the feedback loop. In human-in-the-loop GSD, the human IS that external reference point -- they wrote the CONTEXT.md, so verification against it catches real gaps.

**How to avoid:**
The human checkpoint at verification (already planned) is the critical defense. But it must be designed to surface the right information. The verification report should include a "Decisions Made Autonomously" section that lists every auto-decided item from CONTEXT.md, so the human reviewer can quickly scan for decisions that missed the mark. Additionally, the verifier should check against the ROADMAP.md phase goal and SUCCESS CRITERIA (which the human approved during milestone setup) rather than solely against the auto-generated PLAN must-haves.

**Warning signs:**
- Verification always passes on first attempt (suspiciously high success rate)
- Gap-closure cycles never trigger (no feedback loop is exercised)
- VERIFICATION.md reports high scores but the human checkpoint reveals unexpected behavior
- The "human_needed" status never fires (the verifier is not identifying things it cannot check)

**Phase to address:**
Phase 3 (verification integration). The verification workflow modification must include the autonomous-decision audit trail. This cannot wait until the human checkpoint phase because the verification report content determines what the human sees.

---

### Pitfall 4: Circuit Breaker False Positives Killing Valid Long-Running Operations

**What goes wrong:**
The progress circuit breaker (planned: pause after N consecutive iterations with no state change) triggers during legitimate long-running operations. A complex execution phase may involve a subagent that takes 20+ minutes to execute a large plan with many tasks. During that time, STATE.md does not update because the subagent writes SUMMARY.md only on completion. The outer loop checks state, sees no change for 3 iterations, and trips the circuit breaker -- killing a productive execution mid-flight.

The inverse is also dangerous: the circuit breaker does NOT trip when it should because it detects superficial state changes. An agent stuck in a debug-retry loop modifies STATE.md each retry ("attempt 1... attempt 2... attempt 3...") but makes no actual progress. The state file changed, so the breaker stays closed.

**Why it happens:**
"No state change" is an imprecise proxy for "no progress." The Ralph loop project documented this exact problem and uses three signals (file changes, repeated errors, output decline) rather than a single state-check. GSD's file-based state was designed for human consumption ("where am I?"), not machine-parseable progress tracking.

**How to avoid:**
Define "progress" precisely for each phase type. For execution phases: progress = new SUMMARY.md files created OR new git commits from executor agents. For planning: progress = new PLAN.md files created. For verification: progress = VERIFICATION.md created. The circuit breaker should check these specific artifacts, not just whether STATE.md changed. Additionally, the bash outer loop should distinguish between "waiting for a subagent to complete" (normal) and "no subagent is running and no state changed" (stuck).

**Warning signs:**
- Circuit breaker triggers during the first complex phase execution
- Circuit breaker never triggers despite the loop making no forward progress
- User has to manually restart after false circuit breaker trips
- Debug-retry loops run indefinitely because each retry changes the state file

**Phase to address:**
Phase 1 (core loop) for the basic circuit breaker, but refined in Phase 4 (debug-retry integration) when the retry loop adds a second source of "fake progress" signals.

---

### Pitfall 5: State File Corruption from Concurrent or Interrupted Writes

**What goes wrong:**
GSD uses STATE.md as the source of truth for position tracking. Multiple subagents may update STATE.md near-simultaneously (an executor finishing one plan while the orchestrator is reading state to decide the next step). More commonly, the bash outer loop kills a Claude Code process (timeout, circuit breaker trip, user Ctrl+C) while STATE.md is mid-write. The file ends up with partial content, malformed markdown, or contradictory position information. The next loop iteration reads corrupt state and makes bad decisions.

This is a documented problem in the AI agent space. A VSCode issue (#279589) specifically describes file corruption when multiple agents write simultaneously, and the tick-md project implements file locking to prevent concurrent edit conflicts in markdown coordination files.

**Why it happens:**
Markdown files are not transactional. GSD was designed for single-agent, human-supervised operation where concurrent writes are rare and a human can spot corruption immediately. Autopilot introduces: (1) the bash outer loop and Claude Code subagent both touching STATE.md, (2) forced termination scenarios (timeout, circuit breaker), (3) potential overlap between executor SUMMARY.md writes and orchestrator state reads.

**How to avoid:**
Adopt a write-then-rename pattern for STATE.md updates: write to STATE.md.tmp, then `mv STATE.md.tmp STATE.md` (atomic on most filesystems). The bash outer loop should validate STATE.md structure after every read (check for required sections: Current Position, Session Continuity). If validation fails, reconstruct from ROADMAP.md and phase directory contents (GSD already has this fallback pattern in execute-phase.md). Never allow the orchestrator and a subagent to write STATE.md in the same step.

**Warning signs:**
- STATE.md contains duplicate section headers
- Current Position reports a phase number that does not exist in ROADMAP.md
- Bash outer loop errors with "parse error" or "unexpected format" on STATE.md reads
- Progress appears to go backward (phase N-1 after completing phase N)

**Phase to address:**
Phase 1 (core loop). Atomic state writes must be in place before any multi-session execution.

---

### Pitfall 6: Discuss Phase Bypass Creates Ambiguity Debt

**What goes wrong:**
By design, autopilot skips the interactive discuss phase and auto-generates CONTEXT.md. This removes a critical clarification step where ambiguities in the phase goal get resolved. Unresolved ambiguities propagate into plans, which propagate into execution. The executor makes a choice, but it may be the wrong one. Across 4-6 phases, ambiguity debt compounds: each phase's executor makes independent guesses about ambiguous requirements, producing an internally inconsistent system.

This is distinct from Pitfall 2 (shallow decisions). Pitfall 2 is about decisions being too generic. This pitfall is about decisions being made at the wrong level -- the executor makes architectural choices that should have been made at the context/planning level because nobody forced clarification.

**Why it happens:**
The discuss phase exists specifically to force disambiguation. Without it, ambiguity flows downhill. In human-in-the-loop GSD, the user catches ambiguity during discussion ("wait, do you mean X or Y?"). In autopilot, the auto-context agent may not even recognize certain domain-specific ambiguities as ambiguities -- they look like straightforward decisions from a generic perspective.

**How to avoid:**
The auto-context agent must explicitly identify ambiguities it cannot resolve from PROJECT.md alone and document them in CONTEXT.md under a "Resolved Ambiguities" section with reasoning. The planner should treat documented ambiguity resolutions as reviewable assumptions, not locked decisions. At the human checkpoint (verification), unresolved or poorly resolved ambiguities should surface as "architectural decisions made without user input" for review.

**Warning signs:**
- Executor SUMMARY.md files contain "decided to..." or "chose to..." language for non-trivial choices
- Different phases make contradictory assumptions about the same concept
- Human checkpoint reveals "that's not what I meant" reactions to correctly-implemented-but-wrong features
- CONTEXT.md has no ambiguity discussion -- everything appears certain

**Phase to address:**
Phase 2 (auto-context generation). The auto-context agent needs explicit ambiguity detection and documentation logic.

---

### Pitfall 7: Debug-Retry Loop Masks Systematic Failures

**What goes wrong:**
The debug-retry mechanism (spawn gsd-debugger on failures, attempt fixes, retry up to N times) can mask a fundamental problem by treating symptoms. A phase fails verification because the auto-context made a poor decision (Pitfall 2). The debugger "fixes" the gap by patching code to pass the verification check without addressing the root cause. Three retry cycles later, the code passes verification but is a Frankenstein of patches on a flawed foundation. The human checkpoint sees "passed" and approves.

**Why it happens:**
The gsd-debugger is designed to diagnose and fix specific failures. It does not have the context to recognize that a failure stems from a systemic issue (bad architectural decision, wrong context assumption) rather than a localized bug. Each retry attempt has a fresh context window and sees only the current failure, not the pattern of failures.

**How to avoid:**
Track failure patterns across retries. If the same plan fails verification more than once, the second failure should escalate to human review rather than attempting another debug cycle. The debug summary should be included in the verification report so the human checkpoint can see "this plan required 3 debug attempts before passing" as a red flag. Implement a "failure category" field: if gsd-debugger classifies a failure as "architectural" or "design-level" rather than "implementation bug," it should immediately escalate rather than retry.

**Warning signs:**
- Debug retry count frequently reaches the maximum (default 3)
- Debug fixes involve large rewrites rather than targeted patches
- The same verification gap reappears in a slightly different form after debugging
- Cumulative debug time exceeds original execution time for a phase

**Phase to address:**
Phase 4 (debug-retry integration). The failure escalation logic and pattern tracking must be designed when integrating the debugger, not added as an afterthought.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding phase sequence in bash loop | Simpler outer loop, no state parsing needed | Breaks when phases are added, removed, or reordered; cannot handle gap-closure sub-phases (X.1) | Never -- STATE.md and ROADMAP.md are the source of truth |
| Skipping auto-context for "simple" phases | Faster execution, fewer tokens | Inconsistent CONTEXT.md coverage makes the pattern unreliable; executor still makes implicit decisions without documentation | Only for phases explicitly tagged as "infrastructure-only" in ROADMAP.md |
| Single retry for all failure types | Simpler retry logic | Wastes retries on unfixable failures; masks systematic issues | MVP only -- must be refined before production use |
| Polling STATE.md in a tight loop | Simple progress detection | File I/O overhead; race conditions with concurrent writes; false progress signals | Never -- use artifact presence checks (SUMMARY.md, VERIFICATION.md) |
| Storing loop state in bash variables | No file I/O overhead | Lost on script crash or kill; invisible to Claude Code sessions; no audit trail | Never -- all state must survive process death via files |

## Integration Gotchas

Common mistakes when connecting autopilot to existing GSD components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Bash outer loop + Claude Code | Passing rich context via CLI arguments or environment variables (shell escaping breaks, length limits hit) | Write a minimal prompt file to disk, invoke Claude Code with `--prompt-file`. Let the fresh session discover state from .planning/ files |
| Auto-context + existing CONTEXT.md | Overwriting manually-created CONTEXT.md from a previous discuss-phase session | Check for existing CONTEXT.md first. If exists, use it as-is (user already discussed). Auto-generate only when missing |
| Circuit breaker + subagent Task() | Treating the Task() call as a fire-and-forget async operation and checking state while it runs | Task() in Claude Code is blocking. The circuit breaker must wrap the OUTER loop iteration, not individual Task() calls |
| Autopilot + auto_advance config | Setting auto_advance=true globally and conflicting with autopilot's own phase chaining | Autopilot should manage its own phase progression independently of auto_advance. Disable auto_advance during autopilot runs to prevent double-chaining |
| Verify workflow + human checkpoint | Modifying verify-phase.md to always auto-approve in autopilot mode | Add a SEPARATE autopilot gate that fires AFTER verification, not modify the existing verification logic. Preserve the verify workflow's integrity for non-autopilot use |
| Resume capability + partial state | Assuming STATE.md position is always correct after an interrupted run | Validate STATE.md against actual file system state (do phase directories match? do summaries exist for "completed" plans?) before resuming |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading all SUMMARY.md files to determine progress | Slow iteration startup; context bloat in orchestrator | Use gsd-tools CLI for progress checks (returns JSON, minimal context) | At 5+ phases with 3+ plans each (15+ files to read) |
| Spawning fresh Claude Code per micro-decision | API rate limits; session startup overhead (5-10 sec each) | Batch decisions within a phase; one Claude Code session per phase lifecycle step | At any scale -- even 4 phases means 12+ session startups (discuss+plan+execute per phase) |
| Storing debug retry history in STATE.md | STATE.md grows unbounded; parsing slows; context consumed by history | Separate debug log file (.planning/debug/autopilot-log.md); STATE.md stores only current position | After 2-3 debug-retry cycles across multiple phases |
| Full ROADMAP.md read on every loop iteration | Roadmap can be 200+ lines for complex milestones; most content is irrelevant to current phase | Use `gsd-tools roadmap get-phase` for targeted reads; only read full roadmap during transitions | Milestones with 6+ phases |

## Security Mistakes

Domain-specific security issues for autonomous AI orchestration.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Autopilot running with production credentials accessible | Autonomous executor could modify production databases, deploy to production, or access sensitive APIs without human review | Ensure CLAUDE.md or environment restricts available tools/commands during autopilot. Sandbox execution environment. Never allow deploy commands in autonomous mode |
| Auto-approving git force-push or destructive operations | Circuit breaker trip + restart could lead to force-push over good work, or `git clean -f` deleting untracked artifacts | Maintain GSD's existing "always_confirm_destructive" safety rail even in autopilot mode. The bash outer loop should never pass `--force` flags |
| Debug-retry loop with elevated permissions | Debugger attempting to fix permission errors by escalating privileges (sudo, chmod 777, etc.) | Whitelist debugger actions. The gsd-debugger should only modify files within .planning/ and the project source tree. No system-level commands |
| Storing API keys or secrets in state files | Autopilot reads .env or config files during auto-context and embeds values in CONTEXT.md or STATE.md, which get committed to git | Auto-context agent should have explicit exclusion rules for .env, credentials, and secret files. CONTEXT.md template should warn against including sensitive values |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Outer loop:** Successfully chains 3 phases -- but does each phase get a truly fresh context? Check token usage at start of phase 3 (should be near zero, not accumulated)
- [ ] **Auto-context:** Generates CONTEXT.md for every phase -- but are decisions documented with reasoning, or just listed as bullet points? Compare auto-generated CONTEXT.md against a human-discuss-generated one
- [ ] **Circuit breaker:** Stops after N iterations with no change -- but does it distinguish between "waiting for Task() to complete" and "stuck"? Test with a plan that takes 15+ minutes to execute
- [ ] **Resume capability:** Picks up from STATE.md position -- but does it validate that position against actual file system state? Kill the loop mid-phase and restart. Verify it does not re-execute completed plans or skip incomplete ones
- [ ] **Human checkpoint:** Pauses at verification -- but does it surface autonomous decisions for review? Check VERIFICATION.md for the "Decisions Made Autonomously" section (or equivalent)
- [ ] **Debug-retry:** Spawns debugger on failure -- but does it escalate on repeated failures rather than patching indefinitely? Trigger the same failure 3 times and verify escalation to human
- [ ] **State atomicity:** STATE.md updates correctly -- but is the write atomic? Kill the process during a state write and verify the file is not corrupted on restart
- [ ] **Config isolation:** Autopilot sets config values -- but does it restore them after completion? Check that auto_advance, mode, and other settings return to pre-autopilot values after the run completes

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context rot in orchestrator | LOW | Kill and restart with fresh context. State files contain everything needed. The outer loop's crash recovery IS the fix |
| Bad auto-context decisions | MEDIUM | Re-run discuss-phase manually for the affected phase. Re-plan and re-execute. Previous execution's git commits can be reverted if needed |
| Verification self-check bias | MEDIUM | Human manually tests the phase output against ROADMAP.md goals (not PLAN must-haves). Create gap plans for any discovered mismatches. Re-execute gap closure |
| Circuit breaker false positive | LOW | Restart the autopilot. STATE.md was last written before the breaker tripped, so position is correct. The bash loop should log why it tripped for diagnosis |
| State file corruption | MEDIUM | Reconstruct STATE.md from ROADMAP.md progress markers and phase directory contents (SUMMARY.md presence = plan complete). GSD already has this reconstruction pattern in execute-phase.md |
| Ambiguity debt (compound) | HIGH | Requires human review of all auto-generated CONTEXT.md files, identification of compounding wrong assumptions, potential rewrite of multiple phases. This is the most expensive recovery because the damage is distributed |
| Debug-retry masking | HIGH | Requires human code review of all debug-patched code. May require reverting to pre-debug state and re-executing with corrected context. The git history is the salvation -- each debug attempt is committed separately |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context rot across phases | Phase 1: Core loop (bash outer loop with fresh context per phase) | Token usage at phase 3+ start is near zero; no accumulated state beyond what's read from files |
| Shallow auto-decisions | Phase 2: Auto-context agent (layered decision approach, "review recommended" flags) | Auto-generated CONTEXT.md contains documented reasoning for each decision; non-trivial decisions are flagged |
| Verification self-check bias | Phase 3: Verification integration (audit trail of autonomous decisions in VERIFICATION.md) | VERIFICATION.md includes "Decisions Made Autonomously" section; human checkpoint surfaces these |
| Circuit breaker false positives | Phase 1: Core loop (artifact-based progress detection) + Phase 4: Debug-retry (refined detection) | Circuit breaker correctly distinguishes active execution from stuck loops; no false trips during normal 15-min executions |
| State file corruption | Phase 1: Core loop (atomic writes, validation on read) | STATE.md survives process kill mid-write; restart after kill produces valid state |
| Discuss phase ambiguity debt | Phase 2: Auto-context agent (explicit ambiguity detection and documentation) | CONTEXT.md contains "Resolved Ambiguities" section with reasoning; no "decided to..." language in executor SUMMARYs |
| Debug-retry masking | Phase 4: Debug-retry integration (failure pattern tracking, escalation logic) | Repeated failures escalate to human; debug attempts logged; verification report shows retry history |

## Sources

- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) -- MEDIUM confidence (official source, directly applicable to outer loop design)
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- HIGH confidence (official source, authoritative on context management)
- [Anthropic: Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) -- HIGH confidence (official source)
- [Mike Mason: AI Coding Agents -- Coherence Through Orchestration, Not Autonomy](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) -- MEDIUM confidence (well-sourced analysis with DORA and METR data)
- [Ralph Claude Code: Circuit breaker pattern for autonomous agents](https://dev.to/tumf/ralph-claude-code-the-technology-to-stop-ai-agents-how-the-circuit-breaker-pattern-prevents-3di4) -- MEDIUM confidence (practical implementation experience)
- [Addy Osmani: Self-Improving Coding Agents](https://addyosmani.com/blog/self-improving-agents/) -- MEDIUM confidence (practitioner experience, multi-source)
- [VSCode Issue #279589: Strict Mode for WorkspaceEdit to prevent concurrent AI agent corruption](https://github.com/microsoft/vscode/issues/279589) -- HIGH confidence (documented bug report)
- [tick-md: Multi-agent coordination with markdown files](https://purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown) -- LOW confidence (single source, but directly relevant to STATE.md corruption concern)
- [IEEE Spectrum: AI Coding Degrades -- Silent Failures Emerge](https://spectrum.ieee.org/ai-coding-degrades) -- MEDIUM confidence (reputable publication, corroborates quality degradation findings)
- [Context Rot research (Hong et al., 2025; Paulsen, 2025)](https://www.producttalk.org/context-rot/) -- MEDIUM confidence (aggregated academic research, multiple studies cited)
- GSD v1.22.0 codebase analysis (execute-phase.md, discuss-phase.md, verify-phase.md, transition.md, new-milestone.md) -- HIGH confidence (primary source, direct examination)

---
*Pitfalls research for: GSD Autopilot -- autonomous AI coding orchestration*
*Researched: 2026-03-01*
