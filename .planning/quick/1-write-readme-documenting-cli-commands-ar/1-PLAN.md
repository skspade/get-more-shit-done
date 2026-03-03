---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/CLI.md
autonomous: true
requirements: ["QUICK-1"]
must_haves:
  truths:
    - "User can find complete documentation for all 5 gsd CLI commands"
    - "User can see exact usage syntax, flags, and examples for each command"
    - "User can understand output formats (rich, plain, JSON) from the docs"
  artifacts:
    - path: "docs/CLI.md"
      provides: "Complete CLI reference documentation"
      min_lines: 150
  key_links:
    - from: "docs/CLI.md"
      to: "README.md"
      via: "Cross-reference link"
      pattern: "CLI\\.md|CLI Reference"
---

<objective>
Create comprehensive CLI reference documentation for the `gsd` standalone command-line tool.

Purpose: Users who install GSD via npm need a reference for the `gsd` CLI commands (progress, todos, health, settings, help) that are available outside of Claude Code / runtime commands. Currently no CLI-specific documentation exists.

Output: `docs/CLI.md` — a complete CLI reference with usage, arguments, flags, output examples, and cross-links to existing docs.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/bin/gsd-cli.cjs
@get-shit-done/bin/lib/cli.cjs
@docs/USER-GUIDE.md
@README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CLI reference documentation</name>
  <files>docs/CLI.md</files>
  <action>
Create `docs/CLI.md` documenting the `gsd` standalone CLI. Source all information directly from the code in `get-shit-done/bin/lib/cli.cjs` (specifically the COMMANDS registry and COMMAND_DETAILS object). The document should include:

1. **Header** — Title "GSD CLI Reference", brief intro explaining this is the standalone CLI available after npm install, distinct from the `/gsd:*` runtime commands used inside Claude Code/OpenCode/Gemini/Codex.

2. **Installation** — How to access the CLI: `npx get-shit-done-cc@latest` installs it, then `gsd` is available as a binary (from package.json `"bin": { "gsd": "get-shit-done/bin/gsd-cli.cjs" }`). Note it requires a `.planning/` directory in or above the current working directory (except for `help`).

3. **Global Options** — Document the two output format flags available on all commands:
   - `--json` — Output as structured JSON (useful for scripting/piping)
   - `--plain` — Output as plain text with ANSI color codes stripped
   - Default is rich mode with ANSI colors

4. **Commands** — For each of the 5 commands, document in this order:

   **gsd progress**
   - Usage: `gsd progress [--json] [--plain]`
   - Description: Shows milestone progress including milestone name/version/status, phase list with completion indicators, plan counts, progress bar, and suggested next action.
   - Output fields (for --json): milestone (name, version, status), phases (number, name, status_indicator, plan_counts), progress (percent, completed_plans, total_plans, bar), current_position, next_action
   - Example output (rich mode): Show the ANSI-formatted output structure with phases listed with status icons (checkmark for complete, triangle for in-progress, circle for planned, dash for not started)

   **gsd todos**
   - Usage: `gsd todos [<id>] [--area=<area>] [--json] [--plain]`
   - Two modes: list mode (default) and detail mode (when ID provided)
   - List mode: Shows count and list of pending todos with ID, area tag, and title
   - Detail mode: Shows full todo including ID, area, created date, file path, and body content
   - `--area=<area>` flag filters todos by area (e.g., `--area=bugfix`)
   - Examples: `gsd todos`, `gsd todos fix-login-bug`, `gsd todos --area=bugfix`

   **gsd health**
   - Usage: `gsd health [--json] [--plain]`
   - Description: Validates `.planning/` directory integrity
   - Checks performed: Required files (.planning/, PROJECT.md, ROADMAP.md, STATE.md, config.json, phases/), config.json validity (JSON parse, valid model_profile, known keys), state consistency (phase references match disk, STATE vs ROADMAP sync)
   - Status levels: healthy (no issues), degraded (warnings only), broken (errors present)
   - Error codes: E001-E005 for errors, W001-W005 for warnings, I001 for info
   - Example output showing the file check list with pass/fail icons

   **gsd settings**
   - Usage: `gsd settings [set <key> <value>] [--json] [--plain]`
   - Two modes: view mode (default, lists all settings from config.json) and set mode
   - View mode: Displays all config.json settings in dot-notation key=value format
   - Set mode: `gsd settings set <key> <value>` — updates a config value with validation
   - Dot notation for nested keys: `gsd settings set workflow.research false`
   - Validation rules: model_profile must be quality/balanced/budget, branching_strategy must be none/phase/milestone, workflow.* keys must be boolean, autopilot.circuit_breaker_threshold must be positive integer
   - Examples: `gsd settings`, `gsd settings set model_profile quality`, `gsd settings set workflow.research false`

   **gsd help**
   - Usage: `gsd help [<command>]`
   - Two modes: overview (lists all commands) and detail (shows specific command usage, flags, examples)
   - Examples: `gsd help`, `gsd help progress`

