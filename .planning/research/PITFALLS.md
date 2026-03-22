# Domain Pitfalls

**Domain:** Refactoring Linear ticket flow from numeric scoring heuristic to interview-driven routing (`/gsd:linear` v3.0)
**Researched:** 2026-03-22
**Confidence:** HIGH (direct codebase analysis of design doc, existing workflow, command spec, and all integration points)

## Critical Pitfalls

Mistakes that cause rewrites, broken workflows, or silent behavioral regressions.

### Pitfall 1: Scoring Heuristic Removal Breaks Override Flag Semantics

**What goes wrong:**
The design says "Removed: The entire `$MILESTONE_SCORE` calculation." But the existing workflow uses `$FORCE_QUICK` and `$FORCE_MILESTONE` flags that bypass the scoring entirely (Step 3 of current workflow). The design says override flags should "skip complexity question but still run other interview questions." If the refactor deletes the scoring step and rebuilds routing from scratch, the flag-skip logic must be reimplemented in the interview step. A common mistake is removing the old routing branch, building the new interview-based routing, and forgetting to wire the flags back in correctly -- resulting in flags that either skip the entire interview (losing context enrichment) or that still ask the complexity question despite the flag (confusing UX).

**Why it happens:**
The old code has a clean three-way branch: `FORCE_QUICK` -> quick, `FORCE_MILESTONE` -> milestone, else -> score. The new code needs flags to selectively skip question #4 but still run questions #1-3 and #5. This is a partial-skip pattern that is harder to implement than full-skip. Developers tend to either preserve the old full-skip pattern (losing interview context when flags are used) or forget the flags entirely in the new interview flow.

**Consequences:**
- `--quick` skips entire interview: quick tasks get no enriched context, descriptions fall back to raw truncation, Linear comment-back has nothing useful to post
- `--milestone` skips entire interview: milestone MILESTONE-CONTEXT.md has no interview data, approach proposals have no user input to anchor on
- Flags do nothing: user passes `--quick` but still gets asked "Quick fix or multi-phase?" -- defeats the purpose of the flag

