# Phase 81: Documentation - Research

**Researched:** 2026-03-21
**Domain:** Documentation updates (help.md, USER-GUIDE.md, README.md)
**Confidence:** HIGH

## Summary

Phase 81 is documentation-only: adding `/gsd:test-review` to three existing documentation files. No code changes. All three target files have established patterns from existing commands (especially `/gsd:pr-review`) that serve as direct templates.

The test-review command is simpler than pr-review: one flag (`--report-only`) vs five flags, user-choice routing vs auto-scoring, and no aspect passthrough. Documentation should be correspondingly shorter.

**Primary recommendation:** Follow the exact format patterns from the pr-review entries in each file, but with simplified content reflecting test-review's simpler interface.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- help.md: Add entry in Utility Commands section after `/gsd:audit-tests`
- help.md: Follow established entry format (bold command, bullet list, Usage examples)
- help.md: Document `--report-only` flag and behaviors (diff-aware analysis, coverage gaps, stale tests, consolidation, user-choice routing)
- help.md: Add quick reference block entry after "PR Review:"
- USER-GUIDE.md: Add section after PR Review, before Troubleshooting
- USER-GUIDE.md: Include pipeline diagram, flags table, examples
- USER-GUIDE.md: Explain user-choice routing (no auto-scoring)
- USER-GUIDE.md: Mention report path `.planning/reviews/YYYY-MM-DD-test-review.md`
- USER-GUIDE.md: Add command table row
- README.md: Add row after `/gsd:pr-review` in Commands table
- Document only `--report-only` flag (no --quick, --milestone, --ingest, --full)
- Note large diff auto-summarization at >2000 lines

### Claude's Discretion
- Exact wording of pipeline diagram labels
- Order of bullet points within help.md entry
- Exact phrasing of "when to use" column in USER-GUIDE command table
- Whether to include a "Differences from pr-review" subsection

### Deferred Ideas (OUT OF SCOPE)
- Documentation for INT-01 (auto-run during milestone audit)
- Documentation for INT-02 (custom source-to-test mapping config)
- Documentation for INT-03 (budget impact projection)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | help.md updated with `/gsd:test-review` command reference | Entry pattern from pr-review (line 206) and audit-tests (line 356) in help.md; command spec from test-review.md |
| DOC-02 | USER-GUIDE.md updated with test review usage guide and examples | Section pattern from PR Review (line 622) in USER-GUIDE.md; pipeline/flags/examples from test-review.md |
| DOC-03 | README.md updated with test-review in command table | Table pattern from line 77 in README.md; pr-review row at line 89 |
</phase_requirements>

## Existing Documentation Patterns

### help.md Entry Format (Utility Commands)
```
**`/gsd:command-name [flags]`**

Description sentence.

- Bullet point for each capability
- Another bullet point

Usage: `/gsd:command-name` (description)
Usage: `/gsd:command-name --flag` (description)

Result: Output location
```

Located at: `/Users/seanspade/.claude/get-shit-done/workflows/help.md`
- Utility Commands section starts at line 354
- `/gsd:audit-tests` entry at lines 356-363
- Quick reference blocks start around line 565

### help.md Quick Reference Format
```
**Category Name:**

```
/gsd:command                                # Description
/gsd:command --flag                         # Description
```
```

### USER-GUIDE.md Section Format
```
### Command Name

Description paragraph.

#### Pipeline

```
  /gsd:command
         |
         +-- Step 1
         |
         +-- Step 2
```

#### Flags

| Flag | Effect |
|------|--------|
| *(none)* | Default behavior |
| `--flag` | Effect description |

#### Examples

```
# Example description
/gsd:command

# Another example
/gsd:command --flag
```

Closing paragraph about output.
```

Located at: `/Users/seanspade/Documents/Source/get-more-shit-done/docs/USER-GUIDE.md`
- Command table at line 360-367
- PR Review section at lines 622-682
- Troubleshooting starts at line 686

### README.md Table Format
```
| `/gsd:command` | Terse action-oriented description |
```

Located at: `/Users/seanspade/Documents/Source/get-more-shit-done/README.md`
- Commands table at lines 75-92
- pr-review row at line 89

## Test-Review Command Spec (from implementation)

### Command Signature
`/gsd:test-review [--report-only]`

### Behavior Summary
1. Gathers `git diff` vs main (resolves base: origin/main, origin/master, main, master)
2. Exits gracefully if no diff exists
3. Switches to summarized mode if diff > 2000 lines
4. Displays banner with changed file count, test count/budget, diff size
5. Spawns gsd-test-reviewer agent for analysis
6. Agent maps changed source files to test files, detects coverage gaps, missing test files, stale tests, consolidation opportunities
7. Writes report to `.planning/reviews/YYYY-MM-DD-test-review.md`
8. If `--report-only`: exits after report
9. If zero findings: exits with "no issues found"
10. Otherwise: prompts user to choose route (quick task / milestone / done)

### Flags
| Flag | Effect |
|------|--------|
| *(none)* | Full analysis with user-choice routing |
| `--report-only` | Analysis only, skip routing |

### Key Differences from pr-review
- One flag vs five flags
- User-choice routing vs auto-scoring heuristic
- Test-specific analysis vs general PR review
- No `--ingest` mode (always runs fresh analysis)
- No aspect passthrough

## Common Pitfalls

### Pitfall 1: Over-documenting
**What goes wrong:** Adding flags or behaviors that don't exist in the implementation
**How to avoid:** Only document `--report-only`. No --quick, --milestone, --ingest, --full flags exist for test-review.

### Pitfall 2: Confusing routing models
**What goes wrong:** Describing auto-scoring routing (pr-review's model) instead of user-choice routing (test-review's model)
**How to avoid:** Explicitly state that user chooses the route, there is no automatic scoring.

## Sources

### Primary (HIGH confidence)
- `/Users/seanspade/.claude/commands/gsd/test-review.md` — full command implementation spec
- `/Users/seanspade/.claude/get-shit-done/workflows/help.md` — existing documentation patterns
- `/Users/seanspade/Documents/Source/get-more-shit-done/docs/USER-GUIDE.md` — existing section patterns
- `/Users/seanspade/Documents/Source/get-more-shit-done/README.md` — existing table pattern

## Metadata

**Confidence breakdown:**
- Documentation patterns: HIGH - direct examination of existing files
- Command spec: HIGH - read from actual implementation
- Content accuracy: HIGH - cross-referenced implementation with requirements

**Research date:** 2026-03-21
**Valid until:** Indefinite (documentation patterns are stable)
