# Cardboard

## How to run locally

1. Install dependencies:
   - `npm install`
2. Start the app server:
   - `npm run dev`
3. Open:
   - `http://localhost:3000`

### Realtime battle test

1. Open two browser windows (or two devices) to the same URL.
2. In each client, choose/create a player from **Player Menu**.
3. In one client, enter **2P Battle Mode** and click **Create room**.
4. In the other client, enter **2P Battle Mode**, paste the room code, and click **Join room**.
5. Move cards / draw / tap cards and verify both clients update in realtime.


### Headless sim API (works on Render too)

A deterministic AI-vs-AI simulation endpoint is available from the same server process:

- `GET /api/sim/run`

Example local call:

- `curl "http://localhost:3000/api/sim/run?iterations=200&seed=1337&deckMode=starter&log=summary"`

Example Render call:

- `curl "https://<your-render-service>.onrender.com/api/sim/run?iterations=1000&seed=1337&deckMode=starter&log=none"`

Optional query params:

- `iterations` (1-10000, default 100)
- `seed` (default 1337)
- `maxTurns` (default 200)
- `startingLife` (default 20)
- `deckMode` (`starter|lands-only|low-land`)
- `log` (`none|summary|full`)
- `includeSampleLog=1` to include full sample game log in JSON response


### In-app Simulator mode

A new **Simulator Mode** is available in the Main Menu.

1. Open app and select a player.
2. Click **Simulator Mode**.
3. Select Deck A and Deck B from saved/library decks.
4. Set iterations/seed/max turns/life/log mode.
5. Click **Run Simulation**.
6. Review summary stats, per-card table, and single-game report.
7. Use **Copy JSON** / **Copy Report** to export results.


- `GET /api/sim/rules` returns canonical rules text + hash/mtime used by Simulator mode.