**Prevention:**
Implement interview questions as an array/list with a `skip_if` condition per question. The complexity signal question (#4) has `skip_if: $FORCE_QUICK || $FORCE_MILESTONE`. Other questions have `skip_if` based on ticket content analysis. The routing step reads `$FORCE_QUICK`/`$FORCE_MILESTONE` first, falls back to interview answer for question #4, falls back to ticket inference. This three-tier fallback (flag -> interview -> inference) should be explicit in the workflow step, not implicit.

**Detection:**
- Test with `--quick` flag: verify all 4 non-complexity questions are still asked (or skipped due to ticket content), and route is "quick"
- Test with `--milestone` flag: same check, route is "milestone"
- Test with no flags: verify question #4 is asked and answer drives routing

**Phase to address:**
Phase 1 (workflow restructuring) -- flag semantics must be defined in the new step structure before any interview logic is written.

---

### Pitfall 2: Interview Question Skipping Creates Silent Context Gaps

**What goes wrong:**
The design says "After each answer: Incorporate into understanding, skip remaining questions that are now answered." This adaptive skipping is powerful but dangerous. If the pre-scan concludes that "Goal/purpose" is "clear from title + description" but the title is ambiguous (e.g., "Fix auth flow"), question #1 gets skipped and `$INTERVIEW_CONTEXT` has a synthesized goal that may be wrong. The user never sees it, never corrects it. The wrong goal propagates to: the confirmation summary (quick route), the approach proposals (milestone route), the Linear comment-back, and the task description or MILESTONE-CONTEXT.md. All downstream artifacts are anchored to a misinterpreted goal.

**Why it happens:**
The pre-scan is Claude reading the ticket and making a judgment call about whether information is "clear." LLMs are overconfident about ambiguous text. A title like "Update dashboard" could mean updating data, updating UI, updating both, or updating the deployment dashboard. Claude reads this as "clearly about the dashboard" and skips the goal question. The user assumed they'd be asked and never notices the skip.

**Consequences:**
- Quick task: planner builds a plan for the wrong scope, executor implements wrong thing
- Milestone: approach proposals address wrong problem, user picks an approach that doesn't match their intent
- Linear comment: posted to ticket says "Goal: update the dashboard UI" when user meant "update the dashboard data pipeline"
- Silent failure: no error, no warning, everything proceeds smoothly with wrong assumptions

**Prevention:**
Make question skipping conservative. The pre-scan should only skip a question when the ticket has explicit, unambiguous information for that dimension. Heuristic: skip if the ticket's description contains a dedicated section (e.g., "## Goal", "## Acceptance Criteria", "## Scope") or if a specific label provides the answer (e.g., label "bug" + clear repro steps = skip goal question). Do NOT skip based on Claude's confidence that the title is self-explanatory.

Additionally: after all questions are answered (or skipped), present the synthesized understanding to the user for confirmation. The quick route already does this ("Does this look right?"), but the confirmation must also cover skipped questions by showing what was inferred. If the user says "No, let me clarify," re-ask the skipped questions.

**Detection:**
- Run with a deliberately ambiguous ticket (title only, no description): verify all 5 questions are asked
- Run with a detailed ticket (description, acceptance criteria, labels): verify 2-3 questions are skipped and the confirmation summary shows correct inferred answers

**Phase to address:**
Phase 2 (interview implementation) -- skipping logic must be conservative from the start. Loosening skip criteria later is easy; tightening them after users have experienced wrong inferences is a trust problem.

---

### Pitfall 3: Step Renumbering Breaks Success Criteria References

**What goes wrong:**
The current workflow has 7 steps (1-7) with success criteria referencing `WKFL-01` through `WKFL-08`. The design renumbers to 9 steps (1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9). If success criteria tags are updated to match new step numbers but the actual step content shifts, the criteria-to-step mapping becomes wrong. Worse: the command spec (`commands/gsd/linear.md`) says "Preserve all workflow gates (issue fetch, complexity scoring, routing, execution, Linear status updates)" -- the phrase "complexity scoring" must also be updated or it instructs Claude to preserve the old scoring logic.

**Why it happens:**
Success criteria tags (WKFL-01, WKFL-03, etc.) are referenced in the command spec, the workflow file, and potentially in test assertions. A refactor that changes step numbering but doesn't update ALL reference points leaves dangling references. The design document maps old-to-new steps, but the actual implementation must trace every WKFL-XX reference across the codebase.

**Consequences:**
- Command spec still says "complexity scoring" -> Claude running the workflow tries to implement a scoring heuristic alongside the interview, producing a hybrid mess
- Success criteria reference old step numbers -> verification against criteria becomes meaningless
- Autopilot phase loop references workflow step numbers -> could break if step detection is positional

**Prevention:**
Before changing any step numbers:
1. Grep the entire codebase for `WKFL-0` to find all success criteria references
2. Grep for "complexity scoring" and "scoring heuristic" to find all textual references to the old routing
3. Create a mapping table (old WKFL tag -> new WKFL tag -> new content) and update all references atomically in a single phase
4. Update the command spec's objective and process descriptions to say "interview-driven routing" instead of "complexity scoring"

**Detection:**
- Grep for `WKFL-03` (old scoring step) after refactor -- should return zero matches
- Grep for "scoring" or "heuristic" in the workflow and command spec -- should return zero matches (or only in comments explaining the change)
- Read command spec after refactor: should mention interview, not scoring

**Phase to address:**
Phase 1 (workflow restructuring) -- renumbering and reference updates must happen first, as a clean structural change, before any behavioral changes are made.

---

### Pitfall 4: Pre-Execution Comment-Back Fails and Blocks Execution

**What goes wrong:**
The design adds a new "Step 5.5" that posts interview summary to Linear before execution starts. The design says "On MCP failure: Warning only -- do not block execution." But the implementation detail matters: if the MCP call is synchronous (as all MCP calls are in the workflow), a timeout or network error could take 30+ seconds before failing. If the error handling is a try/catch around the MCP call, the workflow recovers. But if the MCP call throws in a way that the workflow markdown doesn't explicitly handle (e.g., MCP server disconnected, tool not available), the entire workflow aborts.

**Why it happens:**
The existing completion comment-back (current Step 6) has the same "warning only" pattern and the same vulnerability. But it fires AFTER execution, so a failure there loses only the comment -- the work is done. The new pre-execution comment-back fires BEFORE execution, so a failure that isn't properly caught means no work gets done at all. The stakes are asymmetric despite identical code patterns.

**Consequences:**
- MCP timeout: user waits 30+ seconds, then workflow aborts. No execution happens. User must re-run.
- MCP server not available: workflow fails at step 5.5 every time. Users learn to avoid the workflow or disconnect from Linear.
- Partial failure: comment posts but workflow crashes on the response parsing, leaving a "Execution starting..." comment on a ticket where execution never started.

**Prevention:**
The workflow must explicitly state that the pre-execution comment-back is wrapped in error handling that catches ANY failure (not just MCP-returned errors, but also tool-not-available and timeout errors). The display pattern should be:
1. Attempt MCP call
2. On success: display checkmark
3. On ANY failure: display warning, store `$COMMENT_BACK_FAILED = true`, continue to execution
4. Never let a comment-back failure propagate up

Additionally: consider a shorter MCP timeout for the pre-execution comment (5s vs default) since this is a non-critical enhancement step. If MCP is slow, skip and move on.

**Detection:**
- Disconnect Linear MCP server, run workflow: verify execution proceeds with warning message
- Simulate MCP timeout (if testable): verify workflow doesn't hang
- Check that "Execution starting..." is not posted without execution actually starting (i.e., the comment and execution are not separated by other failure points)

**Phase to address:**
Phase 3 (comment-back implementation) -- error handling must be tested against actual MCP failure modes, not just happy path.

---

### Pitfall 5: Hybrid Output Creates Two Divergent Code Paths That Drift

**What goes wrong:**
The design introduces a fork after routing: quick route gets a "confirmation summary" (simple yes/no), milestone route gets "approach proposals" (brainstorm-style with 2-3 approaches). These are fundamentally different UX flows that share the same step number (Step 5). Over time, bug fixes or enhancements to one path don't get applied to the other. The quick confirmation grows richer (adding scope details, adding a "change route" option), while the milestone approach proposals stay static. Or vice versa: milestone proposals get polished while quick confirmation remains basic.

**Why it happens:**
The single workflow file contains both paths as branches within one step. Unlike the quick/milestone execution split (which delegates to separate workflow patterns), the hybrid output is inline. Developers fixing a bug in the quick confirmation don't realize the milestone path has the same bug. The paths look similar enough that you think changes to one apply to both, but they don't -- they have different structures, different AskUserQuestion options, and different re-prompt behaviors.

**Consequences:**
- Quick path allows "No, let me clarify" re-prompt but milestone path doesn't (or vice versa)
- Quick confirmation shows synthesized goal but milestone proposals don't show it (or show it differently)
- Interview context is formatted differently for quick vs milestone, making the Linear comment-back inconsistent

**Prevention:**
Extract shared interview context formatting into a single template before the fork. Both paths should render the same `$INTERVIEW_CONTEXT` block, then diverge only in what they add:
- Quick: add "Does this look right?" prompt
- Milestone: add approach proposals and selection prompt

The shared context template ensures goal, scope, success criteria, and route are always presented identically regardless of path. Only the decision mechanism (confirm vs select) differs.

**Detection:**
- Compare the interview summary section in both quick and milestone Linear comments -- they should be identical in structure
- After any change to either path, check the other path for the same issue
- Track divergence by diffing the two branches in the workflow file periodically

**Phase to address:**
Phase 2 (hybrid output implementation) -- extract the shared template at implementation time, not as a later refactor.

---

## Moderate Pitfalls

### Pitfall 6: Interview Context Variable Not Consumed by Downstream Steps

**What goes wrong:**
The design stores interview Q&A as `$INTERVIEW_CONTEXT`. The linear-context.md file gets a new `interview_summary` field. The quick route description synthesis (Step 7/5a) replaces raw truncation with "interview-enriched context." But if any of these consumption points reference the variable by a different name, or if the variable is stored in a format that doesn't parse cleanly into the downstream template, the enriched context is silently lost and the old truncation behavior returns as a fallback.

**Prevention:**
Define `$INTERVIEW_CONTEXT` structure explicitly: a markdown block with labeled sections (Goal, Scope, Success Criteria, Complexity, Additional). Each consumption point references specific sections, not the entire blob. Test by checking that linear-context.md contains the interview_summary field after a run, and that the quick task description contains goal/scope from the interview (not from raw ticket truncation).

**Phase to address:** Phase 2 (interview implementation) -- define the variable structure before building consumers.

---

### Pitfall 7: Inferred Route Confirmation UX Is Confusing

**What goes wrong:**
The design says: "If complexity question was skipped (because the ticket explicitly stated scope): Claude infers the route from the ticket content -- single-file bug fix -> quick, multi-component feature -> milestone. Display the inferred route and ask for confirmation." But the confirmation is another AskUserQuestion, meaning the user gets asked about routing even when the ticket was clear enough to skip the question. This feels contradictory: "The ticket is clear enough to skip the question, but unclear enough that I need you to confirm my inference."

**Prevention:**
Only trigger confirmation if the inference has low confidence. If the ticket has a "bug" label and references a single file, route to quick without confirmation. If the ticket is ambiguous (no clear labels, mixed signals), show the inference with a confirmation prompt. Add a confidence threshold to the inference: high confidence -> auto-route, low confidence -> confirm.

**Phase to address:** Phase 2 (routing decision) -- define confidence threshold for auto-routing vs confirmation.

---

### Pitfall 8: Milestone Route Approach Proposals Duplicate Brainstorm Workflow

**What goes wrong:**
The design says milestone route shows "approach proposals (brainstorm-style)" with 2-3 approaches, pros/cons, and a recommendation. The brainstorm workflow (`brainstorm.md`) does exactly this in its Step 4, but with full project context exploration (Step 2), clarifying questions (Step 3), and section-by-section design approval (Steps 5-8). The linear workflow's approach proposals are a lightweight version that skips all that context. If the user selects an approach and it feeds into MILESTONE-CONTEXT.md, the subsequent `/gsd:new-milestone --auto` creates a milestone without the depth that brainstorm provides.

The risk: users who should use `/gsd:brainstorm` for complex features end up in the linear workflow's shallow approach proposals because the interview routed them to "milestone." The resulting milestone has weak context and the discuss-phase generates a thin CONTEXT.md.

**Prevention:**
For milestone route, include an explicit option in the approach proposals: "This seems complex enough for a full brainstorm session. Would you like to: 1) Pick an approach and create a milestone, 2) Start a brainstorm session for deeper exploration." This gives the user an escape hatch to the richer flow when the linear workflow's lightweight proposals aren't sufficient.

**Phase to address:** Phase 3 (hybrid output / milestone path) -- add brainstorm escape hatch during approach proposal step.

---

### Pitfall 9: Two Comment-Backs Per Ticket Create Noise

**What goes wrong:**
The design adds a pre-execution comment (interview summary) alongside the existing post-execution comment (completion summary). For quick tasks that take 2-5 minutes, the ticket gets two GSD comments in rapid succession. For milestone tasks, the first comment says "Milestone creation starting..." and the second says "Milestone initialized" -- two comments for what is effectively one action from the user's perspective. Linear's notification system fires twice. Teammates watching the ticket see two bot comments and may be confused about status.

**Prevention:**
For quick tasks: consider combining both comments into a single post-execution comment that includes the interview summary at the top and the completion summary below. This is a judgment call -- the design wants the pre-execution comment for visibility into what GSD understood before it acts. If the pre-execution comment is kept, ensure the post-execution comment does not repeat the same information. Reference the earlier comment: "See interview summary above. Execution complete."

**Phase to address:** Phase 3 (comment-back implementation) -- decide on one-comment vs two-comment strategy before implementing.

---

## Minor Pitfalls

### Pitfall 10: `$FULL_MODE` Semantics Change with Interview

**What goes wrong:**
Currently, `$FULL_MODE` is set by the `--full` flag. The design adds a new meaning: "Medium (1-2 sessions)" in the complexity signal also sets `$FULL_MODE = true`. This means `$FULL_MODE` can now be set without the user explicitly passing `--full`. If any downstream logic checks `$FULL_MODE` alongside `$FORCE_QUICK` (assuming `$FULL_MODE` always implies user intent for verification), it may behave unexpectedly when `$FULL_MODE` was set implicitly by an interview answer.

**Prevention:**
Distinguish between explicit `$FULL_MODE` (from flag) and implicit `$FULL_MODE` (from interview). Or simpler: document that `$FULL_MODE` means "run with plan-checking and verification" regardless of source, and ensure all consumers treat it identically. Don't add conditional logic based on how `$FULL_MODE` was set.

**Phase to address:** Phase 1 (workflow restructuring) -- clarify `$FULL_MODE` semantics in the step definitions.

---

### Pitfall 11: AskUserQuestion Overhead for Quick Tickets

**What goes wrong:**
A user runs `/gsd:linear BUG-123 --quick` for a clear bug fix. The old workflow skipped scoring and went straight to execution. The new workflow still asks 3-4 interview questions (goal, scope, success criteria, additional context). For a 5-minute bug fix, spending 2 minutes answering questions about scope and success criteria feels excessive. Users start passing `--quick` to avoid the interview, which means the interview is only used for ambiguous tickets where the user doesn't know the route -- the opposite of "always-on."

**Prevention:**
The pre-scan should be aggressive about skipping questions for clear tickets. A bug with a stack trace, a specific file mentioned, and a "bug" label should skip goal, scope, and success criteria questions -- leaving only the complexity signal (which `--quick` already skips). Net result: `--quick` on a clear bug = zero questions. `--quick` on an ambiguous ticket = 1-2 questions. This preserves the "always-on" design without creating overhead for trivial tickets.

**Phase to address:** Phase 2 (interview implementation) -- pre-scan aggressiveness must be calibrated for the quick-ticket use case.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Workflow restructuring (step renumbering) | Success criteria and command spec reference old step numbers and "scoring heuristic" language | Grep all WKFL-XX references and "scoring"/"heuristic" text; update atomically before behavioral changes |
| Interview implementation (adaptive questions) | Overeager question skipping on ambiguous tickets | Conservative skip criteria; only skip on explicit ticket sections, not LLM confidence |
| Interview implementation (context variable) | `$INTERVIEW_CONTEXT` not consumed correctly by downstream steps | Define variable structure explicitly; verify consumption at each downstream point |
| Routing decision (flag interaction) | `--quick`/`--milestone` flags skip entire interview instead of just complexity question | Implement per-question skip conditions; flags only affect question #4 |
| Hybrid output (two code paths) | Quick and milestone paths drift in interview context presentation | Extract shared context template; diverge only in decision mechanism |
| Comment-back (pre-execution) | MCP failure blocks execution | Error handling must catch ALL failure modes; consider shorter timeout |
| Comment-back (two comments) | Notification noise on Linear tickets | Consider combining into single post-execution comment for quick tasks |
| linear-context.md changes | `interview_summary` field not read by consumers that parse frontmatter | Verify `extractFrontmatter` handles the new field (note: known tech debt that nested YAML parsing is limited) |
| Description synthesis replacement | Fallback to raw truncation when interview context is empty | Ensure fallback is explicit and logged, not silent |

---

## Integration Gotchas

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Interview -> Routing | Routing step re-reads ticket instead of using interview answers | Route from `$INTERVIEW_CONTEXT` only; ticket data was already analyzed in pre-scan |
| Interview -> linear-context.md | Writing interview Q&A as unstructured text blob | Structure as labeled sections in YAML frontmatter `interview_summary` field |
| Interview -> Quick description | Appending interview text to old truncated description instead of replacing it | Replace `$DESCRIPTION` synthesis entirely with interview-enriched version |
| Interview -> MILESTONE-CONTEXT.md | Interview answers not included, only ticket data | Add `## Interview Context` section with goal, scope, criteria from interview |
| Approach proposals -> MILESTONE-CONTEXT.md | Selected approach name stored but description lost | Store both approach name and full description under `## Selected Approach` |
| Flag override -> Interview flow | `--quick` sets route and skips ALL questions | `--quick` sets route, skips question #4, runs questions #1-3 and conditionally #5 |
| Pre-execution comment -> Post-execution comment | Both comments include full interview summary (duplication) | Pre-execution comment has summary; post-execution references it and adds completion data |
| `$FULL_MODE` from interview -> plan-checker | Plan-checker not spawned because `$FULL_MODE` check only looks at flag, not interview answer | Check `$FULL_MODE` regardless of source (flag or interview answer "Medium") |

---

## "Looks Done But Isn't" Checklist

- [ ] **Flag override + interview:** Run with `--quick` -- verify interview questions #1-3 are asked, #4 is skipped, route is quick
- [ ] **Flag override + interview:** Run with `--milestone` -- verify interview questions #1-3 are asked, #4 is skipped, route is milestone
- [ ] **No flags, clear ticket:** Run with a detailed bug ticket -- verify some questions skipped, routing inferred correctly
- [ ] **No flags, vague ticket:** Run with title-only ticket -- verify all 5 questions asked
- [ ] **Question skipping accuracy:** For each skipped question, verify the inferred answer in the confirmation summary is correct
- [ ] **Confirmation re-prompt:** Say "No, let me clarify" at confirmation -- verify re-ask works and updated summary reflects changes
- [ ] **Pre-execution comment-back:** Verify comment appears on Linear ticket before execution starts
- [ ] **MCP failure handling:** Disconnect Linear MCP, run workflow -- verify execution proceeds with warning
- [ ] **Quick description enrichment:** Compare quick task plan description with old truncation-based description -- new version should have goal/scope/criteria
- [ ] **Milestone approach proposals:** Verify proposals reference interview answers (not just ticket text)
- [ ] **MILESTONE-CONTEXT.md contents:** Verify it includes interview context section and selected approach
- [ ] **linear-context.md `interview_summary`:** Verify field is present and parseable
- [ ] **Success criteria tags:** Grep for old WKFL-03 (scoring) -- should be gone. New criteria reference interview and routing.
- [ ] **Command spec updated:** `commands/gsd/linear.md` mentions interview, not scoring
- [ ] **Two Linear comments:** Verify pre-execution and post-execution comments are distinct (no duplication)
- [ ] **`$FULL_MODE` from interview:** Answer "Medium (1-2 sessions)" -- verify plan-checker and verifier are spawned

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Flag override skips entire interview | LOW | Add per-question skip conditions; no structural change needed |
| Wrong question skipped on ambiguous ticket | LOW | Tighten skip criteria in pre-scan; no downstream changes |
| Success criteria reference old step numbers | LOW | Find-and-replace WKFL tags; update command spec text |
| Pre-execution comment blocks execution | LOW | Add error handling wrapper; single code change |
| Hybrid output paths drift | MEDIUM | Extract shared template; requires refactoring both paths |
| Interview context not consumed downstream | MEDIUM | Trace variable through all consumers; may require format changes in multiple steps |
| Approach proposals too shallow for complex features | LOW | Add brainstorm escape hatch option to approach selection |
| Two comments create noise | LOW | Combine into single post-execution comment; remove pre-execution step |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `.planning/designs/2026-03-22-refactor-linear-ticket-flow-interview-design.md` -- full design doc specifying interview flow, routing changes, hybrid output, comment-back, and step renumbering
  - `get-shit-done/workflows/linear.md` -- existing workflow with scoring heuristic, flag handling, description synthesis, comment-back, and success criteria (WKFL tags)
  - `commands/gsd/linear.md` -- command spec with objective text, allowed tools, and execution context reference
  - `get-shit-done/workflows/brainstorm.md` -- approach proposals pattern (Step 4) that milestone route replicates
  - `.planning/PROJECT.md` -- v3.0 active requirements, architecture constraints, known tech debt (extractFrontmatter YAML limitation)

---
*Pitfalls research for: GSD v3.0 Linear interview-driven routing refactor*
*Researched: 2026-03-22*
