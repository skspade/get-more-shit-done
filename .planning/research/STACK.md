# Stack Research

**Domain:** Claude Agent SDK migration for autonomous autopilot orchestrator
**Researched:** 2026-03-24
**Confidence:** HIGH

## Scope

This research covers ONLY what is new for v3.2: the `@anthropic-ai/claude-agent-sdk` npm package, its peer dependency (`zod`), TypeScript type availability for JavaScript consumers, ESM/zx compatibility, Node.js version requirements, and integration points with the existing autopilot.mjs. The existing validated stack (Node.js CJS, zx/ESM, js-yaml, Claude Code CLI, markdown-based state, Chrome MCP, Playwright) is NOT re-evaluated.

## Recommended Stack

### New Dependency: @anthropic-ai/claude-agent-sdk

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @anthropic-ai/claude-agent-sdk | ^0.2.81 | Replace `runClaudeStreaming()` CLI subprocess spawning with SDK `query()` calls | The SDK provides typed message streaming, built-in `maxTurns`/`maxBudgetUsd` safety limits, hook-based lifecycle events, and per-step MCP server configuration -- all features the design requires. It spawns Claude Code as a subprocess internally (same auth model), so this is a drop-in replacement for the `claude -p` invocations, not an API change. |

**Key facts verified from npm registry and official docs:**

1. **Version:** 0.2.81 (published 2026-03-20, actively maintained with 66 releases)
2. **Module format:** ESM-only (`"type": "module"`, entry point `sdk.mjs`). This is a direct match for autopilot.mjs which is already ESM.
3. **Node.js requirement:** `>=18.0.0`. Current project `engines` field says `>=16.7.0` -- this MUST be bumped to `>=18.0.0`. The actual runtime is v22.20.0 so no practical impact, but the package.json needs updating for correctness.
4. **Authentication:** Uses the same Claude Code CLI under the hood. The SDK spawns `claude` as a subprocess -- no ANTHROPIC_API_KEY change needed. The existing `which('claude')` prerequisite check remains valid.
5. **No direct dependencies:** The SDK has zero npm dependencies (empty `dependencies` object).
6. **TypeScript types included:** Ships `sdk.d.ts` alongside `sdk.mjs`. JavaScript consumers get full IntelliSense/type checking via JSDoc `@type` imports without installing TypeScript.
7. **Renamed from `@anthropic-ai/claude-code`:** The package was renamed in v0.1.0. The new name is `@anthropic-ai/claude-agent-sdk`. Do not use the old package name.

**Breaking changes from v0.1.0 (already accounted for in design):**
- System prompt no longer defaults to Claude Code's prompt. Must explicitly pass `systemPrompt: { type: "preset", preset: "claude_code" }`.
- Settings sources no longer loaded by default. Must pass `settingSources: ["project"]` to load CLAUDE.md files.
- Both of these are already specified in the design document's `runAgentStep()` function.

### New Peer Dependency: zod

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| zod | ^4.0.0 | Required peer dependency of claude-agent-sdk | The SDK declares `zod: "^4.0.0"` as a peer dependency. It is NOT marked optional. npm 7+ will auto-install it, but it should be explicitly listed. |

**Why zod is needed but not directly used:**

The SDK uses zod internally for the `tool()` function's schema validation (custom MCP tool definitions). Our project does NOT use `tool()` -- we only use `query()`. However, because zod is a required (not optional) peer dependency, npm will warn or error if it is absent. Installing it explicitly avoids install-time warnings and ensures deterministic dependency resolution.

**Why zod 4, not zod 3:** The SDK's npm registry entry shows `"zod": "^4.0.0"` as the peer dependency (updated from `^3.24.1` in earlier versions). Zod 4 is a major version bump with breaking changes from zod 3, but since we do not use zod directly in our code, the version is irrelevant to us -- it only needs to satisfy the SDK's peer requirement.

**Confidence:** HIGH -- verified directly from `npm view @anthropic-ai/claude-agent-sdk peerDependencies`.

### Package.json Engine Bump

| Change | From | To | Why |
|--------|------|----|-----|
| `engines.node` | `>=16.7.0` | `>=18.0.0` | The SDK requires Node.js 18+. The project already runs on v22.20.0, but the package.json `engines` field must reflect the new minimum. |

