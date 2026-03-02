# Phase 1: Core Loop Infrastructure - Research

**Researched:** 2026-03-01
**Domain:** Bash scripting, Claude Code CLI automation, state machine orchestration
**Confidence:** HIGH

## Summary

Phase 1 builds a bash outer loop that orchestrates GSD phases autonomously. The loop reads state from `.planning/` artifacts, invokes Claude Code CLI in print mode (`claude -p`) for each lifecycle step (discuss, plan, execute, verify), monitors progress via git commits and artifact creation, and circuit-breaks when stuck. The architecture is deliberately simple: a single bash script that shells out to `claude -p` with `--dangerously-skip-permissions`, parsing structured JSON output to make routing decisions.

The key technical insight is that Claude Code's `-p` (print/SDK) mode with `--output-format json` provides exactly the non-interactive, scriptable interface needed. Each invocation gets a fresh 200k-token context window by design -- no session continuity means no context rot. The `gsd-tools.cjs` utility already provides rich state inspection (init commands, roadmap analysis, phase queries); a new `phase-status` command extends this to give the bash script everything it needs for routing without parsing markdown.

**Primary recommendation:** Build a lean bash script (~200-300 lines) that uses `gsd-tools.cjs` for all state queries and `claude -p --dangerously-skip-permissions` for all Claude Code invocations. Keep the script dumb -- all intelligence lives in the existing GSD workflows that Claude Code loads via commands.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dual entry points: `/gsd:autopilot` command (friendly start) + standalone bash script (engine, also usable directly for CI/automation)
- Minimal arguments: reads current milestone from STATE.md, optional `--from-phase N` to start/resume from a specific phase
- Status banner on launch showing milestone name, phase range, and starting point
- One Claude Code invocation per step -- bash script calls Claude Code separately for discuss, plan, execute, verify (4 invocations per phase, maximum context freshness)
- No new state fields -- script infers state from existing artifacts on disk (CONTEXT.md, PLAN.md, SUMMARY.md, VERIFICATION.md presence)
- New `phase-status` command in gsd-tools.cjs that returns structured JSON for the bash script to consume
- On step failure (non-zero exit): halt autopilot, print which step failed and exit code. Keep simple for Phase 1 -- Phase 4 adds debug-retry
- Verify step runs gsd-verifier agent (automated, non-interactive). No human gate -- that's Phase 3
- Full Claude Code stdout/stderr piped through to user -- transparent, useful for debugging autopilot itself
- Clear separator banners printed between each Claude Code invocation
- Meaningful progress defined as: new git commits, phase advancement, or plan completion (per SAFE-02)
- One iteration = one Claude Code invocation
- 3 consecutive invocations with no progress triggers halt (default, configurable)
- Structured halt report: which phase/step, what was attempted in last 3 iterations, which progress signals were checked
- Threshold configurable via `autopilot.circuit_breaker_threshold` in .planning/config.json

### Claude's Discretion
- Whether to log output to file in addition to console
- End-of-run report format (summary table vs narrative)
- Exact banner/separator visual styling
- Bash script structure and error handling patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOOP-01 | Orchestrator reads STATE.md and ROADMAP.md to determine current phase and status | `gsd-tools.cjs` already has `state load`, `roadmap analyze`, `roadmap get-phase`. New `phase-status` command aggregates these for the bash script |
| LOOP-02 | Orchestrator drives next GSD phase forward (discuss, plan, execute, verify) | Claude Code `-p` mode with `--dangerously-skip-permissions` invokes each step as `/gsd:discuss-phase N --auto`, `/gsd:plan-phase N --auto`, `/gsd:execute-phase N`, `/gsd:verify-work N` |
| LOOP-03 | Orchestrator loops until all phases verified or halt condition | Bash while loop checking `phase-status` JSON for `all_phases_complete` flag |
| LOOP-04 | Cold-start: fresh milestone runs from initialization through completion | `phase-status` detects no artifacts exist, starts at discuss step for phase 1 |
| LOOP-05 | Resume: mid-milestone picks up from current STATE.md position | `phase-status` reads existing artifacts to determine exact step to resume from |
| LOOP-06 | Fresh context window for each phase iteration | Each `claude -p` call is a separate process -- inherent fresh context |
| LOOP-07 | All confirmation gates disabled in autopilot mode | `--dangerously-skip-permissions` + existing `mode: yolo` config + `--auto` flags on GSD commands |
| LOOP-08 | Clean 200k-token context window per iteration | Same as LOOP-06 -- `-p` mode is stateless by design |
| SAFE-01 | Circuit breaker detects N consecutive iterations with no state change | Bash tracks git commit count + artifact presence before/after each invocation |
| SAFE-02 | Circuit breaker monitors meaningful progress: commits, phase advancement, plan completion | Three signals: `git rev-list --count HEAD`, plan/summary file counts, phase number from STATE.md |
| SAFE-03 | Circuit breaker triggers halt with summary | Structured output showing last N iterations, what was attempted, why progress stalled |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Bash | 5.x | Outer loop script | Universal, zero-dependency, already the GSD execution environment |
| Claude Code CLI | current | AI invocation engine | `claude -p` provides non-interactive mode with JSON output |
| gsd-tools.cjs | current | State queries, phase operations | Already handles all `.planning/` CRUD -- extend, don't replace |
| jq | 1.6+ | JSON parsing in bash | Standard tool for parsing JSON in shell scripts |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| git | 2.x+ | Progress signal (commit counting) | Circuit breaker checks `git rev-list --count HEAD` before/after each invocation |
| node | 18+ | Running gsd-tools.cjs | Already a dependency of GSD framework |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash script | Node.js script | More complex, adds dependency for what is fundamentally a process-orchestration problem. Bash excels at running processes sequentially |
| Bash script | Python script | Unnecessary complexity. The script just runs processes and checks exit codes |
| jq | Node.js one-liners | jq is faster for simple JSON extraction and more readable in bash context |

