# Project Research Summary

**Project:** GSD Linear Interview Refactor (v3.0)
**Domain:** Workflow refactor — replacing numeric scoring heuristic with interview-driven routing in autonomous development framework
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

This is a workflow-layer refactor of the existing `/gsd:linear` command, not a greenfield build. The project replaces a 6-factor numeric scoring heuristic with an adaptive interview phase (3-5 questions via AskUserQuestion) that captures richer context about the user's intent before routing to quick or milestone execution paths. The refactor also adds hybrid output (confirmation summary for quick route, approach proposals for milestone route) and a pre-execution comment-back to Linear. Every building block — AskUserQuestion, MCP comment-back, approach proposals, markdown state management — already exists and is validated in the codebase. Zero new dependencies are needed.

The recommended approach is a phased modification of the single `linear.md` workflow file, plus minor updates to the command spec and documentation. The interview pattern is proven in `brainstorm.md` (Steps 3-4), and the comment-back pattern is proven in the existing `linear.md` Step 6. The refactor reuses these patterns rather than inventing new ones. The key architectural constraint is that AskUserQuestion must be called from the top-level workflow (not from a Task() subagent), which means the interview logic must remain inline in the workflow file.

The primary risks are: (1) override flags (`--quick`/`--milestone`) accidentally skipping the entire interview instead of just the complexity question, losing context enrichment; (2) overeager question skipping on ambiguous tickets, causing wrong assumptions to propagate silently through downstream artifacts; and (3) step renumbering breaking success criteria references and command spec language that still mentions "scoring heuristic." All three are preventable with disciplined implementation ordering — structural changes first, behavioral changes second.

## Key Findings

### Recommended Stack

No new dependencies. The existing stack handles everything.

**Core technologies (unchanged):**
- **Node.js (>=16.7.0):** CJS modules, CLI, gsd-tools — no changes needed
- **Claude Code CLI:** Workflow interpretation engine — interview logic lives in markdown, not code
- **AskUserQuestion:** Primary interaction mechanism for interview (3-5 calls) and hybrid output (1 call) — already in allowed-tools
- **Linear MCP tools:** `get_issue`, `list_comments`, `create_comment` — create_comment gets a second call point (pre-execution) but same API

**What NOT to add:** No prompt templating libraries, no state machine libraries, no LLM orchestration frameworks, no new CJS modules, no new gsd-tools entries. The interview is pure workflow markdown logic.

### Expected Features

**Must have (table stakes):**
- 3-5 adaptive interview questions with pre-scan-based skip logic
- Complexity signal question as primary routing input (replaces scoring)
- Override flags still work (`--quick`/`--milestone` skip complexity question, not entire interview)
- Confirmation summary for quick route with re-ask on rejection
- Approach proposals for milestone route (brainstorm Step 4 pattern)
- Interview summary posted to Linear before execution (non-blocking)
- `$INTERVIEW_CONTEXT` threaded through all downstream steps
- Enriched task descriptions replacing raw truncation

**Should have (differentiators):**
- Inferred routing with confirmation when complexity question is skipped
- Re-ask loop on confirmation rejection (conversational, not form-like)
- Selected approach embedded in MILESTONE-CONTEXT.md
- `interview_summary` field in linear-context.md frontmatter

**Defer (post-v3.0):**
- Multi-issue interview strategy
- Interview analytics (tracking skip patterns)

### Architecture Approach

The refactor expands the workflow from 7 steps to 9 steps (1, 2, 3, 4, 5, 5.5, 6, 7, 8, 9). Steps 1-2 and 8-9 are unchanged. Old Step 3 (scoring heuristic) is deleted and replaced by new Steps 3 (interview), 4 (routing), 5 (hybrid output), and 5.5 (pre-execution comment-back). Steps 6-7 (write context, execute route) are modified to consume interview data.

