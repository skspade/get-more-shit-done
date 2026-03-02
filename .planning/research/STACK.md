# Stack Research

**Domain:** Autonomous AI agent orchestration (CLI-based, file-state, subagent-spawning)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Recommended Stack

### What GSD Already Provides (Do NOT Rebuild)

GSD v1.22.0 provides the entire inner-loop machinery. The autopilot builds on top of it, not beside it.

| Existing Component | Purpose | Autopilot Relevance |
|---|---|---|
| `gsd-tools.cjs` CLI | State operations, config, init, phase/roadmap management | Autopilot calls these directly -- they are the state API |
| 9 specialized agents (.md) | Execute substantive work in fresh 200k-token windows | Autopilot spawns these via Task tool, unchanged |
| `auto_advance` config | Chains phases within a single session | Autopilot replaces this with cross-session chaining |
| `mode: "yolo"` / `bypassPermissions` | Auto-approves tool use within a session | Autopilot uses `--dangerously-skip-permissions` for outer loop |
| Workflow .md files | Phase lifecycle (discuss, plan, execute, verify, transition) | Autopilot invokes these workflows directly |
| `STATE.md` + frontmatter sync | Machine-readable YAML frontmatter on STATE.md | Autopilot reads frontmatter to determine next action |
| `config.json` | Project-level settings (models, parallelization, research) | Autopilot reads/writes config (e.g., `workflow.auto_advance`) |
| `ROADMAP.md` | Phase definitions with goals, requirements, success criteria | Autopilot reads to know what phases exist and their order |

**Confidence: HIGH** -- Direct codebase inspection of commands/, agents/, get-shit-done/bin/lib/, get-shit-done/workflows/.

### Core Technologies (What Needs to Be Built)

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| Bash (outer loop script) | bash 5.x | Cross-session phase loop that reinvokes Claude Code per phase | The Ralph Loop pattern (2025) proved bash is the correct tool for outer-loop orchestration. Bash survives context window exhaustion, handles process lifecycle, and has zero dependencies. GSD already uses bash helpers in its toolchain. |
| Claude Code CLI | Latest (`claude`) | AI agent invocation per phase iteration | The `-p` (print/headless) flag + `--output-format json` + `--dangerously-skip-permissions` enables fully unattended execution. The `--agent` flag can run a custom autopilot agent as main thread. |
| GSD command/workflow .md files | N/A (markdown) | Thin orchestrator command + workflow for in-session phase logic | GSD's native pattern: command.md defines interface, workflow.md defines logic, agent spawns subagents via Task tool. The autopilot command and workflow follow the same pattern as every other GSD command. |
| Node.js (`gsd-tools.cjs`) | >=16.7.0 | State queries, config management, phase operations | Already the state API. Autopilot needs 1-2 new subcommands (e.g., `state next-action` to compute what phase/step to run next). Extending existing CJS modules is trivial. |
| jq | 1.6+ | Parse JSON output from Claude Code CLI in bash | Claude Code's `--output-format json` returns structured results. jq is the standard tool for extracting completion status, error messages, and result data in bash scripts. Available on all dev machines. |

**Confidence: HIGH** -- Ralph Loop pattern verified across 10+ implementations (snarktank/ralph, frankbria/ralph-claude-code, KLIEBHAN/ralph-loop, michaelshimeles/ralphy). Claude Code CLI flags verified via official docs (code.claude.com/docs/en/sub-agents, headless mode docs).

### Supporting Components

| Component | Purpose | When to Use |
|---|---|---|
| `gsd-auto-context` agent (.md) | Generates CONTEXT.md from PROJECT.md when discuss phase is bypassed | Spawned by autopilot workflow as a Task subagent during the auto-discuss step |
| `autopilot.md` command | Thin orchestrator entry point (~100-200 lines) | User invokes `/gsd:autopilot [milestone]` -- routes to workflow |
| `autopilot.md` workflow | In-session phase loop logic (~300-500 lines) | Drives a single phase through discuss/plan/execute/verify/transition |
| `gsd-autopilot-loop.sh` bash script | Outer loop: reinvokes Claude Code per phase with fresh context | The only new non-markdown artifact. Handles context window exhaustion, process lifecycle, completion detection |
| `state next-action` subcommand | Reads STATE.md + ROADMAP.md, returns JSON: `{action, phase, step, args}` | Called by bash outer loop to determine what to invoke next. Centralizes state-to-action logic in one place |

**Confidence: HIGH** -- Architecture directly derived from PROJECT.md constraints and existing GSD patterns.

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| `shellcheck` | Lint the bash outer loop script | Standard for production bash. Catches quoting issues, undefined variables, POSIX compliance. |
| `node scripts/run-tests.cjs` | Run existing GSD test suite | Verify new gsd-tools subcommands don't break existing functionality. |
| Claude Code (interactive) | Test autopilot commands during development | Use `/gsd:autopilot` interactively first, then test headless mode. |

## Architecture: Two-Layer Orchestration

The autopilot uses a two-layer design, mirroring the Ralph Loop pattern but adapted to GSD's existing architecture:

