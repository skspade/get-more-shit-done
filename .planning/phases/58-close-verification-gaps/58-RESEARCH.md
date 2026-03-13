# Phase 58: Close Verification Gaps - Research

**Researched:** 2026-03-12
**Domain:** Verification documentation / gap closure
**Confidence:** HIGH

## Summary

Phase 58 is a documentation-only gap closure phase. The v2.4 milestone audit identified 13 orphaned requirements across phases 54 and 56 -- all were implemented and tested, but never formally verified because those phases lack VERIFICATION.md documents. The actual code is already complete and passing tests; this phase creates the missing verification artifacts and updates REQUIREMENTS.md checkboxes.

The work is purely mechanical: inspect the codebase for evidence of each requirement, document that evidence in two VERIFICATION.md files (one for Phase 54, one for Phase 56), and check off all 13 requirements in REQUIREMENTS.md. No code changes are needed.

**Primary recommendation:** Create 54-VERIFICATION.md (12 requirements) and 56-VERIFICATION.md (1 requirement) by inspecting actual codebase line numbers and test assertions, then update REQUIREMENTS.md to mark all 13 requirements as verified.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STREAM-01 | Empirical stream-json format discovery | Phase 54 CONTEXT.md documents discovery approach; `stream-json` flag present at autopilot.mjs:238 |
| STREAM-02 | runClaudeStreaming reads NDJSON via async iterator | autopilot.mjs:239 `createInterface`, line 243 `for await (const line of rl)` |
| STREAM-03 | displayStreamEvent writes text to stdout, tools to stderr | autopilot.mjs:196-209 -- `process.stdout.write(block.text)` and `process.stderr.write` |
| STREAM-04 | NDJSON lines accumulated for result.stdout compatibility | autopilot.mjs:219 `const lines = []`, line 244 `lines.push(line)`, line 260 `lines.join('\n')` |
| STREAM-05 | Output file receives lines in real-time | autopilot.mjs:246 `fs.appendFileSync(outputFile, line + '\n')` inside the async loop |
| STREAM-06 | Uses --output-format stream-json | autopilot.mjs:238 contains `--output-format stream-json` |
| STALL-01 | Stall timer resets on every event | autopilot.mjs:245 `armStallTimer()` called inside `for await` loop |
| STALL-02 | Warning on stderr + log at timeout | autopilot.mjs:229-230 `process.stderr.write` warning + `logMsg` |
| STALL-03 | Warning re-arms at each interval | autopilot.mjs:232 `setTimeout(onStall, stallTimeout)` recursive re-arm |
| STALL-04 | Timer cleanup on all exit paths | autopilot.mjs:255-257 `finally { if (stallTimer) clearTimeout(stallTimer); }` |
| CLI-01 | --quiet flag for buffered JSON fallback | autopilot.mjs:34 `'quiet'` in knownFlags, line 56 `const QUIET`, lines 213-216 quiet path |
| CLI-03 | All 3 debug retry invocations route through runClaudeStreaming | autopilot.mjs:597, 641, 679 -- all call `runClaudeStreaming(debugPrompt)` |
| CLI-05 | stdin redirect preserved | autopilot.mjs:214 and 238 both contain `< /dev/null` |
</phase_requirements>

## Standard Stack

### Core

No new libraries or tools required. This phase creates markdown documentation files only.

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| VERIFICATION.md format | N/A | Phase verification document | Established pattern in phases 55 and 57 |
| REQUIREMENTS.md | N/A | Requirement traceability | Project standard for tracking requirement completion |

### Supporting

None -- no code changes.

### Alternatives Considered

None -- the format and location are fixed by project convention.

## Architecture Patterns

### VERIFICATION.md Structure (from phases 55 and 57)

The established format includes:

