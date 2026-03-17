# Phase 65: Structure and State Checks - Research

**Researched:** 2026-03-15
**Domain:** CJS module internals — check registry population
**Confidence:** HIGH

## Summary

Phase 65 adds concrete check implementations to the validation.cjs registry skeleton created in Phase 64. The work is purely internal code migration — taking check logic from `cli.cjs` `gatherHealthData()` (lines 409-595) and `verify.cjs` `cmdValidateHealth()` (lines 535-797) and re-implementing it as registry entries in validation.cjs.

No external libraries are needed. The phase uses only Node.js builtins (`fs`, `path`) and existing project utilities (`core.cjs` `getMilestoneInfo()`, `frontmatter.cjs` `extractFrontmatter()`).

**Primary recommendation:** Implement checks in two waves — structure checks (STRUCT-01 through STRUCT-04) first since they have no cross-file dependencies, then state consistency checks (STATE-01 through STATE-04) which require both STATE.md and ROADMAP.md parsing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- STRUCT-01: File existence checks for `.planning/`, PROJECT.md, ROADMAP.md, STATE.md, config.json, `phases/` — migrated from `gatherHealthData()` checks 1-5 and `cmdValidateHealth()` checks 1-4
- STRUCT-02: Config JSON validation — parse validity, `model_profile` enum check against `['quality', 'balanced', 'budget']`, unknown key detection against `knownKeys` list
- STRUCT-03: Phase directory naming — directories must match `NN-name` format regex `/^\d{2}(?:\.\d+)*-[\w-]+$/`
- STRUCT-04: Orphaned plan detection — PLAN.md files without corresponding SUMMARY.md
- STATE-01: STATE.md `milestone_name` frontmatter field must match ROADMAP.md active milestone name
- STATE-02: STATE.md `completed_phases` count must match ROADMAP.md `[x]` count for current milestone
- STATE-03: STATE.md `total_phases` must match ROADMAP.md phase count for current milestone
- STATE-04: STATE.md `status` field consistency — `completed` only when all phases checked, `active` when unchecked phases remain
- Error codes: E001-E004 for STRUCT-01, E005/W003/W004 for STRUCT-02, W005 for STRUCT-03, I001 for STRUCT-04
- STATE checks get new codes (no existing codes cover this)
- Severity assignments as documented in CONTEXT.md
- Each check is a separate `{ id, category, severity, check }` object in the `checks` array
- STRUCT-01 split into multiple registry entries (one per file/directory)
- STATE checks skip gracefully if STATE.md or ROADMAP.md absent
- Config validation is a single check reporting multiple issues
- Use `frontmatter.cjs` `extractFrontmatter()` for STATE.md parsing
- Use `core.cjs` `getMilestoneInfo()` for ROADMAP.md active milestone
- Extract `knownKeys` as shared constant in validation.cjs (not imported from cli.cjs)
- No changes to cli.cjs, verify.cjs, or gsd-tools.cjs in this phase

### Claude's Discretion
- Internal helper functions for reading/parsing STATE.md and ROADMAP.md
- Whether to use early-return or accumulate-all pattern within individual check functions
- Exact diagnostic message wording for new STATE checks
- Order of checks within the registry array
- Whether STRUCT-01 file checks short-circuit or report all failures

