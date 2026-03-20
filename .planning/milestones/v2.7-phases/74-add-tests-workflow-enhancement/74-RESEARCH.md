# Phase 74: add-tests Workflow Enhancement - Research

**Researched:** 2026-03-20
**Domain:** GSD workflow modification (add-tests.md)
**Confidence:** HIGH

## Summary

Phase 74 modifies a single workflow file (`get-shit-done/workflows/add-tests.md`) to integrate Playwright detection, scaffolding, and spec generation into the existing `execute_e2e_generation` step. The modifications are surgical: only `execute_e2e_generation` (lines 240-270) and `summary_and_commit` (lines 272-333) are touched. All upstream steps (`parse_arguments`, `init_context`, `analyze_implementation`, `present_classification`, `discover_test_structure`, `generate_test_plan`, `execute_tdd_generation`) remain unchanged.

The existing workflow already has E2E classification, E2E test generation, E2E execution with RED/GREEN evaluation, and an E2E row in the summary table. Phase 74 replaces the generic E2E generation with Playwright-specific generation using patterns from `agents/gsd-playwright.md`, and adds a detection gate + scaffolding prompt at the top of `execute_e2e_generation`.

**Primary recommendation:** One plan targeting the two modified steps, with tasks ordered: detection gate first, scaffolding prompt second, spec generation third, RED-GREEN execution fourth, summary integration fifth.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Playwright detection calls `gsd-tools.cjs playwright-detect --raw` for `{ status, config_path }` JSON
- Detection runs once at start of `execute_e2e_generation`, not per-file
- Scaffolding prompt uses `AskUserQuestion` with three options: "Scaffold Playwright and continue", "Skip E2E tests", "Cancel"
- Scaffolding is inline in workflow, not a Task() spawn of gsd-playwright
- Generated tests import `{ test, expect }` from `@playwright/test`
- Locator priority: `getByRole` > `getByText` > `getByLabel` > `getByTestId` > CSS
- Test files placed in `e2e/{feature-slug}.spec.ts`
- E2E tests execute via `npx playwright test --project=chromium`
- RED-GREEN evaluation uses gsd-playwright error categorization (ERR_CONNECTION_REFUSED = app-level, locator/expect = test-level)
- Changes confined to `execute_e2e_generation` and `summary_and_commit` only
- TDD path remains completely unchanged

### Claude's Discretion
- Exact wording of the AskUserQuestion scaffolding prompt
- Whether to inline full Playwright config template or reference the agent's template
- Formatting of Playwright-specific test output within existing summary structure
- Order of Playwright detection relative to existing E2E duplicate-check within execute_e2e_generation

### Deferred Ideas (OUT OF SCOPE)
- Task() spawning of gsd-playwright agent from add-tests workflow
- `--headed` flag support in add-tests E2E execution
- Automatic Playwright scaffolding without user prompt
- Help documentation updates
- Visual regression test generation
- Multi-browser execution
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WKFL-01 | Enhanced `execute_e2e_generation` step with Playwright detection gate | Detection calls `gsd-tools.cjs playwright-detect --raw`, routes on `status` field (configured/installed/not-detected) |
| WKFL-02 | Scaffolding prompt when Playwright not detected | AskUserQuestion pattern already used in add-tests for classification and test plan approval; scaffolding steps from gsd-playwright.md Step 2 |
| WKFL-03 | Inline `.spec.ts` generation following gsd-playwright patterns | Generation pattern from gsd-playwright.md Step 3: describe groups, Given/When/Then mapping, locator hierarchy |
| WKFL-04 | RED-GREEN execution pattern for E2E tests | Execution via `npx playwright test --project=chromium`; failure categorization from gsd-playwright.md Step 5 |
| WKFL-05 | E2E results fold into existing summary table | Summary table already has `| E2E |` row at line 285; populate with Playwright-specific counts |
| WKFL-06 | TDD path unchanged (regression constraint) | All changes confined to execute_e2e_generation and summary_and_commit; no upstream step modifications |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | (project version) | E2E test framework | Already integrated via Phase 71-73; detection infrastructure exists |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gsd-tools.cjs | (project) | Playwright detection CLI | Called via `playwright-detect --raw` for status JSON |

### Alternatives Considered
None — all decisions are locked by CONTEXT.md.

## Architecture Patterns

### Existing add-tests.md Step Structure
```
parse_arguments → init_context → analyze_implementation → present_classification
→ discover_test_structure → generate_test_plan → execute_tdd_generation
→ execute_e2e_generation → summary_and_commit
```

Only the last two steps in the pipeline are modified.

### Pattern 1: Detection Gate at Step Entry
**What:** Run `playwright-detect --raw` at the top of `execute_e2e_generation` before any file operations
**When to use:** Always, before generating any E2E test files
**Example:**
```bash
DETECT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" playwright-detect --raw 2>/dev/null)
```
Parse JSON: if `status` is `configured`, proceed; if `not-detected` or `installed`, route to scaffolding prompt.

### Pattern 2: Inline Scaffolding (from gsd-playwright.md Step 2)
**What:** Create playwright.config.ts, e2e/ directory, example test, .gitignore entries, install chromium — all inline in the workflow
**When to use:** When user chooses "Scaffold Playwright and continue" from the AskUserQuestion
**Rationale:** add-tests already has Write/Edit/Bash tools; spawning an agent adds unnecessary context overhead for deterministic file writes

### Pattern 3: Playwright-Specific Spec Generation (from gsd-playwright.md Step 3)
**What:** Generate `e2e/{feature-slug}.spec.ts` files with `test.describe()` groups mapping acceptance criteria to test blocks
**When to use:** For each E2E-classified file after Playwright is confirmed configured
**Locator priority:** getByRole > getByText > getByLabel > getByTestId > CSS selector

