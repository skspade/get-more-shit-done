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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 52 | 7 | First milestone — established artifact-based state, gap closure cycle |

### Top Lessons (Verified Across Milestones)

1. (First milestone — lessons above need cross-validation in v2)
