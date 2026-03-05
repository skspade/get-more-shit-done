# Phase 34: Documentation - Research

**Researched:** 2026-03-05
**Domain:** Documentation updates for dual-layer test architecture (phases 30-33)
**Confidence:** HIGH

## Summary

Phase 34 is a documentation-only phase that updates four existing markdown files (help.md, USER-GUIDE.md, README.md, CLI.md) to document the test architecture features built in phases 30-33. No code changes are needed -- only markdown edits to existing files.

The existing documentation files have well-established patterns: help.md uses `###` subsections under category headers, USER-GUIDE.md uses a table of contents with anchor links and configuration tables, README.md has concise command tables and a configuration section, and CLI.md documents each command with usage/description/flags/examples format.

**Primary recommendation:** Create 3 plans mapped to the 3 requirements (DOC-01, DOC-02, DOC-03), plus CLI.md updates bundled with the closest match. All plans are independent (Wave 1) since they edit different files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- help.md: Add `test-count` command reference under a new "### Test Suite Management" subsection
- help.md: Add `/gsd:audit-tests` command reference
- help.md: Add `test.*` configuration keys to Configuration section
- help.md: Document `test.hard_gate`, `test.acceptance_tests`, `test.budget.per_phase`, `test.budget.project`, `test.steward`, `test.command`, `test.framework` keys with defaults and behavior
- USER-GUIDE.md: Add a new "## Test Architecture" top-level section
- USER-GUIDE.md: Explain dual-layer model (Layer 1: acceptance tests, Layer 2: unit/regression tests)
- USER-GUIDE.md: Explain hard gate, TDD awareness, baseline comparison
- USER-GUIDE.md: Explain test steward, when it runs, proposals require human approval
- USER-GUIDE.md: Explain budget management (per-phase default 50, project default 800)
- USER-GUIDE.md: Add test config keys to Full config.json Schema and Configuration Reference tables
- USER-GUIDE.md: Add `gsd-test-steward` to Model Profiles table
- USER-GUIDE.md: Add troubleshooting entries for test-related issues
- README.md: Add "### Test Configuration" subsection in Configuration section
- README.md: Show config.json example with `test.*` keys
- README.md: Add `/gsd:audit-tests` to Utilities commands table
- README.md: Add `gsd test-count` to standalone CLI commands section
- Content style: Match existing documentation style (imperative descriptions, tables, code examples)
- Document only features actually built in phases 30-33
- Do not document deferred features (auto-consolidation, coverage percentages, visual reports)

### Claude's Discretion
- Exact wording of section headings within the test architecture guide
- Whether the test workflow diagram uses ASCII art or simpler text-based description
- Exact ordering of sub-sections within USER-GUIDE test architecture section
- Whether to add "See Also" cross-references at the bottom of each updated section
- Table of contents entry wording in USER-GUIDE.md

### Deferred Ideas (OUT OF SCOPE)
- Documentation for auto-consolidation (steward.auto_consolidate) -- feature is explicitly deferred
- Documentation for coverage percentage targets -- out of scope per REQUIREMENTS.md
- Documentation for visual test reports (HTML/dashboard) -- out of scope per REQUIREMENTS.md
- Documentation for acceptance test generation in autopilot mode -- explicitly deferred to post-v1.6
- Interactive tutorial or guided walkthrough for test setup -- documentation phase is reference-only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | help.md updated with test-related commands and configuration | help.md structure analyzed; insertion points identified for test commands and config keys |
| DOC-02 | USER-GUIDE.md updated with test architecture usage guide | USER-GUIDE.md structure analyzed; Table of Contents, config schema, model profiles table, troubleshooting section identified |
| DOC-03 | README.md updated with test configuration section | README.md structure analyzed; Configuration section, Utilities table, CLI section identified |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown | N/A | Documentation format | All existing docs use markdown |

### Supporting
No additional tools needed -- this is pure documentation editing.

## Architecture Patterns

### Documentation File Locations
```
get-shit-done/workflows/help.md    # /gsd:help command reference
docs/USER-GUIDE.md                  # Detailed user guide
docs/CLI.md                         # Standalone CLI reference
README.md                           # Project README
```

