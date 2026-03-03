---
phase: quick-2
plan: 01
subsystem: config
tags: [npm, github, fork, identity, package-json]

requires: []
provides:
  - Fork package identity (get-more-shit-done-cc)
  - Fork GitHub URLs (skspade/get-more-shit-done)
  - Fork ownership in .github configs
affects: [publishing, ci, npm-registry]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - README.md
    - SECURITY.md
    - CHANGELOG.md
    - .github/CODEOWNERS
    - .github/FUNDING.yml
    - .github/ISSUE_TEMPLATE/bug_report.yml

key-decisions:
  - "Preserved upstream author credit (TACHES) in package.json"
  - "Preserved internal directory references (get-shit-done/) that refer to code paths, not package identity"
  - "Updated SECURITY.md to distinguish fork-specific vs upstream security reporting"

patterns-established: []

requirements-completed: [QUICK-2]

duration: 2min
completed: 2026-03-03
---

# Quick Task 2: Update Package.json and Related References Summary

**Renamed fork identity from get-shit-done-cc/glittercowboy to get-more-shit-done-cc/skspade across package.json, README, .github configs, SECURITY.md, and CHANGELOG.md**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T23:51:08Z
- **Completed:** 2026-03-03T23:54:03Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- package.json renamed to get-more-shit-done-cc with all GitHub URLs pointing to skspade/get-more-shit-done
- README.md updated with fork npm badges, install commands, clone URL, and star history
- .github configs (CODEOWNERS, FUNDING.yml, bug report template), SECURITY.md, and CHANGELOG.md all reference the fork

## Task Commits

Each task was committed atomically:

1. **Task 1: Update package.json and lockfile with fork identity** - `8bf8314` (chore)
2. **Task 2: Update README.md with fork references** - `b2c33a0` (chore)
3. **Task 3: Update .github configs, SECURITY.md, CHANGELOG.md, and bug report template** - `2c4d40a` (chore)

## Files Created/Modified
- `package.json` - Renamed package, updated bin entry and all GitHub URLs
- `package-lock.json` - Regenerated with new package name
- `README.md` - Updated npm badges, install commands, clone URL, star history URLs
- `.github/CODEOWNERS` - Changed owner to @skspade
- `.github/FUNDING.yml` - Changed to skspade
- `.github/ISSUE_TEMPLATE/bug_report.yml` - Updated version check command to fork package
- `SECURITY.md` - Added fork maintainer contact, distinguished from upstream reporting
- `CHANGELOG.md` - Updated all GitHub release URLs to fork repo

## Decisions Made
- Preserved upstream author field ("TACHES") in package.json to credit the original project
- Preserved all internal `get-shit-done/` directory path references (bin paths, files array, test coverage) since those refer to code structure, not package identity
- Updated SECURITY.md to separate fork-specific issues (@skspade) from upstream issues (security@gsd.build)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failure in `config-get command > gets a top-level value` (expects 'balanced' profile but local config has 'quality'). This failure exists before and after our changes -- unrelated to fork identity updates.

## User Setup Required

None - no external service configuration required.

## Next Steps
- Fork is now independently identifiable for npm publishing
- CI/CD workflows may need updating if they reference upstream repo URLs

## Self-Check: PASSED

- All 8 modified files verified present on disk
- All 3 task commits verified in git history (8bf8314, b2c33a0, 2c4d40a)

---
*Quick Task: 2-update-package-json-and-related-referenc*
*Completed: 2026-03-03*
