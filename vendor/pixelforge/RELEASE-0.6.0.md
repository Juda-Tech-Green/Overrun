# PixelForge 0.6.0 local release artifacts

— Procedural Sound FX (local implementation)

- Separate sound format 1.0 and shared platform-independent audio core.
- Seeded noise, oscillators, pitch sweeps, envelopes, modulation, damped/nonlinear ODEs and modal resonators.
- Ordered filters, safe delay, four distortion models and deterministic mono PCM16 WAV.
- Audio CLI discovery, atomic structured edits, managed bundles and Phaser sound-event mapping.
- Dedicated browser audio workspace, worker rendering, waveform/playback and five original demos.
- Portable Audio Creator skill and six-package local distribution; verification details in docs/audio/verification.md.
- Sprite/game schema 1.0 retained. No publishing performed. Style DNA remains a future milestone.

## Reproduce and verify

From the reviewed source checkout: npm ci, npm run typecheck, npm test, npm run pack:release. Verify with node scripts/verify-release.mjs release.

Copy the six matching archives into vendor/pixelforge inside the consumer repository, inspect its Phaser version, then run:

```sh
npm install --ignore-scripts ./vendor/pixelforge/pixelforge-core-0.6.0.tgz ./vendor/pixelforge/pixelforge-exporters-0.6.0.tgz ./vendor/pixelforge/pixelforge-cli-0.6.0.tgz ./vendor/pixelforge/pixelforge-phaser-0.6.0.tgz ./vendor/pixelforge/pixelforge-audio-core-0.6.0.tgz ./vendor/pixelforge/pixelforge-audio-exporters-0.6.0.tgz
```

Third-party dependencies normally require network access. --offline works only with a populated npm cache. SHA256SUMS detects corruption; it is not a signature or publisher provenance attestation. No publication or namespace ownership is implied. See docs/v0.5-verification.md for exact executed environments and acceptance evidence.
