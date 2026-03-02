# Architecture Research

**Domain:** Autonomous orchestration layer for GSD framework
**Researched:** 2026-03-01
**Confidence:** HIGH

## System Overview: How Autopilot Fits Into Existing GSD

```
                         USER INVOKES
                              |
                              v
                 ┌────────────────────────┐
                 │  /gsd:autopilot (CMD)  │  <-- NEW: thin command file
                 │  commands/gsd/          │
                 └───────────┬────────────┘
                             |
                             v
                 ┌────────────────────────┐
                 │  autopilot.sh          │  <-- NEW: outer loop (bash)
                 │  scripts/              │
                 │                        │
                 │  Responsibilities:     │
                 │  - Fresh context per   │
                 │    phase invocation    │
                 │  - Read STATE.md to    │
                 │    determine next step │
                 │  - Reinvoke Claude     │
                 │    Code per phase      │
                 │  - Circuit breaker     │
                 │  - Human checkpoint    │
                 │    gate at verify      │
                 └───────────┬────────────┘
                             |
              ┌──────────────┼──────────────┐
              |              |              |
              v              v              v
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ auto-context │ │  EXISTING    │ │  EXISTING    │
   │ (NEW agent)  │ │ plan-phase   │ │execute-phase │
   │              │ │ workflow     │ │ workflow     │
   │ Generates    │ │              │ │              │
   │ CONTEXT.md   │ │ Research ->  │ │ Waves ->     │
   │ from         │ │ Plan ->      │ │ Verify ->    │
   │ PROJECT.md   │ │ Check        │ │ Transition   │
   └──────────────┘ └──────────────┘ └──────────────┘
                             |
              ┌──────────────┼──────────────┐
              |              |              |
              v              v              v
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ EXISTING     │ │ EXISTING     │ │ EXISTING     │
   │ gsd-planner  │ │ gsd-executor │ │ gsd-verifier │
   │              │ │              │ │              │
   │ Creates      │ │ Runs plans   │ │ Checks goals │
   │ PLAN.md      │ │ per wave     │ │ achieved     │
   └──────────────┘ └──────────────┘ └──────────────┘
```

### Key Architectural Insight

The existing GSD architecture already does 90% of autonomous execution. The `auto_advance` + `mode: "yolo"` chain already runs: discuss -> plan -> execute -> verify -> transition -> next phase. The gap is:

1. **Context window exhaustion**: `auto_advance` chains within a single Claude Code session. When context fills (typically 2-3 phases deep), the chain dies.
2. **Discuss phase requires human input**: The discuss-phase workflow asks the user questions to generate CONTEXT.md.
3. **No debug-retry on verification failure**: When `verify-phase` finds gaps, execution stops and waits for human.

Autopilot fills exactly these three gaps. Nothing else needs to change.

## Component Boundaries

### Component 1: `commands/gsd/autopilot.md` (NEW - Thin Command)

**Responsibility:** Entry point. Parses arguments, validates project state, launches the bash outer loop.

**Communicates With:** autopilot.sh (launches it), STATE.md (reads initial position)

**Pattern:** Identical to existing commands (execute-phase.md, new-project.md). Frontmatter with name, description, argument-hint, allowed-tools. Body references a workflow or script.

**Size:** ~30-50 lines. This is a launcher, not an orchestrator.

```markdown
---
name: gsd:autopilot
description: Autonomously drive a milestone from current position to completion
argument-hint: "[milestone-version] [--from-phase N] [--dry-run]"
allowed-tools:
  - Read
  - Bash
  - Write
---
<objective>
Launch autonomous milestone execution from current STATE.md position.
Validate project state, then hand off to autopilot.sh outer loop.
</objective>

<process>
1. Read STATE.md to get current position
2. Validate: ROADMAP.md exists, phases remain
3. Launch: bash scripts/autopilot.sh [args]
</process>
```

