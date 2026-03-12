# Milestone v2.4 Requirements — Autopilot Streaming

## Streaming Core

- [ ] **STREAM-01**: Autopilot discovers Claude CLI `stream-json` event format empirically before implementing display logic
- [ ] **STREAM-02**: New `runClaudeStreaming()` function reads child process stdout as NDJSON lines via zx async iterator (`for await (const line of child)`)
- [ ] **STREAM-03**: `displayStreamEvent()` writes assistant text to stdout and tool call indicators to stderr in real-time
- [ ] **STREAM-04**: All NDJSON lines accumulated for `result.stdout` compatibility with debug retry error context
- [ ] **STREAM-05**: Output file receives every NDJSON line in real-time (not buffered until process exit)
- [ ] **STREAM-06**: `runClaudeStreaming()` uses `--output-format stream-json` with required flags for token-level streaming

## Stall Detection

- [ ] **STALL-01**: Configurable stall timer resets on every stream event received
- [ ] **STALL-02**: Warning printed to stderr and logged when no output arrives within timeout (default 5 min)
- [ ] **STALL-03**: Warning re-arms for repeated warnings at each interval (5min, 10min, 15min, etc.)
- [ ] **STALL-04**: Timer cleaned up on all exit paths including stream errors (try/finally + unref)

## CLI & Integration

- [ ] **CLI-01**: New `--quiet` flag selects `--output-format json` (original behavior) for CI/scripted use
- [ ] **CLI-02**: `runStep()` and `runStepCaptured()` delegate to `runClaudeStreaming()` instead of direct `$` invocations
- [ ] **CLI-03**: All 3 debug retry `claude -p` invocations route through `runClaudeStreaming()`
- [ ] **CLI-04**: `autopilot.stall_timeout_ms` added to config schema with default 300000
- [ ] **CLI-05**: `< /dev/null` stdin fix preserved in consolidated `runClaudeStreaming()` function

## Future Requirements

(None deferred)

## Out of Scope

- Token-level streaming UI (spinners, progress bars) — assistant text passthrough is sufficient
- Interactive stream controls (pause/resume) — adds complexity without clear value
- Multiple output sinks (split terminal vs log) — inline + output file capture covers all needs
- Automatic process kill on stall — warning-only; auto-kill adds risk of killing slow-but-working steps

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| STREAM-01 | Phase 54 | — | Pending |
| STREAM-02 | Phase 54 | — | Pending |
| STREAM-03 | Phase 54 | — | Pending |
| STREAM-04 | Phase 54 | — | Pending |
| STREAM-05 | Phase 54 | — | Pending |
| STREAM-06 | Phase 54 | — | Pending |
| STALL-01 | Phase 54 | — | Pending |
| STALL-02 | Phase 54 | — | Pending |
| STALL-03 | Phase 54 | — | Pending |
| STALL-04 | Phase 54 | — | Pending |
| CLI-01 | Phase 54 | — | Pending |
| CLI-02 | Phase 55 | — | Pending |
| CLI-03 | Phase 56 | — | Pending |
| CLI-04 | Phase 57 | — | Pending |
| CLI-05 | Phase 54 | — | Pending |
