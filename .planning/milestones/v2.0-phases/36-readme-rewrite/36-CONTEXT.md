# Phase 36: README Rewrite - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Replace the current 746-line upstream README with a minimal quick start guide under 150 lines. The new README uses fork branding ("GET MORE SHIT DONE"), strips all upstream-specific content, and gives a new user everything they need to install, initialize, build, and complete a milestone -- with links to User Guide and CLI Reference for deeper discovery.

</domain>

<decisions>
## Implementation Decisions

### Identity and Branding
- Header uses "GET MORE SHIT DONE" title (not upstream "GET SHIT DONE")
- Only two badges: npm version and license -- no token, Discord, stars, Twitter, or test status badges
- No upstream branding anywhere: no TACHES, $GSD token, star history, community ports
- No testimonials, "trusted by" claims, or author attribution (TACHES signoff)
- Install command (`npx get-more-shit-done-cc@latest`) displayed front and center in the header block

### Content Structure
- One-sentence opener describing what GSD is: "the context engineering layer that makes AI coding assistants reliable at scale"
- Five value-prop bullets covering: structured planning, fresh context per task, autonomous execution, standalone CLI, multi-runtime
- Links to User Guide (`docs/USER-GUIDE.md`) and CLI Reference (`docs/CLI.md`) placed after the value-prop section
- Tagline: "Autonomous spec-driven development for Claude Code, OpenCode, Gemini CLI, and Codex."

### Quick Start Flow
- Three numbered steps: Install, Initialize a Project, Build It
- Install step shows `npx get-more-shit-done-cc@latest` with one-line note about runtime/scope choice
- Initialize step shows `/gsd:new-project` with one-line description
- Build step shows the 4-command core loop (`discuss-phase`, `plan-phase`, `execute-phase`, `verify-work`) with inline comments
- `/gsd:complete-milestone` shown as the capstone after core loop
- `/gsd:quick` shown as a separate sub-section for one-off tasks

### Command Table
- Exactly 10 commands in a single table: new-project, discuss-phase, plan-phase, execute-phase, verify-work, complete-milestone, new-milestone, quick, progress, help
- Phase management, session, utility, and integration commands omitted from table -- discoverable via `/gsd:help`
- Footer links below the table pointing to User Guide for full command reference and CLI Reference for standalone CLI

### Cleanup and Constraints
- Total README length under 150 lines (target ~120-130)
- No upstream-specific sections: Why I Built This, Who This Is For, wave diagrams, XML examples, config tables, security, troubleshooting, community ports, star history
- No detailed configuration reference -- lives in User Guide
- No non-interactive install flags section -- deferred to User Guide
- No "Recommended: Skip Permissions Mode" section -- deferred to User Guide
- Clean footer: License section only, no closing tagline or star history chart

### Content Approach
- This is a complete rewrite, not an edit of the existing file -- the current 746-line README is replaced wholesale (Claude's Decision: editing the existing file would be error-prone given the scale of removal; a clean write ensures no upstream residue survives)
- Use the brainstorm design doc as the content blueprint -- it contains user-approved section structure and exact markdown (Claude's Decision: design doc was created via `/gsd:brainstorm` and represents the user's approved design)
- Centered header block using `<div align="center">` wrapping title, tagline, badges, and install command (Claude's Decision: matches the design doc format and GitHub rendering conventions)

### Claude's Discretion
- Exact badge styling parameters (for-the-badge vs flat, colors)
- Whether horizontal rules (`---`) appear between every section or selectively
- Exact wording of one-line command descriptions in the table
- Whitespace and blank line placement within markdown sections

</decisions>

<specifics>
## Specific Ideas

The brainstorm design doc (`.planning/designs/2026-03-06-readme-rewrite-quick-start-guide-design.md`) provides complete markdown content for every section. The executor should use this as the primary content source:

- **Header block**: Exact markdown with centered div, title, tagline, 2 badges, install command
- **What This Does**: One-sentence opener + 5 bolded value-prop bullets
- **Quick Start**: 3 numbered steps (Install, Initialize a Project, Build It) with core loop commands shown with inline comments
- **Commands table**: 10-row table with command and description columns, plus footer links
- **License**: Single line with link to LICENSE file

The 10 commands for the table (from CMD-01): new-project, discuss-phase, plan-phase, execute-phase, verify-work, complete-milestone, new-milestone, quick, progress, help.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Brainstorm design doc** (`.planning/designs/2026-03-06-readme-rewrite-quick-start-guide-design.md`): Contains the complete approved content structure with exact markdown for every section of the new README
- **Current README** (`README.md`): 746 lines of upstream content to be fully replaced -- useful only as a reference for what must NOT appear in the new version

### Established Patterns
- **Badge format**: Current README uses `for-the-badge` style shields.io badges -- the design doc preserves this style for the two remaining badges (npm, license)
- **Command naming**: All GSD commands use `/gsd:` prefix with kebab-case names -- the command table must follow this convention exactly

### Integration Points
- **docs/USER-GUIDE.md**: Linked from the new README as the destination for full command reference, configuration, troubleshooting, and security guidance
- **docs/CLI.md**: Linked from the new README for standalone CLI documentation (`gsd progress`, `gsd health`, etc.)
- **LICENSE**: Referenced in the license section footer

</code_context>

<deferred>
## Deferred Ideas

- Configuration reference in README -- lives in User Guide (from REQUIREMENTS.md Out of Scope)
- Troubleshooting section -- lives in User Guide (from REQUIREMENTS.md Out of Scope)
- Security guidance -- lives in User Guide (from REQUIREMENTS.md Out of Scope)
- Wave execution diagrams -- removed, too detailed for quick start (from REQUIREMENTS.md Out of Scope)
- Model profile documentation -- lives in User Guide (from REQUIREMENTS.md Out of Scope)
- Non-interactive install flags -- defer to User Guide or inline help (from REQUIREMENTS.md Out of Scope)
- Recommended permissions mode section -- omitted from README, available in User Guide

</deferred>

---

*Phase: 36-readme-rewrite*
*Context gathered: 2026-03-06 via auto-context*
