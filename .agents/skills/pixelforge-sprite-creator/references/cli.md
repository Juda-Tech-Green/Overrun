# CLI setup and execution

Use Node 22.12+ (24 recommended). PixelForge is not publicly published by this project. Use the maintainer-supplied local tarballs, installing the complete dependency graph together:

```sh
npm install --offline --ignore-scripts /path/pixelforge-core-0.4.0.tgz /path/pixelforge-exporters-0.4.0.tgz /path/pixelforge-cli-0.4.0.tgz /path/pixelforge-phaser-0.4.0.tgz
```

Offline installation also needs cached third-party dependencies; otherwise obtain reviewed dependencies through the user's package policy. Do not silently install another remote package named pixelforge.

The exact portable invocation is `node node_modules/@pixelforge/cli/dist/index.js`. A local npm script can use the `pixelforge` bin. Windows also has `node_modules/.bin/pixelforge.cmd`; POSIX has `node_modules/.bin/pixelforge`. No global installation or Bash is required.

Commands: `init NAME --width 32 --height 32 --output sprite.sprite.json`, `inspect FILE`, `validate FILE`, `apply FILE --operations OPS --output UPDATED`, `render FILE --animation walk --frame 0 --output frame.png`, `export FILE --format spritesheet --columns 4 --padding 1 --output sheet.png`, `export FILE --format phaser --layout atlas --name hero --output public/hero`. Phaser directory must not exist. Every failure is nonzero; runtime errors and successful commands are machine-readable JSON. Init uses transparent index0 and white index1. Add palette colors through operations rather than writing thousands of pixels.
