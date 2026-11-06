# Procedural game sound library

All **103 named rows** in `TODO/sound-effects-list.md` are implemented. The old
summary undercounted enemy cues (30, not 23); the list's totals are corrected.

## Reproduction

Use Node 22.12+ and the vendored, matching PixelForge 0.6.0 package set:

```sh
node .agents/skills/pixelforge-audio-creator/scripts/check-environment.mjs
node scripts/create-game-audio.mjs
node scripts/verify-game-audio.mjs
```

`create-game-audio.mjs` specifies each cue's voices, envelopes, frequency sweeps,
ordered effects, fixed seed operation and output gain. It writes editable format
1.0 `.sound.json` files, `.operations.json` batches and measured `metrics.json`,
then uses the PixelForge CLI's managed audio export. Existing modified exports
are protected by the CLI even with `--replace`. The generator owns its source
files and catalog; preserve manual source edits before regenerating recipes.

Each `public/assets/audio/sfx/<key>/` contains the original definition, mono
44.1 kHz PCM16 WAV, `audio.json` and managed export metadata. `index.json` and the
TypeScript catalog collect these individual bundles. PixelForge manifests allow
flat filenames only, so the Phaser adapter receives each original manifest and
its own base URL. The existing unrelated `dragon-roar.wav` remains intact; the
new synthesized roar is played by BossSystem, replacing the ritual's old player.

`verify-game-audio.mjs` validates every definition/manifest, reapplies the saved
operations, renders again, checks finite non-silent unclipped output and boundary
samples, and compares canonical WAV bytes and exported definitions. Reproduction
is guaranteed for this runtime; floating-point implementations can differ.

## Design and playback

The gunshot, zombie, metal and altar presets form starting points. Other cues use
separate layered oscillator/noise/resonator recipes with brief attacks, decay and
explicit tail room. Output gain is 0.72 with error-on-clipping and boundary fades.
Vocal/animal sounds are stylized synthesized impressions, not recorded voices.
PixelForge exposes amplitude modulation and endpoint pitch sweeps rather than a
full formant/FM synthesizer or brown-noise source; those inventory descriptions
are approximated using pulse/triangle harmonics, filtered noise, envelopes and
distortion. No external generation service or runtime DSP is required.

AudioSystem supplies global per-key cooldowns, a 24-instance ceiling, 650-world-unit
quadratic distance attenuation and quieter ambient loops. Crowded combat can
intentionally suppress simultaneous copies. World/ambient sounds are positional;
local UI and progression confirmations remain audible independent of location.
Phaser unlocks audio on a user gesture. Locked cues are dropped, never replayed
as a backlog. Scene shutdown destroys every owned sound and removes pointer
listeners. Ambient loops stop during menus, chat, shop, inventory and death.

## Verification and listening

```sh
npm run typecheck
npm test
npm run build
npm run dev -- --host 127.0.0.1
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules node tests/game-browser-smoke.cjs
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules node tests/game-audio-smoke.cjs
```

Use the current Vite URL via GAME_URL if needed and your installed Playwright
location via NODE_PATH. The audio browser test decodes and plays every WAV through
Phaser, measures real Web Audio graph energy, exercises gameplay cue dispatch,
checks HTTP/page errors and verifies two restarts with no retained sounds or
pointer listeners. Offline tests cover lock/cache/distance/cooldown/polyphony,
loop teardown and all unique inventory exports.

Numerical checks and browser output are not subjective listening approval. No
listening tool was available for this task. Listen at low volume, then check rifle
and shotgun cadence, each enemy voice, crowded combat, potion tails, portal/key
feedback, castle ambience, low-health heartbeat and restart/death transitions.
Physical speaker/phone balance and all browser engines remain manual QA.
