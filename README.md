# PixelForge

An action shooter game built with [Phaser 4](https://phaser.io), TypeScript and [Vite](https://vitejs.dev).

Built from the [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) template.

## PixelForge sprite tooling

The [`pixelforge-sprite-creator`](https://github.com/Juda-Tech-Green/pixelforge) agent skill is installed in `.agents/skills/`, and the PixelForge CLI (v0.4.0, from maintainer tarballs vendored in `vendor/pixelforge/` — not published on npm) is in `node_modules`. See [pixelforge-install-review.md](pixelforge-install-review.md) for the full install review and reproducible setup recipe.

Useful commands here:

```sh
node_modules/.bin/pixelforge validate MY.sprite.json   # validate a sprite project
node_modules/.bin/pixelforge render MY.sprite.json --animation spin --frame 0 --output frame.png       # render a frame
node_modules/.bin/pixelforge export MY.sprite.json --format phaser --layout atlas --name hero --output public/assets/hero   # export a Phaser bundle into public/assets
```

Note: the `@pixelforge/phaser` runtime adapter targets Phaser 3.90 (peer range); this game is on Phaser 4, so the adapter is installed but unused — load exported atlases/sheets with Phaser 4's standard `load.atlas` / `load.spritesheet` APIs instead.

## Requirements

- [Node.js](https://nodejs.org)

## Commands

| Command | Description |
| --- | --- |
| `npm install` | Install project dependencies |
| `npm run dev` | Launch a development web server on `http://localhost:8080` |
| `npm run build` | Create a production build in the `dist` folder |

## Project structure

| Path | Description |
| --- | --- |
| `index.html` | HTML page containing the game container |
| `public/assets/sprites` | Game sprites, loaded at runtime |
| `public/assets/audio` | Sound effects and music |
| `public/style.css` | Global layout styles |
| `src/main.ts` | Application bootstrap |
| `src/game/main.ts` | Phaser game config: size, physics, scale, scenes |
| `src/game/constants.ts` | Game constants: resolution, speeds, fire rate |
| `src/game/scenes/Boot.ts` | Loads preloader assets, generates placeholder textures |
| `src/game/scenes/Preloader.ts` | Loading progress bar; loads all game assets |
| `src/game/scenes/Game.ts` | The main gameplay scene |

## Scene flow

`Boot` → `Preloader` → `Game`

To add a scene, create it in `src/game/scenes`, then register it in the `scene` array in `src/game/main.ts`.

## Loading assets

Static assets placed in `public/assets` are served directly and loaded with the Phaser Loader:

```ts
this.load.image('player', 'assets/sprites/player.png');
```

Vite also supports embedding assets via `import playerImg from './assets/player.png'`.

## Deploying

Run `npm run build` and upload the entire contents of `dist` to your web server.
