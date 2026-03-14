# Architecture Patterns

**Domain:** --auto flag integration into new-milestone workflow
**Researched:** 2026-03-14

## Recommended Architecture

The --auto flag follows the established hybrid flag + config pattern already proven in discuss-phase and plan-phase. Four integration points require modifications; no new components are needed.

### Integration Point Map

```
new-milestone.md (workflow)
  |
  +-- [MODIFY] Argument parsing: extract --auto flag
  |     Pattern source: discuss-phase.md auto_context_check step
  |
  +-- [MODIFY] 6 AskUserQuestion calls: wrap each with auto-mode conditional
  |     Step 2: milestone goals  -> use resolved context
  |     Step 3: version confirm  -> auto-accept suggestion
  |     Step 8: research decision -> always research
  |     Step 9: requirement scope -> select all features
  |     Step 9: identify gaps    -> auto-skip ("No")
  |     Step 10: roadmap approval -> auto-approve
  |
  +-- [MODIFY] Step 11 (Done): add auto-chain to discuss-phase
  |     Pattern source: discuss-phase.md auto_advance step
  |
  +-- [MODIFY] gsd-tools.cjs init new-milestone: add auto_mode field
        Pattern source: existing init JSON output structure

brainstorm.md (workflow)
  |
  +-- [MODIFY] Step 10: replace inline steps 1-11 with SlashCommand
        /gsd:new-milestone --auto (MILESTONE-CONTEXT.md already created)

gsd-tools.cjs / init.cjs
  |
  +-- [MODIFY] cmdInitNewMilestone: add auto_mode to output JSON

config.cjs (NO CHANGES)
cli.cjs (NO CHANGES)
  |
  +-- workflow.auto_advance already registered in:
        CONFIG_DEFAULTS (implicit false via error fallback)
        KNOWN_SETTINGS_KEYS (line 738)
        validateSetting booleanKeys (line 683)
```

### Component Boundaries

