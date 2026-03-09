<purpose>
Run a PR review workflow that captures findings from a fresh toolkit review or ingests a pre-existing review summary, then extracts structured findings for downstream deduplication, scoring, and routing.

- Parses arguments for mode flags (--ingest, --quick, --milestone, --full) and review aspect args
- Captures review output via fresh toolkit invocation or user-pasted ingest
- Parses raw review into structured findings with severity, agent, file, line, and fix suggestion
- Exits cleanly when no actionable issues are found
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

**Step 1: Parse arguments**

Parse `$ARGUMENTS` for:
- `--ingest` flag -> `$INGEST_MODE` (true/false)
- `--quick` flag -> `$FORCE_QUICK` (true/false)
- `--milestone` flag -> `$FORCE_MILESTONE` (true/false)
- `--full` flag -> `$FULL_MODE` (true/false)
- Remaining tokens (not flags) -> `$REVIEW_ASPECTS` (array of aspect strings, e.g., ["security", "performance"])

**If both `--quick` and `--milestone` are present:** Error — "Cannot use both --quick and --milestone flags."

Store results:
- `$INGEST_MODE` — boolean
- `$FORCE_QUICK` — boolean
- `$FORCE_MILESTONE` — boolean
- `$FULL_MODE` — boolean
- `$REVIEW_ASPECTS` — array of aspect strings

---

**Step 2: Capture review**

**Fresh mode** (when `$INGEST_MODE` is false):

Invoke `/pr-review-toolkit:review-pr` via the Skill tool, passing `$REVIEW_ASPECTS` as aspect arguments. If `$FULL_MODE` is true, pass `--full` to the toolkit as well.

Capture the aggregated output as `$RAW_REVIEW`.

**Ingest mode** (when `$INGEST_MODE` is true):

```
AskUserQuestion(
  header: "PR Review Ingest",
  question: "Paste or provide the PR review summary:",
  followUp: null
)
```

Store the user's response as `$RAW_REVIEW`.

---

**Step 3: Parse findings**

Parse `$RAW_REVIEW` into a structured findings array. Track the current severity section as you scan through the review output.

**Severity mapping from section headers:**
- `## Critical Issues` -> severity: "critical"
- `## Important Issues` -> severity: "important"
- `## Suggestions` -> severity: "suggestion"

**For each finding within a severity section, extract:**
- `severity`: From the current section header (mapped above)
- `agent`: Extract from `[agent-name]:` prefix pattern at the start of the finding text. If no agent prefix, set to null.
- `description`: The finding text content (after agent prefix, before file reference)
- `file`: Extract from file path reference patterns like `path/to/file.ext:123` or `[path/to/file.ext:123]`. Set to null if no file reference found.
- `line`: Extract the line number from the file reference. Set to null if no line number found.
- `fix_suggestion`: Extract suggested fix text if present (often after "Fix:" or "Suggestion:" prefix within the finding). Set to null if no fix suggestion found.

**Result:** `$FINDINGS` — array of structured finding objects:
```
{
  severity: "critical" | "important" | "suggestion",
  agent: string | null,
  description: string,
  file: string | null,
  line: number | null,
  fix_suggestion: string | null
}
```

**If `$FINDINGS` is empty (no findings parsed):**

Display: "No actionable issues found."

Exit the workflow cleanly. This is a success condition — the review ran but found nothing to act on.

---

**Steps 4-11: Deduplication, Persistence, Scoring, and Routing**

(Implemented in Phases 41-43)

</process>
