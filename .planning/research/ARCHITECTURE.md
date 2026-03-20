# Architecture Research

**Domain:** Playwright UI Testing Integration into GSD Command/Workflow/Agent Architecture
**Researched:** 2026-03-19
**Confidence:** HIGH

## System Overview — Existing GSD Architecture

The GSD architecture has three tiers that interact in a strict pattern:

```
USER INVOCATION
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMMANDS  (commands/gsd/*.md)                         │
│  User-facing entry points. Parse arguments, load context via            │
│  gsd-tools.cjs init, then delegate to a workflow or agent directly.     │
│                                                                         │
│  /gsd:add-tests   /gsd:audit-tests   /gsd:linear   /gsd:pr-review      │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ delegates to (via @workflow or Task spawn)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   WORKFLOWS  (~/.claude/get-shit-done/workflows/*.md)    │
│  Multi-step logic with gates, decisions, and agent spawning.            │
│  NOT re-entrant from within agents (subagent cannot spawn subagent).    │
│                                                                         │
│  add-tests.md   linear.md   pr-review.md   execute-phase.md ...        │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ spawns via Task()
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AGENTS  (agents/*.md)                                │
│  Specialized task handlers. Read-only or narrowly scoped writes.        │
│  Cannot spawn subagents. Return structured results to caller.           │
│                                                                         │
│  gsd-test-steward   gsd-executor   gsd-planner   gsd-verifier ...      │
└─────────────────────────────────────────────────────────────────────────┘
                            │ all backed by
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              gsd-tools.cjs  +  bin/lib/*.cjs  MODULES                   │
│  Deterministic data: phase resolution, config, init bundles, state.     │
│  Consumed by commands and workflows via bash subprocess calls.          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Rules (must preserve for v2.7)

1. **Commands are orchestrators.** They parse args, call `gsd-tools.cjs init`, then delegate.
2. **Workflows contain multi-step logic.** They can spawn agents via `Task()` and have gates.
3. **Agents are leaf nodes.** A spawned agent cannot spawn another agent.
4. **Cross-session state lives in `.planning/` markdown.** No in-memory state survives between Claude sessions.
5. **`gsd-tools.cjs` is the data layer.** All deterministic data (phase lookup, config, model resolution) goes through it.

## New Components for v2.7

Three new components integrate with the existing architecture. Two are new files, one is a modification:

```
NEW                                          MODIFIED
─────────────────────────────────────────────────────────────────────────────
commands/gsd/ui-test.md    (NEW command)
agents/gsd-playwright.md   (NEW agent)
workflows/add-tests.md     (MODIFIED — existing workflow, enhanced E2E step)
─────────────────────────────────────────────────────────────────────────────
```

### Component Responsibilities

| Component | Type | Responsibility | New or Modified |
|-----------|------|----------------|-----------------|
| `commands/gsd/ui-test.md` | Command | User-facing entry point; parse args (phase, URL, flags), call `init phase-op`, delegate to `gsd-playwright` agent | NEW |
| `agents/gsd-playwright.md` | Agent | Detection, scaffolding, generation, execution, reporting for Playwright tests; returns structured result to caller | NEW |
| `workflows/add-tests.md` | Workflow | Add Playwright detection and scaffolding prompt to `execute_e2e_generation` step; spawn `gsd-playwright` for E2E files | MODIFIED |
| `bin/lib/testing.cjs` | Module | Playwright detection logic (config file presence, package.json deps); potentially add `detectPlaywright()` | MODIFIED (optional) |

## Recommended Architecture — v2.7 Integration

```
                    TWO ENTRY PATHS TO gsd-playwright AGENT
                    ──────────────────────────────────────────

PATH 1: Direct command (on-demand UI testing)

/gsd:ui-test <phase> [url] [--scaffold] [--run-only] [--headed]
    │
    ▼ parse args + gsd-tools init phase-op
    │
    ▼ Task(gsd-playwright, mode=ui-test, phase_dir, url, flags)
    │
    ▼ Playwright detection → scaffold if needed → generate → execute → report

