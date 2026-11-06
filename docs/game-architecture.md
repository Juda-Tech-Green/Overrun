# Gameplay architecture and implementation workflow

## Refactor record — 2026-11-01

The working-copy `Game.ts` contained 3,123 lines: all state, world generation,
input, combat, UI, chat, and boss behavior in one Phaser scene. The refactor keeps
`GameScene` and the `Game` scene key, but moves implementation and state into
composed systems. The scene now constructs systems, resets the run, creates
objects in dependency order, configures the camera, and delegates frame updates.
No assets, balance values, keyboard bindings, or animation keys were redesigned.

The extraction was performed against the existing working copy, not Git HEAD,
because that copy contained substantial unfinished asset/gameplay work. Methods
and field accesses were migrated together, then the long update method was split
into domain phases. The old `ZOMBIE_VARIANTS` and `ZombieVariantConfig` exports
remain re-exported from `Game.ts` for compatibility; new code should import their
canonical definition from `systems/enemy-variants.ts`.

One pre-existing compiler error was fixed: enemy death called the nonexistent
`updateShopDisplay`. It now calls `shop.updateShopElements`, the existing shop
refresh implementation. Redundant literal ammo resets were also removed in favor
of the existing ammo constants. Browser verification also exposed a pre-existing restart crash: HUD creation
refreshed destroyed shop text before shop recreation. `ShopSystem.reset()` now
clears its container reference, so refresh waits for the new UI. Other reset
semantics were preserved.

## Ownership map

All paths below are relative to `src/game/`.

| Module | Responsibility and owned state |
| --- | --- |
| `scenes/Game.ts` | Composition, creation order, camera/world bounds, local kill balance |
| `systems/CompanionSystem.ts` | Cosmetic dog, bounded follow trail, directional animation and shadow; no combat/physics membership |
| `systems/GameplaySystem.ts` | Death/modal gates, keyboard shortcuts, ordered frame phases |
| `systems/ControlsSystem.ts` | Key objects and keyboard/pointer event registration |
| `systems/MobileControlsSystem.ts` | Camera-fixed joysticks/action buttons, touch ownership, analog movement, retained aim and queued contextual interactions |
| `systems/ViewportSystem.ts` | Responsive HUD layout, separate UI camera, 2× world zoom, desktop cursor and resize lifecycle |
| `interaction.ts` | Shared keyboard/touch interaction ranges, contextual target lookup and one-shot dispatch |
| `systems/WorldSystem.ts` | Tilemap, scenery, obstacle groups/locations, depth sorting |
| `systems/AnimationsSystem.ts` | Idempotent animation registration from cached asset metadata |
| `systems/PlayerControllerSystem.ts` | Player sprite, health, medkits inventory, character/facing, movement, damage/death, healing and healing FX |
| `systems/WeaponsSystem.ts` | Bullet pool, ownership, magazines, reload, switching, shared muzzle trajectory and firing |
| `systems/AimingSystem.ts` | World-space laser, collision-clipped impact marker and nominal shotgun spread guides |
| `aim-ray.ts` | Pure ray intersections against Arcade rectangle/circle body geometry |
| `systems/WitchSystem.ts` | Bottom-center cauldron territory, ranged witch AI, hostile potion pool and impacts |
| `systems/EnemiesSystem.ts` | Enemy group, directional animation, spawning, AI and hit/death rewards |
| `systems/enemy-variants.ts` | Enemy definitions and undead/werewolf subsets |
| `systems/AltarsSystem.ts` | Shrine sprites/prompts, proximity, spawn timers and auto-spawn preference |
| `systems/CollisionsSystem.ts` | Physics collider/overlap wiring after entity groups exist |
| `systems/HudSystem.ts` | Portrait, health, ammo, first-aid counter, score and notices |
| `systems/DeathScreenSystem.ts` | Enemy-specific game-over artwork, fatal-cause copy and camera-fixed death overlay |
| `systems/MenuSystem.ts` | Pause menu and menu state |
| `systems/ShopSystem.ts` | Vendor, proximity, shop UI (Shotgun & First-Aid Kit), purchases and shop state |
| `systems/ChatSystem.ts` | Chat UI, command routing, messages and cursor timer |
| `systems/BossSystem.ts` | Dragon state, attacks/fireballs, damage and boss bar |
| `player-facing.ts` | Shared pure directional/animation naming helpers |
| `constants.ts` | Shared tuning and map coordinates |

Each system receives the scene through its constructor. The scene is a typed
composition context: systems use its Phaser plugins and explicit sibling APIs
(e.g. `scene.weapons.setWeapon`). Systems import `GameScene` with `import type`,
so these references do not create runtime import cycles. No mixins, prototype
patching, global singleton state or dynamic method installation are used.

This intentionally keeps direct, typed cross-system collaboration. It is not a
fully isolated ECS or dependency-injection framework. Public state is owned by
one system, but some other systems still read/write it. Prefer owner methods for
new transitions; if a feature grows, introduce a narrow interface for its actual
collaborators rather than enlarging the scene or adding an untyped event bus.

## Lifecycle contract

1. System constructors only retain the scene and initialize plain state. Do not
   create Phaser objects or access sibling systems from constructors.
2. `GameScene.create()` resets score and calls feature `reset()` methods. Systems
   survive `scene.restart()`; constructor field defaults do not run again.
3. Register animations, build map/scenery, create altars/vendor/player and companion, then combat
   groups, then wire collisions and input. Create spawner and HUD/shop/chat last.
   HUD creation also builds menu and game-over UI. Finish with world/camera bounds.
4. `GameplaySystem.update()` handles death, chat, shop and menu gates first. Normal
   phases run in order: movement → firing → altar proximity → vendor proximity →
   depth sorting → enemy AI → boss AI → bullet cleanup. Keep the order explicit.
5. Phaser destroys scene display objects and shuts down its physics, clock, tweens
   and input plugins on restart. Its input/keyboard plugins remove their listeners.
   Do not add duplicate global cleanup or register DOM listeners without a matching
   shutdown handler. Resources outside Phaser's scene lifecycle need explicit
   disposal using a scene shutdown hook.

Methods passed as callbacks are arrow properties, retaining their system receiver
when Phaser invokes them with a callback scope (which can still be the scene).
Do not change those to unbound prototype methods. Delayed callbacks access the
owning system's current state, just as the original scene callbacks did.

Reset behavior preserves existing preferences: auto-spawn enablement/interval and
some tuning values survive restart. Proximity timestamps also retain their prior
values. If changing restart semantics, make that a deliberate behavior change
with tests rather than silently changing it during another extraction. Chat
messages are rebuilt by `createChatUI`; world location arrays by world creation.

Returning early for chat/shop suppresses gameplay update work, but does not pause
all physics/timers; the pause menu explicitly controls physics. This distinction
is inherited behavior. Do not assume all overlays have identical pause semantics.

## Shared firing input

`ControlsSystem` sends immediate left-click requests to
`WeaponsSystem.requestFireAt`; held left-click and Space use the same method
from `updateFiring`. The owner checks modal/death/reload gates and reserves the
weapon's cooldown before emitting projectiles through `fireBulletAt`. The click
event uses the scene clock; frame polling passes Phaser's update timestamp.
This prevents a click event and its following frame from consuming two rounds,
while retaining quick taps and continuous fire. Right-click does not fire.
Each accepted rifle shot or shotgun blast consumes one magazine round; shotgun
pellet count/spread is unchanged. The existing weapon reset clears the cooldown.

