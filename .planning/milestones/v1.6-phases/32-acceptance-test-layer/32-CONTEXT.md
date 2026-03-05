# Phase 32: Acceptance Test Layer - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Humans define executable acceptance criteria during discuss-phase that the AI works against. These criteria are stored in CONTEXT.md inside an `<acceptance_tests>` block, tracked with AT-{NN} identifiers through the phase lifecycle, verified during verify-phase by executing their Verify commands, validated for coverage by the plan-checker, and protected from AI modification after discuss-phase approval.

</domain>

<decisions>
## Implementation Decisions

### Acceptance Test Format and Storage (AT-02)
- Acceptance tests use Given/When/Then/Verify format with AT-{NN} identifiers
- Tests are stored inside an `<acceptance_tests>` block in CONTEXT.md
- The `<acceptance_tests>` block is a new XML section in the CONTEXT.md template, alongside existing `<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, `<deferred>` sections
- AT identifiers are sequential within the phase (AT-01, AT-02, ...) and persist unchanged through plan and execute phases
- Each acceptance test has: title (### AT-{NN}: description), Given, When, Then, and Verify lines
- The Verify line contains a shell command that can be executed programmatically to determine pass/fail

### Discuss-Phase Integration (AT-01)
- During interactive discuss-phase, after existing decision gathering is complete, the workflow prompts the user to define acceptance tests for each requirement
- The workflow presents extracted requirements from ROADMAP.md/REQUIREMENTS.md and asks: "What observable behavior proves this works?"
- AI may suggest Verify commands, but the user must approve them during the discuss session
- The full acceptance test list is presented for final approval before writing CONTEXT.md
- The `test.acceptance_tests` config key (default true, from Phase 30) controls whether this prompt appears -- when false, acceptance tests are skipped entirely (Claude's Decision: reuses existing config toggle for consistent opt-out behavior)
- During auto-context mode (--auto flag), acceptance tests are NOT gathered -- the `<acceptance_tests>` block is omitted since there is no human to define them (from REQUIREMENTS.md: "Acceptance test generation in autopilot auto-mode (interactive-only for v1.6)" listed as deferred)

### Verify-Phase Execution (AT-03)
- During verify-phase, each acceptance test's Verify command is executed via shell
- Each Verify command result maps to a verification truth: exit code 0 = pass, non-zero = fail
- Both stdout and stderr are captured as evidence alongside the pass/fail status
- Acceptance test results appear in the VERIFICATION.md report as a dedicated section, separate from existing truth/artifact/wiring verification (Claude's Decision: keeps acceptance test results visually distinct and easy to audit)
- A failing acceptance test is a blocker (status = gaps_found), same as any other failing truth (Claude's Decision: acceptance tests represent the human's contract -- failures must block)
- The verify-phase workflow reads the `<acceptance_tests>` block from CONTEXT.md and iterates each AT entry (Claude's Decision: CONTEXT.md is the single source of truth for acceptance tests, already loaded by verify-phase)

### Plan-Checker Coverage Validation (AT-04)
- The plan-checker (gsd-plan-checker.md) adds a new verification dimension: "Acceptance Test Coverage"
- For each AT-{NN} in the CONTEXT.md `<acceptance_tests>` block, the checker verifies at least one plan task references or addresses it
- Missing coverage for any acceptance test is a blocking issue (severity: blocker) (from ROADMAP success criteria 4: "missing coverage is flagged before execution begins")
- Plan tasks can reference acceptance tests via their AT-{NN} identifier in the task action or done criteria (Claude's Decision: explicit AT reference is unambiguous and grep-verifiable)
- This is a new Dimension 9 in the plan-checker, after existing Dimension 8 (Nyquist Compliance) (Claude's Decision: sequential dimension numbering preserves existing checker structure)

### Ownership Invariant Enforcement (AT-05)
- AI cannot add, remove, or modify acceptance tests after discuss-phase approval
- Enforcement in execute-plan.md: add an instruction in the executor protocol stating acceptance tests in CONTEXT.md are read-only and must not be modified (Claude's Decision: workflow-level instruction is how GSD controls executor behavior, matching test_gate and deviation_rules patterns)
- Enforcement in plan-phase.md: the planner is instructed not to add or remove acceptance tests, only to reference existing AT-{NN} identifiers in task specs (Claude's Decision: planner already respects CONTEXT.md locked decisions -- this makes the AT ownership rule explicit)
- The `<acceptance_tests>` block is treated as a locked section, same as `<decisions>` -- downstream agents can read but not modify (Claude's Decision: consistent with existing CONTEXT.md ownership model where discuss-phase decisions are locked)

### Workflow File Modifications
- `discuss-phase.md` (workflow): add acceptance test gathering step after existing gray area discussion, before write_context step
- `discuss-phase.md` (command): no changes needed -- the command spec delegates to the workflow
- `context.md` (template): add `<acceptance_tests>` section to the template with format example
- `verify-phase.md`: add acceptance test execution step that reads `<acceptance_tests>` from CONTEXT.md and runs each Verify command
- `gsd-plan-checker.md`: add Dimension 9 for acceptance test coverage checking
- `execute-plan.md`: add ownership invariant instruction in executor protocol (Claude's Decision: single line instruction is lightweight and matches existing protocol pattern)
- `gsd-auto-context.md`: add note that `<acceptance_tests>` block is omitted in auto-context mode since no human is present to define them (Claude's Decision: auto-context agent needs to know not to fabricate acceptance tests)

### Claude's Discretion
- Exact wording of the acceptance test gathering prompts in discuss-phase
- How Verify command output is formatted in the VERIFICATION.md report (table vs list)
- Whether the plan-checker dimension 9 uses exact string matching or regex for AT-{NN} references in plans
- Internal parsing approach for extracting AT entries from the `<acceptance_tests>` block
- Ordering of acceptance test results in the verification report

</decisions>

<specifics>
## Specific Ideas

- Design doc specifies the AT format precisely: `### AT-01: Title` followed by `- Given:`, `- When:`, `- Then:`, `- Verify:` lines -- this exact format should be implemented
- Design doc states: "The human writes the Given/When/Then (the what). The Verify line can be human-written or AI-suggested-and-approved during discuss-phase."
- REQUIREMENTS.md explicitly defers "Acceptance test generation in autopilot auto-mode (interactive-only for v1.6)" -- auto-context must not generate ATs
- The `test.acceptance_tests` config key already exists in config.cjs defaults (line 63) and testing.cjs TEST_CONFIG_DEFAULTS -- no new config work needed
- The design doc integration with discuss-phase: "1. Present extracted requirements for the phase. 2. For each requirement, ask: What observable behavior proves this works? 3. Structure responses into AT-{NN} format. 4. Present full acceptance test list for approval before writing CONTEXT.md."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `discuss-phase.md` (workflow): Has step-by-step process with named steps -- acceptance test gathering integrates as a new step between `discuss_areas` and `write_context`
- `verify-phase.md`: Has `verify_truths` and `verify_requirements` steps -- acceptance test execution parallels these patterns
- `gsd-plan-checker.md`: Has 8 existing verification dimensions with structured issue format -- Dimension 9 follows the same pattern
- `testing.cjs`: Has `getTestConfig()` that already resolves the `acceptance_tests` boolean -- can be called to check if ATs are enabled
- `context.md` (template): Has XML section structure (`<domain>`, `<decisions>`, etc.) -- `<acceptance_tests>` follows the same pattern
- `gsd-auto-context.md`: Has template for CONTEXT.md generation -- needs `<acceptance_tests>` awareness