PATH 2: Via add-tests workflow (test generation for a phase)

/gsd:add-tests <phase>
    │
    ▼ add-tests.md workflow: analyze_implementation → classify files
    │
    │ (files classified as E2E)
    ▼
    execute_e2e_generation step (MODIFIED):
        detect Playwright → prompt if not found → scaffold
        │
        ▼ Task(gsd-playwright, mode=generate, files[], phase_dir)
        │
        ▼ Generate .spec.ts → execute → RED-GREEN report
```

### New Component: /gsd:ui-test Command

Follows the same pattern as `/gsd:pr-review` and `/gsd:linear`:

```
1. Parse $ARGUMENTS:
   - Phase number (optional) → $PHASE_ARG
   - URL (optional) → $BASE_URL
   - --scaffold flag → $FORCE_SCAFFOLD
   - --run-only flag → $RUN_ONLY
   - --headed flag → $HEADED_MODE

2. Call gsd-tools init:
   INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")

3. Gather Playwright status:
   PW_STATUS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" playwright-detect)

4. Display banner:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► UI TEST — Phase ${phase_number}: ${phase_name}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. Spawn gsd-playwright agent via Task()
```

The command is a thin wrapper. All logic lives in the agent (consistent with `audit-tests.md` which is also a direct agent spawn with no separate workflow file).

### New Component: gsd-playwright Agent

The agent handles the full Playwright lifecycle in a single execution context. It follows the same read-then-act structure as `gsd-test-steward`:

```
INPUT RECEIVED (from Task() call):
  mode: 'ui-test' | 'generate' | 'run-only'
  phase_dir: string | null
  base_url: string | null
  e2e_files: string[] | null  (mode=generate only, from add-tests)
  flags: { scaffold, run_only, headed }

STEP 1: Playwright Detection (three-tier)
  Tier 1: playwright.config.ts exists → configured
  Tier 2: @playwright/test in package.json deps → installed, not configured
  Tier 3: neither → not present

STEP 2: Scaffolding (if not configured and not --run-only)
  Create playwright.config.ts (Chromium-only, baseURL from input or prompt)
  Create tests/e2e/ directory
  Create tests/e2e/example.spec.ts (hello-world smoke test)
  Add tests/e2e/ pattern to .gitignore or extend existing entry

STEP 3: Test Generation (if not --run-only)
  Read phase context: CONTEXT.md acceptance criteria → Given/When/Then → spec
  Locator priority: getByRole > getByText > getByLabel > getByTestId
  Output: tests/e2e/{phase-slug}.spec.ts

STEP 4: Execution
  npx playwright test [--headed] [--project=chromium]
  Parse output: passed/failed/skipped counts + failure details

STEP 5: Structured Return
  ## PLAYWRIGHT COMPLETE
  Status: GREEN | RED | BLOCKED
  Tests: N passed, M failed, K skipped
  {failure details if RED}
  {blocker reason if BLOCKED}
```

### Modified Component: add-tests Workflow (execute_e2e_generation step)

The existing `execute_e2e_generation` step in `add-tests.md` currently:
1. Checks for existing tests covering the scenario
2. Creates a test file
3. Runs the E2E command
4. Evaluates result

The modification adds a **detection + scaffolding gate before step 2**:

```
execute_e2e_generation (MODIFIED):

  [NEW] Detect Playwright:
    PW_STATUS=$(node gsd-tools.cjs playwright-detect)
    if PW_STATUS == 'not_present':
      AskUserQuestion("Playwright not found. Scaffold it now?")
      if yes: spawn gsd-playwright(mode=scaffold)
      if no: mark E2E tests as BLOCKED, continue to TDD tests

  [NEW] Delegate to gsd-playwright agent:
    For E2E-classified files, spawn:
    Task(gsd-playwright, mode=generate,
         e2e_files=[...], phase_dir, base_url)
    Rather than inline generation logic

  [EXISTING] Evaluate result from agent:
    GREEN → record success
    RED → flag as potential application bug
    BLOCKED → report blocker (unchanged behavior)
