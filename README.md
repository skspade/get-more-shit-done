<div align="center">

# GET MORE SHIT DONE

**Autonomous spec-driven development for Claude Code, OpenCode, Gemini CLI, and Codex.**

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

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

### Initialize a Project

```
/gsd:new-project
```

Asks questions about your idea, researches the domain, creates requirements and a phased roadmap.

### Build It

**Autopilot (recommended)** — run an entire milestone end-to-end in a single session:

```
/gsd:autopilot
```

Automatically cycles through discuss → plan → execute → verify for every phase. Uses fresh subagents for each step to keep the main context lean (~5% usage). Includes circuit breaker, debug retry, gap closure, and a verification gate between phases.

Options:
- `--from-phase N` — Resume from a specific phase
- `--dry-run` — Preview the execution plan without running anything
- `--skip-verify-gate` — Skip interactive approval after each phase

**Manual** — step through each phase yourself:

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
| `/gsd:autopilot` | Run entire milestone end-to-end in one session (discuss → plan → execute → verify all phases) |
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