### Pattern 4: Playwright Failure Categorization (from gsd-playwright.md Step 5)
**What:** Classify test failures as app-level or test-level based on error message patterns
**App-level patterns:** ERR_CONNECTION_REFUSED, net::ERR_, ECONNREFUSED, Navigation timeout, Target page closed
**Test-level patterns:** locator., strict mode violation, expect(received), toHaveText, toBe, toBeVisible, not found

### Anti-Patterns to Avoid
- **Modifying upstream steps:** All steps before `execute_e2e_generation` must remain unchanged (WKFL-06)
- **Spawning gsd-playwright as Task():** Inline generation is the locked decision
- **Running detection per-file:** Detection is project-wide, run once

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Playwright detection | Custom config file scanning | `gsd-tools.cjs playwright-detect --raw` | Phase 71 already built this; returns standardized JSON |
| Failure categorization | Custom error parsing | Pattern list from gsd-playwright.md Step 5 | Agent already defines canonical patterns |
| Scaffolding steps | Custom scaffold logic | Mirror gsd-playwright.md Step 2 exactly | Ensures consistency between `/gsd:ui-test` scaffold and add-tests scaffold |

## Common Pitfalls

### Pitfall 1: Breaking TDD Path
**What goes wrong:** Modifications leak into execute_tdd_generation or upstream steps
**Why it happens:** Overzealous refactoring or shared variable scope
**How to avoid:** Confine all changes to execute_e2e_generation and summary_and_commit steps only
**Warning signs:** Any edit outside lines 240-333 of add-tests.md

### Pitfall 2: Scaffold Without User Consent
**What goes wrong:** Auto-scaffolding Playwright without AskUserQuestion gate
**Why it happens:** Trying to streamline the flow
**How to avoid:** Always present the three-option AskUserQuestion when Playwright is not configured
**Warning signs:** Missing AskUserQuestion in the scaffolding path

### Pitfall 3: Generic E2E Commands Instead of Playwright-Specific
**What goes wrong:** Using `{discovered e2e command}` instead of `npx playwright test --project=chromium`
**Why it happens:** Preserving the generic pattern from the original workflow
**How to avoid:** Replace generic E2E execution with Playwright-specific command after detection confirms Playwright
**Warning signs:** E2E execution command doesn't reference playwright

### Pitfall 4: Summary Table Shape Change
**What goes wrong:** Adding new columns or rows to the summary table
**Why it happens:** Wanting to show Playwright-specific detail
**How to avoid:** Keep the existing `| E2E | {M} | {m1} | {m2} | {m3} |` row shape; populate with real counts
**Warning signs:** Table structure differs from unit test row

## Code Examples

### Detection Gate
```markdown
**1. Detect Playwright:**
\`\`\`bash
DETECT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" playwright-detect --raw 2>/dev/null)
\`\`\`

Parse the JSON result:
- If `status` is `configured`: proceed to spec generation
- If `status` is `not-detected` or `installed`: present scaffolding prompt
```

### AskUserQuestion Scaffolding Prompt
```markdown
AskUserQuestion(
  header: "Playwright Not Detected",
  question: "Playwright is not configured in this project. E2E test generation requires Playwright. How would you like to proceed?",
  options:
    - "Scaffold Playwright and continue" — creates playwright.config.ts, e2e/ directory, installs Chromium
    - "Skip E2E tests" — bypass E2E generation, record zeros in summary
    - "Cancel" — stop add-tests workflow
)
```

### Playwright-Specific Spec Generation
```typescript
import { test, expect } from '@playwright/test';

test.describe('{Feature Name}', () => {
  test('{description from acceptance criterion}', async ({ page }) => {
    // Given
    await page.goto('{path}');

    // When
    await page.getByRole('button', { name: '{action}' }).click();

    // Then
    await expect(page.getByText('{expected}')).toBeVisible();
  });
});
```

### Playwright Execution
```bash
npx playwright test --project=chromium
```

### Failure Categorization
```
App-level (do not fix test, flag as blocker):
- ERR_CONNECTION_REFUSED, net::ERR_, ECONNREFUSED
- page.goto: Timeout, Navigation timeout
- Target page, context or browser has been closed

Test-level (fix the test, re-run):
- locator., strict mode violation
- expect(received), Expected, Received
- toHaveText, toBe, toBeVisible, toHaveCount
- not found, element not visible
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic E2E generation in add-tests | Playwright-specific with detection gate | Phase 74 (this phase) | E2E tests use proper framework patterns instead of generic browser automation |
| No scaffolding support | Inline scaffolding with user consent | Phase 74 (this phase) | Users can set up Playwright from within add-tests workflow |

## Open Questions

None — CONTEXT.md decisions are comprehensive and all infrastructure from Phase 71-73 is available.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/add-tests.md` — current workflow implementation (read directly)
- `agents/gsd-playwright.md` — canonical Playwright patterns (read directly)
- `.planning/phases/74-add-tests-workflow-enhancement/74-CONTEXT.md` — locked decisions (read directly)
- `.planning/REQUIREMENTS.md` — WKFL-01 through WKFL-06 requirement definitions (read directly)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already integrated via Phase 71-73
- Architecture: HIGH — modifying existing workflow with clear boundaries
- Pitfalls: HIGH — regression constraint (WKFL-06) is the primary risk, well-documented

**Research date:** 2026-03-20
**Valid until:** indefinite (internal workflow, no external dependencies)
