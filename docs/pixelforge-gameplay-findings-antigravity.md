# PixelForge Skill & Workflow Report: Findings, Troubles & Solutions

> Comprehensive analysis from implementing interactive gameplay (altar discovery, summoning mechanic, AWSD movement, mouse left-click directional shooting) using the `pixelforge-sprite-creator` skill on Linux / Phaser 4.

---

## 1. Overview & Gameplay Implemented

Using PixelForge headlessly, we designed and built the complete asset pipeline and game mechanics:
1. **Interactive Altar Object** (`src/game/assets-src/altar/` ➔ `public/assets/altar/`):
   - Created from scratch via `pixelforge init` (32x32px).
   - Designed 4 layers (`base`, `stone`, `runes`, `glow`) with procedural operation batches.
   - 3 distinct animation states:
     - `altar-idle`: Dormant stone with slow pulsing rune glow.
     - `altar-active`: Awakened state when player steps within 65px proximity.
     - `altar-summon`: High-energy necromantic energy surge triggering zombie spawn.
2. **Interactive Summoning Gameplay**:
   - Player moves across the meadow with **[AWSD]** or Arrow keys.
   - Walking up to the Altar displays a floating interactive HUD prompt: `Press [E] to Summon Zombie`.
   - Pressing **[E]** triggers the summoning sequence, screen rumble, and spawns a zombie emerging from the altar.
3. **Directional Mouse Left-Click Combat**:
   - Left-clicking aims and shoots a bullet towards the exact cursor coordinates.
   - Player automatically faces the firing direction.
   - Bullets rotate to match their trajectory angle and travel towards the clicked target.
   - Zombies chase the player, stop at $<42\text{px}$ to attack, take recoil damage with `zombie-hurt`, and collapse into a dissolvable blood pool with `zombie-die` upon defeat.
4. **Animated Tree Variations & Dynamic Y-Sorting Depth** (`src/game/assets-src/trees/` ➔ `public/assets/trees/`):
   - Created 3 distinct green variants in a 48x64px atlas:
     - **Emerald Oak**: Deep lush green canopy with natural wind sway (`sway-emerald`).
     - **Golden Olive Willow**: Yellow-green mossy weeping foliage (`sway-olive`).
     - **Teal Blue Spruce**: Tiered evergreen pine with blue-green needles (`sway-teal`).
   - **Solid Trunk Base Collision**:
     - The solid collision box is isolated to the lower trunk base ($14\times10\text{px}$ at $y=54$), while the foliage canopy extends in the air above the player.
   - **Dynamic 2.5D Y-Depth Sorting**:
     - All ground objects use origin $(0.5, 1)$ with depth set dynamically to `y`:
       - Walking **behind** a tree ($player.y < tree.y$): the tree canopy renders in front of the player (tree covers player).
       - Walking **in front of** a tree ($player.y > tree.y$): the player renders in front of the tree (player covers tree).
       - When walking directly behind the leafy canopy, the tree smoothly shifts to $0.65$ alpha for comfortable player visibility.

---

## 2. Key Findings & Strengths of PixelForge

### A. Procedural Operation Batches vs Raw Pixel Data
- Writing operation files (`drawRect`, `drawEllipse`, `drawLine`, `setPixel`, `copyFrame`, `moveRegion`) is vastly superior to writing large 2D pixel arrays.
- Files are human-readable, cleanly tracked in Git diffs, and can be composed modularly (`00-palette.ops.json`, `10-structure.ops.json`, `20-animations.ops.json`).

### B. Transactional Safety on `apply`
- When executing `pixelforge apply`, the tool validates all operations on an internal clone first. If any operation errors, the destination file is left untouched. This prevents half-written or corrupted sprite JSONs.

### C. Frame Duplication + Region Shifting for Animation
- The combination of `copyFrame` and `moveRegion` enabled rapid creation of multi-frame animations (e.g. buckling knees, recoil stumbles, falling backwards) without redrawing base silhouettes from scratch.

### D. Automated Quality Assurance (`validate-export.mjs`)
- PixelForge decodes the rendered PNG atlas and compares each frame raster against the source sprite specification. Catching clipping, frame bounds, and pixel discrepancies before engine integration is invaluable.

---

## 3. Troubles & Friction Points Encountered

### 1. `pixelforge export` Fails if Destination Directory Exists
- **Issue**: Running `pixelforge export ... --output public/assets/altar` fails with `Error: Output directory already exists` if the directory was created in advance or was exported previously.
- **Trouble for Agents**: Standard build tools usually overwrite or update existing directories. PixelForge strictly requires the directory to not exist.
- **Solution**: Always run `rm -rf <output_dir>` immediately before invoking `pixelforge export`.

### 2. `setPixel` Out-of-Bounds Fatal Error vs Shape Clipping
- **Issue**: While `drawRect`, `drawEllipse`, and `drawLine` safely clip against canvas boundaries, `setPixel` throws a hard fatal exception if `x < 0`, `x >= width`, `y < 0`, or `y >= height`.
- **Trouble for Agents**: When designing complex edge highlights or details near canvas limits, a single coordinate error aborts the entire operation batch.
- **Solution**: Ensure all `setPixel` coordinates strictly satisfy $0 \le x < \text{width}$ and $0 \le y < \text{height}$. Use clipping shapes (`drawLine` or `drawRect`) when drawing near borders.

### 3. Palette Color Initialization in `init`
- **Issue**: `pixelforge init` initializes the palette with only index 0 (transparent) and index 1 (white `#ffffff`). There is no CLI flag to initialize a custom palette during `init`.
- **Trouble for Agents**: Index 1 cannot be added again with `addPaletteColor` (would duplicate or alter indices).
- **Solution**: The first operation batch must use `updatePaletteColor` for index 1, followed by `addPaletteColor` for indices $2 \dots N$.

### 4. Phaser 4 Integration & Engine Version Peer Conflict
- **Issue**: The optional `@pixelforge/phaser` helper library defines a peer dependency for Phaser 3.90. Modern templates (including `phaserjs/template-vite-ts` used here) run Phaser 4.0.0.
- **Trouble for Agents**: Importing `@pixelforge/phaser` causes peer conflicts or runtime mismatch with Phaser 4's updated API surface.
- **Solution**: Rely on PixelForge's standard export format (`--format phaser --layout atlas`), which emits standard Texture Packer Hash format (`.atlas.json` + `.png`) along with `animations.json` and `game.json`. Load them using Phaser 4's native `this.load.atlas()` and create animations directly from the JSON.

### 5. Anchor Translation with Custom Origins and Scaling
- **Issue**: In `player.game.json`, anchor coordinates (e.g., `muzzle: [23, 15]`) are given in untrimmed canvas pixel space ($24 \times 32\text{px}$).
- **Trouble for Agents**: In Phaser, sprites commonly use origin `(0.5, 1)` (bottom-center) and a scale factor (e.g., `scale = 2`). Directly adding anchor coordinates without accounting for origin and scaling results in bullets firing from misplaced locations.
- **Solution**: Compute world offsets using:
  $$\text{offset}_X = (\text{anchor}_X - \text{width} \times \text{origin}_X) \times \text{scale}$$
  $$\text{offset}_Y = (\text{anchor}_Y - \text{height} \times \text{origin}_Y) \times \text{scale}$$
  For player width 24, height 32, origin (0.5, 1), scale 2:
  $$\text{offset}_X = (23 - 12) \times 2 = +22$$
  $$\text{offset}_Y = (15 - 32) \times 2 = -34$$

---

## 4. Summary Checklist for Future Agents

1. **Initialize Project**: `pixelforge init <name> --width <W> --height <H> --output <path>.sprite.json`
2. **Palette & Layers**: First batch must `updatePaletteColor` index 1, then `addPaletteColor` 2..N, `createLayer`, and `reorderLayers`.
3. **Structure & Drawing**: Draw shapes; beware of out-of-bounds `setPixel`.
4. **Animation States**: Use `copyFrame` and `moveRegion`; assign explicit milliseconds via `addAnimation`.
5. **Project Validation**: Always execute `validate-project.mjs` before exporting.
6. **Phaser Clean Export**: Execute `rm -rf <output_dir>` before `pixelforge export --format phaser --layout atlas`.
7. **Export QA**: Execute `validate-export.mjs` to prove pixel-perfect raster equality.

---

## 5. Reference-Guided Character Creation: The Scholar Heroine

### Reference Translation Workflow
- **Source**: User-provided photographic portrait of a smiling young woman wearing white over-ear headphones, eyeglasses, and an oversized dark green sweater layered over a white collared dress shirt.
- **Specification (`heroine-spec.json`)**:
  - Resolution: $48 \times 64\text{px}$ high-resolution sprite matching the upgraded game standard.
  - Palette: 22 colors including skin highlights/shadows, dark brunette tones, crisp whites for headphones and shirt collar, forest greens for sweater knit and ribs, slate navies for trousers, and gun metals.
  - Distinctive visual translation:
    - White headphones: Headband arch over top of head with cushioned earcups framing the face.
    - Wireframe eyeglasses: Black rimmed frames with subtle lens glints (`[180, 220, 245, 255]`) over the eyes.
    - White collared shirt: Crisp triangular collar wings peeking out above the crewneck sweater.
    - Forest green knit sweater: Oversized fit with ribbed collar, hem, and cuffs.
