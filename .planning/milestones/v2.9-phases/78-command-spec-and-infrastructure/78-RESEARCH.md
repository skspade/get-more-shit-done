# Phase 78: Command Spec and Infrastructure - Research

**Researched:** 2026-03-21
**Domain:** GSD command authoring, git diff gathering, init function plumbing
**Confidence:** HIGH

## Summary

Phase 78 delivers the `/gsd:test-review` command infrastructure: a command file that gathers git diffs, displays a banner, spawns the `gsd-test-reviewer` agent, writes a report to disk, and handles edge cases (no diff, large diff, `--report-only`). It also adds the `cmdInitTestReview` init function and gsd-tools dispatch entry.

This is a well-trodden pattern in GSD. The `audit-tests.md` command demonstrates the "command IS the orchestrator" direct-spawn pattern, and `cmdInitPrReview()` in init.cjs provides a near-exact template for the init function. No new libraries or external dependencies are needed. All work uses existing `gsd-tools.cjs` utilities (`test-count`, `test-config`, `resolve-model`, `commit`).

**Primary recommendation:** Follow the audit-tests.md command pattern and cmdInitPrReview() init function template. The implementation is mechanical — copy, adapt, wire.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Command file at `commands/gsd/test-review.md` following the direct agent spawn pattern from `audit-tests.md`
- Command frontmatter: `name: gsd:test-review`, `argument-hint: "[--report-only]"`, allowed-tools include Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
- `--report-only` flag parsed from `$ARGUMENTS` to skip routing and exit after report write
- Command gathers `git diff` and spawns `gsd-test-reviewer` agent via `Task()`
- Use `origin/main` as diff base with fallback chain: `origin/main` -> `origin/master` -> `main` -> `master`; run `git fetch origin main --quiet` before diffing
- Exit gracefully with "No changes found vs main" when diff is empty
- Diff size gate at ~2000 lines: measure via `wc -l`, switch to `--stat` + file list for large diffs instead of full diff
- Capture full diff once, extract file names from it rather than running git diff twice
- Display banner with changed file count, test count, and budget status before spawning agent
- Banner data sourced from `gsd-tools.cjs test-count --raw` and `gsd-tools.cjs test-config`
- Report written to `.planning/reviews/YYYY-MM-DD-test-review.md`
- Report committed via `gsd-tools.cjs commit` as a separate commit before any routing
- Agent output IS the report — command writes it directly without restructuring
- `cmdInitTestReview()` in `init.cjs` — near-copy of `cmdInitPrReview()` resolving models, quick task numbering, timestamps, paths, file existence
- `gsd-tools.cjs` gets `case 'test-review':` under the `init` switch routing to `cmdInitTestReview`
- Update the `Available:` error message list to include `test-review`
- Pass `<test-review-input>` XML block to agent containing: diff (or stat summary for large diffs), changed files list, test count, test config JSON, test file list
- For large diffs (>2000 lines), the XML block contains `--stat` output and changed file list instead of full diff, with instruction for agent to use Read/Grep tools for details
- Test files discovered via `gsd-tools.cjs test-count` and file list via Bash

### Claude's Discretion
- Exact banner formatting (unicode characters, ANSI colors, spacing)
- Order of prerequisite checks within the command process steps
- Variable naming in the command's bash snippets
- Exact wording of the "no changes" exit message

### Deferred Ideas (OUT OF SCOPE)
- Agent definition (`gsd-test-reviewer.md`) — Phase 79
- Quick task routing, milestone routing, and user-choice prompt — Phase 80
- Documentation updates (help.md, USER-GUIDE.md, README.md) — Phase 81
- Integration with `audit-milestone` for auto-running test-review during audits — post-v2.9
- Custom source-to-test file mapping configuration — post-v2.9
- Budget impact projection — post-v2.9
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | `/gsd:test-review` command gathers `git diff main...HEAD` and spawns `gsd-test-reviewer` agent | audit-tests.md pattern: command gathers data, spawns agent via Task(). Diff base resolution with fallback chain from CONTEXT.md. |
| CMD-02 | Command displays banner with changed file count, test count, and budget status | Existing `test-count --raw` and `test-config` gsd-tools utilities provide all data. Banner follows GSD ui-brand patterns. |
| CMD-03 | `--report-only` flag skips routing and exits after report display | Flag parsed from `$ARGUMENTS`. Exit point placed immediately after report write per CONTEXT.md. |
| CMD-04 | Command writes report to `.planning/reviews/YYYY-MM-DD-test-review.md` and commits to git | `gsd-tools.cjs commit` handles commit. `.planning/reviews/` directory already used by pr-review reports. |
| CMD-05 | Command exits gracefully with message when no diff exists vs main | Empty diff check after `git diff` call — standard bash pattern. |
| CMD-06 | Diff size gate switches to summarized mode when diff exceeds ~2000 lines | `wc -l` measurement, then branch: full diff vs `--stat` + file list. Agent instructed to use Read/Grep for details in large-diff mode. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsd-tools.cjs | current | Init dispatch, test-count, test-config, commit, resolve-model | Core GSD infrastructure — all commands use it |
| init.cjs | current | Init function definitions | All init functions live here |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| git | system | Diff gathering, fetch, stat | Always — diff is the core input |

