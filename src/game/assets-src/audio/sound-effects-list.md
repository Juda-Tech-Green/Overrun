# PixelForge Procedural Sound Effects Inventory

> Complete list of 103 procedural sound effects to synthesize, validate, and integrate using the `pixelforge-audio-creator` skill (PixelForge 0.6.0).

---

## 1. Player & Characters (`player`, `heroine`, `companion-dog`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `player-step-grass` | Walking on meadow grass tiles | Filtered brown noise burst, short decay (60 ms), gentle low-pass |
| `player-step-stone` | Walking on castle stone tiles | Resonant bandpass transient (70 ms), high-mid damped mode |
| `player-step-water` | Walking through prison puddles | Dual-pitch splash with high-frequency noise fizz (120 ms) |
| `player-hurt-male` | Survivor takes damage | Damped low voice grunt, pitch sweep 180→80 Hz with tanh saturation |
| `player-hurt-female` | Scholar Heroine takes damage | Damped mid voice flinch, pitch sweep 320→160 Hz with soft clip |
| `player-die` | Player HP reaches 0 | Sub-bass drop with fading noise exhale (900 ms) |
| `player-heartbeat-low` | Player at 1 HP (danger warning) | Dual sub-thump sine pulse (60 Hz & 45 Hz) with gentle exponential decay |
| `character-switch` | Pressing `[G]` to swap survivor | Fast ascending sine arpeggio (440→880 Hz) with soft shimmer echo |
| `heal-use` | Using a First-Aid Kit (`[H]`) | High-frequency sparkling resonance + rising warm harmonic swell (450 ms) |
| `dog-bark` | Companion dog idle/follow alert | Formant-modulated pulse wave with pitch envelope (450→220 Hz) |
| `dog-whimper-alert` | Dog warning when player is hurt | Modulated high sine sweep (800→500 Hz) with vibrato |

---

## 2. Weapons & Combat Arsenal (`WeaponsSystem`, `AimingSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `rifle-fire` | Firing standard survivor rifle | `gunshot` recipe: sharp white-noise transient + damped 120→45 Hz body |
| `rifle-empty` | Firing with 0 ammo | High-pitched metallic click, damped dual resonator (1800 & 3200 Hz) |
| `rifle-reload` | Pressing `[R]` / magazine reload | Three-part mechanical ratchet: mag eject, click, slide cock (480 ms) |
| `shotgun-fire` | Firing 5-pellet shotgun blast | Heavy punch: lowpass noise thump + sub-bass drop (80→30 Hz) + wide spread crack |
| `shotgun-pump` | Shotgun cycling between shots | Dual metallic friction slide + heavy latch snap (260 ms) |
| `shotgun-reload` | Feeding shells into shotgun | Rhythmic shell clicks (two 90 ms metallic clinks) |
| `laser-aim-hum` | Aim ray / desktop laser active | Subtle continuous low-gain triangle drone (120 Hz) with gentle LFO |
| `bullet-whiz` | High-velocity projectile travel | Fast micro-sweep noise whistle (50 ms) |

---

## 3. Impact & Collision Audio (`CollisionsSystem`, `WorldSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `impact-rock` | Bullet hits terracotta/gray/olive rock | Hard stone fracture: high modal burst (620, 1400, 2800 Hz) + grit noise |
| `impact-wood` | Bullet hits meadow or giant tree trunk | Dull organic thud: bandpassed low-mid transient (220 Hz, 80 ms) |
| `impact-castle-stone`| Bullet hits castle wall / door | Sharp ricochet ping with brief delayed spark echo |
| `impact-metal-bars` | Bullet hits prison iron bars / chains | `metal-impact` recipe: 4 inharmonic modes (440, 1193, 2371, 3599 Hz) |
| `impact-flesh` | Bullet hits flesh (zombie/werewolf) | Wet squelch: low-pass filtered noise pop with downward pitch sag |
| `impact-bone` | Bullet hits Crypt Skeleton | Dry snapping wood/bone click: high-Q resonator (1800 Hz) |
| `impact-dragon-scale`| Bullet hits Ancient Dragon armor | Heavy deflected ping with low resonant reverberation |

---

## 4. Enemies & Undead Legion (`EnemiesSystem`, `enemy-variants`)

### Rotting Zombie
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `zombie-spawn` | Summoned / emerging from altar | `zombie-growl` recipe: nonlinear ODE + modulated pulse (1200 ms) |
| `zombie-attack` | Melee swipe against player | Quick tearing noise swoosh + guttural rasp |
| `zombie-hurt` | Hit by projectile | Short guttural recoil choke (180 ms) |
| `zombie-die` | HP reaches 0 (collapsing into pool) | Heavy flesh drop + wet splatter tail |

