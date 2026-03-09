<purpose>
Display the complete GSD command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<reference>
# GSD Command Reference

**GSD** (Get Shit Done) creates hierarchical project plans optimized for solo agentic development with Claude Code.

## Quick Start

1. `/gsd:new-project` - Initialize project (includes research, requirements, roadmap)
2. `/gsd:plan-phase 1` - Create detailed plan for first phase
3. `/gsd:execute-phase 1` - Execute the phase

## Staying Updated

GSD evolves fast. Update periodically:

```bash
npx get-shit-done-cc@latest
```

## Core Workflow

```
/gsd:new-project → /gsd:plan-phase → /gsd:execute-phase → repeat
```

### Project Initialization

**`/gsd:new-project`**
Initialize new project through unified flow.

One command takes you from idea to ready-for-planning:
- Deep questioning to understand what you're building
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with v1/v2/out-of-scope scoping
- Roadmap creation with phase breakdown and success criteria

Creates all `.planning/` artifacts:
- `PROJECT.md` — vision and requirements
- `config.json` — workflow mode (interactive/yolo)
- `research/` — domain research (if selected)
- `REQUIREMENTS.md` — scoped requirements with REQ-IDs
- `ROADMAP.md` — phases mapped to requirements
- `STATE.md` — project memory

Usage: `/gsd:new-project`

**`/gsd:map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates `.planning/codebase/` with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/gsd:new-project` on existing codebases

Usage: `/gsd:map-codebase`

### Phase Planning

**`/gsd:discuss-phase <number>`**
Help articulate your vision for a phase before planning.

- Captures how you imagine this phase working
- Creates CONTEXT.md with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/gsd:discuss-phase 2`

**`/gsd:research-phase <number>`**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates RESEARCH.md with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/gsd:research-phase 3`

**`/gsd:list-phase-assumptions <number>`**
See what Claude is planning to do before it starts.

- Shows Claude's intended approach for a phase
- Lets you course-correct if Claude misunderstood your vision
- No files created - conversational output only

Usage: `/gsd:list-phase-assumptions 3`

**`/gsd:plan-phase <number>`**
Create detailed execution plan for a specific phase.