**Major components:**
1. **Interview Phase (new Step 3)** — pre-scan ticket, ask 3-5 adaptive questions, accumulate `$INTERVIEW_CONTEXT`
2. **Route Decision (new Step 4)** — map complexity signal answer to route; three-tier fallback: flag -> interview -> inference
3. **Hybrid Output (new Step 5)** — confirmation (quick) or approach proposals (milestone) with user interaction
4. **Pre-Execution Comment-Back (new Step 5.5)** — post interview summary to Linear; warning-only on failure
5. **Modified Context Writing (Step 6)** — add `interview_summary` to frontmatter, remove `score`
6. **Modified Route Execution (Step 7)** — enriched descriptions from interview, selected approach for milestones

### Critical Pitfalls

1. **Override flags skip entire interview** — Flags must only skip the complexity question (#4), not all questions. Implement per-question skip conditions with a three-tier routing fallback (flag -> interview answer -> ticket inference).
2. **Overeager question skipping on ambiguous tickets** — Only skip when ticket has explicit sections (## Goal, ## Acceptance Criteria) or definitive labels. Never skip based on LLM confidence that a title is "self-explanatory." Show inferred answers in confirmation summary so users can catch mistakes.
3. **Step renumbering breaks references** — Grep all WKFL-XX tags and "scoring"/"heuristic" text across the codebase before making behavioral changes. Update command spec to say "interview-driven routing" instead of "complexity scoring."
4. **Pre-execution comment-back blocks execution** — Wrap MCP call in error handling that catches ALL failure modes (not just MCP errors, but also tool-not-available and timeouts). Never let a comment failure propagate.
5. **Hybrid output paths drift over time** — Extract shared interview context template before the quick/milestone fork. Both paths render the same context block; only the decision mechanism (confirm vs select) differs.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Workflow Restructuring

**Rationale:** Structural changes must come before behavioral changes. Step renumbering, reference updates, and scoring heuristic removal are prerequisites for everything else. This phase is mechanical and low-risk — it sets the stage without changing behavior.
**Delivers:** Workflow file with new step skeleton (empty new steps, renumbered old steps), updated success criteria tags, updated command spec language, removed scoring heuristic code.
**Addresses:** Step renumbering, WKFL tag migration, `score` field removal from linear-context.md, `$FULL_MODE` semantics clarification.
**Avoids:** Pitfall 3 (reference breakage) and Pitfall 10 (`$FULL_MODE` ambiguity) by handling them as explicit first-phase deliverables.

### Phase 2: Interview Implementation

**Rationale:** The interview is the core value of the refactor and has the most behavioral complexity. It must be built and tested before the hybrid output that consumes its data, and before the comment-back that posts its results.
**Delivers:** Pre-scan logic, adaptive question loop (Q1-Q5) with skip conditions, `$INTERVIEW_CONTEXT` variable with defined structure, routing decision from complexity signal, flag override integration (partial skip).
**Addresses:** Adaptive interview questions, complexity signal routing, override flag semantics, pre-scan skip logic, context variable structure.
**Avoids:** Pitfall 1 (flag skip semantics) by implementing per-question skip conditions from the start. Pitfall 2 (silent context gaps) by using conservative skip criteria. Pitfall 6 (context not consumed) by defining variable structure before building consumers.

### Phase 3: Hybrid Output and Comment-Back

**Rationale:** Depends on Phase 2's interview context. Both the confirmation/proposal output and the comment-back consume `$INTERVIEW_CONTEXT`. Building them together ensures consistent formatting across both consumption points.
**Delivers:** Quick route confirmation summary with re-ask loop, milestone route approach proposals with selection, pre-execution comment-back to Linear, shared interview context template.
**Addresses:** Confirmation summary, approach proposals, pre-execution comment-back, brainstorm escape hatch for complex milestones.
**Avoids:** Pitfall 4 (comment blocks execution) with error handling. Pitfall 5 (path drift) with shared template. Pitfall 8 (shallow proposals) with brainstorm escape hatch. Pitfall 9 (comment noise) by deciding one-comment vs two-comment strategy.

### Phase 4: Context Threading and Description Enrichment

**Rationale:** Final integration phase. Interview data flows into linear-context.md frontmatter, enriched task descriptions for quick route, and MILESTONE-CONTEXT.md for milestone route. These are modifications to existing steps that depend on all prior phases.
**Delivers:** `interview_summary` in linear-context.md frontmatter, enriched `$DESCRIPTION` replacing raw truncation for quick tasks, `## Selected Approach` section in MILESTONE-CONTEXT.md, documentation updates.
**Addresses:** Context threading through all downstream steps, description synthesis replacement, MILESTONE-CONTEXT.md enrichment.
**Avoids:** Pitfall 6 (context not consumed) by verifying each consumption point. Pitfall 7 (confusing inferred route UX) by implementing confidence threshold for auto-routing.

### Phase Ordering Rationale

- **Structural before behavioral:** Phase 1 handles all renumbering and reference cleanup so subsequent phases work against correct step numbers and criteria tags.
- **Core before consumers:** Phase 2 builds the interview engine that Phases 3-4 consume. Building consumers before the producer would require placeholder data and rework.
- **User-facing before background:** Phase 3 builds the user-visible confirmation/proposal output before Phase 4 wires up background context threading. Users see value from Phase 3; Phase 4 improves execution quality behind the scenes.
- **Each phase is independently testable:** Phase 1 can be verified by grep. Phase 2 can be tested with manual interview runs. Phase 3 can be tested by observing output and Linear comments. Phase 4 can be tested by inspecting generated context files.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Interview skip logic requires careful calibration. The boundary between "ticket is clear enough to skip" and "ticket seems clear but is ambiguous" needs concrete heuristics defined during planning. Run `/gsd:research-phase` for this phase.
- **Phase 3 (milestone path):** The brainstorm escape hatch (offering to switch to `/gsd:brainstorm` for complex features) needs UX design. How does the workflow hand off mid-stream? Research during planning.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Purely mechanical restructuring. Grep, rename, update references. No research needed.
- **Phase 4:** Context threading is pattern replication from existing steps. Well-documented in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All tools validated in production. Source: direct codebase inspection. |
| Features | HIGH | All features specified in approved design document. Proven patterns from brainstorm.md. |
| Architecture | HIGH | Single-file workflow modification. Component boundaries clear. AskUserQuestion constraint well-understood. |
| Pitfalls | HIGH | Derived from direct analysis of existing code, design doc, and integration points. Recovery costs low for all. |

**Overall confidence:** HIGH

### Gaps to Address

- **Question skip calibration:** The exact heuristics for when to skip each interview question are not fully specified in the design doc. "Clear from description" is subjective. Phase 2 planning must define concrete skip criteria (e.g., description has >100 chars and contains a verb phrase describing the goal).
- **Inferred route confidence threshold:** The design says Claude infers the route when the complexity question is skipped, but does not define what constitutes high vs low confidence for auto-routing vs asking for confirmation. Phase 2 planning must define this.
- **Multi-issue interview behavior:** The design does not address how the interview works when multiple issue IDs are provided. Currently deferred to post-v3.0, but the workflow must at minimum not crash on multi-issue input.
- **Two-comment vs one-comment decision:** The design specifies two comments, but Pitfall 9 identifies notification noise concerns for quick tasks. Phase 3 planning must make a definitive call.

## Sources

### Primary (HIGH confidence)
- `.planning/designs/2026-03-22-refactor-linear-ticket-flow-interview-design.md` — approved design document, primary specification
- `get-shit-done/workflows/linear.md` — existing workflow being refactored
- `get-shit-done/workflows/brainstorm.md` — proven pattern for adaptive questions (Step 3) and approach proposals (Step 4)
- `commands/gsd/linear.md` — command spec with allowed tools and execution context
- `.planning/PROJECT.md` — v3.0 requirements, architecture constraints, known tech debt
- `package.json` — dependency list confirming no new packages needed

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
