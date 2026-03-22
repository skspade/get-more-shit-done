# Technology Stack

**Project:** GSD Automated UAT Session (v3.1)
**Researched:** 2026-03-22

## Scope

This research covers ONLY what is new for v3.1: YAML config parsing for `uat-config.yaml`, app startup/shutdown management, screenshot file handling, Chrome MCP browser automation (primary), Playwright fallback execution, and autopilot integration. The existing validated stack (Node.js CJS, zx/ESM, Claude Code CLI, markdown-based state, Playwright detection/scaffolding in testing.cjs, Chrome MCP tools, Linear MCP) is NOT re-evaluated.

## Recommended Stack

### New Dependency: js-yaml

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| js-yaml | ^4.1.1 | Parse `uat-config.yaml` | See rationale below |

**Why js-yaml over alternatives:**

1. **Over hand-rolled parser:** The existing `extractFrontmatter()` in `frontmatter.cjs` is a hand-rolled YAML-subset parser. It handles flat key-value pairs, inline arrays, and simple nesting. It does NOT reliably parse all YAML features -- the known tech debt already notes it "does not parse nested YAML array-of-objects." The `uat-config.yaml` file is simple today (5 flat keys), but using a real parser avoids fragile custom code and handles edge cases (quoted strings with colons, booleans, numeric types).

2. **Over `yaml` package (eemeli/yaml):** `yaml` (v2.8.3) is more feature-rich (custom types, schema validation, streaming API) but heavier. `js-yaml` is lighter, faster, has 24k+ dependents, and is the standard choice for "just parse YAML." The `uat-config.yaml` is a simple flat config -- no custom types or streaming needed.

3. **Over no dependency (using extractFrontmatter):** While technically possible since the config is flat key-value, this couples UAT config parsing to the frontmatter module's quirks. A real YAML parser costs 61KB and removes ambiguity about type coercion (e.g., `startup_wait_seconds: 10` as number, not string "10").

**Confidence:** HIGH -- js-yaml 4.1.1 is stable, widely used, zero dependencies itself.

### No New Dependency: App Startup Management

| Approach | Why |
|----------|-----|
| `zx` `$` shell command + fetch retry loop | zx is already a dependency and provides `$` for spawning `npm run dev`. A simple retry loop (`fetch(base_url)` with backoff, max `startup_wait_seconds`) is sufficient -- no need for `wait-on` package. |

**Why NOT `wait-on`:** Adding a dependency for a 10-line fetch retry loop is unnecessary. The startup check is: spawn process, poll `base_url` with fetch every 1 second for N seconds, fail if timeout. Node.js built-in `fetch` (available since Node 18, project requires >=16.7 but runs on v20.16) handles this directly.

**Implementation note:** The startup command runs as a background child process. Use `zx`'s `$` with `.nothrow()` for the health check. Store the child process reference for cleanup (kill on UAT completion or error). Standard `process.kill(pid)` with SIGTERM is sufficient -- no `tree-kill` needed since `npm run dev` typically spawns a single process.

### No New Dependency: Screenshot File Handling

| Approach | Why |
|----------|-----|
| Node.js built-in `fs` + `Buffer` | Chrome MCP's `chrome_screenshot` returns base64 PNG data. Decode with `Buffer.from(data, 'base64')` and write with `fs.writeFileSync()`. Zero dependencies needed. |

### No New Dependency: Chrome MCP Browser Automation

| Tool | Purpose | Already Available |
|------|---------|-------------------|
| `tabs_context_mcp` | Session detection + availability check | Yes -- Chrome MCP tool |
| `tabs_create_mcp` | Create new browser tab | Yes -- Chrome MCP tool |
| `chrome_navigate` | Navigate to URL | Yes -- Chrome MCP tool |
| `chrome_click_element` | Click UI elements | Yes -- Chrome MCP tool |
| `chrome_fill_or_select` | Fill form fields | Yes -- Chrome MCP tool |
| `chrome_keyboard` | Keyboard input | Yes -- Chrome MCP tool |
| `chrome_screenshot` | Capture screenshot evidence | Yes -- Chrome MCP tool |
| `chrome_get_web_content` | Extract DOM content for assertion | Yes -- Chrome MCP tool |

These are MCP tools available to Claude subagents -- no npm packages involved. The UAT workflow file instructs the subagent to use them. Detection of availability is via attempting `tabs_context_mcp` and checking for error/timeout.

### No New Dependency: Playwright Fallback