This is a necessary change, not optional. The SDK's entry point is an ES module (`sdk.mjs`) that uses Node.js 18+ APIs.

## ESM/zx Compatibility

**Fully compatible.** The SDK exports ESM (`sdk.mjs`), and autopilot.mjs is already ESM (zx shebang `#!/usr/bin/env zx`). The import is:

```javascript
import { query } from "@anthropic-ai/claude-agent-sdk";
```

This works directly alongside the existing zx imports and `createRequire` CJS bridge. No interop shims needed.

**zx remains necessary.** The SDK replaces only the Claude invocation layer (`runClaudeStreaming()`). The following zx features are still used and cannot be replaced by the SDK:
- `$` template literals for `gsdTools()` shell commands (gsd-tools.cjs dispatch)
- `$` for `takeProgressSnapshot()` (git diff calls)
- `argv` for CLI argument parsing (`--from-phase`, `--project-dir`, `--dry-run`, `--quiet`, `--legacy`)
- `which()` for prerequisite checks (`claude`, `node`)

## TypeScript Types for JavaScript Consumers

The SDK ships TypeScript declarations (`sdk.d.ts`) alongside the JavaScript entry point. JavaScript consumers can leverage these types via JSDoc annotations without adding TypeScript as a dependency:

```javascript
/** @typedef {import("@anthropic-ai/claude-agent-sdk").SDKMessage} SDKMessage */
/** @typedef {import("@anthropic-ai/claude-agent-sdk").SDKResultMessage} SDKResultMessage */
/** @typedef {import("@anthropic-ai/claude-agent-sdk").HookCallback} HookCallback */
```

Key types available for the migration:

| Type | Purpose | Used In |
|------|---------|---------|
| `SDKMessage` | Union of all message types from `query()` | `handleMessage()` |
| `SDKAssistantMessage` | Assistant response with content blocks | `handleMessage()` text/tool display |
| `SDKResultMessage` | Final result with cost, turns, exit status | `runAgentStep()` return value |
| `SDKSystemMessage` | Init message with session_id, model | `handleMessage()` session logging |
| `HookCallback` | Hook function signature | `buildStepHooks()` stall detection |
| `HookCallbackMatcher` | Hook config with matcher regex | `buildStepHooks()` return type |
| `Options` | Full options object for `query()` | `runAgentStep()` |
| `McpStdioServerConfig` | MCP server config for stdio transport | UAT Chrome MCP config |

No TypeScript compiler or build step is needed. The `.d.ts` files provide editor support and type checking via `// @ts-check` if desired.

## Installation

```bash
# New dependencies (one SDK + one peer dependency)
npm install @anthropic-ai/claude-agent-sdk zod
```

That is the complete install command. Two packages added to `dependencies` in package.json.

## What NOT to Add

| Rejected | Why | Use Instead |
|----------|-----|-------------|
| `@anthropic-ai/claude-code` | Old package name, renamed to `claude-agent-sdk` in v0.1.0 | `@anthropic-ai/claude-agent-sdk` |
| `@anthropic-ai/sdk` (Client SDK) | Direct API SDK -- requires implementing your own tool loop. The Agent SDK handles tool execution autonomously. | `@anthropic-ai/claude-agent-sdk` |
| TypeScript compiler (`typescript`) | SDK ships pre-built `.mjs` + `.d.ts`. No compilation needed for JS consumers. | JSDoc type imports for editor support |
| `@modelcontextprotocol/sdk` | Only needed if using `tool()` or `createSdkMcpServer()` for custom MCP tools. We use stdio MCP configs (Chrome MCP), not SDK-embedded servers. | `mcpServers` option with `McpStdioServerConfig` objects |
| `dotenv` | The SDK reads `ANTHROPIC_API_KEY` from the environment. The project already has Claude Code CLI auth configured. No `.env` file handling needed. | Existing CLI authentication |
| Any logging library | The design uses `process.stdout.write` / `process.stderr.write` / existing `logMsg()`. The SDK's typed messages replace NDJSON parsing -- no log parsing library needed. | Existing `logMsg()` and `handleMessage()` |