```

This is a minimal modification — the existing `execute_tdd_generation` step is untouched. The change is surgical: add detection at the start of the E2E step and delegate generation to the agent instead of doing it inline.

## Data Flow

### Full ui-test Flow (PATH 1 — direct command)

```
User: /gsd:ui-test 12 https://localhost:3000 --headed
    │
    ▼
commands/gsd/ui-test.md
    │ parse args: phase=12, url=localhost:3000, headed=true
    ├── node gsd-tools.cjs init phase-op 12
    │   └── returns: { phase_dir, phase_number, phase_name }
    ├── node gsd-tools.cjs playwright-detect
    │   └── returns: { status: 'configured'|'installed'|'not_present', config_path? }
    │
    ▼ Task(gsd-playwright)
        │
        ├── STEP 1: Read phase artifacts
        │   └── CONTEXT.md acceptance criteria → extract Given/When/Then scenarios
        │
        ├── STEP 2: Detection result = 'not_present' AND no --run-only?
        │   └── Scaffold: create playwright.config.ts, tests/e2e/, example.spec.ts
        │
        ├── STEP 3: Generate tests/e2e/phase-12-<slug>.spec.ts
        │   └── Map each acceptance criterion to a Playwright test
        │
        ├── STEP 4: Execute
        │   └── npx playwright test --project=chromium [--headed]
        │       → parse NDJSON or text output
        │
        └── STEP 5: Return structured result to ui-test command
            → command formats and displays to user
```

### add-tests E2E Flow (PATH 2 — via workflow)

```
/gsd:add-tests 12
    │
    ▼ add-tests workflow: classify files
    │   Files: [auth.tsx → E2E, pricing.ts → TDD, config.ts → Skip]
    │
    ├── execute_tdd_generation (unchanged)
    │   └── pricing.ts → unit tests → run → pass/fail
    │
    └── execute_e2e_generation (MODIFIED)
        │
        ├── node gsd-tools.cjs playwright-detect
        │   └── not_present → AskUserQuestion → user approves scaffold
        │       → Task(gsd-playwright, mode=scaffold)
        │
        ├── Task(gsd-playwright, mode=generate, files=[auth.tsx])
        │   └── → tests/e2e/phase-12-auth.spec.ts generated + executed
        │
        └── Return result → add-tests formats coverage report + commits
```

### gsd-tools.cjs Playwright Detection Data Flow

```
node gsd-tools.cjs playwright-detect
    │
    ▼ testing.detectPlaywright(cwd)
        ├── fs.existsSync('playwright.config.ts') → 'configured'
        ├── fs.existsSync('playwright.config.js') → 'configured'
        ├── package.json deps has '@playwright/test' → 'installed'
        └── none → 'not_present'

