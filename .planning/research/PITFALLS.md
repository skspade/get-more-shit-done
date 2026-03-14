# Domain Pitfalls: Adding --auto Mode to new-milestone Workflow

**Domain:** Adding autonomous (--auto) flag to an existing interactive milestone creation workflow
**Researched:** 2026-03-14
**Confidence:** HIGH (grounded in existing --auto implementations in discuss-phase, plan-phase, execute-phase; real bug history from CHANGELOG; design doc review; codebase analysis)

---

## Critical Pitfalls

### Pitfall 1: Config State Leaking Between Milestones

**What goes wrong:**
`workflow.auto_advance` persisted to config.json survives beyond the milestone boundary. If new-milestone sets `auto_advance = true` and the workflow fails partway through (e.g., research agent errors out, roadmapper returns BLOCKED), the config remains `true`. The next interactive `/gsd:new-milestone` invocation silently runs in auto mode, skipping all confirmation questions without the user realizing it.

**Why it happens:**
The hybrid flag + config pattern persists state to disk early (so it survives context compaction) but relies on `transition.md` to reset `auto_advance = false` at milestone completion. New-milestone runs BEFORE a milestone exists, so the transition reset never fires if milestone creation fails. There is a gap in the lifecycle: config is set before the milestone lifecycle that would clean it up.

**How to avoid:**
1. Do NOT persist `workflow.auto_advance` in new-milestone's argument parsing step. Instead, pass `--auto` as a flag through each downstream invocation (to discuss-phase). Let discuss-phase handle its own persistence as it already does.
2. If persisting IS needed (for context compaction survival), wrap the config-set in a try/finally pattern: on any error exit from new-milestone, reset `workflow.auto_advance` to false.
3. Test: invoke `new-milestone --auto` with a missing MILESTONE-CONTEXT.md (should error), then verify config.json does NOT have `auto_advance: true`.

**Warning signs:**
- Config.json shows `auto_advance: true` when no `--auto` flag was passed
- Interactive milestone creation skips questions unexpectedly
- User complaints about "it just did everything without asking"

**Phase to address:**
Phase 1 (Argument Parsing and Context Resolution) -- guard the config-set with error handling. Phase 4 (Autopilot Integration) -- integration test that config is clean after failure.

---

### Pitfall 2: Silent Failure When --auto Without Context

**What goes wrong:**
User invokes `/gsd:new-milestone --auto` without providing inline text, @file, or MILESTONE-CONTEXT.md. The workflow has no goals to work with. If error handling is weak, it either: (a) silently produces an empty/garbage milestone, or (b) crashes without a clear message, leaving state partially modified (PROJECT.md updated, STATE.md reset, but no requirements or roadmap).

**Why it happens:**
Interactive mode asks "What do you want to build next?" as a fallback. Auto mode has no fallback -- it must have context upfront. The design doc specifies an error message, but the error must fire BEFORE any state mutations (PROJECT.md updates, STATE.md resets, commit writes).

**How to avoid:**
1. Context resolution must be step 1, before ANY file modifications. The current design places it correctly (step 1 in the design doc), but the new-milestone.md workflow currently loads context in step 1 and modifies PROJECT.md in step 4. In auto mode, validate context availability BEFORE step 4.
2. The error message must be explicit: `"--auto requires milestone goals. Usage: /gsd:new-milestone --auto 'description' or provide MILESTONE-CONTEXT.md"`
3. Test: invoke `--auto` with no context source and verify zero file modifications occurred.

**Warning signs:**
- PROJECT.md has a "Current Milestone" section with no features listed
- STATE.md shows "Defining requirements" but REQUIREMENTS.md is empty
- Git log shows a commit for "start milestone" but no subsequent commits

**Phase to address:**
Phase 1 (Argument Parsing and Context Resolution) -- validate context before mutations. Must be the first guard in the auto-mode path.

---

### Pitfall 3: Brainstorm Routing Regression