Offline regression coverage exercises actual registered pointer callbacks,
mouse/Space parity for both weapons, same-frame combined inputs, cooldown expiry,
quick taps, right-click rejection, overlays/reload/death and two weapon resets.
Browser gameplay testing remains with the user under their standing instruction.

## Workflow for the next implementation

1. Inspect `git status --short`, this guide, `GameScene.create()`, and the relevant
   owning system. Keep unrelated changes intact. Search TypeScript only when
   looking for runtime code (`rg ... src/game -g '*.ts'`); sprite JSON is large.
2. Define the behavior change and identify state ownership. Add configuration to
   `constants.ts` or a feature data module; add state to its owning system.
3. Implement through the owner's methods. For a new system, construct it in the
   scene, use a type-only scene import, and add explicit creation/reset/update
   calls at the correct dependency points. Do not put implementation back in
   `Game.ts` or create another all-purpose manager.
4. If extracting more logic, move behavior and state together, update every call
   site, preserve callback binding, guards and phase order, then typecheck before
   continuing. Avoid combining balance changes with structural work.
5. Add focused regression coverage for affected transitions, callbacks or state
   invariants. Test restart twice when changing input, timers or UI lifecycle.
6. Run the checks below. Review diffs and update this ownership/lifecycle guide
   when the implementation changes those contracts. Include validation results
   and limitations in the handoff.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

`npm test` uses Node's built-in test runner and the already installed TypeScript
transpiler. It supplies a small Phaser input stub so domain tests need no browser.
It covers magazine preservation/reload cancellation and detached callbacks, shop
funds/ownership, weapon reset, and frame ordering/modal/death gates. It does not
simulate rendering or Arcade physics. Vite's production build does not replace
TypeScript checking.

For real Phaser integration, run a dev server and the optional browser test:

```sh
npm run dev -- --host 127.0.0.1
# In another terminal; install test tooling outside the repo if not installed:
npm install --prefix /tmp/pixelforge-refactor-tools playwright --no-audit --no-fund
/tmp/pixelforge-refactor-tools/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/pixelforge-refactor-tools/node_modules \
  GAME_URL=http://127.0.0.1:8080 node tests/game-browser-smoke.cjs
```

Use the URL printed by Vite (it chooses another port if 8080 is busy). The test
intercepts only the test browser's bootstrap to expose the game instance; no test
global is added to production code. It exercises boot, movement, character switch,
chat/heal, menu, fire/reload, shop, altar spawning, dragon summon/physics overlap,
and two restarts while checking uncaught browser errors.

For visual/manual QA, also inspect directional player/enemy animations, obstacle
collisions, shotgun spread, boss attacks/death, HUD placement and game-over restart.
The smoke test is not exhaustive visual or balance verification.

## Validation completed for this refactor

- `npm run typecheck`: passed.
- `npm test`: all five regression tests passed, including the destroyed shop UI
  reference regression discovered during browser QA.
- `npm run build`: passed.
- Chromium browser smoke: passed boot, movement, character switching, chat/heal,
  menu, rifle fire/reload, shotgun purchase, altar spawning, dragon physics overlap,
  and two scene restarts; no uncaught browser errors.
- Final `Game.ts`: 80 lines; feature system files range from 106 to 360 lines.
- Full visual/balance QA (including every enemy variant and boss death sequence)
  was not exhaustive; use the manual checklist above for feature-specific changes.

## Cosmetic companion — 2026-11-01

`GameScene` composes `CompanionSystem`, resets its per-run trail/facing, and creates
the dog after the player. Scene updates call the companion after normal gameplay,
passing Phaser delta time. The companion independently respects death/chat/shop/menu
gates and remains an idle, living display object during player death. Phaser owns
its sprite/shadow lifecycle; reset/create rebuilds references and breadcrumb state
on every restart. There are no timers, DOM listeners or external resources.

The dog is a regular display sprite, with no Arcade body, health or combat group
registration. Enemy/boss targeting and existing collision wiring are unchanged.
The bounded player trail gives aesthetic following rather than obstacle pathfinding.
Character switches reuse the player sprite, so the dog follows the current character.

Local companion regression tests cover following/resting, modal/death gates,
character switching, bounded history/teleport recovery, two restarts and all eight
animation directions. Asset source/export validators and static build/type checks
are also run. Browser smoke is intentionally omitted for this addition under the
user's standing request to leave gameplay validation to them. Existing refactor
browser results above concern the earlier implementation, not this feature.

## Dragon/projectile corrections — 2026-11-01

The dragon uses 512×512 source frames at scale 0.5, giving a 256 px display-frame
height: four times the player's 64 px frame height at scale 1. Idle, flight,
attack, hurt and death share this scale. Physics dimensions remain source-frame
coordinates and scale with the sprite; fireball mouth offsets and the contact
radius also track the larger scale. Dragon animation registration now retains
all exported per-frame durations, including the longer death frames.

The installed Phaser Arcade `World.collideHandler` normalizes a group-versus-
sprite pair to sprite-versus-group. Its callback therefore receives the single
sprite first. The former dragon handler assumed bullet-first and could play
`dragon-hurt`/`dragon-die` on a moving bullet, producing phantom dragons and
contaminating pooled projectile presentation. `BossSystem` now registers the
boss first, resolves it by identity regardless of callback order, and requires
bullet-group membership before accepting damage. It removes the boss overlap on
death/resummon. Corpse sprites cannot consume bullets or award repeated rewards.

Hurt recovery follows animation completion and stops the boss's velocity while
hurt. Delayed attack callbacks retain their originating dragon identity. An old
hurt/attack callback cannot revive a corpse or affect a new summon, and an old
boss-bar fade callback can only destroy the bar it captured.

`WeaponsSystem.prepareProjectile` stops old animation, restores texture/frame,
tint, alpha and mirroring, enables the body, and assigns a new per-object spawn
generation. `retireProjectile` accepts pool members only, stops their animation
and velocity, disables physics, then hides them. Rifle/shotgun lifetime callbacks
check generation so an old timer cannot retire a newly reused projectile.
Enemy, environment, boss and offscreen cleanup use the owner's retirement method.
The vendor's sprite/group collider also explicitly places the vendor first and
uses its second callback argument as the bullet.

Verification: Node regression tests cover both boss callback orders, foreign
sprites, hurt-to-flight, lethal hits, corpse behavior, pooled rifle/shotgun reuse,
stale expiry timers, old/new boss callbacks, scale across actions, and source
animation durations. TypeScript and production build are checked separately.
These are offline checks with adapters; browser smoke/manual rendering remains
unrun for this change under the user's standing instruction to validate gameplay
themselves. To validate manually: summon the dragon, shoot it repeatedly with
both weapons, defeat it, keep shooting, then summon another dragon. Only the boss
should ever display dragon frames; hurt should return to flight and bullets
should retain their rifle/pellet appearance after the kill.

## Directional dragon animation — 2026-11-01

The dragon now has five authored view bundles (side/front/front45/back/back45),
27 frames per view, mirrored for eight-way facing. `Preloader` loads the new
textures and metadata, `AnimationsSystem` registers `dragon-ACTION-SUFFIX` keys,
and `BossSystem` owns retained `dragonFacing`. The same boss sprite/physics body
changes animation textures; it is never added to a projectile pool or duplicated
when turning. Scale remains 0.5 on every 512 px frame (256 px display height).

