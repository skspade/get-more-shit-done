# Architecture Patterns

**Domain:** Automated UAT browser testing integration into GSD autopilot
**Researched:** 2026-03-22
**Confidence:** HIGH

## Recommended Architecture

The automated UAT session integrates as a new step in the existing autopilot milestone-completion flow. It introduces 4 new components and modifies 2 existing ones, while reusing established patterns (runClaudeStreaming, gap closure loop, gsd-tools dispatch, frontmatter-based result communication).

### High-Level Flow (modified autopilot.mjs)

```
All phases complete
  -> runMilestoneAudit() [EXISTING - unchanged]
    -> Audit passes (exit 0)
      -> runAutomatedUAT() [NEW]
        -> UAT passes (0)  -> runMilestoneCompletion() [EXISTING - unchanged]
        -> UAT gaps (10)   -> runGapClosureLoop() [EXISTING - modified to accept UAT gaps]
                              -> Re-audit -> Re-UAT -> ...
        -> UAT error (1)   -> debug retry / halt
    -> Audit gaps (exit 10)
      -> runGapClosureLoop() [EXISTING - unchanged]
        -> Re-audit -> (if passes) -> runAutomatedUAT() -> ...
```

### Component Boundaries

| Component | Type | Status | Responsibility | Communicates With |
|-----------|------|--------|---------------|-------------------|
| `runAutomatedUAT()` | Function in autopilot.mjs | NEW | Orchestrates UAT: checks config, invokes workflow, parses results | autopilot main loop, uat-auto workflow, gap closure loop |
| `uat-auto.md` | Workflow file | NEW | Autonomous UAT execution: discover tests, detect browser, execute tests, write results | Chrome MCP tools, Playwright (via Bash), UAT.md files, MILESTONE-UAT.md |
| `uat-config.yaml` | Config file (per-project) | NEW | Declares app URL, startup command, browser preference, timeouts | runAutomatedUAT(), uat-auto workflow |
| `MILESTONE-UAT.md` | Results artifact | NEW | Structured test results with YAML gaps for failed tests | runAutomatedUAT() (read), plan-milestone-gaps (consume) |
| `autopilot.mjs` main loop | Script | MODIFIED | Adds UAT step between audit-pass and milestone-completion | runAutomatedUAT(), runGapClosureLoop() |
| `plan-milestone-gaps.md` | Workflow | MODIFIED | Must recognize MILESTONE-UAT.md as gap source (alongside MILESTONE-AUDIT.md) | MILESTONE-UAT.md gaps section |

### Data Flow

```
                                 uat-config.yaml
                                      |
                                      v
autopilot.mjs --[spawns]--> claude -p "/gsd:uat-auto"
                                      |
                            +---------+---------+
                            |                   |
                     Chrome MCP path      Playwright path
                     (tabs_context_mcp    (npx playwright
                      chrome_navigate      inline scripts
                      chrome_click         bash execution)
                      chrome_screenshot)        |
                            |                   |
                            +--------+----------+
                                     |
                                     v
                          MILESTONE-UAT.md (results + gaps YAML)
                          uat-evidence/{milestone}/*.png (screenshots)
                                     |
                                     v
                          autopilot.mjs reads status from frontmatter
                                     |
                              +------+------+
                              |             |
                         status=passed  status=gaps_found
                              |             |
                              v             v
                    runMilestoneCompletion  runGapClosureLoop()
                                            (plan-milestone-gaps
                                             reads MILESTONE-UAT.md gaps)
```

## New Components Detail

### 1. `runAutomatedUAT()` in autopilot.mjs

**Pattern:** Follows the same structure as `runMilestoneAudit()` (line 862) -- a named async function called from the main flow that spawns a Claude session and interprets results via frontmatter.

```javascript
async function runAutomatedUAT() {
  // 1. Gate: Check if uat-config.yaml exists
  const configPath = path.join(PROJECT_DIR, '.planning', 'uat-config.yaml');
  if (!fs.existsSync(configPath)) {
    logMsg('UAT: skipped (no uat-config.yaml)');
    console.log('No uat-config.yaml found. Skipping automated UAT.');
    return 0; // Not an error -- project may not have web UI
  }

  printBanner('AUTOMATED UAT');

  // 2. Invoke workflow via runStepWithRetry (reuses debug retry)
  const uatExit = await runStepWithRetry('/gsd:uat-auto', 'automated-uat');
  if (uatExit !== 0) {
    logMsg(`UAT: workflow failed exit=${uatExit}`);
    return 1;
  }

  // 3. Parse results from MILESTONE-UAT.md frontmatter
  const uatFile = path.join(PROJECT_DIR, '.planning', 'MILESTONE-UAT.md');
  if (!fs.existsSync(uatFile)) {
    logMsg('UAT: no MILESTONE-UAT.md produced');
    return 1;
  }

  const uatStatus = (await gsdTools(
    'frontmatter', 'get', uatFile, '--field', 'status', '--raw'
  )).trim();
  logMsg(`UAT: result=${uatStatus}`);

  switch (uatStatus) {
    case 'passed':
      printBanner('UAT PASSED');
      return 0;
    case 'gaps_found':
      printBanner('UAT: FAILURES FOUND');
      return 10; // Same code as audit gaps
    default:
      return 1;
  }
}
```

