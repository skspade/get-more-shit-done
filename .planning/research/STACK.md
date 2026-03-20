# Stack Research

**Domain:** GSD autopilot — test steward consolidation bridge (v2.8)
**Researched:** 2026-03-20
**Confidence:** HIGH

## Scope

This research covers ONLY what is new for v2.8 (test steward consolidation bridge). The existing validated
stack (Node.js CJS, zx/ESM, node:test suite, gsd-tools dispatcher, testing.cjs, cli.cjs, autopilot.mjs,
validation.cjs, frontmatter.cjs) is NOT re-evaluated.

## Verdict: No New Dependencies

This milestone is a pure markdown-workflow and YAML-frontmatter extension. Every parsing, writing, and
routing capability needed already exists. The answer to "what stack additions are needed?" is: none.

The new `gaps.test_consolidation` array is structurally identical to the existing `gaps.integration` array
(array of objects with string/number fields at two-level nesting). `extractFrontmatter()` in
`frontmatter.cjs` already handles this structure — no parser changes, no new npm packages.

## Recommended Stack (No Changes)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js CJS modules | >=16.7.0 (existing) | `frontmatter.cjs` parsing layer | `extractFrontmatter()` handles array-of-objects at 2-level nesting — verified against `gaps.integration` which is structurally identical to `gaps.test_consolidation`. No change. |
| Markdown workflow files | n/a | `audit-milestone.md`, `plan-milestone-gaps.md` | Claude reads these as context — no build step, no parser, just text extension. Adding `test_consolidation` handling is a text edit. |
| YAML frontmatter (custom parser) | n/a (in-repo, `frontmatter.cjs`) | State storage in MILESTONE-AUDIT.md | `extractFrontmatter()` + `reconstructFrontmatter()` + `spliceFrontmatter()` already provides read/write round-trip. Proven across 16 milestones. |

### Supporting Libraries

No new supporting libraries required.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `frontmatter.cjs` (in-repo) | n/a | YAML frontmatter read/write for MILESTONE-AUDIT.md | Only needed if programmatic frontmatter manipulation is required beyond workflow text reads. The workflows read files as Claude context — no programmatic call needed for v2.8. |
| `gsd-tools.cjs` (in-repo) | n/a | `frontmatter merge` dispatch command | Available if a programmatic consumer of `gaps.test_consolidation` is added in the future. Not needed for v2.8. |

## What Changes (File Modifications, Not New Tools)

Two workflow files get text extensions. No new files, no new modules.

### 1. `get-shit-done/workflows/audit-milestone.md`

**Change in Step 6:** Add `gaps.test_consolidation` to the YAML frontmatter template. Populate from
`steward_report` consolidation proposals already in scope from step 3.5. Add status logic: if
`gaps.requirements`, `gaps.integration`, and `gaps.flows` are all empty but `gaps.test_consolidation`
is non-empty, set `status: tech_debt` instead of `passed`.

**New frontmatter structure to emit:**
```yaml
gaps:
  requirements: [...]
  integration: [...]
  flows: [...]
  test_consolidation:       # NEW
    - strategy: "prune"
      source: "tests/foo.test.cjs"
      action: "Remove — references deleted module"
      reduction: 3
    - strategy: "parameterize"
      source: "tests/bar.test.cjs:L12-L45"
      action: "Combine 5 near-identical tests into test.each"
      reduction: 4
```

**Why no parser change is needed:** `extractFrontmatter()` already parses arrays of objects. The
`test_consolidation` items (`strategy`, `source`, `action`, `reduction`) are flat key/value pairs
at one level below the array — identical in structure to `integration` items (`id`, `severity`,
`description`). The parser's array-of-objects path at lines 60-82 of `frontmatter.cjs` covers this.

### 2. `get-shit-done/workflows/plan-milestone-gaps.md`

**Changes in Step 1:** Parse `gaps.test_consolidation` alongside the existing three gap arrays.

**Changes in Step 3:** Add grouping rule — all `test_consolidation` entries go into one "Test Suite
Consolidation" phase, always last in the gap closure sequence.

**Changes in Step 5:** Include the consolidation phase in the gap closure plan presentation.