### Pattern 1: help.md Command Reference
**What:** Each command is documented with bold name, description, bullet points for features, and Usage line
**When to use:** Adding new commands to help.md
**Example structure:**
```markdown
**`/gsd:command-name`**
Brief description.

- Feature 1
- Feature 2

Usage: `/gsd:command-name [args]`
```

### Pattern 2: USER-GUIDE.md Configuration Tables
**What:** Settings documented in tables with Setting | Options | Default | What it Controls columns
**When to use:** Adding new config keys
**Example structure:**
```markdown
| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `test.hard_gate` | `true`, `false` | `true` | Run test suite after each task commit |
```

### Pattern 3: README.md Command Tables
**What:** Commands documented in compact tables with Command | What it does columns
**When to use:** Adding commands to README command tables
**Example structure:**
```markdown
| `/gsd:audit-tests` | Run on-demand test suite health check |
```

### Pattern 4: CLI.md Command Documentation
**What:** Each command has its own `### gsd command` section with usage, description, flags, examples, and JSON output fields
**When to use:** Adding new CLI commands
**Example:** Follow the existing `gsd health` or `gsd todos` section format

### Anti-Patterns to Avoid
- **Duplicating full config schema:** README should be concise and link to USER-GUIDE for details
- **Documenting deferred features:** Only document what was actually built
- **Breaking existing formatting:** Match existing table column headers, heading levels, code block styles

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config documentation | Custom format | Existing table format from USER-GUIDE.md | Consistency with established docs |

## Common Pitfalls

### Pitfall 1: Inconsistent Heading Levels
**What goes wrong:** New sections use wrong heading level, breaking document hierarchy
**Why it happens:** Each file has different conventions
**How to avoid:** help.md uses `###` under `##` categories; USER-GUIDE.md uses `##` for major sections with `###` subsections; README.md uses `###` under `##` Configuration
**Warning signs:** Table of contents links break; document looks visually inconsistent

### Pitfall 2: Missing Table of Contents Entry
**What goes wrong:** New section added to USER-GUIDE.md but not linked in TOC
**Why it happens:** TOC is manually maintained
**How to avoid:** Add anchor link for every new `##` section in the TOC list

### Pitfall 3: Documenting Unbuilt Features
**What goes wrong:** Describing auto-consolidation or coverage percentages that don't exist yet
**Why it happens:** Requirements doc lists them as deferred
**How to avoid:** Only reference features verified in phase 30-33 summaries

## Key Content to Document

### Test Config Keys (from testing.cjs TEST_CONFIG_DEFAULTS)
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `test.hard_gate` | boolean | `true` | Run test suite after each task commit during execution |
| `test.acceptance_tests` | boolean | `true` | Gather acceptance tests during discuss-phase |
| `test.budget.per_phase` | integer | `50` | Maximum tests per phase (warning threshold) |
| `test.budget.project` | integer | `800` | Maximum tests project-wide (warning threshold) |
| `test.steward` | boolean | `true` | Enable test steward during audit-milestone |
| `test.command` | string | auto-detected | Override test runner command |
| `test.framework` | string | auto-detected | Override framework detection (jest, vitest, mocha, node:test) |

### gsd-test-steward Model Profile (from core.cjs)
| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| gsd-test-steward | Sonnet | Sonnet | Haiku |

### Commands to Document
- `/gsd:audit-tests` -- On-demand test suite health check (spawns gsd-test-steward)
- `gsd test-count [--phase N] [--json] [--plain]` -- Count test cases in project

## Sources

### Primary (HIGH confidence)
- testing.cjs source code -- TEST_CONFIG_DEFAULTS verified at lines 216-224
- core.cjs -- MODEL_PROFILES verified to include gsd-test-steward
- commands/gsd/audit-tests.md -- command spec verified
- Phase 30-33 SUMMARY.md files -- confirmed what was actually built
- Existing documentation files -- structure and patterns analyzed directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pure markdown editing, no libraries needed
- Architecture: HIGH - all target files read and analyzed
- Pitfalls: HIGH - based on direct analysis of existing documentation patterns

**Research date:** 2026-03-05
**Valid until:** Indefinite (documentation patterns are stable)