### Established Patterns
- CONTEXT.md uses XML sections for structured data -- `<acceptance_tests>` is a natural addition
- Workflow instructions use named `<step>` elements -- acceptance test gathering is a new step
- Plan-checker dimensions are numbered sequentially with issue format: `{dimension, severity, description, plan, fix_hint}`
- Verify-phase uses exit codes and evidence capture -- Verify command execution follows this
- Execute-plan uses inline protocol instructions (`<test_gate>`, `<deviation_rules>`) -- ownership invariant follows this
- Config toggles control feature behavior with graceful degradation -- `test.acceptance_tests` already exists

### Integration Points
- `discuss-phase.md` (workflow, line ~518 area): New step `gather_acceptance_tests` between `discuss_areas` and `write_context`
- `discuss-phase.md` (workflow, write_context step): Template must include `<acceptance_tests>` block when ATs were gathered
- `context.md` (template): Add `<acceptance_tests>` section to the template structure
- `verify-phase.md` (verify_truths step area): New `verify_acceptance_tests` step that executes Verify commands
- `gsd-plan-checker.md` (verification_dimensions section): New Dimension 9 for AT coverage
- `execute-plan.md` (after load_prompt step): Ownership invariant instruction about AT immutability
- `gsd-auto-context.md`: Note about omitting `<acceptance_tests>` in auto mode

</code_context>

<deferred>
## Deferred Ideas

- Acceptance test generation in autopilot auto-mode -- explicitly deferred per REQUIREMENTS.md; interactive-only for v1.6
- Auto-consolidation of acceptance tests without human approval -- steward.auto_consolidate remains false
- Visual test reports (HTML/dashboard output) for acceptance test results
- Per-file test-to-code mapping for acceptance tests
- Acceptance test versioning or change tracking across phases

</deferred>

---

*Phase: 32-acceptance-test-layer*
*Context gathered: 2026-03-05 via auto-context*