Movement updates facing toward the player; attacks lock that direction and
capture their precise completion key. Hurt/death retain the last direction.
Per-view muzzle anchors in exported game metadata supply mirrored/scaled
fireball origins. Existing boss identity, pooled bullet reset, corpse overlap
removal and stale callback guards are retained. Action frame counts increased to
6 idle / 8 flight / 6 attack / 2 hurt / 5 death, while total action durations
remain 1040 / 640 / 880 / 180 / 1210 ms respectively.

`src/game/assets-src/dragon/README.md` documents the editable sources, shared drawing
model, operation batches, targeted view generation, staged export, compact
inspection and semantic wing/foot checks. Individual 4096×2048 atlases avoid a
single oversized combined texture. All views now share the selected hand-authored
style; the previously imported detailed side painting has been retired.
Node tests cover facing, directional completion, loading, timing and mouth
anchors alongside the preceding projectile regressions. Source/export pixel
checks, local visual renders, typecheck and build provide additional evidence.
Browser gameplay validation remains with the user under the standing instruction.

## Dragon style consistency — 2026-11-01

The user selected the newer authored views as the canonical dragon design. The
main east/west profile now uses the same procedural anatomy, membrane texture,
scales and palette as front/back/45° views, replacing the imported detailed art.
The four approved directional projects remain unchanged. The generator no longer
reads a painted seed or imports a reference image; the legacy seed and image
importer were removed. Side animation names, 27-frame count, action durations,
512px canvas, origin, collision geometry and 0.5 scale remain unchanged. Only the
side mouth anchor moves to (400, 222) to follow the new profile; the runtime
fallback and source specification match it. Existing preload/registration keys
continue to load the replaced atlas and animation frames.

Semantic motion checks now examine the shared base layer for every view rather
than expecting the retired wing-rig layer. Regression checks retain all-facing
combat, projectile and restart coverage, and additionally require the main view
to use the common layer/palette/animation structure. Browser testing stays with
the user under the existing instruction.

## Continuous mouse aiming — 2026-11-01

WASD/arrows control movement independently of facing. `PlayerControllerSystem`
faces the pointer continuously from the character's upper-body origin (y − 33),
using the existing eight-direction poses for idle, strafing and reload animations.
Turning during a shot switches directional animation while retaining animation
progress; hurt/death poses and existing modal gates remain protected.

`ControlsSystem.aimPointer()` reprojects screen coordinates through the main
camera on every use, including while the mouse is stationary and the camera moves.
Immediate clicks, held left-click and Space all target those same exact world
coordinates through the existing shared firing cooldown. Sprite facing uses eight
sectors; projectile trajectories still aim precisely at the cursor.

Offline regressions cover all eight facings, backward strafing, moving reloads,
camera scrolling with a stationary pointer, shoot progress, hurt locking, and
matching click/held/Space targets. Browser/gameplay validation remains with the
user under the standing instruction. Manually check idle mouse tracking, movement
opposite the cursor, both weapons/characters, reload turns, and aim while scrolling.


## Briar Witch enemy — 2026-11-01

`WitchSystem` owns the new cauldron at `(MAP_WIDTH / 2, MAP_HEIGHT - 160)` =
`(960,1120)`. World generation clears grass/decorations within 110 px and excludes
all four solid scenery types within 185 px, leaving side spawn lanes open.
Approaching within 260 px spawns a witch every 4800 ms, up to six active witches;
[E] within 100 px bypasses the automatic cooldown but still respects the in-flight
summon lock and population cap. The cauldron plays idle/active/summon animations
and blocks actors and player bullets. It remains distinct from the existing two
stone altars and is not added to their random variant tables.

Scene creation resets the feature and creates it after the common enemy/bullet
pools and player exist. Witches join the existing enemy group, so obstacle
collisions, bullet damage, eight-way facing/animations, hurt/death, depth and kill
rewards use the existing implementation. The enemy dispatcher routes live witches
to `updateEnemy` after shared dead/hurt/attack guards, bypassing melee logic.
Other enemy variants and their altar selection remain unchanged.

Tuning is in `WITCH_TUNING`: 4 HP, 95 px/s movement. Witches pursue outside 280 px,
retreat below 180 px while facing the player, and hold the intervening distance.
Within 180–310 px, a witch can start a 720 ms throw animation every 1700 ms. The
player's upper-body position is captured at windup start. After 320 ms a bottle
leaves the exported directional hand anchor, flies at 260 px/s toward that fixed
point, and lands there (or collides earlier). This is dodgeable aim rather than
homing. Cast IDs, variant checks and state guards prevent an interrupted/dead or
reused witch from emitting stale throws. Facing remains locked during the cast.

Potions use their own bounded pool (32), never the player bullet group. Impact
on player/scenery or landing creates a short green splash; one impact can deal
1 HP within 42 px of the player's upper body, through the existing hurt immunity.
Retirement stops animation/spin/velocity, disables the body and hides the object.
Reuse restores texture, origin, scale, rotation, tint and physics. Landing deadlines
live on the projectile, so no stale pooled-projectile timer can retire a reuse.

`GameScene.update()` runs witch housekeeping after normal gameplay even behind
modal gates. It freezes witch movement and potion travel/landing deadlines for
chat/shop/menu and retires all bottles on player death. Pending throws skip their
release while suspended. Phaser owns colliders, display objects, animation
listeners and scene timers; reset/create clears run state and rebuilds the pool.
Only old animation listeners are removed on enemy reuse, retaining destruction
listeners owned by Phaser/data managers.

`Preloader` loads all three bundles; the shared animation registry preserves their
explicit frame durations. Five authored views, mirrored to eight compass facings,
provide idle/walk/throw/hurt/death for both combat and retreat. See
[`witch/README.md`](../src/game/assets-src/witch/README.md) for the source palette,
geometry, event/anchor contract, rebuild commands and visual previews.

Verification covers proximity/manual summons and caps, chase/hold/retreat,
eight-direction cast playback and hand anchors, windup/cooldown/interruption,
potion hits/dodges/scenery/pool reuse/modal/death behavior, shared enemy damage and
rewards, loading/registration, and scene lifecycle across two restarts. All source
projects and decoded exported pixels are checked with PixelForge validators;
contact sheet and timed animation preview are generated for visual review.
Browser playtesting remains with the user under the standing instruction.


The witch cauldron also has a matching HUD proximity sprite:
`hud/prompt-altar-witch`. `WitchSystem` owns its visibility and hover tween,
matching the zombie/werewolf plaques at scale 1.5, y−96 and depth 2000. Within the
260 px danger radius it displays the witch emblem and E keycap. All three altars
now use only their floating HUD badges: interaction and territory text objects
were removed from `AltarsSystem` and `WitchSystem`. The E keycap remains the
visual interaction cue; distance checks, manual summons and automatic spawning
are unchanged. Modal/death
states hide it, and scene creation rebuilds it on restart. The incremental
`hud/generate-witch-prompt.mjs` generator and `100-witch-prompt.ops.json` add only
this frame and its violet colors, retaining all existing HUD source frames.
Regression coverage checks the preserved keycap, exported frame, territory and
modal visibility, and two reset/create cycles. The asset README records its
rebuild/validation commands and the comparison preview path.

