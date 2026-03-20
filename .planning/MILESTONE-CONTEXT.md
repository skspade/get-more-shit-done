# Milestone Context

**Source:** Brainstorm session (Playwright UI Testing Integration)
**Design:** .planning/designs/2026-03-19-playwright-ui-testing-integration-design.md

## Milestone Goal

Add on-demand Playwright UI testing support to GSD for web app projects. Three deliverables: a `/gsd:ui-test` command as the user entry point, a `gsd-playwright` agent for detection/scaffolding/generation/execution, and enhancements to the existing `add-tests` workflow to make its E2E classification path actionable. Entirely on-demand — not wired into the autonomous pipeline. Detects existing Playwright setup or scaffolds if missing.

## Features

### `/gsd:ui-test` Command Spec

User-facing command with arguments for phase number, base URL, and free-text instructions. Flags: `--scaffold`, `--run-only`, `--headed`. Parses arguments, detects/scaffolds Playwright, loads phase artifacts, generates Playwright test specs, runs via `npx playwright test`, and presents results with pass/fail summary and next steps.

File: `commands/gsd/ui-test.md`

### `gsd-playwright` Agent

Specialized agent handling: (1) Playwright detection via config files and package.json, (2) scaffolding with sensible defaults (Chromium-only, TypeScript, screenshot on failure), (3) test generation mapping acceptance test Given/When/Then to `.spec.ts` files with accessible locators, (4) test execution via `npx playwright test` with structured result parsing, (5) results reporting with bug vs test issue classification.

File: `agents/gsd-playwright.md`

### Enhanced `add-tests` Workflow

Modify `execute_e2e_generation` step to: detect Playwright setup, offer scaffolding if missing, generate `.spec.ts` files using Playwright best practices, run tests with RED-GREEN pattern matching TDD step. E2E results merge into existing summary table. Workflow contains E2E logic inline (not via subagent delegation) following same patterns as the agent spec.

File: `get-shit-done/workflows/add-tests.md` (modification)

### Test Generation Patterns

Locator priority: getByRole > getByText > getByLabel > getByTestId > CSS selectors. Common patterns for navigation, forms, modals, tables, loading states, toasts. Does NOT auto-generate: visual regression baselines, authentication flows, API mocking — flags these for user decision.

### Scaffolding Specification

Three-tier detection (config file → package.json dep → not found). Full scaffold: install `@playwright/test`, install Chromium, create `playwright.config.ts` with Chromium-only/trace-on-retry/screenshot-on-failure, create `e2e/` directory with example test, update `.gitignore`. Asks user for base URL before scaffolding.