### Component 2: `scripts/autopilot.sh` (NEW - Outer Loop)

**Responsibility:** The heartbeat. Survives context window exhaustion by running as a bash process that re-invokes Claude Code for each phase. Reads STATE.md between invocations to determine what to do next.

**Communicates With:**
- STATE.md (reads to determine next action)
- ROADMAP.md (reads to check remaining phases)
- VERIFICATION.md (reads to detect gaps)
- Claude Code CLI (invokes with fresh context per phase)

**This is the most critical new component.** It is the ONLY piece that must exist outside the Claude Code context window. Everything else runs inside existing GSD patterns.

```bash
#!/usr/bin/env bash
# autopilot.sh - Outer loop for autonomous GSD execution
#
# Pseudocode flow:
#
# while phases_remain:
#   phase = read_current_phase_from_state()
#   phase_status = read_phase_status()
#
#   if phase needs context:
#     invoke claude "generate auto-context for phase $phase"
#
#   if phase needs planning:
#     invoke claude "/gsd:plan-phase $phase --auto"
#
#   if phase needs execution:
#     invoke claude "/gsd:execute-phase $phase --auto"
#
#   if verification failed (gaps_found):
#     retry_count++
#     if retry_count > MAX_RETRIES:
#       echo "ESCALATING: verification failed $MAX_RETRIES times"
#       exit 1
#     invoke claude "/gsd:plan-phase $phase --gaps"
#     invoke claude "/gsd:execute-phase $phase --gaps-only --auto"
#     continue
#
#   if verification needs human:
#     echo "PAUSED: Human verification required"
#     echo "Review: $phase_dir/*-VERIFICATION.md"
#     echo "Resume: /gsd:autopilot --resume"
#     exit 0
#
#   # Phase complete, advance
#   stall_count = check_stall(previous_state, current_state)
#   if stall_count > MAX_STALL:
#     echo "CIRCUIT BREAKER: $MAX_STALL iterations with no progress"
#     exit 1
```

**Why bash, not a GSD workflow?** Because the entire point is surviving context window boundaries. A GSD workflow runs inside Claude Code's context. When that context fills up, the workflow dies. The bash script runs outside Claude Code, reads file-based state, and reinvokes Claude Code with fresh context.

### Component 3: `agents/gsd-auto-context.md` (NEW - Agent)

**Responsibility:** Replaces the interactive discuss-phase workflow. Reads PROJECT.md, ROADMAP.md, and REQUIREMENTS.md to generate CONTEXT.md for a phase without human input. Documents its reasoning for each decision.

**Communicates With:**
- PROJECT.md (reads for project vision, constraints, decisions)
- ROADMAP.md (reads for phase goal and requirements)
- REQUIREMENTS.md (reads for requirement details)
- CONTEXT.md (writes as output)

**Pattern:** Standard GSD agent file (frontmatter with name, description, tools, color). Spawned by autopilot.sh via Claude Code invocation.

**Key design decision:** The auto-context agent uses a layered decision approach:
1. **Layer 1 - PROJECT.md front-loading**: Constraints, tech decisions, and explicit preferences from PROJECT.md are treated as locked decisions
2. **Layer 2 - Requirement inference**: Gray areas are resolved by reading requirements and inferring the simplest implementation that satisfies them
3. **Layer 3 - Claude's discretion with reasoning**: Remaining ambiguities are decided by Claude with documented rationale in the CONTEXT.md

This produces a CONTEXT.md that downstream agents (researcher, planner) consume identically to a human-generated one.

### Component 4: Modified `workflows/verify-phase.md` (MODIFIED)

**Responsibility:** Add an autopilot-aware gate. When running in autopilot mode and verification status is `human_needed`, pause the outer loop instead of presenting interactive options.

**Change scope:** Minimal. Add a check for autopilot mode flag. When detected, write a marker file or update STATE.md with `autopilot_paused: true` and the verification path. The outer loop reads this and pauses.

