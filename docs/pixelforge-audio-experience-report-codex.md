# PixelForge Audio Creator: implementation experience

**Project:** testing_skill_pixelforge  
**Author:** Codex  
**Scope:** Create and integrate every named effect in the game's sound inventory  
**Toolchain used:** PixelForge 0.6.0, sound format 1.0, Node 24.21.0, Phaser 4.2.1

## Outcome

The [PixelForge Audio Creator skill](../.agents/skills/pixelforge-audio-creator/SKILL.md)
supported creation and integration of **103 distinct procedural sound effects**.
The library covers player actions, weapons, material impacts, enemy factions,
witch potions, the dragon, progression, loot, shops, scenery and UI.

Each effect has an editable sound definition, a saved seed operation batch,
a rendered WAV and an exported manifest. Gameplay owners trigger the effects;
a dedicated AudioSystem manages playback and lifecycle.

After implementation, the user reported: **“It works perfect.”** This is positive
user feedback from the game, separate from the automated evidence below. I did
not have a listening tool and cannot claim to have personally auditioned the
sounds or approved their subjective quality.

## How I used the skill

### Discovery and scope

I read the skill, its sound-model, recipe and Phaser integration references, and
the game's architecture guide before editing gameplay. The environment check
confirmed the matching local PixelForge 0.6.0 package set and available audio
operations. No similarly named registry package or external audio service was
needed.

The inventory contained inconsistent counts: its introduction said 97, its
summary said 96, and its actual named rows totaled 103. I used the named rows as
the acceptance checklist. The enemy section contains 30 effects, rather than the
23 originally reported. The inventory totals were corrected.

### Authoring and generation

I built [create-game-audio.mjs](../scripts/create-game-audio.mjs) to make the
library reproducible at this scale. It defines durations, voice layers, envelopes,
frequency trajectories, effects order and output gain. It uses PixelForge's
structured authoring/rendering API and invokes the CLI for managed exports.

The gunshot, zombie-growl, metal-impact and altar-activation presets provided
useful starting points. Other effects combine oscillators, filtered noise and
resonators. Different registers and articulations distinguish enemy families;
material effects combine short transients with appropriate resonances.

Saved operation batches set deterministic seeds. They are not a complete history
of sound-design edits: the generator contains the authored recipes, and each
`.sound.json` contains the complete resulting definition. This distinction matters
when deciding which artifact to edit for future changes.

The source definitions use explicit gain and boundary fades, with clipping treated
as an error. Exported audio is mono, 44.1 kHz PCM16. The game loads these WAV files;
it does not synthesize the library during gameplay.

### Integration

The skill's instruction to verify the actual consumer was particularly useful.
A valid WAV alone would not have demonstrated that Phaser could load and play it.

I kept feature decisions in the existing owning systems. Accepted shots, damage,
purchases, crafting and other transitions dispatch their sound after the relevant
guards. This avoids success sounds on rejected actions. Shotgun audio is emitted
once per blast, rather than once per pellet.

[AudioSystem.ts](../src/game/systems/AudioSystem.ts) owns distance attenuation,
per-key cooldowns, a 24-instance limit, ambient loops and footstep tracking. It
also removes its input subscriptions and destroys owned sound instances on scene
shutdown. This cleanup is necessary because the sound manager belongs to the game,
not to an individual scene run.

Browser-locked audio is skipped until Phaser unlocks it through a user gesture.
It is not accumulated for later playback. Loops stop under modal and death gates.
Network snapshot edges supply several guest-side cues without replaying them on
every snapshot. Existing replicated weapon emission supplies firing sounds.

## Problems encountered and what they taught me

| Finding | Resolution | Lesson |
| --- | --- | --- |
| Inventory totals disagreed with the named effects. | Counted the rows and required every key to appear in the generated library. | Turn a prose inventory into a checked key list before generation. |
| An aggregate manifest used nested filenames that PixelForge rejected with a schema error in Chromium. | Passed each original exported manifest to `loadPixelForgeAudio` with its own base URL. | Validate packaging assumptions against the manifest schema early; filenames are flat in this version. |
| Existing offline tests did not understand the new Phaser adapter import or audio lifecycle owner. | Updated the test adapter and composition fixture, retaining real-adapter verification in Chromium. | Test doubles must follow integration boundaries without replacing consumer testing. |
| Moving the old ritual roar exposed an obsolete field assignment during typechecking. | Removed the old sound owner and routed offering and boss emergence through the new audio owner. | Transfer creation, playback and disposal together when changing resource ownership. |
| The repository ignored the entire editable asset-source directory. | Added a narrow exception for audio sources and operation batches. | Reproducibility requires checking repository inclusion, not just generating files. |
| Some requested DSP descriptions exceeded the exposed synthesis primitives. | Used documented approximations built from supported voices and effects. | Describe approximations honestly instead of claiming unsupported synthesis features. |

