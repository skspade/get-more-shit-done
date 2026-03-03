# Requirements: GSD Autopilot

**Defined:** 2026-03-03
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1.3 Requirements

Requirements for CLI Utilities milestone. Each maps to roadmap phases.

### CLI Infrastructure

- [x] **CLI-01**: User can run `gsd` binary from any directory within a GSD project
- [x] **CLI-02**: CLI auto-discovers .planning/ directory by walking up from cwd
- [x] **CLI-03**: CLI routes to subcommands (progress, todos, health, settings, help)
- [x] **CLI-04**: All commands support `--json` flag for machine-readable JSON output
- [x] **CLI-05**: All commands support `--plain` flag for ANSI-free text output
- [x] **CLI-06**: CLI displays helpful error when run outside a GSD project

### Progress Command

- [ ] **PROG-01**: User can see current milestone name, version, and status
- [ ] **PROG-02**: User can see phase list with completion status
- [ ] **PROG-03**: User can see plan completion counts per phase
- [ ] **PROG-04**: User can see progress bar visualization
- [ ] **PROG-05**: User can see current position and next suggested action

### Todos Command

- [ ] **TODO-01**: User can list all pending todos with ID, title, and area
- [ ] **TODO-02**: User can filter todos by area (`gsd todos --area=feature`)
- [ ] **TODO-03**: User can view full details of a specific todo (`gsd todos <id>`)

### Health Command

- [ ] **HLTH-01**: User can validate that required .planning/ files exist
- [ ] **HLTH-02**: User can check config.json structure and values
- [ ] **HLTH-03**: User can detect state inconsistencies (STATE.md vs ROADMAP.md)
- [ ] **HLTH-04**: User can see errors and warnings with clear descriptions

### Settings Command

- [ ] **SETT-01**: User can view all current config values
- [ ] **SETT-02**: User can update a config value (`gsd settings set <key> <value>`)
- [ ] **SETT-03**: Config values are validated before writing

### Help Command

- [ ] **HELP-01**: User can see all available CLI commands with descriptions
- [ ] **HELP-02**: User can see detailed help for a specific command (`gsd help <command>`)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Resume Command

- **RESM-01**: User can detect incomplete work from CLI (`gsd resume`)
- **RESM-02**: User can see what phase/plan was interrupted and why

### Roadmap Command

- **ROAD-01**: User can view phase breakdown with requirements mapping (`gsd roadmap`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive prompts (inquirer-style) | Keep CLI read-only for v1.3; interactive editing adds complexity |
| `gsd init` project creation | Requires LLM reasoning for project setup |
| `gsd run` command execution | Commands need LLM; CLI is for deterministic operations only |
| Package manager distribution (npm publish) | Focus on local install first; distribution is future |
| Shell completions (bash/zsh) | Nice-to-have, defer to future |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 14 | Complete |
| CLI-02 | Phase 14 | Complete |
| CLI-03 | Phase 14 | Complete |
| CLI-04 | Phase 14 | Complete |
| CLI-05 | Phase 14 | Complete |
| CLI-06 | Phase 14 | Complete |
| PROG-01 | Phase 15 | Pending |
| PROG-02 | Phase 15 | Pending |
| PROG-03 | Phase 15 | Pending |
| PROG-04 | Phase 15 | Pending |
| PROG-05 | Phase 15 | Pending |
| TODO-01 | Phase 16 | Pending |
| TODO-02 | Phase 16 | Pending |
| TODO-03 | Phase 16 | Pending |
| HLTH-01 | Phase 17 | Pending |
| HLTH-02 | Phase 17 | Pending |
| HLTH-03 | Phase 17 | Pending |
| HLTH-04 | Phase 17 | Pending |
| SETT-01 | Phase 18 | Pending |
| SETT-02 | Phase 18 | Pending |
| SETT-03 | Phase 18 | Pending |
| HELP-01 | Phase 18 | Pending |
| HELP-02 | Phase 18 | Pending |

**Coverage:**
- v1.3 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