**Communicates With:** STATE.md (writes pause state), autopilot.sh (reads pause state)

### Component 5: `gsd-tools.cjs` Extensions (MODIFIED)

**Responsibility:** Add CLI subcommands that the outer loop needs for state interrogation.

**New subcommands:**
- `autopilot status` - Returns JSON: current phase, phase status (needs-context, needs-plan, needs-execute, needs-verify, complete), retry count, stall detection
- `autopilot should-pause` - Returns whether human checkpoint is needed
- `state get-field <field>` - Returns specific STATE.md field value

**Pattern:** Extends existing `lib/` modules. The init commands already return rich JSON; autopilot commands follow the same pattern.

## Recommended Project Structure

```
commands/gsd/
  autopilot.md             # NEW: thin command entry point

agents/
  gsd-auto-context.md      # NEW: generates CONTEXT.md without human input

scripts/
  autopilot.sh             # NEW: bash outer loop

get-shit-done/
  bin/
    gsd-tools.cjs          # MODIFIED: add autopilot subcommands
    lib/
      autopilot.cjs        # NEW: autopilot state logic
  workflows/
    verify-phase.md        # MODIFIED: autopilot pause gate
    execute-phase.md       # MODIFIED: debug-retry on gaps (minor)
```

### Structure Rationale

- **commands/gsd/autopilot.md**: Follows existing command convention. Users invoke `/gsd:autopilot` like any other GSD command.
- **agents/gsd-auto-context.md**: Follows existing agent convention. Spawnable by Task() with subagent_type.
- **scripts/autopilot.sh**: New directory usage but `scripts/` already exists with `build-hooks.js` and `run-tests.cjs`. Bash is appropriate because this component must run outside Claude Code's context window.
- **lib/autopilot.cjs**: Follows existing pattern of `lib/phase.cjs`, `lib/state.cjs`, etc.

## Architectural Patterns

### Pattern 1: File-Based State Machine

**What:** The outer loop reads `.planning/STATE.md` and `.planning/phases/*/` to determine the current state and next action. No in-memory state persists between Claude Code invocations.

**When to use:** Always. This is the fundamental pattern that makes autopilot work across context window boundaries.

**Trade-offs:**
- Pro: Survives any crash, context reset, or interruption
- Pro: Human can inspect and modify state at any time
- Pro: Existing GSD workflows already maintain this state
- Con: State reads add latency (trivial -- milliseconds for file I/O)

**Example:**
```bash
# autopilot.sh reads state to determine next action
PHASE_STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" autopilot status)
NEXT_ACTION=$(echo "$PHASE_STATUS" | jq -r '.next_action')

case "$NEXT_ACTION" in
  "generate-context") invoke_auto_context "$PHASE" ;;
  "plan-phase")       invoke_plan_phase "$PHASE" ;;
  "execute-phase")    invoke_execute_phase "$PHASE" ;;
  "fix-gaps")         invoke_gap_closure "$PHASE" ;;
  "human-checkpoint") pause_for_human "$PHASE" ;;
  "complete")         echo "Milestone complete." ;;
esac
```

### Pattern 2: Fresh Context Per Phase

**What:** Each phase gets a fresh Claude Code invocation with a clean 200k-token context window. The outer loop passes only the minimum needed context (phase number, mode flags) and lets the invoked workflow load its own files.

**When to use:** Every phase invocation. This is what solves context window exhaustion.

**Trade-offs:**
- Pro: Never runs out of context mid-milestone
- Pro: Each phase gets full 200k tokens for its work
- Pro: Matches existing GSD pattern (subagents get fresh context)
- Con: Loses conversational continuity between phases (but STATE.md bridges this)

**Example:**
```bash
invoke_phase() {
  local phase=$1
  local command=$2

  # Fresh Claude Code invocation per phase
  claude --print --dangerously-skip-permissions \
    "$command $phase --auto" \
    2>&1 | tee "$LOG_DIR/phase-${phase}.log"
}
```