- **Animation Suite**:
  - `idle` (2 frames): Natural breathing bob and fabric shift.
  - `walk` (4 frames): Dynamic 4-step walking cycle with leg stride and rifle sway.
  - `shoot` (3 frames): Aiming, golden muzzle flash discharge with core white bloom, and recoil recovery.
  - `hurt` (1 frame): High-impact flinch and recoil.
  - `die` (3 frames): Weapon drop, knees buckling, and rested collapse.
- **Verification**:
  - `validate-project.mjs`: All 13 frames validated with zero errors.
  - `validate-export.mjs`: $624 \times 64\text{px}$ texture atlas verified with 100% raster parity.

### Dynamic Character Switching (`[G]` Key)
- Seamlessly bound `G` key in Phaser input system.
- Toggles between `player` (classic survivor) and `heroine` (scholar survivor).
- Retains exact coordinate position, arcade physics velocity, health, and facing orientation.
- Automatically selects and continues the appropriate state animation (`walk`, `idle`, `shoot`, `hurt`, `die`).
- Triggers a responsive character switch tint flash (`0x88ffaa` for scholar, `0x88ccff` for survivor).
- Updated HUD to display active character name and keyboard shortcut: `Character: Scholar [G]`.

---

## 6. Multi-Variant Undead Legion: Female Zombie, Crypt Skeleton & Frost Ghoul

### Zombie Variants Breakdown ($48 \times 64\text{px}$)
1. **Female Zombie / Banshee (`zombie-female`)**:
   - Tattered ragged maroon/crimson burial gown with shredded spikes along hem.
   - Disheveled tangled dark brunette hair cascading past shoulders.
   - Pallid greenish skin with razor claws, sunken eye cavities, and glowing yellow milky eyes.
   - Gameplay Attributes: Faster movement speed (95 px/s), standard health (3 HP).
   - Validated: 13 frames, 0 errors, atlas $624 \times 64\text{px}$.

2. **Crypt Skeleton (`zombie-skeleton`)**:
   - Bleached cranium skull with hollow dark eye sockets and eerie cyan spectral eye fire (`[80, 240, 255, 255]`).
   - Exposed articulated ribs, spine column, pelvic girdle, femur, tibia, and skeletal hand claws.
   - Ancient crypt burial cowl rags hanging from shoulders and ribs.
   - Gameplay Attributes: Agilest sprinter (105 px/s), fragile bones (2 HP).
   - Validated: 13 frames, 0 errors, atlas $624 \times 64\text{px}$.

3. **Frost Ghoul / Blue Zombie (`zombie-blue`)**:
   - Frostbitten cyan/cobalt decaying skin with jagged ice crystal growths on shoulders and claws.
   - Piercing glowing ice-blue sapphire eyes with white crystalline core.
   - Tattered dark navy arctic parka with frosted fur trim.
   - Cold blue ichor / frozen blood splatters.
   - Gameplay Attributes: Heavy armored tank (4 HP), slower lumbering gait (75 px/s).
   - Validated: 13 frames, 0 errors, atlas $624 \times 64\text{px}$.

### Random Sprite Variant Spawning Mechanics
- **Unified Pool**: All 4 variants (`zombie`, `zombie-female`, `zombie-skeleton`, `zombie-blue`) are managed within the main arcade physics zombie group.
- **Random Selection**: On summon (either manual Altar `[E]` or 5-second auto-spawner `[P]`), a random variant is chosen using `Phaser.Utils.Array.GetRandom(ZOMBIE_VARIANTS)`.
- **Dynamic Animation & State Binding**:
  - Automatically loads and plays `${variant}-walk`, `${variant}-attack`, `${variant}-hurt`, and `${variant}-die`.
  - Sets unique speed and HP per variant, providing dynamic and varied combat encounters.
  - Variant-tailored emergence magical surge glows (`0xdd88ff` classic, `0xff88cc` banshee, `0x88ffff` skeleton, `0x66bbff` frost ghoul).

---

## 7. Advanced Undead Visual Effects: Falling Body Parts & Animated Electric Aura

### A. Normal Zombie: Progressively Detaching Falling Body Parts (`walk-1` ➔ `walk-4`)
- **Visual Concept**: As the rotting zombie drags its decrepit body forward, decayed flesh chunks and bone fragments shear off from its trailing arm and torso, tumbling through the air before splattering against the ground.
- **Layer & Technique**:
  - Utilized the `blood` and `base` layers to draw high-contrast rotten flesh (`[50, 75, 45, 255]`), exposed bone splinters (`[215, 210, 185, 255]`), and dark arterial splatter droplets (`[115, 18, 18, 255]`).
  - **Frame 1 (`walk-1`)**: The trailing left arm begins to buckle; a necrotic flesh chunk separates at $(x=11, y=32)$ alongside trailing dark blood droplets.
  - **Frame 2 (`walk-2`)**: As the foot drives forward, the primary chunk tumbles downward to $(x=9, y=41)$ with a secondary splinter breaking off at $(x=13, y=36)$, trailing falling droplets $(y=45)$.
  - **Frame 3 (`walk-3`)**: The detached mass accelerates toward ground level $(x=8, y=52)$ with bone fragments separating at $(x=12, y=46)$ and micro-droplets $(y=54)$.
  - **Frame 4 (`walk-4`)**: The falling chunk impacts and splatters on the dirt at $(x=7..9, y=59..60)$, while a second smaller chunk drops $(x=12, y=54)$ with scattered bone shards.
- **Verification**: Clean validation with `validate-project.mjs` (13 frames, 0 errors) and `validate-export.mjs` ($624 \times 64\text{px}$ atlas, 100% raster parity).

### B. Blue Zombie: Dynamic Crackling Animated Electric Aura
- **Visual Concept**: The frost ghoul is hyper-charged with volatile high-voltage bio-electricity. Blue and cyan lightning arcs continuously crackle across its horns, shoulders, claws, and perimeter, surging violently during attacks and flickering into static overload when struck.
- **Palette Expansion**:
  - `electric-white` (`[245, 255, 255, 255]`): Blinding core discharge point.
  - `electric-cyan` (`[120, 240, 255, 255]`): Ionized corona and primary electric streamers.
  - `plasma-blue` (`[50, 160, 255, 255]`): Diffuse ambient electric glow and field fringe.
- **Multi-Layer Architecture (`aura` layer)**:
  - Added dedicated top-level layer `aura` (`["base", "cloth", "blood", "aura"]`).
  - This architecture ensures electric streamers can arc outward into the perimeter space and dance directly across character limbs and torn clothing without altering base pixel data.
- **State-by-State Electrical Animation**:
  - `idle-1` & `idle-2`: Subtle ambient sparks dancing along shoulder ice crystals and claw tips.
  - `walk-1` ➔ `walk-4`: Shifting lightning arcs bridging between claws, horns, and grounded ground strikes as the ghoul strides.
  - `attack-1` ➔ `attack-3`: High-voltage electrical surge charging into both claws, culminating in a vicious blinding forward lightning strike (`attack-2`) with electric tendrils arcing across the victim's space.
  - `hurt`: Rapid full-body electrostatic discharge bursting outward like a short-circuit overload.
  - `die-1` ➔ `die-3`: Dying spark embers flickering out as the ghoul collapses, leaving a lingering faint residual charge.
- **Verification**: Validated with `validate-project.mjs` (13 frames, 0 errors) and `validate-export.mjs` ($624 \times 64\text{px}$ atlas, 100% raster parity).

---

## 8. Multi-Variant Environmental Obstacles: Terracotta, Gray & Olive Rocks

### A. Rock Variants Breakdown ($32 \times 32\text{px}$)
1. **Terracotta Sandstone (`terracotta-1`, `terracotta-2`)**:
   - Palette Theme: Warm red clay, earthenware, burnt sienna, rust orange, and desert sandstone.
   - Distinctive Features:
     - `terracotta-1`: Chunky boulder with horizontal sedimentary strata bands and warm sun-baked rim highlights (`[248, 172, 118, 255]`).
     - `terracotta-2`: Stepped plateau slab with layered mineral shelf striations and deep burnt umber fissures.
   - Ground contact oval drop shadow on `base` layer.

2. **Granite Slate (`gray-1`, `gray-2`)**:
   - Palette Theme: Classic chiseled mountain granite, cool slate, and deep charcoal shadow.
   - Distinctive Features:
     - `gray-1`: Asymmetrical jagged mountain peak boulder with sharp light-facing facet planes (`[148, 160, 174, 255]`) and bright quartz glint highlights (`[210, 220, 230, 255]`).
     - `gray-2`: Twin granite stepping stones with diagonal cleavage fractures.

3. **Mossy Serpentine (`olive-1`, `olive-2`)**:
   - Palette Theme: Weathered riverstone, damp dark olive stone, and lush botanical overgrowths.
   - Distinctive Features:
     - `olive-1`: Rounded glacial river boulder blanketed in velvety green moss lobes (`[126, 152, 66, 255]`) capped with vibrant chartreuse lichen flecks (`[184, 210, 88, 255]`).
     - `olive-2`: Low mossy mound cluster with sunlit lichen crests.

### B. Spawning Mechanics & Collision Accommodations
- **Clearance & Placement Safeguards**:
  - Altar clearing isolation ($110\text{px}$ clearance from center $480, 260$) ensures summoned zombies spawn cleanly.
  - Player spawn isolation ($80\text{px}$ clearance from $480, 380$) prevents player entrapment at game start.
  - Inter-obstacle clearance checks ($>48\text{px}$ from tree trunks, $>44\text{px}$ from other rocks) keep meadow pathways open and prevent overlapping collisions.
