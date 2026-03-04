# Phase 28: Documentation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The `/gsd:brainstorm` command is discoverable and documented in all user-facing reference materials. This phase updates three existing documentation files -- `help.md`, `USER-GUIDE.md`, and `README.md` -- to include the brainstorm command with its purpose, usage, and examples. No new files are created; no code changes. The brainstorm command and workflow are fully implemented in Phases 25-27.

</domain>

<decisions>
## Implementation Decisions

### help.md Updates (DOCS-01)
- Add `/gsd:brainstorm` entry to the help.md command reference in `get-shit-done/workflows/help.md` (from REQUIREMENTS.md DOCS-01)
- Place the entry in a new "Brainstorming" section between "Milestone Management" and "Progress Tracking" (Claude's Decision: brainstorming precedes phase planning in the workflow lifecycle, so it belongs before progress tracking but after milestone management where new-milestone lives)
- Entry includes: command name, description, how-it-works summary, usage examples with and without topic argument, and output description (Claude's Decision: matches the detail level of existing help.md entries like `/gsd:linear`, `/gsd:debug`, and `/gsd:new-project`)

### USER-GUIDE.md Updates (DOCS-02)
- Add a "Brainstorming" section to `docs/USER-GUIDE.md` with usage instructions and at least one example (from REQUIREMENTS.md DOCS-02)
- Place the section in the Command Reference tables under a new "Brainstorming" group row (Claude's Decision: follows the existing table grouping pattern used for "Core Workflow", "Navigation", "Phase Management", "Brownfield & Utilities")
- Add a usage example block in the "Usage Examples" section showing the brainstorm-to-milestone flow (Claude's Decision: demonstrates the full value proposition of brainstorm -- from idea to milestone creation)
- Add `/gsd:brainstorm` to the full project lifecycle workflow diagram (Claude's Decision: brainstorm is an alternative entry point alongside new-project, showing it in the diagram aids discoverability)

### README.md Updates (DOCS-03)
- Add `/gsd:brainstorm` entry to the Commands section in `README.md` (from REQUIREMENTS.md DOCS-03)
- Add a row to the "Utilities" command table: `/gsd:brainstorm [topic]` with description (Claude's Decision: brainstorm is a standalone utility command like debug and linear, not part of the core phase workflow)

### Content Consistency
- Command description across all three files uses consistent language describing the brainstorm flow (Claude's Decision: prevents confusion from divergent descriptions across docs)
- Usage syntax shown as `/gsd:brainstorm [topic]` with brackets indicating optional argument (from command file argument-hint: "[topic]")

### Claude's Discretion
- Exact wording of the command description in each file
- Whether to add brainstorm to the USER-GUIDE.md workflow diagram or just the command tables
- Ordering of example scenarios within the usage example block
- Whether to mention the `--auto` routing detail in help.md or keep it high-level

</decisions>

<specifics>
## Specific Ideas

- The brainstorm command has a well-defined flow from the command file objective: explore context, ask clarifying questions, propose approaches, present design in sections, write design doc, optionally route into milestone/project creation. Documentation should describe this flow at an appropriate summary level for each doc.
- help.md is the most detailed reference (currently ~490 lines) -- it should include the full step-by-step flow. USER-GUIDE.md uses command tables with brief purpose descriptions. README.md uses the most concise format (one-line descriptions in tables).
- The `/gsd:linear` documentation added in Phase 23 (v1.4) is the closest precedent: it added entries to all three files with flags, routing heuristic explanation, and examples. The brainstorm command is simpler (no flags, no scoring heuristic) so its documentation should be proportionally lighter.
- Out of scope per REQUIREMENTS.md: modifying upstream brainstorming skill docs, design templates, interactive design editor docs.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/help.md`: The help reference file. Contains `<reference>` tag with full command documentation organized by category sections. Each command entry has: bold command name, description paragraph, bullet list of features, and usage example.
- `docs/USER-GUIDE.md`: User guide with command reference tables (Command | Purpose | When to Use), workflow diagrams, usage examples, and troubleshooting. Linear integration section (lines 386-424) is the most recent addition and serves as the pattern for the brainstorm section.
- `README.md`: Project README with Commands section containing grouped tables (Core Workflow, Navigation, Brownfield, Phase Management, Session, Utilities). Each row is: command with args | one-line description. Linear entry is the last row in the Utilities table.

### Established Patterns
- help.md command entries follow: `**\`/gsd:command\`**` heading, description paragraph, bullet list of capabilities, `Usage: /gsd:command [args]` line, optional `Result:` line
- USER-GUIDE.md command tables use: `| /gsd:command | Purpose | When to use |` format
- README.md command tables use: `| /gsd:command [args] | What it does |` format
- New command documentation added in all three files simultaneously (established by Phase 23 Linear docs)

### Integration Points
- Modify `get-shit-done/workflows/help.md`: Add brainstorm section in the `<reference>` content
- Modify `docs/USER-GUIDE.md`: Add brainstorm row to command table, add usage example section
- Modify `README.md`: Add brainstorm row to Utilities command table
- No other files modified -- purely documentation updates

</code_context>

<deferred>
## Deferred Ideas

- Autopilot-compatible mode documentation (Future, BRAIN-06 -- not yet implemented)
- Resume from saved design documentation (Future, BRAIN-07 -- not yet implemented)
- Design templates documentation (out of scope per REQUIREMENTS.md)

</deferred>

---

*Phase: 28-documentation*
*Context gathered: 2026-03-04 via auto-context*