Returns JSON:
{
  status: 'configured' | 'installed' | 'not_present',
  config_path: string | null,
  install_command: 'npx playwright install' | null
}
```

## New vs Modified: Explicit Component Table

| Component | Action | Justification |
|-----------|--------|---------------|
| `commands/gsd/ui-test.md` | **CREATE** | New user-facing command follows existing command pattern; no existing command handles Playwright lifecycle |
| `agents/gsd-playwright.md` | **CREATE** | Playwright lifecycle (detect, scaffold, generate, execute, report) is agent scope; test-steward precedent for read/execute agents |
| `workflows/add-tests.md` | **MODIFY** | The `execute_e2e_generation` step explicitly needs enhancement per PROJECT.md v2.7 requirements; minimal surgical change |
| `bin/lib/testing.cjs` | **MODIFY** | Add `detectPlaywright()` function and `cmdPlaywrightDetect` command; follows existing `detectFramework()` pattern |
| `bin/gsd-tools.cjs` | **MODIFY** | Add `playwright-detect` dispatch case; follows existing `test-detect-framework` pattern |
| `agents/gsd-test-steward.md` | **NO CHANGE** | Unit test budget/health analysis; Playwright is E2E scope, separate concern |
| `workflows/execute-plan.md` | **NO CHANGE** | Hard test gate uses unit test runner; Playwright execution is on-demand, not part of the commit gate |
| `commands/gsd/add-tests.md` | **NO CHANGE** | Command file just delegates to workflow; workflow modification is sufficient |

## Architectural Patterns

### Pattern 1: Command as Thin Orchestrator

**What:** Command files parse arguments and call `gsd-tools.cjs init` to gather context, then spawn one agent directly — no inline logic.
**When to use:** When the entire operation fits within a single agent execution context (no multi-step workflow gates needed).
**Trade-offs:** Simple, consistent. Use when the operation doesn't need user interaction mid-flight.
**Precedent:** `audit-tests.md` command spawns `gsd-test-steward` directly without a separate workflow.

```
# ui-test.md follows audit-tests.md pattern exactly:
1. Check prerequisites (playwright installed?)
2. Gather init data (gsd-tools init phase-op)
3. Display banner
4. Spawn gsd-playwright agent
5. Present agent report
```

### Pattern 2: Agent Structured Return

**What:** Agents return a fixed markdown header block so the calling workflow can parse success/failure deterministically.
**When to use:** Every agent that can be spawned via `Task()`.
**Trade-offs:** Slight verbosity in agent output, but enables reliable caller parsing.
**Precedent:** `gsd-test-steward` returns `## STEWARD COMPLETE` or `## STEWARD SKIPPED`.

```
## PLAYWRIGHT COMPLETE
Status: GREEN | RED | BLOCKED
Scaffolded: yes | no
Generated: N tests in M files
Passed: N | Failed: M | Skipped: K
{failure details table if RED}
{blocker reason if BLOCKED}
```

### Pattern 3: Surgical Workflow Enhancement

**What:** When modifying an existing workflow, add the new capability at the exact integration point, preserving all existing behavior.
**When to use:** Adding Playwright support to `execute_e2e_generation` step — TDD path must not change.
**Trade-offs:** Requires careful reading of existing workflow logic to find the right insertion point.
**Implementation:** Add detection + scaffolding gate at the START of `execute_e2e_generation`. Wrap the E2E generation in a `Task(gsd-playwright)` call instead of inline logic. All other steps (classification, test plan presentation, TDD generation, summary/commit) remain identical.

### Pattern 4: Three-Tier Detection

**What:** Check for Playwright in three states — fully configured (config file exists), installed but not configured (package.json dep), or absent.
**When to use:** Any time a tool's absence requires different handling (prompt to scaffold vs. error vs. proceed).
**Trade-offs:** More nuanced than binary present/absent, enables appropriate guidance.

```javascript
// testing.cjs addition — mirrors detectFramework() pattern
function detectPlaywright(cwd) {
  // Tier 1: config file present → fully configured
  if (fs.existsSync(path.join(cwd, 'playwright.config.ts'))) {
    return { status: 'configured', config_path: 'playwright.config.ts' };
  }
  if (fs.existsSync(path.join(cwd, 'playwright.config.js'))) {
    return { status: 'configured', config_path: 'playwright.config.js' };
  }
  // Tier 2: dep in package.json → installed, needs config
  const pkg = safeReadPackageJson(cwd);
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  if (deps['@playwright/test']) {
    return { status: 'installed', config_path: null, install_command: 'npx playwright install' };
  }
  // Tier 3: not present
  return { status: 'not_present', config_path: null, install_command: 'npm install -D @playwright/test && npx playwright install chromium' };
}
```

## Integration Points

### New gsd-tools.cjs Dispatch Entry

```
playwright-detect → testing.detectPlaywright(cwd)
```

Follows the exact pattern of `test-detect-framework → testing.cmdTestDetectFramework(cwd, raw)` already in `gsd-tools.cjs`.

### add-tests.md Modification Boundary