### Deferred Ideas (OUT OF SCOPE)
- Phase navigation checks using `computePhaseStatus()` and `findFirstIncompletePhase()` (Phase 66)
- Autopilot readiness checks with deterministic step detection (Phase 66)
- Auto-repair logic for stale STATE.md counts and missing phase directories (Phase 67)
- Consumer migration: cli.cjs `gatherHealthData()` and verify.cjs `cmdValidateHealth()` delegation (Phase 67)
- Dead code removal from cli.cjs and verify.cjs after migration (Phase 67)
- Test suite for all check categories (Phase 68)
- `KNOWN_SETTINGS_KEYS` consolidation with cli.cjs (Phase 67)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STRUCT-01 | File existence checks migrated from `gatherHealthData()` | Source logic at cli.cjs:426-507; split into 6 registry entries (one per path) |
| STRUCT-02 | Config JSON validation — parse, enum, unknown keys | Source logic at cli.cjs:511-531; single registry entry with multi-issue reporting |
| STRUCT-03 | Phase directory naming validation | Source regex at verify.cjs:642; single registry entry iterating phase dirs |
| STRUCT-04 | Orphaned plan detection | Source logic at verify.cjs:648-665; single registry entry iterating phase dirs |
| STATE-01 | STATE.md milestone name matches ROADMAP.md | Use `extractFrontmatter()` for STATE.md `milestone_name`, `getMilestoneInfo()` for ROADMAP.md |
| STATE-02 | STATE.md `completed_phases` matches ROADMAP.md `[x]` count | Parse ROADMAP.md checkboxes, compare with frontmatter `progress.completed_phases` |
| STATE-03 | STATE.md `total_phases` matches ROADMAP.md phase count | Count ROADMAP.md phase entries, compare with frontmatter `progress.total_phases` |
| STATE-04 | STATE.md status consistency | Compare `status` field with whether all phases are checked |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | built-in | File existence checks, directory reads | Already used throughout project |
| Node.js path | built-in | Path construction | Already used throughout project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| frontmatter.cjs | project | STATE.md YAML frontmatter parsing | STATE-01 through STATE-04 |
| core.cjs | project | `getMilestoneInfo()` for ROADMAP.md | STATE-01 milestone name comparison |
| core.cjs | project | `safeReadFile()` for graceful reads | All checks needing file content |

### Alternatives Considered
None — this is internal refactoring using existing project modules.

## Architecture Patterns

### Check Registry Pattern (from Phase 64)
Each check is an object appended to the module-level `checks` array:
```javascript
{
  id: 'STRUCT-01a',
  category: 'structure',
  severity: 'error',
  check: (cwd) => {
    const exists = fs.existsSync(path.join(cwd, '.planning'));
    return { passed: exists, message: exists ? '.planning/ directory exists' : '.planning/ directory not found' };
  },
}
```

### Multi-Issue Check Pattern (STRUCT-02)
Config validation needs to report multiple issues from one check. The check function returns `passed: false` if any issue found, with all issues concatenated in the message:
```javascript
check: (cwd) => {
  const issues = [];
  // ... accumulate issues
  return { passed: issues.length === 0, message: issues.join('; ') || 'config.json valid' };
}
```

### Graceful Skip Pattern (STATE checks)
STATE checks must not fail when prerequisite files are missing:
```javascript
check: (cwd) => {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(statePath) || !fs.existsSync(roadmapPath)) {
    return { passed: true, message: 'Skipped — STATE.md or ROADMAP.md not found' };
  }
  // ... actual check
}
```

### Anti-Patterns to Avoid
- **Importing from cli.cjs or verify.cjs** — validation.cjs must not depend on these; they will eventually delegate to it
- **Console output in checks** — return data only, no `console.log()` or ANSI codes
- **Throwing exceptions** — check functions must catch errors and return `{ passed, message }`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | `frontmatter.cjs` `extractFrontmatter()` | Already handles nested YAML, arrays, quotes |
| Milestone name extraction | Custom ROADMAP regex | `core.cjs` `getMilestoneInfo()` | Already strips `<details>` blocks, handles fallbacks |
| File reading with fallback | try/catch everywhere | `core.cjs` `safeReadFile()` | Returns empty string on error |

## Common Pitfalls

### Pitfall 1: STRUCT-01 ID Collision
**What goes wrong:** Phase 64 already registered `STRUCT-01` for `.planning/` directory check.
**Why it happens:** New file checks (PROJECT.md, ROADMAP.md, etc.) need unique IDs.
**How to avoid:** Use sub-IDs: STRUCT-01a (.planning/), STRUCT-01b (PROJECT.md), STRUCT-01c (ROADMAP.md), STRUCT-01d (STATE.md), STRUCT-01e (config.json), STRUCT-01f (phases/). Replace the existing Phase 64 STRUCT-01 entry.
**Warning signs:** Test failures on duplicate check IDs.

### Pitfall 2: STATE.md Frontmatter Path
**What goes wrong:** `extractFrontmatter()` returns flat keys but STATE.md has nested `progress:` block.
**Why it happens:** YAML nesting means `progress.completed_phases` is at `frontmatter.progress.completed_phases`.
**How to avoid:** Access via `fm.progress?.completed_phases` with optional chaining.
**Warning signs:** `undefined` comparisons in STATE-02/STATE-03.

