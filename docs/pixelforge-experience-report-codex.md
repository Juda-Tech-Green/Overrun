# PixelForge skill: practical experience and improvement report

Date: 2026-11-01  
Author: Codex  
Project: `testing_skill_pixelforge`  
Skill: `.agents/skills/pixelforge-sprite-creator/SKILL.md`  
Local CLI used: PixelForge `0.4.0`

## Scope and evidence

This report covers my work in this chat: installing the skill, creating the albino werewolf, adding directional player and enemy animations, matching the older zombie art to the new views, and restoring animated electricity across the blue zombie's actions. It is not a benchmark of every PixelForge feature or a synthesis of other agents' reports.

Observations below come from commands, source files, exported images, validation results, and implementation mistakes encountered during that work. Recommendations are explicitly proposals; the commands marked as proposed do not exist in the installed CLI. I have not measured a reliable token-savings percentage.

Later requests explicitly left gameplay validation to the user. For those changes, I used local renders, source/export validators, offline loading checks, build and TypeScript checks. These establish useful properties but do not prove live playback or visual quality in the game.

## Overall assessment

PixelForge works well as an editable, deterministic pixel-art pipeline. Its strongest combination is operation batches, stable frame IDs, headless rendering, and source-to-export pixel validation. The main efficiency problem is not the raster format itself: it is allowing that format to become the agent's primary reading surface.

The better working model is:

> Keep dense pixels on disk. Expose a compact semantic map to the agent. Draw through operations, inspect through images, and verify through focused reports.

The current skill supports much of this already, but it should make the compact workflow the default and provide stronger tools for discovering exact operation syntax and visual relationships.

## What worked well

| Strength | Evidence from this work | Practical benefit |
| --- | --- | --- |
| Headless operation | The local CLI could apply batches, render frames, validate projects and export Phaser bundles. | Asset work did not require an editor or browser. |
| Editable construction | Palette changes, shapes, lines, frame copies, animations and metadata were stored as operations. | Changes were reproducible and easier to review than hand-written pixel arrays. |
| Palette-based variants | The albino werewolf began as a palette-only variant. | Its silhouette, animation references and geometry could remain consistent with the original. |
| Stable source IDs | Animation JSON referenced named frames rather than positions in the exported texture. | Directional additions could coexist with the existing spawn texture keys. |
| Complete bundles | Export supplied PNG, atlas, animations, game metadata, manifest and README. | The existing preloader could load expanded content under the same asset keys. |
| Pixel-level export verification | `validate-export.mjs` compared decoded atlas pixels with the editable source. | This checked actual raster equivalence, beyond file existence or JSON parsing. |
| Explicit durations | Entries carried `durationMs`. | Timing could be retained when registration used the per-frame values. |
| Layer separation | The blue zombie had a dedicated `aura` layer. | Electricity could be rebuilt and checked independently of its body art. |
| Progressive references | Animation, operations and Phaser guidance were separate short references. | I could read the relevant workflow without reading the entire skill package. |

## Where time and tokens were wasted

### 1. Broad searches reached dense sprite documents

Searching for terms such as `werewolf`, `variant`, or `zombie` across the whole source tree also matched enormous `.sprite.json` files. Some early output was truncated. This mixed useful gameplay code with raster data and made the result harder to assess.

For code questions, exclude generated asset sources or target the relevant files:

```sh
rg -n 'variant|summon|animation' src/game/scenes src/game/player-facing.ts
rg -n 'werewolf' src/game -g '*.ts'
rg --files src/game/assets-src -g '*spec.json' -g '*.mjs' -g 'README.md'
```

The default discovery step should list asset names, manifests, specs and generators—not pixel arrays.

### 2. Compact inspection was available but underused

The installed CLI already has `inspect`. It returns dimensions, palette, layers, frame IDs and animations without dense pixel grids:

```sh
node node_modules/@pixelforge/cli/dist/index.js inspect \
  src/game/assets-src/zombie-blue/zombie-blue.sprite.json
```

I should have reached for this earlier. A recommendation to “add a summary command” without acknowledging `inspect` would misdiagnose the gap.

The remaining gap is bounded, selective inspection: `inspect` can still print every animation entry, and its current report does not include the game metadata. It needs filters and compact defaults rather than a replacement with the same behavior.

### 3. Dense JSON sizes make accidental reads expensive

Measured from the current files:

| Project | Source bytes | Frames | Layers | Animations | Stored palette indices |
| --- | ---: | ---: | ---: | ---: | ---: |
| Survivor (`player`) | 12,845,585 | 80 | 4 | 30 | 983,040 |
| Heroine | 12,866,525 | 80 | 4 | 30 | 983,040 |
| Classic zombie | 7,840,036 | 65 | 3 | 25 | 599,040 |
| Blue zombie | 11,238,755 | 70 | 4 | 25 | 860,160 |
| Blood werewolf | 13,009,607 | 65 | 5 | 25 | 998,400 |

