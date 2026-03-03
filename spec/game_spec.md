# Game spec (bootstrap)

This document captures current observable behavior to preserve while refactoring.

## Modes
- Sandbox UI supports card movement, draw, tap/tarp toggle, and deck placement.
- 2P battle mode uses room seats (`p1`, `p2`) with socket-synced state and intent application.
- Simulator runs deterministic AI-vs-AI matches with seed-driven outcomes.

## Core invariants (current baseline)
- Card IDs should not duplicate within a player's combined zones.
- Draw fails when deck is empty.
- Private zones are owner-restricted (`hand`, `deck`, `graveyard`).
- Shared stack is visible and moveable by both players.