**What goes wrong:**
When simplifying brainstorm.md step 10 from "execute steps 1-11 inline" to "invoke `/gsd:new-milestone --auto`", the brainstorm loses control of the flow. Currently brainstorm step 10c executes new-milestone steps inline, which means brainstorm controls error handling, can display results, and knows when it finishes. After the change, brainstorm delegates to a slash command and has no mechanism to get results back or handle errors.

**Why it happens:**
SlashCommand invocations in GSD are fire-and-forget within a context window. When brainstorm invokes `/gsd:new-milestone --auto`, the new-milestone workflow takes over the conversation. If new-milestone then auto-chains to `/gsd:discuss-phase 1 --auto`, the chain continues indefinitely. Brainstorm's step 10 never "returns" -- it just hands off. This is actually the INTENDED behavior, but the pitfall is in error cases: if new-milestone fails, the user sees a new-milestone error in a brainstorm session, which is confusing.

**How to avoid:**
1. Accept that brainstorm-to-milestone is a one-way handoff, not a delegation. Document this explicitly in the brainstorm workflow.
2. Ensure new-milestone --auto error messages reference their origin: "Milestone creation failed. Brainstorm design saved to .planning/designs/. Re-run with: /gsd:new-milestone --auto"
3. Verify MILESTONE-CONTEXT.md is written by brainstorm BEFORE invoking new-milestone (it already is -- step 10a), so context resolution will always succeed from the brainstorm path.
4. Test the brainstorm-to-new-milestone handoff end-to-end, not just new-milestone in isolation.

**Warning signs:**
- Brainstorm session ends abruptly with a new-milestone error
- MILESTONE-CONTEXT.md not found despite brainstorm having written it
- Design doc written but milestone never created (silent failure in handoff)

**Phase to address:**
Phase 4 (Autopilot Integration) -- this is where brainstorm.md simplification happens. Must test the brainstorm routing path.

---

### Pitfall 4: Auto-Chain Creates Unstoppable Cascade

**What goes wrong:**
`new-milestone --auto` creates the roadmap, then auto-chains to `/gsd:discuss-phase 1 --auto`, which auto-chains to plan-phase --auto, which auto-chains to execute-phase --auto, which auto-chains via transition.md to discuss-phase 2 --auto, and so on through ALL phases. The user invoked one command and now an entire milestone executes without any checkpoints until the verification gate (which is the only human checkpoint in auto mode).

**Why it happens:**
This is by design -- autopilot runs milestones end-to-end. But when invoked from new-milestone (not autopilot), the user may not expect this behavior. Autopilot has stall detection, circuit breakers, and debug-retry. A raw `/gsd:new-milestone --auto` invocation has none of these safety mechanisms.

**How to avoid:**
1. The auto-chain from new-milestone should ONLY go to discuss-phase 1 --auto, NOT deeper. The design doc already specifies this correctly: "auto-chain to `/gsd:discuss-phase 1 --auto`". However, discuss-phase --auto chains to plan-phase, which chains to execute-phase, which chains via transition. Each workflow independently reads `workflow.auto_advance` from config.
2. This cascading IS the intended behavior when auto_advance is in config. But document that `/gsd:new-milestone --auto` will run the ENTIRE milestone pipeline, not just create the milestone.
3. Consider: should new-milestone --auto ONLY create the milestone (research, requirements, roadmap) and NOT chain? The design doc says chain. If chaining is desired, document it clearly in the command help.

**Warning signs:**
- User invokes new-milestone --auto expecting just milestone creation, gets hours of autonomous execution
- Context window exhaustion when the entire chain runs in one session (each phase should get fresh context)
- No stall detection or circuit breaker when not running under autopilot

**Phase to address:**
Phase 3 (Auto-Chain to Discuss Phase) -- decide whether chaining is correct, document the behavior, ensure the chain works correctly across context windows.

---

### Pitfall 5: Research Phase Model Resolution Missed in Auto Mode

