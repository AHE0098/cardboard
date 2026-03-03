# Phase 0 — repo map and risk report

## Top-level map
- Runtime server/socket: `server.js`
- Browser UI: `public/` (`app.js`, `app2.js`, `deckbuilder.js`, simulator UI files)
- Simulation engine: `sim/` (`engine.js`, `ai.js`, `run_sim.js`)
- Shared definitions/schemas: `shared/`
- Rules docs: `rules/`
- Existing tests: `tests/` and `sim/tests/`

## Where logic currently lives
- Game rule transitions are mixed across `server.js` intent handlers and `sim/engine.js` turn engine.
- UI and behavior are coupled heavily in `public/app2.js` and `public/deckbuilder.js`.
- Multiplayer socket wiring and state mutation are mixed in `server.js`.

## Leaky seams
- Randomness via `Math.random` appears in runtime paths (`server.js`, client helpers).
- Server intent reducer mutates state directly inside transport layer file.
- Browser feature files combine layout/render/input/rules in single scripts.

## Build/test/deploy
- Run: `npm run dev` / `npm start`
- Tests: `npm test`, `npm run test:sim`, `npm run check:shared`
- Deployment target: Render (documented in `README.md` via onrender URL examples).

## Staged plan (reversible)
1. Guardrails: boundary checks, RNG centralization shim, invariant diagnostics, replay harness skeleton.
2. Scaffolding: target folders + docs/spec baseline.
3. ui-core shell + migrate one lowest-risk screen.
4. Extract thin core reducer and call from adapters.
5. Carve manuscripts with fixtures/tests.
6. Align 2P + simulator contracts and expand golden replays.
