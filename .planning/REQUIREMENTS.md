# Requirements: GSD Autopilot

**Defined:** 2026-03-21
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v2.9 Requirements

Requirements for `/gsd:test-review` — PR diff-aware test review command.

### Command

- [ ] **CMD-01**: `/gsd:test-review` command gathers `git diff main...HEAD` and spawns `gsd-test-reviewer` agent
- [ ] **CMD-02**: Command displays banner with changed file count, test count, and budget status
- [ ] **CMD-03**: `--report-only` flag skips routing and exits after report display
- [ ] **CMD-04**: Command writes report to `.planning/reviews/YYYY-MM-DD-test-review.md` and commits to git
- [ ] **CMD-05**: Command exits gracefully with message when no diff exists vs main
- [ ] **CMD-06**: Diff size gate switches to summarized mode (stat + file list) when diff exceeds ~2000 lines

### Agent

- [ ] **AGT-01**: `gsd-test-reviewer` agent maps changed source files to related test files via naming conventions and import tracing
- [ ] **AGT-02**: Agent detects coverage gaps — new/modified exported functions without corresponding test assertions
- [ ] **AGT-03**: Agent detects missing test files — changed source files with no corresponding test file at all
- [ ] **AGT-04**: Agent detects stale tests — test assertions referencing renamed/removed functions in changed source files
- [ ] **AGT-05**: Agent identifies consolidation opportunities scoped to test files related to the diff (prune/parameterize/promote/merge)
- [ ] **AGT-06**: Agent produces structured markdown report with summary stats, categorized findings, and priority-ordered actions
- [ ] **AGT-07**: Agent is read-only — never modifies source files, test files, or creates new tests
- [ ] **AGT-08**: Agent includes budget context in report (current test count, budget status, estimated impact of recommendations)

### Routing

- [ ] **RTE-01**: After report display, user is prompted to choose: quick task, milestone, or done
- [ ] **RTE-02**: Quick task route creates task directory with test recommendations as structured context for planner
- [ ] **RTE-03**: Milestone route writes MILESTONE-CONTEXT.md from findings and delegates to `/gsd:new-milestone --auto`
- [ ] **RTE-04**: Done route exits with report already saved — no further action
- [ ] **RTE-05**: Routing is skipped entirely when `--report-only` flag is set
- [ ] **RTE-06**: Empty recommendations (no gaps, no staleness, no consolidation) skip routing and display "no issues found"

### Documentation

- [ ] **DOC-01**: help.md updated with `/gsd:test-review` command reference
- [ ] **DOC-02**: USER-GUIDE.md updated with test review usage guide and examples
- [ ] **DOC-03**: README.md updated with test-review in command table

## Future Requirements

### Integration

- **INT-01**: Auto-run test-review during milestone audit for test-aware gap detection
- **INT-02**: Custom source-to-test file mapping configuration for non-standard project layouts
- **INT-03**: Budget impact projection showing estimated test count after applying recommendations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic test generation from diff | `add-tests` workflow handles test generation with human-guided acceptance criteria |
| Line-level coverage analysis (Istanbul/c8) | Requires instrumentation — GSD uses agent-driven static analysis |
| Auto-scoring and routing | Test findings are too subjective for numeric scoring — user chooses |
| Git blame / change frequency analysis | Adds complexity for marginal value in single review session |
| Running tests as part of review | Analysis-only — test execution belongs in hard gate and `ui-test` |
| Cross-repository test mapping | Single-repo naming conventions cover the common case |
| Watching for file changes (daemon mode) | On-demand invocation is sufficient |
| Modifying the test steward agent | Independent agent — shared vocabulary, different trigger |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMD-01 | Phase 78 | Done |
| CMD-02 | Phase 78 | Done |
| CMD-03 | Phase 78 | Done |
| CMD-04 | Phase 78 | Done |
| CMD-05 | Phase 78 | Done |
| CMD-06 | Phase 78 | Done |
| AGT-01 | Phase 79 | Done |
| AGT-02 | Phase 79 | Done |
| AGT-03 | Phase 79 | Done |
| AGT-04 | Phase 79 | Done |
| AGT-05 | Phase 79 | Done |
| AGT-06 | Phase 79 | Done |
| AGT-07 | Phase 79 | Done |
| AGT-08 | Phase 79 | Done |
| RTE-01 | Phase 80 | Pending |
| RTE-02 | Phase 80 | Pending |
| RTE-03 | Phase 80 | Pending |
| RTE-04 | Phase 80 | Pending |
| RTE-05 | Phase 80 | Pending |
| RTE-06 | Phase 80 | Pending |
| DOC-01 | Phase 81 | Pending |
| DOC-02 | Phase 81 | Pending |
| DOC-03 | Phase 81 | Pending |

**Coverage:**
- v2.9 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
