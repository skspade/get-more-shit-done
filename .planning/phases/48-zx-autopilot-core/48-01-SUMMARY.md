---
phase: 48
plan: "01"
title: "Script Scaffold: Arguments, Prerequisites, Logging, Signals"
status: complete
started: "2026-03-10"
completed: "2026-03-10"
requirements-completed: [REQ-09, REQ-17]
---

# Plan 48-01: Script Scaffold

## What Was Built

Created `get-shit-done/scripts/autopilot.mjs` with the foundation layer:

1. **Shebang + imports** — `#!/usr/bin/env zx` with CJS imports via `createRequire`
2. **Argument parsing** — `--from-phase`, `--project-dir`, `--dry-run` via zx's argv; unknown args produce usage error + exit 1
3. **Prerequisites** — Checks for claude, node (not jq), `.planning/` dir, gsd-tools.cjs
4. **Logging** — `logMsg()` writes `[HH:MM:SS] MESSAGE` format to `.planning/logs/autopilot-YYYYMMDD-HHMMSS.log`; session header matches bash field-for-field
5. **Signal handling** — SIGINT exits 130, SIGTERM exits 0; both print resume instructions referencing autopilot.sh

## Key Files

- `get-shit-done/scripts/autopilot.mjs` (CREATED, 409 lines)
- `get-shit-done/bin/lib/phase.cjs` (MODIFIED — exported `computePhaseStatus`)

## Commits

- `12dbbc0` feat(48): implement zx autopilot core script

## Self-Check

- [x] autopilot.mjs exists with #!/usr/bin/env zx shebang
- [x] CJS modules imported via createRequire without errors
- [x] argv parsed for --from-phase, --project-dir, --dry-run
- [x] Unknown args produce usage error and exit 1
- [x] Prerequisites check for claude, node, .planning/, gsd-tools.cjs
- [x] Log file format matches autopilot.sh
- [x] SIGINT/SIGTERM handlers registered
