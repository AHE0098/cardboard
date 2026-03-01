# Headless MTG-like Simulation Engine

This folder contains a deterministic, UI-free AI-vs-AI simulator with minimal rules:
- cards are only `land` and `creature`
- creatures have `cost`, `power`, `toughness`
- one land play per turn
- all creatures attack
- defender uses deterministic block assignment
- no stack/instants/phases beyond draw/main/combat/end

## Files
- `engine.js`: core game loop, validation, deterministic RNG, batch simulator
- `ai.js`: deterministic casting and block assignment policies
- `stats.js`: aggregate metrics across many games
- `run_sim.js`: CLI runner that prints summary + writes artifacts
- `tests/run_tests.js`: minimal deterministic tests

## CLI usage
```bash
node sim/run_sim.js --iterations 1000 --seed 1337 --log summary
```

Options:
- `--iterations <n>`: batch count (default 100)
- `--seed <n>`: seed base and sample seed (default 1337)
- `--log none|summary|full`: batch game log verbosity (default summary)
- `--maxTurns <n>`: turn cap before draw (default 200)
- `--startingLife <n>`: initial life total (default 20)
- `--resultsFile <path>`: JSON summary output path (default `sim_results.json`)
- `--sampleLogFile <path>`: sample game log output path (default `sim_game_log.txt`)
- `--deckMode starter|lands-only|low-land`: choose predefined deck profiles

## Output
- Console summary table: wins, draws, win rates, avg/median turns, creatures played/died.
- `sim_results.json`: machine-readable summary including per-card stats.
- `sim_game_log.txt`: full JSON-lines event log for one sample game.

## Determinism
All randomness uses a local `mulberry32` RNG seeded from CLI `--seed` and game offset.
Running the same command twice should produce identical summaries and sample logs.

## Run tests
```bash
node sim/tests/run_tests.js
```