Final witch/altar verification: `npm run typecheck`, all 44 Node tests, and
`npm run build` pass. PixelForge source/export validation passes for witch,
cauldron, potion, and the updated HUD, including decoded source-pixel equivalence.
All 21 pre-existing HUD source frames remain byte-for-byte identical as JSON.
The only source-validator warning is the documented intentional spreading-liquid
baseline change on the potion splash. Visual contact sheets and timed playback
were generated and sampled; browser gameplay validation remains with the user.

Witch summons shake the main camera for 200 ms at intensity 0.008, matching the
zombie altar. The effect fires at the 300 ms emergence callback only when a witch
actually spawns; suspended or exhausted-pool summons do not shake the camera.

## Scarlet Witch variant and Red Potion — 2026-11-01

The witch now includes a visual variant: the Scarlet Witch (`witch-red`). She wears a
cobalt/sapphire gown and pointed wizard hat with scarlet/ruby front dress panels, corset,
cuffs and hat band, silver-platinum hair, ruby eyes, and carries a crimson red potion bottle.
She uses a dedicated projectile bundle: `witch-potion-red`, with 4 rotating flight frames and
4 expanding scarlet splash frames.

`WitchSystem` randomly spawns either the Briar Witch (`witch`) or the Scarlet Witch (`witch-red`)
from the existing bottom-center cauldron altar (`Phaser.Math.Between(0, 1) === 0 ? 'witch' : 'witch-red'`),
respecting the shared active cap (2 max) and cooldown without adding any new altars or spawn points.
Attacks by `witch-red` dynamically retrieve hand anchor metadata from `witch-red-game` and launch
`witch-potion-red`, which triggers `witch-potion-red-splash` on player, scenery or range impact.
Enemy routing in `EnemiesSystem` treats both variants identically for movement, hurt, and death rewards.

All 45 automated Node tests in `tests/game-systems.test.cjs`, `npm run typecheck`, and `npm run build` pass.
Both source projects and exported atlases achieve 100% pixel parity under PixelForge validators.



## Enemy-specific death screens — 2026-11-01

`death-causes.ts` defines four damage families and their presentation data:
zombie, werewolf, witch and dragon. `deathCauseForEnemy` groups zombie variants,
both werewolves and witch colors into the corresponding screen family. Every
current damage producer passes an explicit cause to
`PlayerControllerSystem.damagePlayer(amount, cause)`: enemy melee, witch potion
impact, dragon contact, and the registered dragon-fireball overlap callback.
The optional default is zombie for compatibility with older/direct callers;
future damage sources should always pass their intended family explicitly.

Only an accepted fatal hit sets `playerController.deathCause`. Hurt immunity and
already-dead guards reject damage before attribution; a later hit cannot replace
the fatal source. After the player's directional death animation finishes, the
captured cause is sent to `DeathScreenSystem.show(cause)`. The player's reset
clears the cause. `DeathScreenSystem.create()` rebuilds a hidden container per
run, so old artwork/copy/visibility do not survive restart.

`GameScene` composes the system and creates its UI immediately after the ordinary
HUD. The old generic banner and `HudSystem.createGameOverBanner` are removed.
The new full-viewport dimmer and 640×384 sprite panel stay fixed to the camera at
depth 40000, above chat/shop/menu. The dimmer intercepts pointer input so hidden
shop/HUD controls cannot be clicked through a death screen. Live text supplies an
enemy-specific title, `SURVIVOR DOWN` or `SCHOLAR DOWN` with the cause, and the
existing Space/R restart instruction. Keyboard restart behavior remains in the
existing death gate in `GameplaySystem`.

The four 320×192 static PixelForge frames use enemy-specific emblems, borders and
colors. They are loaded as the `death-screen` atlas by `Preloader`; they need no
animation registration. See
[`death-screen/README.md`](../src/game/assets-src/death-screen/README.md) for the
palette/layout contract, reproducible operations, staging/export workflow,
contact sheet and validation commands.

Regression coverage follows fatal hits from all zombie variants and both wolf
variants, both potion colors, dragon contact and dragon fireballs into the correct
artwork. It also verifies death-animation timing, attribution under immunity and
subsequent damage, hero-specific labels, viewport placement/input blocking, two
reset/create cycles, source/atlas loading, and both Space and R restart paths.
PixelForge source/export checks and the contact-sheet review supplement static
checks and the production build. Browser gameplay validation stays with the user
under their standing instruction.

Final death-screen verification: installed PixelForge CLI 0.4.0/environment check,
source validation, and decoded source/export equivalence all pass with no warnings.
The four layouts were rendered as individual keyframe/contact-sheet artifacts and
visually reviewed. `npm run typecheck`, all 51 offline Node tests, and
`npm run build` pass. These are source/UI-adapter checks, not a browser screenshot
or browser gameplay run; the user's manual validation preference is retained.

## Castle Prison Zone & Teleportation Portal — 2026-11-01

`CastleSystem` owns the Castle Prison dungeon zone ($X: [2400, 3424], Y: [160, 928]$)
and the mystical teleporter portal connecting it to the northern Meadow ($X: 960, Y: 80$).

The castle is laid out across a $32 \times 24$ grid of 32px tiles constructed from the complete
animated Castle Prison tileset:
1. `prison-floor`: Base stone flagstone floor with drifting dust motes (`prison-floor-idle`).
2. `prison-wall`: Solid fortress walls with water seepage drips (`prison-wall-drip`).
3. `prison-bars`: Solid cell front barriers with iron padlock rattle (`prison-bars-rattle`).
4. `prison-door`: Solid heavy wooden prison doors with creaking animation (`prison-door-idle`).
5. `prison-torch`: Wall-mounted flickering torches (`prison-torch-flicker`).
6. `prison-chains`: Wall-mounted swaying chains (`prison-chains-sway`).
7. `prison-straw`: Heaps of bedding straw settling inside prison cells (`prison-straw-settle`).
8. `prison-puddle`: Floor puddles with concentric expanding ripples (`prison-puddle-ripple`).

At the top of the Meadow map ($960, 80$), an arcane stone arch portal with an animated swirling vortex
(`portal-idle`) detects player proximity ($< 75$px) and displays `[E] Enter Castle Portal`. Stepping
directly into the vortex or pressing E teleports the player to the Castle entrance ($2912, 800$),
shifts the camera bounds to $[2400, 160, 1024, 768]$, triggers a camera flash, relocates the cosmetic
companion, and notifies the player via HUD alert and chat message. A matching return portal inside the
Castle South Gate ($2912, 864$) teleports the player back to $(960, 130)$ in the Meadow, restoring
camera bounds to $[0, 0, 1920, 1280]$.

`CollisionsSystem` wires Arcade physics colliders between the player, enemies, bullets and witch potions
against `castle.solidObstacles` (walls, bars, and doors). `CompanionSystem` dynamically clamps to active
world bounds, and `WeaponsSystem` cleans up bullets using `TOTAL_WORLD_WIDTH` ($3600$) and `TOTAL_WORLD_HEIGHT` ($1280$).

Verification: All 54 Node tests, `npm run typecheck`, `npm run build`, and the browser smoke test pass.
Source and exported bundles for `portal` and all 8 prison tiles validate with 0 errors.


## Mobile twin-stick controls — 2026-11-03