The last point includes formant/FM-style voices and brown-noise descriptions.
PixelForge's available amplitude modulation, endpoint sweeps, filtered noise and
distortion can suggest those textures, but are not equivalent to a full formant/FM
synthesizer or a dedicated brown-noise generator. Animal and vocal cues are
stylized procedural impressions.

## Verification evidence

| Layer | Observed result |
| --- | --- |
| Environment | Matching PixelForge 0.6.0 packages and audio operations available. |
| Definitions and manifests | All 103 validated through the installed schemas. |
| Rendering | All 103 non-silent; zero clipped samples; maximum individual peak approximately 0.4061. |
| Reproduction | All 103 regenerated WAVs matched exported bytes in the same runtime; exported definitions matched sources. |
| Asset uniqueness | 103 distinct WAV hashes, matching the inventory keys. |
| Static and regression checks | Typecheck, all 93 Node tests and production build passed. |
| Audio browser test | Chromium decoded and played 103/103 WAVs; an analyser measured nonzero Web Audio output; gameplay cues and two restarts passed. |
| Gameplay browser test | Movement, switching, chat, menus, firing/reload, shop, spawning, boss overlap and two restarts passed. |
| Co-op browser test | Real PeerJS/WebRTC combat, progression, purchases/healing, connection lifecycle and restart checks passed. |
| Human feedback | The user reported that it works perfectly. |

The audio smoke test checks HTTP/page errors and retained sound instances/input
listeners across restarts. These are stronger checks than merely observing a
successful `play()` return value. They still do not establish aesthetic quality,
physical speaker balance or behavior in every browser.

Guest hazard disappearance remains ambiguous in the existing snapshot protocol:
it does not distinguish expiration from impact. The implementation therefore does
not invent guest impact sounds from disappearance alone. No new network event
protocol was introduced for this audio task.

## What worked well about the skill

- Structured definitions made the full library inspectable and editable.
- Fixed seeds made rerendering and byte comparison practical.
- Presets accelerated initial design while allowing distinct layered recipes.
- Managed exports protected modified output during regeneration.
- The separation of numerical validation, listening and consumer playback kept
  the completion report honest.
- The lifecycle guidance helped prevent sound instances surviving scene restarts.

## Improvements I would recommend for the skill

These are recommendations from this implementation, not changes made to the skill.

1. State the flat-filename manifest restriction explicitly in the integration
   reference, with an example for loading many independently exported bundles.
2. Include a large-inventory recipe covering key-count checks, fixed seeds,
   batch generation and a generated runtime catalog.
3. Provide a small Phaser sound-owner example covering unlock, concurrency limits,
   completion disposal, loops and shutdown.
4. List unsupported or approximate DSP concepts alongside the supported primitives,
   particularly FM, formants, noise colors and multi-stage pitch contours.
5. Add a source-control checklist for definitions, operations, reproduction scripts
   and managed exports.
6. Provide an optional audition page or listening checklist for comparing effects
   at low volume and then in crowded gameplay.

## Handoff and reproduction

The [audio library guide](../src/game/assets-src/audio/README.md) documents the
source/output layout, playback behavior, limitations and browser commands.
The [architecture guide](game-architecture.md) records ownership and lifecycle.

From the repository root:

```sh
node .agents/skills/pixelforge-audio-creator/scripts/check-environment.mjs
node scripts/create-game-audio.mjs
node scripts/verify-game-audio.mjs
npm run typecheck
npm test
npm run build
```

The generator owns its generated source files and catalog. Preserve manual recipe
or source edits before regenerating. Exact byte reproduction was verified in the
same runtime; it should not be assumed across different floating-point engines.

The implementation is complete and user-confirmed. Future refinement can focus on
listening-based mix adjustments, physical phone/speaker testing and any desired
expansion of network audio events.