### Layer 1: Bash Outer Loop (`gsd-autopilot-loop.sh`)

```
while true; do
    # 1. Query state to determine next action
    NEXT=$(node gsd-tools.cjs state next-action)
    ACTION=$(echo "$NEXT" | jq -r '.action')
    PHASE=$(echo "$NEXT" | jq -r '.phase')

    # 2. Exit conditions
    [ "$ACTION" = "complete" ] && break
    [ "$ACTION" = "human_needed" ] && pause_for_human && continue
    [ "$ACTION" = "stuck" ] && handle_circuit_breaker && break

    # 3. Invoke Claude Code with fresh context per phase-step
    claude -p "$PROMPT" \
        --output-format json \
        --dangerously-skip-permissions \
        --allowedTools "Task,Read,Write,Edit,Bash,Grep,Glob" \
        > "$OUTPUT_FILE" 2>&1

    # 4. Analyze result, update iteration counter
    analyze_result "$OUTPUT_FILE"
done
```

**Why bash, not Node.js or Python:**
- Zero additional dependencies (bash + jq are universal on dev machines)
- Process lifecycle management is bash's core competency (trap, signals, PID tracking)
- Ralph Loop ecosystem proved this pattern at scale
- GSD's own bin/install.js is Node, but orchestration scripts use bash patterns

### Layer 2: GSD Workflow (In-Session Logic)

Each Claude Code invocation runs a GSD workflow that:
1. Reads STATE.md to know current position
2. Executes one phase-step (discuss, plan, execute, verify, or transition)
3. Updates STATE.md with results
4. Returns structured completion status

This is identical to how `auto_advance` works today, except:
- Discuss phase is replaced by auto-context generation (no human input)
- Verification pauses for human review (configurable)
- The bash outer loop handles cross-session continuity

## Installation

