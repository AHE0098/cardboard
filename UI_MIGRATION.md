# UI Migration Guide

## Platform summary
The UI now mounts through a shared platform layer loaded by both `public/index.html` and `public/sandbox.html`:
- `public/ui-core.css`: shell/tokens/layout primitives.
- `public/ui-core.js`: input intent hub, pointer-capture drag helper, toast API, viewport safe-area handling, smoke harness.
- `packages/ui-core/src/*`: source mirror for future packaging.

## App shell contract
- `body` is locked (`overflow: hidden`) to avoid accidental background scrolling.
- `.ui-shell` fills `--app-vh` (`visualViewport` aware) and applies safe-area insets.
- `.ui-main` is the single primary scroll container for each screen.
- Modals/inspectors own internal scroll regions.

## How screens should be built
1. Compose screen content under `#root` (inside `.ui-main` only).
2. Use `ui-stack`, `ui-row`, `ui-grid`, `ui-panel`, `ui-scrollable-list` primitives.
3. Use tap-friendly controls (`ui-btn`/`.menuBtn`) with min 44px target.
4. Register back navigation through `UICore.createIntentHub().on("back", ...)`.
5. For drag actions, use `UICore.attachPointerDrag(...)` for pointer capture consistency.

## UI Smoke Harness
A dev-mode harness is available from **Main Menu → UI Smoke Harness**. It validates:
- long-list scrolling,
- tap target grid,
- shell consistency and viewport behavior,
- toast interaction feedback.

## Migration notes
- Existing feature flows (deckbuilder, sandbox, 2P battle, simulator) are kept route-compatible.
- Legacy rendering remains in `app2.js`, but now runs inside a standardized shell.
- Further migration should move ad-hoc screen markup to pure ui-core primitives over time.
