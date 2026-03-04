---
created: 2026-03-04T03:15:04.861Z
title: Add GSD-integrated brainstorming skill variant
area: planning
files:
  - ~/.claude/get-shit-done/workflows/
  - ~/.claude/skills/superpowers/brainstorming.md
---

## Problem

The current `superpowers:brainstorming` skill runs a brainstorming session and writes a plan file, but it's disconnected from the GSD workflow system. When a user wants to brainstorm a new feature/project and then immediately begin working on it through GSD, they have to manually bridge the gap — running brainstorming separately, then calling `/gsd:new-project` or `/gsd:new-milestone` to set things up.

We need a GSD-native brainstorming variant that:
1. Runs the full brainstorming session (intent exploration, requirements, design)
2. Writes the plan/spec file as normal
3. Automatically transitions into creating a new GSD milestone from the brainstorming output
4. Seeds the milestone with the brainstormed requirements and context

## Solution

Create a new GSD skill/workflow (e.g., `gsd:brainstorm` or `gsd:new-from-brainstorm`) that:
- Wraps or invokes the existing brainstorming process
- After the plan file is written, feeds its output into the GSD milestone creation flow (`/gsd:new-milestone` or `/gsd:new-project`)
- Bridges the brainstorming output format to GSD's expected input (PROJECT.md / roadmap structure)
- Maintains the "thought → capture → execute" flow without manual handoff