### Pattern 3: Escalation Ladder

**What:** Failures are handled with increasing human involvement: auto-retry -> debug agent -> human escalation.

**When to use:** When verification finds gaps or execution fails.

**Trade-offs:**
- Pro: Most failures resolve without human intervention
- Pro: Preserves autonomy while maintaining safety
- Con: Debug retries add time and tokens

**Example flow:**
```
Verification gaps found
  -> Plan gap closure (/gsd:plan-phase X --gaps)
  -> Execute gap closure (/gsd:execute-phase X --gaps-only)
  -> Re-verify
  -> If still failing after N retries: PAUSE for human
```

## Data Flow

### Autonomous Phase Loop (Primary Flow)

```
autopilot.sh (bash outer loop)
    |
    |--[read]--> STATE.md (where are we?)
    |--[read]--> ROADMAP.md (what phases remain?)
    |
    |--[invoke Claude]--> auto-context agent
    |                         |
    |                         |--[read]--> PROJECT.md, ROADMAP.md, REQUIREMENTS.md
    |                         |--[write]--> .planning/phases/XX/XX-CONTEXT.md
    |                         |
    |<--[exit]--
    |
    |--[invoke Claude]--> /gsd:plan-phase X --auto
    |                         |
    |                         |--[read]--> CONTEXT.md, RESEARCH.md
    |                         |--[spawn]--> gsd-phase-researcher
    |                         |--[spawn]--> gsd-planner
    |                         |--[spawn]--> gsd-plan-checker
    |                         |--[write]--> XX-PLAN.md files
    |                         |--[write]--> STATE.md (phase planned)
    |                         |
    |<--[exit]--
    |
    |--[invoke Claude]--> /gsd:execute-phase X --auto
    |                         |
    |                         |--[spawn]--> gsd-executor (per plan/wave)
    |                         |--[spawn]--> gsd-verifier
    |                         |--[write]--> SUMMARY.md, VERIFICATION.md
    |                         |--[write]--> STATE.md (phase complete)
    |                         |--[write]--> ROADMAP.md (phase checked off)
    |                         |
    |<--[exit]--
    |
    |--[read]--> VERIFICATION.md (passed? gaps? human_needed?)
    |
    |--[if gaps]--> retry loop (plan-phase --gaps, execute --gaps-only)
    |--[if human_needed]--> PAUSE (write STATE.md, exit)
    |--[if passed]--> next phase (loop back to top)
```

### State Management Flow

```
STATE.md is the single source of truth between invocations:

  autopilot.sh reads STATE.md
       |
       v
  Determines: Phase X, Status: "Ready to plan"
       |
       v
  Invokes: /gsd:plan-phase X --auto
       |
       v
  plan-phase workflow updates STATE.md:
    Phase: X, Status: "Ready to execute"
       |
       v
  autopilot.sh reads STATE.md again
       |
       v
  Determines: Phase X, Status: "Ready to execute"
       |
       v
  Invokes: /gsd:execute-phase X --auto
       |
       v
  execute-phase workflow updates STATE.md:
    Phase: X+1, Status: "Ready to plan"
```

### Key Data Flows

1. **Auto-context generation**: PROJECT.md + ROADMAP.md + REQUIREMENTS.md -> gsd-auto-context agent -> CONTEXT.md. This replaces the human discuss-phase conversation with algorithmic decision-making.

2. **Gap closure retry**: VERIFICATION.md (gaps_found) -> autopilot.sh detects gaps -> invokes plan-phase --gaps -> invokes execute-phase --gaps-only -> re-verify. This loop runs up to N times (configurable, default 3).

3. **Human checkpoint**: VERIFICATION.md (human_needed) -> autopilot.sh detects pause -> writes STATE.md with `autopilot_paused: true` -> exits. Human reviews, then invokes `/gsd:autopilot --resume` to continue.

