---
created: "2026-03-04T15:22:37.566Z"
title: Replace update command to use fork npm package
area: tooling
files:
  - get-shit-done/workflows/update.md
  - bin/replace-vanilla.sh
  - package.json
---

## Problem

The `/gsd:update` command (`update.md` workflow) checks npm for `get-shit-done-cc` (the upstream package) and installs from there. Since this is a fork (`get-more-shit-done-cc`), running `/gsd:update` overwrites the fork with vanilla GSD, requiring a manual `npm run install-fork` to restore.

This happened during a session — the update pulled upstream v1.22.4 over the fork's v1.22.1, wiping fork-specific changes until `bin/replace-vanilla.sh` was re-run.

## Solution

Options to consider:
1. **Update `update.md` workflow** to detect the FORK marker file (`get-shit-done/FORK`) and use the fork's npm package name (`get-more-shit-done-cc`) instead of `get-shit-done-cc`
2. **Replace the npm check entirely** — since the fork is installed from a local repo via `bin/replace-vanilla.sh`, the update flow should `git pull` the fork repo and re-run `npm run install-fork` instead of using npx
3. **Add a config key** in `config.json` for the package name, defaulting to `get-shit-done-cc` but overridable by forks