### Pitfall 3: getMilestoneInfo() Returns Version Not Name
**What goes wrong:** `getMilestoneInfo()` returns `{ version: 'v2.6', name: 'Unified Validation Module' }` — the `name` field may not exactly match STATE.md `milestone_name` frontmatter.
**Why it happens:** Different formatting between ROADMAP heading and STATE.md frontmatter value.
**How to avoid:** Compare normalized forms — check if STATE.md milestone_name contains the ROADMAP milestone name or vice versa.
**Warning signs:** False positive errors on milestone name mismatch.

### Pitfall 4: ROADMAP Phase Counting Scope
**What goes wrong:** Counting `[x]` and `[ ]` across the entire ROADMAP.md includes archived milestones.
**Why it happens:** ROADMAP has `<details>` blocks for shipped milestones with their own checkboxes.
**How to avoid:** Strip `<details>` blocks before counting, or only count within the active milestone section (between `## Phases` and next `##`).
**Warning signs:** Phase counts much larger than expected.

## Code Examples

### Existing Check Pattern (from validation.cjs Phase 64)
```javascript
const checks = [
  {
    id: 'STRUCT-01',
    category: 'structure',
    severity: 'error',
    check: (cwd) => {
      const exists = fs.existsSync(path.join(cwd, '.planning'));
      return {
        passed: exists,
        message: exists ? '.planning/ directory exists' : '.planning/ directory not found',
      };
    },
  },
];
```

### getMilestoneInfo() Return Shape (from core.cjs:392)
```javascript
function getMilestoneInfo(cwd) {
  // Returns: { version: 'v2.6', name: 'Unified Validation Module' }
}
```

### extractFrontmatter() Usage for STATE.md
```javascript
const { extractFrontmatter } = require('./frontmatter.cjs');
const content = fs.readFileSync(statePath, 'utf-8');
const fm = extractFrontmatter(content);
// fm.milestone_name => 'Unified Validation Module'
// fm.progress.completed_phases => '1'
// fm.progress.total_phases => '1'
// fm.status => 'unknown'
```

### ROADMAP Phase Checkbox Counting
```javascript
const roadmap = fs.readFileSync(roadmapPath, 'utf-8');
const cleaned = roadmap.replace(/<details>[\s\S]*?<\/details>/gi, '');
const checked = (cleaned.match(/- \[x\]\s+\*?\*?Phase\s+\d+/gi) || []).length;
const unchecked = (cleaned.match(/- \[ \]\s+\*?\*?Phase\s+\d+/gi) || []).length;
const total = checked + unchecked;
```

## Open Questions

1. **STRUCT-01 sub-IDs vs separate requirement IDs**
   - What we know: CONTEXT.md says split into multiple entries, one per file
   - What's unclear: Should IDs be STRUCT-01a/b/c or STRUCT-01-planning/STRUCT-01-project etc.
   - Recommendation: Use STRUCT-01a through STRUCT-01f — simple, sortable, matches requirement grouping

2. **STATE check error codes**
   - What we know: Need new codes since E001-E006 and W001-W009 are taken
   - Recommendation: Use S001-S004 prefix for state checks, mapping STATE-01 to S001, etc.

## Sources

### Primary (HIGH confidence)
- cli.cjs `gatherHealthData()` lines 409-595 — source of structure check logic
- verify.cjs `cmdValidateHealth()` lines 535-797 — source of structure and state check logic
- core.cjs `getMilestoneInfo()` lines 392-414 — milestone name extraction
- frontmatter.cjs `extractFrontmatter()` lines 11-83 — YAML parsing
- validation.cjs (Phase 64 output) — registry pattern and existing STRUCT-01

### Secondary (MEDIUM confidence)
- None needed — all logic is internal codebase migration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external dependencies, all project internals
- Architecture: HIGH — follows Phase 64 established patterns exactly
- Pitfalls: HIGH — identified from direct code inspection of source and target

**Research date:** 2026-03-15
**Valid until:** No expiration — internal codebase patterns only
