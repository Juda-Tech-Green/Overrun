# Progression implementation and verification

## Delivered behavior

| Requirement | Implementation and evidence |
| --- | --- |
| Four zombie variants: Bone 60%; two wolves: Fang 50%; both witches: Eye 100%; Drowner: Pearl 100% | `progression.ts` exact drop table; Node tests check every variant and boundary; browser kills actual pooled enemies through `bulletHitZombie` |
| Floating pickups, ground shadow, walkover and touch, floating collection text | `LootSystem`; five four-frame PixelForge animations; native desktop/mobile smoke collects by tapping and walking over pickups; stacking and duplicate collection covered offline |
| Key recipe 3 Bone + 2 Fang + 1 Eye | `InventorySystem` atomic spending and permanent per-run key flag; successful native craft and insufficient/duplicate/reset Node checks |
| Locked Meadow portal and key interaction | `CastleSystem` locked arch, required-key text and contextual badge; walkover/direct entry rejection checked, native E/mobile unlock and Castle entry checked |
| Guaranteed Drowner Pearl | Shared death/drop owner; browser defeats a Drowner after portal entry and collects its Pearl |
| Dragon offering one of each faction material | `RitualSystem` range/boss/pending/material guards; offering modal, four colored flames, shake/flash/roar; native offer summons the actual boss once |
| Mobile inventory and input blocking | 48px Backpack/X/action targets and >=48px slots, outside dismissal; keyboard and touch smoke; laser and mobile controls suppressed while inventory is open |
| Responsive layout | Reviewed 924×412, 390×844, 480×320 and 390×320 inventory captures; short layouts preserve target sizes and keep recipe above action button; narrow screens put Backpack below Menu |
| Shared keyboard/touch interaction | `interaction.ts` owns dragon/portal/enter contexts and single dispatch; native desktop/mobile progression smoke |
| Scene restart | All counts/key, locked portal, pickups and ritual reset; two browser restarts per platform; explicit audio destruction at shutdown |
| Architecture | Game remains the composition root; new state in Inventory/Loot/Ritual systems, type-only GameScene imports, side-effect-free constructors; architecture guide updated |
| Editable art and safe exports | PixelForge sources, operation batches, specs, semantic contracts and contact sheets retained; native Phaser atlas bundles integrated through Preloader/AnimationsSystem |

## Checks

- `npm run typecheck` and `npm test` (77 tests).
- `npm run build`.
- `validate-project.mjs` and `validate-export.mjs` for items, altar-dragon and
  portal-progress: no errors or warnings, decoded export pixels match sources.
- PixelForge semantic contracts check required animation/layer coverage, exact
  source durations, visible entries and distinct animation phases.
- PixelForge bounded diff confirms original portal frames frame-0 through frame-3
  remain unchanged; only four new frames and one palette color are added.
- Ground-pickup visible bounds are checked to be <=24×24 in padded 32px atlas cells.
- Contact sheets and actual game screenshots reviewed separately from validators.
- `tests/game-progression-smoke.cjs`: native desktop/mobile progression, tap and
  walkover pickups, crafting, portal, Pearl, ritual, UI sizes/dismissal and restart.
- `tests/game-mobile-smoke.cjs`: existing multitouch combat, both magazines,
  first aid, vendor, touch menus, rotation/cancellation and restart.
- `tests/game-aim-smoke.cjs`: existing world/UI zoom, both weapons, actual wall
  collision, aim laser, aid HUD and restart.
- `tests/game-browser-smoke.cjs`: existing desktop movement, chat, menu,
  fire/reload, shop, spawning, boss overlap and restart.

Browser scenarios use controlled encounters/random rolls and temporarily suppress
unrelated autonomous combat for layout assertions. They do not constitute a full
balanced playthrough. Art uses the local PixelForge CLI/native Phaser path; the
environment helper's uncertain adapter-peer warning does not apply to this path.
Physical phones and browser engines other than Chromium remain untested.