### Banshee Zombie
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `banshee-spawn` | Summoned from altar | High-frequency FM shrieking wail (850→1400 Hz) with distortion |
| `banshee-attack` | High-speed claw slash | Sharp slicing whoosh (white noise bandpass 3 kHz) |
| `banshee-hurt` | Hit by projectile | Piercing high-pitch flinch scream |
| `banshee-die` | Defeated / collapsing | Spectral pitch drop fading into wispy white noise |

### Crypt Skeleton
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `skeleton-spawn` | Bone assemblage rising | Rapid succession of dry wooden/bone clicks (240 ms cascade) |
| `skeleton-attack` | Bone claw strike | Double bone-on-air clatter swipe |
| `skeleton-hurt` | Hit by projectile | Hollow bone rattle with short decay |
| `skeleton-die` | HP reaches 0 (bones tumbling) | Clattering cascade of multiple falling skeletal pieces |

### Frost Ghoul (Blue Zombie)
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `ghoul-spawn` | Ice surge summon | Cryo-surge: low sine sweep + crackling high ice crystal noise |
| `ghoul-electric-spark` | Ambient electric aura | Intermittent high-voltage micro-discharges (noise bursts, 25 ms) |
| `ghoul-attack` | High-voltage electric claw strike | Searing arc discharge: saw wave + fast FM buzz + low-end zap |
| `ghoul-hurt` | Hit by projectile | Short-circuit electrical pop + cryo groan |
| `ghoul-die` | HP reaches 0 (freezing shatter) | Glassy cryo-shatter burst + dissipating electric hum |

### Blood Werewolf
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `werewolf-spawn` | Altar summoning emergence | Deep resonant lupine howl: modulated triangle sweep (220→480→180 Hz) |
| `werewolf-step` | Heavy quadruped / biped run | Low-end thumping pad impacts (110 Hz) |
| `werewolf-attack` | Savage double claw leap | Fierce roaring bark + double whipping air tear |
| `werewolf-hurt` | Hit by projectile | Deep snarling recoil yelp |
| `werewolf-die` | Defeated | Heavy body thud + low fading beast whimper |

### Albino Werewolf
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `werewolf-albino-spawn`| Altar emergence | Piercing, shrill bloodcurdling howl (higher register, 380→720 Hz) |
| `werewolf-albino-attack`| Rabid frenzy attack | Rapid double-slash with feral screech |
| `werewolf-albino-hurt`| Hit by projectile | High-pitched feral yelp |
| `werewolf-albino-die` | Defeated | Choking gasp + heavy impact drop |

### Brine Drowner
| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `drowner-spawn` | Rising from castle cistern pool | Heavy water breach: liquid gurgle + splash burst (600 ms) |
| `drowner-attack` | Aquatic claw thrash | Wet whipping splash + squelch |
| `drowner-hurt` | Hit by projectile | Choked aquatic gurgle |
| `drowner-die` | Dissolving into brackish pool | Deep bubbling liquid subside tail (800 ms) |

---

## 5. Witch & Alchemy Cauldron (`WitchSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `witch-cackle-spawn` | Witch summoned from cauldron | Sinister stepping FM modulation cackle (600→900 Hz vibrato steps) |
| `witch-potion-throw` | Witch throwing toxic bottle | Resonant aerodynamic bottle whoosh (air-slicing noise) |
| `potion-shatter` | Potion bottle impacts ground/wall | High-frequency glass bottle shatter: cluster of metallic/glass pings |
| `potion-splash-acid` | Green witch toxic pool puddle | Fizzing, caustic acid hiss + bubbling liquid sizzle |
| `potion-splash-fire` | Red witch fiery pool puddle | Explosive flame whoosh + crackling combustion burn |
| `witch-hurt` | Witch struck by projectile | Shrill occult gasp |
| `witch-die` | Witch defeated | Fading magical resonance + robe collapse |

---

## 6. Ancient Dragon Boss (`BossSystem`, `RitualSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `dragon-summon-roar` | Altar awakening / emergence | Full-scale roar: sub-bass rumble (35 Hz) + saw growl + delayed reverb |
| `dragon-wing-flap` | Flight cycle in combat | Heavy subsonic air displacement whoosh (lowpass filtered noise, 120 ms) |
| `dragon-fireball-charge`| Inhale before spitting fire | Reverse-envelope vacuum whoosh + rising fiery crackle (350 ms) |
| `dragon-fireball-launch`| Fireball discharged from mouth | Fiery pyroclysm launch: deep explosive pop + trailing flame hiss |
| `dragon-fireball-impact`| Fireball detonates on target | Massive low-end explosion: sub-sine boom + distorted noise blast |
| `dragon-hurt` | Dragon struck by projectile | Scaly metallic resonance + deep enraged beast grunt |
| `dragon-die` | Dragon defeated | Long dying roar descending in pitch + massive ground crash rumble |

---