4. **Circuit breaker**: autopilot.sh compares STATE.md before and after each invocation. If no meaningful state change after N iterations (configurable, default 3), it halts with an error.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 phases (typical) | Single bash loop, sequential phase execution. This is the target. |
| 5-15 phases | Same architecture. Bash loop is lightweight. Token cost is the constraint, not architecture. |
| 15+ phases | Consider phase batching or parallel phase execution for independent phases. But this is an unusual project size for GSD. |

### Scaling Priorities

1. **First bottleneck: Token cost.** Each phase invocation consumes a full Claude Code session. For a 10-phase milestone, that is 10+ sessions (more with research, gap closure). The architecture cannot reduce this -- it is inherent to the problem. The circuit breaker prevents runaway cost.

2. **Second bottleneck: Wall-clock time.** Sequential phase execution means total time = sum of all phase times. For phases that are truly independent (no dependency chain), future work could invoke them in parallel. But most GSD phases are sequential by design.

## Anti-Patterns

### Anti-Pattern 1: Orchestrator Inside Claude Code Context

**What people do:** Build the phase loop as a GSD workflow that runs inside Claude Code, relying on `auto_advance` to chain phases.

**Why it's wrong:** Context window exhaustion after 2-3 phases. The auto_advance chain dies when context fills. This is the exact problem autopilot solves.

**Do this instead:** Use bash outer loop that reinvokes Claude Code with fresh context per phase. The outer loop is ~100 lines of bash. It reads STATE.md, decides what to do, and invokes Claude Code. When Claude Code exits, the outer loop reads STATE.md again.

### Anti-Pattern 2: Custom State Format

**What people do:** Create a separate autopilot state file (e.g., `.planning/AUTOPILOT-STATE.json`) that tracks autopilot-specific state.

**Why it's wrong:** Now you have two sources of truth. STATE.md says "Phase 3, ready to execute" but your custom file says "Phase 2, gap closure retry 2." They will drift. Every GSD workflow reads STATE.md -- they don't know about your custom file.

**Do this instead:** Use STATE.md as the single state source. Add minimal fields if needed (e.g., a `## Autopilot` section with retry counts), but the phase position, plan status, and verification results all live in existing STATE.md and VERIFICATION.md files.

### Anti-Pattern 3: Reimplementing Existing Workflows

**What people do:** Write autopilot-specific plan/execute/verify logic instead of invoking existing GSD commands.

**Why it's wrong:** Duplicates hundreds of lines of tested workflow logic. When GSD workflows update, autopilot diverges. Bugs get fixed in one place but not the other.

**Do this instead:** Invoke existing commands: `/gsd:plan-phase`, `/gsd:execute-phase`. These already handle research, planning, execution, verification, state updates, and transitions. Autopilot just needs to call them in the right order and handle the gaps (context generation, debug retry, human pause).

### Anti-Pattern 4: Trying to Resume Mid-Phase

**What people do:** Save internal phase state (which plan was executing, which wave, which task) and try to resume from that exact point after a context reset.

**Why it's wrong:** The existing execute-phase workflow already handles resumption. It checks for SUMMARY.md files and skips completed plans. Re-invoking `/gsd:execute-phase X --auto` after a crash naturally resumes from where it left off.

**Do this instead:** Let existing resumption logic work. If a phase invocation crashes, the outer loop re-invokes the same phase. Execute-phase discovers what is already done and continues.

## Integration Points

### Integration with Existing Commands

| GSD Command | How Autopilot Uses It | Modification Needed |
|-------------|----------------------|---------------------|
| `/gsd:plan-phase X --auto` | Invoked by outer loop for each phase | None -- already supports `--auto` |
| `/gsd:execute-phase X --auto` | Invoked by outer loop for each phase | None -- already supports `--auto` |
| `/gsd:plan-phase X --gaps` | Invoked when verification finds gaps | None -- already exists |
| `/gsd:execute-phase X --gaps-only --auto` | Invoked for gap closure execution | None -- already exists |
| `/gsd:debug` | Could be invoked on persistent failures | None -- already exists, but integration is optional enhancement |

