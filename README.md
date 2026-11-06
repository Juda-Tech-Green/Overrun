# Overrun

**Overrun** is an intense top-down retro action shooter built with [Phaser 4](https://phaser.io), TypeScript, and [Vite](https://vitejs.dev).

Built from the [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) template.

---

## 🎨 Built with PixelForge — Procedural Art & Sound Mastery

A defining highlight of **Overrun** is that **the game's entire visual and auditory universe was built deterministically using the PixelForge skill ecosystem**:

- **[`pixelforge-sprite-creator`](https://github.com/Juda-Tech-Green/pixelforge)**: Every hero, monster faction, canine companion, ritual altar, multi-phase world boss, interactive HUD badge, projectile, and dungeon tile was authored, animated, and exported directly through PixelForge sprite projects. This includes complete 8-way directional perspectives (for players, companion, enemies, and the multi-angle dragon boss), walking and standing reload animations, muzzle flashes, and animated dungeon environments. Not a single external stock sprite sheet was needed—all art was procedurally generated and versioned in `src/game/assets-src/`.
- **[`pixelforge-audio-creator`](.agents/skills/pixelforge-audio-creator/SKILL.md)**: A complete procedural sound universe featuring **103 distinct custom sound effects** synthesized entirely via procedural audio recipes—no recorded or stock sound packs used. From high-impact rifle and shotgun discharges to eerie werewolf howls, bubbling potion splashes, dragon roars, spatialized footsteps, and dynamic UI audio, the entire soundscape was crafted using PixelForge Audio's synthesis engine and exported to game-ready WAV assets.

Together, the PixelForge skills demonstrate an agent-driven, 100% reproducible asset pipeline where art, sound, and gameplay code evolve hand-in-hand in the same repository.

---

## 🌟 Features

### ⚔️ Heroes, Combat & Arsenal
- **Two Playable Heroes**: Switch anytime between the **Soldier** and **Heroine** (press `G`), each featuring complete 8-directional movement, aiming, and reload animations.
- **Dynamic Weapons**:
  - **Assault Rifle**: 7-round magazine, high-precision semi-automatic fire.
  - **Combat Shotgun**: 4-round magazine, devastating 5-pellet cone blast with visible laser spread guides.
- **Deep Weapon Mechanics**: Independent magazines, manual reload (`R`), standing and walking reload cycles, and a world-space laser sight that tracks the muzzle and clips to obstacles or enemies in real time.
- **In-Game Merchant & Economy**: Visit the wandering vendor in the Meadow to spend earned monster kills on the **Shotgun** (10 kills) and **First-Aid Kits** (2 kills).
- **Healing System**: Use First-Aid Kits (`F` or `AID` button) to restore 2 HP with particle healing visual effects (`heal-fx`).

### 🐕 Faithful Canine Companion
- A loyal **Companion Dog** that accompanies you across the battlefield.
- Features smooth movement-trail following, natural settle behaviors behind the player, complete 8-directional idle/walk animations, and teleport recovery—remaining safe from combat collisions.

### 💀 Enemy Factions & World Boss
- **Undead Legions**: Multiple distinct zombie variations (Standard, Blue, Female, and Skeleton) with unique speeds, damage, and animations.
- **Fierce Werewolves**: Fast, relentless predators (Standard and Albino Werewolves) with distinct running gait and ferocious melee pursuit.
- **Cunning Witches**: Tactical ranged spellcasters defending cauldron territory; they maintain standoff distance, retreat when approached, and hurl green and red toxic fire potions that explode on impact.
- **Castle Drowners**: Lurking water fiends haunting the submerged depths of the Castle Prison cisterns.
- **The Red Dragon (World Boss)**: A colossal multi-phase boss summoned through ancient altar rituals. Features 8 compass viewpoints (front, front-45, back, back-45), sweeping breath attacks, explosive fireballs, and a custom boss health bar.

### 🗺️ Multi-Zone Exploration & Animated Tilesets
- **The Meadow**: A sprawling outdoor landscape with lush terrain, giant animated trees, ancient stone shrines, and the merchant stall.
- **The Castle Prison**: A dark, atmospheric underground fortress built with animated tilesets:
  - Dripping stone walls, flickering wall torches, swaying iron chains, rippling floor puddles, creaking dungeon doors, and floating dust motes.
- **Mystic Portals & Keys**: Discover portal keys to unlock mystic gates that teleport the player seamlessly between the Meadow and the Castle Prison.
- **Interactive Ritual Altars**: Interactive shrines across the map (Wolf Altar, Witch Cauldron, Dragon Summoning Altar, Drowner Cistern Altar) with dynamic floating HUD badges (`[E]` prompt) and danger alerts.

### 🪦 Contextual Defeat Screens
- Defeat is personal: unique, beautifully themed game-over screens display custom artwork and grim epitaphs tailored specifically to your fatal cause (slain by zombie bites, torn by werewolf claws, dissolved by witch brews, or incinerated by dragon flame). Instant restart via `Space` or `R`.

### 📱 Responsive Mobile & Desktop Controls
- **Desktop Controls**: WASD / Arrow keys for movement, 8-directional mouse aiming with raycast laser, quick keys (`Space` to shoot, `R` to reload, `F` to heal, `G` to switch hero, `E` to interact, `Enter` for chat console).
- **Mobile Touch Controls**:
  - Dual camera-fixed virtual joysticks (left stick for analog movement, right stick for 8-direction aim retention).
  - Multi-touch support (up to 3 simultaneous fingers for move + aim + fire).
  - Dedicated amber **FIRE** button, quick **AID** button, and dynamic contextual **[E]** interaction badge.
- **Responsive Canvas**: Automatic scale refit (`Phaser.Scale.RESIZE`) with 2× world zoom and crisp 1× HUD overlay for both portrait and landscape orientations.

### 👥 Private Two-Player Co-op
- Real-time multiplayer co-op using peer-to-peer network replication.
- **Host & Join**: Host directly from desktop (**CO-OP → Host Game**) and share the room code or invite URL with a friend on mobile or desktop.
- **One-Command Cloudflare Tunnel**: Run `npm run tunnel` to expose local development securely over HTTPS with zero backend server setup required.
- **Fair Co-op Mechanics**: Host-authoritative validation, individual kill balances, personal purchase ownership, and synchronized enemy encounters.

### 💬 In-Game Chat & Commands
- Toggle the in-game terminal with `Enter` to communicate or test debug commands (such as `/heal`).

---

## 🛠️ PixelForge Asset Tooling

The [`pixelforge-sprite-creator`](https://github.com/Juda-Tech-Green/pixelforge) and [`pixelforge-audio-creator`](.agents/skills/pixelforge-audio-creator/SKILL.md) agent skills are installed in `.agents/skills/` (and globally in `~/.gemini/config/skills/`), and the PixelForge CLI (from maintainer tarballs vendored in `vendor/pixelforge/` — not published on npm) is in `node_modules`. See [pixelforge-install-review-antigravity.md](pixelforge-install-review-antigravity.md) and [pixelforge-install-review-opencode.md](pixelforge-install-review-opencode.md) for full install reviews and reproducible setup recipes.

Useful commands:

```sh
# Validate a sprite project
node_modules/.bin/pixelforge validate MY.sprite.json

# Render a single frame
node_modules/.bin/pixelforge render MY.sprite.json --animation spin --frame 0 --output frame.png

# Export a Phaser atlas bundle into public/assets
node_modules/.bin/pixelforge export MY.sprite.json --format phaser --layout atlas --name hero --output public/assets/hero

# Generate audio asset library
node scripts/create-game-audio.mjs
```

> **Note**: The `@pixelforge/phaser` runtime adapter targets Phaser 3.90 (peer range); this game runs on Phaser 4, so load exported atlases/sheets using Phaser 4's standard `load.atlas` / `load.spritesheet` APIs, and procedural audio via `loadPixelForgeAudio`.

---

## 📋 Requirements

- [Node.js](https://nodejs.org) 24 (see `.nvmrc`)

---

## Publish on Netlify

Co-op is enabled by default. Connect this repository to Netlify: `netlify.toml` sets the checked build command and `dist` publish directory. For a manual upload, run `npm ci && npm run release:check` and upload `dist/`. See the [release guide](docs/netlify-release.md) for exact steps, co-op verification and rollback.

## 🚀 Commands

| Command | Description |
| --- | --- |
| `npm install` | Install project dependencies |
| `npm run dev` | Launch a development web server on `http://localhost:8080` |
| `npm run build` | Create a production build in the `dist` folder |
| `npm run typecheck` | Run TypeScript compiler checks without emitting files |
| `npm test` | Run the complete Node test suite (`tests/game-systems.test.cjs`) |
| `npm run tunnel` | Launch Cloudflare tunnel for external / mobile testing |
| `npm run dev:tunnel` | Start local dev server bound to `127.0.0.1:8080` for tunnel traffic |

---

## 📁 Project Structure

| Path | Description |
| --- | --- |
| `index.html` | HTML entry page containing the `#game-container` |
| `public/assets/` | Exported Phaser texture atlases, animations, audio WAVs, and manifests |
| `public/style.css` | Global layout and touch reset styles |
| `src/main.ts` | Application bootstrap |
| `src/game/main.ts` | Phaser game config: dimensions, physics, resize scaling, scenes |
| `src/game/constants.ts` | Game tuning constants: speeds, fire rates, prices, altar positions |
| `src/game/scenes/Boot.ts` | Loads preloader assets and initial textures |
| `src/game/scenes/Preloader.ts` | Progress bar; loads all game sprite atlases and procedural audio |
| `src/game/scenes/Game.ts` | Composition root orchestrating all gameplay systems |
| `src/game/systems/` | Modular systems (Weapons, Enemies, Boss, Altars, Mobile, HUD, Shop, Audio, Viewport, etc.) |
| `src/game/assets-src/` | Editable PixelForge sprite JSONs, sound recipes, and operation batches |
| `tests/` | Comprehensive unit tests, audio smoke, and browser smoke tests |

---

## 🏗️ Gameplay Architecture & Development

`Game.ts` composes focused systems in `src/game/systems/`. Read the [architecture and implementation workflow](docs/game-architecture.md) for ownership, lifecycle rules, extension steps, and browser smoke testing. Agent guidance lives in [AGENTS.md](AGENTS.md).

Run `npm run typecheck`, `npm test`, and `npm run build` before handing off changes.

### Private Two-Player Co-op
Use **CO-OP → Host Game**, then share the room code or copied invite link. Player 2 can join on mobile. The desktop host owns the shared world; no custom backend or database is needed. Run `npm run dev:tunnel` and `npm run tunnel` to serve development over HTTPS. On Linux, the tunnel launcher downloads cloudflared automatically when needed.

For complete networking details, see [Co-op, Cloudflare setup and two-device verification](docs/co-op.md).
