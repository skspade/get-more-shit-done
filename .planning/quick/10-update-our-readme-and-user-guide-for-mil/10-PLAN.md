---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - docs/USER-GUIDE.md
autonomous: true
requirements: [DOC-01, DOC-02]
must_haves:
  truths:
    - "README.md commands table includes /gsd:ui-test and /gsd:add-tests"
    - "User Guide command reference includes /gsd:ui-test and /gsd:add-tests with descriptions"
    - "User Guide has a Playwright UI Testing section explaining the feature"
    - "User Guide model profiles table includes gsd-playwright agent"
    - "No stale or incorrect information introduced"
  artifacts:
    - path: "README.md"
      provides: "Updated commands table with v2.7 commands"
    - path: "docs/USER-GUIDE.md"
      provides: "Full v2.7 feature documentation"
  key_links: []
---

<objective>
Update README.md and docs/USER-GUIDE.md to document v2.7 Playwright UI Testing features.

Purpose: The v2.7 milestone shipped `/gsd:ui-test` and `/gsd:add-tests` commands plus the `gsd-playwright` agent, but neither README nor User Guide mentions them.
Output: Both docs updated with accurate v2.7 feature coverage.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md
@docs/USER-GUIDE.md
@commands/gsd/ui-test.md
@commands/gsd/add-tests.md
@agents/gsd-playwright.md
@.planning/milestones/v2.7-REQUIREMENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update README.md commands table</name>
  <files>README.md</files>
  <action>
Add two new rows to the Commands table in README.md:

1. `/gsd:ui-test` — "Generate and run Playwright E2E tests" — place after `/gsd:quick` row
2. `/gsd:add-tests` — "Add unit and E2E tests to a phase" — place after `/gsd:ui-test`

Keep the existing table format and style. Do not change any other content.
  </action>
  <verify>
    <automated>grep -c "ui-test\|add-tests" README.md | grep -q "2"</automated>
  </verify>
  <done>README.md commands table has both new v2.7 commands listed with accurate descriptions</done>
</task>

<task type="auto">
  <name>Task 2: Update User Guide with v2.7 documentation</name>
  <files>docs/USER-GUIDE.md</files>
  <action>
Make these additions to docs/USER-GUIDE.md:

1. **Command Reference tables** — Add to the "Brownfield and Utilities" table:
   - `/gsd:ui-test [phase] [url]` | Generate and run Playwright E2E tests | After UI is deployed or running locally
   - `/gsd:add-tests [phase]` | Add unit and E2E tests to a phase | After execution, to boost test coverage

2. **UI Testing section** — Add a new `## UI Testing (Playwright)` section after the "Test Architecture" section. Include:
   - Brief description: GSD can generate and run Playwright E2E tests against your running application using the `gsd-playwright` agent.
   - The `/gsd:ui-test` command with its flags: `--scaffold` (force scaffolding), `--run-only` (skip generation), `--headed` (visible browser)
   - How it works: detects Playwright config, scaffolds if needed (playwright.config.ts, e2e/ directory), generates .spec.ts files from CONTEXT.md acceptance tests, runs them, reports results with screenshots on failure
   - The `/gsd:add-tests` workflow integration: during `/gsd:add-tests`, if Playwright is detected (or scaffolded), E2E tests are generated alongside unit tests
   - Example usage block:
     ```
     # Generate and run E2E tests for phase 71
     /gsd:ui-test 71 http://localhost:3000

     # Scaffold Playwright even if already detected
     /gsd:ui-test --scaffold

     # Run existing tests only (skip generation)
     /gsd:ui-test --run-only

     # Run in visible browser mode
     /gsd:ui-test --headed
     ```

3. **Model Profiles table** — Add `gsd-playwright` row: quality=Sonnet, balanced=Sonnet, budget=Haiku

4. **Troubleshooting** — Add entry:
   - "E2E tests fail with connection refused" -> "Make sure your dev server is running before running `/gsd:ui-test`. Playwright tests need a live server at the URL you provide."

5. **Recovery Quick Reference table** — Add row:
   - "Need E2E test coverage" | `/gsd:ui-test [phase] [url]` or `/gsd:add-tests [phase]`

Read the command specs (commands/gsd/ui-test.md and commands/gsd/add-tests.md) and the agent file (agents/gsd-playwright.md) to verify flag names and behavior before writing. Use the actual behavior from those files, not the requirements doc.
  </action>
  <verify>
    <automated>grep -c "ui-test\|add-tests\|gsd-playwright\|Playwright" docs/USER-GUIDE.md | xargs test 5 -le</automated>
  </verify>
  <done>User Guide has complete v2.7 documentation: UI Testing section with command reference, flags, examples, model profile entry, troubleshooting entry, and recovery reference</done>
</task>

</tasks>

<verification>
- README.md has `/gsd:ui-test` and `/gsd:add-tests` in commands table
- User Guide has new "UI Testing (Playwright)" section
- User Guide command reference tables include both new commands
- User Guide model profiles table includes `gsd-playwright`
- User Guide troubleshooting includes E2E connection refused entry
- No existing content was accidentally removed or broken
</verification>

<success_criteria>
Both README.md and docs/USER-GUIDE.md accurately document all v2.7 Playwright UI Testing features. A user reading either document would discover and understand how to use `/gsd:ui-test` and `/gsd:add-tests`.
</success_criteria>

<output>
After completion, create `.planning/quick/10-update-our-readme-and-user-guide-for-mil/10-SUMMARY.md`
</output>