## Architecture Patterns

### Recommended Project Structure
```
.claude/
├── commands/gsd/
│   └── autopilot.md           # Thin command entry point (dispatches to workflow)
├── get-shit-done/
│   ├── workflows/
│   │   └── autopilot.md       # Workflow definition (instructions for Claude Code)
│   ├── bin/
│   │   ├── gsd-tools.cjs      # Extended with phase-status command
│   │   └── lib/
│   │       ├── commands.cjs    # Extended with phase-status
│   │       └── phase.cjs      # Extended with phase-status logic
│   └── scripts/
│       └── autopilot.sh       # The bash outer loop engine
```

### Pattern 1: Stateless Process Orchestration
**What:** Each Claude Code invocation is a self-contained process with no shared state except the filesystem.
**When to use:** Always -- this is the core architectural pattern.
**Example:**
```bash
# Each step is a fresh process -- no session state leaks
claude -p --dangerously-skip-permissions \
  --output-format json \
  "/gsd:discuss-phase $PHASE --auto"
```

### Pattern 2: Artifact-Based State Inference
**What:** Instead of maintaining explicit state fields, infer phase progress from the presence of standard artifacts.
**When to use:** All state detection in the bash script.
**Example:**
```bash
# gsd-tools phase-status returns:
# { "step": "plan", "has_context": true, "has_plans": false, ... }
PHASE_JSON=$(node gsd-tools.cjs phase-status "$PHASE")
CURRENT_STEP=$(echo "$PHASE_JSON" | jq -r '.step')
```

### Pattern 3: Progress Snapshot Comparison
**What:** Take a snapshot of progress signals before each invocation, compare after, to detect stalls.
**When to use:** Circuit breaker implementation.
**Example:**
```bash
# Before invocation
COMMITS_BEFORE=$(git rev-list --count HEAD)
PLANS_BEFORE=$(ls .planning/phases/$PHASE_DIR/*-PLAN.md 2>/dev/null | wc -l)

# Run Claude Code
claude -p ...

# After invocation
COMMITS_AFTER=$(git rev-list --count HEAD)
PLANS_AFTER=$(ls .planning/phases/$PHASE_DIR/*-PLAN.md 2>/dev/null | wc -l)

# Check progress
if [ "$COMMITS_BEFORE" = "$COMMITS_AFTER" ] && [ "$PLANS_BEFORE" = "$PLANS_AFTER" ]; then
  NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
fi
```

### Anti-Patterns to Avoid
- **Session continuity between steps:** Never use `claude -c` or `--resume` between steps. Each step MUST be a fresh invocation to prevent context rot.
- **Parsing markdown in bash:** Never grep/sed/awk markdown files directly. Always use `gsd-tools.cjs` which has proper parsers.
- **Storing state in bash variables across invocations:** The bash script should re-query state from disk before each step. Don't cache.
- **Swallowing Claude Code output:** Always pipe stdout/stderr through to the user. The autopilot should be transparent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STATE.md parsing | Custom bash grep/sed | `gsd-tools.cjs state load` | STATE.md format is complex with frontmatter, sections, markdown tables |
| Phase artifact detection | `ls` and pattern matching | `gsd-tools.cjs phase-status` (new) | Artifact naming conventions have edge cases (padded phase numbers, decimal phases) |
| ROADMAP.md phase extraction | Regex in bash | `gsd-tools.cjs roadmap get-phase` | Multi-line markdown section extraction is brittle in bash |
| Config reading | `cat config.json \| jq` | `gsd-tools.cjs config-get` | Config has nested keys, defaults, and user-level overrides |
| Git commit detection | Custom log parsing | `git rev-list --count HEAD` | Simple, reliable, no parsing needed |
| JSON output parsing | `grep` or `python -c` | `jq` | Purpose-built for JSON in shell, fast and reliable |

