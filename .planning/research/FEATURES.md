# Feature Research

**Domain:** Test steward consolidation bridge — extending GSD autonomous gap closure to cover test suite cleanup
**Researched:** 2026-03-20
**Confidence:** HIGH (primary sources are existing GSD codebase, agent specs, workflow files — all directly readable)

## Context: What Already Exists

This milestone adds to an already-complete system. The following are NOT being built:

- Test steward agent (`gsd-test-steward.md`) — reads test files, produces health report with consolidation proposals (4 strategies: prune, parameterize, promote, merge)
- `audit-milestone` workflow step 3.5 — spawns steward, stores `steward_report`
- MILESTONE-AUDIT.md frontmatter `test_health` block — captures `budget_status`, `redundant_tests`, `stale_tests`, `consolidation_proposals` count
- `plan-milestone-gaps` workflow — parses `gaps.requirements`, `gaps.integration`, `gaps.flows` from audit frontmatter, creates fix phases

The **gap**: steward proposals are recorded in the audit report body but not in `gaps.*` frontmatter, so `plan-milestone-gaps` currently ignores them entirely. Users who want to act on proposals must do so manually.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the consolidation bridge must deliver for the workflow to feel complete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `gaps.test_consolidation` frontmatter field in MILESTONE-AUDIT.md | The three existing gap types (requirements, integration, flows) all live in structured frontmatter so `plan-milestone-gaps` can parse them. Test consolidation proposals need the same treatment — otherwise they're invisible to the automated gap closure loop. | LOW | New YAML block parallel to `gaps.requirements`. Each entry maps one steward proposal: strategy, source files, action, estimated reduction. `audit-milestone` step 6 must populate this when steward proposals exist. |
| `plan-milestone-gaps` parses `gaps.test_consolidation` | If the field exists in frontmatter, the gap planner must read it. Missing this means proposals are structured but still silently skipped — the bridge is unfinished. | MEDIUM | Parse proposal list from frontmatter. Each proposal becomes one task in a consolidation cleanup phase. Depends on `gaps.test_consolidation` being present in frontmatter. |
| Proposal-to-task mapping for all four strategies | Steward produces four strategy types: prune, parameterize, promote, merge. Each maps to a different concrete task action. The planner must know what a "prune" task says vs a "parameterize" task says. Undifferentiated tasks ("do consolidation") are not actionable. | MEDIUM | Prune → "Remove stale test file/function and verify suite passes." Parameterize → "Replace N individual tests with one test.each block, reduce count by N-1." Promote → "Delete unit tests subsumed by integration test." Merge → "Move tests from files A, B into C organized by feature." Each task includes source file paths from the proposal. |
| Skip gracefully when steward is disabled or no proposals exist | The steward is opt-in (`test.steward` config). When disabled, there are no proposals. `plan-milestone-gaps` must not error or produce empty phases when `gaps.test_consolidation` is absent or empty. | LOW | If field is absent or empty array, continue gap closure as today. No phases created, no error surfaced. |
| Consolidation phases only created when budget is at or over warning threshold | Test consolidation is a nice-to-have unless there's actual budget pressure. If budget is OK (< 80%), proposals are informational — creating mandatory cleanup phases adds friction without value. | LOW | Gate phase creation on `test_health.budget_status` from frontmatter. `Warning` or `Over Budget` → create phases. `OK` → include proposals in tech debt section, do not create phases. Surfaced to user in the gap plan presentation. |
| Consolidation phase created as a single phase grouping all proposals | Industry standard: cleanup work is batched rather than scattered across N micro-phases. One "Test Suite Cleanup" phase with N tasks (one per proposal) is easier to track and review than N separate phases. | LOW | Same grouping logic that already applies to related requirement gaps. All consolidation proposals belong to one phase. Phase name: "Test Suite Cleanup" or "Consolidate Test Suite." |

### Differentiators (Competitive Advantage)

