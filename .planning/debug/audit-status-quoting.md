---
status: awaiting_human_verify
trigger: "The autopilot milestone audit loop fails because the audit result status has extra quotes around it"
created: 2026-03-03T00:00:00Z
updated: 2026-03-03T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: After fix, `gsd-tools frontmatter get ... --field status --raw` outputs `gaps_found` (no quotes)
expecting: Autopilot case statement will now match `gaps_found` correctly
next_action: Awaiting human verification that autopilot runs correctly end-to-end

## Symptoms

expected: The autopilot should recognize "gaps_found" as a valid audit status and handle it
actual: The autopilot reports `ERROR: Unknown audit status '"gaps_found"'` and exits with an error
errors: |
  - WARNING: No progress detected (1/3 consecutive)
  - Audit result: "gaps_found"
  - ERROR: Unknown audit status '"gaps_found"'
  - ERROR: Milestone audit encountered an error
reproduction: Run the autopilot script with milestone-audit phase
started: Current session

## Eliminated

## Evidence

- timestamp: 2026-03-03T00:01:00Z
  checked: autopilot.sh line 251 and 265-291
  found: audit_status is set via `gsd_tools frontmatter get "$audit_file" --field status --raw` then compared in a case statement against bare words (passed, gaps_found, tech_debt)
  implication: The value must be a bare string without quotes to match

- timestamp: 2026-03-03T00:02:00Z
  checked: frontmatter.cjs cmdFrontmatterGet line 242
  found: `output({ [field]: value }, raw, JSON.stringify(value))` - the rawValue argument is JSON.stringify(value), which for a string "gaps_found" produces `"gaps_found"` with literal quote characters
  implication: This is the root cause - JSON.stringify wraps strings in quotes

- timestamp: 2026-03-03T00:03:00Z
  checked: core.cjs output() function lines 34-36
  found: When raw=true and rawValue is defined, it does `process.stdout.write(String(rawValue))` - it outputs rawValue verbatim
  implication: The quotes from JSON.stringify pass through directly to stdout

- timestamp: 2026-03-03T00:04:00Z
  checked: Direct reproduction test of `gsd-tools frontmatter get ... --field status --raw`
  found: Output is literally `"gaps_found"` with quote characters confirmed
  implication: Bug confirmed end-to-end

## Resolution

root_cause: In frontmatter.cjs cmdFrontmatterGet (line 242), the rawValue passed to output() is JSON.stringify(value). For string values, JSON.stringify adds enclosing double-quote characters. The autopilot case statement expects bare strings (gaps_found, passed, tech_debt) but receives quoted strings ("gaps_found").
fix: Change the rawValue from JSON.stringify(value) to String(value) for string values, keeping JSON.stringify for non-string types (objects, arrays) so they remain valid output
verification: Self-verified - `gsd-tools frontmatter get ... --field status --raw` now outputs `gaps_found` without quotes. Non-raw mode, object fields, and other string fields all work correctly. Awaiting human verification of full autopilot run.
files_changed: [get-shit-done/bin/lib/frontmatter.cjs]
