# Phase 91: Foundation - Research

**Researched:** 2026-03-22
**Domain:** UAT configuration schemas, artifact formats, command spec
**Confidence:** HIGH

## Summary

Phase 91 is a pure foundation phase — no runtime behavior, only contracts. It defines the `uat-config.yaml` schema with js-yaml validation, the MILESTONE-UAT.md results format, the `/gsd:uat-auto` command spec, and installs the js-yaml npm dependency. All decisions are locked in CONTEXT.md; no architectural ambiguity exists.

The primary risk is gap schema compatibility between MILESTONE-UAT.md and the existing `plan-milestone-gaps.md` workflow, which reads `gaps.requirements` from MILESTONE-AUDIT.md frontmatter. The CONTEXT.md explicitly addresses this by placing gaps in the markdown body (not frontmatter) to avoid the known `extractFrontmatter` limitation with nested array-of-objects.

**Primary recommendation:** Implement as three focused deliverables — config validation module (uat.cjs), artifact template (MILESTONE-UAT.md format), and command spec (uat-auto.md) — with js-yaml as a runtime dependency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **uat-config.yaml Schema (CFG-01):** Fields: `base_url` (required string), `startup_command` (optional string), `startup_wait_seconds` (optional number, default 10), `browser` (optional string, default "chrome-mcp"), `fallback_browser` (optional string, default "playwright"), `timeout_minutes` (optional number, default 10). Located at `.planning/uat-config.yaml`. Parsed with js-yaml default schema. Validation in `uat.cjs` module.
- **Missing Config Skip Behavior (CFG-02):** When `.planning/uat-config.yaml` does not exist, UAT is skipped silently — no warning, no error, exit 0. Uses `fs.existsSync()` before any parsing. Applies at both autopilot and workflow levels.
- **MILESTONE-UAT.md Format (CFG-03):** YAML frontmatter: `status`, `milestone`, `browser`, `started`, `completed`, `total`, `passed`, `failed`. Results table with columns `#`, `Phase`, `Test`, `Status`, `Evidence`. Gaps in markdown body (not frontmatter) using identical schema to MILESTONE-AUDIT.md: `truth`, `status`, `reason`, `severity`. Additional gap fields `evidence` and `observed` are additive.
- **/gsd:uat-auto Command Spec:** At `commands/gsd/uat-auto.md`. Arguments: none required; optional `--timeout <minutes>`. Delegates to `workflows/uat-auto.md`. Allowed tools: Read, Glob, Grep, Bash, Write.
- **js-yaml Dependency:** Add `js-yaml ^4.1.1` to package.json dependencies (runtime, not dev).
- **Evidence Directory Convention:** Screenshots at `.planning/uat-evidence/{milestone}/` with pattern `{phase}-test-{N}.png`.

### Claude's Discretion
- Exact error messages in config validation
- Internal structure of the config validation function (single function vs validate-then-parse)
- Whether to export a `loadUatConfig()` convenience function or just `validateUatConfig()`
- Ordering of fields in the MILESTONE-UAT.md template
- Whether the command spec includes example output or just the workflow delegation

