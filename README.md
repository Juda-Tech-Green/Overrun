# PixelForge

An action shooter game built with [Phaser 4](https://phaser.io), TypeScript and [Vite](https://vitejs.dev).

Built from the [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) template.

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
