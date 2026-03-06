---
created: 2026-03-06T06:41:42.176Z
title: Add result parsing to CLI autopilot steps
area: tooling
files: []
---

## Problem

The GSD CLI autopilot feature currently dumps raw JSON output after each phase step completes. Users have no quick way to understand what happened — they see a wall of JSON instead of a concise summary of the phase result. This makes the autopilot experience feel unpolished and hard to follow.

## Solution

Parse the JSON result from each autopilot step and extract the important fields to surface to the user. Pretty-print a summary that includes key information like phase name, completion status, key outcomes, and any errors or warnings. Keep the raw JSON available for debug/verbose mode but default to a human-readable format.
