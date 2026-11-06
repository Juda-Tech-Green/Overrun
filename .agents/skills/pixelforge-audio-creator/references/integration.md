# Installation, integration and recovery

From the PixelForge source checkout, `npm run pack:release` builds local tarballs.
Install the six matching 0.6.0 archives (core, exporters, cli, phaser, audio-core,
audio-exporters) in the game. Third-party dependencies need network or a populated
npm cache. No registry publication is implied. Do not force incompatible peers.

`check-environment.mjs` requires the exact audio runtime version and actually
queries audio operation discovery. A v0.5 CLI cannot satisfy this check.

During Phaser preload, import `loadPixelForgeAudio` from `@pixelforge/phaser` and
call it with `{baseURL:'/assets/audio/laser-shot',manifest}` where manifest is
the exported `audio.json`. Then use `scene.sound.play('laser-shot')` after a
user gesture unlocks audio. Test Phaser 3.90.0/4.2.1 in the actual target game.
Other engines can load the WAV through their native audio APIs.

Manifest `events` entries map `{animation,event,sound}`. Pass an event notice to
`playPixelForgeSoundEvent(scene,manifest,event)` from the callback to the existing
`observePixelForgeEvents`. Keep the observer's disposer and invoke it when the
sprite is removed. Register observers before starting animation. This callback
does not create a second sprite-event pipeline.

Recovery:

- Version/command missing: install the reviewed matching local package set.
- Invalid envelope: order points and keep times within duration; for ADSR reduce
  attack+decay+release or increase duration.
- Work limit: reduce duration, voices, resonator modes or nonlinear complexity.
- Instability: inspect the identified node; reduce positive sigma, use negative
  cReal, lower initial amplitude or reduce stiff coefficients.
- Clipping: lower gains; hard clipping is deliberate distortion, not a repair.
- Silent playback: check RMS, browser user gesture, mute state and asset paths.
- Truncated echo: increase duration and keep the source envelope shorter.
- Managed export refusal: retain user changes and export to a new directory.

Keep source definitions, operations, manifests and a same-runtime reproduction
command. Report schema, DSP, WAV decoding, loading, playback and subjective
listening evidence separately.
