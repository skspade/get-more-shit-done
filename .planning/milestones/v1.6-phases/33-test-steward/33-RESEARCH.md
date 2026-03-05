# Phase 33: Test Steward - Research

**Researched:** 2026-03-05
**Domain:** Test suite health management agent, workflow integration, budget enforcement
**Confidence:** HIGH

## Summary

Phase 33 introduces a `gsd-test-steward` agent that analyzes test suite health (redundancy, staleness, budget status) and integrates into two workflows: audit-milestone (automatic) and a new `/gsd:audit-tests` command (on-demand). It also injects budget awareness into plan-phase so the planner can account for test limits.

All building blocks exist: `testing.cjs` provides `findTestFiles()`, `countTestsInFile()`, `countTestsInProject()`, and `getTestConfig()`. The agent pattern is well-established across 12 existing agents. The audit-milestone workflow has a clear insertion point between step 3 (integration checker) and step 4 (collect results). The plan-phase workflow prompt construction is well-understood.

**Primary recommendation:** Build this as three independent plans: (1) the agent file itself, (2) the audit-tests command + audit-milestone integration, and (3) the plan-phase budget injection. Plans 1 and 2 can run in parallel (wave 1); plan 3 depends on plan 1 since it references the same budget concepts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `gsd-test-steward` is a new agent file in `agents/` following the existing agent pattern (name, description, tools, color frontmatter + role/process/output sections)
- During audit-milestone, the steward is spawned as a Task with subagent_type="gsd-test-steward" and its findings appear in the audit report
- Agent model uses the same tier as gsd-plan-checker and gsd-integration-checker (verification-class work)
- Agent is read-only analysis -- no file modifications, only produces a markdown report
- Agent receives test file paths, test budget config, and project test count data as input
- Steward identifies duplicate assertions, overlapping test coverage, and stale tests referencing deleted code
- Stale test detection checks whether functions/files referenced in test assertions still exist in the codebase
- Redundancy analysis works by reading test file contents and comparing assertion patterns across files
- Four specific consolidation strategies: parameterize, promote, prune, merge
- Each proposal includes: source test location(s), target action, rationale, and estimated test count reduction
- All proposals require human approval -- steward never auto-applies changes
- Proposals are written as a markdown report section, not as executable commands
- Per-phase budget default: 50 tests; project budget default: 800 tests (from config.cjs TEST_CONFIG_DEFAULTS)
- Budget counting uses `countTestsInProject()` from testing.cjs
- Budget overruns are surfaced as warnings (not blockers) during plan-phase and audit
- Warning threshold at 80% of budget
- During plan-phase, the planner receives current budget status
- Budget status is injected into the planner prompt by the plan-phase orchestrator
- Budget status includes: current project test count, project budget, current phase test count, per-phase budget, warning/overage status
- Plan-phase calls `gsd-tools.cjs test-count` and `gsd-tools.cjs test-config` to gather budget data before spawning the planner
- New `/gsd:audit-tests` command spec in `commands/gsd/audit-tests.md` following existing command spec pattern
- Command spawns the gsd-test-steward agent directly for on-demand health checks
- No arguments required -- operates on the current project's test suite
- Output is a test health report covering redundancy, staleness, and budget status
- Modify `audit-milestone.md` workflow to spawn gsd-test-steward between step 3 and step 4
- Steward findings appear in the MILESTONE-AUDIT.md report as a dedicated "Test Suite Health" section
- Steward is only spawned when `test.steward` config key is true (default true)
- If steward is disabled or no test files exist, the step is silently skipped
- `test.steward` key already exists as a boolean in config.cjs and testing.cjs
- `test.budget.per_phase` (50) and `test.budget.project` (800) are already in config.cjs -- no config changes needed

