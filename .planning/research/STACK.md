# Stack Research

**Domain:** GSD autopilot — PR diff-aware test review command (v2.9)
**Researched:** 2026-03-21
**Confidence:** HIGH

## Scope

This research covers ONLY what is new for v2.9 (`/gsd:test-review` command). The existing validated
stack (Node.js CJS, zx/ESM, node:test suite, gsd-tools dispatcher, testing.cjs, cli.cjs, autopilot.mjs,
validation.cjs, frontmatter.cjs, markdown commands/agents/workflows) is NOT re-evaluated.

## Verdict: No New Dependencies

This milestone is purely additive markdown files: one command spec (`commands/gsd/test-review.md`) and
one agent definition (`agents/gsd-test-reviewer.md`), plus documentation updates. No new npm packages,
no new CJS modules, no new gsd-tools dispatch entries.

The command gathers git diff data and existing test metadata via shell commands and `gsd-tools.cjs`
dispatch entries that already exist (`test-count`, `test-config`, `commit`). The agent is a read-only
analysis agent (like `gsd-test-steward`) that receives structured input and produces a markdown report.
The routing flow (quick task / milestone / done) reuses the same patterns proven in `/gsd:pr-review`.

## Recommended Stack (No Changes)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code CLI | current | Executes command spec, spawns agent via `Task()` | All GSD commands are markdown files interpreted by Claude Code. No alternative exists. |
| Git CLI | system | `git diff main...HEAD` for changed files and full diff | Standard git commands executed via Bash tool. The diff is the primary input to the agent. |
| `gsd-tools.cjs` dispatch | n/a (in-repo) | `test-count`, `test-config`, `commit` | Existing dispatch entries provide all test metadata needed. No new entries required. |
| `testing.cjs` | n/a (in-repo) | `findTestFiles()`, `countTestsInProject()`, `getTestConfig()` | Consumed indirectly via gsd-tools dispatch. Already exports everything the command needs. |

### Supporting Libraries

No new supporting libraries required.

| Library | Status | Purpose | Notes |
|---------|--------|---------|-------|
| `zx` | ^8.0.0 (existing) | Not used by this feature | `/gsd:test-review` is a markdown command, not an autopilot extension. No zx involvement. |
| `@playwright/test` | ^1.50.0 (existing, devDep) | Not used by this feature | Test review analyzes unit/integration tests, not E2E. Playwright is unrelated. |

### Development Tools

No new development tools required.

| Tool | Status | Notes |
|------|--------|-------|
| `node:test` runner | existing | Tests for new CJS utility functions if any are extracted. Design doc says no new modules needed. |
| `c8` coverage | existing | Coverage reporting unchanged. New markdown files are not instrumented. |

## What Changes (File Additions, Not New Tools)

Four files are added or modified. No new modules, no new dependencies.

### 1. `commands/gsd/test-review.md` (NEW)

**Pattern:** Follows `audit-tests.md` (direct agent spawn with data gathering) combined with
`pr-review.md` (post-analysis routing with `--report-only`/`--quick`/`--milestone` options).

**Data gathering via existing tools:**
```bash
# Changed files list
git diff main...HEAD --name-only

# Full diff for agent analysis
git diff main...HEAD

# Test metadata via existing gsd-tools dispatch
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-count --raw
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" test-config
```

**Agent spawn:** `Task()` with `subagent_type="gsd-test-reviewer"`, passing diff + test data as
XML block input. Identical pattern to `audit-tests.md` spawning `gsd-test-steward`.

**Report persistence:** Write to `.planning/reviews/YYYY-MM-DD-test-review.md` using existing
`reviews/` directory (shared with pr-review reports). Commit via `gsd-tools.cjs commit`.

**Routing:** User-choice prompt after report display (quick task / milestone / done). Quick task
uses same directory structure and planner/executor pattern as pr-review. Milestone delegates to
`/gsd:new-milestone --auto` with MILESTONE-CONTEXT.md — same as brainstorm routing.

### 2. `agents/gsd-test-reviewer.md` (NEW)

**Pattern:** Read-only analysis agent, modeled on `gsd-test-steward.md`. Same tools
(Read, Bash, Grep, Glob), same constraint (never modifies source or test files).

**No code execution:** The agent reads files and diffs, performs static analysis, and produces
a markdown report. No test execution, no file modification.

**Shared vocabulary:** Uses same consolidation strategy terms as test steward
(prune/parameterize/promote/merge) but carries definitions inline in the agent prompt.
No code sharing needed — the terms are just markdown text.

### 3. `commands/gsd/help.md` (MODIFIED)

Add `/gsd:test-review` entry to the command reference table. Text edit only.

### 4. Documentation files (MODIFIED)

