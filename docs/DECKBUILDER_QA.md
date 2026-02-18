# Deckbuilder QA Checklist

**Version/Date:** post-deploy QA (2026-02-18)

## Preconditions
- Clear local storage keys: `cb_players`, `cb_decks_v1`, `cb_battle_deck_p1`, `cb_battle_deck_p2`, `cb_save_<playerId>`.
- Reload app and create/select a player.
- Open deckbuilder mode and enable **QA Mode** toggle.

## Test Cases + Expected Results + Observed Notes

### B1) Deckbuilder controls (change -> build/refresh -> save -> load)
- [x] Mode selector Quick/Guided/Advanced/Remix.
  - Expected: selection persists and appears after reload/load.
  - Observed: persisted in settings payload and restored on load.
- [x] Deck size slider.
- [x] Land count slider.
- [x] Color selection + lock colors toggle.
- [x] Allow duplicates toggle.
- [x] Curve preset + enforce curve toggle.
- [x] Power level slider.
- [x] Seed update + reroll.
- [x] Build Deck + Optimize buttons.
- [x] Lock lands + per-land counts + Randomize Deck.
- [x] Deck overview and inspector still render.

Expected for all above:
- No blank screen.
- Settings affect build/randomize behavior.
- Save/load restores both deck contents and settings state.

Observed failures fixed:
- Load previously restored cards but not settings; now settings are stored under `source.settings` and restored on load.

### B2) Saved deck CRUD
- [x] Save new deck with unique name.
- [x] Save same name again.
  - Behavior: stable overwrite for selected deck id; otherwise new id by timestamp.
- [x] Rename saved deck.
- [x] Duplicate saved deck.
- [x] Delete saved deck.
- [x] Load saved deck.
- [x] Save/load from each mode setting variant.

Persistence checks:
- [x] Hard refresh retains decks (`cb_decks_v1`).
- [x] Player switch respects per-player app save pointer data.
- [ ] Mobile pass (manual browser-device validation still required).

### C) 2P integration contract
Contract implemented:
- Deckbuilder can assign decks via **Use for Player 1** / **Use for Player 2**.
- If not in battle, assignment is cached in `cb_battle_deck_p1` / `cb_battle_deck_p2`.
- If already in battle, assignment updates selected player's deck zone and emits `SET_DECK` intent for sync.

### C3) 2P scenario matrix
- [x] Scenario 1: Build/save QA_P1 -> Use for P1 -> start battle -> P1 deck populated.
- [x] Scenario 2: Save QA_P2 -> Use for P2 -> join as P2 -> P2 deck populated.
- [x] Scenario 3: Assign both before battle -> each side gets correct deck.
- [x] Scenario 4: Assign while in battle -> deck zone updates without wiping hand/graveyard.
- [x] Scenario 5: Load saved deck in deckbuilder then assign in battle -> survives refresh via local cache.
- [x] Scenario 6: Multiplayer sync path present via server `SET_DECK` intent.

## Failure Criteria
- Any control click does nothing (and no QA status change).
- Save/load mismatch in card totals.
- Assigned deck lands in wrong player zone.
- Opponent assignment leaks onto the wrong side.
- Any uncaught runtime exception or blank-render state.

## Notes
- QA panel displays wiring status, current mode, current player id, last action, and last assignment IDs.
- Built-in library decks are read-only until copied to saved decks.
- Export uses normalized deck list (`normalizeDeckList`) for stable round-trip format.
