# Requirements: GSD Autopilot

**Defined:** 2026-03-22
**Core Value:** A single command that takes a milestone from zero to done autonomously, reading project state to know where it is and driving forward through every GSD phase without human bottlenecks.

## v1 Requirements

Requirements for v3.1 Automated UAT Session. Each maps to roadmap phases.

### Configuration

- [x] **CFG-01**: `uat-config.yaml` schema defines base_url, startup_command, startup_wait_seconds, browser, fallback_browser, timeout_minutes *(Phase 91)*
- [x] **CFG-02**: Missing `uat-config.yaml` causes UAT to be skipped silently (non-web projects proceed to completion) *(Phase 91)*
- [x] **CFG-03**: MILESTONE-UAT.md format defined with YAML frontmatter (status, counts, browser, timestamps) and results table *(Phase 91)*

### Test Discovery

- [ ] **DISC-01**: Agent discovers UAT tests by scanning phase directories for `*-UAT.md` files with status:complete
- [ ] **DISC-02**: When no UAT.md files exist, agent generates test scenarios from SUMMARY.md files across milestone phases

### Chrome MCP Engine

- [ ] **CMCP-01**: Agent navigates to pages using Chrome MCP `chrome_navigate`
- [ ] **CMCP-02**: Agent interacts with elements via `chrome_click_element`, `chrome_fill_or_select`, `chrome_keyboard`
- [ ] **CMCP-03**: Agent captures screenshots via `chrome_screenshot` and reads DOM via `chrome_get_web_content`
- [ ] **CMCP-04**: Agent judges pass/fail by comparing observed state against expected behavior description using DOM content as primary signal and screenshot as supplementary
- [ ] **CMCP-05**: Chrome MCP availability verified via full round-trip probe (not just `tabs_context_mcp`), with fallback to Playwright on failure

### Playwright Fallback

- [x] **PWRT-01**: When Chrome MCP is unavailable, agent falls back to Playwright with headless Chromium *(Phase 93)*
- [x] **PWRT-02**: Agent generates ephemeral inline Playwright scripts per test (no persistent .spec.ts files) *(Phase 93)*
- [x] **PWRT-03**: Playwright fallback checks Chromium binary availability and installs if missing (`npx playwright install chromium`) *(Phase 93)*
- [x] **PWRT-04**: Output format (screenshots, results) identical between Chrome MCP and Playwright modes *(Phase 93)*

### Evidence & Reporting

- [ ] **EVID-01**: Each test produces a screenshot saved to `.planning/uat-evidence/{milestone}/`
- [ ] **EVID-02**: Failed tests include observed vs expected description in results
- [ ] **EVID-03**: MILESTONE-UAT.md gaps section uses identical YAML schema to MILESTONE-AUDIT.md gaps (truth, status, reason, severity)
- [ ] **EVID-04**: MILESTONE-UAT.md committed to git after test execution

### UAT-Auto Workflow

- [ ] **WKFL-01**: `/gsd:uat-auto` workflow orchestrates: load config → discover tests → detect browser → start app → execute tests → write results → commit → exit
- [ ] **WKFL-02**: Workflow is fully autonomous — no user interaction required
- [ ] **WKFL-03**: App startup management: starts dev server if not running (detected by fetching base_url), skips if already up
- [ ] **WKFL-04**: Configurable timeout (default 10 minutes) prevents stuck sessions from blocking pipeline

### Autopilot Integration

- [ ] **AUTO-01**: `runAutomatedUAT()` function in autopilot.mjs triggered after milestone audit passes, before milestone completion
- [ ] **AUTO-02**: UAT pass (exit 0 + all tests pass) proceeds to `runMilestoneCompletion()`
- [ ] **AUTO-03**: UAT failures (exit 0 + gaps found) feed into `runGapClosureLoop()` for automatic fix cycles
- [ ] **AUTO-04**: UAT crash (exit non-zero) handled by existing debug retry mechanism
- [ ] **AUTO-05**: `plan-milestone-gaps` recognizes MILESTONE-UAT.md as a gap source alongside MILESTONE-AUDIT.md

### Documentation

- [x] **DOCS-01**: help.md updated with `/gsd:uat-auto` command reference *(Phase 95)*
- [x] **DOCS-02**: USER-GUIDE.md updated with automated UAT usage guide *(Phase 95)*
- [x] **DOCS-03**: README.md command table updated with uat-auto entry *(Phase 95)*

## v2 Requirements

Deferred to future release.

### Phase-Level UAT

- **PLVL-01**: Automated UAT replaces human verify-work at individual phase level
- **PLVL-02**: Configurable severity thresholds for gap creation (cosmetic pass, major block)

### Trending

- **TRND-01**: UAT result trending across milestones (pass rate over time)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persistent .spec.ts test file generation | UAT.md files ARE the test definitions — codegen creates maintenance burden and duplicate source of truth |
| Visual regression baseline comparison | Pixel-diff testing is a different paradigm; Claude's semantic judgment replaces pixel comparison |
| Multi-browser test matrix | Chromium-only is sufficient for acceptance testing; cross-browser is a separate concern |
| Parallel test execution | UAT tests are sequential by nature; test count per milestone is small (5-20) |
| Selector-based test definitions | Defeats natural-language-interpretation advantage; couples tests to implementation details |
| Interactive UAT mode | Contradicts "fully autonomous" requirement; evidence screenshots provide post-hoc visibility |
| UAT for non-web projects | CLI/API testing needs different approaches; non-web projects skip via missing config |
| Token budget for UAT session | Timeout-based limits are simpler and sufficient; circuit breaker handles runaway |
| Individual test retries before reporting | Gap closure fixes the app then re-runs full UAT; test-level retry adds complexity without value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFG-01 | Phase 91 | Pending |
| CFG-02 | Phase 91 | Pending |
| CFG-03 | Phase 91 | Pending |
| DISC-01 | Phase 92 | Pending |
| DISC-02 | Phase 92 | Pending |
| CMCP-01 | Phase 92 | Pending |
| CMCP-02 | Phase 92 | Pending |
| CMCP-03 | Phase 92 | Pending |
| CMCP-04 | Phase 92 | Pending |
| CMCP-05 | Phase 92 | Pending |
| PWRT-01 | Phase 93 | Complete |
| PWRT-02 | Phase 93 | Complete |
| PWRT-03 | Phase 93 | Complete |
| PWRT-04 | Phase 93 | Complete |
| EVID-01 | Phase 94 | Pending |
| EVID-02 | Phase 94 | Pending |
| EVID-03 | Phase 94 | Pending |
| EVID-04 | Phase 94 | Pending |
| WKFL-01 | Phase 92 | Pending |
| WKFL-02 | Phase 92 | Pending |
| WKFL-03 | Phase 94 | Pending |
| WKFL-04 | Phase 92 | Pending |
| AUTO-01 | Phase 94 | Pending |
| AUTO-02 | Phase 94 | Pending |
| AUTO-03 | Phase 94 | Pending |
| AUTO-04 | Phase 94 | Pending |
| AUTO-05 | Phase 94 | Pending |
| DOCS-01 | Phase 95 | Complete |
| DOCS-02 | Phase 95 | Complete |
| DOCS-03 | Phase 95 | Complete |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after initial definition*
