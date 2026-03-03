# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — GSD Autopilot

**Shipped:** 2026-03-02
**Phases:** 7 | **Plans:** 12 | **Commits:** 52

### What Was Built
- Bash outer loop engine (`autopilot.sh`) — stateless orchestrator reinvoking Claude Code per phase step
- Auto-context agent (`gsd-auto-context`) — autonomous CONTEXT.md generation with layered decision sourcing
- Verification gates — human checkpoint with approve/fix/abort controls after each phase
- Debug-retry failure handling — spawns gsd-debugger, retries with configurable limits, persists failure state
- Phase status inference via artifact file presence (CONTEXT, PLAN, SUMMARY, VERIFICATION)

### What Worked
- Artifact-based state inference: no in-memory state, survives context resets, stateless process model
- Phase-per-capability decomposition: each of the 4 core phases (loop, context, gates, failure) was independently testable
- Gap closure cycle: audit found real issues (verify step unreachable, fix_desc not passed), closure phases fixed them systematically
- Thin orchestrator pattern: autopilot.sh delegates all substantive work to Claude Code processes, keeping itself simple

### What Was Inefficient
- Phase 6 was verification-only (produce 04-VERIFICATION.md) — could have been folded into Phase 4 execution if verification was done at the time
- Three audit cycles needed to reach clean state — first audit found gaps, second found integration bugs, third confirmed clean
- ROADMAP.md plan checkboxes never updated during execution for Phases 1-3 (showed as `[ ] TBD` despite being complete)
- Phase 6 not checked off in ROADMAP.md — a cosmetic oversight that persisted through multiple audits

### Patterns Established
- Artifact-based lifecycle: step = f(files present in phase directory)
- Gate-then-complete: verification gate blocks, then `phase complete` marks done
- ROADMAP checkbox-based completion detection over section parsing
- Dual file pattern fallback (VERIFICATION then UAT) for verification output
- `-- Human fix request:` separator convention for passing context to skill prompts

### Key Lessons
1. Wire verification into phase execution from the start — retrofitting it (Phase 6) costs an entire extra phase
2. Gap closure phases are cheap and effective — the audit-plan-fix cycle found real bugs that manual review missed
3. Bash is viable for orchestration when the contract is simple (invoke CLI, check exit code, read files)
4. Dead imports and config scaffold gaps accumulate when multiple phases modify the same files — worth a lint pass

### Cost Observations
- Model mix: predominantly opus (quality profile), with sonnet/haiku for sub-agents
- Sessions: ~12 plan executions across 7 phases
- Notable: gap closure phases (5-7) were much faster than core phases (1-4) — smaller scope, clearer requirements

---

## Milestone: v1.1 — Remove Git Tagging

**Shipped:** 2026-03-03
**Phases:** 2 | **Plans:** 3 | **Commits:** 15

### What Was Built
- Removed entire `git_tag` step from complete-milestone workflow (tag creation, push prompt, push logic)
- Cleaned all tag references from command spec, workflow purpose, and success criteria
- Updated help.md, README.md, and USER-GUIDE.md to remove automated tagging claims
- Fixed residual tag references in workflow output template and USER-GUIDE.md examples

### What Worked
- Audit-driven gap closure: first pass (Phase 8) caught the main targets, audit found 2 residual references, Phase 9 closed them cleanly
- Scope discipline: correctly preserved `Bash(git tag:*)` permissions example as out-of-scope (generic Claude Code snippet, not a GSD feature claim)
- Fast turnaround: entire milestone completed in ~1.5 hours with 15 commits

### What Was Inefficient
- Phase 8 missed 2 residual references (offer_next output template, USER-GUIDE.md inline comments) that required a gap closure phase — a more thorough grep sweep in Phase 8 could have caught these
- ROADMAP.md phase checkboxes and plan counts were not updated during Phase 8/9 execution (showed `0/0` and `[ ] TBD`)

### Patterns Established
- Removal milestones: focused removal of a feature can be completed very quickly with audit verification
- Gap closure as standard practice: expecting an audit-then-fix cycle produces better quality than trying to get it right in one pass

### Key Lessons
1. For removal tasks, grep for all variations early — "tag", "Tag", "tagged", "tagging", inline comments — reduces gap closure phases
2. ROADMAP checkbox/plan count updates should happen during execution, not just at milestone completion

### Cost Observations
- Model mix: quality profile (opus primary)
- Sessions: 3 plan executions across 2 phases
- Notable: removal milestones are very fast — clear scope, no design decisions, mechanical edits

---

## Milestone: v1.2 — Add Milestone Audit Loop

**Shipped:** 2026-03-03
**Phases:** 4 | **Plans:** 4 | **Commits:** 29

### What Was Built
- `run_milestone_audit` function — auto-triggers audit after all phases complete, routes on passed/gaps_found/tech_debt
- `run_gap_closure_loop` — iterative audit-fix cycles with configurable max iterations and `print_escalation_report`
- `run_milestone_completion` — DRY function called from all 4 audit-passed paths for autonomous archival
- Phase 13 gap closure — formal VERIFICATION.md for Phase 12 closing orphaned COMP-01/COMP-02

