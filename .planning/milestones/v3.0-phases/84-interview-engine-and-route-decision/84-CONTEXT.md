# Phase 84: Interview Engine and Route Decision - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

Replace the numeric complexity scoring heuristic in `linear.md` Step 3 with an adaptive interview phase (3-5 questions via AskUserQuestion) and a routing decision driven by the complexity signal answer. The old `$MILESTONE_SCORE` calculation is fully removed. Override flags (`--quick`, `--milestone`) skip only the complexity question while still running other interview questions. The workflow expands from 7 to 9 steps and all interview Q&A is stored as `$INTERVIEW_CONTEXT`.

</domain>

<decisions>
## Implementation Decisions

### Interview Engine
- Interview asks 3-5 adaptive questions via AskUserQuestion after ticket fetch, skipping questions already answered by ticket content (from REQUIREMENTS.md INTV-01)
- Pre-scan reads ticket title, description, labels, and comments to build internal checklist of what information is already present (from REQUIREMENTS.md INTV-02)
- Each interview question adapts based on previous answers -- questions are not a static form (from REQUIREMENTS.md INTV-03)
- Interview covers five dimensions: goal clarification, scope boundaries, success criteria, complexity signal, additional context (from REQUIREMENTS.md INTV-04)
- All interview Q&A stored as `$INTERVIEW_CONTEXT` and threaded to downstream consumers (from REQUIREMENTS.md INTV-05)
- Interview logic lives inline in the workflow file, not in a separate agent (from ARCHITECTURE.md -- AskUserQuestion cannot be called from Task() subagents)
- Question skip criteria must be conservative: only skip when ticket has explicit sections (## Goal, ## Acceptance Criteria) or definitive labels, never based on LLM confidence that a title is "self-explanatory" (Claude's Decision: prevents silent context gaps from overeager skipping per PITFALLS.md Pitfall 2)
- `$INTERVIEW_CONTEXT` structured as labeled sections -- Goal, Scope, Success Criteria, Complexity, Additional -- not an unstructured text blob (Claude's Decision: enables downstream consumers to extract specific fields reliably)

### Routing Decision
- Complexity signal question (#4) is the primary routing input: "Quick task (hours)" -> quick, "Medium (1-2 sessions)" -> quick + `$FULL_MODE`, "Milestone (multi-phase)" -> milestone (from REQUIREMENTS.md ROUT-01)
- `$MILESTONE_SCORE` heuristic (6-factor scoring table and threshold) removed entirely (from REQUIREMENTS.md ROUT-02)
- Override flags (`--quick`, `--milestone`) skip complexity question but still run other interview questions (from REQUIREMENTS.md ROUT-03)
- When complexity question is skipped because ticket explicitly states scope, Claude infers route from ticket content and asks for confirmation (from REQUIREMENTS.md ROUT-04)
- Three-tier routing fallback: flag override -> interview answer -> ticket inference with confirmation (Claude's Decision: explicit priority chain prevents ambiguous routing when multiple signals exist)
- `$FULL_MODE` can now be set by both `--full` flag and "Medium" interview answer -- treat identically regardless of source (Claude's Decision: simplest semantics per PITFALLS.md Pitfall 10)

### Workflow Restructuring
- Workflow steps renumbered from 7 to 9 steps to accommodate interview, routing, hybrid output, and pre-execution comment-back (from REQUIREMENTS.md WKFL-01)
- Step mapping: old 1-2 unchanged, old 3 (scoring) deleted and replaced by new 3 (interview) + 4 (routing), new 5 (hybrid output) + 5.5 (comment-back) inserted, old 4-7 become new 6-9 (from design doc)
- `score` field removed from linear-context.md frontmatter (Claude's Decision: scoring heuristic is fully deleted so the field is meaningless)
- Success criteria in workflow file updated to reference interview-driven routing instead of scoring heuristic (from design doc)
- Command spec (`commands/gsd/linear.md`) objective and process descriptions updated to say "interview-driven routing" instead of "complexity scoring" (Claude's Decision: prevents command spec from instructing Claude to preserve deleted scoring logic per PITFALLS.md Pitfall 3)

### Claude's Discretion
- Exact wording of each AskUserQuestion prompt
- Internal variable naming for pre-scan checklist state
- Ordering of skip-condition checks within the pre-scan
- Formatting details of the route display banner

</decisions>

<specifics>
## Specific Ideas

**Interview question design (from design doc):**
- Q1: Goal clarification -- "What's the core outcome you want from {issue.identifier}?" Skip if description clearly states the goal. Use multiple choice when the title suggests 2-3 interpretations.
- Q2: Scope boundaries -- "How much of the codebase should this touch?" Options derived from ticket context. Skip if ticket explicitly names files or components.
- Q3: Success criteria -- "How will you know this is done?" Skip if acceptance criteria exist in description. Otherwise offer options synthesized from the goal answer.
- Q4: Complexity signal -- "Does this feel like a quick fix or a multi-phase effort?" Options: "Quick task (hours)", "Medium (1-2 sessions)", "Milestone (multi-phase)". Skip if --quick or --milestone flag.
- Q5: Additional context -- "Anything else I should know?" Open-ended, asked only if previous answers surfaced ambiguity.

**Routing answer mapping (from REQUIREMENTS.md ROUT-01):**
- "Quick task (hours)" -> `$ROUTE = "quick"`
- "Medium (1-2 sessions)" -> `$ROUTE = "quick"` with `$FULL_MODE = true`
- "Milestone (multi-phase)" -> `$ROUTE = "milestone"`

**Anti-patterns to avoid (from ARCHITECTURE.md):**
- Do NOT extract interview into a separate agent (AskUserQuestion fails in Task() subagents)
- Do NOT keep scoring heuristic as fallback (two routing mechanisms = maintenance burden)
- Do NOT store interview state in a separate file (data consumed immediately within same workflow)
- Do NOT make all questions mandatory (well-written tickets already contain answers)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get-shit-done/workflows/brainstorm.md` Steps 3-4: Proven pattern for adaptive AskUserQuestion loop (3-5 questions) and approach proposals with pros/cons. The interview phase replicates Step 3's question pattern; the milestone hybrid output replicates Step 4's approach proposal pattern.
- `get-shit-done/workflows/linear.md` Step 6 (current): Existing comment-back with MCP `create_comment` and non-blocking error handling pattern. The pre-execution comment-back (new Step 5.5) reuses this exact error handling approach.
- `get-shit-done/workflows/linear.md` Step 1: Existing flag parsing for `--quick`, `--milestone`, `--full`. The interview step must respect these flags for selective question skipping.

### Established Patterns
- **AskUserQuestion for adaptive questions**: brainstorm.md uses AskUserQuestion with options arrays for multiple-choice and open-ended follow-ups. Interview questions follow this same pattern.
- **In-memory workflow variables**: brainstorm.md accumulates answers in workflow-level variables without writing intermediate files. `$INTERVIEW_CONTEXT` follows this pattern.
- **Non-blocking MCP comment-back**: existing Step 6 wraps MCP calls with warning-only failure handling. All new MCP calls use this pattern.
- **Single workflow file for both routes**: linear.md already contains both quick and milestone paths inline. The interview additions stay in the same file.

### Integration Points
- **Step 2 output -> Step 3 input**: Pre-scan reads from `$ISSUES` array (title, description, labels, comments) already fetched in Step 2. No new data fetching needed.
- **Step 3 output -> Step 4 input**: `$INTERVIEW_CONTEXT` string and complexity signal answer feed the routing decision.
- **Step 4 output -> Step 5 input**: `$ROUTE` and `$FULL_MODE` variables feed the hybrid output step (Phase 85 scope, but routing must set them correctly).
- **Step 3 output -> Step 6 (modified)**: `interview_summary` field added to linear-context.md frontmatter (Phase 86 scope, but variable structure must support it).
- **Step 3 output -> Step 7 (modified)**: `$INTERVIEW_CONTEXT` enriches `$DESCRIPTION` for quick route and `MILESTONE-CONTEXT.md` for milestone route (Phase 86 scope, but variable structure must support it).
- **`commands/gsd/linear.md`**: Objective text and process description must be updated to reference interview-driven routing. AskUserQuestion already in allowed-tools, no tool changes needed.

</code_context>

<deferred>
## Deferred Ideas

- **Hybrid output (confirmation summary and approach proposals)** -- Phase 85 scope. This phase builds the interview and routing; Phase 85 builds the user-facing output.
- **Pre-execution comment-back to Linear** -- Phase 86 scope. This phase produces `$INTERVIEW_CONTEXT`; Phase 86 posts it to Linear.
- **Enriched task descriptions and MILESTONE-CONTEXT.md** -- Phase 86 scope. Context threading into downstream artifacts.
- **linear-context.md `interview_summary` frontmatter field** -- Phase 86 scope.
- **Command spec and documentation updates** -- Phase 87 scope. The objective text referencing interview routing.
- **Multi-issue interview strategy** -- Post-v3.0 per REQUIREMENTS.md. Workflow must not crash on multi-issue input but interview covers the batch as a unit.

</deferred>

---

*Phase: 84-interview-engine-and-route-decision*
*Context gathered: 2026-03-22 via auto-context*
