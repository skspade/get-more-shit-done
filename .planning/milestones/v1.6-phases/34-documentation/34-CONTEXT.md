# Phase 34: Documentation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

All test architecture features built in phases 30-33 are documented for users. Three documentation files are updated: help.md (command reference), USER-GUIDE.md (test architecture usage guide), and README.md (test configuration section). This is a documentation-only phase -- no code changes, only markdown updates to existing files.

</domain>

<decisions>
## Implementation Decisions

### help.md Updates (DOC-01)
- Add `test-count` command reference under a new "### Test Suite Management" subsection within the existing command structure
- Add `/gsd:audit-tests` command reference with description, usage, and what it produces
- Add `test.*` configuration keys to the Configuration section or a new "### Test Configuration" subsection alongside existing config documentation
- Document `test.hard_gate`, `test.acceptance_tests`, `test.budget.per_phase`, `test.budget.project`, `test.steward`, `test.command`, `test.framework` keys with defaults and behavior
- Place test commands near other utility/audit commands to maintain logical grouping (Claude's Decision: test commands are verification-class utilities, grouping near audit-milestone is natural)

### USER-GUIDE.md Updates (DOC-02)
- Add a new "## Test Architecture" top-level section to USER-GUIDE.md
- Explain the dual-layer model: Layer 1 (acceptance tests -- human-defined in CONTEXT.md) and Layer 2 (unit/regression tests -- AI-generated in PLAN.md)
- Explain the hard gate: what it does (runs test suite after each task commit), TDD awareness (recognizes RED commits), baseline comparison (only blocks on NEW failures), and how it integrates with execute-plan
- Explain the test steward: what it does (redundancy, staleness, budget analysis), when it runs (audit-milestone and `/gsd:audit-tests`), and that proposals require human approval
- Explain budget management: per-phase (default 50) and project (default 800) limits, how they surface as warnings, and planner budget awareness
- Add test configuration keys to the existing "### Full config.json Schema" example JSON and the Configuration Reference tables
- Add a test workflow diagram showing the dual-layer flow (Claude's Decision: USER-GUIDE has diagrams for other workflows; visual consistency helps users understand the test lifecycle)
- Add troubleshooting entries for common test-related issues (Claude's Decision: USER-GUIDE troubleshooting section covers other feature areas; test issues should follow the same pattern)
- Add `gsd-test-steward` to the Model Profiles table alongside existing agent entries

### README.md Updates (DOC-03)
- Add a new "### Test Configuration" subsection in the existing "## Configuration" section
- Show how to enable and configure the dual-layer test system with a config.json example containing the `test.*` keys
- Keep it concise -- README is the overview, not the full guide; link to USER-GUIDE.md for details
- Add `/gsd:audit-tests` to the Utilities commands table in the Commands section
- Add `gsd test-count` to the standalone CLI commands section (Claude's Decision: test-count is a registered CLI command and should appear alongside progress/todos/health/settings/help)

### Content Style and Tone
- Match existing documentation style: imperative descriptions, table-based references, code examples with realistic output (Claude's Decision: consistency with existing docs reduces cognitive load for readers)
- Use the same formatting conventions as existing sections: `|` tables for settings, ` ``` ` blocks for examples, `**bold**` for key terms
- Keep the README section brief (a table + example + link to USER-GUIDE) and the USER-GUIDE section comprehensive with examples (Claude's Decision: mirrors the existing depth split between README and USER-GUIDE)
- Do not duplicate the full config schema -- reference it from the USER-GUIDE config section where it already lives

### Documentation Scope
- Document only features that were actually built in phases 30-33
- Do not document deferred features (auto-consolidation, coverage percentages, visual reports)
- Acceptance tests are documented as interactive-only (not available in auto-context / autopilot mode)
- Document `test.command` and `test.framework` as auto-detected with optional manual override

### Claude's Discretion
- Exact wording of section headings within the test architecture guide
- Whether the test workflow diagram uses ASCII art or a simpler text-based description
- Exact ordering of sub-sections within the USER-GUIDE test architecture section
- Whether to add a "See Also" cross-reference at the bottom of each updated section
- Table of contents entry wording in USER-GUIDE.md

</decisions>

<specifics>
## Specific Ideas

- The `test.*` config keys and their defaults are defined in testing.cjs TEST_CONFIG_DEFAULTS: `hard_gate: true`, `acceptance_tests: true`, `budget.per_phase: 50`, `budget.project: 800`, `steward: true`, with `command` and `framework` auto-detected
- The `gsd test-count` CLI command is already registered in cli.cjs COMMANDS table with usage `gsd test-count [--phase N] [--json] [--plain]`
- The `/gsd:audit-tests` command spec is in `commands/gsd/audit-tests.md` -- it spawns the gsd-test-steward agent for on-demand health checks
- The gsd-test-steward is registered in model-profiles.md and core.cjs MODEL_PROFILES with sonnet/sonnet/haiku tiers
- Zero-config degradation is a core design principle: all test features work without any config.json entries, using defaults; absent keys treated as defaults
- Acceptance tests use Given/When/Then/Verify format with AT-{NN} identifiers, gathered during interactive discuss-phase only
- help.md lives at `get-shit-done/workflows/help.md` and is displayed by the `/gsd:help` command
- CLI.md at `docs/CLI.md` documents the standalone `gsd` CLI -- needs `test-count` added

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/help.md`: Complete command reference -- test commands and config need to be inserted into the existing structure
- `docs/USER-GUIDE.md`: User guide with workflow diagrams, command reference tables, config reference, and troubleshooting -- test architecture section integrates here
- `README.md`: Project README with configuration section and commands tables -- test config subsection goes here
- `docs/CLI.md`: CLI reference for standalone `gsd` commands -- `test-count` is already in cli.cjs COMMANDS but missing from this doc

### Established Patterns
- help.md uses `###` subsections under `## Core Workflow`, `## Common Workflows`, etc. -- test commands follow this hierarchy
- USER-GUIDE.md has a Table of Contents with anchor links, `## Section` headers with `### Subsection` breakdowns, workflow diagrams in ASCII art, and configuration tables with `| Setting | Options | Default | What it Controls |` format
- README.md Configuration section has a "Core Settings" table, "Model Profiles" table, and "Workflow Agents" table -- test config can follow this pattern or extend the workflow agents table
- CLI.md documents each command with usage, description, flags, examples, and JSON output fields
- All documentation uses backtick code blocks for commands and config examples

### Integration Points
- `get-shit-done/workflows/help.md`: Insert `/gsd:audit-tests` entry and `test.*` config references
- `docs/USER-GUIDE.md`: Add "Test Architecture" section, update config schema example, update model profiles table, add troubleshooting entries
- `README.md`: Add test configuration subsection in Configuration, add `/gsd:audit-tests` to Utilities command table, add `gsd test-count` to CLI section
- `docs/CLI.md`: Add `gsd test-count` command documentation matching existing command doc format

</code_context>

<deferred>
## Deferred Ideas

- Documentation for auto-consolidation (steward.auto_consolidate) -- feature is explicitly deferred
- Documentation for coverage percentage targets -- out of scope per REQUIREMENTS.md
- Documentation for visual test reports (HTML/dashboard) -- out of scope per REQUIREMENTS.md
- Documentation for acceptance test generation in autopilot mode -- explicitly deferred to post-v1.6
- Interactive tutorial or guided walkthrough for test setup -- documentation phase is reference-only

</deferred>

---

*Phase: 34-documentation*
*Context gathered: 2026-03-05 via auto-context*