- Generates `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (XX-01, XX-02, etc.)

Usage: `/gsd:plan-phase 1`
Result: Creates `.planning/phases/01-foundation/01-01-PLAN.md`

**PRD Express Path:** Pass `--prd path/to/requirements.md` to skip discuss-phase entirely. Your PRD becomes locked decisions in CONTEXT.md. Useful when you already have clear acceptance criteria.

### Execution

**`/gsd:execute-phase <phase-number>`**
Execute all plans in a phase.

- Groups plans by wave (from frontmatter), executes waves sequentially
- Plans within each wave run in parallel via Task tool
- Verifies phase goal after all plans complete
- Updates REQUIREMENTS.md, ROADMAP.md, STATE.md

Usage: `/gsd:execute-phase 5`

### Quick Mode

**`/gsd:quick`**
Execute small, ad-hoc tasks with GSD guarantees but skip optional agents.

Quick mode uses the same system with a shorter path:
- Spawns planner + executor (skips researcher, checker, verifier)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md tracking (not ROADMAP.md)

Use when you know exactly what to do and the task is small enough to not need research or verification.

Usage: `/gsd:quick`
Result: Creates `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`

### Roadmap Management

**`/gsd:add-phase <description>`**
Add new phase to end of current milestone.

- Appends to ROADMAP.md
- Uses next sequential number
- Updates phase directory structure

Usage: `/gsd:add-phase "Add admin dashboard"`

**`/gsd:insert-phase <after> <description>`**
Insert urgent work as decimal phase between existing phases.

- Creates intermediate phase (e.g., 7.1 between 7 and 8)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: `/gsd:insert-phase 7 "Fix critical auth bug"`
Result: Creates Phase 7.1

**`/gsd:remove-phase <number>`**
Remove a future phase and renumber subsequent phases.

- Deletes phase directory and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: `/gsd:remove-phase 17`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`/gsd:new-milestone <name>`**
Start a new milestone through unified flow.

- Deep questioning to understand what you're building next
- Optional domain research (spawns 4 parallel researcher agents)
- Requirements definition with scoping
- Roadmap creation with phase breakdown

Mirrors `/gsd:new-project` flow for brownfield projects (existing PROJECT.md).

Usage: `/gsd:new-milestone "v2.0 Features"`

**`/gsd:complete-milestone <version>`**
Archive completed milestone and prepare for next version.

- Creates MILESTONES.md entry with stats
- Archives full details to milestones/ directory
- Prepares workspace for next version

Usage: `/gsd:complete-milestone 1.0.0`

### Brainstorming

**`/gsd:brainstorm [topic]`**

Run a collaborative brainstorming session that explores your project context, asks clarifying questions, proposes approaches with trade-offs, and produces a design document. After the design is approved and committed, optionally routes into GSD milestone or project creation.

- Explores project files, docs, and recent commits before asking questions
- Asks clarifying questions one at a time, preferring multiple choice
- Proposes 2-3 distinct approaches with trade-offs and a recommendation
- Presents the design in sections, pausing for approval after each
- Writes the approved design to `.planning/designs/`
- After design commit, offers to create a milestone (if PROJECT.md exists) or project (if not)

Usage: `/gsd:brainstorm` (start a free-form session)
Usage: `/gsd:brainstorm "add dark mode support"` (seed with a topic)

Result: Design doc in `.planning/designs/` + optional milestone/project creation

### PR Review

**`/gsd:pr-review [--ingest] [--quick|--milestone] [--full] [aspects...]`**

Run a fresh PR review or ingest an existing one, extract structured findings, and route to quick task or milestone.

- Fresh mode (default): invokes the PR review toolkit, captures and parses findings
- Ingest mode (--ingest): paste a pre-existing review summary
- Deduplicates findings by file proximity (20-line threshold)
- Scores findings and routes: score >= 5 to milestone, < 5 to quick task
- Flag overrides: --quick or --milestone bypass scoring
- --full adds plan-checking and verification to quick route
- Aspects passthrough: pass review focus areas (e.g., security, performance)

Usage: `/gsd:pr-review` (run fresh review)
Usage: `/gsd:pr-review --ingest` (paste existing review)
Usage: `/gsd:pr-review --quick` (force quick task route)
Usage: `/gsd:pr-review --milestone` (force milestone route)
Usage: `/gsd:pr-review security performance` (focus on specific aspects)

Result: Quick task in `.planning/quick/` or new milestone, plus permanent report in `.planning/reviews/`

### Progress Tracking

**`/gsd:progress`**
Check project status and intelligently route to next action.

- Shows visual progress bar and completion percentage
- Summarizes recent work from SUMMARY files
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: `/gsd:progress`

### Session Management

**`/gsd:resume-work`**
Resume work from previous session with full context restoration.

- Reads STATE.md for project context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: `/gsd:resume-work`

**`/gsd:pause-work`**
Create context handoff when pausing work mid-phase.

- Creates .continue-here file with current state
- Updates STATE.md session continuity section
- Captures in-progress work context

Usage: `/gsd:pause-work`

### Debugging

**`/gsd:debug [issue description]`**
Systematic debugging with persistent state across context resets.

- Gathers symptoms through adaptive questioning
- Creates `.planning/debug/[slug].md` to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives `/clear` — run `/gsd:debug` with no args to resume
- Archives resolved issues to `.planning/debug/resolved/`

Usage: `/gsd:debug "login button doesn't work"`
Usage: `/gsd:debug` (resume active session)

### Todo Management

**`/gsd:add-todo [description]`**
Capture idea or task as todo from current conversation.

- Extracts context from conversation (or uses provided description)
- Creates structured todo file in `.planning/todos/pending/`
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates STATE.md todo count

Usage: `/gsd:add-todo` (infers from conversation)
Usage: `/gsd:add-todo Add auth token refresh`

**`/gsd:check-todos [area]`**
List pending todos and select one to work on.

- Lists all pending todos with title, area, age
- Optional area filter (e.g., `/gsd:check-todos api`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done/ when work begins

Usage: `/gsd:check-todos`
Usage: `/gsd:check-todos api`

### User Acceptance Testing

**`/gsd:verify-work [phase]`**
Validate built features through conversational UAT.

- Extracts testable deliverables from SUMMARY.md files
- Presents tests one at a time (yes/no responses)
- Automatically diagnoses failures and creates fix plans
- Ready for re-execution if issues found

Usage: `/gsd:verify-work 3`

### Milestone Auditing

**`/gsd:audit-milestone [version]`**
Audit milestone completion against original intent.

- Reads all phase VERIFICATION.md files
- Checks requirements coverage
- Spawns integration checker for cross-phase wiring
- Creates MILESTONE-AUDIT.md with gaps and tech debt

Usage: `/gsd:audit-milestone`

**`/gsd:plan-milestone-gaps`**
Create phases to close gaps identified by audit.

- Reads MILESTONE-AUDIT.md and groups gaps into phases
- Prioritizes by requirement priority (must/should/nice)
- Adds gap closure phases to ROADMAP.md
- Ready for `/gsd:plan-phase` on new phases

Usage: `/gsd:plan-milestone-gaps`

### Configuration

**`/gsd:settings`**
Configure workflow toggles and model profile interactively.

- Toggle researcher, plan checker, verifier agents
- Select model profile (quality/balanced/budget)
- Updates `.planning/config.json`

Usage: `/gsd:settings`

**`/gsd:set-profile <profile>`**
Quick switch model profile for GSD agents.

- `quality` — Opus everywhere except verification
- `balanced` — Opus for planning, Sonnet for execution (default)
- `budget` — Sonnet for writing, Haiku for research/verification

Usage: `/gsd:set-profile budget`

### Utility Commands

**`/gsd:audit-tests`**
Run an on-demand test suite health check.

- Spawns the gsd-test-steward agent to analyze redundancy, staleness, and budget status
- Produces a test health report without requiring a full milestone audit
- Requires `test.steward: true` in config (enabled by default)

Usage: `/gsd:audit-tests`

**`/gsd:cleanup`**
Archive accumulated phase directories from completed milestones.

- Identifies phases from completed milestones still in `.planning/phases/`
- Shows dry-run summary before moving anything
- Moves phase dirs to `.planning/milestones/v{X.Y}-phases/`
- Use after multiple milestones to reduce `.planning/phases/` clutter

Usage: `/gsd:cleanup`

**`/gsd:help`**
Show this command reference.

**`/gsd:update`**
Update GSD to latest version with changelog preview.

- Shows installed vs latest version comparison
- Displays changelog entries for versions you've missed
- Highlights breaking changes
- Confirms before running install
- Better than raw `npx get-shit-done-cc`

Usage: `/gsd:update`

**`/gsd:join-discord`**
Join the GSD Discord community.

- Get help, share what you're building, stay updated
- Connect with other GSD users

Usage: `/gsd:join-discord`

## Files & Structure

```
.planning/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── RETROSPECTIVE.md      # Living retrospective (updated per milestone)
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── milestones/
│   ├── v1.0-ROADMAP.md       # Archived roadmap snapshot
│   ├── v1.0-REQUIREMENTS.md  # Archived requirements
│   └── v1.0-phases/          # Archived phase dirs (via /gsd:cleanup or --archive-phases)
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Workflow Modes