5. **Project Root Discovery** — Explain that the CLI walks up from the current directory looking for a `.planning/` directory. If not found, it exits with an error. The `help` command is the exception and works without a project root.

6. **Output Formats** section with brief comparison:
   - Rich (default): ANSI colors, icons, formatted layout
   - Plain: Same layout, colors stripped — good for log files
   - JSON: Structured data — good for scripting, piping to jq

7. **Cross-references** — Link to README.md for `/gsd:*` runtime commands, link to docs/USER-GUIDE.md for configuration reference.

Style: Match the tone and formatting conventions of the existing README.md and USER-GUIDE.md. Use fenced code blocks for examples. No badges or images. Keep it reference-oriented (not tutorial).
  </action>
  <verify>
    <automated>test -f docs/CLI.md && wc -l docs/CLI.md | awk '{if ($1 >= 150) print "PASS: " $1 " lines"; else print "FAIL: only " $1 " lines"}'</automated>
  </verify>
  <done>docs/CLI.md exists with complete documentation for all 5 CLI commands including usage syntax, arguments, flags, output format details, examples, and cross-references to existing docs</done>
</task>

<task type="auto">
  <name>Task 2: Add CLI reference link to existing docs</name>
  <files>README.md, docs/USER-GUIDE.md</files>
  <action>
Add a cross-reference to the new CLI docs from existing documentation:

1. In `README.md`, in the Commands section, add a subsection or note after the "Utilities" table that mentions the standalone CLI:
   ```
   ### Standalone CLI

   GSD also provides a standalone `gsd` command for use outside of Claude Code sessions. See the [CLI Reference](docs/CLI.md) for full documentation.

   ```bash
   gsd progress    # Show milestone progress
   gsd todos       # List pending todos
   gsd health      # Validate project integrity
   gsd settings    # View/update configuration
   gsd help        # Show available commands
   ```
   ```

2. In `docs/USER-GUIDE.md`, add a brief mention in the Table of Contents and a short section linking to the CLI reference:
   - Add `- [CLI Reference](CLI.md)` to the Table of Contents
   - Add a brief section: "## CLI Reference\n\nThe `gsd` standalone CLI provides commands for checking progress, managing todos, validating project health, and configuring settings from any terminal. See [CLI.md](CLI.md) for the full reference."

Keep changes minimal. Do not reorganize or reformat existing content.
  </action>
  <verify>
    <automated>grep -c "CLI.md" README.md docs/USER-GUIDE.md | grep -v ':0$' | wc -l | awk '{if ($1 >= 2) print "PASS: CLI.md referenced in both files"; else print "FAIL: missing references"}'</automated>
  </verify>
  <done>README.md and USER-GUIDE.md both contain links to the new docs/CLI.md reference</done>
</task>

</tasks>

<verification>
- docs/CLI.md exists and documents all 5 commands (progress, todos, health, settings, help)
- Each command has usage syntax, description, flags, and examples
- README.md links to docs/CLI.md
- docs/USER-GUIDE.md links to CLI.md
- No broken cross-references between documents
</verification>

<success_criteria>
- Complete CLI reference documentation exists at docs/CLI.md
- All 5 gsd CLI commands are documented with usage, arguments, flags, and examples
- Output format options (--json, --plain, rich default) are explained
- Existing docs cross-reference the new CLI reference
</success_criteria>

<output>
After completion, create `.planning/quick/1-write-readme-documenting-cli-commands-ar/1-SUMMARY.md`
</output>