## Key SDK API Surface (Verified)

### `query()` function

```javascript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Returns AsyncGenerator<SDKMessage, void>
for await (const message of query({
  prompt: "string",
  options: {
    cwd: "/path/to/project",
    permissionMode: "bypassPermissions",           // or "acceptEdits", "default", "dontAsk", "plan"
    allowDangerouslySkipPermissions: true,          // required with bypassPermissions
    maxTurns: 200,                                  // max agentic turns (tool-use round trips)
    maxBudgetUsd: 5.00,                             // optional cost cap per query
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"],
    systemPrompt: { type: "preset", preset: "claude_code" },  // use Claude Code system prompt
    settingSources: ["project"],                    // load CLAUDE.md files
    mcpServers: {                                   // per-query MCP server configs
      "chrome-devtools": {
        command: "npx",
        args: ["@anthropic-ai/chrome-devtools-mcp@latest"]
      }
    },
    hooks: {
      PostToolUse: [{ matcher: ".*", hooks: [myHook] }],
      Stop: [{ matcher: ".*", hooks: [cleanupHook] }]
    }
  }
})) {
  // message is SDKMessage union type
}
```

### Message types returned

| Type | `message.type` | Key Fields | When |
|------|----------------|------------|------|
| System init | `"system"` | `session_id`, `model`, `tools`, `mcp_servers` | First message |
| Assistant | `"assistant"` | `message.content[]` (text blocks + tool_use blocks) | Each assistant turn |
| Result (success) | `"result"` | `subtype: "success"`, `result`, `total_cost_usd`, `num_turns` | Query complete |
| Result (max turns) | `"result"` | `subtype: "error_max_turns"`, `errors[]` | Hit maxTurns limit |
| Result (budget) | `"result"` | `subtype: "error_max_budget_usd"`, `errors[]` | Hit cost cap |
| Result (error) | `"result"` | `subtype: "error_during_execution"`, `errors[]` | Execution error |

### Hook signature

```javascript
/** @type {import("@anthropic-ai/claude-agent-sdk").HookCallback} */
const myHook = async (input, toolUseID, { signal }) => {
  // input has session_id, cwd, hook_event_name
  // For PostToolUse: also has tool_name, tool_input, tool_result
  return {};  // empty object = no-op (allow, don't modify)
};
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@anthropic-ai/claude-agent-sdk@^0.2.81` | Node.js >=18.0.0 | ESM only, ships `.mjs` entry |
| `@anthropic-ai/claude-agent-sdk@^0.2.81` | `zx@^8.0.0` | Both ESM, no conflicts |
| `@anthropic-ai/claude-agent-sdk@^0.2.81` | `zod@^4.0.0` | Required peer dependency |
| `zod@^4.0.0` | Node.js >=18.0.0 | Standard library, widely compatible |
| `zod@^4.0.0` | `js-yaml@^4.1.1` | No interaction (independent packages) |

## Sources

- [npm registry: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) -- v0.2.81, verified version/engines/peerDeps via `npm view` (HIGH confidence)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) -- architecture, capabilities, authentication model (HIGH confidence)
- [Agent SDK Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) -- Node.js 18+ prerequisite, installation, query() usage (HIGH confidence)
- [TypeScript SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript) -- full Options type, message types, hook types (HIGH confidence)
- [Migration Guide](https://platform.claude.com/docs/en/agent-sdk/migration-guide) -- breaking changes in v0.1.0 rename, systemPrompt/settingSources defaults (HIGH confidence)
- [Hooks Guide](https://platform.claude.com/docs/en/agent-sdk/hooks) -- PostToolUse/Stop hook patterns, matcher syntax (HIGH confidence)
- [GitHub: claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) -- v0.2.81, 66 releases, Node.js 18+ badge (HIGH confidence)
- [GitHub Issue #38: zod v3 to v4 upgrade](https://github.com/anthropics/claude-agent-sdk-typescript/issues/38) -- zod peer dependency context (MEDIUM confidence)

---
*Stack research for: Autopilot Agent SDK Migration (v3.2)*
*Researched: 2026-03-24*