| Component | Responsibility | Change Type |
|-----------|---------------|-------------|
| `get-shit-done/workflows/new-milestone.md` | Workflow orchestration, AskUserQuestion gates, SlashCommand chaining | MODIFY: add --auto parsing, 6 conditional bypasses, auto-chain |
| `get-shit-done/workflows/brainstorm.md` | Design session, milestone routing | MODIFY: simplify step 10 to single SlashCommand |
| `commands/gsd/new-milestone.md` | Command spec (tool allowlist, argument hint) | NO CHANGE: $ARGUMENTS already passes through |
| `get-shit-done/bin/lib/init.cjs` | Init JSON for new-milestone workflow | MODIFY: add `auto_mode` field |
| `get-shit-done/bin/lib/config.cjs` | Config read/write, defaults | NO CHANGE: `workflow.auto_advance` already handled |
| `get-shit-done/bin/lib/cli.cjs` | Settings validation | NO CHANGE: `workflow.auto_advance` already registered |
| `get-shit-done/scripts/autopilot.mjs` | Autonomous phase loop | NO CHANGE for v2.5 (doesn't create milestones) |

### Data Flow

```
User invokes: /gsd:new-milestone --auto "Add streaming support"
                    |
                    v
        commands/gsd/new-milestone.md
        (passes $ARGUMENTS = "--auto Add streaming support")
                    |
                    v
        workflows/new-milestone.md
                    |
    +---------------+---------------+
    |                               |
    v                               v
Parse --auto flag            Resolve context
from $ARGUMENTS              (priority order):
                              1. MILESTONE-CONTEXT.md
                              2. @file in args
                              3. Inline text in args
                              4. Error if none + auto
                    |
                    v
        Read config: workflow.auto_advance
        If --auto and config not true -> persist true
                    |
                    v
        Steps 2-11 with conditional bypasses
        (each AskUserQuestion wrapped in auto check)
                    |
                    v
        Step 11: auto-chain
        SlashCommand("/gsd:discuss-phase 1 --auto")
                    |
                    v
        discuss-phase auto_advance step
        (existing: spawns plan-phase --auto)
                    |
                    v
        plan-phase auto_advance step
        (existing: spawns execute-phase --auto)
```

## Patterns to Follow

### Pattern 1: Hybrid Flag + Config Check
**What:** Check both CLI flag and persisted config, persist flag to config on first use.
**When:** Every auto-mode decision point.
**Why:** Enables both direct `--auto` invocation and config-driven auto from upstream callers.
**Example (from discuss-phase.md, reuse exactly):**
```
1. Parse --auto flag from $ARGUMENTS
2. Read workflow.auto_advance from config:
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")

If --auto flag present AND AUTO_CFG is not true:
   node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.auto_advance true

If --auto flag present OR AUTO_CFG is true:
   {auto behavior}
Otherwise:
   {interactive behavior}
```

### Pattern 2: Context Resolution Priority Chain
**What:** Resolve milestone goals from multiple sources with clear priority.
**When:** Step 2 (gathering milestone goals) in auto mode.
**Why:** Supports all entry points: brainstorm (MILESTONE-CONTEXT.md), CLI (@file), direct invocation (inline text).
**Example:**
```
1. If MILESTONE-CONTEXT.md exists -> use it (brainstorm route)
2. If @file reference in args -> read file as goals
3. If inline text after stripping --auto -> use as goals
4. If none and auto -> error with usage message
5. If none and interactive -> ask user (existing)
```

### Pattern 3: Auto-Chain via SlashCommand
**What:** After completing workflow, invoke next command with --auto flag.
**When:** Step 11 (Done) when auto mode is active.
**Why:** Continues autonomous pipeline without user intervention.
**Example (from discuss-phase.md auto_advance step):**
```
If --auto flag present OR AUTO_CFG is true:
   Display: "Auto-advancing to first phase..."
   SlashCommand("/gsd:discuss-phase 1 --auto")

Otherwise:
   Display existing completion message with manual next steps
```

### Pattern 4: Init JSON Auto-Mode Field
**What:** Include `auto_mode` boolean in init command output.
**When:** `gsd-tools.cjs init new-milestone` invocation.
**Why:** Centralizes config-state detection so the workflow has a signal from init.

The init command does not receive $ARGUMENTS from the workflow. The auto_mode field reflects config state only. The workflow must parse --auto from $ARGUMENTS separately. The init field is informational (tells the workflow what config says).

```javascript
// In cmdInitNewMilestone, add to result object:
auto_mode: config.workflow?.auto_advance === true,
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Auto Workflow File
**What:** Creating a `new-milestone-auto.md` alongside `new-milestone.md`.
**Why bad:** Duplicates all shared logic, creates maintenance burden, diverges over time.
**Instead:** Inline conditionals within the existing workflow (established pattern).

### Anti-Pattern 2: Skipping Research in Auto Mode
**What:** Defaulting to "skip research" to save time in auto mode.
**Why bad:** Research catches feature gaps and architecture issues before requirements lock in. The design doc explicitly says "always research."
**Instead:** Auto-select "Research first" option (the default recommendation).

### Anti-Pattern 3: Partial Feature Selection in Auto Mode
**What:** Using heuristics to select a subset of features from MILESTONE-CONTEXT.md.
**Why bad:** The context was curated (by brainstorm or user) -- filtering it defeats the purpose.
**Instead:** Select all features from context. The roadmapper handles phasing.

### Anti-Pattern 4: Config Persistence Without Flag Check
**What:** Always persisting `workflow.auto_advance = true` when --auto flag is present, even if config is already true.
**Why bad:** Unnecessary write operations, noisy git diffs on config.json.
**Instead:** Only persist when `--auto` present AND config is NOT already true (conditional persist pattern from discuss-phase).

### Anti-Pattern 5: Chaining via Task Instead of SlashCommand
**What:** Using Task() to spawn discuss-phase after milestone creation.
**Why bad:** Task spawns a subagent that cannot itself spawn subagents. The discuss-phase auto flow needs to chain plan-phase, which chains execute-phase. Task nesting would hit the subagent-cannot-spawn-subagent constraint.
**Instead:** Use SlashCommand which continues in the same agent context, allowing the full auto chain to work.

## Build Order and Dependencies

The changes have clear dependencies that dictate build order:

```
Phase 1: gsd-tools init modification
  init.cjs: add auto_mode field to cmdInitNewMilestone
  No dependencies. Can be tested independently.
  Estimated scope: ~3 lines changed

Phase 2: new-milestone.md workflow modifications
  Depends on: Phase 1 (uses auto_mode from init)
  Add: argument parsing, context resolution, 6 AskUserQuestion bypasses, auto-chain
  This is the bulk of the work.
  Estimated scope: ~80 lines of new conditional blocks inserted

Phase 3: brainstorm.md simplification
  Depends on: Phase 2 (new-milestone --auto must work first)
  Replace: step 10 inline execution with SlashCommand("/gsd:new-milestone --auto")
  Estimated scope: ~70 lines removed, ~5 lines added
```

### Why This Order

1. **init.cjs first** because the workflow reads init output early (step 7). Having auto_mode available from init gives the workflow a config-state signal before it parses $ARGUMENTS.

2. **new-milestone.md second** because it is the core deliverable. The 6 AskUserQuestion bypasses and auto-chain are the primary feature.

3. **brainstorm.md last** because it is a simplification that depends on `--auto` working. If brainstorm step 10 is changed before new-milestone supports `--auto`, the milestone route breaks.

## Modification Details per File

### init.cjs (1 function, ~3 lines)

```javascript
// cmdInitNewMilestone: add one field to result object
auto_mode: config.workflow?.auto_advance === true,
```

Requires reading config with `loadConfig(cwd)` which already happens on line 222. The `config` object is already available; this accesses `config.workflow?.auto_advance`.

### new-milestone.md (6 insertion points across steps 2-11)

| Location | Current Behavior | Auto Behavior | Insertion Type |
|----------|-----------------|---------------|----------------|
| New step before Step 1 | N/A | Parse --auto from $ARGUMENTS, read config, conditional persist | New block |
| Step 2 (goals) | AskUserQuestion for goals | Use resolved context (MILESTONE-CONTEXT.md / @file / inline) | Conditional wrapper |
| Step 3 (version) | AskUserQuestion for version confirmation | Auto-accept suggested version | Conditional wrapper |
| Step 8 (research) | AskUserQuestion for research choice | Always select "Research first" | Conditional wrapper |
| Step 9 (scope) | AskUserQuestion multiSelect per category | Select all features | Conditional wrapper |
| Step 9 (gaps) | AskUserQuestion for additions | Select "No, research covered it" | Conditional wrapper |
| Step 10 (roadmap) | AskUserQuestion for roadmap approval | Auto-approve | Conditional wrapper |
| Step 11 (done) | Display next steps | SlashCommand("/gsd:discuss-phase N --auto") | New conditional block |

Each conditional wrapper uses the same guard:

```
If --auto flag present OR AUTO_CFG is true:
   {auto behavior}
Otherwise:
   {existing interactive behavior unchanged}
```

### brainstorm.md (step 10, ~70 lines replaced)

Current step 10 milestone route (lines ~263-307) duplicates new-milestone workflow steps 1-11 inline. Replace with:

```
1. Write MILESTONE-CONTEXT.md (keep existing -- this is the context source)
2. Commit MILESTONE-CONTEXT.md
3. Display: "Routing to new-milestone with design context..."
4. SlashCommand("/gsd:new-milestone --auto")
```

The MILESTONE-CONTEXT.md creation (step 10a) stays because new-milestone reads it as its context source. Only 10b (init) and 10c (inline execution of steps 1-11) are replaced.

## Existing Infrastructure Already Supporting --auto

These components are already wired for `workflow.auto_advance` and require zero changes:

| Component | What It Already Does | File Location |
|-----------|---------------------|--------------|
| `KNOWN_SETTINGS_KEYS` | Lists `workflow.auto_advance` as valid key | `cli.cjs:738` |
| `validateSetting()` | Validates `workflow.auto_advance` as boolean | `cli.cjs:683` |
| `gsd settings` CLI | Can display/modify `workflow.auto_advance` | `cli.cjs` |
| `config-set` command | Persists dot-notation keys like `workflow.auto_advance` | `config.cjs:102` |
| `config-get` command | Reads dot-notation keys with fallback to CONFIG_DEFAULTS | `config.cjs:147` |
| discuss-phase `--auto` | Full reference implementation of auto pattern | `discuss-phase.md:132-210, 761-849` |
| plan-phase `--auto` | Auto-chain to execute-phase | `plan-phase.md:482-558` |

This means the config layer is a zero-touch integration. The only infrastructure change is the init.cjs field addition.

## Scalability Considerations

| Concern | Current (v2.5) | Future |
|---------|----------------|--------|
| Auto-chain depth | 3 hops: new-milestone -> discuss -> plan -> execute | Stable; each hop uses SlashCommand for fresh context |
| Config persistence race | Single-threaded workflow, no race possible | Safe; GSD workflows are sequential |
| Context resolution sources | 3 sources (MILESTONE-CONTEXT.md, @file, inline) | Extensible; add new sources to priority chain |
| AskUserQuestion bypass count | 6 in new-milestone | Pattern scales to any count; each is independent |
| Subagent depth | SlashCommand (not Task) avoids subagent nesting limits | Correct architectural choice for auto-chain |

## Sources

- `get-shit-done/workflows/new-milestone.md` -- current workflow (11 steps, 6 AskUserQuestion calls) (HIGH confidence, direct reading)
- `get-shit-done/workflows/discuss-phase.md` -- reference implementation of --auto pattern (auto_context_check + auto_advance steps) (HIGH confidence, direct reading)
- `get-shit-done/workflows/plan-phase.md` -- reference implementation of --auto chain (step 14) (HIGH confidence, direct reading)
- `get-shit-done/workflows/brainstorm.md` -- step 10 milestone route (inline execution to be simplified) (HIGH confidence, direct reading)
- `get-shit-done/bin/lib/init.cjs` -- cmdInitNewMilestone function (lines 221-251) (HIGH confidence, direct reading)
- `get-shit-done/bin/lib/config.cjs` -- CONFIG_DEFAULTS, cmdConfigSet, cmdConfigGet (HIGH confidence, direct reading)
- `get-shit-done/bin/lib/cli.cjs` -- KNOWN_SETTINGS_KEYS, validateSetting (workflow.auto_advance already registered) (HIGH confidence, direct reading)
- `commands/gsd/new-milestone.md` -- command spec (HIGH confidence, direct reading)
- `.planning/designs/2026-03-14-new-milestone-auto-mode-design.md` -- approved design document (HIGH confidence, direct reading)

---
*Architecture research for: new-milestone --auto mode integration*
*Researched: 2026-03-14*