1. **YAML frontmatter** with `status`, `phase`, and `verified` date
2. **Phase Goal** section
3. **Must-Haves Verification** with Truths table (# | Truth | Status | Evidence) and Artifacts table
4. **Key Links** table (From | To | Via | Status)
5. **Requirement Coverage** table (Req ID | Description | Status | Evidence)
6. **Success Criteria** table (Criterion | Status)
7. **Test Results** section
8. **Score** summary line

### Phase 54 VERIFICATION.md Structure

Phase 54 covers 12 requirements across two plans:
- Plan 01 (STREAM-01 through STREAM-06, STALL-01 through STALL-04, CLI-01, CLI-05) -- implementation
- Plan 02 (STREAM-02, STREAM-03, STALL-01, STALL-03, CLI-01, CLI-05) -- tests

Must-haves come from 54-01-PLAN.md frontmatter:
- 5 truths about function behavior
- 1 artifact (autopilot.mjs containing `function runClaudeStreaming`)
- 2 key links (runClaudeStreaming to displayStreamEvent, runClaudeStreaming to getConfig)

### Phase 56 VERIFICATION.md Structure

Phase 56 covers 1 requirement (CLI-03) with 1 plan:
- Plan 01 -- wired 3 debug retry sites through runClaudeStreaming()

Must-haves from 56-01-PLAN.md frontmatter:
- 4 truths about debug retry wiring
- 2 artifacts (autopilot.mjs modified, tests/autopilot.test.cjs modified)
- 1 key link (runClaudeStreaming called at all 3 debug retry sites)

### REQUIREMENTS.md Update Pattern

Each orphaned requirement changes from `- [ ] **REQ-ID**:` to `- [x] **REQ-ID**:`. The traceability table at the bottom also needs the Status column updated from "Pending" to "Verified".

### Anti-Patterns to Avoid
- **Fabricating line numbers:** Always verify actual line numbers against the current source before documenting evidence. The codebase has been modified across multiple phases.
- **Copying plan claims as evidence:** Verification must confirm against the actual codebase, not repeat what the plan said would happen.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verification format | Custom format | Copy 55-VERIFICATION.md structure | Consistency across all phases |
| Evidence gathering | Manual grep | Static analysis of autopilot.mjs source at specific line numbers | Reproducible evidence |

**Key insight:** The verification documents reference exact file paths and line numbers from the codebase. These must be accurate at the time of verification, not copied from plan documents (which reference historical line numbers).

## Common Pitfalls

### Pitfall 1: Stale Line Numbers
**What goes wrong:** Plan documents reference line numbers from before subsequent phases modified the file. Using plan line numbers in verification produces incorrect evidence.
**Why it happens:** Phase 55 and 56 modified autopilot.mjs after Phase 54 was written, shifting line numbers.
**How to avoid:** Always check current file content for accurate line numbers. The grep results from this research provide current locations.
**Warning signs:** Line numbers in verification differ significantly from plan documents.

### Pitfall 2: Incomplete REQUIREMENTS.md Update
**What goes wrong:** VERIFICATION.md is created but REQUIREMENTS.md checkboxes are not updated, leaving requirements appearing unchecked.
**Why it happens:** The success criteria require both artifacts, and REQUIREMENTS.md is easy to forget.
**How to avoid:** Update REQUIREMENTS.md as part of the same task, not as a separate step.
**Warning signs:** Audit would still report orphaned requirements.

### Pitfall 3: Missing Traceability Table Update
**What goes wrong:** The checkbox in the Streaming Core / Stall Detection / CLI sections is checked but the Traceability table at the bottom of REQUIREMENTS.md still shows "Pending".
**Why it happens:** REQUIREMENTS.md has two separate locations per requirement -- the checklist and the traceability table.
**How to avoid:** Update both locations for each requirement.
**Warning signs:** Re-running audit still finds gaps.

## Code Examples

### Current Evidence Locations (verified via grep/read)

**autopilot.mjs key lines:**
```
Line 34:   knownFlags includes 'quiet'
Line 56:   const QUIET = !!(argv.quiet)
Line 196:  function displayStreamEvent(event) {
Line 197:    if (event.type === 'assistant') {
Line 201:      process.stdout.write(block.text)
Line 204:  } else if (event.type === 'tool_use') {
Line 206:    process.stderr.write(`  diamond ${toolName}\n`)
Line 211:  async function runClaudeStreaming(prompt, { outputFile, quiet } = {})
Line 214:  claude -p ... --output-format json ... < /dev/null (quiet path)
Line 219:  const lines = []
Line 220:  const stallTimeout = getConfig('autopilot.stall_timeout_ms', 300000)
Line 224:  function armStallTimer() {
Line 226:    stallTimer = setTimeout(function onStall() {
Line 229:    process.stderr.write warning message
Line 230:    logMsg stall warning
Line 232:    setTimeout(onStall, stallTimeout) -- re-arm
Line 233:    stallTimer.unref()
Line 235:    stallTimer.unref()
Line 238:  --output-format stream-json ... < /dev/null (streaming path)
Line 239:  createInterface({ input: proc.stdout })
Line 243:  for await (const line of rl) {
Line 244:    lines.push(line)
Line 245:    armStallTimer() -- reset on every event
Line 246:    if (outputFile) fs.appendFileSync(outputFile, line + '\n')
Line 248:    const event = JSON.parse(line)
Line 249:    displayStreamEvent(event)
Line 255:  finally { if (stallTimer) clearTimeout(stallTimer) }
Line 260:  return { exitCode: result.exitCode, stdout: lines.join('\n') }
Line 348:  runStep -> runClaudeStreaming(prompt)
Line 536:  runStepCaptured -> runClaudeStreaming(prompt, { outputFile })
Line 597:  debug retry site 1 -> runClaudeStreaming(debugPrompt) with exitCode
Line 641:  debug retry site 2 -> runClaudeStreaming(debugPrompt)
Line 679:  debug retry site 3 -> runClaudeStreaming(debugPrompt)
```

**Test evidence (tests/autopilot.test.cjs):**
```
Line 127:  'there are exactly 2 claude -p shell invocations' (down from 5 after Phase 56)
Line 200-275: 10 streaming function static analysis tests covering:
  - runClaudeStreaming function exists
  - displayStreamEvent function exists
  - --quiet flag in knownFlags
  - QUIET constant defined
  - stall timer uses getConfig
  - streaming path uses stream-json
  - displayStreamEvent handles assistant events
  - displayStreamEvent handles tool_use events
  - stall timer uses unref
  - runClaudeStreaming returns exitCode and stdout
```

## State of the Art

Not applicable -- this is an internal documentation task, not a technology adoption phase.

## Open Questions

None -- all evidence locations are identified and verified. The requirements mapping is clear from the audit document.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/scripts/autopilot.mjs` -- actual codebase, grep-verified line numbers
- `tests/autopilot.test.cjs` -- actual test file with 18 passing tests
- `.planning/phases/55-step-function-integration/55-VERIFICATION.md` -- established format template
- `.planning/phases/57-config-schema-and-verification/57-VERIFICATION.md` -- established format template
- `.planning/v2.4-MILESTONE-AUDIT.md` -- audit identifying the 13 gaps
- `.planning/phases/54-core-streaming-function/54-01-PLAN.md` -- must-haves frontmatter for Phase 54
- `.planning/phases/54-core-streaming-function/54-01-SUMMARY.md` -- completion evidence for Phase 54
- `.planning/phases/54-core-streaming-function/54-02-SUMMARY.md` -- test evidence for Phase 54
- `.planning/phases/56-debug-retry-integration/56-01-PLAN.md` -- must-haves frontmatter for Phase 56
- `.planning/phases/56-debug-retry-integration/56-01-SUMMARY.md` -- completion evidence for Phase 56

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new technology; documentation only
- Architecture: HIGH - format established by phases 55 and 57; all evidence locations verified via grep
- Pitfalls: HIGH - known from prior gap closure phases and this audit

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- documentation format unlikely to change)
