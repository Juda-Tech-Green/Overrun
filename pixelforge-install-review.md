# PixelForge skill installation — agent review

> Field notes from installing the [`pixelforge-sprite-creator`](https://github.com/Juda-Tech-Green/pixelforge)
> agent skill and the PixelForge CLI into this repository, performed by a coding agent
> (OpenCode V2) on Linux on 2026-10-31. It documents every issue hit, the workarounds
> applied, and what upstream could change to make this a frictionless setup for agents.
>
> Upstream source checkout: `~/Repos/pixelforge` (v0.4.0, commit `0c0acc48b1e274a11d080fa48527c726fc074d5c`).
> Everything below was verified with real commands; error text is quoted verbatim.

---

## TL;DR

| Goal | Status | Notes |
| --- | --- | --- |
| Skill installed into this repo | ✅ | `.agents/skills/pixelforge-sprite-creator` via their managed installer, receipt-verified (sha256) |
| Agent host discovers + loads the skill | ✅ | OpenCode registered it mid-session and the `skill` tool loads it by ID |
| CLI installed | ✅ | `@pixelforge/cli` 0.4.0 built from local maintainer tarballs (not on npm) |
| End-to-end pipeline verified | ✅ | `validate` → `render` → `export --format phaser` → `validate-export.mjs`, all `ok:true` |
| Fresh clone of **this** repo reproduces | ✅ | `npm ci` then `check-environment.mjs` → `ok:true` (tarballs vendored in `vendor/pixelforge/`) |
| Fresh clone of **upstream** builds | ❌ | Their `npm run pack:release` fails at the first step on Linux (see [Issue 1](#1-fresh-clone-cannot-build-on-linux-“--blocks-tarball-distribution”)) |

**Difficulty overall: moderate.** The skill itself is well-built (validation helpers, receipts,
deterministic headless CLI), but the distribution path assumes a working upstream build and
warm caches, and one tarball has a peer conflict with the skill's most likely host project
(an official Phaser 4 template).

## Environment used

| Component | Version |
| --- | --- |
| OS | Linux (verified upstream path in their docs is **Windows**) |
| Node.js / npm | 24.21.0 / 11.19.0 |
| Agent host | OpenCode V2, project compat skill discovery (`.agents/skills`) |
| Game engine (this repo) | Phaser 4.0.0, from the official `phaserjs/template-vite-ts` template |
| Skill source | `.agents/skills/pixelforge-sprite-creator` of the upstream repository |

## What worked well (worth keeping)

- **Installer with receipts.** `scripts/install.mjs` copies the skill, records a SHA-256 receipt
  (`.pixelforge-install.json`), refuses symlinks, protects custom files on `--force` updates,
  and `verify` detects edits. Install + verify both returned `ok:true` on the first pass.
- **Network-free, no-exec copy code.** The installer performs no network requests and executes
  nothing — small scripts that could be reviewed before running. That speed and safety matter
  to agents operating under untrusted-content rules.
- **Host discovery worked first try.** Installed at `.agents/skills/<id>/SKILL.md`, the skill was
  advertised to the model immediately (description frontmatter) and loaded explicitly by ID.
- **Machine-readable QA helpers.** `check-environment.mjs`, `validate-project.mjs`,
  `validate-export.mjs` all emit JSON (`ok` / `errors` / `warnings` / `artifacts`) with nonzero-exit
  failures, and `validate-export.mjs` decodes the exported PNG and compares it against the source
  sprite raster. Export validation reported `{"ok":true, "frames":6, "width":96, "height":16}`.
- **Audit-clean toolchain.** `npm install` of the 4 tarballs into a fresh host repo added 11
  packages with 0 vulnerabilities.

## Issues found (ranked)

### 1. Fresh clone cannot build on Linux — ⚠️ blocks tarball generation

`npm run pack:release` is the only documented way to produce the local tarball set the skill
requires (nothing is published to npm). On a fresh clone it fails before compiling anything:

```text
packages/cli/src/index.ts(2,36): error TS2307: Cannot find module '@pixelforge/exporters' or its corresponding type declarations.
packages/cli/src/index.ts(13,8):  error TS2307: Cannot find module '@pixelforge/core' or its corresponding type declarations.
packages/exporters/src/bundle.ts(8,8): error TS2307: Cannot find module '@pixelforge/core' or its corresponding type declarations.
packages/phaser/src/index.ts(11,8):  error TS2307: Cannot find module '@pixelforge/core' or its corresponding type declarations.
```

**Root cause (bootstrap cycle).** All four packages declare:

```jsonc
"exports": { "types": "./dist/index.d.ts", "development": "./src/index.ts", "default": "./dist/index.js" }
```

but `dist/` does not exist on a fresh clone. The root `tsconfig.json` uses
`moduleResolution: nodenext` and defines no `customConditions: ["development"]`, so `tsc`
resolves the explicit `types` entry first, finds the missing file, and every cross-package
import fails. Adding `--customConditions development` to `tsc --noEmit` does **not** help
empirically — the explicit `types` map entry still matches first. The build chain's first
step (`tsc -p tsconfig.build.json`) is exactly the step that would create `dist/`, so the
compile can never start from a clean state. `npm run typecheck` fails the same way
(`apps/web/src/editor/Canvas.tsx(2,43): error TS2307 …`).

The repository's own docs say "Windows toolchain execution is verified; macOS/Linux execution
…remain unverified" — this is that gap.

**Workaround used (verified, all steps clean):** bootstrap each package's `dist/` directly with
tsc, in dependency order, replicating the layout their `scripts/build.ts` produces, then run the
remaining chain unchanged:

```sh
npx tsc packages/core/src/index.ts --target ES2022 --module nodenext --moduleResolution nodenext \
  --strict --noUncheckedIndexedAccess --esModuleInterop --skipLibCheck --resolveJsonModule \
  --types node --declaration --outDir packages/core/dist --rootDir packages/core/src
# repeat for packages/exporters, packages/phaser, packages/cli
npm run schemas && npm run prepare:packages && npm run pack:release   # now succeeds end-to-end
```

### 2. Distribution gaps for consumers

- **Tarballs are git-ignored upstream** (their checklist packs into an ignored `release/`), and no
  GitHub Release publishes them. A future agent can only obtain tarballs by rebuilding the
  monorepo — landing squarely in Issue 1.
- **First `npm install` of the tarball set records paths outside the target repo.** Installing
  from a sibling checkout yields `"@pixelforge/core": "file:../pixelforge/release/…"` in the
  consumer's `package.json` — the game repo would depend on a sibling folder existing forever.
  An agent installing from inside a chat session writes these `file:` specs silently. **Fixed
  here** by copying the tarballs into `vendor/pixelforge/` and reinstalling, so the specs became
  `file:vendor/pixelforge/*.tgz` and a plain `npm ci` reproduces the environment.
- **`--offline` (their documented flag) needs a warm third-party cache.** First attempt failed:
  `npm error ENOTCACHED … request to registry.npmjs.org/commander failed: cache mode is
  'only-if-cached' but no cached response is available.` Their docs acknowledge this ("otherwise
  obtain reviewed dependencies through the user's package policy"), but agents following the
  command verbatim will fail on a clean project.

### 3. Phaser peer conflict with the skill's likely host projects

The npm install of the complete tarball set is rejected out of the box when the game is not on
Phaser 3.90:

```text
npm error While resolving: pixelforge-game@0.1.0
npm error Found: phaser@4.0.0
npm error Could not resolve dependency:
npm error peer phaser@"^3.90.0" from @pixelforge/phaser@0.4.0
```

The official Phaser templates now ship Phaser 4, so a large share of new agent-hosted games will
hit this. The conflict is only in the optional `@pixelforge/phaser` runtime adapter — the skill's
core workflows (sprite creation, validation, exports) need only `@pixelforge/core`,
`@pixelforge/exporters`, `@pixelforge/cli`, and `check-environment.mjs` verifies only those.
**Workaround used:** install the verified trio normally; install the adapter with
`--legacy-peer-deps --ignore-scripts` (it stays inert unless imported) and load exported
atlases/sheets with Phaser 4's standard `load.atlas` / `load.spritesheet` APIs instead.
SKILL.md never mentions this engine-version constraint anywhere.

### 4. Setup knowledge is scattered

Finding the viable path required reading four documents (`docs/skill-installation.md`,
`docs/release-checklist.md`, `docs/agent-compatibility.md`, `references/cli.md`) plus the README.
There is no single agent-facing entrypoint (`AGENTS.md`). Two non-obvious gotchas are buried:

- the skill's helpers resolve the CLI **from the agent's working directory**, not the script's
  location (running them from elsewhere fails);
- `scripts/pack-release.mjs` refuses direct invocation (`Error: Run through npm run pack:release`)
  because it needs npm's `npm_execpath` — a partial rerun after a failed build has no supported
  short path.

### 5. Security onus falls on each agent

Nothing wrong with the code — all reviewable scripts turned out to be network-free, no-exec,
symlink-safe — but until there are published checksums or signatures for skill content and
tarballs, every careful agent must read ~10 KB of JS before trusting it, while a careless one
would blindly execute whatever update ships next. The `verify` subcommand hash-checks *installed*
files, not the *source* against a trusted manifest.

## Recommendations (concrete, in impact order)

1. **Fix the build bootstrap** so `npm run build`/`pack:release` works from a fresh clone on
   every OS. Minimal options: per-package `tsconfig.json` + `npm run build -ws` (each package
   compiles for itself, in npm's declared dependency order), or make sources self-describing for
   tsc by keeping the `types` entry absent and adding `"customConditions": ["development"]` to the
   build tsconfig. Even better: `scripts/bootstrap-dist.mjs` implementing the documented
   per-package tsc workaround from Issue 1 would unblock agents today without redesign.
2. **Publish the tarballs as GitHub Release assets with SHA-256 checksums.** Consumers then run
   `curl` + `sha256sum -c` + `npm install` against released artifacts, never building the
   monorepo (Issue 2 disappears, Issue 1 stays upstream-only).
3. **Add an HTTP skill catalog** for catalog-based hosts: an `index.json` at the repo root
   declaring the skill (and bumping `version` on changes) lets OpenCode install the skill
   directly from `https://raw.githubusercontent.com/Juda-Tech-Green/pixelforge/main/` with no
   clone and no installer — one config line instead of the whole source-checkout dance.
4. **Widen or split the `@pixelforge/phaser` peer range** (Phaser 3 `/` Phaser 4 adapters), and
   state the engine-version constraint in the SKILL.md `description` itself so hosts on Phaser 4
   templates know before npm fails.
5. **Ship an `AGENTS.md`** at the repo root: one repeatable recipe — "install skill target,
   install CLI tarballs, run the three verifier scripts" — plus the two buried gotchas from
   Issue 4 and pointer to the workflows. Agents do a dramatically better job when the happy
   path is one bullet-list they can follow verbatim.
6. **Fusable verification:** allow `install.mjs verify --target … --check-cli` to run the
   environment check after install, so agents prove readiness in one command; and give
   `pack-release.mjs` a `--pack-only` flag (bypassing the `npm_execpath` gate) for post-fix
   repacks.
7. **Sign or checksum the skill itself** (e.g., commit a `SHASUMS` of `.agents/skills/**`) so
   agents can verify provenance without reading every script.

## Reproducible setup recipe (Linux, as verified here)

```sh
# 1. Get the skill (from upstream checkout)
git clone https://github.com/Juda-Tech-Green/pixelforge ~/Repos/pixelforge
node ~/Repos/pixelforge/.agents/skills/pixelforge-sprite-creator/scripts/install.mjs \
      install --target "$PWD/.agents/skills"
node ~/Repos/pixelforge/.agents/skills/pixelforge-sprite-creator/scripts/install.mjs \
      verify  --target "$PWD/.agents/skills"

# 2. Get the CLI (upstream build currently needs the Issue-1 bootstrap; tarballs
#    are already vendored in THIS repository, so for a fresh clone of this repo:
npm ci                          # installs vendored @pixelforge/* tarballs (skip scripts)
node .agents/skills/pixelforge-sprite-creator/scripts/check-environment.mjs

# 3. Smoke the pipeline end to end
node_modules/.bin/pixelforge validate  <something>.sprite.json
node_modules/.bin/pixelforge export    <something>.sprite.json --format phaser --layout atlas \
      --name hero --output public/assets/hero
node .agents/skills/pixelforge-sprite-creator/scripts/validate-export.mjs \
      public/assets/hero <something>.sprite.json
```

All real outputs captured during this install:

```json
{"ok":true, "errors":[], "warnings":[], "node":"24.21.0", "cli":".../node_modules/@pixelforge/cli/dist/index.js", "version":"0.4.0"}
{"ok":true, "name":"Amber coin", "version":"1.0"}
{"ok":true, "output":".../coin-bundle", "manifest":{"format":"pixelforge-phaser", "layout":"atlas", "frameWidth":16, "frameHeight":16, "frameCount":6}}
{"ok":true, "errors":[], "frames":6, "width":96, "height":16}
```

## Local changes recorded in this repository

- Skill installed at `.agents/skills/pixelforge-sprite-creator` with installer receipt.
- All four `@pixelforge/*` tarballs vendored in `vendor/pixelforge/`; `package.json` uses
  `file:vendor/...` specs so `npm ci` reproduces without any sibling checkout.
- `@pixelforge/phaser` kept as an installed-but-unused dependency (Phaser 3 peer range);
  Phaser 4 loading is handled natively by the game.
- README documents the toolchain commands and the adapter caveat.
