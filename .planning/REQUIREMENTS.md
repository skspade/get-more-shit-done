# Requirements: v2.5 New-Milestone Auto Mode

## Argument Parsing

- [ ] **PARSE-01**: `--auto` flag is parsed from $ARGUMENTS in new-milestone workflow
- [ ] **PARSE-02**: `workflow.auto_advance` config is read and used as fallback when flag not present
- [ ] **PARSE-03**: `--auto` flag persists `workflow.auto_advance: true` to config when not already set

## Context Resolution

- [ ] **CTX-01**: Auto mode resolves context from MILESTONE-CONTEXT.md when present
- [ ] **CTX-02**: Auto mode resolves context from @file reference in arguments
- [ ] **CTX-03**: Auto mode resolves context from inline text in arguments
- [ ] **CTX-04**: Auto mode errors with usage message when no context provided
- [ ] **CTX-05**: Context validation occurs before any PROJECT.md or STATE.md mutations

## Auto-Skip Decision Points

- [ ] **SKIP-01**: "What do you want to build next?" question is skipped, using resolved context
- [ ] **SKIP-02**: Version suggestion is auto-accepted (minor bump) without confirmation
- [ ] **SKIP-03**: Research decision auto-selects "Research first" and persists config
- [ ] **SKIP-04**: Requirement scoping auto-includes all features from context/research
- [ ] **SKIP-05**: "Identify gaps" question is auto-skipped with "No"
- [ ] **SKIP-06**: Roadmap approval is auto-approved

## Auto-Chain

- [ ] **CHAIN-01**: After roadmap creation in auto mode, invoke `/gsd:discuss-phase {first_phase} --auto`
- [ ] **CHAIN-02**: First phase number is read from ROADMAP.md, not hardcoded

## Autopilot Integration

- [ ] **INT-01**: brainstorm.md step 10 milestone route simplified to invoke `/gsd:new-milestone --auto` instead of inline steps 1-11
- [ ] **INT-02**: MILESTONE-CONTEXT.md is written and committed before brainstorm handoff
- [ ] **INT-03**: `gsd-tools.cjs init new-milestone` includes `auto_mode` field in JSON output

## Out of Scope

- Partial feature selection flags (`--only`)
- Interactive fallback on context failure
- `--no-research` flag for auto mode
- Dry-run mode
- Custom version override in auto mode
- Auto-approve verification checkpoint
- pr-review.md and linear.md milestone route simplification (future milestone)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Phase 59 | Done |
| PARSE-02 | Phase 59 | Done |
| PARSE-03 | Phase 59 | Done |
| CTX-01 | Phase 59 | Done |
| CTX-02 | Phase 59 | Done |
| CTX-03 | Phase 59 | Done |
| CTX-04 | Phase 59 | Done |
| CTX-05 | Phase 59 | Done |
| SKIP-01 | Phase 60 | Pending |
| SKIP-02 | Phase 60 | Pending |
| SKIP-03 | Phase 60 | Pending |
| SKIP-04 | Phase 60 | Pending |
| SKIP-05 | Phase 60 | Pending |
| SKIP-06 | Phase 60 | Pending |
| CHAIN-01 | Phase 61 | Pending |
| CHAIN-02 | Phase 61 | Pending |
| INT-01 | Phase 62 | Pending |
| INT-02 | Phase 62 | Pending |
| INT-03 | Phase 59 | Done |
