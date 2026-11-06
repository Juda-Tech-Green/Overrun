# Working on this game

Read `docs/game-architecture.md` before changing gameplay. It describes system
ownership, initialization/update ordering, restart behavior, and verification.

- Keep `src/game/scenes/Game.ts` as the composition root. Implement feature logic
  and state in the owning module under `src/game/systems/`.
- Preserve unrelated working-tree changes, including generated sprite assets.
- Use type-only imports of `GameScene` in systems to avoid runtime import cycles.
- Keep Phaser callbacks bound to their owning system. Constructors must not use
  scene plugins or other systems; those are initialized during `create()`.
- Reset new per-run state explicitly and test scene restart. Phaser owns scene
  objects, timers, tweens and input listeners; external resources need explicit
  shutdown cleanup.
- Run `npm run typecheck`, `npm test`, and `npm run build`. For gameplay/input or
  lifecycle changes, also run the documented browser smoke test.
- Update the architecture guide when ownership, lifecycle, controls or validation
  workflow changes. Report what was tested and any remaining limits.
