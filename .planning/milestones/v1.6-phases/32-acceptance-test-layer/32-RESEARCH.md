# Phase 32: Acceptance Test Layer - Research

**Researched:** 2026-03-05
**Domain:** Workflow markdown modification (discuss-phase, verify-phase, execute-plan, plan-checker, auto-context, context template)
**Confidence:** HIGH

## Summary

Phase 32 adds human-defined acceptance tests to the GSD workflow lifecycle. The work is entirely within `.md` workflow files and the CONTEXT.md template -- no new code modules, no new dependencies, no infrastructure changes. All six target files already exist and follow established patterns (XML sections in templates, named `<step>` elements in workflows, numbered dimensions in plan-checker).

The `test.acceptance_tests` config key already exists (Phase 30 added it with `true` default). The `getTestConfig()` function in `testing.cjs` already resolves this boolean. No config work is needed -- workflows just need to check the config value and branch accordingly.

**Primary recommendation:** Implement as three sequential waves: (1) storage and gathering (context template + discuss-phase), (2) downstream consumption (plan-checker dimension + execute-plan ownership invariant + auto-context awareness), (3) verification execution (verify-phase AT runner).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Acceptance tests use Given/When/Then/Verify format with AT-{NN} identifiers
- Tests stored inside `<acceptance_tests>` block in CONTEXT.md as new XML section
- AT identifiers are sequential within phase (AT-01, AT-02, ...) and persist unchanged
- Each AT has: title (### AT-{NN}: description), Given, When, Then, and Verify lines
- Verify line contains a shell command executable programmatically for pass/fail
- During discuss-phase, after decision gathering, workflow prompts user to define ATs per requirement
- `test.acceptance_tests` config key controls whether prompt appears (default true)
- During auto-context mode (--auto), acceptance tests are NOT gathered -- block omitted
- Verify-phase executes each AT's Verify command: exit 0 = pass, non-zero = fail
- Both stdout and stderr captured as evidence alongside pass/fail status
- AT results in VERIFICATION.md as dedicated section, separate from existing verification
- Failing AT is a blocker (status = gaps_found)
- Plan-checker adds Dimension 9: Acceptance Test Coverage
- Missing AT coverage is a blocking issue (severity: blocker)
- Plan tasks reference ATs via AT-{NN} identifier in task action or done criteria
- AI cannot add, remove, or modify ATs after discuss-phase approval
- Execute-plan.md: add read-only instruction in executor protocol
- Planner: instructed not to add/remove ATs, only reference existing AT-{NN} identifiers
- `<acceptance_tests>` block treated as locked section, same as `<decisions>`

### Claude's Discretion
- Exact wording of AT gathering prompts in discuss-phase
- How Verify command output is formatted in VERIFICATION.md report (table vs list)
- Whether plan-checker dimension 9 uses exact string matching or regex for AT-{NN} references
- Internal parsing approach for extracting AT entries from `<acceptance_tests>` block
- Ordering of acceptance test results in verification report

### Deferred Ideas (OUT OF SCOPE)
- Acceptance test generation in autopilot auto-mode -- interactive-only for v1.6
- Auto-consolidation of acceptance tests without human approval
- Visual test reports (HTML/dashboard output) for acceptance test results
- Per-file test-to-code mapping for acceptance tests
- Acceptance test versioning or change tracking across phases
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AT-01 | Discuss-phase gathers human-defined acceptance tests per requirement in Given/When/Then/Verify format | discuss-phase.md step pattern, config check via `gsd-tools.cjs config-get test.acceptance_tests`, AskUserQuestion pattern |
| AT-02 | Acceptance tests stored as `<acceptance_tests>` block in CONTEXT.md with AT-{NN} identifiers | context.md template XML section pattern, write_context step in discuss-phase |
| AT-03 | Verify-phase executes acceptance test Verify commands and maps results to verification truths | verify-phase.md step pattern, Bash tool for shell execution, VERIFICATION.md report template |
| AT-04 | Plan-checker verifies that plans cover all acceptance tests from CONTEXT.md | gsd-plan-checker.md dimension pattern (8 existing), issue format structure |
| AT-05 | AI cannot add, remove, or modify acceptance tests after discuss-phase approval (ownership invariant) | execute-plan.md protocol sections (`<deviation_rules>`, `<test_gate>`), planner role constraints |
</phase_requirements>

## Standard Stack

### Core
This phase modifies only workflow `.md` files. No libraries needed.

| File | Purpose | Modification Type |
|------|---------|-------------------|
| `get-shit-done/templates/context.md` | CONTEXT.md template | Add `<acceptance_tests>` XML section |
| `get-shit-done/workflows/discuss-phase.md` | Interactive discussion workflow | Add `gather_acceptance_tests` step + update `write_context` |
| `get-shit-done/agents/gsd-plan-checker.md` | Plan verification agent | Add Dimension 9 |
| `get-shit-done/workflows/execute-plan.md` | Plan execution workflow | Add ownership invariant instruction |
| `get-shit-done/agents/gsd-auto-context.md` | Auto-context agent | Add AT omission note |
| `get-shit-done/workflows/verify-phase.md` | Phase verification workflow | Add `verify_acceptance_tests` step |

### Supporting
| Tool | Purpose | Already Available |
|------|---------|-------------------|
| `gsd-tools.cjs config-get test.acceptance_tests` | Check if ATs enabled | Yes (Phase 30) |
| `testing.cjs getTestConfig()` | Resolves acceptance_tests boolean | Yes (Phase 30) |
| AskUserQuestion | Interactive AT gathering prompts | Yes (built-in) |

## Architecture Patterns

### Pattern 1: XML Section in CONTEXT.md
**What:** All structured data in CONTEXT.md uses XML tags as delimiters
**Existing sections:** `<domain>`, `<decisions>`, `<code_context>`, `<specifics>`, `<deferred>`
**New section:** `<acceptance_tests>` follows the identical pattern

```markdown
<acceptance_tests>
## Acceptance Tests

### AT-01: [Description]
- Given: [precondition]
- When: [action]
- Then: [expected outcome]
- Verify: `[shell command that exits 0 on pass]`

### AT-02: [Description]
- Given: [precondition]
- When: [action]
- Then: [expected outcome]
- Verify: `[shell command]`
</acceptance_tests>
```

### Pattern 2: Named Steps in discuss-phase.md
**What:** Workflow uses `<step name="...">` elements with sequential execution
**Existing flow:** initialize → auto_context_check → check_existing → load_prior_context → scout_codebase → analyze_phase → present_gray_areas → discuss_areas → write_context → confirm_creation → git_commit → update_state → auto_advance
**Integration point:** New step `gather_acceptance_tests` inserts between `discuss_areas` and `write_context`
**Config gate:** Step checks `test.acceptance_tests` config before executing

### Pattern 3: Numbered Dimensions in plan-checker
**What:** Verification dimensions are numbered sequentially (1-8 currently)
**New dimension:** Dimension 9 follows the exact structure of existing dimensions with issue format
**Skip condition:** Only runs if CONTEXT.md has `<acceptance_tests>` block (graceful degradation)

### Pattern 4: Protocol Sections in execute-plan.md
**What:** Execution constraints use named XML sections: `<authentication_gates>`, `<deviation_rules>`, `<test_gate_baseline>`, `<test_gate>`
**New section:** `<acceptance_test_ownership>` follows the same pattern -- a short instruction block that executors must honor
**Placement:** After `<test_gate>` section, before `<tdd_plan_execution>`

### Anti-Patterns to Avoid
- **Adding code modules for parsing:** AT parsing happens in-workflow by agents reading markdown. No `testing.cjs` changes needed.
- **Modifying config schema:** `test.acceptance_tests` already exists. Don't add new config keys.
- **Auto-generating ATs in auto-context:** Explicitly deferred. Auto-context must omit `<acceptance_tests>`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config checking | New config module | `gsd-tools.cjs config-get test.acceptance_tests` | Already works, returns boolean |
| AT execution | Custom test runner | Bash `eval` in verify-phase | Shell commands already how verify-phase works |
| AT format parsing | Regex engine | Agent reads markdown structure | Agents already parse CONTEXT.md XML sections |

## Common Pitfalls

### Pitfall 1: Breaking Auto-Context Mode
**What goes wrong:** Adding `<acceptance_tests>` to auto-context output when no human is present
**Why it happens:** Auto-context agent generates all CONTEXT.md sections and might auto-generate ATs from requirements
**How to avoid:** Explicit instruction in gsd-auto-context.md that `<acceptance_tests>` is NEVER generated in auto mode
**Warning signs:** Auto-context CONTEXT.md containing AT entries

### Pitfall 2: Scope Creep in Discuss-Phase Step
**What goes wrong:** gather_acceptance_tests step becomes too long, consuming excessive context
**Why it happens:** Trying to generate Verify commands for every requirement with multiple rounds
**How to avoid:** Suggest Verify commands but let user approve; keep step focused on structured capture
**Warning signs:** Step exceeding 4 AskUserQuestion rounds for a single requirement

### Pitfall 3: Plan-Checker False Positives
**What goes wrong:** Dimension 9 flags plans that address ATs implicitly but don't use AT-{NN} identifiers
**Why it happens:** Strict string matching misses indirect coverage
**How to avoid:** Check task `<action>` and `<done>` elements for AT-{NN} references (grep-friendly)
**Warning signs:** Plans that clearly implement the AT behavior but get flagged as missing coverage

### Pitfall 4: Verify Command Security
**What goes wrong:** Malicious or destructive Verify commands executed blindly
**Why it happens:** Verify commands are shell-executed with full project permissions
**How to avoid:** This is acceptable for v1.6 (human defines the commands, runtime sandboxing deferred). Note in verify-phase that commands run in project context.
**Warning signs:** N/A for this phase -- security is explicitly out of scope per REQUIREMENTS.md

### Pitfall 5: Breaking Existing Verification
**What goes wrong:** New AT verification step interferes with existing truth/artifact/wiring verification
**Why it happens:** Inserting new step incorrectly in verify-phase flow
**How to avoid:** AT verification is a separate step (parallel to existing steps), not replacing any existing step. AT results go in their own VERIFICATION.md section.
**Warning signs:** Existing verification steps not running or producing different output

## Code Examples

### AT Block in CONTEXT.md
```markdown
<acceptance_tests>
## Acceptance Tests

### AT-01: Config key controls AT gathering
- Given: A project with test.acceptance_tests set to false
- When: discuss-phase runs for a new phase
- Then: No acceptance test prompts appear
- Verify: `node -e "const c = require('./get-shit-done/bin/lib/testing.cjs'); console.log(c.getTestConfig({acceptance_tests:false}).acceptance_tests)" | grep -q 'false'`

### AT-02: Verify commands map to pass/fail
- Given: A CONTEXT.md with acceptance tests containing Verify commands
- When: verify-phase processes the acceptance tests
- Then: Each Verify command exit code maps to pass (0) or fail (non-0)
- Verify: `echo "exit 0 test" && exit 0`
</acceptance_tests>
```

### Config Check in Workflow Step
```bash
# Check if acceptance tests are enabled
AT_ENABLED=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get test.acceptance_tests 2>/dev/null || echo "true")
```

### Ownership Invariant Instruction (execute-plan.md pattern)
```xml
<acceptance_test_ownership>
## Acceptance Test Ownership

The `<acceptance_tests>` block in CONTEXT.md is **read-only**. You MUST NOT add, remove, or modify any acceptance test entries. Reference them by AT-{NN} identifier in your work but never change the source.

If an acceptance test's Verify command references code you are modifying, ensure your changes satisfy the test -- do not modify the test to match your code.
</acceptance_test_ownership>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No acceptance criteria tracking | Human-defined ATs in CONTEXT.md | Phase 32 (this phase) | Humans define the contract, AI works against it |
| Verification only checks code existence | Verification also executes AT Verify commands | Phase 32 (this phase) | Executable acceptance criteria with pass/fail evidence |

## Open Questions

1. **Verify command timeout**
   - What we know: Shell commands run in project context
   - What's unclear: Should there be a timeout per Verify command?
   - Recommendation: Use standard Bash tool timeout (120s default). No special handling needed for v1.6.

2. **Multiple Verify commands per AT**
   - What we know: Design specifies one Verify line per AT
   - What's unclear: Should compound Verify commands (e.g., `cmd1 && cmd2`) be supported?
   - Recommendation: Yes, compound commands work naturally in shell. Single Verify line can contain `&&` chains.

## Sources

### Primary (HIGH confidence)
- Existing workflow files examined: discuss-phase.md, verify-phase.md, execute-plan.md, gsd-plan-checker.md, gsd-auto-context.md, context.md template
- Phase 30 config implementation: testing.cjs, config.cjs (acceptance_tests key confirmed)
- Phase 31 test gate pattern: execute-plan.md `<test_gate>` and `<test_gate_baseline>` sections
- CONTEXT.md from Phase 32 (user decisions from discuss-phase)
- Design document: .planning/designs/2026-03-05-dual-layer-test-architecture-design.md
- Project research: .planning/research/ARCHITECTURE.md, FEATURES.md, STACK.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All target files examined, patterns well-understood
- Architecture: HIGH - Pure workflow modification following established patterns
- Pitfalls: HIGH - Integration points clearly identified from codebase analysis

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- workflow files change slowly)