### What Worked
- DRY function pattern: `run_milestone_completion` called from all 4 exit paths instead of duplicating logic
- Gap closure reusing existing phase lifecycle: fix phases use identical discuss/plan/execute/verify as normal phases
- Config-driven behavior: `auto_accept_tech_debt` and `max_audit_fix_iterations` keep the loop adaptable
- Rapid iteration: 4 phases planned and executed in a single session

### What Was Inefficient
- Phase 12 skipped creating VERIFICATION.md, requiring Phase 13 as a gap closure phase — formal verification should be part of every phase
- Audit file remained stale (`gaps_found`) after Phase 13 closed the gaps — no re-audit step was run
- `run_gap_closure_loop` return value unchecked at call sites — safe but fragile to future changes

### Patterns Established
- Milestone completion pattern: extract version from STATE.md frontmatter, invoke complete-milestone via `run_step_with_retry`
- Gap closure verification pattern: create VERIFICATION.md for the implementation phase, update REQUIREMENTS.md traceability
- Three-function decomposition for audit loop: audit, gap closure, completion — each independently testable

### Key Lessons
1. Always create VERIFICATION.md during phase execution — retrofitting costs an extra gap closure phase (same lesson as v1.0 Phase 6)
2. The audit-gap-closure cycle is now automated end-to-end — the manual overhead is effectively zero
3. DRY function patterns for common exit paths prevent divergence when multiple code paths need the same behavior

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker)
- Sessions: 4 plan executions across 4 phases
- Notable: gap closure (Phase 13) was trivially fast — writing VERIFICATION.md and updating traceability checkboxes

---

## Milestone: v1.3 — CLI Utilities

**Shipped:** 2026-03-03
**Phases:** 6 | **Plans:** 9 | **Commits:** 49

### What Was Built
- Standalone `gsd` CLI binary with project auto-discovery and 5-command routing
- `gsd progress` — milestone status dashboard with phase breakdown and progress bar
- `gsd todos` — todo listing with `--area` filtering and detail view
- `gsd health` — .planning/ directory validation, config integrity, state consistency checks
- `gsd settings` — config view (dot-notation) and set (with validation rules)
- `gsd help` — overview listing and per-command detailed help (usage, flags, examples)
- 86 CLI tests across 11 suites with `--json` and `--plain` output modes

### What Worked
- Building on existing gsd-tools.cjs parsing layer: no duplication, consistent data
- gatherXData/handleX pattern: consistent architecture across all 5 commands, easy to test
- Parallel phase execution: Phases 15-18 all depended only on Phase 14, enabling fast iteration
- Audit gap closure (Phase 19): caught 15 documentation gaps (missing frontmatter, missing VERIFICATION.md, missing test) and closed all in a single phase
- All 6 phases completed in a single day with clean audit on second pass

### What Was Inefficient
- First audit found 15 documentation-level gaps — SUMMARY frontmatter should have been included during initial phase execution
- Phase 19 gap closure was entirely documentation/test debt — could have been avoided with stricter execution-time checks
- Some phases (14, 18) had inconsistent ROADMAP progress table formatting (missing milestone column)

### Patterns Established
- CLI handler pattern: gatherXData reads state, handleX formats response, formatOutput renders mode-appropriate output
- Inline data gathering over calling existing commands: avoids output() side-effects from existing functions
- Read-only CLI design: all commands are pure reads except `settings set`
- Per-command detailed help: COMMAND_DETAILS registry with usage, description, flags, examples

### Key Lessons
1. Include requirements-completed frontmatter in SUMMARY.md during execution, not after audit finds it missing
2. CLI commands benefit from a consistent handler pattern — makes adding new commands mechanical
3. Documentation gaps are the most common audit finding — a pre-commit check for SUMMARY frontmatter would prevent gap closure phases
4. Rich terminal output (ANSI) with `--plain` and `--json` alternatives should be the default pattern for any CLI tool

### Cost Observations
- Model mix: quality profile (opus primary, sonnet for plan checker/verifier)
- Sessions: 9 plan executions across 6 phases
- Notable: entire milestone completed in ~1.5 hours — deterministic CLI work is very fast with established patterns

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 52 | 7 | First milestone — established artifact-based state, gap closure cycle |
| v1.1 | 15 | 2 | First removal milestone — confirmed audit-gap-closure cycle works |
| v1.2 | 29 | 4 | Automated the audit-gap-closure cycle itself — now runs without human intervention |
| v1.3 | 49 | 6 | First feature milestone post-automation — CLI tooling with consistent handler pattern |

### Top Lessons (Verified Across Milestones)

1. Gap closure phases are consistently valuable — found real issues in v1.0 (3 phases), v1.1 (1 phase), v1.2 (1 phase), v1.3 (1 phase)
2. SUMMARY frontmatter completeness is the #1 recurring audit gap — needs execution-time enforcement
3. Always create VERIFICATION.md during phase execution — retrofitting costs an extra gap closure phase (confirmed in v1.0 Phase 6, v1.2 Phase 13, v1.3 Phase 19)
4. Consistent handler patterns (gatherXData/handleX) make adding new features mechanical and fast
