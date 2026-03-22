# Phase 84: Interview Engine and Route Decision - Research

**Researched:** 2026-03-22
**Domain:** Workflow orchestration — AskUserQuestion adaptive interview + routing logic
**Confidence:** HIGH

## Summary

Phase 84 replaces the numeric `$MILESTONE_SCORE` heuristic in `linear.md` Step 3 with an adaptive interview phase (3-5 questions via AskUserQuestion) and a routing decision driven by the complexity signal answer. The interview logic must live inline in the workflow file because AskUserQuestion cannot be called from Task() subagents.

The existing brainstorm.md Steps 3-4 provide a proven pattern for adaptive AskUserQuestion loops. The interview replicates this pattern with five specific dimensions: goal clarification, scope boundaries, success criteria, complexity signal, and additional context. The routing decision maps the complexity answer to `$ROUTE` and `$FULL_MODE` variables.

**Primary recommendation:** Implement the interview as a new Step 3 and routing as a new Step 4, delete the scoring heuristic entirely, and renumber remaining steps. Use brainstorm.md's adaptive question pattern as the template.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Interview asks 3-5 adaptive questions via AskUserQuestion after ticket fetch, skipping questions already answered by ticket content (INTV-01)
- Pre-scan reads ticket title, description, labels, and comments to build internal checklist of what information is already present (INTV-02)
- Each interview question adapts based on previous answers — questions are not a static form (INTV-03)
- Interview covers five dimensions: goal clarification, scope boundaries, success criteria, complexity signal, additional context (INTV-04)
- All interview Q&A stored as `$INTERVIEW_CONTEXT` and threaded to downstream consumers (INTV-05)
- Interview logic lives inline in the workflow file, not in a separate agent (AskUserQuestion cannot be called from Task() subagents)
- Question skip criteria must be conservative: only skip when ticket has explicit sections (## Goal, ## Acceptance Criteria) or definitive labels, never based on LLM confidence that a title is "self-explanatory"
- `$INTERVIEW_CONTEXT` structured as labeled sections — Goal, Scope, Success Criteria, Complexity, Additional — not an unstructured text blob
- Complexity signal question (#4) is the primary routing input: "Quick task (hours)" -> quick, "Medium (1-2 sessions)" -> quick + `$FULL_MODE`, "Milestone (multi-phase)" -> milestone (ROUT-01)
- `$MILESTONE_SCORE` heuristic (6-factor scoring table and threshold) removed entirely (ROUT-02)
- Override flags (`--quick`, `--milestone`) skip complexity question but still run other interview questions (ROUT-03)
- When complexity question is skipped because ticket explicitly states scope, Claude infers route from ticket content and asks for confirmation (ROUT-04)
- Three-tier routing fallback: flag override -> interview answer -> ticket inference with confirmation
- `$FULL_MODE` can now be set by both `--full` flag and "Medium" interview answer — treat identically regardless of source
- Workflow steps renumbered from 7 to 9 steps (WKFL-01)
- Step mapping: old 1-2 unchanged, old 3 (scoring) deleted and replaced by new 3 (interview) + 4 (routing), old 4-7 become new 5-8, new step 9 for cleanup
- `score` field removed from linear-context.md frontmatter
- Command spec objective and process descriptions updated to say "interview-driven routing" instead of "complexity scoring"

### Claude's Discretion
- Exact wording of each AskUserQuestion prompt
- Internal variable naming for pre-scan checklist state
- Ordering of skip-condition checks within the pre-scan
- Formatting details of the route display banner

### Deferred Ideas (OUT OF SCOPE)
- Hybrid output (confirmation summary and approach proposals) — Phase 85
- Pre-execution comment-back to Linear — Phase 86
- Enriched task descriptions and MILESTONE-CONTEXT.md — Phase 86
- linear-context.md `interview_summary` frontmatter field — Phase 86
- Command spec and documentation updates — Phase 87
- Multi-issue interview strategy — Post-v3.0
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTV-01 | Interview asks 3-5 adaptive questions via AskUserQuestion after ticket fetch, skipping questions already answered by ticket | brainstorm.md Step 3 pattern: adaptive questions with skip logic |
| INTV-02 | Pre-scan reads ticket title, description, labels, comments to build checklist of present info | `$ISSUES` array from Step 2 already contains all fields needed |
| INTV-03 | Each question adapts based on previous answers — not a static form | brainstorm.md pattern: "After each answer, incorporate response before asking next question" |
| INTV-04 | Interview covers five dimensions: goal, scope, success criteria, complexity, additional context | Maps to brainstorm.md's 5 focus areas with domain-specific adaptation |
| INTV-05 | All Q&A stored as `$INTERVIEW_CONTEXT` threaded to downstream consumers | In-memory workflow variable pattern from brainstorm.md |
| ROUT-01 | Complexity signal determines route — Quick/Medium/Milestone mapping | Replaces `$MILESTONE_SCORE` scoring table in current Step 3 |
| ROUT-02 | `$MILESTONE_SCORE` heuristic removed entirely | Delete scoring table, conditions, and score display from Step 3 |
| ROUT-03 | Override flags skip complexity question but still run other interview questions | Current flag handling in Step 3 already parses `$FORCE_QUICK`/`$FORCE_MILESTONE` |
| ROUT-04 | When complexity skipped (ticket states scope), Claude infers route and confirms | New inference + confirmation path using AskUserQuestion |
| WKFL-01 | Workflow steps renumbered from 7 to 9 steps | Step mapping documented in CONTEXT.md |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AskUserQuestion | Built-in | Interactive questioning | Claude Code native tool — only way to ask users questions in workflows |

### Supporting
No external libraries needed. This phase modifies a workflow markdown file using built-in Claude Code tools only.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline interview | Separate agent | AskUserQuestion cannot be called from Task() subagents — this is a hard constraint |
| Adaptive questions | Static form | Static forms cannot skip already-answered questions or adapt to context |

## Architecture Patterns

### Recommended Structure

The interview engine is a new Step 3 in `linear.md` containing:
1. Pre-scan logic (reads `$ISSUES` array, builds skip checklist)
2. Question loop (5 dimensions, each with skip conditions)
3. `$INTERVIEW_CONTEXT` assembly (structured sections)

The routing decision is a new Step 4 containing:
1. Flag override check (existing `$FORCE_QUICK`/`$FORCE_MILESTONE`)
2. Interview answer mapping (complexity signal -> route)
3. Ticket inference fallback (when complexity skipped by ticket content)

### Pattern 1: Adaptive AskUserQuestion Loop (from brainstorm.md)
**What:** Ask 3-5 questions one at a time, adapting each based on previous answers
**When to use:** When gathering structured context from user interactively
**Key details:**
- Prefer multiple choice format when options are enumerable (use `options` parameter)
- Use open-ended format when domain is too broad
- After each answer, incorporate response before asking next question
- Skip questions already answered

### Pattern 2: Pre-scan Skip Logic
**What:** Read ticket data before interview to determine which questions to skip
**When to use:** When ticket content already provides some interview answers
**Key details:**
- Check for explicit markdown sections: `## Goal`, `## Acceptance Criteria`, `## Scope`
- Check for definitive labels (not just any label)
- Conservative: only skip when data is explicit, never infer from title alone

### Pattern 3: Structured Variable Assembly
**What:** Build `$INTERVIEW_CONTEXT` as labeled sections
**When to use:** When downstream consumers need to extract specific fields
**Format:**
```
**Goal:** {answer or "from ticket: {extracted}"}
**Scope:** {answer or "from ticket: {extracted}"}
**Success Criteria:** {answer or "from ticket: {extracted}"}
**Complexity:** {answer} → Route: {route}
**Additional:** {answer or "none"}
```

### Anti-Patterns to Avoid
- **Extracting interview into a separate agent:** AskUserQuestion fails in Task() subagents
- **Keeping scoring heuristic as fallback:** Two routing mechanisms = maintenance burden
- **Storing interview state in separate file:** Data consumed immediately within same workflow
- **Making all questions mandatory:** Well-written tickets already contain answers
- **Skipping based on LLM confidence:** "Self-explanatory" is subjective — only skip on explicit data

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive questioning | Custom prompt parsing | AskUserQuestion tool | Built-in, handles display, options, follow-ups |
| Route decision tree | Complex if/else chain | Three-tier fallback (flag -> answer -> inference) | Clear priority, each tier documented |

## Common Pitfalls

### Pitfall 1: Overeager Question Skipping
**What goes wrong:** Interview skips questions based on weak signals (title sounds clear, short description), resulting in missing context
**Why it happens:** LLM confidence in understanding is higher than actual understanding
**How to avoid:** Only skip when ticket has explicit markdown sections (## Goal, ## Acceptance Criteria) or definitive labels — conservative skip criteria
**Warning signs:** Questions being skipped for tickets with only a title and one-line description

### Pitfall 2: Stale Scoring Heuristic Remnants
**What goes wrong:** Old `$MILESTONE_SCORE` references remain in code paths, causing dual routing or dead code
**Why it happens:** Incomplete deletion — scoring logic is referenced in multiple places (Step 3, linear-context.md frontmatter, success criteria, display output)
**How to avoid:** Search for ALL references to `$MILESTONE_SCORE`, `score`, and the 6-factor scoring table. Delete every occurrence.
**Warning signs:** `score` field still in linear-context.md frontmatter, scoring conditions in code

### Pitfall 3: Command Spec Drift
**What goes wrong:** `commands/gsd/linear.md` still describes "complexity scoring" even though implementation uses interview
**Why it happens:** Command spec is a separate file that instructs Claude how to run the workflow
**How to avoid:** Update command spec objective and process description to reference interview-driven routing
**Warning signs:** Running `/gsd:linear` and seeing Claude attempt to score issues

### Pitfall 4: Flag Override Breaking Interview
**What goes wrong:** `--quick` or `--milestone` flag skips the entire interview instead of just the complexity question
**Why it happens:** Current flag handling exits early from Step 3 entirely
**How to avoid:** Restructure flag handling: flags set `$ROUTE` but interview still runs (minus Q4). Interview is Step 3, routing is Step 4.
**Warning signs:** Using `--quick` and not being asked any clarifying questions

### Pitfall 5: Step Renumbering Cascade
**What goes wrong:** References to old step numbers in other parts of the workflow or other files
**Why it happens:** Steps 4-7 become 5-8, and any hardcoded references break
**How to avoid:** Search for step number references across the file and update all of them
**Warning signs:** Step references in comments, banners, or success criteria pointing to wrong steps

## Code Examples

### Current Step 3 Structure (to be deleted)
The scoring heuristic in current linear.md Step 3 (lines 94-126) computes `$MILESTONE_SCORE` using a 6-factor table. This entire section is deleted and replaced.

### AskUserQuestion Pattern (from brainstorm.md)
```
AskUserQuestion(
  header: "Interview: {dimension}",
  question: "{adaptive question text}",
  options: [{option1}, {option2}, ...],  // when enumerable
  followUp: null
)
```

### Interview Context Assembly Pattern
```
$INTERVIEW_CONTEXT = ""
// After each answered question:
$INTERVIEW_CONTEXT += "**{Dimension}:** {answer}\n"
// After skipped questions (from ticket data):
$INTERVIEW_CONTEXT += "**{Dimension}:** (from ticket) {extracted value}\n"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 6-factor scoring heuristic | Interview-driven routing | Phase 84 (now) | User explicitly chooses complexity instead of algorithmic guess |
| All questions mandatory | Adaptive skip based on ticket data | Phase 84 (now) | Faster for well-written tickets |
| Score displayed to user | Route displayed with reasoning | Phase 84 (now) | Transparent decision |

## Open Questions

1. **Multi-issue interview strategy**
   - What we know: Current Step 2 fetches multiple issues into `$ISSUES` array
   - What's unclear: Should interview cover all issues as a batch or the first one?
   - Recommendation: Per REQUIREMENTS.md, multi-issue strategy is Post-v3.0. For now, interview covers the first/primary issue. Workflow must not crash on multi-issue input.

## Sources

### Primary (HIGH confidence)
- `linear.md` current workflow (read directly) — current Step 3 scoring heuristic, Step 1 flag parsing, Step 2 issue fetching
- `brainstorm.md` Steps 3-4 (read directly) — AskUserQuestion adaptive loop pattern, approach proposal pattern
- `84-CONTEXT.md` (read directly) — locked decisions, implementation constraints

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md — requirement IDs and descriptions for INTV-*, ROUT-*, WKFL-*

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AskUserQuestion is well-established in brainstorm.md
- Architecture: HIGH - Pattern directly copied from proven brainstorm workflow
- Pitfalls: HIGH - Pitfalls derived from concrete code analysis of existing linear.md

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable — internal workflow, no external dependencies)