`GameScene` composes `MobileControlsSystem`, resets it per run, creates it after
HUD/chat/shop, and calls its update before gameplay's modal gates. It owns the
camera-fixed atlas images, labels, pointer assignments, analog movement vector,
retained aim direction and fire hold. The left stick moves, the right stick aims,
and the fire button sits directly above the right stick. Phaser config enables
three touch pointers in addition to its mouse pointer. No external joystick
library or DOM overlay is involved.

The UI appears on touch devices or the first touch on hybrid hardware. Mouse
movement restores mouse mode when no control is held. Touches in the world do
not aim or shoot. Each control captures its own pointer ID; another finger cannot
steal it, and dragging outside continues until release. The movement stick has an
18% deadzone and proportional speed up to PLAYER_SPEED; keyboard movement retains
its prior priority and diagonal normalization. Aim outside the deadzone sets a
normalized direction, retained when centered or released. The aim world point is
recomputed from the player's current position, so moving/camera scrolling does
not rotate the retained direction. Existing eight-way poses and hurt locks apply.

`ControlsSystem.aimPointer` provides either the retained mobile world target or
freshly projected mouse coordinates. `WeaponsSystem` polls the dedicated mouse
pointer (not the most recent touch) and the mobile fire hold. An immediate button
press and held repeats both use `requestFireAt`, preserving the shared cooldown
and one-round consumption for rifle/shotgun. Neither stick fires. Desktop
mouse/Space bindings remain available. Static PixelForge source/batches/spec and
review sheet live in `assets-src/mobile-controls`; the complete native Phaser
bundle is under `public/assets/mobile-controls` and loaded by `Preloader`.

Modal/death gates hide controls and clear captures, requiring a fresh press after
closing. Release/outside release, canceled pointers, lost releases, canvas exit,
blur and resize clear held actions. Shutdown explicitly removes scale/game event
listeners and the system's input callbacks. Reset restores movement, firing and
aim defaults before recreate; Phaser owns the destroyed UI. Layout uses logical
viewport dimensions and remains camera-fixed under existing FIT scaling. CSS
`touch-action: none` on the canvas prevents browser pan/zoom stealing gestures;
`100dvh` tracks mobile browser chrome. Landscape provides more gameplay area;
portrait retains the game's current letterboxed aspect ratio. Existing menus,
keyboard chat and keyboard restart are outside this control addition's scope.

Offline tests cover three independent touches, no shooting from sticks,
both magazines/pellet counts and cooldowns, analog strength/deadzone, all eight
facings while strafing, world-relative aim, pointer ownership/release/cancel,
overlays/death/blur/resize, touch/desktop mode, atlas loading, layout bounds and
two reset/create/shutdown cycles. `tests/game-mobile-smoke.cjs` additionally sends
native Chromium multitouch through Phaser, checks actual physics movement and
aim, fires both weapons with a third finger, cancels touches, tests portrait FIT
coordinates and restarts twice. Use the same Vite server and Playwright setup as
the earlier smoke test, replacing its filename with `tests/game-mobile-smoke.cjs`.
Screenshot output defaults to `/tmp/pixelforge-mobile-smoke`.

Portrait rotation testing exposed a Phaser 4.0 FIT timing race: an orientation
refresh could run before parent layout updated, leaving a 960px canvas cropped by
a 390px viewport. The game container now has explicit available width/height,
and `StartGame` owns a ResizeObserver that measures parent bounds before refreshing
the scale manager. It observes the game container rather than individual scenes,
survives scene restarts, and disconnects on game destruction. This retains the
960×640 logical game size and world/camera/HUD conventions.

Final verification: all 65 offline tests, `npm run typecheck`, `npm run build`,
the documented desktop browser smoke and the new native multitouch browser smoke
pass. The mobile test covers both weapons, third-finger fire with the other two
controls held, cancellation, two restarts with controls held, and real portrait
coordinate scaling. It disables collisions for its moving player to keep random
scenery placement from obscuring input assertions. PixelForge source validation,
semantic required-frame contract, and decoded source/export pixel equivalence pass
with no errors or warnings. The contact sheet and actual landscape/portrait
captures were visually reviewed. Physical phone ergonomics and browser engines
other than Chromium remain untested.


## Fullscreen viewport and touch actions — 2026-11-04

This supersedes the earlier FIT/letterboxing behavior. `main.ts` uses Phaser
RESIZE, so logical canvas dimensions follow the full parent viewport without
stretching game sprites. The existing container ResizeObserver measures parent
bounds before refreshing Phaser, retains orientation-race protection and
disconnects on game destruction. World/map geometry and nominal design constants
stay unchanged. The camera follows Phaser's resized viewport.

`GameScene` creates `ViewportSystem` after HUD, menu, shop, death screen, chat and
mobile controls. It pins the menu button to the right edge, centers/fits modal
content, sizes dimmers and their input areas to the whole viewport, anchors chat
to the bottom, and centers active notices/boss bars. Resize subscriptions are
removed on scene shutdown and recreated once on each run. Dynamically created
notices and boss bars also use current viewport width.

Phaser 4.0's Container bulk scroll-factor setter only updates fields that are
own properties. Component defaults may be inherited, so a child can remain at
scroll factor 1 after `setScrollFactor(0,0,true)`. Its rendered position appears
fixed through the parent while its hit area follows camera scrolling. HUD input
targets, mobile button images and the death dimmer now set their scroll factors
explicitly. Menu/shop interactive children already do so. Native touch tests
verify the actual menu icon, hero selection, spawn toggle and resume buttons at
both 924×412 landscape and 390×844 portrait, after camera movement.

The PixelForge mobile atlas now has ten frames: the original six unchanged,
plus heal/heal-pressed and interact/interact-pressed. First aid sits above the
movement stick, displays the kit count, and calls the player's existing
`useMedkit` method once per press. Inventory/full-health/death guards and heal FX
remain owned by PlayerControllerSystem. Holding cannot spend extra kits; buttons
and queued requests respect modal gates, cancellation and restart.

The bottom-center E button appears only at a contextual target. `interaction.ts`
shares vendor (110), altar (65), witch (100) and portal (75) ranges with their
owning systems, using live object coordinates and the portal's existing y−16
origin. Labels identify SHOP, SUMMON, ENTER or RETURN. A press queues its target
ID and survives a quick release until the matching owning update consumes it.
It is consumed once, never by another target, and canceled when the context
changes or controls are cleared. Existing summon/cap/cooldown/teleport guards
still run; keyboard E uses the same dispatch helper without synthetic key events.

Verification includes 69 Node tests for existing gameplay plus proportional
movement, touch action guards, all seven E contexts, quick-tap/one-shot dispatch,
actual vendor proximity routing, resize bounds, dimmer/input sizing and two
lifecycle cycles. PixelForge source/export validators and the explicit required
frame contract pass for all ten frames; the contact sheet was visually reviewed.
Native Chromium touch smoke additionally verifies three-touch combat, both
weapon magazines, full canvas coverage, menu actions, one-kit healing while
held, conditional vendor action/shop close, cancellation and two held-input
restarts. Screenshots are saved in `/tmp/pixelforge-mobile-smoke`. Physical phone
hardware and non-Chromium browsers remain outside these checks.


## Aim laser and mobile aid HUD — 2026-11-04

`GameScene` resets/creates `AimingSystem` per run and updates it after gameplay,
witches, portals and companion movement. Its Phaser-owned Graphics object renders
in world space at depth 1490, below the existing 1500+ projectile layer. It clears
and hides for death/chat/shop/menu, and creates no timers or external listeners.

