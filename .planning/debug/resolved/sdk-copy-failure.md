---
status: resolved
trigger: "sdk-copy-failure: install.js --claude -g fails to copy @anthropic-ai/claude-agent-sdk to ~/.claude/get-shit-done/node_modules/"
created: 2026-03-24T15:00:00Z
updated: 2026-03-24T15:31:00Z
---

## Current Focus

hypothesis: CONFIRMED - SDK copied to wrong path
test: Ran full replace-vanilla.sh after fix
expecting: All verification checks pass
next_action: Await human verification

## Symptoms

expected: install.js copies node_modules/@anthropic-ai/claude-agent-sdk from source repo to ~/.claude/get-shit-done/node_modules/@anthropic-ai/claude-agent-sdk
actual: SDK directory missing after install. Verification reports "Missing: agent-sdk"
errors: "Missing: agent-sdk (/Users/seanspade/.claude/get-shit-done/node_modules/@anthropic-ai/claude-agent-sdk)" during verification
reproduction: Run bash bin/replace-vanilla.sh from source repo
started: Since SDK copy logic was added (commit 5b36ec6)

## Eliminated

## Evidence

- timestamp: 2026-03-24T15:10:00Z
  checked: getGlobalDir() return value for claude runtime
  found: Returns path.join(os.homedir(), '.claude') -- so targetDir = ~/.claude/
  implication: SDK dest at line 2103 resolves to ~/.claude/node_modules/@anthropic-ai/claude-agent-sdk

- timestamp: 2026-03-24T15:15:00Z
  checked: replace-vanilla.sh line 254 verification path
  found: Checks $GSD_DIR/node_modules/... which is ~/.claude/get-shit-done/node_modules/...
  implication: Mismatch between where install.js puts the SDK and where verification checks

- timestamp: 2026-03-24T15:18:00Z
  checked: Both locations on disk before fix
  found: SDK existed at ~/.claude/node_modules/ (from install.js) but also at ~/.claude/get-shit-done/node_modules/ (from manual cp)
  implication: install.js was putting it in wrong place; manual cp was the workaround

- timestamp: 2026-03-24T15:25:00Z
  checked: uninstall function for node_modules cleanup
  found: Uninstall does NOT remove targetDir/node_modules/ -- only removes get-shit-done/ dir
  implication: Legacy SDK at ~/.claude/node_modules/ would persist across uninstall/reinstall cycles

- timestamp: 2026-03-24T15:30:00Z
  checked: Full replace-vanilla.sh run after fix
  found: All verification checks pass. SDK at get-shit-done/node_modules/, legacy location cleaned up
  implication: Fix verified end-to-end

## Resolution

root_cause: install.js line 2103 computed sdkDest as path.join(targetDir, 'node_modules', ...) where targetDir = ~/.claude/. This put the SDK at ~/.claude/node_modules/ instead of ~/.claude/get-shit-done/node_modules/. The replace-vanilla.sh verification correctly checked ~/.claude/get-shit-done/node_modules/ and reported it missing.
fix: Changed sdkDest to path.join(targetDir, 'get-shit-done', 'node_modules', ...) and added legacy cleanup in uninstall to remove orphaned ~/.claude/node_modules/@anthropic-ai/claude-agent-sdk
verification: Ran full bash bin/replace-vanilla.sh -- all 10 verification checks pass including agent-sdk. Confirmed SDK exists at correct path, legacy location cleaned up.
files_changed:
  - bin/install.js (line 2103: SDK dest path, lines 1427-1447: legacy cleanup in uninstall)
