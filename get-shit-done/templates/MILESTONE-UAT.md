# MILESTONE-UAT Template

Template for `.planning/milestones/{version}-MILESTONE-UAT.md` — automated UAT session results.

Gap schema uses identical core fields (truth, status, reason, severity) as MILESTONE-AUDIT.md.
Gaps are placed in the markdown body (not frontmatter) to avoid the extractFrontmatter limitation with nested array-of-objects.

---

## File Template

```markdown
---
status: passed | gaps_found
milestone: {milestone}
browser: chrome-mcp | playwright
started: {ISO 8601 timestamp}
completed: {ISO 8601 timestamp}
total: {number}
passed: {number}
failed: {number}
---

# Milestone {milestone} — UAT Results

## Results

| # | Phase | Test | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | {phase} | {test description} | passed | {screenshot path or observation} |
| 2 | {phase} | {test description} | failed | {screenshot path or observation} |

## Gaps

- truth: "{expected behavior}"
  status: failed
  reason: "{why it failed}"
  severity: major | minor
  evidence: "{path to screenshot}"
  observed: "{what was actually observed}"
```

---

## Field Reference

### Frontmatter Fields

| Field | Values | Description |
|-------|--------|-------------|
| `status` | `passed`, `gaps_found` | Overall UAT result |
| `milestone` | version string | Milestone being tested |
| `browser` | `chrome-mcp`, `playwright` | Browser used for testing |
| `started` | ISO 8601 | Session start time |
| `completed` | ISO 8601 | Session end time |
| `total` | integer | Total tests executed |
| `passed` | integer | Tests that passed |
| `failed` | integer | Tests that failed |

### Gap Fields

Core fields (identical to MILESTONE-AUDIT.md):
- `truth` — the expected behavior being tested
- `status` — `failed` (set to `resolved` after gap closure)
- `reason` — why the test failed
- `severity` — `major` or `minor`

UAT-specific fields:
- `evidence` — path to screenshot or recording
- `observed` — what was actually observed in the browser
