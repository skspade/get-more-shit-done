# Phase 82: Fix Agent Path and Model Profile - Research

**Researched:** 2026-03-21
**Status:** Complete
**Scope:** Small — 3 targeted fixes, no new features

## Codebase Findings

### 1. Agent File Deployment
- **Source:** `agents/gsd-test-reviewer.md` exists in project repo (confirmed)
- **Target:** `~/.claude/agents/gsd-test-reviewer.md` does NOT exist yet (confirmed)
- **Pattern:** All 14 other GSD agents are deployed to `~/.claude/agents/` at runtime
- **Action:** Copy file from repo to runtime path

### 2. MODEL_PROFILES Registry
- **File:** `~/.claude/get-shit-done/bin/lib/core.cjs`
- **Location:** Line 30 — `gsd-test-steward` is the last entry before closing `};`
- **Current entries:** 12 agents registered
- **Missing:** `gsd-test-reviewer` has no entry
- **Profile values:** Same as `gsd-test-steward`: `{ quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' }`
- **Fallback behavior:** Without entry, `resolveModelInternal()` returns `'sonnet'` regardless of profile — functional but ignores budget profile setting

### 3. cmdInitTestReview Cleanup
- **File:** `~/.claude/get-shit-done/bin/lib/init.cjs`
- **Function:** Lines 834-882
- **Unused fields to remove:**
  - Line 856: `checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),`
  - Line 857: `verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),`
- **Keep:** `reviewer_model`, `planner_model`, `executor_model` (all three used by test-review command)

### 4. No Other Consumers
- `checker_model` and `verifier_model` in `cmdInitTestReview` are not referenced by the test-review workflow (`test-review.md`). The workflow only uses `reviewer_model`, `planner_model`, and `executor_model`.

## Risk Assessment
- **Low risk:** All changes are additive (profile entry) or removals of dead code (unused fields). No behavioral changes to existing functionality.
- **No test changes needed:** Existing `resolveModelInternal` tests cover the generic lookup behavior.

## RESEARCH COMPLETE
