# Phase 79: Analysis Agent - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Auto-generated (autopilot mode)

<domain>
## Phase Boundary

The agent accurately identifies test coverage gaps, stale tests, missing test files, and consolidation opportunities scoped to the current diff. This phase delivers the `gsd-test-reviewer.md` agent definition file with its 6-step diff-aware analysis process, structured markdown report output, and read-only constraint enforcement. The command orchestrator (Phase 78) already spawns this agent via Task() and passes the `<test-review-input>` XML block.

</domain>

<decisions>
## Implementation Decisions

### Agent File Structure
- Agent file at `agents/gsd-test-reviewer.md` following the `gsd-test-steward.md` pattern (from ARCHITECTURE.md)
- Agent frontmatter: `name: gsd-test-reviewer`, `description: Analyzes branch diff for test coverage gaps, stale tests, and consolidation opportunities. Read-only analysis agent spawned by test-review command.`, tools `Read, Bash, Grep, Glob` (from ARCHITECTURE.md — no Write tool, agent is read-only)
- Agent receives `<test-review-input>` XML block from the command containing diff/stat, changed files, test count, test config, test file list (from Phase 78 command implementation)

### Source-to-Test Mapping
- Agent maps changed source files to test files using naming conventions (`foo.ts` -> `foo.test.ts`, `foo.spec.ts`) AND import tracing via Grep on test file `require`/`import` statements (from REQUIREMENTS.md AGT-01 — "not naming alone")
- Agent uses Grep tool to search test files for import/require references to changed source modules (Claude's Decision: import tracing is the most reliable second signal beyond naming — matches how the test steward traces source references in staleness detection)

### Coverage Gap Detection
- For each changed source file, agent checks for corresponding test file existence via naming conventions and import tracing (from REQUIREMENTS.md AGT-03)
- For new/modified exported functions (detected from diff hunks showing `export` or `module.exports`), agent checks whether test assertions exist for those exports (from REQUIREMENTS.md AGT-02)
- Agent uses Grep on related test files to verify function-level coverage, not just file-level (Claude's Decision: file-level alone would miss new exports added to existing tested files)

### Staleness Detection
- Agent checks test files related to the diff for references to renamed/removed functions by cross-referencing diff deletions with test assertions (from REQUIREMENTS.md AGT-04)
- Agent parses diff hunks for removed function definitions and searches related test files for references to those function names (Claude's Decision: diff-scoped approach keeps analysis focused on the PR rather than full-suite scanning like the steward does)

### Consolidation Analysis
- Agent identifies consolidation opportunities using the four strategy vocabulary: prune, parameterize, promote, merge (from REQUIREMENTS.md AGT-05, shared vocabulary with test steward)
- Consolidation scope limited to test files related to the diff, not the full test suite (from REQUIREMENTS.md AGT-05 — "scoped to test files related to the diff")
- Strategy definitions duplicated in the agent prompt, not shared with test steward (from ARCHITECTURE.md Anti-Pattern 1 — agents are self-contained prompt files)

### Report Format
- Agent produces structured markdown report with summary stats, categorized sections (Missing Test Coverage, Stale Tests, Consolidation Opportunities), and priority-ordered recommended actions (from REQUIREMENTS.md AGT-06)
- Report includes current test count, budget status (OK/Warning/Over Budget), and estimated impact of recommendations on test count (from REQUIREMENTS.md AGT-08)
- Report summary stats must be parseable by downstream routing in Phase 80 — counts of gaps, stale tests, and consolidation items (from success criteria 5)

### Read-Only Constraint
- Agent NEVER modifies source files, test files, or creates new tests (from REQUIREMENTS.md AGT-07)
- Agent tools limited to Read, Bash, Grep, Glob — no Write or Edit tools (from ARCHITECTURE.md)
- Agent prompt includes explicit constraint section like test steward's "CRITICAL CONSTRAINT" block (Claude's Decision: matches the proven pattern from gsd-test-steward.md that enforces read-only behavior)

### Process Steps
- 6-step process matching the design doc: (1) Parse Diff, (2) Coverage Gap Analysis, (3) Staleness Detection, (4) Consolidation Analysis, (5) Generate Recommendations, (6) Compile Report (from design doc agent definition)
- Step 1 parses the `<test-review-input>` XML and categorizes changed files as new/modified/deleted (Claude's Decision: categorization drives which downstream checks apply — new files need coverage gaps, deleted files trigger staleness)
- Large diff mode: when input contains stat summary instead of full diff, agent uses Read/Grep tools to inspect specific files rather than relying on inline diff content (from Phase 78 size gate behavior)

### Claude's Discretion
- Internal reasoning flow within each analysis step
- Exact confidence thresholds for flagging borderline findings
- Priority ordering heuristic for recommended actions
- Exact wording of report section headers and finding descriptions
- How deeply to trace import chains (direct imports vs transitive)

</decisions>

<specifics>
## Specific Ideas

- The agent shares consolidation strategy vocabulary (prune/parameterize/promote/merge) with the test steward but must carry its own definitions in its prompt — no shared code between agent prompt files (from ARCHITECTURE.md Anti-Pattern 1)
- The agent's output IS the report — the command writes it directly to disk without restructuring (from Phase 78 CONTEXT.md report persistence decision)
- Budget status calculation uses same thresholds as test steward: OK (<80%), Warning (80-99%), Over Budget (>=100%) against the project budget from test config
- Test file discovery patterns: `**/*.{test,spec}.{js,ts,cjs,mjs}` excluding `node_modules`, `.git`, `.planning`, `dist`, `build`, `coverage`, `e2e/` directories (from test steward process and E2E budget exclusion)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-test-steward.md`: Template for agent structure — read-only constraint block, input XML parsing, structured report output, strategy definitions. The test reviewer follows the same pattern but scoped to diff instead of full suite.
- `audit-tests.md`: Template for how the command spawns the agent — the Phase 78 command already follows this pattern.
- `testing.cjs` functions (`findTestFiles`, `countTestsInProject`, `getTestConfig`): Data already gathered by the command and passed in the XML input block. Agent does not call these directly.

### Established Patterns
- Read-only agent pattern: `gsd-test-steward.md` establishes tools (Read, Bash, Grep, Glob), explicit constraint block, structured markdown return with `## STEWARD COMPLETE` header. The reviewer should use a similar `## REVIEWER COMPLETE` structured return.
- XML input block pattern: Command passes `<test-review-input>` with diff, changed files, test count, test config, test file list. Agent parses this as its primary input.
- Strategy vocabulary: prune (delete stale), parameterize (combine similar), promote (keep integration, remove redundant units), merge (consolidate files). Duplicated in agent prompt per ARCHITECTURE.md guidance.

### Integration Points
- Phase 78 command (`test-review.md`): Spawns this agent via `Task()` and passes `<test-review-input>` XML. Agent's return text is written directly as the report file.
- Phase 80 routing: Downstream routing will parse the agent's summary stats to determine whether recommendations exist (zero findings = skip routing). Report must include parseable summary counts.
- `.planning/reviews/` directory: Agent's output lands here as `YYYY-MM-DD-test-review.md` (written by the command, not the agent).

</code_context>

<deferred>
## Deferred Ideas

- User-choice routing (quick task / milestone / done) after report display — Phase 80
- Documentation updates (help.md, USER-GUIDE.md, README.md) — Phase 81
- Auto-run test-review during milestone audit — post-v2.9 (from REQUIREMENTS.md future requirements INT-01)
- Custom source-to-test file mapping configuration — post-v2.9 (from REQUIREMENTS.md future requirements INT-02)
- Budget impact projection showing estimated count after applying recommendations — post-v2.9 (from REQUIREMENTS.md future requirements INT-03)

</deferred>

---

*Phase: 79-analysis-agent*
*Context gathered: 2026-03-21 via auto-context*
