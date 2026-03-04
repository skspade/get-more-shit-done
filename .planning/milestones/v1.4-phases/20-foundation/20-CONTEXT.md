# Phase 20: Foundation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI init command (`init linear`) and `/gsd:linear` command spec — the plumbing that Phase 21's workflow builds on. No workflow logic, no routing heuristic, no Linear fetching. Just the entry point and initialization data.

</domain>

<decisions>
## Implementation Decisions

### Init command output shape
- Claude's discretion on which models to resolve — determine based on what the linear.md workflow actually needs to spawn (it delegates to quick or milestone, which resolve their own models)
- Claude's discretion on routing config — decide whether thresholds live in workflow file or config.json based on how other workflows handle similar decisions
- Claude's discretion on quick task numbering — decide whether init linear pre-computes next_num or lets the workflow call init quick when needed
- No Linear-specific data in init output — MCP tool names and issue ID formats belong in the workflow, not init. Init focuses on GSD project state (paths, config, numbering)

### Command spec design
- Claude's discretion on allowed-tools — determine the right set of standard GSD tools plus Linear MCP tools based on what the workflow needs
- Follow full spec pattern like quick.md — name, description, argument-hint, allowed-tools, objective, execution_context

### Argument design
- Claude's discretion on issue ID passing — decide between single positional, multiple positional, or named flag based on CLI conventions and the use case
- Claude's discretion on missing-ID behavior — decide between prompting, listing recent issues, or erroring based on quick workflow pattern
- Claude's discretion on argument-hint detail level
- Claude's discretion on issue ID format validation — decide based on how Linear MCP handles bad IDs (likely accept any string, let MCP validate)

### Workflow file location
- Claude's discretion on where linear.md lives and how the command spec references it — follow existing conventions
- Claude's discretion on Phase 20 scope boundary — whether to create an empty linear.md skeleton or leave that entirely to Phase 21, based on Phase 20's success criteria

### Claude's Discretion
All four areas were delegated to Claude's judgment. The user trusts Claude to follow established GSD patterns: cmdInitX pattern in init.cjs, command spec frontmatter in commands/gsd/*.md, and the same conventions used by quick.md and other workflows.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User consistently selected "You decide" across all areas, indicating high trust in following established patterns.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/init.cjs`: 12 existing init commands — `cmdInitQuick` is the closest pattern (resolves models, finds next number, returns JSON with paths/config)
- `lib/core.cjs`: `resolveModelInternal`, `loadConfig`, `getMilestoneInfo`, `generateSlugInternal`, `pathExistsInternal` — all reusable
- `commands/gsd/quick.md`: Command spec template with frontmatter (name, description, argument-hint, allowed-tools, objective, execution_context)

### Established Patterns
- Init commands: function signature `cmdInitX(cwd, args, raw)`, calls `loadConfig(cwd)`, resolves models, assembles result object, calls `output(result, raw)`
- Command specs: YAML frontmatter with `---` delimiters, `@` file references in execution_context
- Module exports: all init commands exported from `init.cjs`, registered in `gsd-tools.cjs` switch/case router
- Tests: `init.test.cjs` covers all init subcommands

### Integration Points
- `gsd-tools.cjs` line 558: switch/case for init subcommands — needs `case 'linear':` added
- `init.cjs` module.exports: needs `cmdInitLinear` added
- `~/.claude/commands/gsd/`: needs `linear.md` command spec file
- `~/.claude/get-shit-done/workflows/`: where linear.md workflow will live (Phase 21)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-foundation*
*Context gathered: 2026-03-03*