- **2.5D Y-Depth Sorting & Physics Geometry**:
  - Origin set to $(0.5, 1)$ with depth dynamically set to `y`.
  - Tight ground-contact collision box ($20 \times 11\text{px}$ at offset $x=6, y=18$) prevents players, zombies, and bullets from clipping into invisible air above the rock base.
  - Mandatory `body.reset()` call after static body configuration ensures Arcade Physics registers the new position and dimensions in the static group's spatial hash.
- **Combat & Collision Handlers**:
  - Solid obstacles block player and zombie navigation (`collider(player, rocks)`, `collider(zombies, rocks)`).
  - Flying bullets stop and despawn on impact with rock surfaces (`collider(bullets, rocks)`).

---

## 9. Blood Moon Totem Altar & Werewolf Beast Mechanics

### A. Blood Moon Wolf Totem Altar (`altar-wolf` ➔ `public/assets/altar-wolf/`)
- **Visual Conception & Architecture ($32 \times 32\text{px}$)**:
  - Base monolith composed of dark obsidian basalt (`[28, 22, 26, 255]`), deep crimson stone shadow, and bloodstone highlights (`[155, 75, 90, 255]`).
  - Carved lupine skull relic with pointed ears, bone fangs protruding downward, and hollow eye sockets.
  - Levitating Blood Moon orb suspended in the air above the totem.
  - Multi-layer construction: `["base", "stone", "runes", "glow"]`.
- **State-by-State Animations**:
  - `altar-wolf-idle` (2 frames, 500ms/300ms, loop): Eerie slow pulsing crimson blood moon and carved pedestal runes.
  - `altar-wolf-active` (2 frames, 250ms/250ms, loop): When player approaches within $65\text{px}$, wolf eyes ignite into glowing scarlet fire (`[255, 75, 75, 255]`), fangs glint, and blood moon orb flares.
  - `altar-wolf-summon` (3 frames, 120ms/180ms/250ms, non-looping): Violent crimson energy shockwave erupts, vertical blood beacon surges skyward, and howling wolf maw discharges energy to summon the werewolf.
- **Verification**:
  - `validate-project.mjs`: 7 frames validated with 0 errors.
  - `validate-export.mjs`: $224 \times 32\text{px}$ atlas verified with 100% pixel parity.

### B. The Blood Werewolf (`werewolf` ➔ `public/assets/werewolf/`)
- **Visual Conception & Anatomy ($48 \times 64\text{px}$)**:
  - Feral hunched posture with muscular beast chest, bristling silver fur highlights (`[125, 120, 135, 255]`), and heavy neck mane.
  - Lupine head with long snout, razor white fangs, dark open maw, and glowing predator amber eyes (`[255, 175, 25, 255]`).
  - Powerful digitigrade (canine) legs with sharp clawed paw feet, shredded indigo denim trousers clinging to thighs, and bushy wolf tail.
  - Multi-layer composition: `["base", "fur", "cloth", "blood", "slashes"]`.
- **Complete Animation Suite (Matching Zombie State Machine)**:
  - `werewolf-idle` (2 frames, 400ms/250ms, loop): Feral breathing bob, chest fur rising, jaw snarling, and claws flexing.
  - `werewolf-walk` (4 frames, 120ms/160ms/120ms/160ms, loop): Rapid hunched digitigrade beast stalk with swinging clawed arms and swishing tail.
  - `werewolf-attack` (3 frames, 150ms/140ms/220ms, non-looping): Rears onto hind legs with raised claws, lunges forward with double claw slash arcs and white/crimson streaks on the `slashes` layer, then recovers.
  - `werewolf-hurt` (1 frame, 160ms): Recoil stagger flinch on bullet impact, snarling grimace with arterial blood spray.
  - `werewolf-die` (3 frames, 140ms/180ms/450ms, non-looping): Reaches to chest wound, tilts muzzle skyward in a final dying howl, collapses to knees, and slumps flat into an expanding dark blood pool.
- **Verification**:
  - `validate-project.mjs`: 13 frames validated with 0 errors.
  - `validate-export.mjs`: $624 \times 64\text{px}$ atlas verified with 100% pixel parity.

### C. Map Placement & Spatial Integration
- **Western Sacred Grove Location**:
  - Placed at $(x=220, y=260)$—symmetrically balancing the center Necromantic Altar $(480, 260)$.
  - Ground clearing configured in `pickGrassTile` ($x \in [11, 16], y \in [14, 18]$) for plain dirt surroundings.
  - Clearance constraints in both `createTrees` and `createRocks` ($>110\text{px}$ distance) prevent any trees or boulders from obstructing the totem or summon area.
  - Solid collision box (`collider(player, wolfAltar)`) prevents player from walking through the stone pedestal.
  - Dynamic 2.5D Y-depth sorting ensures player, werewolves, and altars render with proper depth perspective.

### D. Auto-Spawner & Dual Altar Mechanics Integration
- **Toggle Mechanic (`[P]` Key & Menu Toggle Button)**:
  - Both altars are unified under the auto-spawner system.
  - Every 5-second tick, if auto-spawning is enabled:
    - Alternates summoning between the Center Zombie Altar and the Western Werewolf Altar.
    - If active enemy population is low ($< 8$), BOTH altars awaken in tandem (Zombie Altar burst followed 450ms later by Werewolf Altar flare) for high-intensity action.
    - Toggling auto-spawn OFF (`[P]`) pauses automatic summoning across all shrines.
- **Manual Proximity Summoning (`[E]` Key)**:
  - Approaching either altar activates proximity detection:
    - Center Altar ($480, 260$): Displays yellow prompt `Press [E] to Summon Zombie`.
    - Western Altar ($220, 260$): Displays crimson prompt `Press [E] to Summon Werewolf`.
  - Pressing `[E]` triggers the corresponding altar's summon animation, camera screen rumble, and spawns the monster with emergence aura glow.

---

## 10. Multi-Variant Animated Bushes & Precision Ground Collision

### A. Bush Variants Breakdown ($32 \times 32\text{px}$)
1. **Ruby Berry Bramble (`berry-1`, `berry-2`, `berry-3`)**:
   - Palette Theme: Lush deep emerald foliage (`[14, 42, 22, 255]`, `[32, 98, 44, 255]`), tangled woody briar twigs (`[56, 40, 26, 255]`), and bright crimson berries (`[220, 34, 46, 255]`) with ruby highlights (`[255, 106, 114, 255]`) and specular glints (`[255, 235, 240, 255]`).
   - Animation (`bushes-sway-berry`): 3 frames (260ms loop) with gentle wind rustling branches, swaying berries, and shifting specular glints.
2. **Golden Jasmine Bush (`flower-1`, `flower-2`, `flower-3`)**:
   - Palette Theme: Bright sunlit spring lime & olive foliage (`[28, 46, 16, 255]`, `[58, 126, 36, 255]`), fresh chartreuse tips (`[170, 224, 76, 255]`), and starry golden-yellow jasmine blossom petals (`[255, 196, 26, 255]`) with delicate cream cores (`[255, 255, 208, 255]`).
   - Animation (`bushes-sway-flower`): 3 frames (280ms loop) featuring soft wind sway flutter across the blossom clusters.
3. **Amethyst Heather Bush (`lavender-1`, `lavender-2`, `lavender-3`)**:
   - Palette Theme: Pale cool sage/slate green fronds (`[18, 38, 34, 255]`, `[38, 86, 74, 255]`) with tall upright floral spires of deep royal purple (`[82, 30, 122, 255]`), vibrant violet petals (`[150, 76, 210, 255]`), pastel lilac highlights (`[204, 146, 246, 255]`), and soft orchid core sparkles (`[240, 214, 255, 255]`).
   - Animation (`bushes-sway-lavender`): 3 frames (250ms loop) with wind tilting the lavender flower spires and swaying the canopy.

### B. Procedural Build, Project & Export QA Verification
- **PixelForge CLI Pipeline**:
  - `bushes-spec.json`: Specification defining 32x32 canvas, transparent background, 28 palette colors, layers (`base`, `foliage`, `flora`, `highlights`), and origin `[0.5, 1]`.
  - Procedural operation batches: `00-palette-layers.ops.json`, `10-berry-bush.ops.json`, `20-flower-bush.ops.json`, and `30-lavender-bush.ops.json`.
  - Project QA (`validate-project.mjs`): All 9 frames validated with 0 errors and 0 warnings.
  - Export QA (`validate-export.mjs`): $288 \times 32\text{px}$ texture atlas verified with 100% pixel parity.

### C. Map Placement & Collision Accommodations
- **Placement Safeguards**:
  - Center Altar clearance: $>110\text{px}$ from $(480, 260)$.
  - Western Wolf Altar clearance: $>110\text{px}$ from $(220, 260)$.
  - Player Spawn clearing: $>80\text{px}$ from $(480, 380)$.
  - Tree trunk distance: $>46\text{px}$ prevents obstruction of tree bases.
  - Rock distance: $>40\text{px}$ keeps meadow avenues open.
  - Inter-bush distance: $>36\text{px}$ forms natural clusters without overlapping collision boundaries.
- **Precision Ground Footprint & Arcade Physics Synchronization**:
  - Like rocks, bushes use origin $(0.5, 1)$ with depth dynamically set to `y` for 2.5D depth sorting (characters behind bushes are covered; characters in front cover the bush).
  - Ground-contact collision box isolated to the base ($20 \times 10\text{px}$ at offset $x=6, y=19$) so top foliage can be walked behind without artificial collision ceilings.
  - Mandatory `body.reset()` call after static body sizing and offset immediately updates Arcade Physics spatial tree bounds.
  - Colliders configured for `player`, `zombies` (including werewolves), and `bullets` (projectiles stop and vanish on impact).