| Technology | Version | Purpose | Already Available |
|------------|---------|---------|-------------------|
| @playwright/test | ^1.50.0 (installed: 1.58.2 available) | Fallback browser automation | Yes -- already in devDependencies |

The Playwright fallback uses the existing `@playwright/test` dependency. The design specifies ephemeral inline scripts (not persistent `.spec.ts` files) -- the subagent generates a script, runs it with `node`, captures results. The existing `detectPlaywright()` in `testing.cjs` handles detection.

**Note:** The current `@playwright/test` pin is `^1.50.0` but latest is 1.58.2. No need to bump for this milestone -- the ephemeral script approach works with any recent version. Bumping is optional maintenance.

## What NOT to Add

| Rejected | Why |
|----------|-----|
| `wait-on` | 10-line fetch retry loop is simpler than adding a dependency |
| `tree-kill` | `process.kill(pid, 'SIGTERM')` handles dev server cleanup; tree-kill adds complexity for no gain |
| `yaml` (eemeli/yaml) | Overkill for flat config file; js-yaml is lighter |
| `puppeteer` | Chrome MCP and Playwright already cover browser automation; puppeteer would be redundant |
| `sharp` / image processing | Screenshots are evidence files, not processed images; raw PNG from Chrome MCP is sufficient |
| `glob` / `fast-glob` | UAT.md discovery uses `fs.readdirSync` + filter on phase directories (already the pattern in phase.cjs) |
| Any test assertion library | Claude is the "assertion engine" -- it compares screenshots and DOM content against natural language expectations |

## Installation

```bash
# Single new dependency
npm install js-yaml
```

No devDependency additions needed. Playwright is already installed.

## Integration Points

### New CJS Module: `uat.cjs`

A new module at `get-shit-done/bin/lib/uat.cjs` providing:

| Function | Purpose | Uses |
|----------|---------|------|
| `loadUatConfig(projectDir)` | Parse `.planning/uat-config.yaml` | js-yaml |
| `discoverUatTests(projectDir)` | Find `*-UAT.md` files across phase dirs | fs, path, existing phase.cjs patterns |
| `writeUatResults(projectDir, results)` | Write MILESTONE-UAT.md with frontmatter | extractFrontmatter/reconstructFrontmatter from frontmatter.cjs |
| `saveScreenshot(evidenceDir, name, base64Data)` | Decode and save PNG evidence | fs, Buffer |

### Autopilot Integration: `runAutomatedUAT()`

New async function in `autopilot.mjs` inserted between audit pass and `runMilestoneCompletion()`. Three insertion points exist (lines 1089, 1094, 1167-1172). The function:

1. Calls `loadUatConfig()` -- if no config, skip UAT (not all projects have web UIs)
2. Optionally starts the app via `$\`${config.startup_command}\`` (zx background process)
3. Calls `runClaudeStreaming('/gsd:uat-auto')` (existing pattern)
4. Parses exit code: 0 + pass = complete, 0 + gaps = gap closure loop, non-zero = debug retry

### New Workflow: `workflows/uat-auto.md`

Defines the `/gsd:uat-auto` slash command consumed by autopilot. This is a markdown prompt file (standard GSD pattern), not code. The workflow instructs the Claude subagent on the 8-step UAT execution process.

### New Command: `commands/uat-auto.md`

Command spec for `/gsd:uat-auto` (standard GSD pattern, like existing `linear.md`, `brainstorm.md`).

## Existing Stack (Unchanged)

| Technology | Version | Role | Notes |
|------------|---------|------|-------|
| Node.js | v20.16.0 | Runtime | CJS modules + ESM autopilot |
| zx | ^8.0.0 (8.8.5 installed) | Autopilot shell commands | `$` for app startup, process management |
| @playwright/test | ^1.50.0 | Fallback browser driver | Already in devDependencies |
| Claude Code CLI | Latest | Subagent invocation | `runClaudeStreaming()` pattern |
| Chrome MCP | N/A (tool-level) | Primary browser automation | Available via MCP tool calls |

## Sources

- [js-yaml on npm](https://www.npmjs.com/package/js-yaml) -- v4.1.1, 24k+ dependents
- [yaml on npm](https://www.npmjs.com/package/yaml) -- v2.8.3, considered but rejected as overkill
- [js-yaml GitHub](https://github.com/nodeca/js-yaml) -- MIT license, zero dependencies
- [wait-on on npm](https://www.npmjs.com/package/wait-on) -- considered but rejected in favor of fetch retry
- Existing codebase: `frontmatter.cjs` (hand-rolled YAML parser limitations), `testing.cjs` (Playwright detection), `autopilot.mjs` (integration pattern)
