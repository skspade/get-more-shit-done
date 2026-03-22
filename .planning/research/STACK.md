# Technology Stack

**Project:** GSD Linear Interview Refactor (v3.0)
**Researched:** 2026-03-22

## Scope

This research covers ONLY what is new for v3.0: interview phase with adaptive questions, hybrid output (confirmation vs approach proposals), pre-execution comment-back, and removal of the numeric complexity scoring heuristic. The existing validated stack (Node.js CJS, zx/ESM, Claude Code CLI, Linear MCP tools, AskUserQuestion, markdown-based state) is NOT re-evaluated.

## Verdict: No New Dependencies

The interview phase, hybrid output, and pre-execution comment-back features are **entirely implementable with the existing stack**. This is a workflow-layer refactor -- modifications to two markdown files (`linear.md` workflow, `linear.md` command spec) plus documentation updates. Zero new npm packages, zero new CJS modules, zero new gsd-tools dispatch entries.

**Why:** Every building block already exists and is validated:
- **AskUserQuestion** -- used in brainstorm.md Step 3 for adaptive clarifying questions (exact same pattern)
- **mcp create_comment** -- used in linear.md Step 6 for comment-back (called a second time earlier)
- **Approach proposals** -- used in brainstorm.md Step 4 for 2-3 approaches with pros/cons (reused for milestone route)
- **String interpolation in markdown** -- used in every GSD workflow for building context blocks

## Recommended Stack (No Changes)

### Core Technologies

| Technology | Version | Purpose | Status for v3.0 |
|------------|---------|---------|-----------------|
| Node.js | >=16.7.0 | CJS modules, CLI, gsd-tools | No change |
| zx | ^8.0.0 | ESM autopilot script | No change (not involved in this feature) |
| Claude Code CLI | current | Executes command spec, workflow interpretation | No change |

### Linear MCP Tools (Already Available)

| MCP Tool | Purpose | v3.0 Usage |
|----------|---------|------------|
| `mcp__plugin_linear_linear__get_issue` | Fetch issue data (Step 2) | Unchanged |
| `mcp__plugin_linear_linear__list_comments` | Fetch comments (Step 2) | Unchanged |
| `mcp__plugin_linear_linear__create_comment` | Post comments | **Called twice now:** Step 5.5 (interview summary, NEW) + Step 8 (completion summary, existing) |
| `mcp__plugin_linear_linear__list_issues` | Listed in allowed-tools | Not used by interview features |

### Interaction Tools (Already Available)

| Tool | Purpose | v3.0 Usage |
|------|---------|------------|
| `AskUserQuestion` | Adaptive interview questions (Steps 3-5) | **Primary new interaction mechanism.** Called 3-5 times for interview, plus 1 time for confirmation/approach selection. Same API as brainstorm.md. |
| `Task()` | Subagent spawning for planner/executor/verifier | Unchanged |

## Integration Points

### AskUserQuestion Pattern (Validated in brainstorm.md)

The interview phase reuses the exact AskUserQuestion pattern from brainstorm.md Step 3:

1. **Multiple choice** -- when options are enumerable (complexity signal: "Quick task / Medium / Milestone")
2. **Open-ended** -- when domain is too broad (goal clarification, additional context)
3. **Skip logic** -- pre-scan ticket data, skip questions already answered by ticket content
4. **Incorporate and adapt** -- each answer informs the next question

No new tool configuration needed. `AskUserQuestion` is already in the command spec's `allowed-tools` list.

### Comment-Back Pattern (Validated in linear.md Step 6)

The pre-execution comment-back (new Step 5.5) uses the identical MCP call and error handling:

```
mcp__plugin_linear_linear__create_comment(
  issueId: issue.id,
  body: interview_comment_body
)
```

Error handling: warning on failure, do not block execution. Same pattern as existing Step 6.

Difference from existing: timing (before execution vs after) and content (interview summary vs completion summary).

### Approach Proposals Pattern (Validated in brainstorm.md Step 4)

The milestone-route hybrid output presents 2-3 approaches with pros/cons and a recommendation. This is brainstorm.md Step 4's pattern applied in the linear workflow context. The selected approach feeds into MILESTONE-CONTEXT.md under a new `## Selected Approach` section.

## What Changes (File Modifications Only)

| File | Change Type | What Changes |
|------|-------------|--------------|
| `get-shit-done/workflows/linear.md` | Major refactor | Remove Step 3 heuristic scoring. Add Steps 3 (interview), 4 (routing from interview), 5 (hybrid output), 5.5 (pre-execution comment-back). Renumber old Steps 4-7 to 6-9. Modify Step 6 to add `interview_summary` to linear-context.md frontmatter. Modify Step 7 quick description synthesis to use interview context instead of truncated ticket text. Modify Step 7 milestone MILESTONE-CONTEXT.md to include selected approach. |
| `commands/gsd/linear.md` | Minor update | Update `<objective>` description to mention interview phase. No tool list changes needed. |
| Documentation files | Minor updates | help.md, USER-GUIDE.md, README.md get updated descriptions. |

