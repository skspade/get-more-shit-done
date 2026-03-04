---
quick_task: 5
type: execute
description: "Replace the GSDC CLI alias with GMSD"
files_modified:
  - package.json
autonomous: true
---

<objective>
Rename the `gsdc` CLI bin alias to `gmsd` in package.json to match the fork's identity (get-more-shit-done).

Purpose: The `gsdc` alias is a leftover from the upstream `get-shit-done-claude` package. The fork should use `gmsd` as its short alias alongside the existing `gsd` command.
Output: Updated package.json with `gmsd` alias replacing `gsdc`.
</objective>

<context>
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename gsdc bin alias to gmsd in package.json</name>
  <files>package.json</files>
  <action>
In package.json, under the "bin" object, rename the key "gsdc" to "gmsd". The value stays the same: "get-shit-done/bin/gsd-cli.cjs".

Before:
```json
"bin": {
  "get-more-shit-done-cc": "bin/install.js",
  "gsd": "get-shit-done/bin/gsd-cli.cjs",
  "gsdc": "get-shit-done/bin/gsd-cli.cjs"
},
```

After:
```json
"bin": {
  "get-more-shit-done-cc": "bin/install.js",
  "gsd": "get-shit-done/bin/gsd-cli.cjs",
  "gmsd": "get-shit-done/bin/gsd-cli.cjs"
},
```

Then run `npm install` to update the local symlink so `gmsd` is available as a command.
  </action>
  <verify>
    <automated>node -e "const pkg = require('./package.json'); if (!pkg.bin.gmsd) { process.exit(1); } if (pkg.bin.gsdc) { process.exit(1); } console.log('OK: gmsd alias present, gsdc removed');"</automated>
  </verify>
  <done>package.json has "gmsd" bin entry pointing to gsd-cli.cjs, "gsdc" entry is removed, package-lock.json updated</done>
</task>

</tasks>

<verification>
- `node -e "const pkg = require('./package.json'); console.log(Object.keys(pkg.bin));"` shows `get-more-shit-done-cc`, `gsd`, `gmsd` (no `gsdc`)
- `npx gmsd --help` runs without error
</verification>

<success_criteria>
The `gsdc` CLI alias no longer exists in package.json. The `gmsd` alias is registered and functional.
</success_criteria>