**Key design decisions:**
- Returns `0` / `10` / `1` -- matches `runMilestoneAudit()` return value contract exactly
- Uses `runStepWithRetry` for debug retry on workflow crashes (same as milestone-audit)
- Gates on `uat-config.yaml` existence -- projects without web UIs skip silently with `return 0`
- Reads frontmatter via `gsd-tools frontmatter get` -- same pattern as audit status parsing (line 889)

### 2. `uat-auto.md` Workflow

**Location:** `get-shit-done/workflows/uat-auto.md`
**Pattern:** Fully autonomous workflow (no user prompts). Matches audit-milestone.md style.

**Steps:**
1. Load `uat-config.yaml` via Read tool
2. Discover UAT tests: scan phase dirs for `*-UAT.md` files with `status: complete`, fallback to SUMMARY.md generation
3. Browser detection: try `tabs_context_mcp`, fall back to Playwright
4. Start app if configured and not running (check base_url accessibility)
5. Execute tests sequentially (Chrome MCP or Playwright via Bash)
6. Write `.planning/MILESTONE-UAT.md` with frontmatter status and gaps YAML
7. Save screenshots to `.planning/uat-evidence/{milestone}/`
8. Commit results
9. Exit 0

**The workflow is the "brain"** -- it does the actual testing using Chrome MCP tools or Bash for Playwright. The autopilot just spawns it and reads the results artifact.

### 3. `uat-config.yaml`

**Location:** `.planning/uat-config.yaml`

```yaml
base_url: "http://localhost:3000"
startup_command: "npm run dev"    # optional
startup_wait_seconds: 10          # optional, default 10
browser: "chrome-mcp"             # optional, default chrome-mcp
fallback_browser: "playwright"    # optional, default playwright
timeout_minutes: 10               # optional, default 10
```

**Design rationale:** YAML over JSON because it matches UAT.md frontmatter patterns and is easier for humans to edit. Located in `.planning/` because it is project config, not source code. Separate from `config.json` because it has different ownership (per-project, manually created vs auto-generated).

### 4. `MILESTONE-UAT.md`

**Location:** `.planning/MILESTONE-UAT.md`
**Lifecycle:** Created by uat-auto workflow, consumed by autopilot and plan-milestone-gaps, cleaned up during milestone archival.

**Frontmatter contract (critical for autopilot parsing):**
```yaml
status: passed | gaps_found    # autopilot reads this field
milestone: v3.1
browser: chrome-mcp | playwright
started: 2026-03-22T10:30:00Z
completed: 2026-03-22T10:35:00Z
total: 12
passed: 11
failed: 1
```

**Gaps section format** -- must match what `plan-milestone-gaps` can consume:
```yaml
- truth: "Description of expected behavior"
  status: failed
  reason: "What automated UAT observed"
  severity: major | minor
  evidence: "uat-evidence/v3.1/04-test-2.png"
```

## Modified Components Detail

### 5. `autopilot.mjs` Main Flow -- 3 Insertion Points

All three sites follow the same pattern: after audit passes (exit 0), run UAT before completion.

**Insertion point 1: Lines ~1088-1100 (all phases already complete on startup)**
```javascript
// BEFORE:
if (auditResult === 0) {
  await runMilestoneCompletion();
  process.exit(0);
}

// AFTER:
if (auditResult === 0) {
  const uatResult = await runAutomatedUAT();
  if (uatResult === 10) {
    await runGapClosureLoop();
    // After gap closure, need full re-validation: re-audit + re-UAT
    // This creates a nested loop -- extract to helper function
  } else if (uatResult !== 0) {
    console.error('ERROR: Automated UAT encountered an error');
    process.exit(1);
  }
  await runMilestoneCompletion();
  process.exit(0);
}
```

**Insertion point 2: Lines ~1165-1176 (phases complete during main loop)**
Same pattern as insertion point 1.

**Insertion point 3: Lines ~1004-1016 (after gap closure re-audit passes)**
After gap closure loop re-audit passes, UAT must also run before declaring closure complete. This is inside `runGapClosureLoop()`.