**Key insight:** `gsd-tools.cjs` already solves most state management problems. The new `phase-status` command aggregates existing capabilities into a single JSON response optimized for the bash script's routing logic.

## Common Pitfalls

### Pitfall 1: Claude Code Permission Prompts Breaking Automation
**What goes wrong:** Claude Code prompts for permission to run tools, blocking the script.
**Why it happens:** `--dangerously-skip-permissions` not passed, or GSD commands internally prompt.
**How to avoid:** Always pass `--dangerously-skip-permissions`. Ensure `mode: yolo` is set in config.json. Pass `--auto` flag to GSD commands that support it.
**Warning signs:** Script hangs waiting for input. Claude Code exits with timeout.

### Pitfall 2: Context Window Accumulation
**What goes wrong:** Using `claude -c` (continue) instead of fresh `claude -p` causes context to accumulate across phases.
**Why it happens:** Temptation to maintain conversation context for "better understanding."
**How to avoid:** NEVER use `-c` or `--resume`. Each step is a fresh `-p` invocation. The GSD state files ARE the context -- Claude Code reads them fresh each time.
**Warning signs:** Later phases run slower, hit token limits, or produce lower-quality output.

### Pitfall 3: Race Conditions in Artifact Detection
**What goes wrong:** Checking for artifacts immediately after Claude Code exits may miss files being written.
**Why it happens:** Claude Code's `-p` mode returns before all file writes are flushed to disk.
**How to avoid:** Check `--output-format json` exit result first, then check artifacts. Claude Code's JSON output includes the result status. Add a small sync delay if needed.
**Warning signs:** Intermittent "no plans found" errors after plan-phase step that clearly succeeded.

### Pitfall 4: Circuit Breaker False Positives
**What goes wrong:** Circuit breaker triggers during legitimate slow operations (large research, complex planning).
**Why it happens:** Some steps don't produce git commits (research writes to disk but may not commit, discuss-phase produces CONTEXT.md).
**How to avoid:** Track ALL progress signals, not just commits. Include: artifact creation (CONTEXT.md, RESEARCH.md, PLAN.md, SUMMARY.md, VERIFICATION.md), plan count changes, phase advancement. A step that creates a new artifact IS progress even without a commit.
**Warning signs:** Autopilot halts after discuss or research steps that correctly produced artifacts.

### Pitfall 5: GSD Command Exit Codes
**What goes wrong:** Assuming non-zero exit from Claude Code means the step failed.
**Why it happens:** Claude Code may exit non-zero for various reasons (model errors, tool failures) even if partial progress was made.
**How to avoid:** Check both exit code AND artifact changes. A non-zero exit with new artifacts means "partial success -- continue." A non-zero exit with no artifact changes means "real failure."
**Warning signs:** Autopilot stops when a step partially succeeded and could continue.

## Code Examples

### Claude Code Non-Interactive Invocation
```bash
# Standard invocation pattern for each GSD step
result=$(claude -p --dangerously-skip-permissions \
  --output-format json \
  "/gsd:plan-phase $PHASE --auto" 2>&1)
exit_code=$?

# Parse JSON result
if [ $exit_code -eq 0 ]; then
  echo "Step succeeded"
else
  echo "Step failed with exit code $exit_code"
  # Check if artifacts were still created (partial success)
fi
```

### Phase Status Query (new gsd-tools command)
```bash
# Returns all data the bash script needs for routing
STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase-status "$PHASE" --cwd "$PROJECT_DIR")

# Extract routing fields
STEP=$(echo "$STATUS" | jq -r '.step')
HAS_CONTEXT=$(echo "$STATUS" | jq -r '.has_context')
HAS_PLANS=$(echo "$STATUS" | jq -r '.has_plans')
HAS_SUMMARIES=$(echo "$STATUS" | jq -r '.all_plans_have_summaries')
HAS_VERIFICATION=$(echo "$STATUS" | jq -r '.has_verification')
PHASE_COMPLETE=$(echo "$STATUS" | jq -r '.phase_complete')
```