### Alternatives Considered
None — this is internal GSD infrastructure work with no external dependencies.

## Architecture Patterns

### Pattern 1: Direct Agent Spawn Command
**What:** Command IS the orchestrator — gathers data, spawns agent via Task(), no workflow file needed
**When to use:** Linear command flow with single agent invocation (no multi-agent orchestration)
**Source:** `audit-tests.md` command file

### Pattern 2: Init Function Plumbing
**What:** `cmdInitXxx()` in init.cjs resolves models, timestamps, paths; gsd-tools.cjs dispatches via case statement
**When to use:** Every new GSD command needs an init function for the agent to call
**Source:** `cmdInitPrReview()` at init.cjs line 785

### Pattern 3: XML Input Block
**What:** Structured data passed from command to agent as XML elements in the Task() prompt
**When to use:** When agent needs structured input data (diff, config, file lists)
**Source:** pr-review and audit-tests patterns

### Anti-Patterns to Avoid
- **Running git diff twice:** Capture once, extract file names from the output
- **Passing full large diffs:** Agent context will be flooded — use stat summary + tool-based exploration
- **Separate workflow file for linear flow:** audit-tests.md proves direct spawn works for single-agent commands

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model resolution | Custom config parsing | `resolveModelInternal()` in init.cjs | Handles profile + overrides + inherit logic |
| Git commit | Manual git commands | `gsd-tools.cjs commit` | Handles staging, message formatting, error handling |
| Test count/config | Manual file scanning | `gsd-tools.cjs test-count`, `test-config` | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: Stale Local Main Branch
**What goes wrong:** `git diff main...HEAD` uses stale local main, missing recent remote changes
**Why it happens:** Local main not updated after merge
**How to avoid:** `git fetch origin main --quiet` before diffing, use `origin/main` as base
**Warning signs:** User reports "no diff" when changes clearly exist

### Pitfall 2: Large Diff Context Flooding
**What goes wrong:** Passing 5000+ line diffs to agent exhausts context window
**Why it happens:** No size gate on diff output
**How to avoid:** Measure diff lines, switch to stat summary above threshold
**Warning signs:** Agent output becomes terse or incomplete

### Pitfall 3: Missing Reviews Directory
**What goes wrong:** Report write fails because `.planning/reviews/` doesn't exist
**Why it happens:** Directory not created on first use
**How to avoid:** `mkdir -p .planning/reviews` before writing report

### Pitfall 4: --report-only Exit Placement
**What goes wrong:** Report-only flag checked too late, routing code still executes
**Why it happens:** Exit point after routing instead of before
**How to avoid:** Place exit immediately after report write, before any routing code

## Code Examples

### cmdInitPrReview (template for cmdInitTestReview)
From init.cjs line 785:
```javascript
function cmdInitPrReview(cwd, raw) {
  const config = loadConfig(cwd);
  const now = new Date();
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir)
      .filter(f => /^\d+-/.test(f))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(n => !isNaN(n));
    if (existing.length > 0) {
      nextNum = Math.max(...existing) + 1;
    }
  } catch {}
  const result = {
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),
    commit_docs: config.commit_docs,
    next_num: nextNum,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    quick_dir: '.planning/quick',
    state_path: '.planning/STATE.md',
    roadmap_path: '.planning/ROADMAP.md',
    project_path: '.planning/PROJECT.md',
    config_path: '.planning/config.json',
    planning_exists: pathExistsInternal(cwd, '.planning'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
  };
  output(result, raw);
}
```

### gsd-tools.cjs dispatch pattern
From gsd-tools.cjs line 604:
```javascript
case 'pr-review':
  init.cmdInitPrReview(cwd, raw);
  break;
```

### module.exports pattern
From init.cjs line 834:
```javascript
module.exports = {
  // ... existing exports ...
  cmdInitPrReview,
};
```

## Sources

### Primary (HIGH confidence)
- `audit-tests.md` — direct agent spawn command pattern (read from disk)
- `init.cjs` cmdInitPrReview lines 785-832 — init function template (read from disk)
- `gsd-tools.cjs` lines 604-608 — dispatch and Available list (read from disk)
- `78-CONTEXT.md` — locked implementation decisions (read from disk)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all internal, well-established patterns
- Architecture: HIGH - copying existing verified patterns
- Pitfalls: HIGH - known issues from prior command implementations

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable internal patterns)