`WeaponsSystem.shotTrajectory` is the shared, side-effect-free source of muzzle
coordinates, central firing angle and nominal travel range. Both actual emission
and the laser use it; eight-way muzzle offsets remain in `player-facing.ts`.
The preview follows the same freshly projected mouse target or retained mobile
stick target as firing, without changing facing, animation, ammo or cooldown.

The red beam stops at the closest enabled active Arcade body on its path:
trees, giant trees, rocks, bushes, castle solids, all altars, vendor, live enemies
and the living dragon. Disabled bodies and dead enemies are excluded. `aim-ray.ts`
handles actual rectangle/circle body bounds, parallel rays and an origin inside
a body. A bright dot marks the contacted surface; unobstructed rays extend to
nominal projectile range. The shotgun adds faint edge rays at its nominal spread.
Moving targets can move during flight, and randomized pellet spread/speed varies
around these guides. The ray marks the contacted surface, while a projectile's
finite-size body can make contact before its center reaches that surface.

`HudSystem.setMedkitBarVisible` owns visibility of all four first-aid strip
objects and the icon's input enablement. Mobile controls call it from their
presentation update. Touch mode hides the strip; the dedicated AID button and its
count remain. Mobile hardware retains this behavior through compatibility mouse
events; hybrid desktops restore the strip in mouse mode. Existing kit consumption
and health/HUD update logic is unchanged.

Validation: 73 Node tests include rectangle/circle ray geometry, nearest-body
selection, corpse/disabled filtering, shared eight-direction muzzle/angles,
shotgun guides, modal/death gates, two resets and all aid-strip visibility/input
transitions. `tests/game-aim-smoke.cjs` renders both weapons on desktop/mobile,
places an actual static wall in an otherwise controlled firing lane, verifies
laser clipping and a real projectile collision at that face, checks mobile/desktop
aid visibility, removes the wall and checks the ray updates, then restarts twice.
Rendered rifle/shotgun captures were visually reviewed under
`/tmp/pixelforge-aim-smoke`. It uses the same Vite/Playwright setup as the other
browser smoke scripts. Static checks and production build run separately.


## 2× world zoom and desktop pointer — 2026-11-04

Both desktop and mobile world cameras now use zoom **2**, superseding earlier
zoom values. `ViewportSystem` owns a separate transparent, non-following `ui`
camera at zoom 1. Camera filtering on display-list roots keeps world objects and
laser on the main camera, while fixed HUD/menu/shop/chat/death/mobile-control
containers, notices and boss bars render only through the UI camera. This keeps
screen layouts, input targets and cursor size independent of world zoom.
Root filters preserve unrelated camera bits. Classification runs after gameplay
and aiming so newly created notices, FX, enemies and pooled sprites get the
correct camera before rendering; mouse aim explicitly reprojects through main.

Viewport reset clears its camera/cursor references before recreate. Phaser owns
camera destruction on scene shutdown; the system removes its resize listener.
The UI camera is resized with the canvas and remains at scroll 0 and zoom 1.
The new camera does not alter physics, map bounds or portal behavior.

The desktop default cursor is the native CSS URL
`assets/desktop-pointer/pointer.png` with hotspot `(16,16)` and crosshair fallback.
The PixelForge-generated 32px reticle has a red center and mint/steel sight marks.
It is independent of camera zoom; interactive controls keep hand-cursor feedback.
Touch/mobile device detection changes cursor selection only, while world zoom is
2 on both platforms. See `assets-src/desktop-pointer/README.md` for editable
sources, rebuild commands and the reviewed contact sheet. Source/export pixel
validation and the explicit pointer contract pass without warnings. HTTP loading
of the PNG is checked separately from its native CSS selection.

The aim browser smoke verifies both main zoom 2 and UI zoom 1 on desktop/mobile,
laser/projectile wall agreement, first-aid strip visibility, native cursor URL,
and two restarts. Updated Node viewport coverage verifies camera root filters,
mode-independent world zoom and cursor selection across two lifecycle cycles.

Final combined verification: all 73 Node tests, TypeScript checking and production
build pass. The documented desktop gameplay smoke, native multitouch smoke and
focused aim/collision smoke pass with the final 2× zoom on both platforms. Native
mobile checks additionally assert UI zoom 1, exactly two cameras after restarts,
all four legacy aid-strip objects hidden, and working menu/first-aid/vendor touch
actions across landscape/portrait resizing. Desktop retains its aid strip and
uses the custom pointer URL. The pointer PNG returns HTTP 200 as image/png; source,
export pixel equivalence and semantic contract checks pass. World/UI captures and
the cursor contact sheet were visually reviewed. Physical phone hardware and
browsers other than Chromium were not exercised.

## Loot, crafting and dragon progression — 2026-11-04

`GameScene` composes three additional owners. `LootSystem` handles drops, stacked
animated ground pickups, short-range attraction, walkover/touch collection and
floating labels. `InventorySystem` owns per-run counts, atomic recipe spending,
`hasPortalKey`, and the responsive crafting/offering modal. `RitualSystem` owns
the northern Dragon Altar (1440,260), its collision/badge, paid ritual transition,
and synthesized roar. `progression.ts` holds the exact faction drop table and
recipes. Enemy death-start dispatches loot once, before the death animation;
repeated corpse hits cannot create additional drops.

Zombies drop Bone at 60%, both werewolves Fang at 50%, both witches Eye at 100%,
and Drowners Pearl at 100%. The key costs 3 Bone, 2 Fang and 1 Eye, once per run.
The altar costs one of each material. Crafting cannot spend partially or duplicate
a key; offering rechecks distance, boss state, pending ritual and resources before
spending. A paid ritual advances only during unblocked gameplay, then calls the
existing `BossSystem.summonAncientDragon()` once. Its roar is explicitly destroyed
on shutdown; Phaser owns sprites, colliders, UI, animations and pickup tweens.

`CastleSystem` owns `portalUnlocked`. Meadow entry requires an acquired key and
an E/touch interaction. Walkover and direct teleport calls cannot bypass a locked
portal. The key remains in inventory after unlocking. The return portal retains
its previous behavior. `interaction.ts` adds `portal` (LOCKED/UNLOCK) and `dragon`
(OFFER); unlocked Meadow portals use `enter`. The `/dragon` chat command now gives
altar directions instead of bypassing the progression loop.

I or the 48px Backpack button opens crafting. The inventory has a 48px X close
button, outside dismissal, >=48px craft/offer targets and >=48px slot targets.
It uses actual viewport pixels through the existing UI camera, with five columns
in landscape and two in portrait. It pauses physics, releases mobile captures,
blocks firing, movement, aiming, healing, chat/shop/menu opening and delayed
player damage. I/ESC close it; opening another modal is prevented. Normal menu,
chat and shop lifecycle remains owned by their existing systems.

Initialization resets inventory, loot and ritual before creating the world and
locked portal. The altar is created after player/enemy/projectile/witch pools;
its clearing is excluded from procedural scenery. Inventory UI is created after
other modals and before mobile controls/viewport filtering. Loot and ritual update
after gameplay/companion and before aiming/viewport filtering; each independently
respects modal/death state. Every restart discards counts/key/portal unlock,
ground pickups and pending ritual state, and recreates one altar/UI/audio owner.