---

## 11. 4x Map Expansion, Opposite Corner Spawns & Proximity Awakening Spawning Mechanics

### A. 4x Map Expansion Architecture
- **Dimensions & Area**:
  - Original map: $60 \times 40$ tiles ($960 \times 640\text{px} = 614,400\text{px}^2$).
  - Expanded map: $120 \times 80$ tiles ($1920 \times 1280\text{px} = 2,457,600\text{px}^2$) — exactly **$4\times$ the playable world area**.
  - Camera & Physics Synchronization:
    - Viewport resolution remains fixed at $960 \times 640$ to **keep the zoom factor exactly 1:1**.
    - Arcade Physics world bounds: `physics.world.setBounds(0, 0, 1920, 1280)`.
    - Camera bounds: `cameras.main.setBounds(0, 0, 1920, 1280)` with smooth following on `player`.
    - Bullet cleanup expanded from $1010 \times 690$ to `MAP_WIDTH + 50` ($1970\text{px}$) and `MAP_HEIGHT + 50` ($1330\text{px}$).

### B. Opposite Corner Shrines & Central Player Spawn
- **North-West Corner (Necromantic Zombie Altar)**:
  - Relocated from map center to $(x=260, y=240)$ ($tile \approx 16, 15$).
  - Surrounding grass tiles cleared for ancient crypt dirt clearing.
- **South-East Corner (Blood Moon Wolf Totem)**:
  - Relocated from west to opposite corner $(x=1660, y=1040)$ ($tile \approx 104, 65$).
  - Surrounding grass tiles cleared for ritual stone clearing.
  - Symmetrical separation: $\approx 1612\text{px}$ across the diagonal of the world.
- **Center Meadow Safe Zone (Player Spawn)**:
  - Player spawns in the middle of the continent at $(x=960, y=640)$ ($tile \approx 60, 40$), equidistant ($\approx 806\text{px}$) from both dangerous corner sanctums.

### C. Proximity Awakening Spawning Mechanics (Replacing Periodic Auto-Spawn)
- **Automatic Spawner Deactivated**:
  - `isAutoSpawnEnabled` set to `false` by default, and `autoSpawnTimer.paused = true`.
- **Territory Danger Zone Detection ($<260\text{px}$)**:
  - Approaching either corner shrine within $260\text{px}$ awakens the dormant altar into its active state (`altar-active` / `altar-wolf-active`).
  - Activates floating territory warning text:
    - North-West: `⚠️ CRYPT TERRITORY (TOO CLOSE!)`
    - South-East: `⚠️ BLOOD GROVE (TOO CLOSE!)`
  - Broadcasts screen HUD warning toast:
    - `"⚠️ DANGER: Necromantic Territory Invaded!"` (yellow)
    - `"⚠️ DANGER: Blood Moon Totem Awakened!"` (crimson)
  - **Awakening Spawns**:
    - When player enters the danger zone, the altar triggers a summon wave (camera rumble, magical emergence surge).
    - If the player lingers inside the danger radius, spawns continue periodically (every 3.8s for zombies, 4.2s for werewolves, up to group capacity).
  - **Retreat & Deactivation**:
    - If the player flees outside the $260\text{px}$ danger perimeter, the shrine returns to dormant idle and ceases spawning.
  - **Manual Interaction Retained**:
    - The immediate proximity prompt `Press [E] to Summon` remains active within $<65\text{px}$ for direct player control.

### D. Scaled Environmental Decoration Pipeline
- With the $4\times$ map area, environmental obstacle counts are scaled to fill the vast meadow naturally without crowding:
  - **Trees**: 72 animated trees (Emerald Oak, Golden Olive, Teal Spruce) with circular trunk base collision.
  - **Rocks**: 60 multi-variant rock boulders (Terracotta, Granite Slate, Mossy Serpentine) with ground collision footprints.
  - **Bushes**: 72 animated bushes (Ruby Berry Bramble, Golden Jasmine, Amethyst Heather) with ground-contact collision.
  - Clearances enforced: $>135\text{px}$ from both corner altars, $>100\text{px}$ from player central spawn, and $>40\text{px}$ inter-obstacle separation to ensure wide open traversal corridors across the landscape.

---

## 12. Giant Trees: Ancient Emerald Oak & Celestial Sakura Elder ($128 \times 192\text{px}$)

### A. Design Rationale & 3x Scale Architecture
- **Dimensions**: Built at $128 \times 192\text{px}$ canvas size—approximately $3\times$ the size of standard trees ($48 \times 64\text{px}$) and $8\times$ total visual area ($24,576\text{px}^2$ vs $3,072\text{px}^2$).
- **Two Distinct Variants**:
  1. **Ancient Emerald Oak (`green-giant`)**:
     - Vast, sprawling multi-tiered emerald canopy with deep core shadow (`[14, 38, 20, 255]`), forest midtones, vibrant foliage mounds, sunlit lime crests, and golden leaf glints.
     - Massive gnarled ancient trunk with thick timber striations, moss-draped base roots, and a prominent wood knot.
     - Hanging moss vines dangling beneath the canopy and fallen leaves scattered across the soil contact zone.
  2. **Celestial Sakura Elder (`pink-giant`)**:
     - Ethereal cherry blossom tree with aged silver-plum wood and twisting sinuous boughs.
     - Luminous blossom cloud canopy constructed in blush pinks (`[238, 118, 178, 255]`), vibrant sakura magenta shadows, delicate rose petals, and shimmering celestial white sparkles (`[255, 238, 248, 255]`).
     - Cascading weeping flower clusters and fluttering fallen petals drifting across the root shadow.

### B. Procedural Build, Quality Assurance & Animation Suite
- **PixelForge CLI Pipeline (`src/game/assets-src/trees-giant/` ➔ `public/assets/trees-giant/`)**:
  - `trees-giant-spec.json`: Specification defining $128 \times 192\text{px}$ canvas, 24 palette colors, semantic layers (`base`, `trunk`, `foliage`, `canopy_detail`, `highlights`), and origin `[0.5, 1]`.
  - Batch operations: `00-palette-layers.ops.json`, `10-green-giant.ops.json`, and `20-pink-giant.ops.json`.
  - Animations:
    - `trees-giant-sway-green` (3 frames, 280ms loop): Canopy wind rustle with foliage swaying $2\text{px}$ rightward on wind swell, hanging moss tilting, and falling leaves drifting on the breeze.
    - `trees-giant-sway-pink` (3 frames, 260ms loop): Soft wind gust shifting the blossom clouds, with detached sakura petals fluttering across the air current and settling near the roots.
  - Project Validation (`validate-project.mjs`): 6 frames validated with **0 errors and 0 warnings**.
  - Export Validation (`validate-export.mjs`): $768 \times 192\text{px}$ texture atlas verified with **100% pixel parity**.

### C. Map Placement & Arcade Physics Synchronization
- **Map Distribution (`Game.ts`)**:
  - 18 giant trees distributed across the $1920 \times 1280\text{px}$ continent, alternating between Ancient Oak and Sakura Elder.
  - Strict clearance safeguards: $>170\text{px}$ from both corner shrines, $>140\text{px}$ from player spawn, $>130\text{px}$ between giant trees, and $>75\text{px}$ from regular trees.
- **2.5D Depth Sorting & Natural Canopy Overhead**:
  - Origin set to `(0.5, 1)` with dynamic depth sorting `giantTree.setDepth(y)`.
  - Massive overhead canopy ($y = 8 \dots 145$) allows player, zombies, bullets, and werewolves to freely walk underneath the leafy branches.
  - Solid collision body is strictly isolated to the massive trunk base at the bottom-center ($radius = 14\text{px}$ at offset $x=50, y=154$), updated immediately via `body.reset()` in Arcade Physics.
  - Full collision handlers wired for player, zombies, bullets (despawn on trunk impact), and dragon fireballs.

### D. Bottom Shadow Removal (Foliage Lightness Polish)
- Removed dark ground contact ellipses from both giant trees per user design request (`10-green-giant.ops.json` and `20-pink-giant.ops.json`).
- Re-exported clean $768 \times 192\text{px}$ atlas and confirmed 100% pixel parity.

---

## 13. Personalized Altar HUD Prompt Badges: Undead Crypt & Werewolf Blood Totem ($32 \times 32\text{px}$)

### A. Design Requirements & Iconography
- **Context**: The game features two corner summoning altars:
  1. North-West Zombie Altar (Crypt Territory)
  2. South-East Werewolf Altar (Blood Grove Totem)