**Refactoring recommendation:** Extract an `auditAndUAT()` helper that runs audit, then UAT (if audit passes), and returns the combined result. This eliminates the 3x duplication:

```javascript
async function auditAndUAT() {
  const auditResult = await runMilestoneAudit();
  if (auditResult !== 0) return auditResult; // gaps or error

  const uatResult = await runAutomatedUAT();
  return uatResult; // 0=pass, 10=gaps, 1=error
}
```

### 6. `plan-milestone-gaps.md` Workflow Modification

Must recognize `MILESTONE-UAT.md` as a gap source alongside `v*-MILESTONE-AUDIT.md`. The gaps YAML format is intentionally identical so the existing gap-to-phase-plan mapping works without changes.

**Change:** In the gap discovery step, scan for both files:
- `.planning/v*-MILESTONE-AUDIT.md` (existing)
- `.planning/MILESTONE-UAT.md` (new)

Merge gaps from both sources before creating fix phases.

## Patterns to Follow

### Pattern 1: Gate-on-Config for Optional Features

**What:** Check for a config file to decide whether to run a feature. If missing, skip silently with exit 0.
**When:** The feature is not applicable to all projects.
**Example:** `runAutomatedUAT()` returns 0 immediately if no `uat-config.yaml` exists.

### Pattern 2: Frontmatter-Based Result Communication

**What:** The spawned workflow writes results to a markdown file with YAML frontmatter. The caller reads the frontmatter to determine outcome.
**When:** Cross-process result passing (autopilot -> Claude session -> back to autopilot).
**Why:** Exactly how `runMilestoneAudit()` works -- reads `status` from MILESTONE-AUDIT.md frontmatter via `gsd-tools frontmatter get`.

### Pattern 3: Exit Code Contract (0/10/1)

**What:** Functions return 0 for pass, 10 for gaps found, 1 for error.
**When:** Any milestone-level check that might produce actionable gaps.
**Why:** The gap closure loop checks for exit 10 specifically (line 1009).

### Pattern 4: Browser Detection with Graceful Fallback

**What:** Try Chrome MCP first, fall back to Playwright if unavailable.
**When:** UAT execution needs a browser.
**Detection:** `tabs_context_mcp` call. Success = Chrome MCP mode. Failure/timeout (5s) = Playwright mode.

### Pattern 5: CJS Module for Data Operations

**What:** All file I/O, YAML parsing, and state reading lives in a `.cjs` module, not in the workflow or autopilot.
**When:** Any operation that needs to be testable or reusable.
**Why:** Follows phase.cjs, verify.cjs, testing.cjs pattern. Enables unit testing without Claude.

**Note on uat.cjs:** The design doc does not call for a `uat.cjs` module -- it has the autopilot doing config existence checks directly (simple `fs.existsSync`) and the workflow doing all test logic. A `uat.cjs` module makes sense if there is significant parsing logic that needs testing (e.g., config validation, test discovery). However, keeping it simple (no module, logic in workflow + inline in autopilot) also works and follows the brainstorm.md precedent where workflow files contain the logic directly. **Decision: start without uat.cjs, extract only if testing demands it.**

## Anti-Patterns to Avoid

### Anti-Pattern 1: Persistent Playwright Spec Files for UAT

**What:** Generating and committing `.spec.ts` files for UAT tests.
**Why bad:** UAT tests are ephemeral judgment calls, not regression tests. The agent writes inline scripts, runs them, discards them.
**Instead:** MILESTONE-UAT.md results + screenshots are the permanent artifacts.

### Anti-Pattern 2: Separate Agent for UAT Orchestration

**What:** Creating a new agent (like gsd-playwright) to orchestrate the UAT session.
**Why bad:** The workflow file IS the orchestrator. Adding an agent creates unnecessary indirection.
**Instead:** Single workflow file (`uat-auto.md`) that the autopilot spawns via `claude -p`.

### Anti-Pattern 3: Modifying Existing Per-Phase UAT.md Files

**What:** Writing automated test results back into the per-phase `*-UAT.md` files.
**Why bad:** Those are human-owned verify-work artifacts.
**Instead:** Read from `*-UAT.md` (test discovery), write to `MILESTONE-UAT.md` (results).

### Anti-Pattern 4: Running UAT Before Milestone Audit

**What:** Placing UAT earlier in the flow.
**Why bad:** UAT is expensive (browser sessions, screenshots). Audit catches structural issues cheaply first.
**Instead:** Audit first (cheap), then UAT (expensive), then completion.

### Anti-Pattern 5: Adding a YAML Parser to autopilot.mjs