```bash
# No new npm packages needed. GSD's existing dependencies suffice.
# The only new artifacts are markdown files + one bash script.

# Verify jq is available (needed for bash outer loop)
jq --version || echo "Install jq: sudo apt install jq / brew install jq"

# Verify Claude Code CLI is available
claude --version || echo "Install: npm install -g @anthropic-ai/claude-code"
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| Bash outer loop | Claude Agent SDK (Python) | If you need programmatic control over model parameters, streaming, or custom tool definitions beyond what CLI flags provide. The SDK is more powerful but adds a Python dependency and moves orchestration outside GSD's native patterns. |
| Bash outer loop | Node.js outer loop | If the bash script exceeds ~200 lines and needs complex JSON manipulation. Node.js would match GSD's existing toolchain but adds process management complexity that bash handles natively. |
| `state next-action` subcommand | Inline bash state parsing | Never. Centralizing state-to-action logic in gsd-tools.cjs keeps the bash script thin and testable. Parsing STATE.md with grep/sed in bash is fragile. |
| `--agent` flag for main thread | Spawning autopilot as Task subagent | If the autopilot needs to be invoked from within an existing Claude Code session. The `--agent` flag is better for headless invocation where the autopilot IS the session. |
| `--dangerously-skip-permissions` | `--allowedTools` only | If running in a shared/untrusted environment. `--allowedTools` provides fine-grained control but requires enumerating every tool. For autonomous execution in a developer's own repo, full bypass is standard practice (per Ralph Loop ecosystem). |
| jq for JSON parsing | Node.js one-liner | If jq is unavailable. `node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).field)"` works but is verbose. |
| Claude Code `--resume` flag | Fresh `-p` invocation each time | When a phase step was interrupted mid-execution (context limit hit). `--resume` restores the full conversation. However, for the autopilot, fresh invocations are preferred (cleaner state, no context rot). Use `--resume` only for explicit retry of failed steps. |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| Claude Agent SDK as primary orchestrator | PROJECT.md explicitly rules this out: "Claude Agent SDK harness -- native-first approach, SDK is a future option." Adds Python dependency, moves logic outside GSD's markdown-based architecture. | Bash outer loop + GSD native commands/workflows |
| Agent Teams | PROJECT.md rules this out: "Agent Teams integration -- phases are sequential, peer-to-peer coordination unnecessary." Agent Teams coordinate parallel independent sessions; autopilot phases are sequential by design. | Sequential phase execution via outer loop |
| Token/cost budget enforcement | PROJECT.md rules this out: "Budget/cost caps -- progress circuit breaker handles runaway, no token budget enforcement." Progress stall detection is more meaningful than token counting. | Circuit breaker (N consecutive iterations with no state change) |
| `--continue` flag for session chaining | Known bugs with context restoration after limit hits (GitHub issue #3138). The `--continue` flag hijacks the most recent session in the directory, which may not be the autopilot session. | Fresh `-p` invocations with state read from `.planning/` files |
| Interactive discuss mode | PROJECT.md rules this out: "Interactive discuss mode -- always auto-decide, never prompt during autonomous execution." | Auto-context agent that generates CONTEXT.md from PROJECT.md |
| Python/TypeScript wrapper scripts | Adds runtime dependency, duplicates what bash does natively (process management, signal handling), and breaks the "native GSD implementation" constraint. | Bash script with jq for JSON handling |
| Complex state machine library | The state machine is simple (5 states: discuss, plan, execute, verify, transition) with one-directional flow. A library adds dependency for no benefit. | `state next-action` subcommand in gsd-tools.cjs that reads STATE.md and returns the next action |
| Polling/sleep loops for Task completion | Claude Code's Task tool blocks until the subagent completes. No polling needed. | Task tool's built-in blocking behavior |

## Stack Patterns by Variant

**If running fully autonomous (default autopilot mode):**
- Bash outer loop with `--dangerously-skip-permissions`
- Auto-context replaces discuss phase
- Human checkpoint at verification only
- Circuit breaker at 3 consecutive no-progress iterations

**If running semi-autonomous (human gates at each phase):**
- Same bash outer loop but with `pause_for_human` at phase boundaries
- Standard discuss phase (interactive) instead of auto-context
- This is essentially the existing `auto_advance` behavior, wrapped in an outer loop for cross-session continuity

**If running in CI/CD (future consideration):**
- Same bash outer loop
- `--output-format stream-json` for real-time progress monitoring
- Log output piped to CI artifact storage
- Human checkpoints become PR review gates instead of CLI pauses

## Version Compatibility

| Component | Compatible With | Notes |
|---|---|---|
| `gsd-tools.cjs` (existing) | Node.js >=16.7.0 | Already tested. New subcommands use same CJS module pattern. |
| Claude Code CLI `-p` flag | Claude Code v2.0+ | Headless mode. Available since mid-2025. |
| Claude Code `--agent` flag | Claude Code v2.0.59+ | Runs custom agent as main thread. Newer feature but stable. |
| Claude Code `--output-format json` | Claude Code v2.0+ | Structured output for bash parsing. |
| Claude Code `--allowedTools` | Claude Code v2.0+ | Fine-grained tool control per invocation. |
| jq 1.6+ | bash 4.0+ | Standard on all modern Linux/macOS. Homebrew/apt installable. |
| bash 5.x | All modern systems | bash 4.x works too; 5.x preferred for associative arrays if needed. |

## Key CLI Invocation Pattern

The core invocation that the bash outer loop uses:

```bash
claude -p "$(cat <<'PROMPT'
<objective>
Execute phase ${PHASE_NUM} ${STEP} for the GSD autopilot.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autopilot.md
</execution_context>

<context>
Phase: ${PHASE_NUM}
Step: ${STEP}
Mode: autonomous
</context>

<files_to_read>
- .planning/STATE.md
- .planning/ROADMAP.md
- .planning/PROJECT.md
- .planning/config.json
</files_to_read>
PROMPT
)" \
  --output-format json \
  --dangerously-skip-permissions \
  --allowedTools "Task,Read,Write,Edit,Bash,Grep,Glob,WebSearch,WebFetch"
```

This pattern:
- Uses `-p` for headless (non-interactive) execution
- Passes the autopilot workflow as `@` reference for the agent to read
- Provides state files for the agent to load on startup
- Returns JSON for the bash loop to parse
- Grants all tools needed for GSD operations

## Sources

- [Claude Code subagent documentation](https://code.claude.com/docs/en/sub-agents) -- Verified subagent capabilities, `--agent` flag, model parameter, tool restrictions, permission modes. HIGH confidence.
- [Claude Code best practices](https://www.anthropic.com/engineering/claude-code-best-practices) -- Confirmed headless mode, `-p` flag, `--output-format json`. HIGH confidence.
- [Ralph Loop (snarktank/ralph)](https://github.com/snarktank/ralph) -- Verified outer loop pattern: fresh context per iteration, state in filesystem, PRD-based completion detection. HIGH confidence.
- [Ralph Claude Code fork (frankbria)](https://github.com/frankbria/ralph-claude-code) -- Verified Claude Code-specific implementation: `--resume` for session continuity, `--allowedTools` for permission control, JSON output parsing, circuit breaker pattern. HIGH confidence.
- [The Ralph Loop: Context as Resource](https://www.ikangai.com/the-ralph-loop-how-a-bash-script-is-forcing-developers-to-rethink-context-as-a-resource/) -- Confirmed architectural rationale: fresh windows avoid context rot, filesystem is the memory layer. MEDIUM confidence (blog analysis, not primary source).
- [Claude Code `--resume` bug (GitHub #3138)](https://github.com/anthropics/claude-code/issues/3138) -- Confirmed `--resume` fails after context/usage limits. Justifies fresh invocation approach. HIGH confidence (official issue tracker).
- [Task tool renamed to Agent (Claude Code docs)](https://code.claude.com/docs/en/sub-agents) -- "In version 2.1.63, the Task tool was renamed to Agent." GSD still uses Task syntax, which works as alias. MEDIUM confidence (docs note, untested in this codebase).
- GSD codebase direct inspection -- commands/gsd/*.md, get-shit-done/workflows/*.md, agents/*.md, get-shit-done/bin/lib/*.cjs. HIGH confidence.

---
*Stack research for: GSD Autopilot -- Autonomous Phase-Loop Orchestrator*
*Researched: 2026-03-01*