The modification is scoped to `execute_e2e_generation` step only. The change surface is:

| Location in add-tests.md | Change |
|--------------------------|--------|
| `execute_e2e_generation` step start | Add: call `playwright-detect`, gate on result |
| `execute_e2e_generation` step body | Change: delegate to `Task(gsd-playwright)` instead of inline generation |
| `execute_e2e_generation` step result handling | Change: parse structured return from agent instead of direct test run |
| All other steps | **NO CHANGE** |

### Agent Tool Access

The `gsd-playwright` agent needs broader tool access than `gsd-test-steward` (which is read-only) because it writes scaffold files and executes tests:

```yaml
tools: Read, Write, Edit, Bash, Glob, Grep
```

The `Bash` tool is required for `npx playwright test` execution. Write is required for scaffold file creation.

### No New .planning/ State Files Required

Unlike `linear.md` (which uses `linear-context.md`) or `pr-review.md` (which uses `review-context.md`), the Playwright workflow does not need a temporary state file. The phase context already lives in `${phase_dir}/CONTEXT.md`. The agent reads it directly. Generated test files live in the project's test directory, not in `.planning/`.

## Suggested Build Order

Dependencies drive this order. Each step can be verified independently before proceeding.

### Step 1: gsd-tools.cjs Playwright Detection

**Files:** `bin/lib/testing.cjs` (add `detectPlaywright()`), `bin/gsd-tools.cjs` (add `playwright-detect` case)

**Why first:** Both the new command and the modified workflow depend on `playwright-detect`. This is pure additive code with no breaking changes. Add `detectPlaywright()` alongside existing `detectFramework()`. Add `playwright-detect` dispatch case alongside existing `test-detect-framework` case.

**Verification:** `node gsd-tools.cjs playwright-detect` returns correct JSON in a project with and without Playwright configured.

### Step 2: gsd-playwright Agent

**Files:** `agents/gsd-playwright.md`

**Why second:** The agent is a leaf node — it has no dependencies on the command or workflow changes. Write it once `playwright-detect` exists so the agent can call the detection tool programmatically.

**Verification:** Agent can be spawned directly via Task() with a phase dir, runs detection, scaffolds in a test project, generates a spec from a CONTEXT.md file, and returns the structured `## PLAYWRIGHT COMPLETE` block.

**Note on subagent constraint:** The agent uses `Bash` to run `npx playwright test` directly. It does NOT spawn another agent. This complies with the "subagents cannot spawn subagents" constraint.

### Step 3: /gsd:ui-test Command

**Files:** `commands/gsd/ui-test.md`

**Why third:** The command is just a wrapper around the agent. Build the agent first, then wrap it.

**Verification:** `/gsd:ui-test 12 https://localhost:3000` invokes the agent correctly, displays the result.

### Step 4: add-tests Workflow Enhancement

**Files:** `~/.claude/get-shit-done/workflows/add-tests.md` (modify `execute_e2e_generation` step)

**Why fourth (last):** This modifies existing behavior. All three new dependencies (detection, agent, command) must be proven before modifying the existing workflow. The risk here is regressions in the TDD path — do this last so the riskier new components are validated first.

**Verification:** `/gsd:add-tests` on a phase with E2E-classified files correctly detects Playwright state, scaffolds if needed, spawns the agent, and integrates the structured result into the existing coverage report.

## Anti-Patterns

### Anti-Pattern 1: Inlining Playwright Logic in the Workflow

**What people do:** Add Playwright detection, scaffolding, and test generation code directly into `add-tests.md` without creating a separate agent.
**Why it's wrong:** The workflow already has 7 steps. Adding inline Playwright logic duplicates what the `gsd-playwright` agent does, and it can't be reused by `/gsd:ui-test` without copy-paste. Agents exist precisely to encapsulate reusable behavior.
**Do this instead:** Create `gsd-playwright.md` agent. Both paths (`/gsd:ui-test` and the modified `add-tests.md`) spawn it via `Task()`.