**No changes to Steps 4, 6, 7, 8, 9, 10** — phase numbering, ROADMAP.md updates, directory creation,
commit, and next-step routing operate generically on whatever phases get created. Adding a new phase
type requires zero changes to the phase machinery.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Custom `extractFrontmatter()` (existing) | `js-yaml` npm package | Only if YAML structure becomes deeply recursive or uses anchors/tags. Current `test_consolidation` entries are flat objects — custom parser is sufficient. Adding `js-yaml` would be a new dependency with no functional gain. |
| Custom `extractFrontmatter()` (existing) | `gray-matter` npm package | Only if markdown file processing needs templating or custom delimiters. GSD uses raw `---` fences with no special YAML features. `gray-matter` adds weight without benefit. |
| Workflow text extension | New `test-consolidation.cjs` module | Only if `plan-milestone-gaps` needed programmatic invocation from `autopilot.mjs`. Currently the workflow is Claude-executed text — no programmatic call site exists, and the design doc confirms autopilot handles this via the existing audit-fix-reaudit loop with no changes. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `js-yaml` | Adds npm dependency for YAML parsing when `extractFrontmatter()` handles all structures in use. Supply-chain surface with zero functional gain. | `extractFrontmatter()` in `frontmatter.cjs` |
| `gray-matter` | Same rationale as js-yaml. Full markdown-with-frontmatter library is overkill for structured object reads. | `extractFrontmatter()` in `frontmatter.cjs` |
| New `gsd-tools` dispatch commands for `test_consolidation` | No programmatic consumer of `gaps.test_consolidation` exists or is planned for v2.8. Adding CLI dispatch before a caller exists is premature. | Direct file read in workflow context |
| Schema additions to `FRONTMATTER_SCHEMAS` in `frontmatter.cjs` | `FRONTMATTER_SCHEMAS` validates plan/summary/verification files — not audit files. Audit files are read by Claude as context, not validated programmatically. | No change to `FRONTMATTER_SCHEMAS` |
| Changes to `autopilot.mjs` | The design doc explicitly confirms the existing audit-fix-reaudit loop handles the `tech_debt` routing path without modification. `plan-milestone-gaps` is already invoked on `tech_debt` status. | No change to autopilot |

## Stack Patterns by Variant

**If `gaps.test_consolidation` is empty (steward ran, no proposals):**
- Write `test_consolidation: []` to frontmatter
- `plan-milestone-gaps` skips consolidation phase creation
- Empty array is valid YAML and parseable by `extractFrontmatter()` — no special handling

**If steward is disabled (`test.steward: false`):**
- `audit-milestone.md` already skips steward at step 3.5
- `gaps.test_consolidation` key is omitted from frontmatter entirely
- `plan-milestone-gaps` checks for key existence; if missing, treats as empty — no error

**If only test consolidation gaps exist (no requirement/integration/flow gaps):**
- This is the current dead-end scenario this milestone fixes
- `audit-milestone.md` sets `status: tech_debt` (not `passed`)
- `tech_debt` routing in `offer_next` already offers `/gsd:plan-milestone-gaps` as option B
- `plan-milestone-gaps` creates only the consolidation phase — phase machinery unchanged

**If consolidation proposals don't bring budget under threshold after execution:**
- Next audit produces new findings
- Existing audit-fix-reaudit loop handles this — no special case needed
- User can always `/gsd:complete-milestone` to accept remaining debt

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| `extractFrontmatter()` | All existing MILESTONE-AUDIT.md frontmatter + new `test_consolidation` structure | `test_consolidation` items are 2-level nesting (array of flat objects) — within supported depth. Isomorphic to existing `integration` array-of-objects. |
| `reconstructFrontmatter()` | 3-level nesting maximum | `test_consolidation` items are 1-level objects inside an array — well within limit. |
| Existing 807-test suite | No impact | v2.8 changes are workflow text files and audit frontmatter structure. No CJS module changes means no new tests required beyond any added to cover new workflow logic. |

## Sources

- `get-shit-done/bin/lib/frontmatter.cjs` — verified `extractFrontmatter()` handles array-of-objects at 2-level nesting (lines 60-82); `reconstructFrontmatter()` handles same (lines 86-148) — HIGH confidence (direct codebase inspection)
- `get-shit-done/workflows/audit-milestone.md` — verified existing `gaps` frontmatter structure and `test_health` section; `steward_report` already in scope at step 6; `tech_debt` routing already exists in `offer_next` — HIGH confidence (direct codebase inspection)
- `get-shit-done/workflows/plan-milestone-gaps.md` — verified steps 1-10 structure; steps 4-10 are generic over gap types; adding `test_consolidation` extends only steps 1, 3, and 5 — HIGH confidence (direct codebase inspection)
- `.planning/milestones/v2.7-MILESTONE-AUDIT.md` — live example of audit frontmatter with `test_health.consolidation_proposals: 2`; confirmed `gaps.integration` structure is isomorphic to proposed `gaps.test_consolidation` — HIGH confidence (production artifact)
- `.planning/designs/2026-03-20-test-steward-consolidation-bridge-design.md` — design doc specifying exact frontmatter schema, workflow extension points, and autopilot no-change confirmation — HIGH confidence (first-party design artifact)
- `package.json` — confirmed no YAML parsing dependency exists; only non-dev dep is `zx ^8.0.0` — HIGH confidence (direct codebase inspection)

---
*Stack research for: GSD test steward consolidation bridge (v2.8)*
*Researched: 2026-03-20*