### Integration with Existing State Files

| File | How Autopilot Reads It | How Autopilot Writes It |
|------|----------------------|------------------------|
| STATE.md | Read between every invocation to determine next action | Written by invoked workflows (no direct writes from autopilot.sh) |
| ROADMAP.md | Read to check remaining phases and completion status | Written by invoked workflows (not by autopilot.sh) |
| VERIFICATION.md | Read after execute-phase to check for gaps or human_needed | Written by gsd-verifier (not by autopilot.sh) |
| CONTEXT.md | Does not read (auto-context agent writes it) | Written by gsd-auto-context agent |
| config.json | Read for mode/depth/model_profile settings | May set `workflow.auto_advance: true` at start |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| autopilot.sh <-> Claude Code | CLI invocation with stdout capture | Each invocation is a fresh process. Exit code + STATE.md changes = result. |
| autopilot.sh <-> gsd-tools | `node gsd-tools.cjs autopilot status` | JSON stdout. Same pattern as all existing gsd-tools commands. |
| gsd-auto-context <-> plan-phase | CONTEXT.md file | Auto-context writes CONTEXT.md. Plan-phase reads it. No direct communication. |
| autopilot.sh <-> human | stdout messages + STATE.md pause marker | When paused, autopilot.sh prints instructions and exits. Human resumes with `/gsd:autopilot --resume`. |

## Build Order (Dependencies)

The components have clear dependencies that dictate build order:

```
1. gsd-auto-context agent        (no dependencies on other new components)
   |
2. gsd-tools autopilot commands  (depends on understanding state model)
   |
3. verify-phase modification     (depends on defining pause protocol)
   |
4. autopilot.sh outer loop       (depends on 1, 2, 3 -- needs all pieces)
   |
5. autopilot.md command          (depends on 4 -- thin wrapper)
```

**Phase 1: Auto-Context Agent** - Build first because it has zero dependencies on other new components. Can be tested standalone: run it against any existing GSD project and verify it produces valid CONTEXT.md that downstream agents can consume.

**Phase 2: gsd-tools Extensions** - Build the `autopilot status` command that reads STATE.md, ROADMAP.md, and VERIFICATION.md to return structured JSON about the current autopilot state. This is the "eyes" of the outer loop.

**Phase 3: Verify-Phase Modification** - Add the autopilot-aware pause gate. When `autopilot_mode` is detected and verification returns `human_needed`, write a pause marker. This is a small modification to an existing workflow.

**Phase 4: Outer Loop (autopilot.sh)** - Build the bash script that ties everything together. This depends on all previous components. It reads state (via gsd-tools), invokes Claude Code (for auto-context, plan, execute), handles retries, and manages human checkpoints.

**Phase 5: Command Entry Point** - The thin `autopilot.md` command file that validates state and launches autopilot.sh. Build last because it is trivially simple and depends on the outer loop.

## Sources

- Existing GSD codebase analysis (HIGH confidence -- direct code reading):
  - `commands/gsd/*.md` - Command pattern and structure
  - `get-shit-done/workflows/*.md` - Workflow patterns, auto_advance chain, state management
  - `agents/*.md` - Agent patterns and spawning conventions
  - `get-shit-done/bin/gsd-tools.cjs` and `lib/*.cjs` - CLI tool patterns
  - `get-shit-done/templates/state.md` - STATE.md structure and lifecycle
  - `get-shit-done/references/planning-config.md` - Configuration patterns
- PROJECT.md (HIGH confidence -- project requirements and constraints)

---
*Architecture research for: GSD Autopilot autonomous orchestration*
*Researched: 2026-03-01*
