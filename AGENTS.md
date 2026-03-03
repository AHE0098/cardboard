# Cardboard agent rules

## Architecture boundaries
- `core/` is deterministic engine code only (no DOM, sockets, storage, wall-clock time, or direct randomness).
- `manuscripts/` are feature slices that may depend on `core/` and `spec/` only.
- `adapters/` connect UI/network/storage to pure contracts; keep platform concerns here.
- `compositions/` are wiring-only scripts (no business logic).

## Refactor safety
- Prefer incremental commits with compatibility shims over big rewrites.
- Preserve routes and external API contracts unless adding backward-compatible aliases.
- Add/expand tests before moving risky logic.

## Determinism
- Route randomness through `shared/rng.js`.
- Simulation and replay flows must always record seed.