What makes this better than "just tell the user to run the steward manually."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Autopilot-transparent bridge | Today, autopilot drives audit → plan-milestone-gaps → execute → re-audit automatically. Without this bridge, autopilot silently skips test debt even when the project is over budget. With it, consolidation proposals enter the same autonomous loop — no human has to remember to run `audit-tests` after a milestone. | LOW | The bridging mechanism (frontmatter field + parser extension) is the entire value. No new agent or tool required — the data already exists in the steward report. |
| Estimated reduction in task descriptions | Each consolidation task includes the steward's `estimated_reduction` (number of tests removed). Developers can see "this removes 7 tests, bringing budget from 101% to 99.1%" before executing. Makes the tradeoff visible. | LOW | Pull `estimated_reduction` from proposal into task description. Requires no additional analysis — steward already computes this. |
| Only-test-gaps path | When an audit produces no requirement/integration/flow gaps but does have consolidation proposals above threshold, the current flow routes to `plan-milestone-gaps` for gap closure. The new fourth gap type ensures this case doesn't silently pass. Budget overage becomes a recognized gap type that gets planned. | LOW | Logic: if `gaps.requirements`, `gaps.integration`, `gaps.flows` all empty but `gaps.test_consolidation` is non-empty AND budget is Warning/Over — status remains `gaps_found` rather than `passed` or `tech_debt`. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-apply consolidation without human approval | Full autonomy — why pause for test cleanup if autopilot handles everything else? | Consolidation modifies or deletes test files. A wrong prune removes real coverage silently. Parameterization can change test semantics if done incorrectly. The existing decision in PROJECT.md is explicit: `steward.auto_consolidate` remains false. Human must approve. | Create the task and the cleanup phase. Let the autopilot execute phase handle it — the execute phase pauses at verification, giving a natural review point. |
| Per-proposal phases | Fine-grained phases give maximum flexibility in approving some consolidations and deferring others. | N=5 proposals → 5 phases → 5 plan cycles → 5 executions. Massive overhead for cleanup work that is inherently related. Wastes phase budget and makes the roadmap noisy. | One cleanup phase, one task per proposal. Within the execute phase, tasks can be individually skipped or deferred by the developer. |
| Consolidation proposals blocking `passed` status when budget is OK | Makes the bridge comprehensive — all proposals get actioned regardless. | Budget-OK means the test suite is healthy. Forcing consolidation phases when there's no pressure creates busy-work. Developers will route around the workflow if cleanup is mandatory when nothing is wrong. | Gate on budget threshold. OK status → proposals appear in tech debt section only. Warning/Over Budget → proposals generate a cleanup phase. |
| Re-spawning the steward during gap closure execution | Confirms that consolidation tasks actually reduced the count as expected. | The steward is an analysis agent spawned by `audit-milestone`. Gap closure phases run inside `execute-phase`. Spawning analysis agents during execution violates the single-responsibility design — execute phases execute, audit phases audit. | The re-audit loop (autopilot's audit-fix-reaudit) already handles verification: after gap closure phases complete, `audit-milestone` runs again, which spawns the steward again, which produces an updated count. |
| Tracking per-proposal approval state in frontmatter | Allows partial acceptance (approve some proposals, defer others). | Adds a new state machine to MILESTONE-AUDIT.md that no existing consumer reads. Over-engineering for a cleanup workflow where the task description is the unit of approval. | One task per proposal in the cleanup phase. Developer can skip individual tasks during execute phase. Unapproved proposals appear in the next audit's tech debt. |

## Feature Dependencies

```
gaps.test_consolidation frontmatter field (audit-milestone step 6)
    └──required by──> plan-milestone-gaps parser extension
                          └──required by──> Consolidation phase creation
                                                └──required by──> Task-per-proposal generation

test_health.budget_status (already in frontmatter — existing)
    └──gates──> Phase creation decision (Warning/Over → create, OK → tech debt only)

steward consolidation proposals (existing — in steward report body)
    └──structured into──> gaps.test_consolidation (new frontmatter field)
    └──currently only in──> MILESTONE-AUDIT.md report body (not parseable by plan-milestone-gaps)

gaps.test_consolidation (new)
    └──parallel to──> gaps.requirements (existing)
    └──parallel to──> gaps.integration (existing)
    └──parallel to──> gaps.flows (existing)

Proposal-to-task mapping (new — per strategy)
    └──used by──> plan-milestone-gaps when creating tasks
    └──strategies: prune | parameterize | promote | merge
```

### Dependency Notes

- **`gaps.test_consolidation` must be written by `audit-milestone` step 6:** The field cannot be parsed by `plan-milestone-gaps` if `audit-milestone` does not populate it. Both files need coordinated changes.
- **Steward must have run for proposals to exist:** `gaps.test_consolidation` is only populated when the steward ran and produced proposals. When steward is disabled or produced no proposals, the field is empty or absent — `plan-milestone-gaps` handles this as a no-op.
- **Budget status is the gate, not the proposal count:** Even if 10 proposals exist, if budget is OK (< 80%), no cleanup phase is created. This prevents autopilot from forcing cleanup on healthy suites.
- **Does not conflict with existing gap types:** Test consolidation phases are additive. Existing requirement/integration/flow gap phases are created first, then the consolidation phase is appended at the end. No ordering dependency between them.

## MVP Definition

### Launch With (v2.8)

Minimum to make the bridge functional end-to-end.

- [ ] `gaps.test_consolidation` YAML field added to MILESTONE-AUDIT.md frontmatter schema — carries structured proposal data from steward report
- [ ] `audit-milestone` step 6 updated to populate `gaps.test_consolidation` when steward proposals exist
- [ ] `plan-milestone-gaps` step 1 extended to parse `gaps.test_consolidation` alongside existing gap types
- [ ] Proposal-to-task mapping defined for all four strategies (prune, parameterize, promote, merge) — produces concrete, actionable task descriptions
- [ ] Budget threshold gate: only create consolidation phase when `test_health.budget_status` is Warning or Over Budget
- [ ] Single cleanup phase grouping all proposals (not N phases)
- [ ] Graceful skip when steward is disabled, no proposals exist, or `gaps.test_consolidation` absent
- [ ] `only-test-gaps` path: audit result remains `gaps_found` (not `passed`) when consolidation proposals exist above threshold but no other gaps

### Add After Validation (post-v2.8)

- [ ] `gsd health` reporting on pending consolidation proposals — surfaces test debt in health check output. Trigger: users ask "why isn't gsd health showing my test debt?"
- [ ] Per-proposal estimated budget projection in gap plan presentation — "Implementing all proposals would reduce budget from 101% to 97%." Trigger: useful feedback once the bridge is running.

### Future Consideration (v2.9+)

- [ ] Partial proposal acceptance via frontmatter flags — approve individual proposals, defer others. Deferred because task-skip in execute phase is sufficient for v2.8.
- [ ] `steward.auto_consolidate` mode (explicit opt-in) — applies prune/parameterize automatically without creating a phase. Deferred: requires confidence in correctness that current heuristic analysis doesn't provide.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `gaps.test_consolidation` frontmatter field | HIGH | LOW | P1 |
| `audit-milestone` populates new field | HIGH | LOW | P1 |
| `plan-milestone-gaps` parses new field | HIGH | MEDIUM | P1 |
| Proposal-to-task mapping (all 4 strategies) | HIGH | MEDIUM | P1 |
| Budget threshold gate | HIGH | LOW | P1 |
| Single cleanup phase grouping | MEDIUM | LOW | P1 |
| Graceful skip / no-proposals path | HIGH | LOW | P1 |
| Only-test-gaps audit status path | MEDIUM | LOW | P1 |
| Per-proposal estimated budget projection | LOW | LOW | P2 |
| `gsd health` consolidation reporting | LOW | MEDIUM | P2 |
| Partial proposal acceptance state | LOW | HIGH | P3 |
| `steward.auto_consolidate` opt-in mode | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v2.8)
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

