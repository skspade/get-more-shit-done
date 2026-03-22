<div align="center">

# GET MORE SHIT DONE

**Autonomous spec-driven development for Claude Code, OpenCode, Gemini CLI, and Codex.**

[![npm version](https://img.shields.io/npm/v/get-more-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-more-shit-done-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

```bash
npx get-more-shit-done-cc@latest
```

</div>

---

## What This Does

GSD is the context engineering layer that makes AI coding assistants reliable at scale.

- **Structured planning** — Questions → research → requirements → roadmap → atomic task plans
- **Fresh context per task** — Each plan executes in a clean 200k-token window. No context rot.
- **Autonomous execution** — Autopilot drives milestones from start to finish without intervention
- **Standalone CLI** — `gsd progress`, `gsd health`, `gsd todos` from any terminal
- **Multi-runtime** — Works with Claude Code, OpenCode, Gemini CLI, and Codex

[User Guide](docs/USER-GUIDE.md) · [CLI Reference](docs/CLI.md)

---

## Quick Start

### 1. Install

```bash
npx get-more-shit-done-cc@latest
```

Choose your runtime (Claude Code, OpenCode, Gemini, Codex) and scope (global or local).

### 2. Initialize a Project

```
/gsd:new-project
```

Asks questions about your idea, researches the domain, creates requirements and a phased roadmap.

### 3. Build It

```
/gsd:discuss-phase 1    # Shape implementation decisions
/gsd:plan-phase 1       # Research + create atomic task plans
/gsd:execute-phase 1    # Execute plans in parallel, fresh context each
/gsd:verify-work 1      # Confirm it works as expected
```

Repeat for each phase. When all phases are done:

```
/gsd:complete-milestone
```

### Quick Tasks

For one-off work that doesn't need full planning:

```
/gsd:quick
```

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
| `/gsd:ui-test` | Generate and run Playwright E2E tests |
| `/gsd:uat-auto` | Run automated UAT session (Chrome MCP + Playwright fallback) |
| `/gsd:add-tests` | Add unit and E2E tests to a phase |
| `/gsd:pr-review` | Route PR review findings to quick task or milestone |
| `/gsd:test-review` | Analyze test coverage gaps for current branch diff |
| `/gsd:progress` | Show current status |
| `/gsd:help` | All commands and usage |

Full command reference and configuration: [User Guide](docs/USER-GUIDE.md)
Standalone CLI (`gsd progress`, `gsd health`, etc.): [CLI Reference](docs/CLI.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
