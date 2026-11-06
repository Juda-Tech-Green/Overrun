---
name: pixelforge-audio-creator
description: Create, edit, render, validate and integrate deterministic procedural game sound effects with PixelForge's sound JSON, audio CLI and Phaser adapter. Use for synthesized effects such as lasers, impacts, growls and magical activations.
---

# PixelForge Audio Creator

Use structured `.sound.json` documents and operation batches. Runtime synthesis
is local; there is no audio generation API or backend.

## Discover

Requires Node 22.12+ and the matching PixelForge 0.6.0 local package set.
Do not install an unrelated similarly named registry package. From the game:

```sh
node <installed-skill>/scripts/check-environment.mjs
node node_modules/@pixelforge/cli/dist/index.js audio --help
node node_modules/@pixelforge/cli/dist/index.js audio operations list
node node_modules/@pixelforge/cli/dist/index.js audio operations describe setFrequency
```

Install the complete skill folder into the host's supported skills directory:

```sh
node .agents/skills/pixelforge-audio-creator/scripts/install.mjs install --target GAME/.agents/skills
```

`--target` is explicit. Codex, OpenCode and Antigravity must be configured to
discover that directory; installing files alone does not prove host activation.
For a host using another skills directory, pass that directory instead.

## Specify → Generate

Choose stable runtime keys, duration, seed, voice models, frequency trajectory,
envelope, effects order and output gain. Preserve existing game asset keys.
See [sound model and DSP](references/sound-model.md) for exact bounds and math.

```sh
node node_modules/@pixelforge/cli/dist/index.js audio create laser-shot --preset laser-shot --output laser-shot.sound.json
node node_modules/@pixelforge/cli/dist/index.js audio apply laser-shot.sound.json --operations edits.json --output laser-edited.sound.json
```

Use [recipes](references/recipes.md) for all five presets. `addVoice` accepts
oscillator, noise, damped, nonlinear or resonator definitions. `addEffect` accepts
filters, delay and distortion. Batches validate completely before writing.

## Render → Listen/Review → Validate

```sh
node node_modules/@pixelforge/cli/dist/index.js audio render laser-edited.sound.json --output laser.wav
node node_modules/@pixelforge/cli/dist/index.js audio inspect laser-edited.sound.json --metrics
node node_modules/@pixelforge/cli/dist/index.js audio validate laser-edited.sound.json --render
```

Listen at low playback volume, then in game context. Review attacks, boundary
clicks, pitch, decay, harshness and tail truncation. Peak/RMS and finite samples
are numerical evidence, not aesthetic approval. Disclose when listening tools
are unavailable. Never dump PCM arrays into context.

## Export → Integrate

```sh
node node_modules/@pixelforge/cli/dist/index.js audio export laser-edited.sound.json --output public/assets/audio/laser-shot
```

Exports WAV, original editable definition and `audio.json`. Use `--replace` only
for unchanged managed output; user-modified or unrelated files are protected.
Follow [Phaser integration and troubleshooting](references/integration.md).
Verify loading and playback in the actual consumer, rather than inferring game
success from a valid WAV or a CLI exit status.