- When the player enters proximity ($<260\text{px}$) or approaches interact distance ($<65\text{px}$), personalized visual HUD badges appear over the altar, complementing the textual warnings and interact keys.
- **Frames Created in `src/game/assets-src/hud/`**:
  1. `prompt-altar-zombie` ($32 \times 32\text{px}$):
     - **Base**: Gothic arched mossy crypt stone tablet with dark slate bevels (`[20, 20, 26, 255]` & `[42, 46, 58, 255]`) and green moss undertones (`[28, 54, 36, 255]`).
     - **Frame**: Carved necrotic stone border with antique bronze corner rivets (`[210, 160, 40, 255]`).
     - **Details**: Decaying undead zombie skull with rotting green flesh patches, dark forehead sutures, hollow left eye socket, glowing green necrotic soul flame (`[80, 200, 120, 255]`), jagged teeth in an open jaw, and rising toxic mist wisps.
     - **Keycap & Prompt**: Inlaid beveled slate keycap displaying an arcade-style high-contrast pure white `[E]` flanked by glowing necrotic rune brackets.
     - **Highlights**: Soul eye glint (`[252, 253, 255, 255]`), rune sparkles, and metallic keycap bevels.
  2. `prompt-altar-wolf` ($32 \times 32\text{px}$):
     - **Base**: Ritual basalt & dark obsidian arched tablet (`[28, 22, 26, 255]`) with deep crimson shadow undertones (`[140, 15, 30, 255]`).
     - **Frame**: Crimson Blood Moon runic rim with bright red highlights (`[255, 90, 110, 255]`) and ruby studs.
     - **Details**: Glowing ruby crescent Blood Moon background, ferocious snarling werewolf beast profile with pointed lupine ears, glowing amber eye (`[255, 215, 80, 255]`), snarling muzzle with bone-white saber fangs (`[240, 236, 222, 255]`), and three diagonal glowing claw slashes.
     - **Keycap & Prompt**: Inlaid basalt keycap displaying an arcade-style pure white `[E]` flanked by glowing ruby claw brackets.
     - **Highlights**: Blood moon specular glints (`[255, 195, 205, 255]`), razor fang tip gleam, and beast eye sparkle.

### B. Procedural Construction & Skill Validation
- **Operations Batch (`60-altar-prompts.ops.json`)**: 192 procedural operations creating the two frames across all 4 layers (`base`, `frame`, `details`, `highlights`).
- **Applied & Validated**:
  - `pixelforge apply`: Executed with zero errors.
  - `validate-project.mjs`: Project verified with 14 total frames, **0 errors, 0 warnings**.
  - `pixelforge export`: Clean export to `public/assets/hud/` generating `hud.png` ($448 \times 32\text{px}$) and `hud.atlas.json`.
  - `validate-export.mjs`: Export verified with **100% pixel parity** against source rasters.

### C. Engine & Gameplay Integration (`Game.ts`)
- **Instantiation**: Both prompt badges instantiated in `createAltar()` at `(X, Y - 96)` scaled to $1.5\times$ with depth $2000$.
- **Mystical Floating Tween**: Added a smooth vertical bobbing tween (`y: '-=6'`, duration $1100\text{ms}$, Sine ease, yoyo) to make the badges hover magically above the altars.
- **Proximity Coupling**: In `update()`, both badges automatically become visible whenever the player enters danger proximity or approaches interact range, perfectly synchronized with `'⚠️ CRYPT TERRITORY (TOO CLOSE!)'` / `'Press [E] to Summon Zombie'` and `'⚠️ BLOOD GROVE (TOO CLOSE!)'` / `'Press [E] to Summon Werewolf'`.

---

## 14. Traveling Vendor NPC, Interactive Shop Menu & Shotgun Weapon Arsenal

### A. Feature Overview & Design
To expand the gameplay loop with currency progression and combat diversity, a complete Vendor and Weapon system was created using `pixelforge-sprite-creator`:
1. **Traveling Vendor NPC** (`src/game/assets-src/vendor/` ➔ `public/assets/vendor/`):
   - Situated in the South-West corner of the map ($X: 260, Y: 1060$), with a clearance clearing radius of $140\text{px}$ ensuring no trees, giant trees, rocks, or bushes intersect.
   - 48x64px animated merchant sprite featuring a striped canopy market stall, wooden counter display with antique brass balance scales and potion flasks, hooded wandering merchant with a flowing travel cloak, leather satchel, and animated idle sway with lantern flicker (`vendor-idle`, 3 frames, 360ms loop).
   - Solid collision physics: player, zombies, and bullets collide with the stall counter base.
2. **Shop Prompt & Floating Badge** (`src/game/assets-src/hud/`):
   - Approaching within $80\text{px}$ displays the floating badge `prompt-vendor-buy` ($32 \times 32\text{px}$) with an arcade `[E]` keycap and coin emblem, accompanied by floating label `'Press [E] to Browse Shop'`.
3. **Shop Menu Interface** (`src/game/assets-src/menu/` ➔ `public/assets/menu/`):
   - Pressing **[E]** near the vendor opens the pixel art modal Shop UI:
     - `shop-banner` ($160 \times 40\text{px}$): Carved wooden signboard with gold corner rivets and calligraphy `'WANDERING TRADER'`.
     - `item-card-frame` ($160 \times 60\text{px}$): Beveled mahogany frame showcasing the item preview, stats, and price.
     - `btn-buy-normal`, `btn-buy-hover`, `btn-buy-disabled` ($96 \times 24\text{px}$): Interactive purchase button with embossed borders.
   - Shop modal freezes player movement and prevents shooting. Closes via clicking close button, pressing **[E]** again, or pressing **[ESC]**.
4. **Shotgun Weapon & Buckshot Pellets** (`src/game/assets-src/weapons/` ➔ `public/assets/weapons/`):
   - Created a dedicated `weapons` sprite project ($64 \times 32\text{px}$):
     - `shotgun-item` ($48 \times 20\text{px}$): Heavy pump-action combat trench shotgun with blued steel barrel, walnut stock, brass ejection port, and ribbed pump grip.
     - `shotgun-pellet` ($8 \times 8\text{px}$): High-velocity molten buckshot projectile with glowing yellow core and orange heat fringe.
5. **HUD Weapon & Ammo Extension** (`src/game/assets-src/hud/`):
   - Added `icon-shotgun` ($20 \times 16\text{px}$), `shell-pip-full` ($8 \times 12\text{px}$ red & brass 12-gauge shotgun shell), and `shell-pip-empty` ($8 \times 12\text{px}$ spent brass casing).
   - HUD dynamically switches between Tactical Rifle (7 bullet pips) and Shotgun (4 shell pips) based on active weapon.

### B. Currency & Arsenal Gameplay Loop
- **Currency (Score / Kills)**:
  - Defeating zombies or werewolves increments `this.score`.
  - The Shotgun costs **10 Kills** (`SHOTGUN_PRICE = 10`).
  - When `score < 10`, the shop button displays `LOCKED (10 KILLS)` in disabled state.
  - When `score >= 10`, the button glows and activates: `'BUY FOR 10 KILLS'`.
  - Purchasing deducts 10 Kills, unlocks `hasShotgun = true`, and equips the Shotgun immediately. Once owned, the button states `'EQUIPPED [OWNED - PRESS Q TO SWAP]'`.
- **2-Weapon Loadout Mechanics**:
  - **Tactical Carbine Rifle (`[1]`)**: 7-round magazine, high-velocity pinpoint accuracy, $200\text{ms}$ fire rate.
  - **Heavy Trench Shotgun (`[2]`)**: 4-round magazine, 5-pellet cone spread across $28^\circ$, screen recoil rumble (`camera.shake(120, 0.007)`), and $480\text{ms}$ pump rate.
  - Quick-swap between weapons at any time using **`[Q]`** or number keys **`[1]`** / **`[2]`**.
  - Independent magazine tracking ensures tactical reloading: swapping saves current ammo for both weapons.

### C. Skill & CLI Findings for Multi-Atlas Integration
- **Separate Spritesheets for Modular Asset Domains**:
  - Adding vendor to `vendor`, shop UI to `menu`, shotgun to `weapons`, and icons to `hud` maintained clean project modularity without inflating single sprite projects.
  - All 4 projects validated through `validate-project.mjs` and verified with 100% pixel parity via `validate-export.mjs`.
- **Phaser 4 Preloader Texture Management**:
  - Loading multiple atlases with distinct keys (`vendor`, `weapons`, `hud`, `menu`) is cleanly handled in `Preloader.ts` via native `this.load.atlas()`.

---

## 15. Shotgun Player & Heroine Sprites: Full 8-Directional & Action Set Pipeline

### A. Requirement & Visual Design
When the player equips the Heavy Trench Shotgun, both playable characters (**Survivor** `player` and **Scholar** `heroine`) must visually hold and operate the heavy shotgun across every gameplay action and directional perspective instead of retaining the rifle sprite.

1. **Pixel Art Weapon Characteristics**:
   - **Solid Walnut Stock**: Ergonomically pressed against the shooter's shoulder.
   - **Heavy Steel Receiver**: Thick, angular receiver housing a brass ejection port.
   - **Over-Under Double Tube**: Upper 12-gauge barrel + lower tubular magazine with twin muzzle ring and brass bead sight.
   - **Ribbed Wooden Pump Slide**: Foreshortened forward hand grip that slides rearward during the recovery and reload cycles.
   - **Heavy 12-Gauge Buckshot Muzzle Flash**: Conical multi-spark blast on shoot step 1.
   - **Spent Hull Ejection**: Flying brass/red shell casing on shoot step 2 (recover).
   - **Tactical Tube Reload**: Direct red-and-brass shell insertion into the underbarrel tube magazine.

2. **Complete State & Direction Coverage**:
   - **Side-View Frames (16 frames)**: `shotgun-frame-0`, `shotgun-idle-b`, `shotgun-walk-1..4`, `shotgun-shoot-windup`, `shotgun-shoot-flash`, `shotgun-shoot-recover`, `shotgun-hurt`, `shotgun-die-1..3`, `shotgun-reload-1..3`.
   - **Directional Frames (64 frames)**: 16 frames each across `front` (South), `front45` (South-East / South-West with flip), `back` (North), and `back45` (North-East / North-West with flip).
   - **Total per character**: 80 new shotgun frames and 30 new shotgun animations, bringing each character project to **160 frames** and **60 animations**.