Assets use native Phaser atlases: `items`, `altar-dragon`, and supplemental
`portal-progress` in `public/assets/portal/progression`. The original portal
bundle remains intact. Editable PixelForge projects, operations, specs, semantic
contracts and reviewed contacts are in the corresponding `assets-src` folders.
`assets-src/progression/README.md` documents regeneration and validation.

Additional verification command (same Playwright tooling as above):

```sh
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:8093 node tests/game-progression-smoke.cjs
```

The progression browser scenario controls encounter placement and random rolls,
but kills actual pooled enemies through the damage handler, collects ground loot,
uses native keyboard/touch to craft and unlock, kills a Drowner for its Pearl,
opens the altar offering and summons the real boss. It checks inventory input
blocking, landscape/portrait modal dismissal and two restarts on both platforms.
Screenshots go to `/tmp/pixelforge-progression-smoke`. Node coverage separately
checks all drop boundaries, atomic recipes, ritual pause/guards, loot stacking,
collection idempotence and reset. These are deterministic integration checks;
physical phone ergonomics and full playthrough balance remain manual QA.

The Backpack moves below Menu on narrow viewports to avoid covering the existing
score HUD. Short inventory viewports use three or five columns, compact recipe
text and omit the redundant status line while retaining 48px targets. See
[progression-validation.md](progression-validation.md) for the requirement/evidence
map and consumer validation scope.

## Serverless two-player rooms

`GameScene` constructs and resets `NetworkSystem`, creates it after camera/input
and all entity/UI owners, calls `updateHostSimulation` after local gameplay,
and updates transport/replicas before aiming and camera filtering. Constructors
only retain references/plain state. The network owner composes `NetworkWorldSystem`
for capture/replicas, `NetworkActionsSystem` for host requests, and `CoopRoomSystem`
for a native accessible DOM room dialog and HUD indicator.

Guests retain responsive local movement, aiming and predicted firing, but owner
boundary guards suppress enemy/boss/witch AI, automatic and delayed spawning,
local damage/rewards, drop generation and portal decisions. Guest interactions
relay to the host. Shared material inventory/key/weapon ownership and personal guest resource
snapshots are authoritative; kill balances, first-aid kits, health and magazines
remain individual. Host AI targets the nearest living
available player; remote melee, potion and dragon damage is applied on the host.
Friendly bullets have no player-overlap damage handler. The two characters are
assigned opposite skins and cannot switch while connected.

Opening local menus/inventory does not pause a connected world's physics. The
host runs shared AI even when its own control phase returns for a modal/death;
guest inputs remain independently gated. Room dialog keys do not reach Phaser.
Shutdown explicitly releases PeerJS/WebRTC listeners/connections/peers, remote
colliders, connection timeouts, dialog/style/DOM listeners and replicas. Stale
async peer creation is generation-checked. Invite URL restarts rejoin; Leave
clears the URL room before starting solo. Host restart ends the authoritative run.

See [co-op.md](co-op.md) for the protocol, shared-state decisions, exact Cloudflare
commands, Netlify deployment behavior and real-broker two-browser smoke test.
Generated sprite sources and runtime artwork are unchanged by this addition.

## Tunnel launcher repair — 2026-11-05

`npm run tunnel` runs `scripts/tunnel.mjs`, which prefers cloudflared on PATH or
in `~/.local/bin`. Linux installations without either download the official
architecture-specific binary into the user cache once. Downloads are renamed
atomically after completion; Ctrl+C/SIGTERM are forwarded to cloudflared. Extra
CLI options pass through, including `--protocol http2`. The default origin stays
127.0.0.1:8080. No gameplay lifecycle or authority contracts change.

Duplicate Drowner coordinates, fields, altar creation/proximity blocks, spawn
methods and asset loads were consolidated. Drowner E/touch dispatch uses the
shared interaction helper once, preserving guest authority guards. An accidentally
nested duplicate test block was removed so mobile/co-op tests execute at top level.
Validation: TypeScript, all 86 Node tests and production build pass; Chromium
boot/combat/menu smoke passes with two restarts. The launcher downloaded and
executed cloudflared, established an HTTP/2 tunnel and served HTTPS with HTTP 200.
The progression browser smoke also passes drops, crafting, portals, Drowner pearl,
ritual, touch modals and two restarts on desktop and mobile.

## Personal co-op kills and first-aid kits — 2026-11-05

`NetworkSystem` composes `NetworkResourcesSystem`, the host's owner for guest
kill balance, first-aid stock and guest-session generation. The host's local
balance remains `GameScene.score`, and local kits remain in PlayerControllerSystem.
Enemy and dragon final-hit handlers capture projectile owner/generation before
retiring the bullet. Existing reward values and enemy death-completion timing
stay intact; only the credited player changes. Rifle and shotgun emissions reset
ownership metadata on pooled bullets. Delayed rewards from a departed guest
cannot credit a new guest.

NetworkWorldSystem sends the receiving guest's personal balance/kit count in the
existing `score`/`medkits` snapshot fields; applying these fields updates that
client's HUD, mobile AID label and shop. Shared crafting materials, key and
shotgun unlock are unchanged. Guest vendor purchases validate proximity and debit
only guest kills. Healing validates guest health and consumes only guest kits;
local purchases/healing continue through their existing owners. Host scene
restart, transport disposal, disconnect and each accepted new guest reset guest
resources explicitly. Rejoining starts a fresh guest balance.

Regression checks cover final-hit attribution for enemies and dragon, pooled
bullet reuse, duplicate death callbacks, separate purchases/healing, vendor range,
shotgun purchase currency, stale guest rewards and two resets. The co-op browser
smoke checks both players' kills, actual native mobile purchases/healing and
personal HUD values, then verifies zero guest balances after two reconnects.

Validation for this change: TypeScript checking, all 90 Node tests and the
production build pass. The real default PeerJS/WebRTC browser scenario passes
on localhost with a desktop host and native-touch mobile guest, including
separate kill HUDs, personal kit purchases/use, buyer-funded shotgun purchase,
shared progression and two guest and host restarts. Physical devices and other
browser engines remain manual checks.

## PixelForge 0.6 package installation — 2026-11-05

The six PixelForge packages (core, exporters, CLI, Phaser adapter, audio-core and
audio-exporters) are installed from matching 0.6.0 archives in vendor/pixelforge.
Package references and lockfile use project-relative archive paths. Existing
0.5 archives remain available. Phaser is pinned to 4.2.1 to satisfy the 0.6 adapter's
supported peer range; no peer-dependency override is used. Enemy attack timing
retains its 180ms fallback if the animation manager returns no matching animation.
Generated artwork and gameplay tuning are unchanged by this dependency update.

Both installed skill environment checkers report success and compatible versions.
Audio CLI creation, rendered validation and WAV encoding are exercised against a
throwaway sound in /tmp; this verifies the installed toolchain, not in-game audio
integration or listening quality. No new sound is added to gameplay.

Validation: installed CLI reports 0.6.0 through both direct Node invocation and
`npm exec --no -- pixelforge --version`; npm reports no invalid peers or audit
vulnerabilities. Type checking, 90 Node tests and production build pass. Chromium
desktop gameplay smoke, native mobile multitouch smoke and real PeerJS/WebRTC
co-op smoke pass with scene restarts, separate kills/kits, vendor and progression
checks. Physical-device and non-Chromium checks remain manual.

## Procedural sound effects — 2026-11-05