### Claude's Discretion
- Internal prompt structure and reasoning flow within the gsd-test-steward agent
- Exact regex patterns for detecting duplicate assertions vs similar-but-different tests
- How the steward report is formatted within the MILESTONE-AUDIT.md (table vs list vs subsections)
- Staleness detection depth (whether to check import references, function calls, or file paths)
- Agent color choice for gsd-test-steward frontmatter
- Order of analysis steps within the steward (budget check, redundancy scan, staleness scan)
- Whether budget status in planner prompt uses a structured block or inline text

### Deferred Ideas (OUT OF SCOPE)
- Auto-consolidation without human approval (`steward.auto_consolidate` remains false)
- Richer steward config object with `redundancy_threshold`, `stale_threshold` sub-keys
- Interactive approval flow for consolidation proposals
- Coverage percentage targets and code coverage tools integration
- Per-file test-to-code mapping
- Visual test reports (HTML/dashboard output)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STEW-01 | `gsd-test-steward` agent analyzes test suite health during audit-milestone | Agent pattern from 12 existing agents; audit-milestone has clear insertion point between step 3 and step 4 |
| STEW-02 | Redundancy detection identifies duplicate assertions, overlapping coverage, stale tests | `findTestFiles()` discovers files, `countTestsInFile()` provides counts, regex-based assertion comparison is consistent with existing approach |
| STEW-03 | Consolidation proposals with specific actions requiring human approval | Four strategies defined (parameterize, promote, prune, merge); markdown report format is consistent with existing outputs |
| STEW-04 | Per-phase and project budget with configurable thresholds | `TEST_CONFIG_DEFAULTS` already defines budgets in testing.cjs; `getTestConfig()` merges with user config |
| STEW-05 | Planner receives budget status during plan-phase | plan-phase.md prompt construction is well-understood; `test-count` and `test-config` CLI commands exist |
| STEW-06 | `/gsd:audit-tests` command for on-demand health checks | Command spec pattern from 30+ existing commands; command spawns steward directly |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in | Test framework for new tests | Already used across all existing tests |
| node:fs | built-in | File system access for test file reading | Used by testing.cjs |
| node:assert | built-in | Test assertions | Used in all test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| testing.cjs | internal | Test file discovery, counting, config | All budget and file operations |
| core.cjs | internal | MODEL_PROFILES, output(), loadConfig() | Model resolution, CLI output |
| gsd-tools.cjs | internal | CLI dispatcher | Route `audit-tests` if needed via command spec |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex assertion comparison | AST parsing (acorn/babel) | AST is more accurate but adds framework dependency and complexity; regex is consistent with existing counting approach |
| Markdown report | JSON structured output | Markdown is human-readable, consistent with all other reports, and directly pasteable into MILESTONE-AUDIT.md |

## Architecture Patterns

### Agent File Structure
```
agents/gsd-test-steward.md
├── YAML frontmatter (name, description, tools, color)
├── <role> — identity and core responsibilities
├── <process> — step-by-step execution flow
│   ├── Step 1: Read input data (test files, config, counts)
│   ├── Step 2: Budget analysis
│   ├── Step 3: Redundancy detection
│   ├── Step 4: Staleness detection
│   └── Step 5: Generate report with consolidation proposals
├── <output> — structured return format
└── <success_criteria> — completion checklist
```

### Command Spec Structure
```
commands/gsd/audit-tests.md
├── YAML frontmatter (name, description, allowed-tools)
├── <objective> — what the command does
├── <execution_context> — @file refs (none needed — simple command)
├── <context> — inputs (none required)
└── <process> — spawn steward agent, present report
```

### Audit-Milestone Integration Point
The audit-milestone.md workflow has this structure:
- Step 0: Initialize
- Step 1: Determine scope
- Step 2: Read phase verifications
- Step 3: Spawn integration checker
- **INSERT: Step 3.5: Spawn test steward**
- Step 4: Collect results
- Step 5: Requirements coverage
- Step 6: Aggregate report
- Step 7: Present results