### B. Skill-Driven Architecture & Layer Isolation
- **Layer Cleanliness**:
  - In `player.sprite.json` and `heroine.sprite.json`, weapons reside strictly on the `gun` layer.
  - Clearing the weapon layer with `{ op: "drawRect", frame, layer: "gun", x: 0, y: 0, width: 48, height: 64, color: 0, filled: true }` completely removes the rifle while 100% preserving character faces, hairstyles, clothing folds, boots, and movement physics across `base`, `cloth`, and `gear` layers.
- **Deterministic Pipeline Script**:
  - Built `src/game/assets-src/directional/generate-shotgun-players.mjs`.
  - Clears previous shotgun frames/animations idempotently, compiles PixelForge batch operations, and applies them cleanly via `node_modules/@pixelforge/cli/dist/index.js apply`.
  - Boundary-safeguarded coordinates prevent any shape or pixel from exceeding the $48 \times 64\text{px}$ canvas boundaries.

### C. Validation & Export Parity
1. **Project Validation (`validate-project.mjs`)**:
   - `player.sprite.json`: 160 frames, 60 animations, 0 errors.
   - `heroine.sprite.json`: 160 frames, 60 animations, 0 errors.
2. **Texture Atlas Export (`pixelforge export`)**:
   - Exported to `public/assets/player` and `public/assets/heroine` in Phaser atlas layout.
   - Generated $2016 \times 256\text{px}$ packed textures containing all 160 frames.
3. **Export Parity Verification (`validate-export.mjs`)**:
   - `public/assets/player`: 160 frames, 0 errors, 0 warnings.
   - `public/assets/heroine`: 160 frames, 0 errors, 0 warnings.

### D. Engine & Runtime Wiring
1. **Dynamic Animation Resolver (`src/game/player-facing.ts`)**:
   - Extended `playerAnimation(character, action, facing, weapon = 'rifle')` to prefix `shotgun-` when `weapon === 'shotgun'`.
   - Produces keys matching registered animations: `${character}-${weaponPart}${action}${POSES[facing].suffix}` (e.g. `player-shotgun-walk-front45`, `heroine-shotgun-idle`, etc.).
2. **Phaser Game Scene Integration (`src/game/scenes/Game.ts`)**:
   - `playerAnimationKey(action)` routes through `this.activeWeapon`.
   - `setWeapon()` immediately plays the appropriate idle/walk shotgun animation upon weapon swap with `[Q]`, `[1]`, or `[2]`.
   - `switchCharacter()` seamlessly retains the active weapon's sprite animations for both Survivor and Scholar.

---

## 16. First-Aid Kit Item, Dual-Card Shop, HUD Counter & Animated Healing Particle FX

### A. Feature Overview & Design
To introduce survivability and a repeatable economy sink into the core gameplay loop, a complete First-Aid Kit system was created using `pixelforge-sprite-creator`:
1. **First-Aid Kit Shop Item** (`src/game/assets-src/weapons/weapons.sprite.json` ➔ `public/assets/weapons/`):
   - Added `medkit-item` ($64 \times 32\text{px}$): Heavy field surgical case with durable ivory enamel plating, embossed crimson cross, cold-rolled steel corner braces, brass locking clasps, and reinforced leather carrying handle.
2. **First-Aid Kit HUD Icon** (`src/game/assets-src/hud/hud.sprite.json` ➔ `public/assets/hud/`):
   - Added `icon-medkit` ($32 \times 32\text{px}$): High-contrast pixel badge featuring the emergency medical kit with distinct drop shadow, bold red Geneva cross emblem, and brass fixtures.
3. **Animated Healing Particle FX** (`src/game/assets-src/heal-fx/heal-fx.sprite.json` ➔ `public/assets/heal-fx/`):
   - Created a standalone 48x64px sprite project with origin $(0.5, 1)$ aligning precisely with the player's world coordinates and visual silhouette.
   - 6 sequential frames (`heal-1` to `heal-6`) forming the `heal-play` animation ($510\text{ms}$ duration):
     - `heal-1`: Ground-level restorative summoning ring with emerald runes appearing at the character's feet.
     - `heal-2`: Rising ring of emerald light with initial ascending medical cross particles and vitality sparks.
     - `heal-3`: Peak expansion of radiant emerald ring around the torso with bold floating crosses and glittering gold dust.
     - `heal-4`: Radiant aura ascending through the head/shoulders with dissipating sparkles.
     - `heal-5`: High-altitude fading sparkle burst and lingering mint mist.
     - `heal-6`: Final ambient vitality motes dissolving into the air.
   - Spawns over the player dynamically, follows player movement, and plays without altering base player character spritesheets.

### B. Vendor Shop & Repeatable Economy
- **Dual-Card Black Market Armory Modal** (`src/game/systems/ShopSystem.ts`):
  - Upgraded the single-item shop into a balanced 2-column inventory showcase:
    - **Left Card - Trench Shotgun**: 10 Kills (`SHOTGUN_PRICE = 10`), one-time unlock and equip, swap via `[Q]`.
    - **Right Card - First-Aid Kit**: 2 Kills (`FIRST_AID_PRICE = 2`), consumable supply.
  - **Repeatable Purchasing**:
    - Unlike unique weapons, First-Aid Kits can be purchased repeatedly as long as `score >= 2`.
    - Deducts 2 kills, increments `playerController.medkits`, updates shop counter `(OWNED: X)`, flashes the screen with amber tint, and emits an alert message: `+1 FIRST-AID KIT PURCHASED! (OWNED: X)`.
  - **Shop Hotkeys**:
    - `[1]` / `[Space]`: Buy / Equip Shotgun.
    - `[2]` / `[B]`: Buy First-Aid Kit.

### C. HUD Integration & Healing Controls
- **Interactive First-Aid HUD Element** (`src/game/systems/HudSystem.ts`):
  - Displays beneath the weapon plate on the right side of the screen ($X: 1140, Y: 104$).
  - Composed of `plate` frame, `icon-medkit`, interactive pointer cursor (`useMedkit()` on click), hotkey prompt `FIRST-AID [B]`, and dynamic quantity counter `x0`.
  - Counter text turns bright white/gold when `medkits > 0` and dim gray `#71717a` when empty.
- **Healing Mechanic & Guard Logic** (`src/game/systems/PlayerControllerSystem.ts`, `src/game/systems/ControlsSystem.ts`, `src/game/systems/GameplaySystem.ts`):
  - Triggered by pressing key **`[B]`** or clicking the HUD medkit icon during active gameplay.
  - **Guard 1 (No Supplies)**: If `medkits <= 0`, displays `NO FIRST-AID KITS! VISIT VENDOR (2 KILLS)` in red.
  - **Guard 2 (Full Health)**: If `playerHealth >= maxHealth`, displays `HEALTH ALREADY FULL! (5/5 HP)` in cyan, preventing kit waste.
  - **Success Flow**:
    - Decrements `medkits` by 1.
    - Heals $+2$ HP (`FIRST_AID_HEAL_AMOUNT = 2`, clamped to `maxHealth = 5`).
    - Triggers player green vitality flash (`setTint(0x34d399)` for $160\text{ms}$).
    - Spawns and tracks the `heal-fx` particle animation over the player.
    - Updates HUD health hearts, medkit counter, and displays `+2 HP RESTORED! (X/5 HP)`.
  - **Scene Restart Lifecycle**: Resets `medkits = 0` cleanly in `reset()` for idempotent per-run state.

### D. Skill & CLI Validation
1. **`pixelforge init` CLI Usage**:
   - `pixelforge init heal-fx --output <path> --width 48 --height 64` successfully initialized the new FX asset structure.
2. **Project Validation (`validate-project.mjs`)**:
   - `weapons.sprite.json`: 3 frames, 0 errors, 0 warnings.
   - `hud.sprite.json`: 20 frames, 0 errors, 0 warnings.
   - `heal-fx.sprite.json`: 6 frames, 1 animation (`heal-play`), 0 errors.
3. **Texture Atlas Export (`pixelforge export`)**:
   - Cleanly exported all three projects to `public/assets/weapons`, `public/assets/hud`, and `public/assets/heal-fx`.
4. **Export Parity Verification (`validate-export.mjs`)**:
   - `public/assets/weapons`: 3 frames, 0 errors, 0 warnings (100% parity).
   - `public/assets/hud`: 20 frames, 0 errors, 0 warnings (100% parity).
   - `public/assets/heal-fx`: 6 frames, 0 errors, 0 warnings (100% parity).
5. **Automated Unit Testing & Build**:
   - 25 unit tests passing in `tests/game-systems.test.cjs`.
   - `npm run typecheck`, `npm test`, and `npm run build` executed with 0 errors.

---

## 17. Tactical Carbine Rifle HUD Weapon Icon (`icon-rifle` / `icon-ammo`)

### A. Context & Design Motivation
While the heavy shotgun displayed a dedicated side-profile weapon badge in the HUD (`icon-shotgun`), the default primary weapon (Tactical Carbine Rifle) displayed a vertical brass bullet sprite (`icon-ammo`), creating visual asymmetry between the two weapon states in the player's HUD.

