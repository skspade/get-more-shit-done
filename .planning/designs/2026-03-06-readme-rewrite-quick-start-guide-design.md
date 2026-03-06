# README Rewrite — Quick Start Guide — Design

**Date:** 2026-03-06
**Approach:** Quick Start + Brief Explainer

## Header & Identity

- Name: "GET MORE SHIT DONE" matching the fork
- Tagline: "Autonomous spec-driven development for Claude Code, OpenCode, Gemini CLI, and Codex."
- Only 2 badges: npm version + license (stripped token, Discord, stars, Twitter, test status)
- Install command front and center
- No quotes, testimonials, or "trusted by" claims
- No upstream branding (TÂCHES, $GSD token, star history)

```markdown
<div align="center">

# GET MORE SHIT DONE

**Autonomous spec-driven development for Claude Code, OpenCode, Gemini CLI, and Codex.**

[![npm version](https://img.shields.io/npm/v/get-more-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-more-shit-done-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

\`\`\`bash
npx get-more-shit-done-cc@latest
\`\`\`

</div>
```

## What This Does

- 5 bullets covering value prop + fork-specific differentiators (autopilot, CLI)
- One-sentence opener explaining what category this is
- Links to deeper docs at the bottom
- No "why I built this" story, no comparisons to other tools

```markdown
---

## What This Does

GSD is the context engineering layer that makes AI coding assistants reliable at scale.

- **Structured planning** — Questions → research → requirements → roadmap → atomic task plans
- **Fresh context per task** — Each plan executes in a clean 200k-token window. No context rot.
- **Autonomous execution** — Autopilot drives milestones from start to finish without intervention
- **Standalone CLI** — `gsd progress`, `gsd health`, `gsd todos` from any terminal
- **Multi-runtime** — Works with Claude Code, OpenCode, Gemini CLI, and Codex

[User Guide](docs/USER-GUIDE.md) · [CLI Reference](docs/CLI.md)
```

## Quick Start

- 3 numbered steps: install, init, build
- Core loop shown as the 4-command sequence with one-line descriptions
- `complete-milestone` as the capstone
- `quick` as the escape hatch for small tasks
- No config, no wave diagrams, no XML examples

```markdown
---

## Quick Start

### 1. Install

\`\`\`bash
npx get-more-shit-done-cc@latest
\`\`\`

Choose your runtime (Claude Code, OpenCode, Gemini, Codex) and scope (global or local).

### 2. Initialize a Project

\`\`\`
/gsd:new-project
\`\`\`

Asks questions about your idea, researches the domain, creates requirements and a phased roadmap.

### 3. Build It

\`\`\`
/gsd:discuss-phase 1    # Shape implementation decisions
/gsd:plan-phase 1       # Research + create atomic task plans
/gsd:execute-phase 1    # Execute plans in parallel, fresh context each
/gsd:verify-work 1      # Confirm it works as expected
\`\`\`

Repeat for each phase. When all phases are done:

\`\`\`
/gsd:complete-milestone
\`\`\`

### Quick Tasks

For one-off work that doesn't need full planning:

\`\`\`
/gsd:quick
\`\`\`
```

## Command Table + Footer

- 10 commands: 8 core workflow + progress and help
- Phase management, session, utilities, brainstorm, linear, debug omitted — discoverable via `/gsd:help` and User Guide
- Clean footer with license only — no star history, no community ports, no closing tagline

```markdown
---

## Commands

| Command | What it does |
|---------|--------------|
| `/gsd:new-project` | Initialize project: questions → research → requirements → roadmap |
| `/gsd:discuss-phase [N]` | Capture implementation decisions before planning |
| `/gsd:plan-phase [N]` | Research + create atomic task plans |
| `/gsd:execute-phase <N>` | Execute plans in parallel waves |
| `/gsd:verify-work [N]` | User acceptance testing |
| `/gsd:complete-milestone` | Archive milestone |
| `/gsd:new-milestone` | Start next version |
| `/gsd:quick` | Fast-track task with GSD guarantees |
| `/gsd:progress` | Show current status |
| `/gsd:help` | All commands and usage |

Full command reference and configuration: [User Guide](docs/USER-GUIDE.md)
Standalone CLI (`gsd progress`, `gsd health`, etc.): [CLI Reference](docs/CLI.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
```
