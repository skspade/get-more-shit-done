---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/test.yml
  - .github/workflows/auto-label-issues.yml
  - .github/CODEOWNERS
  - .github/FUNDING.yml
  - .github/ISSUE_TEMPLATE/bug_report.yml
  - .github/ISSUE_TEMPLATE/feature_request.yml
  - .github/pull_request_template.md
  - package.json
autonomous: true
requirements: [QUICK-4]

must_haves:
  truths:
    - "No GitHub Actions workflows exist in the repository"
    - "No GitHub community/config files remain in .github/"
    - "package.json has no NPM publishing configuration"
    - "package.json retains all fields needed for local CLI usage (bin, scripts, engines, dependencies)"
  artifacts:
    - path: "package.json"
      provides: "Clean package.json without publishing fields"
      contains: "bin"
  key_links: []
---

<objective>
Remove all GitHub Actions workflows, GitHub community configuration files, and NPM publishing configuration from package.json. This is a fork cleanup -- these files belong to the upstream project's CI/CD and npm publishing pipeline, which are not relevant to this fork.

Purpose: Clean the fork of upstream CI/CD and publishing artifacts that serve no purpose here.
Output: Deleted .github/ directory entirely, cleaned package.json.
</objective>

<execution_context>
@/Users/seanspade/.claude/get-shit-done/workflows/execute-plan.md
@/Users/seanspade/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete entire .github directory</name>
  <files>.github/workflows/test.yml, .github/workflows/auto-label-issues.yml, .github/CODEOWNERS, .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.yml, .github/ISSUE_TEMPLATE/feature_request.yml, .github/pull_request_template.md</files>
  <action>
Delete the entire `.github/` directory and all its contents. This includes:
- `.github/workflows/test.yml` — CI test matrix (upstream's CI, not used by fork)
- `.github/workflows/auto-label-issues.yml` — Issue auto-labeling (upstream's issue triage)
- `.github/CODEOWNERS` — Code ownership rules (references upstream owner @skspade)
- `.github/FUNDING.yml` — GitHub Sponsors config (upstream's funding)
- `.github/ISSUE_TEMPLATE/bug_report.yml` — Bug report template (upstream's issue management)
- `.github/ISSUE_TEMPLATE/feature_request.yml` — Feature request template (upstream's issue management)
- `.github/pull_request_template.md` — PR template (upstream's PR workflow)

Use `rm -rf .github` to remove the entire directory tree.
  </action>
  <verify>
    <automated>test ! -d .github && echo "PASS: .github directory removed" || echo "FAIL: .github directory still exists"</automated>
  </verify>
  <done>.github/ directory and all contents are completely removed from the repository</done>
</task>

<task type="auto">
  <name>Task 2: Remove NPM publishing configuration from package.json</name>
  <files>package.json</files>
  <action>
Edit `package.json` to remove these NPM-publishing-only fields:

1. Remove the `"files"` array (lines 10-17) — only used by `npm publish` to determine tarball contents
2. Remove the `"keywords"` array (lines 18-29) — only used for npm search/discovery
3. Remove the `"prepublishOnly"` script (line 49) — only runs before `npm publish`

Fields to KEEP (still needed for local CLI usage):
- `name`, `version`, `description` — project identity
- `bin` — needed for `npm link` and CLI execution
- `author`, `license` — metadata
- `repository`, `homepage`, `bugs` — already updated for fork in quick task 2
- `engines` — node version requirement
- `devDependencies` — needed for development
- `scripts.build:hooks`, `scripts.test`, `scripts.test:coverage`, `scripts.install-fork`, `scripts.install-fork:dry` — all still used locally

The resulting package.json should be valid JSON with no trailing commas or formatting issues.
  </action>
  <verify>
    <automated>node -e "const p = require('./package.json'); const fail = []; if (p.files) fail.push('files still present'); if (p.keywords) fail.push('keywords still present'); if (p.scripts && p.scripts.prepublishOnly) fail.push('prepublishOnly still present'); if (!p.bin) fail.push('bin missing (should be kept)'); if (!p.scripts || !p.scripts.test) fail.push('test script missing (should be kept)'); if (fail.length) { console.log('FAIL:', fail.join(', ')); process.exit(1); } else { console.log('PASS: publishing config removed, local config intact'); }"</automated>
  </verify>
  <done>package.json contains no NPM publishing configuration (no files, keywords, or prepublishOnly) while retaining all fields needed for local CLI usage</done>
</task>

</tasks>

<verification>
- `.github/` directory does not exist: `test ! -d .github`
- `package.json` is valid JSON: `node -e "require('./package.json')"`
- No publishing fields remain: `node -e "const p=require('./package.json'); console.log({files:!!p.files, keywords:!!p.keywords, prepublishOnly:!!(p.scripts||{}).prepublishOnly});"` should show all false
- CLI still works: `node get-shit-done/bin/gsd-cli.cjs --help`
</verification>

<success_criteria>
- .github/ directory completely removed (0 files remaining)
- package.json has no `files`, `keywords`, or `prepublishOnly` fields
- package.json is valid JSON and retains bin, scripts (except prepublishOnly), engines, dependencies
- All changes committed
</success_criteria>

<output>
After completion, create `.planning/quick/4-remove-github-actions-and-npm-publishing/4-SUMMARY.md`
</output>
