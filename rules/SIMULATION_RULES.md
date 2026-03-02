# Simulation Rules Script (Canonical)

This is the single canonical RULE script for Cardboard Simulation mode.

## Rule Version
- Rule ID: `SIM_RULES_V1`
- Scope: headless simulator + in-app Simulator mode reports

## Turn Structure
Each active player turn MUST follow this order exactly:

1. **Turn Start**
   - Reset per-turn counters for the active player.
   - Reset phase-local state.
2. **Draw Step**
   - Perform exactly **one** `BASE_DRAW` for the active player.
   - Any additional draws must be explicitly tagged as `CARD_EFFECT` or `RULE_EFFECT`.
3. **Main Phase**
   - Play up to one land from hand.
   - Spend available mana from lands to cast creatures.
4. **Combat Step**
   - Active player declares attackers (all available creatures in this simplified model).
   - Defender assigns blocks.
   - Resolve simultaneous combat damage and deaths.
5. **End Step**
   - Record end-of-turn snapshot and transition turn control.

## Base Invariants
1. Exactly **one** `BASE_DRAW` per active player turn.
2. Extra draws are allowed only when explicitly attributed (`CARD_EFFECT` or `RULE_EFFECT`).
3. Phase order per turn must be:
   `TURN_START -> DRAW_STEP -> MAIN_PHASE -> COMBAT_STEP -> END_STEP`.
4. Card conservation must hold per player:
   `library + hand + battlefield + graveyard = initial deck size`.

## Reporting Contract
Simulation reports MUST include:
- Rule stamp (`rules/SIMULATION_RULES.md` + hash/version)
- Turn headers and sub-sections in this exact order:
  - Draw Step
  - Main Phase
  - Combat Step
  - End Step
- Draw attribution labels on every draw event.
- Violation section listing any invariant failures.

## Violation Policy
- In development assertions mode, invariant violations should throw immediately.
- In non-assert mode, violations should be recorded in `violations[]` and surfaced in reports.