The domain here is "autonomous development tooling that acts on AI test analysis." No direct competitors exist. The relevant comparison is manual workflow vs the bridge.

| Feature | Manual workflow (today) | With consolidation bridge (v2.8) |
|---------|------------------------|----------------------------------|
| Discovering proposals | Run `/gsd:audit-tests` separately after milestone | Proposals surface automatically during `audit-milestone` |
| Acting on proposals | Developer reads steward report, manually applies changes | `plan-milestone-gaps` creates a cleanup phase with one task per proposal |
| Autopilot visibility | Autopilot ignores test debt; budget can creep over 100% silently | Budget overage triggers consolidation phase in the audit-fix loop |
| Task clarity | Developer interprets "parameterize these tests" from steward prose | Task description includes source files, specific action, and estimated count reduction |
| Budget verification | Developer must recount tests manually after cleanup | Re-audit loop (existing) spawns steward again, updates budget_status |

## Sources

- `/Users/seanspade/.claude/agents/gsd-test-steward.md` — proposal format, four strategy types, consolidation triggers (budget thresholds)
- `/Users/seanspade/.claude/get-shit-done/workflows/audit-milestone.md` — step 3.5 steward invocation, step 6 frontmatter schema, `test_health` block
- `/Users/seanspade/.claude/get-shit-done/workflows/plan-milestone-gaps.md` — existing gap parsing (requirements/integration/flows), phase creation patterns, gap-to-task mapping
- `/Users/seanspade/Documents/Source/get-more-shit-done/.planning/v2.3-MILESTONE-AUDIT.md` — real example of frontmatter with `test_health` block
- `/Users/seanspade/Documents/Source/get-more-shit-done/.planning/PROJECT.md` — v2.8 target features, constraint: `steward.auto_consolidate remains false`, existing decision record
- [Test Automation Maintenance Guide 2026](https://bugbug.io/blog/software-testing/test-automation-maintenance/) — periodic review/prune cycle is industry standard; scheduled cleanup integrated into sprint cycles
- [Test Maintenance Best Practices 2026](https://bugbug.io/blog/software-testing/best-practices-of-test-maintenance/) — parameterize, prune, and refactor as the canonical maintenance strategies
- [CI/CD Quality Gates](https://testrigor.com/blog/software-quality-gates/) — quality gates as checkpoints that gate progression; budget thresholds as the natural gate for test consolidation

---
*Feature research for: Test Steward Consolidation Bridge (GSD v2.8)*
*Researched: 2026-03-20*