## 7. Shrines, Altars & Progression (`AltarsSystem`, `RitualSystem`, `CastleSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `altar-idle-hum` | Standing near dormant altar | Warm low-frequency drone (65 Hz) with slow sine tremolo |
| `altar-active-glow` | Stepping inside interaction range | Rising harmonic chord (3 sine layers: 220, 330, 440 Hz) |
| `altar-summon-burst` | Pressing `[E]` to summon monster | `altar-activation` recipe: three rising sines + ADSR + 160 ms echo |
| `cauldron-bubble-loop`| Standing near witch cauldron | Continuous stochastic liquid bubble pops |
| `ritual-offering-chime`| Offering Bone, Fang, Eye & Pearl | Sparkling multi-tone bell chime (pentatonic cascade) |
| `portal-locked-rattle` | Touching portal without key | Heavy locked iron tumblers rattling (refusal sound) |
| `portal-unlock-turn` | Unlocking portal with Dragon Key | Heavy stone/iron lock mechanism shifting into place (450 ms) |
| `portal-teleport` | Stepping through Meadow/Castle portal| Dimensional warp whoosh: exponential pitch sweep (180→1200→60 Hz) |

---

## 8. Loot, Inventory & Shop (`LootSystem`, `InventorySystem`, `ShopSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `loot-drop` | Enemy drops crafting material | Light pop and soft ground tap (40 ms) |
| `loot-pickup-bone` | Collecting dropped Bone | Crisp dry bone click + ascending confirmation blip |
| `loot-pickup-fang` | Collecting dropped Fang | Sharp organic snip + harmonic chime |
| `loot-pickup-eye` | Collecting dropped Witch Eye | Mystical bell glint + soft liquid pop |
| `loot-pickup-pearl` | Collecting dropped Drowner Pearl | Shimmering crystalline high bell ring (1800 Hz) |
| `crafting-forge-key` | Crafting the Dragon Key in menu | Metallic anvil hammer ping + magical completion chime |
| `inventory-open` | Opening Backpack modal (`[I]`) | Leather bag buckle unfastening + parchment rustle |
| `inventory-close` | Closing Backpack modal | Soft leather tuck flap snap |
| `shop-greet` | Walking up to Vendor | Deep friendly merchant vocal hum |
| `shop-buy-item` | Purchasing First-Aid Kit | Traditional coin pouch jingle (damped metal modes) |
| `shop-buy-shotgun` | Purchasing Shotgun | Coin drop + authoritative mechanical shotgun cock |
| `shop-denied` | Insufficient kills to buy | Dull low double-buzzer (85 Hz square wave) |

---

## 9. Environment Ambiance & Animated Scenery (`WorldSystem`, `CastleSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `scenery-bush-rustle` | Player/zombie brushing through bushes | Soft leafy noise friction (white noise bandpass 1.8 kHz) |
| `scenery-torch-crackle`| Prison torch flame animation | Random micro-crackles of fire embers |
| `scenery-prison-drip` | Prison wall water drip animation | Single resonant droplet ping with high room decay |
| `scenery-chains-sway` | Prison hanging chains sway | Subtle metallic iron link clink |
| `scenery-bars-rattle` | Prison cell bars animation | Dull iron bar vibration hum |

---

## 10. UI & System Notifications (`MenuSystem`, `HudSystem`, `ChatSystem`)

| Sound Key | Trigger / In-Game Event | PixelForge DSP Synthesis Profile |
| :--- | :--- | :--- |
| `ui-button-hover` | Pointer hovers over button | Minimal high-frequency click (2400 Hz sine, 15 ms) |
| `ui-button-click` | Selecting menu/dialog option | Satisfying tactile wooden/plastic switch click (35 ms) |
| `ui-menu-toggle` | Opening/closing pause menu (`[ESC]`) | Clean two-tone UI blip |
| `ui-autospawn-toggle`| Toggling Spawner on/off (`[P]`) | Mechanical toggle switch click |
| `ui-chat-message` | Sending/receiving in-game chat | Soft digital confirmation pop (440→660 Hz, 30 ms) |
| `ui-game-over-stinger`| Death screen appears | Deep somber minor chord swell (decaying cello-like brass pad) |
| `ui-boss-victory` | Dragon slain (victory fanfare) | Bright triumphant brassy chord with long echo |
| `ui-coop-connect` | Peer connects to multiplayer room | Ascending two-note chime |

---

## Summary Statistics

- **1. Player & Characters**: 11 sounds
- **2. Weapons & Combat**: 8 sounds
- **3. Impacts & Collisions**: 7 sounds
- **4. Enemies & Undead Legion**: 30 sounds
- **5. Witch & Alchemy Cauldron**: 7 sounds
- **6. Ancient Dragon Boss**: 7 sounds
- **7. Shrines, Altars & Progression**: 8 sounds
- **8. Loot, Inventory & Shop**: 12 sounds
- **9. Environment Ambiance & Scenery**: 5 sounds
- **10. UI & System Notifications**: 8 sounds
- **Total**: **103 procedural sound effects**

