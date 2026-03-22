# Phase 91: Foundation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

All artifact formats and configuration schemas are defined so subsequent phases have concrete contracts to build against. This phase delivers the `uat-config.yaml` schema with js-yaml validation, the MILESTONE-UAT.md results format, the `/gsd:uat-auto` command spec, and the js-yaml npm dependency. No execution engine or autopilot wiring -- just the contracts.

</domain>

<decisions>
## Implementation Decisions

### uat-config.yaml Schema (CFG-01)
- Schema fields: `base_url` (required string), `startup_command` (optional string), `startup_wait_seconds` (optional number, default 10), `browser` (optional string, default "chrome-mcp"), `fallback_browser` (optional string, default "playwright"), `timeout_minutes` (optional number, default 10)
- File location: `.planning/uat-config.yaml`
- Parsed with js-yaml `yaml.load()` with `FAILSAFE_SCHEMA` replaced by default schema for type coercion (Claude's Decision: js-yaml default schema handles numeric coercion automatically, avoiding string-to-number bugs)
- Validation function in a new `uat.cjs` module that returns a structured config object or throws with descriptive error (Claude's Decision: dedicated module follows the established pattern of domain-specific CJS modules like testing.cjs, init.cjs)
- `base_url` is the only required field; all others have sensible defaults (Claude's Decision: minimizes config burden -- a single-line config file should work)

### Missing Config Skip Behavior (CFG-02)
- When `.planning/uat-config.yaml` does not exist, UAT is skipped silently -- no warning, no error, exit 0
- The skip check uses `fs.existsSync()` before any js-yaml parsing
- Skip behavior applies at both the autopilot level (`runAutomatedUAT()`) and the workflow level (`/gsd:uat-auto`)

### MILESTONE-UAT.md Format (CFG-03)
- YAML frontmatter fields: `status` (passed | gaps_found), `milestone` (version string), `browser` (chrome-mcp | playwright), `started` (ISO 8601 timestamp), `completed` (ISO 8601 timestamp), `total` (number), `passed` (number), `failed` (number)
- Results table: columns `#`, `Phase`, `Test`, `Status`, `Evidence`
- Gaps section uses identical YAML schema to MILESTONE-AUDIT.md: `truth`, `status`, `reason`, `severity` fields per gap entry
- Gaps stored as markdown YAML block in the body (not in frontmatter) (Claude's Decision: avoids known extractFrontmatter limitation with nested array-of-objects -- research SUMMARY explicitly flags this risk)
- Additional gap fields `evidence` and `observed` are additive metadata beyond the core four fields (Claude's Decision: provides UAT-specific debugging context without breaking gap closure loop compatibility)

### /gsd:uat-auto Command Spec
- Command file at `commands/gsd/uat-auto.md` following existing command spec pattern (YAML frontmatter with name, description, argument-hint, allowed-tools)
- Arguments: none required; optional `--timeout <minutes>` flag override
- Delegates to `workflows/uat-auto.md` (workflow file created in Phase 92, but the spec defines the contract now)
- Allowed tools: Read, Glob, Grep, Bash, Write (Claude's Decision: matches the tool set needed for file I/O, browser interaction via Bash, and results writing -- no Task since subagent spawning is prohibited per design constraint)
- Workflow steps defined in spec: load config, discover tests, detect browser, start app, execute tests, write results, commit, exit

### js-yaml Dependency
- Add `js-yaml ^4.1.1` to package.json dependencies (not devDependencies) (Claude's Decision: runtime dependency used by autopilot and workflow, not just tests)
- Install via `npm install js-yaml` during this phase

### Evidence Directory Convention
- Screenshots stored in `.planning/uat-evidence/{milestone}/` with naming pattern `{phase}-test-{N}.png`
- Directory convention defined now; actual screenshot creation happens in Phase 92 (Claude's Decision: defining the convention in the foundation phase prevents path mismatches between components built in different phases)

### Claude's Discretion
- Exact error messages in config validation
- Internal structure of the config validation function (single function vs validate-then-parse)
- Whether to export a `loadUatConfig()` convenience function or just `validateUatConfig()`
- Ordering of fields in the MILESTONE-UAT.md template
- Whether the command spec includes example output or just the workflow delegation

</decisions>

<specifics>
## Specific Ideas

**uat-config.yaml example (from design doc):**
```yaml
base_url: "http://localhost:3000"
startup_command: "npm run dev"
startup_wait_seconds: 10
browser: "chrome-mcp"
fallback_browser: "playwright"
timeout_minutes: 10
```

**MILESTONE-UAT.md format (from design doc):**
```markdown
---
status: passed | gaps_found
milestone: v1.2
browser: chrome-mcp | playwright
started: 2026-03-22T10:30:00Z
completed: 2026-03-22T10:35:00Z
total: 12
passed: 11
failed: 1
---

## Results

| # | Phase | Test | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | 04-comments | View Comments | pass | uat-evidence/v1.2/04-test-1.png |

## Gaps

- truth: "Comment appears immediately after submission"
  status: failed
  reason: "Automated UAT: comment form submits but list does not refresh"
  severity: major
  evidence: "uat-evidence/v1.2/04-test-2.png"
  observed: "Comment list shows 3 items before and after submit"
```

**Gap schema must match MILESTONE-AUDIT.md exactly:** The four core fields (`truth`, `status`, `reason`, `severity`) are consumed by `plan-milestone-gaps.md` which reads `gaps.requirements` from frontmatter. The gap section in MILESTONE-UAT.md body must be parseable by the same gap planning workflow.

**Config validation rules:**
- `base_url` must be a valid URL (use `new URL()` constructor for validation)
- `startup_wait_seconds` must be a positive number
- `timeout_minutes` must be a positive number
- `browser` must be one of: "chrome-mcp", "playwright"
- `fallback_browser` must be one of: "chrome-mcp", "playwright"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/lib/testing.cjs`: Existing CJS module pattern for test-related utilities. The new `uat.cjs` module can follow the same structure (exports object, CommonJS format).
- `bin/lib/core.cjs` / `bin/lib/phase.cjs` / `bin/lib/init.cjs`: Established pattern of domain-specific CJS modules consumed by both CLI and autopilot.
- `commands/gsd/ui-test.md`: Recent command spec (v2.7) as a template for the `uat-auto.md` command spec structure -- thin wrapper that delegates to a workflow.
- `commands/gsd/audit-milestone.md`: Command that delegates to `audit-milestone.md` workflow -- the closest pattern to what `uat-auto` will do.
- `get-shit-done/workflows/audit-milestone.md`: Defines MILESTONE-AUDIT.md format with YAML frontmatter (`status: passed | gaps_found | tech_debt`). The MILESTONE-UAT.md format mirrors this exactly.
- `get-shit-done/workflows/plan-milestone-gaps.md`: Consumes gap YAML from MILESTONE-AUDIT.md frontmatter (`gaps.requirements`, `gaps.integration`, `gaps.flows`). MILESTONE-UAT.md gaps must be consumable by this same workflow.

### Established Patterns
- **YAML frontmatter in result artifacts**: MILESTONE-AUDIT.md uses `status: passed | gaps_found` read by autopilot via `gsd-tools frontmatter get`. MILESTONE-UAT.md follows the same pattern.
- **Exit code contract**: 0 = success, 10 = gaps found, 1 = error. Used by `runMilestoneAudit()` in autopilot.mjs. `runAutomatedUAT()` (Phase 94) will use the identical contract.
- **CJS module pattern**: All lib modules use `module.exports = { ... }` with functions that operate on `.planning/` files. `uat.cjs` follows this.
- **Command spec YAML frontmatter**: `name`, `description`, `argument-hint`, `allowed-tools` fields in command `.md` files.

### Integration Points
- `package.json`: js-yaml dependency must be added here.
- `commands/gsd/uat-auto.md`: New command spec file (created in this phase).
- `bin/lib/uat.cjs`: New module for config parsing and validation (created in this phase).
- `get-shit-done/workflows/plan-milestone-gaps.md`: Must eventually recognize MILESTONE-UAT.md as a gap source (Phase 94 concern, but format compatibility is established now).

</code_context>

<deferred>
## Deferred Ideas

- **uat-auto.md workflow implementation** -- Phase 92 builds the actual workflow; this phase only defines the command spec contract
- **Chrome MCP probe and execution logic** -- Phase 92
- **Playwright fallback engine** -- Phase 93
- **runAutomatedUAT() in autopilot.mjs** -- Phase 94
- **plan-milestone-gaps.md modification to scan MILESTONE-UAT.md** -- Phase 94
- **App startup management (HTTP polling, dev server lifecycle)** -- Phase 94
- **Evidence screenshot git strategy (.gitignore vs commit)** -- Phase 94/95
- **Phase-level UAT (v2 requirement PLVL-01/02)** -- post-v3.1
- **UAT result trending (v2 requirement TRND-01)** -- post-v3.1

</deferred>

---

*Phase: 91-foundation*
*Context gathered: 2026-03-22 via auto-context*
