# GSD User Guide

A detailed reference for workflows, troubleshooting, and configuration. For quick-start setup, see the [README](../README.md).

---

## Table of Contents

- [Workflow Diagrams](#workflow-diagrams)
- [Test Architecture](#test-architecture)
- [UI Testing (Playwright)](#ui-testing-playwright)
- [Automated UAT](#automated-uat)
- [Command Reference](#command-reference)
- [Configuration Reference](#configuration-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Recovery Quick Reference](#recovery-quick-reference)
- [CLI Reference](CLI.md)

---

## Workflow Diagrams

### Full Project Lifecycle

```
  ┌──────────────────────────────────────────────────┐
  │                   NEW PROJECT                    │
  │  /gsd:new-project                                │
  │  Questions -> Research -> Requirements -> Roadmap│
  └─────────────────────────┬────────────────────────┘
                            │
             ┌──────────────▼─────────────┐
             │      FOR EACH PHASE:       │
             │                            │
             │  ┌────────────────────┐    │
             │  │ /gsd:discuss-phase │    │  <- Lock in preferences
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd:plan-phase    │    │  <- Research + Plan + Verify
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd:execute-phase │    │  <- Parallel execution
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd:verify-work   │    │  <- Manual UAT
             │  └──────────┬─────────┘    │
             │             │              │
             │     Next Phase?────────────┘
             │             │ No
             └─────────────┼──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  /gsd:audit-milestone        │
            │  /gsd:complete-milestone     │
            └───────────────┬──────────────┘
                            │
                   Another milestone?
                       │          │
                      Yes         No -> Done!
                       │
               ┌───────▼──────────────┐
               │  /gsd:new-milestone  │
               └──────────────────────┘
```

### Planning Agent Coordination

```
  /gsd:plan-phase N
         │
         ├── Phase Researcher (x4 parallel)
         │     ├── Stack researcher
         │     ├── Features researcher
         │     ├── Architecture researcher
         │     └── Pitfalls researcher
         │           │
         │     ┌──────▼──────┐
         │     │ RESEARCH.md │
         │     └──────┬──────┘
         │            │
         │     ┌──────▼──────┐
         │     │   Planner   │  <- Reads PROJECT.md, REQUIREMENTS.md,
         │     │             │     CONTEXT.md, RESEARCH.md
         │     └──────┬──────┘
         │            │
         │     ┌──────▼───────────┐     ┌────────┐
         │     │   Plan Checker   │────>│ PASS?  │
         │     └──────────────────┘     └───┬────┘
         │                                  │
         │                             Yes  │  No
         │                              │   │   │
         │                              │   └───┘  (loop, up to 3x)
         │                              │
         │                        ┌─────▼──────┐
         │                        │ PLAN files │
         │                        └────────────┘
         └── Done
```

### Validation Architecture (Nyquist Layer)

During plan-phase research, GSD now maps automated test coverage to each phase
requirement before any code is written. This ensures that when Claude's executor
commits a task, a feedback mechanism already exists to verify it within seconds.

The researcher detects your existing test infrastructure, maps each requirement to
a specific test command, and identifies any test scaffolding that must be created
before implementation begins (Wave 0 tasks).

The plan-checker enforces this as an 8th verification dimension: plans where tasks
lack automated verify commands will not be approved.

**Output:** `{phase}-VALIDATION.md` -- the feedback contract for the phase.

**Disable:** Set `workflow.nyquist_validation: false` in `/gsd:settings` for
rapid prototyping phases where test infrastructure isn't the focus.

### Execution Wave Coordination

```
  /gsd:execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── Verifier
               └── Check codebase against phase goals
                     │
                     ├── PASS -> VERIFICATION.md (success)
                     └── FAIL -> Issues logged for /gsd:verify-work
```

### Brownfield Workflow (Existing Codebase)

```
  /gsd:map-codebase
         │
         ├── Stack Mapper     -> codebase/STACK.md
         ├── Arch Mapper      -> codebase/ARCHITECTURE.md
         ├── Convention Mapper -> codebase/CONVENTIONS.md
         └── Concern Mapper   -> codebase/CONCERNS.md
                │
        ┌───────▼──────────┐
        │ /gsd:new-project │  <- Questions focus on what you're ADDING
        └──────────────────┘
```

---

## Test Architecture

GSD implements a dual-layer testing model that combines human-defined acceptance criteria with AI-generated unit and regression tests. All test features work with zero configuration -- omit the `test` section from `config.json` to use defaults.

### Dual-Layer Model

**Layer 1: Acceptance Tests (Human-Defined)**

During `/gsd:discuss-phase`, the system prompts you to define acceptance tests for each requirement. These use the Given/When/Then/Verify format:

```
AT-01: User registration creates account
  Given: A new email address
  When: POST /api/auth/register with valid credentials
  Then: 201 response with user object
  Verify: curl -X POST localhost:3000/api/auth/register -d '{"email":"test@example.com","password":"valid123"}' returns 201
```

Acceptance tests are stored in the `<acceptance_tests>` block of CONTEXT.md with AT-{NN} identifiers. The AI cannot add, remove, or modify them after discuss-phase approval -- they are human-owned.

**Layer 2: Unit/Regression Tests (AI-Generated)**

During planning, the planner creates test specifications in PLAN.md tasks. During execution, the executor writes and runs tests as part of implementation. These tests are verified by the hard gate after each commit.

### Hard Gate

The hard gate runs the full test suite after every task commit during `/gsd:execute-phase`. It prevents regressions from accumulating across tasks.

**How it works:**

1. Before execution begins, the gate captures a baseline of existing test results
2. After each task commit, the full test suite runs automatically
3. If any NEW test fails (compared to baseline), the executor follows deviation Rule 1: debug, fix, retry
4. If retries are exhausted, the issue escalates to human review
5. Pre-existing failures do not block -- only new failures trigger the gate

**TDD Awareness:**

The gate recognizes TDD RED commits (intentional test failures as part of test-driven development). When the executor commits a test before its implementation, the gate skips regression checking for that commit, allowing the RED-GREEN-REFACTOR cycle to proceed normally.

**Output Summarization:**

Test output shown to the executor is condensed to pass/fail counts and failure details only. Raw test output is not passed through, preventing context window bloat in long execution sessions.

### Test Steward

The test steward (`gsd-test-steward` agent) monitors long-term test suite health. It runs during `/gsd:audit-milestone` and can be invoked on-demand with `/gsd:audit-tests`.

**What it analyzes:**

- **Redundancy** -- Duplicate assertions, overlapping test coverage
- **Staleness** -- Tests referencing deleted or renamed code
- **Budget status** -- Per-phase and project-wide test counts against configured limits

**Consolidation proposals:**

The steward produces specific recommendations (parameterize, promote, prune, merge) that require human approval. It never modifies test files directly.

### Budget Management

Test budgets prevent unbounded test suite growth. Budgets are informational -- overruns produce warnings, not blockers.

| Budget | Default | Scope | Warning Threshold |
|--------|---------|-------|-------------------|
| Per-phase | 50 tests | Tests within a single phase directory | 80% (40 tests) |
| Project | 800 tests | All tests in the project | 80% (640 tests) |

During `/gsd:plan-phase`, the planner receives current budget status and generates test plans within the remaining allocation. Budget overruns are surfaced during plan-phase and milestone audit.

### Test Workflow

```
  /gsd:discuss-phase
         |
         +-- Layer 1: Gather acceptance tests (AT-01, AT-02, ...)
         |   Stored in CONTEXT.md <acceptance_tests> block
         |
  /gsd:plan-phase
         |
         +-- Planner receives test budget status
         +-- Plan-checker verifies plans cover all acceptance tests
         |
  /gsd:execute-phase
         |
         +-- Layer 2: Executor writes unit/regression tests per task
         +-- Hard gate runs full suite after each commit
         |     +-- NEW failure? -> debug/fix/retry
         |     +-- TDD RED commit? -> skip gate for this commit
         |
  /gsd:verify-phase
         |
         +-- Acceptance test Verify commands executed
         +-- Results mapped to verification truths
         |
  /gsd:audit-milestone
         |
         +-- Test steward analyzes suite health
         +-- Redundancy, staleness, budget report
         +-- Consolidation proposals (human approval required)
```

---

## UI Testing (Playwright)

GSD can generate and run Playwright E2E tests against your running application using the `gsd-playwright` agent. Tests are derived from the acceptance criteria in your phase's CONTEXT.md.

### The `/gsd:ui-test` Command

Generate and execute Playwright E2E tests for a phase:

```
/gsd:ui-test [phase] [url]
```

| Flag | Effect |
|------|--------|
| `--scaffold` | Force Playwright scaffolding even if already configured |
| `--run-only` | Skip test generation, run existing tests only |
| `--headed` | Run tests in a visible browser window |

`--scaffold` and `--run-only` are mutually exclusive.

### How It Works

1. **Detect** -- Checks if Playwright is installed and configured in your project
2. **Scaffold** -- If not configured, installs `@playwright/test`, creates `playwright.config.ts`, an `e2e/` directory with a smoke test, and installs Chromium
3. **Generate** -- Reads acceptance tests from CONTEXT.md and maps Given/When/Then/Verify blocks to `.spec.ts` files in `e2e/`
4. **Execute** -- Runs `npx playwright test` and parses results
5. **Report** -- Categorizes failures as application-level (server not running) or test-level (assertion mismatch), and includes screenshot and trace paths for debugging

### Integration with `/gsd:add-tests`

When you run `/gsd:add-tests [phase]`, GSD classifies implementation files into unit test and E2E test categories. If Playwright is detected (or scaffolded), E2E tests are generated alongside unit tests using the same `gsd-playwright` agent.

### Example Usage

```
# Generate and run E2E tests for phase 71
/gsd:ui-test 71 http://localhost:3000

# Scaffold Playwright even if already detected
/gsd:ui-test --scaffold

# Run existing tests only (skip generation)
/gsd:ui-test --run-only

# Run in visible browser mode
/gsd:ui-test --headed
```

---

## Automated UAT

GSD can run automated User Acceptance Testing against web applications using Chrome MCP (primary) or Playwright headless (fallback). The `/gsd:uat-auto` command executes UAT tests autonomously, producing a MILESTONE-UAT.md report with pass/fail results and evidence screenshots. In the autopilot pipeline, automated UAT runs after milestone audit passes and before milestone completion.

### Workflow

```
  /gsd:uat-auto
         |
         +-- Load uat-config.yaml
         |     (skip silently if missing -- non-web projects)
         |
         +-- Discover tests
         |     +-- Scan phases for *-UAT.md (status: complete)
         |     +-- Fallback: generate scenarios from SUMMARY.md files
         |
         +-- Detect browser engine
         |     +-- Chrome MCP probe (full round-trip)
         |     +-- Fallback: Playwright headless Chromium
         |
         +-- Start app (if not running)
         |     +-- Fetch base_url to check
         |     +-- Run startup_command if needed
         |     +-- Wait startup_wait_seconds
         |
         +-- Execute tests
         |     +-- Navigate, interact, screenshot, judge pass/fail
         |     +-- Save evidence to .planning/uat-evidence/{milestone}/
         |
         +-- Write MILESTONE-UAT.md
         |     +-- YAML frontmatter (status, counts, browser, timestamps)
         |     +-- Results table with pass/fail per test
         |     +-- Gaps section for failures (truth, status, reason, severity)
         |
         +-- Commit results to git
```

### Configuration

Automated UAT is configured via `uat-config.yaml` in your project root. If this file does not exist, UAT is skipped silently (non-web projects proceed to milestone completion without UAT).

```yaml
# uat-config.yaml
base_url: http://localhost:3000
startup_command: npm run dev
startup_wait_seconds: 10
browser: chrome-mcp
fallback_browser: playwright
timeout_minutes: 10
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `base_url` | string | Yes | -- | URL of the application to test |
| `startup_command` | string | No | -- | Command to start the dev server |
| `startup_wait_seconds` | integer | No | `10` | Seconds to wait after starting the server |
| `browser` | string | No | `chrome-mcp` | Primary browser engine |
| `fallback_browser` | string | No | `playwright` | Fallback browser engine when primary is unavailable |
| `timeout_minutes` | integer | No | `10` | Maximum session duration in minutes |

### Test Discovery

The UAT workflow discovers tests from two sources:

1. **UAT.md files** -- Scans phase directories for `*-UAT.md` files with `status: complete` in their frontmatter. These are tests created by `/gsd:verify-work` during manual UAT.

2. **SUMMARY.md fallback** -- When no UAT.md files exist, the workflow generates test scenarios from SUMMARY.md files across milestone phases. Each summary's deliverables become test scenarios.

### Browser Engines

**Chrome MCP (Primary)**

Uses Chrome MCP tools to interact with a real browser instance:
- `chrome_navigate` -- Navigate to pages
- `chrome_click_element`, `chrome_fill_or_select`, `chrome_keyboard` -- Interact with elements
- `chrome_screenshot` -- Capture visual evidence
- `chrome_get_web_content` -- Read DOM content for pass/fail judgment

Chrome MCP availability is verified via a full round-trip probe (not just checking if tools exist). If the probe fails, the workflow automatically falls back to Playwright.

**Playwright (Fallback)**

When Chrome MCP is unavailable:
- Generates ephemeral inline Playwright scripts per test (no persistent `.spec.ts` files)
- Runs in headless Chromium mode
- Checks Chromium binary availability and installs if missing (`npx playwright install chromium`)
- Produces identical output format (screenshots, results) to Chrome MCP mode

### Pipeline Integration

In the autopilot pipeline, automated UAT is wired into the milestone completion flow:

```
  Milestone audit passes
         |
         +-- runAutomatedUAT()
         |     +-- Check uat-config.yaml exists
         |     +-- Spawn /gsd:uat-auto workflow
         |     +-- Read MILESTONE-UAT.md status
         |
         +-- Route by result
               |
               +-- All tests pass --> runMilestoneCompletion()
               +-- Gaps found --> runGapClosureLoop()
               +-- Crash --> debug retry mechanism
```

UAT failures feed into the same gap closure loop used by milestone audit. The gap planner recognizes MILESTONE-UAT.md as a gap source alongside MILESTONE-AUDIT.md, so UAT gaps are automatically planned and fixed.

### Example Usage

```
# Run automated UAT session
/gsd:uat-auto
```

The command requires no arguments. It reads configuration from `uat-config.yaml` and runs fully autonomously. In most cases, you will not invoke this command directly -- the autopilot runs it automatically after milestone audit.

---

## Command Reference

### Core Workflow

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:new-project` | Full project init: questions, research, requirements, roadmap | Start of a new project |
| `/gsd:new-project --auto @idea.md` | Automated init from document | Have a PRD or idea doc ready |
| `/gsd:discuss-phase [N]` | Capture implementation decisions | Before planning, to shape how it gets built |
| `/gsd:plan-phase [N]` | Research + plan + verify | Before executing a phase |
| `/gsd:execute-phase <N>` | Execute all plans in parallel waves | After planning is complete |
| `/gsd:verify-work [N]` | Manual UAT with auto-diagnosis | After execution completes |
| `/gsd:audit-milestone` | Verify milestone met its definition of done | Before completing milestone |
| `/gsd:complete-milestone` | Archive milestone | All phases verified |
| `/gsd:new-milestone [name]` | Start next version cycle | After completing a milestone |

### Navigation

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:progress` | Show status and next steps | Anytime -- "where am I?" |
| `/gsd:resume-work` | Restore full context from last session | Starting a new session |
| `/gsd:pause-work` | Save context handoff | Stopping mid-phase |
| `/gsd:help` | Show all commands | Quick reference |
| `/gsd:update` | Update GSD with changelog preview | Check for new versions |
| `/gsd:join-discord` | Open Discord community invite | Questions or community |

### Phase Management

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:add-phase` | Append new phase to roadmap | Scope grows after initial planning |
| `/gsd:insert-phase [N]` | Insert urgent work (decimal numbering) | Urgent fix mid-milestone |
| `/gsd:remove-phase [N]` | Remove future phase and renumber | Descoping a feature |
| `/gsd:list-phase-assumptions [N]` | Preview Claude's intended approach | Before planning, to validate direction |
| `/gsd:plan-milestone-gaps` | Create phases for audit gaps | After audit finds missing items |
| `/gsd:research-phase [N]` | Deep ecosystem research only | Complex or unfamiliar domain |

### Brownfield & Utilities

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/gsd:map-codebase` | Analyze existing codebase | Before `/gsd:new-project` on existing code |
| `/gsd:quick` | Ad-hoc task with GSD guarantees | Bug fixes, small features, config changes |
| `/gsd:debug [desc]` | Systematic debugging with persistent state | When something breaks |
| `/gsd:add-todo [desc]` | Capture an idea for later | Think of something during a session |
| `/gsd:check-todos` | List pending todos | Review captured ideas |
| `/gsd:settings` | Configure workflow toggles and model profile | Change model, toggle agents |
| `/gsd:set-profile <profile>` | Quick profile switch | Change cost/quality tradeoff |
| `/gsd:reapply-patches` | Restore local modifications after update | After `/gsd:update` if you had local edits |
| `/gsd:linear <issue-id> [flags]` | Route Linear issue to quick task or milestone | Have a Linear issue to implement |
| `/gsd:brainstorm [topic]` | Collaborative brainstorming that produces a design doc and routes into milestone/project creation | Want to explore an idea before committing to implementation |
| `/gsd:ui-test [phase] [url]` | Generate and run Playwright E2E tests | After UI is deployed or running locally |
| `/gsd:uat-auto` | Run automated UAT session (Chrome MCP + Playwright fallback) | After milestone audit, or on-demand for web projects |
| `/gsd:add-tests [phase]` | Add unit and E2E tests to a phase | After execution, to boost test coverage |
| `/gsd:pr-review [flags] [aspects...]` | Route PR review findings to quick task or milestone | Have PR review feedback to act on |
| `/gsd:test-review [--report-only]` | Analyze diff for test coverage gaps and route findings | After code changes, to check test health |

---

## Configuration Reference

GSD stores project settings in `.planning/config.json`. Configure during `/gsd:new-project` or update later with `/gsd:settings`.

### Full config.json Schema

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_profile": "balanced",
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  },
  "test": {
    "hard_gate": true,
    "acceptance_tests": true,
    "budget": {
      "per_phase": 50,
      "project": 800
    },
    "steward": true
  }
}
```

### Core Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `mode` | `interactive`, `yolo` | `interactive` | `yolo` auto-approves decisions; `interactive` confirms at each step |
| `depth` | `quick`, `standard`, `comprehensive` | `standard` | Planning thoroughness: 3-5, 5-8, or 8-12 phases |
| `model_profile` | `quality`, `balanced`, `budget` | `balanced` | Model tier for each agent (see table below) |

### Planning Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `planning.commit_docs` | `true`, `false` | `true` | Whether `.planning/` files are committed to git |
| `planning.search_gitignored` | `true`, `false` | `false` | Add `--no-ignore` to broad searches to include `.planning/` |

> **Note:** If `.planning/` is in `.gitignore`, `commit_docs` is automatically `false` regardless of the config value.

### Workflow Toggles

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `workflow.research` | `true`, `false` | `true` | Domain investigation before planning |
| `workflow.plan_check` | `true`, `false` | `true` | Plan verification loop (up to 3 iterations) |
| `workflow.verifier` | `true`, `false` | `true` | Post-execution verification against phase goals |
| `workflow.nyquist_validation` | `true`, `false` | `true` | Validation architecture research during plan-phase; 8th plan-check dimension |

Disable these to speed up phases in familiar domains or when conserving tokens.

### Test Settings

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `test.hard_gate` | `true`, `false` | `true` | Run full test suite after each task commit during execution |
| `test.acceptance_tests` | `true`, `false` | `true` | Prompt for acceptance tests during discuss-phase |
| `test.budget.per_phase` | integer | `50` | Per-phase test count limit (warnings at 80%) |
| `test.budget.project` | integer | `800` | Project-wide test count limit (warnings at 80%) |
| `test.steward` | `true`, `false` | `true` | Enable test steward during audit-milestone |
| `test.command` | string | auto-detected | Override test runner command (e.g., `npm test`) |
| `test.framework` | string | auto-detected | Override framework detection (jest, vitest, mocha, node:test) |

All test settings use zero-config defaults. The `test.command` and `test.framework` values are auto-detected from `package.json` and project files -- set them only to override detection.

### Git Branching

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | When and how branches are created |
| `git.phase_branch_template` | Template string | `gsd/phase-{phase}-{slug}` | Branch name for phase strategy |
| `git.milestone_branch_template` | Template string | `gsd/{milestone}-{slug}` | Branch name for milestone strategy |

**Branching strategies explained:**

| Strategy | Creates Branch | Scope | Best For |
|----------|---------------|-------|----------|
| `none` | Never | N/A | Solo development, simple projects |
| `phase` | At each `execute-phase` | One phase per branch | Code review per phase, granular rollback |
| `milestone` | At first `execute-phase` | All phases share one branch | Release branches, PR per version |

**Template variables:** `{phase}` = zero-padded number (e.g., "03"), `{slug}` = lowercase hyphenated name, `{milestone}` = version (e.g., "v1.0").

### Model Profiles (Per-Agent Breakdown)

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| gsd-planner | Opus | Opus | Sonnet |
| gsd-roadmapper | Opus | Sonnet | Sonnet |
| gsd-executor | Opus | Sonnet | Sonnet |
| gsd-phase-researcher | Opus | Sonnet | Haiku |
| gsd-project-researcher | Opus | Sonnet | Haiku |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku |
| gsd-debugger | Opus | Sonnet | Sonnet |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku |
| gsd-verifier | Sonnet | Sonnet | Haiku |
| gsd-plan-checker | Sonnet | Sonnet | Haiku |
| gsd-integration-checker | Sonnet | Sonnet | Haiku |
| gsd-test-steward | Sonnet | Sonnet | Haiku |
| gsd-playwright | Sonnet | Sonnet | Haiku |

**Profile philosophy:**
- **quality** -- Opus for all decision-making agents, Sonnet for read-only verification. Use when quota is available and the work is critical.
- **balanced** -- Opus only for planning (where architecture decisions happen), Sonnet for everything else. The default for good reason.
- **budget** -- Sonnet for anything that writes code, Haiku for research and verification. Use for high-volume work or less critical phases.

---

## Usage Examples

### New Project (Full Cycle)

```bash
claude --dangerously-skip-permissions
/gsd:new-project            # Answer questions, configure, approve roadmap
/clear
/gsd:discuss-phase 1        # Lock in your preferences
/gsd:plan-phase 1           # Research + plan + verify
/gsd:execute-phase 1        # Parallel execution
/gsd:verify-work 1          # Manual UAT
/clear
/gsd:discuss-phase 2        # Repeat for each phase
...
/gsd:audit-milestone        # Check everything shipped
/gsd:complete-milestone     # Archive and done
```

### New Project from Existing Document

```bash
/gsd:new-project --auto @prd.md   # Auto-runs research/requirements/roadmap from your doc
/clear
/gsd:discuss-phase 1               # Normal flow from here
```

### Existing Codebase

```bash
/gsd:map-codebase           # Analyze what exists (parallel agents)
/gsd:new-project            # Questions focus on what you're ADDING
# (normal phase workflow from here)
```

### Quick Bug Fix

```bash
/gsd:quick
> "Fix the login button not responding on mobile Safari"
```

### Resuming After a Break

```bash
/gsd:progress               # See where you left off and what's next
# or
/gsd:resume-work            # Full context restoration from last session
```

### Preparing for Release

```bash
/gsd:audit-milestone        # Check requirements coverage, detect stubs
/gsd:plan-milestone-gaps    # If audit found gaps, create phases to close them
/gsd:complete-milestone     # Archive and done
```

### Speed vs Quality Presets

| Scenario | Mode | Depth | Profile | Research | Plan Check | Verifier |
|----------|------|-------|---------|----------|------------|----------|
| Prototyping | `yolo` | `quick` | `budget` | off | off | off |
| Normal dev | `interactive` | `standard` | `balanced` | on | on | on |
| Production | `interactive` | `comprehensive` | `quality` | on | on | on |

### Mid-Milestone Scope Changes

```bash
/gsd:add-phase              # Append a new phase to the roadmap
# or
/gsd:insert-phase 3         # Insert urgent work between phases 3 and 4
# or
/gsd:remove-phase 7         # Descope phase 7 and renumber
```

### Linear Integration

Route Linear issues directly to GSD workflows. Requires the Linear MCP plugin.

#### Flags

| Flag | Effect |
|------|--------|
| *(none)* | Auto-route based on complexity scoring |
| `--quick` | Force quick task route (skip scoring) |
| `--milestone` | Force milestone route (skip scoring) |
| `--full` | Add plan-checking and verification to quick route |

#### Routing Heuristic

When no flag is provided, GSD scores the issue on six factors: multiple issues (+3), sub-issues (+2), long description (+1), feature/epic labels (+2), bug/fix/chore/docs labels (-1), and relations (+1). Score >= 3 routes to milestone; < 3 routes to quick task.

#### Examples

```bash
# Route a single bug fix (likely scores as quick)
/gsd:linear BUG-42

# Route a feature epic (likely scores as milestone)
/gsd:linear FEAT-100

# Force quick task regardless of complexity
/gsd:linear FEAT-100 --quick

# Force milestone regardless of simplicity
/gsd:linear BUG-42 --milestone

# Multiple issues (auto-routes to milestone, score +3)
/gsd:linear FEAT-100 FEAT-101 FEAT-102

# Quick task with plan-checking and verification
/gsd:linear BUG-42 --full
```

After completion, GSD posts a summary comment back to each Linear issue with the task result or milestone details.

### Brainstorming

```bash
# Start a brainstorming session
/gsd:brainstorm

# Seed with a specific topic
/gsd:brainstorm "add webhook support"
```

**Flow:** The brainstorm command explores your codebase, asks clarifying questions, proposes approaches, and builds a design document section by section. After approval, it offers to create a milestone or project from the design.

### PR Review

Route PR review findings into GSD workflows. Runs a fresh review or ingests an existing one, deduplicates findings by file proximity, scores for complexity, and routes to a quick task or milestone.

#### Pipeline

```
  /gsd:pr-review
         |
         +-- Capture (fresh toolkit review or --ingest paste)
         |
         +-- Parse findings (severity, file, line, fix suggestion)
         |
         +-- Deduplicate by file proximity (20-line threshold)
         |     Group overlapping findings transitively
         |
         +-- Score: +2 critical, +1 important, +1 per 5 files
         |
         +-- Route
               |
               +-- Score < 5 --> Quick task (one task per file-region group)
               +-- Score >= 5 --> New milestone
```

#### Flags

| Flag | Effect |
|------|--------|
| *(none)* | Run fresh review, auto-route based on scoring |
| `--ingest` | Paste a pre-existing review summary instead of running fresh |
| `--quick` | Force quick task route (skip scoring) |
| `--milestone` | Force milestone route (skip scoring) |
| `--full` | Add plan-checking and verification to quick route |

#### Routing Heuristic

When no flag override is provided, GSD scores findings: +2 per critical, +1 per important, +1 per 5 distinct files touched. Score >= 5 routes to a new milestone; < 5 routes to a quick task with one task per file-region group.

#### Examples

```
# Run a fresh PR review with auto-routing
/gsd:pr-review

# Paste an existing review summary
/gsd:pr-review --ingest

# Force quick task route regardless of score
/gsd:pr-review --quick

# Force milestone route regardless of score
/gsd:pr-review --milestone

# Focus review on specific aspects
/gsd:pr-review security performance

# Quick task with plan-checking and verification
/gsd:pr-review --full
```

After completion, GSD displays a banner with route taken, report path, and artifacts created. The permanent review report at `.planning/reviews/YYYY-MM-DD-pr-review.md` serves as an audit trail.

### Test Review

Analyze your branch diff for test coverage gaps, stale tests, and consolidation opportunities. Unlike PR review (which auto-scores and routes), test review lets you choose how to handle findings.

#### Pipeline

```
  /gsd:test-review
         |
         +-- Gather diff vs main (summarized if >2000 lines)
         |
         +-- Spawn gsd-test-reviewer agent
         |     Map changed files to tests, detect gaps
         |
         +-- Write report to .planning/reviews/
         |
         +-- Route (user choice)
               |
               +-- Quick task --> fix findings now
               +-- Milestone --> comprehensive test improvement
               +-- Done --> keep report, no action
```

#### Flags

| Flag | Effect |
|------|--------|
| *(none)* | Full analysis with user-choice routing |
| `--report-only` | Write report and exit, skip routing |

#### Examples

```
# Run test review with routing options
/gsd:test-review

# Generate report only, no routing
/gsd:test-review --report-only
```

After completion, GSD displays a banner with route taken (if any), report path, and artifacts created. The permanent report at `.planning/reviews/YYYY-MM-DD-test-review.md` serves as an audit trail.

### Automated UAT

Run automated UAT against a web application. Requires `uat-config.yaml` in your project root.

```
# Run automated UAT session
/gsd:uat-auto
```

**Flow:** The command loads `uat-config.yaml`, discovers tests from UAT.md files (or generates scenarios from SUMMARY.md), detects the browser engine (Chrome MCP with Playwright fallback), starts the dev server if needed, executes tests, and writes results to MILESTONE-UAT.md with evidence screenshots. In the autopilot pipeline, this runs automatically after milestone audit passes.

---

## Troubleshooting

### "Project already initialized"

You ran `/gsd:new-project` but `.planning/PROJECT.md` already exists. This is a safety check. If you want to start over, delete the `.planning/` directory first.

### Context Degradation During Long Sessions

Clear your context window between major commands: `/clear` in Claude Code. GSD is designed around fresh contexts -- every subagent gets a clean 200K window. If quality is dropping in the main session, clear and use `/gsd:resume-work` or `/gsd:progress` to restore state.

### Plans Seem Wrong or Misaligned

Run `/gsd:discuss-phase [N]` before planning. Most plan quality issues come from Claude making assumptions that `CONTEXT.md` would have prevented. You can also run `/gsd:list-phase-assumptions [N]` to see what Claude intends to do before committing to a plan.

### Execution Fails or Produces Stubs

Check that the plan was not too ambitious. Plans should have 2-3 tasks maximum. If tasks are too large, they exceed what a single context window can produce reliably. Re-plan with smaller scope.

### Lost Track of Where You Are

Run `/gsd:progress`. It reads all state files and tells you exactly where you are and what to do next.

### Need to Change Something After Execution

Do not re-run `/gsd:execute-phase`. Use `/gsd:quick` for targeted fixes, or `/gsd:verify-work` to systematically identify and fix issues through UAT.

### Model Costs Too High

Switch to budget profile: `/gsd:set-profile budget`. Disable research and plan-check agents via `/gsd:settings` if the domain is familiar to you (or to Claude).

### Working on a Sensitive/Private Project

Set `commit_docs: false` during `/gsd:new-project` or via `/gsd:settings`. Add `.planning/` to your `.gitignore`. Planning artifacts stay local and never touch git.

### GSD Update Overwrote My Local Changes

Since v1.17, the installer backs up locally modified files to `gsd-local-patches/`. Run `/gsd:reapply-patches` to merge your changes back.

### Tests Fail After Every Commit During Execution

The hard gate runs the full test suite after each task commit. If tests fail:

1. The executor automatically attempts to debug and fix (deviation Rule 1)
2. If retries are exhausted, it escalates to human review
3. If the failures are pre-existing (not caused by the current task), they should not trigger the gate -- check that baseline capture is working by reviewing the executor output

To disable the hard gate temporarily: `gsd settings set test.hard_gate false`

### Test Budget Warnings During Planning

Budget warnings appear when test count approaches the configured limit. These are informational -- they do not block planning or execution.

- Per-phase default: 50 tests (warning at 40)
- Project default: 800 tests (warning at 640)

Adjust limits: `gsd settings set test.budget.per_phase 100` or `gsd settings set test.budget.project 1500`

### Acceptance Tests Not Gathered During Discuss-Phase

Acceptance test gathering only happens in interactive mode (not autopilot/auto-context). If you used `--auto` with discuss-phase, acceptance tests are skipped.

To disable acceptance test gathering entirely: `gsd settings set test.acceptance_tests false`

### E2E Tests Fail with Connection Refused

Make sure your dev server is running before running `/gsd:ui-test`. Playwright tests need a live server at the URL you provide.

### Automated UAT Skipped or Not Running

If `/gsd:uat-auto` is skipped silently, check that `uat-config.yaml` exists in your project root. Non-web projects (those without `uat-config.yaml`) skip UAT automatically. If Chrome MCP is unavailable, the workflow falls back to Playwright -- ensure Playwright is installed (`npx playwright install chromium`) if you need the fallback.

### Subagent Appears to Fail but Work Was Done

A known workaround exists for a Claude Code classification bug. GSD's orchestrators (execute-phase, quick) spot-check actual output before reporting failure. If you see a failure message but commits were made, check `git log` -- the work may have succeeded.

---

## Recovery Quick Reference

| Problem | Solution |
|---------|----------|
| Lost context / new session | `/gsd:resume-work` or `/gsd:progress` |
| Phase went wrong | `git revert` the phase commits, then re-plan |
| Need to change scope | `/gsd:add-phase`, `/gsd:insert-phase`, or `/gsd:remove-phase` |
| Milestone audit found gaps | `/gsd:plan-milestone-gaps` |
| Something broke | `/gsd:debug "description"` |
| Quick targeted fix | `/gsd:quick` |
| Plan doesn't match your vision | `/gsd:discuss-phase [N]` then re-plan |
| Costs running high | `/gsd:set-profile budget` and `/gsd:settings` to toggle agents off |
| Update broke local changes | `/gsd:reapply-patches` |
| Tests blocking execution | `gsd settings set test.hard_gate false` to disable gate temporarily |
| Test budget warnings | `gsd settings set test.budget.per_phase N` to increase limit |
| Test suite health concerns | `/gsd:audit-tests` for on-demand health check |
| Need E2E test coverage | `/gsd:ui-test [phase] [url]` or `/gsd:add-tests [phase]` |
| Automated UAT not running | Check `uat-config.yaml` exists; non-web projects skip UAT silently |

---

## Project File Structure

For reference, here is what GSD creates in your project:

```
.planning/
  PROJECT.md              # Project vision and context (always loaded)
  REQUIREMENTS.md         # Scoped v1/v2 requirements with IDs
  ROADMAP.md              # Phase breakdown with status tracking
  STATE.md                # Decisions, blockers, session memory
  config.json             # Workflow configuration
  MILESTONES.md           # Completed milestone archive
  research/               # Domain research from /gsd:new-project
  todos/
    pending/              # Captured ideas awaiting work
    done/                 # Completed todos
  debug/                  # Active debug sessions
    resolved/             # Archived debug sessions
  codebase/               # Brownfield codebase mapping (from /gsd:map-codebase)
  phases/
    XX-phase-name/
      XX-YY-PLAN.md       # Atomic execution plans
      XX-YY-SUMMARY.md    # Execution outcomes and decisions
      CONTEXT.md          # Your implementation preferences
      RESEARCH.md         # Ecosystem research findings
      VERIFICATION.md     # Post-execution verification results
```

---

## CLI Reference

The `gsd` standalone CLI provides commands for checking progress, managing todos, validating project health, and configuring settings from any terminal. See [CLI.md](CLI.md) for the full reference.
