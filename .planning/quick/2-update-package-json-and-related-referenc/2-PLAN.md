---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - README.md
  - SECURITY.md
  - CHANGELOG.md
  - .github/CODEOWNERS
  - .github/FUNDING.yml
  - .github/ISSUE_TEMPLATE/bug_report.yml
autonomous: true
requirements: ["QUICK-2"]

must_haves:
  truths:
    - "package.json identifies this as the get-more-shit-done fork by skspade"
    - "README install commands reference the fork npm package and GitHub repo"
    - "GitHub config files (.github/) reference skspade instead of glittercowboy"
  artifacts:
    - path: "package.json"
      provides: "Fork package identity"
      contains: "get-more-shit-done-cc"
    - path: "README.md"
      provides: "Updated install instructions and badges"
      contains: "skspade/get-more-shit-done"
    - path: ".github/CODEOWNERS"
      provides: "Fork owner"
      contains: "@skspade"
  key_links: []
---

<objective>
Rename fork identity in package.json and all external-facing references from
upstream (get-shit-done-cc / glittercowboy/get-shit-done) to fork
(get-more-shit-done-cc / skspade/get-more-shit-done).

Purpose: Establish this as a distinct fork with its own npm package name, GitHub
URLs, and ownership metadata so it can be published and used independently.

Output: Updated package.json, README.md, .github/ configs, and SECURITY.md with
fork identity.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@package.json
@README.md
@.github/CODEOWNERS
@.github/FUNDING.yml
@.github/ISSUE_TEMPLATE/bug_report.yml
@SECURITY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update package.json and lockfile with fork identity</name>
  <files>package.json, package-lock.json</files>
  <action>
In package.json, make these specific changes:

1. "name": "get-shit-done-cc" -> "get-more-shit-done-cc"
2. "bin"."get-shit-done-cc" -> "get-more-shit-done-cc" (keep the same value "bin/install.js")
3. "repository"."url" -> "git+https://github.com/skspade/get-more-shit-done.git"
4. "homepage" -> "https://github.com/skspade/get-more-shit-done"
5. "bugs"."url" -> "https://github.com/skspade/get-more-shit-done/issues"

DO NOT change:
- "bin"."gsd" and "bin"."gsdc" entries (they point to get-shit-done/bin/gsd-cli.cjs which is the internal directory name, not a package identity reference)
- "files" array entry "get-shit-done" (same reason - internal directory)
- "test:coverage" script (references internal directory path)
- "author" field (keep "TACHES" to credit upstream)

After editing package.json, run `npm install --package-lock-only` to regenerate package-lock.json with the new name.
  </action>
  <verify>
    <automated>node -e "const p = require('./package.json'); const assert = require('assert'); assert.strictEqual(p.name, 'get-more-shit-done-cc'); assert(p.bin['get-more-shit-done-cc']); assert(p.repository.url.includes('skspade/get-more-shit-done')); assert(p.homepage.includes('skspade/get-more-shit-done')); assert(p.bugs.url.includes('skspade/get-more-shit-done')); console.log('PASS');"</automated>
  </verify>
  <done>package.json name is "get-more-shit-done-cc", all GitHub URLs point to skspade/get-more-shit-done, bin entry renamed, lockfile regenerated</done>
</task>

<task type="auto">
  <name>Task 2: Update README.md with fork references</name>
  <files>README.md</files>
  <action>
In README.md, perform these replacements:

1. All npm badge/link URLs: "get-shit-done-cc" -> "get-more-shit-done-cc"
2. All GitHub badge/link URLs: "glittercowboy/get-shit-done" -> "skspade/get-more-shit-done"
3. All `npx get-shit-done-cc` install commands -> `npx get-more-shit-done-cc`
4. All `npm list -g get-shit-done-cc` references -> `npm list -g get-more-shit-done-cc`
5. Clone URL: "git clone https://github.com/glittercowboy/get-shit-done.git" -> "git clone https://github.com/skspade/get-more-shit-done.git"
6. Clone cd: "cd get-shit-done" -> "cd get-more-shit-done"
7. Star history URLs: "glittercowboy/get-shit-done" -> "skspade/get-more-shit-done"

