# Migration plan (incremental)

1. Keep existing entrypoints/routes; introduce new boundaries beside current code.
2. Move deterministic reducer logic into `core/` in thin slices while adapters keep old API shape.
3. Move one UI screen at a time onto `packages/ui-core` shell primitives.
4. Promote high-value rule bundles into `manuscripts/` with scenario fixtures.
5. Keep golden replay tests green for every extraction commit.