**What:** Importing js-yaml in autopilot.mjs to read uat-config.yaml directly.
**Why bad:** autopilot.mjs uses `gsd-tools frontmatter get` for all YAML/frontmatter needs.
**Instead:** Gate on file existence only (`fs.existsSync`). Let the workflow read and parse the full config.

### Anti-Pattern 6: Complex Dev Server Process Management

**What:** Using tree-kill, process groups, or PID file management for the startup_command.
**Why bad:** Over-engineering for what is optional convenience.
**Instead:** The workflow starts the server if needed, does its testing, and the process exits when the Claude session ends. The dev server can be left running -- the user manages it.

## Integration Points Summary

| Integration Point | Existing Component | New Component | Connection Type |
|---|---|---|---|
| Autopilot main flow (3 sites) | autopilot.mjs audit-to-completion | `runAutomatedUAT()` | Function call, exit code contract (0/10/1) |
| Gap closure input | plan-milestone-gaps.md | MILESTONE-UAT.md | File read -- gaps YAML section |
| Test discovery | verify-work `*-UAT.md` files | uat-auto.md workflow | File read -- test definitions |
| Browser interaction | Chrome MCP tools (external) | uat-auto.md workflow | MCP tool calls |
| Browser fallback | Playwright (testing.cjs detection) | uat-auto.md workflow | Bash execution |
| Config gate | autopilot.mjs (fs.existsSync) | uat-config.yaml | File existence check |
| Results parsing | gsd-tools frontmatter get | MILESTONE-UAT.md | CLI tool invocation |
| Evidence storage | .planning/ directory | uat-evidence/ subdirectory | File system, git commit |
| Milestone archival | complete-milestone.md workflow | uat-evidence/ + MILESTONE-UAT.md | Cleanup during archival |

## Build Order (dependency-driven)

```
Phase 1: Foundation (no dependencies)
  -> uat-config.yaml schema definition
  -> MILESTONE-UAT.md format specification
  -> Evidence directory structure (.planning/uat-evidence/)

Phase 2: Workflow (depends on Phase 1 formats)
  -> uat-auto.md workflow file
  -> Chrome MCP execution logic (navigate, interact, screenshot, judge)
  -> Playwright fallback logic (inline scripts via Bash)
  -> Test discovery from *-UAT.md files

Phase 3: Autopilot Integration (depends on Phase 2 producing a callable workflow)
  -> runAutomatedUAT() function in autopilot.mjs
  -> 3 insertion points in main flow (or auditAndUAT() helper)
  -> Exit code routing (0/10/1)

Phase 4: Gap Closure Integration (depends on Phase 3)
  -> plan-milestone-gaps.md modification to read MILESTONE-UAT.md
  -> Re-UAT after gap closure loop

Phase 5: Evidence + Reporting + Documentation
  -> Screenshot storage and git commit
  -> Milestone archival cleanup for uat-evidence/
  -> help.md, USER-GUIDE.md updates
  -> Tests (autopilot source-text tests for new function, workflow integration)
```

**Rationale:** Each phase produces an artifact the next phase consumes. The workflow must exist before autopilot can call it. The autopilot integration must exist before gap closure can re-trigger UAT. Evidence management can be polished last since it does not block the core flow.

## Scalability Considerations

| Concern | At ~10 tests | At 20+ tests | At 50+ tests |
|---------|-------------|--------------|-------------|
| Execution time | Under 5 min | 10-15 min, may hit default timeout | Increase timeout_minutes, consider test batching |
| Screenshot storage | <1MB per milestone | ~5MB per milestone | Consider cleanup or .gitignore for old milestones |
| Context window | Fits easily in 200k | Still fits | May need test batching if descriptions are long |
| Browser stability | Chrome MCP stable | Stable with single-tab design | Single-tab prevents accumulation |

## Sources

- `get-shit-done/scripts/autopilot.mjs` -- milestone audit (line 862), gap closure (line 924), completion (line 1019), main loop (line 1120), 3 insertion points (lines 1088, 1165, 1004)
- `.planning/designs/2026-03-22-automated-uat-session-design.md` -- full design specification
- `get-shit-done/bin/lib/testing.cjs` -- Playwright detection (`detectPlaywright`), test output parsing
- `agents/gsd-playwright.md` -- existing Playwright agent patterns
- `get-shit-done/workflows/verify-work.md` -- UAT.md file format and ownership
- `get-shit-done/workflows/audit-milestone.md` -- milestone audit patterns
- `get-shit-done/workflows/plan-milestone-gaps.md` -- gap consumption patterns
- `get-shit-done/bin/lib/config.cjs` -- CONFIG_DEFAULTS pattern
