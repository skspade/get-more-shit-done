<purpose>
Create all phases necessary to close gaps identified by `/gsd:audit-milestone`. Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase. One command creates all fix phases — no manual `/gsd:add-phase` per gap.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Load Audit and UAT Results

```bash
# Find the most recent audit file
ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null | head -1
```

Parse YAML frontmatter to extract structured gaps:
- `gaps.requirements` — unsatisfied requirements
- `gaps.integration` — missing cross-phase connections
- `gaps.flows` — broken E2E flows
- `gaps.test_consolidation` — steward consolidation proposals (when present)

If `gaps.test_consolidation` is absent or empty, skip test consolidation with no error. Treat as: `const consolidationGaps = gaps.test_consolidation || [];`

Also extract `test_health.budget_status` from the frontmatter (values: `OK`, `Warning`, `Over Budget`). If absent, default to `OK`.

Also check for UAT test results:
```bash
ls -t .planning/MILESTONE-UAT.md 2>/dev/null | head -1
```

If `MILESTONE-UAT.md` exists, read its `## Gaps` section. UAT gaps use the identical schema (`truth`, `status`, `reason`, `severity`) and should be merged with audit gaps before grouping into fix phases. UAT gaps are treated as `gaps.requirements` entries for prioritization purposes.

If no audit file exists and no UAT file exists, or neither has gaps, error:
```
No audit gaps found. Run `/gsd:audit-milestone` first.
```

## 2. Prioritize Gaps

Group gaps by priority from REQUIREMENTS.md:

| Priority | Action |
|----------|--------|
| `must` | Create phase, blocks milestone |
| `should` | Create phase, recommended |
| `nice` | Ask user: include or defer? |

For integration/flow gaps, infer priority from affected requirements.

## 3. Group Gaps into Phases

Cluster related gaps into logical phases:

**Grouping rules:**
- Same affected phase → combine into one fix phase
- Same subsystem (auth, API, UI) → combine
- Dependency order (fix stubs before wiring)
- Keep phases focused: 2-4 tasks each

**Budget gating for test consolidation:**
- Read `test_health.budget_status` (extracted in step 1, defaults to `OK` if absent)
- If `budget_status` is `OK`: skip consolidation phase creation entirely, even if proposals exist — defer to tech debt. Log: "Skipping test consolidation — budget status OK, deferring to tech debt"
- If `budget_status` is `Warning` or `Over Budget`: proceed with consolidation phase creation below

**Test consolidation grouping** (only when budget gating passes):
- All test consolidation proposals are grouped into a single phase called "Test Suite Consolidation"
- The consolidation phase is always the last phase in the gap closure sequence
- Each proposal appears as a task in the consolidation phase
- If no test consolidation proposals exist, no consolidation phase is created

**Example grouping:**
```
Gap: DASH-01 unsatisfied (Dashboard doesn't fetch)
Gap: Integration Phase 1→3 (Auth not passed to API calls)
Gap: Flow "View dashboard" broken at data fetch

→ Phase 6: "Wire Dashboard to API"
  - Add fetch to Dashboard.tsx
  - Include auth header in fetch
  - Handle response, update state
  - Render user data
```

## 4. Determine Phase Numbers

Find highest existing phase:
```bash
# Get sorted phase list, extract last one
PHASES=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phases list)
HIGHEST=$(printf '%s\n' "$PHASES" | jq -r '.directories[-1]')
```

New phases continue from there:
- If Phase 5 is highest, gaps become Phase 6, 7, 8...

## 5. Present Gap Closure Plan

```markdown
## Gap Closure Plan

**Milestone:** {version}
**Gaps to close:** {N} requirements, {M} integration, {K} flows

### Proposed Phases

**Phase {N}: {Name}**
Closes:
- {REQ-ID}: {description}
- Integration: {from} → {to}
Tasks: {count}

**Phase {N+1}: {Name}**
Closes:
- {REQ-ID}: {description}
- Flow: {flow name}
Tasks: {count}

{If nice-to-have gaps exist:}

### Deferred (nice-to-have)

These gaps are optional. Include them?
- {gap description}
- {gap description}

---

{If consolidation proposals exist and budget gating passed:}

**Phase {N+M}: Test Suite Consolidation** (last in sequence)
Estimated total reduction: {sum of all estimated_reduction} tests
Tasks:
- [{strategy}] {task name} — {source} (est. -{estimated_reduction} tests)
- [{strategy}] {task name} — {source} (est. -{estimated_reduction} tests)

---

Create these {X} phases? (yes / adjust / defer all optional)
```

Wait for user confirmation.

## 6. Update ROADMAP.md

Add new phases to current milestone:

```markdown
### Phase {N}: {Name}
**Goal:** {derived from gaps being closed}
**Requirements:** {REQ-IDs being satisfied}
**Gap Closure:** Closes gaps from audit

### Phase {N+1}: {Name}
...
```

## 7. Update REQUIREMENTS.md Traceability Table (REQUIRED)