### B. Asset Implementation with PixelForge
- **Frame Format**: 32x32px badge with matching dark slate plate and bronze/gold beveled rim identical to `icon-shotgun`.
- **Weapon Silhouette**: Detailed horizontal side profile of the Tactical Carbine Rifle ($x: 5 \dots 27$, $y: 11 \dots 24$):
  - **Stock**: Skeletal polymer carbine buttstock with rubber recoil pad, buffer tube, and collar.
  - **Receiver**: Upper/lower receiver with Picatinny flat-top rail, ejection port, brass casing glint, and bolt carrier.
  - **Grip & Trigger**: Contoured dark brown pistol grip, trigger guard, and trigger blade.
  - **Magazine**: High-capacity curved 30-round magazine with floorplate and metal ribbing glints.
  - **Optic**: Low-profile tactical reflex sight with anti-glare lens and bright red aiming dot.
  - **Barrel & Muzzle**: Vented tactical handguard, exposed carbine barrel, front sight post, and muzzle flash hider.
- **Dual Frame Aliasing**:
  - Saved as both `icon-rifle` and copied to `icon-ammo` to guarantee 100% backward and forward compatibility.
  - `HudSystem.ts` explicitly displays `icon-rifle` when the rifle is selected, switching to `icon-shotgun` when the shotgun is equipped.
  - Bullet pips (`bullet-pip-full`, `bullet-pip-empty`) and reloading mechanics (`icon-reload`) remain completely untouched.

### C. Validation & Export
- Validated `src/game/assets-src/hud/hud.sprite.json` (21 frames, 0 errors, 0 warnings).
- Exported atlas to `public/assets/hud/`.
- Validated export parity with `validate-export.mjs` (100% pixel parity on all 21 frames).
- Tested in `tests/game-systems.test.cjs` (25/25 passing unit tests).

---

## 18. Walking Reload Animations & Velocity-Based Reload Switching (`reload-walk`)

### A. Context & Gameplay Bug
Previously, when the player initiated a reload while moving across the meadow, the system played the static 3-frame stationary reload animation (`reload` / `shotgun-reload`). This caused the character to slide unnaturally across the ground while stationary reload poses played. Furthermore, if the player moved during an active reload, the movement state machine did not adapt, remaining locked into the static animation until the reload timer completed.

### B. Procedural Animation Design for Both Characters and Weapons
Using PixelForge and procedural operation scripts, we generated dedicated walking reload animations (`reload-walk` and `shotgun-reload-walk`) for both characters (**Survivor** `player` and **Scholar** `heroine`) across all perspectives:
1. **Four-Phase Reload Cycle Synced with Walking Mechanics**:
   - **Step 0 (250ms)**: Left leg extended forward, weapon pulled inward, ejection port cleared / shotgun pump racked back.
   - **Step 1 (250ms)**: Passing stride with torso dip (bob $-1$px), fresh magazine inserted into magwell / 12-gauge brass shell loaded into magazine tube.
   - **Step 2 (250ms)**: Right leg extended forward, magazine locked home / second shell inserted.
   - **Step 3 (250ms)**: Passing stride with torso dip, charging handle pulled and released / shotgun pump slide racked forward into battery, weapon leveled.
2. **Timing & Looping**:
   - Total duration: $250\text{ms} \times 4 = 1000\text{ms}$, precisely matching `WeaponsSystem.reloadDuration = 1000ms`.
   - `loop: true` configured across all directional variants for seamless continuous movement during reload.
3. **Comprehensive Directional Coverage (10 Animations per Character, 20 Total)**:
   - **Side View**: `reload-walk` (rifle) and `shotgun-reload-walk` (shotgun).
   - **Cardinal South**: `reload-walk-front` and `shotgun-reload-walk-front`.
   - **Diagonal Southeast/Southwest**: `reload-walk-front45` and `shotgun-reload-walk-front45`.
   - **Cardinal North**: `reload-walk-back` and `shotgun-reload-walk-back`.
   - **Diagonal Northeast/Northwest**: `reload-walk-back45` and `shotgun-reload-walk-back45`.
   (West, Southwest, and Northwest perspectives are automatically handled by Phaser with horizontal flip).

### C. Implementation & Pipeline Updates
1. **Type Definitions**:
   - `src/game/player-facing.ts`: Added `'reload-walk'` to the `PlayerAction` union (`'idle' | 'walk' | 'shoot' | 'reload' | 'reload-walk' | 'hurt' | 'die'`).
2. **Procedural Generators**:
   - `src/game/assets-src/directional/generate.mjs`: Added side-view frames `reload-walk-1..4`, directional frames `reload-walk-${dir}-${step}`, and registered all 5 rifle `reload-walk` animations.
   - `src/game/assets-src/directional/generate-shotgun-players.mjs`: Added side-view frames `shotgun-reload-walk-1..4`, directional frames `shotgun-reload-walk-${dir}-${step}`, pump slide state, shell loading visuals, and registered all 5 shotgun `shotgun-reload-walk` animations.
3. **Engine System Updates**:
   - `src/game/systems/PlayerControllerSystem.ts`:
     - In `updateMovement()`: when `weapons.isReloading` is active, checks velocity (`vx !== 0 || vy !== 0`). Plays `playerAnimationKey('reload-walk')` when moving and `playerAnimationKey('reload')` when stationary.
     - In `switchCharacter()` and `damagePlayer()` recovery: accurately resumes `reload-walk` or `reload` based on movement velocity.
   - `src/game/systems/WeaponsSystem.ts`:
     - In `startReload()`: starts `reload-walk` if moving or `reload` if stationary.

### D. Skill Verification & Quality Assurance
1. **Project Validation (`validate-project.mjs`)**:
   - `player.sprite.json`: 200 frames, 0 errors, 0 warnings.
   - `heroine.sprite.json`: 200 frames, 0 errors, 0 warnings.
2. **Phaser Texture Atlas Export (`pixelforge export`)**:
   - Exported both player and heroine atlases with explicit `--name player` and `--name heroine`.
3. **Decoded Raster Parity (`validate-export.mjs`)**:
   - Validated both bundles against source projects: 100% pixel parity on all 200 frames.
4. **Automated Unit Testing & Build**:
   - Added automated tests in `tests/game-systems.test.cjs` verifying animation key resolution, dynamic velocity switching, and disk existence of all 20 reload-walk animations.
   - All 33 unit tests pass.
   - `npm run typecheck` and `npm run build` completed with 0 errors.

---

## 19. Blue-Red Witch Variant (`witch-red`) & Red Potion Bundle (`witch-potion-red`)

### A. Context & User Request
The user requested a new variant for the witch:
- Dressed in a blue and red dress.
- Throws red potions.
- Spawns randomly from the witches' existing altar/territory without creating any new altars or spawn points.

### B. Procedural Sprite & Palette Generation
Using `src/game/assets-src/witch/generate.mjs`:
1. **Blue-Red Palette (`paletteRed`)**:
   - **Sapphire/Cobalt Outer Gown & Wizard Hat**: Deep midnight blue (`#0f172a`), royal blue (`#1e3a8a`), sapphire blue (`#2563eb`), celestial sky blue highlight (`#60a5fa`).
   - **Scarlet/Ruby Panels, Corset & Accents**: Deep wine (`#450a0a`), crimson ruby (`#991b1b`), vibrant scarlet (`#dc2626`), rose highlight (`#f87171`).
   - **Polished Gold Accents**: Shadow gold (`#854d0e`), bright amber (`#eab308`), gold glint (`#fef08a`).
   - **Silver-Platinum Hair & Ivory Skin**: Platinum white hair (`#f8fafc`, `#cbd5e1`), porcelain ivory skin (`#fef2f2`, `#fecdd3`, `#fda4af`), ruby red eyes (`#ef4444`).
   - **Red Glass Potion Bottle**: Crimson base (`#7f1d1d`), ruby liquid (`#b91c1c`), scarlet surface (`#ef4444`), bright pink spark (`#fca5a5`).
2. **Directional Views & Animation Suite**:
   - 110 frames generated across 5 perspectives (side, front, front45, back, back45; with Phaser automatic flip handling west, southwest, northwest).
   - 25 animations across actions: `idle`, `walk`, `attack`, `hurt`, `die`.
   - 5 `throw-potion` animation events and 5 `potion-release` anchor points matching windup frame index 2 (320ms windup).
   - Uniform hurtbox `(12, 24, 24, 38)` at origin `(0.5, 1)` ensuring exact combat consistency.
3. **Red Potion Bundle (`witch-potion-red`)**:
   - 24x24 sprite with 8 frames: 4 rotating flight frames (`fly-0..3`) and 4 expanding impact splash frames (`splash-0..3`).
   - Bubbling ruby liquid, glowing crimson glass, and scarlet splash droplet particles.

### C. Game Systems Integration
1. **Enemy Variants Configuration**:
   - Updated `src/game/systems/enemy-variants.ts` to include `'witch-red'` in `ZombieVariantConfig` and defined `SCARLET_WITCH_CONFIG` with `variantName: 'Scarlet Witch'`, identical stats (2 HP, 1 score), and mapped animation prefixes.
2. **Preloading & Animation Registration**:
   - `src/game/scenes/Preloader.ts`: Added `'witch-red'` and `'witch-potion-red'` to the asset loading loop.
   - `src/game/systems/AnimationsSystem.ts`: Added `'witch-red'` and `'witch-potion-red'` to the variant animation registry.
3. **Random Spawning at Cauldron**:
   - `src/game/systems/WitchSystem.ts`:
     - Randomly selects between standard `'witch'` and `'witch-red'` via `Phaser.Math.Between(0, 1) === 0 ? 'witch' : 'witch-red'`.
     - Supports optional `variantOverride` parameter for deterministic testing.
     - Preserves existing cauldron altar location, proximity detection, population cap (2 max), and cooldowns without creating any new altars.