The blue zombie document contains 861,859 lines; Survivor contains 984,955. The index counts are `width × height × frame count × layer count`, including transparent cells. File size is not a token count, but these measurements explain why whole-file reads are inappropriate.

Minifying the JSON would reduce storage and line count. It would not create a useful semantic reading surface, and it would not justify sending all pixel indices into context.

### 4. Operation and module discovery sometimes required implementation reads

The operation reference is concise but does not show a complete example for every operation and scope combination. I sometimes inspected installed schema/implementation files to confirm exact fields, especially for anchors, events and entry-scoped attack boxes.

I also initially guessed a Sharp internal path that did not exist in this installation. The skill's existing `scripts/runtime.mjs` already resolves the CLI, core and Sharp from the target project. Reusing that helper is better than guessing package internals.

### 5. Repeated generator edits increased verification work

Directional artwork was generated across several nested dimensions: variant, direction, action, frame and arm. A boolean named `side` collided with an inner arm-index variable also named `side`. An attack-height change consequently affected werewolf artwork unintentionally. A saved checksum exposed the change; I renamed the inner variable and regenerated, restoring matching werewolf hashes.

This was an implementation error, not a PixelForge engine failure. It demonstrates why descriptive names such as `isSideView` and `armIndex`, bounded changes and preservation checks matter more than compressing generator code.

### 6. “Preserve existing frames” needs a task-aware exception

Preserving the original side artwork was appropriate for the initial directional expansion. Later, the user preferred the new art and asked for the older views to match it. At that point preservation of those pixels was no longer the correct invariant.

The invariant should have become “preserve identity, dimensions, palette, timing and gameplay compatibility while replacing the outdated poses.” The skill should distinguish preserving unrelated work from preserving the specific artwork the user authorized changing.

### 7. Structural validity did not establish effect coverage

The first directional blue-zombie construction retained some frost details but did not preserve a complete animated electrical halo in every view and action. A valid project and valid PNG export could not detect that semantic omission by themselves.

The final checks require electricity in every blue frame and more than one aura phase in every animation. Hurt was split into two 75 ms frames, retaining its original 150 ms total while allowing the electrical effect to change.

## A more efficient workflow using today's tools

### Step 1: Establish a small asset map

Read the skill entry point once. Check the local CLI version and environment. Locate the project's generators, specs, export manifests and animation metadata before opening a sprite document.

Record only:

- asset key and editable source path;
- generator and operation-batch paths;
- canvas, origin, physics geometry and palette labels;
- actions, directions, mirroring rules and durations;
- export directory and preloader/registration locations;
- task-specific requirements such as “electric halo in every action.”

The current `src/game/player-facing.ts` is an example of a compact direction-to-suffix map. Enemy registration and asset metadata supply the other relationships.

### Step 2: Inspect metadata, not raster arrays

Use CLI `inspect` first. When it lacks a needed field, parse locally and print only that field. For example, this reads the source on the machine but sends only a small metadata object to the agent:

```sh
node - <<'JS'
const fs = require('node:fs');
const path = 'src/game/assets-src/zombie-blue/zombie-blue.sprite.json';
const p = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log(JSON.stringify({
  name: p.name,
  canvas: [p.width, p.height],
  frameCount: p.frames.length,
  layers: p.layers.map(layer => layer.id),
  animations: p.animations.map(animation => ({
    name: animation.name,
    loop: animation.loop,
    frameCount: animation.frames.length,
    durationMs: animation.frames.reduce((sum, frame) => sum + frame.durationMs, 0)
  })),
  game: p.metadata?.pixelforgeGame
}, null, 2));
JS
```

For still smaller output, select one animation or one metadata scope instead of printing all game data. Avoid `cat` on `.sprite.json` and avoid manually reading dense arrays.

### Step 3: Review a labeled visual matrix

Render a contact sheet with directions as columns and variants or actions as rows. Include a small selection of consecutive frames when judging movement or effects. Render a specific entry when a correction is needed:

```sh
node node_modules/@pixelforge/cli/dist/index.js render \
  src/game/assets-src/zombie-blue/zombie-blue.sprite.json \
  --animation walk-back45 --frame 1 --output /tmp/blue-walk-back45.png
```

Visual sheets answer silhouette, style and effect questions much faster than pixel indices. They do not replace timing or game checks. Labels should identify action, direction, frame ID and duration; an unlabeled atlas makes the agent infer too much.

### Step 4: Make a bounded, reproducible edit

Prefer operations and a readable generator over manually rewriting raster arrays. State what may change and what must remain stable before editing. Use unique frame IDs and duplicate shared sources when only one animation should change.

For generators, derive output from stable seeds, support regeneration without accumulating frames or shifting pixels, and keep generated content distinguishable from hand edits. Hashes are useful when exact preservation is required; they are inappropriate as a gate for artwork intentionally being redesigned.