### Anti-Pattern 2: Creating a Separate Playwright Workflow File

**What people do:** Create `workflows/playwright.md` for the Playwright logic, then have both the command and `add-tests.md` delegate to it.
**Why it's wrong:** Workflows cannot be spawned from within other workflows (subagent constraint). An agent is the correct primitive for reusable leaf-node logic.
**Do this instead:** `gsd-playwright.md` in `agents/`, not `workflows/`.

### Anti-Pattern 3: Skipping the Detection Step

**What people do:** Have the agent assume Playwright is installed and immediately try `npx playwright test`.
**Why it's wrong:** The command is used on web app projects that may not have Playwright at all. A hard failure mid-execution is worse UX than a pre-flight check and scaffolding prompt.
**Do this instead:** Three-tier detection at agent start. Gate scaffolding on detection result. `--run-only` flag bypasses generation for projects that already have specs.

### Anti-Pattern 4: Modifying execute-plan.md's Hard Test Gate

**What people do:** Add `npx playwright test` to the hard test gate that runs after every task commit in `execute-plan.md`.
**Why it's wrong:** E2E tests take seconds to minutes per run. Running them on every commit during execute-phase would make the phase loop unbearably slow. UI tests are on-demand, not CI gates in this tool.
**Do this instead:** Playwright runs only when explicitly invoked via `/gsd:ui-test` or `/gsd:add-tests`. The hard test gate stays unit-test only.

### Anti-Pattern 5: Using a Temporary .planning/ File for Playwright Context

**What people do:** Write `playwright-context.md` to `.planning/` to pass state between the command and the agent, following the `linear-context.md` pattern.
**Why it's wrong:** The agent receives all needed context in the `Task()` prompt (mode, phase_dir, url, flags). The phase context it needs (CONTEXT.md) already exists. There's no inter-session state to preserve — the operation is atomic.
**Do this instead:** Pass all context in the `Task()` prompt directly. Keep `.planning/` clean.

## Scaling Considerations

This is a local CLI tool. Scaling in the traditional sense doesn't apply. The relevant scaling question is: **how does this hold up as the user's project grows?**

| Concern | Approach |
|---------|----------|
| Large number of acceptance criteria per phase | Agent generates one spec file per phase; test count scales with criteria count. No architectural limit. |
| Multiple web pages to test | `BASE_URL` passed to agent; agent generates one `describe` block per acceptance criterion. Multi-page tests are naturally handled. |
| Slow Playwright runs in CI | Out of scope per PROJECT.md (visual reports, CI integration deferred). On-demand execution only. |
| Test budget pressure (currently 796/800) | Playwright `.spec.ts` files are detected by `findTestFiles()` regex `\.(test|spec)\.(js|ts)`. Budget counter will include them. This is intentional — E2E specs count toward the budget. |

## Sources

All findings are HIGH confidence — based on direct codebase inspection with no external dependencies.

- `commands/gsd/audit-tests.md` — precedent for command-as-direct-agent-spawn pattern (no intermediate workflow)
- `commands/gsd/linear.md` + `~/.claude/get-shit-done/workflows/linear.md` — precedent for command argument parsing + workflow delegation pattern
- `~/.claude/get-shit-done/workflows/add-tests.md` — target for modification; `execute_e2e_generation` step analyzed in full
- `agents/gsd-test-steward.md` — agent structure precedent: `<input>`, `<process>`, `<output>` with structured return block
- `bin/lib/testing.cjs` `detectFramework()` — direct pattern for `detectPlaywright()` three-tier detection
- `bin/gsd-tools.cjs` lines 648-656 — `test-detect-framework` dispatch case; direct pattern for `playwright-detect`
- `bin/lib/init.cjs` — init bundle pattern for phase-op (returns phase_dir, phase_number, phase_name)
- `.planning/PROJECT.md` lines 107-111 — v2.7 active requirements defining exact scope

---
*Architecture research for: GSD Playwright UI Testing Integration (v2.7)*
*Researched: 2026-03-19*