Set during `/gsd:new-project`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime by editing `.planning/config.json`

## Planning Configuration

Configure how planning artifacts are managed in `.planning/config.json`:

**`planning.commit_docs`** (default: `true`)
- `true`: Planning artifacts committed to git (standard workflow)
- `false`: Planning artifacts kept local-only, not committed

When `commit_docs: false`:
- Add `.planning/` to your `.gitignore`
- Useful for OSS contributions, client projects, or keeping planning private
- All planning files still work normally, just not tracked in git

**`planning.search_gitignored`** (default: `false`)
- `true`: Add `--no-ignore` to broad ripgrep searches
- Only needed when `.planning/` is gitignored and you want project-wide searches to include it

Example config:
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

### Test Suite Management

**`gsd test-count [--phase N] [--json] [--plain]`**
Count test cases across the project (standalone CLI command).

- Counts individual `it`/`test` blocks in test files
- Filter by phase with `--phase N`
- JSON output with `--json` for scripting

Usage: `gsd test-count` or `gsd test-count --phase 30`

### Test Configuration

Configure the dual-layer test system in `.planning/config.json` under the `test` key:

| Setting | Options | Default | What it Controls |
|---------|---------|---------|------------------|
| `test.hard_gate` | `true`, `false` | `true` | Run test suite after each task commit during execution |
| `test.acceptance_tests` | `true`, `false` | `true` | Gather acceptance tests during discuss-phase |
| `test.budget.per_phase` | integer | `50` | Per-phase test count budget (warnings at 80%) |
| `test.budget.project` | integer | `800` | Project-wide test count budget (warnings at 80%) |
| `test.steward` | `true`, `false` | `true` | Enable test steward during audit-milestone |
| `test.command` | string | auto-detected | Override test runner command |
| `test.framework` | string | auto-detected | Override framework detection (jest, vitest, mocha, node:test) |

All test settings use zero-config defaults. Omitting the entire `test` section is equivalent to enabling all features with default values.

Example config:
```json
{
  "test": {
    "hard_gate": true,
    "budget": {
      "per_phase": 50,
      "project": 800
    }
  }
}
```

## Common Workflows

**Starting a new project:**

```
/gsd:new-project        # Unified flow: questioning → research → requirements → roadmap
/clear
/gsd:plan-phase 1       # Create plans for first phase
/clear
/gsd:execute-phase 1    # Execute all plans in phase
```

**Resuming work after a break:**

```
/gsd:progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/gsd:insert-phase 5 "Critical security fix"
/gsd:plan-phase 5.1
/gsd:execute-phase 5.1
```

**Completing a milestone:**

```
/gsd:complete-milestone 1.0.0
/clear
/gsd:new-milestone  # Start next milestone (questioning → research → requirements → roadmap)
```

**Capturing ideas during work:**

```
/gsd:add-todo                    # Capture from conversation context
/gsd:add-todo Fix modal z-index  # Capture with explicit description
/gsd:check-todos                 # Review and work on todos
/gsd:check-todos api             # Filter by area
```

**Brainstorming:**

```
/gsd:brainstorm                              # Start brainstorming session
/gsd:brainstorm "add caching layer"          # Start with a specific topic
```

**PR Review:**

```
/gsd:pr-review                               # Run fresh review, auto-route findings
/gsd:pr-review --ingest                      # Paste existing review summary
/gsd:pr-review --quick                       # Force quick task route
/gsd:pr-review security performance          # Focus review on specific aspects
```

**Debugging an issue:**

```
/gsd:debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/gsd:debug                                    # Resume from where you left off
```

## Getting Help

- Read `.planning/PROJECT.md` for project vision
- Read `.planning/STATE.md` for current context
- Check `.planning/ROADMAP.md` for phase status
- Run `/gsd:progress` to check where you're up to
</reference>