### Anti-Patterns to Avoid
- **Over-scoping the agent:** The steward is read-only analysis. It must NOT modify test files, create new tests, or execute consolidation proposals.
- **Blocking on budget:** Budget overruns are warnings, not blockers. The planner should be informed but not prevented from proceeding.
- **Complex AST parsing:** Use regex-based comparison consistent with `countTestsInFile()` approach. Do not introduce AST dependencies.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test file discovery | Custom walker | `findTestFiles()` from testing.cjs | Already excludes node_modules, .git, .planning, etc. |
| Test counting | Custom counter | `countTestsInProject()` from testing.cjs | Handles per-phase filtering, file aggregation |
| Config reading | Custom parser | `getTestConfig()` from testing.cjs | Already merges defaults with user config |
| Model resolution | Manual profile lookup | `gsd-tools.cjs resolve-model gsd-test-steward --raw` | Handles overrides, profile lookup, opus→inherit mapping |

## Common Pitfalls

### Pitfall 1: Agent Not in MODEL_PROFILES
**What goes wrong:** `resolve-model gsd-test-steward` returns 'sonnet' fallback instead of profile-based resolution
**Why it happens:** New agent type not added to MODEL_PROFILES in core.cjs
**How to avoid:** Add `gsd-test-steward` to both MODEL_PROFILES in core.cjs and the model-profiles.md reference table
**Warning signs:** Agent always uses sonnet regardless of model_profile setting

### Pitfall 2: Steward Runs When No Tests Exist
**What goes wrong:** Steward agent errors or produces empty report
**Why it happens:** No test files in project, steward tries to analyze empty set
**How to avoid:** Check `findTestFiles()` result count first; if 0, skip steward silently
**Warning signs:** Empty reports or errors in audit output

### Pitfall 3: Budget Data Not Available to Planner
**What goes wrong:** Planner doesn't account for test budgets when creating plans
**Why it happens:** plan-phase.md doesn't gather budget data before constructing planner prompt
**How to avoid:** Add budget gathering step between context loading and planner spawn; use existing CLI commands
**Warning signs:** Plans create unlimited tests, exceeding budget

### Pitfall 4: Audit-Milestone Step Order
**What goes wrong:** Steward findings not included in final report
**Why it happens:** Steward step inserted after result collection instead of before
**How to avoid:** Insert between step 3 (integration checker) and step 4 (collect results)
**Warning signs:** MILESTONE-AUDIT.md missing "Test Suite Health" section

## Code Examples

### Budget Status Gathering (for plan-phase)
```bash
# Gather test counts
TEST_COUNT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-count --raw 2>/dev/null || echo "0")
PHASE_COUNT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-count --phase ${PHASE} --raw 2>/dev/null || echo "0")

# Gather budget config
TEST_CONFIG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-config 2>/dev/null)
```

### Model Profile Entry Pattern
```javascript
// In core.cjs MODEL_PROFILES
'gsd-test-steward': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
```

### Steward Spawn Pattern (audit-milestone)
```
steward_model=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-test-steward --raw)

Task(
  prompt="Analyze test suite health...",
  subagent_type="gsd-test-steward",
  model="{steward_model}"
)
```

## Open Questions

1. **Steward agent color**
   - What we know: Verification-class agents use green (plan-checker) and blue (integration-checker)
   - What's unclear: Best color for test steward to distinguish from existing agents
   - Recommendation: Use `orange` — distinct from green/blue verification agents, suggests "monitoring/health"

## Sources

### Primary (HIGH confidence)
- Codebase inspection: testing.cjs, core.cjs, gsd-tools.cjs — all functions verified by direct read
- Codebase inspection: audit-milestone.md workflow — insertion point confirmed
- Codebase inspection: 12 agent files — pattern confirmed
- Codebase inspection: 30+ command specs — pattern confirmed

### Secondary (MEDIUM confidence)
- Phase 33 CONTEXT.md — auto-generated context decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all internal, no external dependencies
- Architecture: HIGH - follows 12 existing agent implementations
- Pitfalls: HIGH - integration points verified by reading actual source code

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (internal codebase, stable patterns)