`USER-GUIDE.md` and `README.md` get documentation sections. Text edits only.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Inline git diff parsing by agent | `diff-parse` npm package for structured diff parsing | Only if the agent consistently fails to parse diffs from raw text. Claude handles unified diff format well — adding a parser library would mean a new CJS module wrapping the npm package. Not worth the complexity unless evidence shows parsing failures. |
| XML block input to agent | JSON input via gsd-tools | Only if Claude struggles with large XML blocks. The XML block pattern is proven across audit-tests and pr-review. JSON would require a new gsd-tools dispatch entry to serialize the diff, which adds unnecessary code. |
| User-choice routing (quick/milestone/done) | Automatic scoring like pr-review's hybrid heuristic | Only if users consistently make poor routing decisions. The test review report gives users enough information to choose. Automatic scoring adds complexity and may misroute — a test review with 20 findings might still be a quick task if they are all trivial. User judgment is better here. |
| Single agent (gsd-test-reviewer) | Reuse gsd-test-steward with a "diff mode" | Only if the two agents share significant prompt text (>50%). They don't — steward focuses on suite-wide health (budget, redundancy across all tests) while reviewer focuses on diff-scoped analysis (coverage gaps for changed code, staleness of affected tests). Separate agents with clear scopes are simpler than a modal agent. |
| Read-only agent + command routing | Agent that directly creates tasks/milestones | Never. The read-only constraint is a deliberate architectural decision. The agent produces a report; the command handles routing. Mixing analysis and action in one agent violates the separation proven across 14 existing agents. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `diff-parse` or `parse-diff` npm packages | Adds npm dependency for something Claude handles natively. Git unified diff format is well-understood by LLMs. Supply-chain surface with zero functional gain. | Raw `git diff` output passed directly to agent |
| New `gsd-tools` dispatch entries | No programmatic consumer exists. The command gathers data via existing entries (`test-count`, `test-config`) and shell commands (`git diff`). Adding CLI dispatch before a caller exists is premature. | Existing `test-count`, `test-config` dispatch + direct `git` commands |
| Workflow file (`workflows/test-review.md`) | The command is simple enough for inline execution (data gather + spawn agent + write report + route). Adding a workflow file is the pr-review pattern, but pr-review needed it for its complex ingest/parse/score/route pipeline. Test review's pipeline is simpler — closer to audit-tests which has no workflow file. | Direct agent spawn from command spec (audit-tests pattern) |
| Changes to `testing.cjs` | All needed functions already exist and are exported: `findTestFiles()`, `countTestsInProject()`, `getTestConfig()`. No new test analysis functions are needed — the agent does the analysis, not CJS code. | Existing `testing.cjs` exports via `gsd-tools.cjs` dispatch |
| Changes to `autopilot.mjs` | `/gsd:test-review` is an on-demand user command, not part of the autonomous pipeline. The autopilot has no awareness of it and needs none. | No change to autopilot |
| `gsd-tools.cjs commit` changes | The existing `commit` dispatch handles committing files with a message. The report file path and commit message are provided by the command spec. No structural changes needed. | Existing `gsd-tools.cjs commit` |

## Stack Patterns by Variant

**If no diff exists (branch is up-to-date with main):**
- `git diff main...HEAD --name-only` returns empty output
- Command displays "No changes found vs main" and exits
- No agent spawn, no report, no routing

**If `--report-only` flag is provided:**
- Command gathers data, spawns agent, writes report, exits
- Skips user-choice routing prompt
- Report still committed to `.planning/reviews/`

**If test count is zero (no tests in project):**
- Command still proceeds — the agent can recommend creating initial tests for changed files
- Agent input includes `test_count: 0` and empty `test_files` list
- Coverage gap analysis becomes "all changed files lack tests"

**If diff is very large (many changed files):**
- Full diff passed to agent via `git diff main...HEAD`
- Claude's context window handles large diffs well
- Agent naturally prioritizes highest-impact files in recommendations
- No truncation or pagination needed — the agent is a subagent with its own context window

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `gsd-tools.cjs test-count` | All existing testing.cjs versions | Returns raw count with `--raw` flag. Used by command for agent input. |
| `gsd-tools.cjs test-config` | All existing testing.cjs versions | Returns JSON config object. Used by command for agent input. |
| `gsd-tools.cjs commit` | All existing versions | Commits staged files with message. Used to persist report. |
| `.planning/reviews/` directory | Shared with pr-review reports | Both commands write timestamped reports here. No naming conflict — test-review uses `test-review` in filename, pr-review uses `pr-review`. |
| Quick task infrastructure | Existing STATE.md Source column | Design doc confirms quick task uses same directory structure and planner pattern as pr-review. Source column already supports generic entries. |
| Task() agent spawn | Claude Code CLI | Same `Task()` pattern used by audit-tests, pr-review, and all workflow agent spawns. |

## Sources

- `commands/gsd/audit-tests.md` — verified direct agent spawn pattern: data gathering via gsd-tools dispatch, Task() spawn with XML input, report display — HIGH confidence (direct codebase inspection)
- `commands/gsd/pr-review.md` — verified routing pattern: workflow delegation, `--quick`/`--milestone` flags, report persistence to `.planning/reviews/` — HIGH confidence (direct codebase inspection)
- `.planning/designs/2026-03-20-pr-test-review-command-design.md` — design doc specifying exact command flow, agent definition, input/output format, routing, and integration points — HIGH confidence (first-party design artifact)
- `get-shit-done/bin/lib/testing.cjs` — verified exports: `findTestFiles()`, `countTestsInProject()`, `getTestConfig()` all exist and are dispatched via gsd-tools — HIGH confidence (direct codebase inspection)
- `get-shit-done/bin/gsd-tools.cjs` — verified dispatch entries: `test-count` (line 642), `test-config` (line 659), `commit` exist — HIGH confidence (direct codebase inspection)
- `package.json` — confirmed dependencies: only `zx ^8.0.0` runtime, no YAML/diff parsing packages — HIGH confidence (direct codebase inspection)
- `agents/` directory — confirmed 14 existing agents, all markdown files with YAML frontmatter, establishing the pattern for `gsd-test-reviewer.md` — HIGH confidence (direct codebase inspection)

---
*Stack research for: GSD PR diff-aware test review command (v2.9)*
*Researched: 2026-03-21*