### Circuit Breaker Implementation
```bash
NO_PROGRESS_COUNT=0
MAX_NO_PROGRESS=${CIRCUIT_BREAKER_THRESHOLD:-3}
ITERATION_LOG=()

take_snapshot() {
  echo "$(git rev-list --count HEAD 2>/dev/null || echo 0)|$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l)|$(ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l)|$(ls "$PHASE_DIR"/*-CONTEXT.md 2>/dev/null | wc -l)"
}

check_progress() {
  local before="$1" after="$2" step="$3"
  if [ "$before" = "$after" ]; then
    NO_PROGRESS_COUNT=$((NO_PROGRESS_COUNT + 1))
    ITERATION_LOG+=("$step: no progress detected")
    if [ $NO_PROGRESS_COUNT -ge $MAX_NO_PROGRESS ]; then
      print_halt_report
      exit 1
    fi
  else
    NO_PROGRESS_COUNT=0
    ITERATION_LOG=()
  fi
}
```

### Main Loop Structure
```bash
while true; do
  # Determine current phase and step
  STATUS=$(node gsd-tools.cjs phase-status "$CURRENT_PHASE")
  STEP=$(echo "$STATUS" | jq -r '.step')

  case "$STEP" in
    discuss)
      run_step "discuss-phase" "$CURRENT_PHASE --auto"
      ;;
    plan)
      run_step "plan-phase" "$CURRENT_PHASE --auto"
      ;;
    execute)
      run_step "execute-phase" "$CURRENT_PHASE"
      ;;
    verify)
      run_step "verify-work" "$CURRENT_PHASE"
      ;;
    complete)
      # Phase done, advance to next
      CURRENT_PHASE=$(next_phase "$CURRENT_PHASE")
      if [ -z "$CURRENT_PHASE" ]; then
        echo "All phases complete!"
        exit 0
      fi
      ;;
  esac
done
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Interactive Claude Code sessions | `claude -p` print mode for automation | Claude Code 1.x | Enables fully scriptable AI invocation |
| Manual phase-by-phase execution | `workflow.auto_advance` config | GSD current | Auto-chains within a session, but still limited by single context window |
| No progress monitoring | Proposed circuit breaker | Phase 1 (new) | Prevents runaway loops that waste tokens without progress |

**Current GSD limitations autopilot addresses:**
- `auto_advance` chains phases within a single context window, causing context rot
- No way to run the full lifecycle unattended across phases
- No progress monitoring or circuit breaking

## Open Questions

1. **Claude Code `-p` mode with GSD commands**
   - What we know: `-p` mode accepts prompts and returns JSON. GSD commands work in interactive mode.
   - What's unclear: Whether `/gsd:*` slash commands work correctly in `-p` mode, or if the prompt needs to be structured differently (e.g., reading the workflow file directly).
   - Recommendation: Test `/gsd:plan-phase 1 --auto` in `-p` mode during Wave 1. Fallback: use `--append-system-prompt-file` to load the workflow directly.

2. **`--auto` flag propagation**
   - What we know: `plan-phase.md` supports `--auto` for auto-advance. `discuss-phase.md` does not currently have an `--auto` flag.
   - What's unclear: Whether discuss-phase needs modification, or if autopilot should use a different approach for discuss.
   - Recommendation: The bash script invokes each step independently. For discuss, use the existing `/gsd:discuss-phase` with `--auto` (if it supports it) or invoke it in a way that produces CONTEXT.md non-interactively. Verify during implementation.

3. **Artifact creation timing**
   - What we know: Claude Code `-p` returns after the conversation completes.
   - What's unclear: Whether all file writes (via Write/Edit tools) are guaranteed flushed before the process exits.
   - Recommendation: Assume they are (Claude Code should ensure this). If intermittent issues arise, add a `sync` call after each invocation.

## Sources

### Primary (HIGH confidence)
- Claude Code CLI Reference (https://code.claude.com/docs/en/cli-reference) - Full CLI flag documentation including `-p`, `--output-format`, `--dangerously-skip-permissions`, `--max-turns`
- GSD codebase direct inspection - `gsd-tools.cjs`, `init.cjs`, `core.cjs`, `phase.cjs`, `config.cjs` source code
- Existing GSD workflows - `execute-phase.md`, `plan-phase.md`, `discuss-phase.md`, `transition.md`, `verify-phase.md`

### Secondary (MEDIUM confidence)
- Community guides on `--dangerously-skip-permissions` usage patterns
- Claude Code automation patterns from web search results

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - bash + Claude Code CLI are well-documented and already in use
- Architecture: HIGH - pattern follows existing GSD conventions, extends proven `gsd-tools.cjs`
- Pitfalls: MEDIUM - some edge cases (artifact timing, slash commands in `-p` mode) need empirical validation

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable domain, low churn)
