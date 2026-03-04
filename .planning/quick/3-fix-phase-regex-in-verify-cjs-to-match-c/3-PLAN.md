---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/verify.cjs
autonomous: true
requirements: [QUICK-3]
must_haves:
  truths:
    - "verify.cjs phase regex matches 'Phase: 5' format with colon (same as cli.cjs)"
    - "Health check correctly extracts phase numbers from STATE.md regardless of colon presence"
  artifacts:
    - path: "get-shit-done/bin/lib/verify.cjs"
      provides: "Phase reference extraction from STATE.md"
      contains: "[Pp]hase:?\\s+"
  key_links:
    - from: "get-shit-done/bin/lib/verify.cjs"
      to: ".planning/STATE.md"
      via: "regex matchAll on STATE.md content"
      pattern: "phaseRefs.*matchAll"
---

<objective>
Fix the phase regex in verify.cjs to include an optional colon, matching the pattern already used in cli.cjs.

Purpose: STATE.md uses "Phase: N of M" format (with colon). The verify.cjs regex `/[Pp]hase\s+(\d+)/g` fails to match this because it doesn't account for the colon before the whitespace. The cli.cjs already handles this correctly with `/[Pp]hase:?\s+(\d+)/g`.

Output: Updated verify.cjs with consistent regex pattern.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/bin/lib/verify.cjs (line 576 — the regex to fix)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix phase regex in verify.cjs to support optional colon</name>
  <files>get-shit-done/bin/lib/verify.cjs</files>
  <action>
On line 576 of `get-shit-done/bin/lib/verify.cjs`, change the regex from:

```javascript
const phaseRefs = [...stateContent.matchAll(/[Pp]hase\s+(\d+(?:\.\d+)*)/g)].map(m => m[1]);
```

to:

```javascript
const phaseRefs = [...stateContent.matchAll(/[Pp]hase:?\s+(\d+(?:\.\d+)*)/g)].map(m => m[1]);
```

The only change is adding `:?` (optional colon) after `[Pp]hase`, making it consistent with the cli.cjs pattern at line 570 of cli.cjs.

This is the ONLY instance in verify.cjs that needs this fix. The other phase regex patterns in verify.cjs (lines 414 and 654) are for matching markdown headers like `### Phase 5:` where the colon comes AFTER the number, and those already work correctly.
  </action>
  <verify>
    <automated>node -e "
const re = /[Pp]hase:?\s+(\d+(?:\.\d+)*)/g;
const tests = [
  ['Phase: 5 of 5', '5'],
  ['Phase 5 of 5', '5'],
  ['phase: 3 of 10', '3'],
  ['Phase: 12.1 of 15', '12.1'],
  ['Phase 3', '3'],
];
let pass = true;
for (const [input, expected] of tests) {
  re.lastIndex = 0;
  const m = re.exec(input);
  if (!m || m[1] !== expected) { console.log('FAIL:', input, 'got', m?.[1]); pass = false; }
}
if (pass) console.log('All regex tests passed');
else process.exit(1);
// Also verify the file was updated
const fs = require('fs');
const content = fs.readFileSync('get-shit-done/bin/lib/verify.cjs', 'utf-8');
if (!content.includes('[Pp]hase:?\\\\s+')) { console.log('FAIL: verify.cjs not updated'); process.exit(1); }
console.log('File verification passed');
"
    </automated>
  </verify>
  <done>
    - verify.cjs line 576 regex includes optional colon `:?`
    - Regex matches both "Phase: 5" and "Phase 5" formats
    - Pattern is consistent with cli.cjs
  </done>
</task>

</tasks>

<verification>
Run the health check to confirm no regressions:
```bash
node get-shit-done/bin/gsd-tools.cjs health 2>/dev/null || true
```
</verification>

<success_criteria>
- The regex on line 576 of verify.cjs matches STATE.md content with "Phase: N" format (colon present)
- The regex still matches "Phase N" format (no colon) for backward compatibility
- No other files need changes (confirmed by grep — only this one instance is affected)
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-phase-regex-in-verify-cjs-to-match-c/3-SUMMARY.md`
</output>