For each REQ-ID assigned to a gap closure phase:
- Update the Phase column to reflect the new gap closure phase
- Reset Status to `Pending`

Reset checked-off requirements the audit found unsatisfied:
- Change `[x]` → `[ ]` for any requirement marked unsatisfied in the audit
- Update coverage count at top of REQUIREMENTS.md

```bash
# Verify traceability table reflects gap closure assignments
grep -c "Pending" .planning/REQUIREMENTS.md
```

## 8. Create Phase Directories

```bash
mkdir -p ".planning/phases/{NN}-{name}"
```

## 9. Commit Roadmap and Requirements Update

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(roadmap): add gap closure phases {N}-{M}" --files .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## 10. Offer Next Steps

```markdown
## ✓ Gap Closure Phases Created

**Phases added:** {N} - {M}
**Gaps addressed:** {count} requirements, {count} integration, {count} flows

---

## ▶ Next Up

**Plan first gap closure phase**

`/gsd:plan-phase {N}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:execute-phase {N}` — if plans already exist
- `cat .planning/ROADMAP.md` — see updated roadmap

---

**After all gap phases complete:**

`/gsd:audit-milestone` — re-audit to verify gaps closed
`/gsd:complete-milestone {version}` — archive when audit passes
```

</process>

<gap_to_phase_mapping>

## How Gaps Become Tasks

**Requirement gap → Tasks:**
```yaml
gap:
  id: DASH-01
  description: "User sees their data"
  reason: "Dashboard exists but doesn't fetch from API"
  missing:
    - "useEffect with fetch to /api/user/data"
    - "State for user data"
    - "Render user data in JSX"

becomes:

phase: "Wire Dashboard Data"
tasks:
  - name: "Add data fetching"
    files: [src/components/Dashboard.tsx]
    action: "Add useEffect that fetches /api/user/data on mount"

  - name: "Add state management"
    files: [src/components/Dashboard.tsx]
    action: "Add useState for userData, loading, error states"

  - name: "Render user data"
    files: [src/components/Dashboard.tsx]
    action: "Replace placeholder with userData.map rendering"
```

**Integration gap → Tasks:**
```yaml
gap:
  from_phase: 1
  to_phase: 3
  connection: "Auth token → API calls"
  reason: "Dashboard API calls don't include auth header"
  missing:
    - "Auth header in fetch calls"
    - "Token refresh on 401"

becomes:

phase: "Add Auth to Dashboard API Calls"
tasks:
  - name: "Add auth header to fetches"
    files: [src/components/Dashboard.tsx, src/lib/api.ts]
    action: "Include Authorization header with token in all API calls"

  - name: "Handle 401 responses"
    files: [src/lib/api.ts]
    action: "Add interceptor to refresh token or redirect to login on 401"
```

**Flow gap → Tasks:**
```yaml
gap:
  name: "User views dashboard after login"
  broken_at: "Dashboard data load"
  reason: "No fetch call"
  missing:
    - "Fetch user data on mount"
    - "Display loading state"
    - "Render user data"

becomes:

# Usually same phase as requirement/integration gap
# Flow gaps often overlap with other gap types
```

**Test consolidation gap → Tasks:**

Each strategy maps to a specific task type. All field values (`{source}`, `{action}`, `{estimated_reduction}`) come verbatim from the `gaps.test_consolidation` entries — do not re-interpret or generalize.

```yaml
# Prune → Delete task
- name: "Remove stale tests in {source}"
  type: "delete"
  files: ["{source}"]
  action: "Delete test cases: {action}. Estimated reduction: {estimated_reduction} tests. Run test suite to confirm no regressions."

# Parameterize → Refactor task
- name: "Parameterize tests in {source}"
  type: "refactor"
  files: ["{source}"]
  action: "{action}. Estimated reduction: {estimated_reduction} tests. Run test suite to confirm no regressions."

# Promote → Delete-and-verify task
- name: "Remove unit tests subsumed in {source}"
  type: "delete-and-verify"
  files: ["{source}"]
  action: "{action}. Estimated reduction: {estimated_reduction} tests. Verify subsuming integration test still covers assertions. Run test suite."

# Merge → Reorganize task
- name: "Consolidate tests from {source}"
  type: "reorganize"
  files: ["{source}"]
  action: "{action}. Estimated reduction: {estimated_reduction} tests. Run test suite to confirm no regressions."
```

</gap_to_phase_mapping>

<success_criteria>
- [ ] MILESTONE-AUDIT.md loaded and gaps parsed
- [ ] MILESTONE-UAT.md loaded if present and UAT gaps merged
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into logical phases
- [ ] User confirmed phase plan
- [ ] ROADMAP.md updated with new phases
- [ ] REQUIREMENTS.md traceability table updated with gap closure phase assignments
- [ ] Unsatisfied requirement checkboxes reset (`[x]` → `[ ]`)
- [ ] Coverage count updated in REQUIREMENTS.md
- [ ] Phase directories created
- [ ] Changes committed (includes REQUIREMENTS.md)
- [ ] User knows to run `/gsd:plan-phase` next
</success_criteria>