### Deferred Ideas (OUT OF SCOPE)
- uat-auto.md workflow implementation (Phase 92)
- Chrome MCP probe and execution logic (Phase 92)
- Playwright fallback engine (Phase 93)
- runAutomatedUAT() in autopilot.mjs (Phase 94)
- plan-milestone-gaps.md modification to scan MILESTONE-UAT.md (Phase 94)
- App startup management (Phase 94)
- Evidence screenshot git strategy (Phase 94/95)
- Phase-level UAT (post-v3.1)
- UAT result trending (post-v3.1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CFG-01 | `uat-config.yaml` schema defines base_url, startup_command, startup_wait_seconds, browser, fallback_browser, timeout_minutes | js-yaml API for parsing, URL constructor for validation, CJS module pattern from existing lib modules |
| CFG-02 | Missing `uat-config.yaml` causes UAT to be skipped silently (non-web projects proceed to completion) | fs.existsSync() guard pattern, exit code contract (0 = success) |
| CFG-03 | MILESTONE-UAT.md format defined with YAML frontmatter and results table | Existing MILESTONE-AUDIT.md format as template, gap schema from plan-milestone-gaps.md |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| js-yaml | ^4.1.1 | YAML parsing for uat-config.yaml | De facto standard YAML parser for Node.js. 35M+ weekly downloads. Used by eslint, prettier, and most Node tooling. |
| node:fs | built-in | File existence checks, reading config | Standard Node.js fs module, already used throughout the codebase |
| node:url | built-in | URL validation via `new URL()` constructor | Standard validation approach, throws on invalid URLs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| js-yaml | yaml (npm) | yaml package is spec-complete YAML 1.2 but heavier; js-yaml is simpler and sufficient for config files |

**Installation:**
```bash
npm install js-yaml
```

## Architecture Patterns

### CJS Module Pattern (from existing codebase)
All lib modules in `get-shit-done/bin/lib/` follow this pattern:
```javascript
/**
 * ModuleName — One-line description
 */
const fs = require('fs');
const path = require('path');

function publicFunction(args) {
  // implementation
}

module.exports = { publicFunction };
```

The new `uat.cjs` module follows this exact pattern. It exports validation/loading functions consumed by both CLI (`gsd-tools.cjs`) and autopilot (`autopilot.mjs`).

### Command Spec Pattern (from existing codebase)
Command specs at `commands/gsd/*.md` use YAML frontmatter:
```yaml
---
name: gsd:command-name
description: One-line description
argument-hint: "[args] [--flags]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
---
```

The `uat-auto.md` command spec follows this pattern, delegating to `workflows/uat-auto.md`.

### Config Validation Pattern
**Recommended structure for uat.cjs:**
```javascript
function loadUatConfig(planningDir) {
  const configPath = path.join(planningDir, 'uat-config.yaml');
  if (!fs.existsSync(configPath)) return null;  // skip signal

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.load(raw);  // js-yaml default schema
  return validateConfig(parsed);   // throws on invalid
}

function validateConfig(config) {
  // Validate base_url (required, valid URL)
  // Apply defaults for optional fields
  // Return structured config object
}
```

Returning `null` when config is missing (vs throwing) gives callers a clean skip signal per CFG-02.

### Anti-Patterns to Avoid
- **Putting gap arrays in YAML frontmatter:** The existing `extractFrontmatter` utility has a known limitation with nested array-of-objects. Gaps MUST go in the markdown body.
- **Using FAILSAFE_SCHEMA:** CONTEXT.md initially mentioned it but then corrected — use js-yaml's default schema which handles type coercion automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom parser | js-yaml `yaml.load()` | Edge cases in YAML spec are extensive |
| URL validation | Regex pattern | `new URL(str)` constructor | Handles all RFC 3986 edge cases |
| File existence | Try/catch on read | `fs.existsSync()` | Cleaner intent, no error swallowing |

## Common Pitfalls

### Pitfall 1: YAML Type Coercion Surprises
**What goes wrong:** js-yaml's default schema converts `yes`/`no`/`on`/`off` to booleans, `0x` prefixed strings to hex numbers
**Why it happens:** YAML 1.1 type coercion rules are aggressive
**How to avoid:** Validate types after parsing (check `typeof config.base_url === 'string'`)
**Warning signs:** Config values that should be strings becoming booleans

### Pitfall 2: URL Validation Edge Cases
**What goes wrong:** `new URL('localhost:3000')` throws because it lacks a protocol
**Why it happens:** URL constructor requires protocol scheme
**How to avoid:** Error message should explicitly mention "must include http:// or https://"
**Warning signs:** User configs with bare `localhost:3000`

### Pitfall 3: Gap Schema Drift
**What goes wrong:** MILESTONE-UAT.md gap format diverges from MILESTONE-AUDIT.md, breaking gap closure
**Why it happens:** Different phases define the formats independently
**How to avoid:** Use identical core four fields (`truth`, `status`, `reason`, `severity`); additive fields (`evidence`, `observed`) are safe
**Warning signs:** plan-milestone-gaps.md can't parse UAT gaps

## Code Examples

### js-yaml Loading (HIGH confidence)
```javascript
const yaml = require('js-yaml');
const fs = require('fs');

const config = yaml.load(fs.readFileSync('uat-config.yaml', 'utf-8'));
// config is a plain JS object with types coerced by default schema
```

### URL Validation (HIGH confidence)
```javascript
function validateUrl(urlStr) {
  try {
    new URL(urlStr);
  } catch {
    throw new Error(`Invalid base_url "${urlStr}" — must be a valid URL (e.g., http://localhost:3000)`);
  }
}
```

### Config Defaults Pattern (HIGH confidence)
```javascript
function applyDefaults(config) {
  return {
    base_url: config.base_url,  // required, no default
    startup_command: config.startup_command || null,
    startup_wait_seconds: config.startup_wait_seconds ?? 10,
    browser: config.browser || 'chrome-mcp',
    fallback_browser: config.fallback_browser || 'playwright',
    timeout_minutes: config.timeout_minutes ?? 10,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| js-yaml FAILSAFE_SCHEMA | js-yaml DEFAULT_SCHEMA | Stable | Default schema handles type coercion, FAILSAFE treats everything as strings |
| Custom YAML frontmatter parsing | js-yaml for all YAML | Stable | Consistent parser across config and artifact frontmatter |

## Open Questions

1. **Gap body parsing consistency**
   - What we know: MILESTONE-AUDIT.md stores gaps in frontmatter YAML; MILESTONE-UAT.md stores gaps in markdown body
   - What's unclear: Whether plan-milestone-gaps.md will need modification to also parse body gaps (Phase 94 concern)
   - Recommendation: Define the format now; Phase 94 handles the parsing integration

## Sources

### Primary (HIGH confidence)
- js-yaml npm package — API, default schema behavior, type coercion rules
- Existing codebase patterns — CJS module structure, command spec format, MILESTONE-AUDIT.md format
- Existing plan-milestone-gaps.md workflow — gap schema requirements (truth, status, reason, severity)

### Secondary (MEDIUM confidence)
- Node.js URL constructor — validation behavior for malformed URLs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - js-yaml is well-established, codebase patterns are documented
- Architecture: HIGH - follows existing CJS module and command spec patterns exactly
- Pitfalls: HIGH - YAML coercion and URL validation are well-known issues

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain, no fast-moving dependencies)