### Step 5: Verify once at each meaningful boundary

Use the environment check, project validator and export validator with the source argument. Then check the actual preloader and registration paths. In this repository:

```sh
node src/game/assets-src/enemy-directions/verify.mjs
npm run build
npx --no-install tsc --noEmit
```

The offline verifier exercises the scene's loading/registration/facing methods with adapters. It checks 240 direction/action combinations and the blue halo's coverage. It does not start Phaser's renderer or prove actual gameplay.

Keep detailed reports on disk and print concise pass/fail summaries. Repeat checks when a relevant change or failure warrants it, rather than repeatedly dumping unchanged results. Respect a user's instruction to leave browser validation to them.

## Proposed improvements, in priority order

The commands in this table are proposed interfaces, not available commands.

| Priority | Improvement | Example interface | Why it helps |
| --- | --- | --- | --- |
| P0 | Extend existing inspection with bounded output and game scopes | `inspect FILE --summary`, `--animation walk-back45`, `--game`, `--layer aura` | Makes selective reading discoverable and avoids ad hoc scripts. |
| P0 | Provide exact operation schemas and runnable examples | `operations describe setAnchor --example` | Removes the need to read package implementation files to learn field names. |
| P0 | Add labeled contact-sheet generation | `contact FILE --actions idle,walk --directions side,front,back45 --labels` | Gives a visual map with stable IDs and timing attached. |
| P0 | Make the skill's default workflow explicit | “Inspect first; never print dense grids unless a specific pixel bug requires it.” | Prevents the highest-volume context mistakes immediately. |
| P1 | Add semantic effect-coverage checks | `check-effects FILE --layer aura --all-animations --require-motion` | Detects valid but incomplete assets, such as missing or static electricity. |
| P1 | Add compact semantic diffs | `diff BEFORE AFTER --summary` | Reports changed frames/layers, palette, timing, geometry and bounds without a million-line diff. |
| P1 | Generate an asset map with freshness checks | `asset-map build --output assets.index.json` | Maps sources, generators, bundles, keys and directions across a project. |
| P1 | Provide staged export and bundle verification as one helper | `export ... --staged --verify-source` | Reduces manual staging/copy logic and stale-bundle mistakes. |
| P2 | Add reusable directional and effect recipes | Directional actor and animated electricity templates | Reduces repeated generator scaffolding while retaining explicit editable operations. |
| P2 | Support targeted generation | `generate --variant zombie-blue --action hurt --direction back45` | Makes corrections cheaper and limits the affected surface. |

An asset map must be generated from authoritative files, not become another hand-maintained source of truth. Include source hashes or another freshness mechanism, so stale maps cannot silently mislead the agent.

A proposed compact map might look like this:

```json
{
  "asset": "zombie-blue",
  "source": "src/game/assets-src/zombie-blue/zombie-blue.sprite.json",
  "generator": "src/game/assets-src/enemy-directions/generate.mjs",
  "bundle": "public/assets/zombie-blue/bundle.json",
  "textureKey": "zombie-blue",
  "canvas": [48, 64],
  "frames": 70,
  "animations": 25,
  "views": ["side", "front", "front45", "back", "back45"],
  "leftViews": "mirrored",
  "effects": { "aura": "animated in every action and view" }
}
```

Palette roles, per-action timing and geometry should be available as optional sections rather than always expanding the default report.

## Suggested changes to the skill documentation

1. Start with a five-command quick path: environment, inspect, apply, render, validate/export.
2. Explicitly separate files to **read** (specs, maps, generators, manifests) from dense files to **process locally**.
3. Link every supported operation to an exact schema and minimal valid example.
4. Include a direction/action naming convention and mirroring example, without requiring all projects to adopt it.
5. Explain which invariants apply to recolors, redesigns, directional expansions and effect restoration.
6. Require an effect checklist when the reference or existing sprite has persistent features such as electricity, glow, smoke or accessories.
7. Offer summary output for validators and preserve detailed frame reports as artifacts.
8. Reuse the existing runtime resolver in examples instead of guessing dependency internals.
9. Document that offline registration checks, pixel validation and live playback establish different things.
10. Make user-requested manual validation an explicit supported endpoint: finish assets, loading and local checks, then report what remains for the user.

## Recommended default for my next task

I should start from the asset map, `inspect`, the relevant generator, and a labeled preview. I should read full raster arrays only through local code when a specific diagnostic requires it, never as routine conversation context. After a bounded change, I should print only the semantic diff and validation summary, then deliver the editable source, complete export and clear validation limits.

The highest-value improvements are compact discovery, exact schema lookup, labeled visual inspection and semantic coverage checks. Together they reduce repeated reading and implementation guesswork without weakening the verification of the resulting assets.