4. **Combat & Potion Throwing**:
   - `throwPotion(witch)` checks `witch.getData('variant')`. If `'witch-red'`, fetches anchor metadata from `witch-red-game` and spawns a `witch-potion-red` projectile tagged with `potionKey: 'witch-potion-red'`.
   - `impact(potion)` extracts `potionKey` and instantiates the matching splash animation (`witch-potion-red-splash`), dealing 1 damage to the player if caught within splash radius.
5. **Enemies System & AI Routing**:
   - `src/game/systems/EnemiesSystem.ts`: Both `variant === 'witch'` and `variant === 'witch-red'` are routed to `WitchSystem.updateEnemy`.

### D. Skill Verification & Quality Assurance
1. **Project Validation (`validate-project.mjs`)**:
   - `witch-red.sprite.json`: 110 frames, 0 errors, 0 warnings.
   - `witch-potion-red.sprite.json`: 8 frames, 0 errors, 0 warnings.
2. **Decoded Raster Parity (`validate-export.mjs`)**:
   - 100% pixel parity on all 110 frames of `witch-red` and 8 frames of `witch-potion-red`.
3. **Automated Unit Testing (`npm test`)**:
   - Added comprehensive unit test in `tests/game-systems.test.cjs`:
     - Verifies random spawning produces both `witch` and `witch-red` variants.
     - Verifies `witch-red` state machine, directional attack animations, projectile launch with `witch-potion-red`, splash on impact, and hurt/death transitions.
     - 45/45 unit tests pass.
4. **Typechecking & Production Build**:
   - `npm run typecheck` passed (0 errors).
   - `npm run build` passed.

---

## 20. Castle Prison Zone & Animated Tileset Implementation (`CastleSystem`)

### A. Context & User Request
The user requested:
- Integration of the new 8 animated Castle Prison tiles (`prison-floor`, `prison-wall`, `prison-bars`, `prison-puddle`, `prison-torch`, `prison-chains`, `prison-straw`, `prison-door`).
- Creation of a mystical teleporter portal at the top of the current Meadow map.
- Construction of the new Castle zone using the complete animated tileset.

### B. Asset Creation & Validation (`portal`)
Using `src/game/assets-src/portal/generate.mjs`:
- Designed a 32×48px stone obelisk arched portal with an animated swirling arcane energy vortex (4 frames, 150ms each = 600ms loop).
- Verified with `validate-project.mjs` (0 errors) and `validate-export.mjs` (100% pixel parity).
- Documented in `src/game/assets-src/portal/README.md`.
- Verified all 8 prison tiles (`validate-project.mjs` and `validate-export.mjs` all passed with 0 errors).

### C. Game Architecture & Castle Layout
1. **Castle Zone Blueprint**:
   - Laid out on a $32 \times 24$ grid of 32px tiles ($1024 \times 768$ px) at origin $(2400, 160)$.
   - Constructed with all 8 tiles playing their native continuous ambient animations:
     - Flagstone floor across all 768 tiles with drifting dust motes (`prison-floor-idle`).
     - Solid fortress walls with water drips (`prison-wall-drip`).
     - 6 individual prison cells with iron bar fronts and padlocks (`prison-bars-rattle`), creaking heavy doors (`prison-door-idle`), settling straw bedding (`prison-straw-settle`), stagnant water puddles with expanding ripples (`prison-puddle-ripple`), and swaying wall chains (`prison-chains-sway`).
     - Double-flanked central dungeon corridor lit by mounted flickering torches (`prison-torch-flicker`).
2. **Teleportation Portal Mechanics**:
   - Meadow Portal at $(960, 80)$ with obstacle clearance plaza. Stepping inside or pressing [E] teleports player to $(2912, 800)$ inside the castle, shifts camera bounds to $[2400, 160, 1024, 768]$, triggers camera flash, warps companion, and triggers HUD/chat notifications.
   - Castle Return Portal at $(2912, 864)$ inside the South Gate teleports player back to $(960, 130)$ in the meadow, restoring camera bounds to $[0, 0, 1920, 1280]$.
   - 1200ms cooldown prevents rapid bouncing. Modal windows and player death properly suppress prompts and teleports.
3. **Collision & Companion Integration**:
   - `CollisionsSystem` binds player, enemies, bullets, and witch potions against `castle.solidObstacles`.
   - `CompanionSystem` dynamically clamps to active world bounds, enabling the companion dog to explore the castle alongside the player.
   - `WeaponsSystem` bullet cleanup uses `TOTAL_WORLD_WIDTH` ($3600$) and `TOTAL_WORLD_HEIGHT` ($1280$).

### D. Skill Verification & Quality Assurance
1. **Offline Unit Tests (`npm test`)**: All 54 tests pass.
2. **Static Typecheck (`npm run typecheck`)**: 0 errors.
3. **Production Build (`npm run build`)**: Vite production build succeeded.
4. **Browser Smoke Test (`game-browser-smoke.cjs`)**: Full end-to-end integration test passed.
---

## 21. Tetric Dungeon Tileset Overhaul & Dizziness Elimination (`pixelforge-sprite-creator`)

### A. Problem Statement & Root Cause
- **User Feedback**: "Okay I'm feeling dizzy in the prison, your /goal is use the /pixelforge-sprite-creator skill to adjust the tiles and sprites of the prison, cause everything is sparkling and should be an environment more tetric"
- **Root Cause Analysis**:
  1. `prison-floor` had 2×2 bright white dust motes (`[200, 200, 210, 255]`) alternating on/off every 200ms. Across all 768 floor tiles with staggered animation phases, this created a high-frequency, ceaseless flickering glitterfield that visually overwhelmed and disoriented the player.
  2. The floor and walls shared identical flat, light-grey background tones (`[130, 122, 134, 255]`), destroying environmental depth and contrast.
  3. `prison-bars` used alternating 1px zebra stripes shifting left and right every 120ms, producing an aggressive vibrating moiré pattern.
  4. Overlay tiles (`prison-torch`, `prison-puddle`, `prison-straw`, `prison-chains`) were constructed on solid opaque grey rectangles rather than transparent backgrounds, cutting jarring square grey patches into the floor.

### B. Visual & Atmospheric Overhaul (Gothic "Tétric" Dungeon)
Using the `pixelforge-sprite-creator` skill, all 8 prison tiles were redesigned with dedicated reproducible generator scripts (`src/game/assets-src/prison-*/generate.mjs`):

1. **`prison-floor` (32×32px)**:
   - Completely eliminated all flashing bright white pixels.
   - Built an authentic Gothic dungeon flagstone floor using irregular interlocking stone slabs (`[24, 26, 34, 255]`, `[34, 38, 48, 255]`), dark shadow mortar grooves (`[14, 15, 20, 255]`), corner moss patches (`[20, 28, 24, 255]`), and hairline cracks.
   - Replaced strobe with subtle, comfortable ambient damp sheen (`[40, 46, 58, 255]`) on a slow 300ms cycle (1200ms loop) with zero high-contrast flicker.
2. **`prison-wall` (32×32px)**:
   - Deep, imposing ashlar stone masonry (`[26, 28, 38, 255]`, `[40, 44, 58, 255]`) providing strong contrast and depth against the floor.
   - Replaced random jumping cyan rectangles with a realistic, solitary water drop trickling down a vertical fissure from courses 1 to 3 and splashing at the stone base.
3. **`prison-bars` (16×32px)**:
   - Weathered, cylindrical dark wrought-iron bars with heavy cross-ties, rivets, keyhole padlock, and rust stains (`[55, 34, 24, 255]`, `[82, 50, 34, 255]`).
   - Fully transparent background; replaced vibrating moiré jitter with subtle tension shudder.
4. **`prison-torch` (16×32px)**:
   - Mounted black iron wall bracket with bolts, sconce basket, wrapped pitch torch head, and a vibrant, warm Gothic flame (amber, orange, golden core) dancing in 6 frames.
   - Fully transparent background, sitting naturally against dungeon walls and floors.
5. **`prison-puddle` (32×32px)**:
   - Dark, murky stagnant dungeon pool with organic edges and smooth expanding concentric ripples.
   - Fully transparent background, pooling naturally over flagstones.
6. **`prison-chains` (16×32px)**:
   - Heavy blackened iron chain links and open manacle shackle swaying with natural pendulum motion.
   - Fully transparent background.
7. **`prison-straw` (32×32px)**:
   - Rotted, moldy dungeon bedding heap with criss-crossing aged stalks and subtle settling animation.
   - Fully transparent background.
8. **`prison-door` (32×32px)**:
   - Heavy seasoned oak planks, stone jamb, blackened iron reinforcement straps with rivets, and a barred speakeasy peep grate.
   - Subtle tension breathing, eliminating 1px collision-disrupting jitter.

### C. Skill Verification & Quality Assurance
- **PixelForge Project Validation (`validate-project.mjs`)**: All 8 projects passed with 0 errors.
- **PixelForge Export Validation (`validate-export.mjs`)**: All 8 exported atlas bundles passed with **100% pixel parity**.
- **Offline Unit Tests (`npm test`)**: All 54 tests passed.
- **Static Typecheck (`npm run typecheck`)**: 0 errors.
- **Production Build (`npm run build`)**: Vite production build succeeded.
- **Browser Smoke Test (`game-browser-smoke.cjs`)**: Full end-to-end integration test passed.
- **Visual Smoke Test**: Playwright browser capture confirmed the grim, tetric, atmospheric Gothic dungeon aesthetic with zero dizziness-inducing sparkles.