**What goes wrong:**
New-milestone step 7 calls `init new-milestone` to resolve models (`researcher_model`, `synthesizer_model`, `roadmapper_model`). Step 8 asks whether to research. In auto mode, step 8 is auto-answered "yes", but the init call in step 7 may not return a model for researchers if the init command doesn't know about auto mode. The auto-mode path needs all models resolved before spawning researchers.

**Why it happens:**
The init command (`gsd-tools.cjs init new-milestone`) returns model profiles based on current config. In interactive mode, init runs before the research question. In auto mode, init must also run before research. The ordering is the same, but the pitfall is: if the init command output is not parsed correctly (e.g., researcher_model is null because init doesn't know research will happen), the researcher spawn fails.

**How to avoid:**
1. Verify that `gsd-tools.cjs init new-milestone` always returns researcher_model, synthesizer_model, and roadmapper_model regardless of whether research is enabled. Check the init command's logic.
2. The design doc proposes adding `auto_mode` field to init output. This is the right place to also ensure all model fields are populated.
3. Test: invoke init new-milestone and verify all model fields are present.

**Warning signs:**
- Researcher agents fail to spawn with "model not specified" errors
- Init JSON output missing researcher_model field when research_enabled is false in config

**Phase to address:**
Phase 1 (Argument Parsing and Context Resolution) -- ensure init returns all models. Phase 2 (Auto-Skip at Decision Points) -- test research auto-skip with model resolution.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Persisting auto_advance in new-milestone instead of passing --auto through | Survives context compaction | Config leaks between milestones on failure | Only if paired with cleanup on error |
| Reusing discuss-phase's auto_context_check verbatim | Consistency | new-milestone's context resolution is different (MILESTONE-CONTEXT.md, not CONTEXT.md) | Never -- new-milestone needs its own context resolution |
| Skipping research in auto mode to speed things up | Faster milestone creation | Missing domain insights, weaker requirements | Never -- design doc correctly says "always research" |
| Not testing brainstorm-to-new-milestone handoff | Faster implementation | Brainstorm routing may silently break | Only in first pass; must be tested in Phase 4 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| brainstorm.md step 10 | Invoking `/gsd:new-milestone --auto` before MILESTONE-CONTEXT.md is written and committed | Ensure brainstorm writes AND commits MILESTONE-CONTEXT.md before the slash command invocation |
| pr-review.md milestone route | Same as brainstorm -- writes MILESTONE-CONTEXT.md then runs new-milestone inline | After --auto support, pr-review could also simplify to `/gsd:new-milestone --auto`, but only if MILESTONE-CONTEXT.md handling is identical |
| linear.md milestone route | Writes MILESTONE-CONTEXT.md with issue context | Same pattern -- could simplify, but verify MILESTONE-CONTEXT.md format compatibility across all three sources |
| autopilot.mjs | Currently doesn't create milestones | Design doc says "enables a future flow" -- do not add autopilot milestone creation in v2.5; that is scope creep |
| gsd-tools.cjs init | Must return auto_mode field | Add to init new-milestone JSON output; do not modify other init commands |
| config.json | auto_advance set to true by new-milestone, never cleared | transition.md clears at milestone boundary, but new-milestone errors leave it dirty |

## "Looks Done But Isn't" Checklist

- [ ] **--auto flag parsing:** Often missing the case where `--auto` appears with inline text after it -- verify `--auto 'build feature X'` correctly separates flag from context text
- [ ] **Config persistence:** Often missing error-path cleanup -- verify config.json after `new-milestone --auto` fails at each step (context resolution, research, requirements, roadmap)
- [ ] **MILESTONE-CONTEXT.md consumption:** new-milestone deletes MILESTONE-CONTEXT.md after consuming it (step 6). Verify this still happens in auto mode -- if auto mode skips step 6, the file lingers and confuses the next milestone
- [ ] **Version auto-accept:** Auto-accepting the version suggestion (minor bump) is correct, but verify the version parsing handles edge cases: v2.5 -> v2.6 (not v2.50 or v3.0)
- [ ] **Research config persistence:** Step 8 persists `workflow.research = true` to config. In auto mode this always happens. Verify this doesn't conflict with a user who previously set `workflow.research = false` for interactive use
- [ ] **Requirement scoping "select all":** Auto-selecting all features from context may include anti-features or "future" items that research flagged as "don't build yet"
- [ ] **Roadmap auto-approve:** Auto-approving the roadmap skips human review of phase ordering and requirement mapping. If the roadmapper produces a suboptimal roadmap, it proceeds without correction
- [ ] **Auto-chain target:** Verify the auto-chain invokes `/gsd:discuss-phase {FIRST_PHASE} --auto` with the correct phase number (the first phase of the NEW milestone, not phase 1)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Config auto_advance leaked | LOW | `gsd settings` to toggle auto_advance off, or manually edit .planning/config.json |
| Empty milestone created (no context) | MEDIUM | Delete the bad commits (`git reset --soft HEAD~N`), fix context, re-run |
| Brainstorm handoff failed | LOW | MILESTONE-CONTEXT.md and design doc are saved; just re-run `/gsd:new-milestone --auto` manually |
| Unstoppable cascade running | LOW | Ctrl+C to interrupt, `gsd settings` to set auto_advance false, resume manually |
| Wrong version auto-accepted | LOW | Edit PROJECT.md and REQUIREMENTS.md, update version references, re-commit |
| Research auto-selected wrong config | LOW | `gsd settings` to toggle research config back, re-run plan-phase with --skip-research or --research as needed |
| Roadmap auto-approved with bad structure | MEDIUM | Re-run `/gsd:new-milestone` interactively (without --auto) to review and adjust the roadmap |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Config state leaking | Phase 1: Argument Parsing | Test: fail at each step, verify config.json state |
| Silent failure without context | Phase 1: Argument Parsing | Test: `--auto` with no context produces error, zero mutations |
| Brainstorm routing regression | Phase 4: Autopilot Integration | Test: brainstorm milestone route produces working milestone |
| Unstoppable cascade | Phase 3: Auto-Chain | Document behavior; verify first phase number is correct |
| Research model resolution | Phase 1: Argument Parsing | Test: init new-milestone returns all model fields |
| MILESTONE-CONTEXT.md not consumed | Phase 2: Auto-Skip | Test: MILESTONE-CONTEXT.md deleted after successful auto run |
| Version edge cases | Phase 2: Auto-Skip | Test: version bump from various starting versions |
| Requirement over-scoping | Phase 2: Auto-Skip | Review: "select all" behavior with research-flagged anti-features |
| Roadmap auto-approve quality | Phase 2: Auto-Skip | Accept risk: roadmapper quality is generally good; manual re-run is cheap |

## Sources

- `get-shit-done/workflows/discuss-phase.md` lines 761-849: existing --auto and auto_advance pattern (HIGH confidence)
- `get-shit-done/workflows/plan-phase.md` lines 480-559: auto-advance check and execute-phase chaining (HIGH confidence)
- `get-shit-done/workflows/transition.md` line 456: auto_advance reset at milestone boundary (HIGH confidence)
- `get-shit-done/workflows/new-milestone.md`: current interactive workflow with 5 AskUserQuestion calls (HIGH confidence)
- `get-shit-done/workflows/brainstorm.md` lines 257-310: milestone routing that will be simplified (HIGH confidence)
- `CHANGELOG.md` line 132: real bug -- auto-mode surviving context compaction required config persistence (HIGH confidence)
- `.planning/designs/2026-03-14-new-milestone-auto-mode-design.md`: design doc for this milestone (HIGH confidence)

---
*Pitfalls research for: Adding --auto mode to /gsd:new-milestone workflow*
*Researched: 2026-03-14*