DO NOT change any references to the internal `get-shit-done/` directory path (e.g., workflow file paths like `get-shit-done/workflows/...`).
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const r = fs.readFileSync('README.md','utf8'); const assert = require('assert'); assert(!r.includes('glittercowboy'), 'Still has glittercowboy'); assert(!r.includes('npx get-shit-done-cc'), 'Still has old npx command'); assert(r.includes('npx get-more-shit-done-cc'), 'Missing new npx command'); assert(r.includes('skspade/get-more-shit-done'), 'Missing new GitHub URL'); console.log('PASS');"</automated>
  </verify>
  <done>README.md references the fork for all npm commands, badges, GitHub URLs, and clone instructions. No upstream identity references remain in user-facing content.</done>
</task>

<task type="auto">
  <name>Task 3: Update .github configs, SECURITY.md, CHANGELOG.md, and bug report template</name>
  <files>.github/CODEOWNERS, .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.yml, SECURITY.md, CHANGELOG.md</files>
  <action>
1. .github/CODEOWNERS: Change "* @glittercowboy" to "* @skspade"

2. .github/FUNDING.yml: Change "github: glittercowboy" to "github: skspade"

3. .github/ISSUE_TEMPLATE/bug_report.yml: Change the version check description
   "Run: npm list -g get-shit-done-cc" -> "Run: npm list -g get-more-shit-done-cc"

4. SECURITY.md: Replace "@glittercowboy" contact reference with "@skspade".
   Keep the security@gsd.build email as-is (that belongs to the upstream project
   and users should still be able to report upstream vulnerabilities there).
   Add a note that this is a fork and security issues specific to the fork
   should be reported to the fork maintainer.

5. CHANGELOG.md: Update any GitHub URLs from "glittercowboy/get-shit-done" to
   "skspade/get-more-shit-done" so changelog links point to the fork.
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const assert = require('assert'); const co = fs.readFileSync('.github/CODEOWNERS','utf8'); assert(co.includes('@skspade'), 'CODEOWNERS missing @skspade'); const fu = fs.readFileSync('.github/FUNDING.yml','utf8'); assert(fu.includes('skspade'), 'FUNDING missing skspade'); const br = fs.readFileSync('.github/ISSUE_TEMPLATE/bug_report.yml','utf8'); assert(br.includes('get-more-shit-done-cc'), 'Bug report missing new name'); const se = fs.readFileSync('SECURITY.md','utf8'); assert(se.includes('skspade'), 'SECURITY missing skspade'); console.log('PASS');"</automated>
  </verify>
  <done>.github/CODEOWNERS owned by @skspade, FUNDING.yml points to skspade, bug report template references fork package name, SECURITY.md updated with fork maintainer info, CHANGELOG.md URLs updated</done>
</task>

</tasks>

<verification>
All three tasks pass their automated verify checks. Run the full suite:

```bash
node -e "
const fs = require('fs');
const assert = require('assert');

// package.json
const p = JSON.parse(fs.readFileSync('package.json','utf8'));
assert.strictEqual(p.name, 'get-more-shit-done-cc');
assert(p.bin['get-more-shit-done-cc']);
assert(p.repository.url.includes('skspade/get-more-shit-done'));

// README
const r = fs.readFileSync('README.md','utf8');
assert(!r.includes('glittercowboy'));
assert(r.includes('npx get-more-shit-done-cc'));

// .github files
assert(fs.readFileSync('.github/CODEOWNERS','utf8').includes('@skspade'));
assert(fs.readFileSync('.github/FUNDING.yml','utf8').includes('skspade'));

// Internal paths still intact
assert(p.bin.gsd === 'get-shit-done/bin/gsd-cli.cjs', 'Internal gsd bin path should be unchanged');
assert(p.files.includes('get-shit-done'), 'Internal directory should still be in files array');

console.log('ALL CHECKS PASS');
"
```
</verification>

<success_criteria>
- package.json name is "get-more-shit-done-cc" with skspade GitHub URLs
- README.md all user-facing commands use "get-more-shit-done-cc" and "skspade/get-more-shit-done"
- .github/ files reference @skspade
- Internal directory references (get-shit-done/) are preserved unchanged
- npm test still passes
</success_criteria>

<output>
After completion, create `.planning/quick/2-update-package-json-and-related-referenc/2-SUMMARY.md`
</output>