### linear-context.md Schema Change

Current frontmatter:
```yaml
---
issue_ids: [LIN-123]
route: quick
score: 3
fetched: 2026-03-22
---
```

New frontmatter (v3.0):
```yaml
---
issue_ids: [LIN-123]
route: quick
fetched: 2026-03-22
interview_summary: "Goal: ... Scope: ... Criteria: ..."
---
```

**Removed:** `score` field (numeric heuristic eliminated).
**Added:** `interview_summary` text field.

### MILESTONE-CONTEXT.md Addition (Milestone Route Only)

New section appended when milestone route is selected via approach proposals:

```markdown
## Selected Approach

**Approach:** {approach name}
{2-3 sentence approach description from user's selection}
```

## What NOT to Add

| Temptation | Why Not |
|------------|---------|
| Prompt templating library (handlebars, mustache) | Markdown string interpolation in workflow files is the GSD pattern. Every workflow does this. Zero-dependency is a project value. |
| JSON schema for interview responses | AskUserQuestion returns strings or option selections. Validation is inline conditional logic, not a schema concern. |
| State machine library (xstate) | Interview flow is 3-5 sequential questions with skip conditions. A conditional loop is sufficient. State machines are for complex branching; this is linear with skips. |
| Conversation memory library | `$INTERVIEW_CONTEXT` is a markdown string accumulated during one workflow run. No persistence beyond the session. |
| LLM orchestration framework (langchain) | Conflicts with "native GSD extension" architecture constraint. Claude Code's workflow interpretation is the orchestration layer. |
| New MCP tools | All required Linear operations (get_issue, list_comments, create_comment) already exist in allowed-tools. |
| New gsd-tools dispatch entries | No programmatic consumers exist. The workflow operates entirely in Claude Code's markdown interpretation layer. |
| New CJS modules | Interview logic lives in the workflow markdown, not in Node.js code. No parsing, scoring, or state management needs to move to CJS. |

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Interview via AskUserQuestion | AskUserQuestion (existing) | Custom CLI prompts via readline | AskUserQuestion is the GSD interaction pattern. readline bypasses Claude Code's tool model. |
| Interview context as markdown string | `$INTERVIEW_CONTEXT` variable | Structured JSON object | Workflow files operate on markdown. JSON needs parsing. Consumer (Linear comment, context file) is also markdown. |
| Routing from complexity signal answer | Direct string match | Weighted scoring on all answers | Design explicitly replaces scoring. Reintroducing scoring defeats the refactor's purpose. |
| Two Linear comments (pre + post) | Separate calls at Step 5.5 and Step 8 | Single combined comment after execution | Pre-execution comment gives real-time visibility into GSD's understanding. Users see the summary before work starts. |
| Skip logic via pre-scan | Claude reads ticket then decides which questions to skip | Always ask all 5 questions | Pre-scan is the brainstorm pattern. Asking already-answered questions wastes user time and feels robotic. |

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `AskUserQuestion` | All Claude Code versions | Core tool, stable API. Used across brainstorm, linear, and other commands. |
| `mcp create_comment` | Linear MCP plugin (current) | Same call signature as existing Step 6. No API changes needed. |
| `Task()` spawn | All Claude Code versions | Standard subagent pattern. Unchanged for planner/executor/verifier. |
| `.planning/linear-context.md` | Backward compatible | `score` field removed, `interview_summary` added. Old consumers (Step 6 completion loop) read `issue_ids` and `route`, which remain. |
| `.planning/MILESTONE-CONTEXT.md` | Backward compatible | New `## Selected Approach` section appended. `new-milestone.md` reads features/context sections; new section is additive. |
| `--quick` / `--milestone` / `--full` flags | Unchanged behavior | Flags still override routing. With interview: skip complexity question but still run other interview questions. |

## Sources

- Design document: `.planning/designs/2026-03-22-refactor-linear-ticket-flow-interview-design.md` -- PRIMARY source for all feature specifications (HIGH confidence, first-party design artifact)
- Existing workflow: `get-shit-done/workflows/linear.md` -- current implementation being refactored (HIGH confidence, direct codebase inspection)
- Brainstorm workflow: `get-shit-done/workflows/brainstorm.md` -- pattern reference for AskUserQuestion adaptive questions (Step 3) and approach proposals (Step 4) (HIGH confidence, direct codebase inspection)
- Command spec: `commands/gsd/linear.md` -- allowed-tools list confirming AskUserQuestion and all 4 Linear MCP tools (HIGH confidence, direct codebase inspection)
- PROJECT.md: `.planning/PROJECT.md` -- architecture constraints ("native GSD extension"), out-of-scope items, existing validated capabilities (HIGH confidence, direct codebase inspection)
- `package.json` -- confirmed dependencies: only `zx ^8.0.0` runtime, no new packages needed (HIGH confidence, direct codebase inspection)

---
*Stack research for: GSD Linear Interview Refactor (v3.0)*
*Researched: 2026-03-22*