`AudioSystem` owns playback instances, spatial attenuation, per-key cooldowns,
polyphony, ambient loops, footstep distance and UI pointer feedback. `GameScene`
constructs it without plugin access, resets it before other owners, creates it
after scene UI/world construction and updates it after aiming/viewport. Sound
resources belong to Phaser's game-level sound manager, so AudioSystem explicitly
destroys its owned instances and removes its two pointer subscriptions on scene
shutdown. Reset clears proximity, footstep and cooldown state for every run.
No gameplay controls or balance change.

Preloader uses `loadPixelForgeAudio` and the generated `audio-catalog.ts` bundle
list for all 103 named effects. The individual export manifests use valid flat
filenames, with one base URL per effect. Runtime uses pre-rendered WAVs only.
The old standalone dragon-roar asset is preserved, but RitualSystem no longer
owns a separate Sound instance: offering plays a chime/burst and BossSystem
plays the new roar when the dragon actually appears.

Successful transitions in existing owners explicitly dispatch sound after their
normal guards: Weapons (fire/empty/reload/pump), PlayerController (switch/hurt/
death/heal), Enemies/Witch/Boss (spawn/attack/hurt/death/projectiles), Collisions
(material impacts and fireball detonations), Loot/Inventory (drops/collection/
craft/modal), Castle (lock/unlock/teleport), Ritual (offering), Shop (greeting/
purchase/denial), Menu/Altars/Chat/DeathScreen and Network (connection). Enemy
variant names map centrally to distinct zombie/banshee/skeleton/ghoul/werewolf/
albino/drowner/witch voices. One shotgun blast dispatches once, not per pellet.
NetworkWorld uses snapshot edges for guest enemy/boss and inventory cues; repeated
snapshots do not repeatedly emit transitions. Replicated shots use the same weapon
emission path. Guest authority health changes and zone transitions play locally.
Guest hazard disappearance does not infer an impact because snapshots cannot
distinguish expiration from collision; no new network protocol is introduced.

The presentation update samples nearby scenery every 180 ms, emits accumulated
movement footsteps (grass/stone/puddle), warns at 1 HP, and supplies nearby dog,
ghoul, wolf, dragon and castle ambience. Bush friction checks moving bodies near
bushes; collision owners still decide physical results. Altar/cauldron and laser
loops stop under modal/death/network gates. Sound playback never consumes the
world RNG or advances AI. Per-key cooldowns and a 24-instance cap deliberately
thin overlapping combat. Locked browser audio is skipped until Phaser's normal
user-gesture unlock; no queued sounds burst on unlock.

Sources, operation batches, reproduction, sound-design approximations and
listening guidance: `src/game/assets-src/audio/README.md`. Run
`node scripts/verify-game-audio.mjs` for all schema/render/WAV equivalence checks.
The focused `tests/game-audio-smoke.cjs` uses the same dev-server/Playwright setup
as the documented gameplay smoke. It checks all decoded/played assets, actual
Web Audio graph energy, gameplay cues, no asset/page errors and two restarts.
Offline audio coverage checks lock/cache/distance/cooldown/instance limits and
loop/input cleanup. Subjective listening is explicitly separate from these
measurements; physical audio hardware and cross-browser mixing require manual QA.

Validation for the sound addition: TypeScript checking, all 93 Node regression
tests, production build, all 103 reproducible exports, the documented desktop
gameplay smoke and the focused audio smoke pass. Chromium decoded/played 103/103
WAVs and measured nonzero output; both browser checks include two scene restarts.
Maximum individual rendered peak is 0.4061, with zero clipped samples. This is
numerical and consumer-playback evidence, not subjective listening approval.
The real PeerJS/WebRTC co-op smoke also passes guest combat, loot/crafting,
portal/altar progression, personal purchases/healing, connection lifecycle and
two host restarts. It verifies integration stability, not subjective audio mixing.


## Netlify release workflow — 2026-11-05

`netlify.toml` selects Node 24, `npm run release:check` and `dist`. The release
command runs typecheck, Node tests and production build; `npm run preview`
serves that build on 127.0.0.1:4173. `public/_headers` ships with both Git builds
and manual uploads, with cache revalidation for unversioned runtime assets.
Co-op remains enabled through the existing network owners and public PeerJS
broker; no gameplay, lifecycle or authority contract changes.

The desktop and co-op browser smoke scripts share `tests/browser-game.cjs`.
It captures the real Phaser Game during boot using a browser-only init script,
so both scripts now exercise dev or production resources without replacing the
bootstrap. No test hook is added to shipped application code. Other focused
smoke scripts still use their existing development bootstrap interception.
See [netlify-release.md](netlify-release.md) for publishing, deployed HTTPS checks,
TURN limitations and rollback. Physical devices and cross-network connectivity
remain manual release checks.

Release verification: isolated dependency install, TypeScript, all 94 Node tests,
production build and npm audit pass. Desktop and real two-peer co-op browser
smoke pass against the compiled build, including scene restarts. Native mobile
multitouch smoke passes against development. See [netlify-validation.md](netlify-validation.md)
for evidence and checks still requiring a live deploy or physical devices.


## Clean Git checkout validation — 2026-11-05

The release test suite needs `assets-src/hud/hud.sprite.json` for source-layer
assertions and `assets-src/audio/` for sound metrics and recipes. Git ignore rules
include those sources while excluding the other large editable sprite projects.
The sound inventory reference now lives in `assets-src/audio/sound-effects-list.md`;
the generator and regression tests read that path. Local `TODO/` remains ignored.
Validate deployment from the Git-eligible file set, not just the working directory,
so tests cannot depend on ignored local files. Runtime ownership is unchanged.


## Co-op signaling recovery — 2026-11-05

NetworkSystem owns host startup timeout, bounded same-peer signaling recovery and
guest missing-peer retries. Native timers are canceled by transport disposal on
leave/failure/reset/shutdown, and callbacks check the originating peer/generation.
Host signaling errors no longer destroy an established DataChannel. Host open
clears recovery state; guest connection success clears pending join retries.
Readiness is derived from PeerJS open/disconnected/destroyed flags. CoopRoomSystem
uses it to gate host room-code display/copy and cleans its button reference on
shutdown. The composition root and gameplay authority remain unchanged.

Regression tests exercise recovery, bounded attempts, timeouts, guest retries,
stale errors and two resets. The real co-op smoke now fault-injects a signaling
disconnect before joining and supports separate host/guest browser executables.
Two tabs or two browser processes on one machine are not cross-network evidence.


`NetworkSystem.createPeer` now requests optional same-origin ICE configuration
before constructing PeerJS. It owns AbortControllers for pending setup requests,
with a six-second deadline and explicit disposal; stale async peer results retain
the existing generation guard. `ice-servers.ts` validates browser ICE input.
`netlify/functions/ice-servers.mjs` optionally fetches Metered credentials using
server-only runtime environment variables, never a Vite-embedded privileged key.
No provider configured retains defaults; configured-provider errors are explicit.
`npm test` runs all `tests/*.test.cjs`, including endpoint validation and secret
redaction checks. TURN activation and actual external-network verification need
a provider account. The release guide documents Git-only Function deployment.

Final verification: TypeScript, 105 Node tests and production build pass. The
revised compiled build passes desktop smoke and separate Brave/Chromium co-op
with injected signaling recovery and restarts. The live cross-country pair and
a real configured TURN service remain unverified; see netlify-validation.md.
