# Milestone Context

**Source:** Brainstorm session (Autopilot CJS Consolidation)
**Design:** .planning/designs/2026-03-10-autopilot-cjs-consolidation-design.md

## Milestone Goal

Eliminate all redundant logic between autopilot.sh (bash) and the CJS modules by rewriting the autopilot as a zx-based Node.js script that directly imports the existing CJS modules. Functions currently duplicated in bash are consolidated into their natural CJS homes (phase.cjs, verify.cjs, cli.cjs), and the zx script becomes a thin orchestrator with zero reimplemented logic.

## Features

### Module Extension Map

Add missing autopilot-support functions to existing CJS modules where they naturally belong:
- `findFirstIncompletePhase(cwd)` and `nextIncompletePhase(cwd, currentPhase)` in `phase.cjs`
- `getVerificationStatus(cwd, phaseDir)` and `getGapsSummary(cwd, phaseDir)` in `verify.cjs`
- `CONFIG_DEFAULTS` map with fallback logic in `cli.cjs`
- New dispatch entries in `gsd-tools.cjs`: `phase find-next`, `verify status`, `verify gaps`

### zx Script Architecture

Rewrite autopilot.sh as autopilot.mjs using Google's zx library:
- Direct `require()` of CJS modules via `createRequire` — no JSON serialization boundary
- `$` template literals for `claude -p` invocations
- Native JS signal handling, temp file management, and config reading
- Same state machine (discuss → plan → execute → verify → complete)
- Estimated ~800-900 lines vs 1313 bash lines

### Migration & Fallback Strategy

- Add zx as a runtime dependency
- Rename autopilot.sh → autopilot-legacy.sh
- Update bin/gsd-autopilot entrypoint with --legacy flag for fallback
- Validate with existing test suite + dry-run smoke test
- Legacy removal after 1-2 milestones of successful operation
