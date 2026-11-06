# Overrun — Netlify release

## Build and deploy

Use Node 24 (`nvm use`). From the repository root:

```sh
npm ci
npm run release:check
npm run preview
```

`release:check` runs type checking, all Node regression tests and the production
build. Preview serves the compiled game at http://127.0.0.1:4173.

**Git deployment:** import the repository in Netlify, leaving the base directory
at the repository root. `netlify.toml` sets Node 24, build command
`npm run release:check` and publish directory `dist`. No environment variables,
Functions or database are required for the existing co-op mode.

Before pushing, include all intended game changes, `src/game/systems/`, runtime
exports under `public/assets/`, tests, the lockfile, and the six 0.6.0 package
archives under `vendor/pixelforge/`. They are local npm dependencies: omitting
them breaks Netlify installation. Most editable art sources are not required to run the game. Keep the included
HUD source and audio sources/reference: regression tests read them. `TODO/`
remains local and ignored. Review the existing uncommitted work before selecting files to commit.

**Manual deployment:** upload the generated `dist` directory to Netlify Drop,
or extract the supplied release ZIP and upload its contents. `index.html` must
be at the publish root. Do not upload the source repository. Manual deploys do
not run a build: rerun `release:check` before creating a new upload.

The ZIP contains runtime assets and `_headers`, with no node_modules, source
recipes or development files. `_headers` lives in `public` so both deployment
methods revalidate unversioned artwork/audio and receive the same headers.
No catch-all rewrite is required: invitations use `/?room=CODE` and missing
assets should return a real 404. Netlify provides HTTPS for the published site.

Build configuration: [Netlify documentation](https://docs.netlify.com/build/configure-builds/file-based-configuration/).
Header configuration: [Netlify documentation](https://docs.netlify.com/manage/routing/headers/).

## Co-op is enabled

1. Open the final HTTPS site on desktop; choose **CO-OP → Host Game**.
2. Use **Copy Invite Link**, and open that link on the second device. Use the same
   deployed version for both players. Code entry is also available.
3. Confirm Connected on both devices. Move and fire from each, then check shared
   loot, crafting and portals, separate kills, vendor purchases and first aid.
4. Check guest Leave, rejoin, scene restart, portrait and landscape touch controls.
5. Keep the desktop host tab open and active. Host restart ends the room.

Rooms support exactly two players and have no host migration or saved progress.
The host validates gameplay; room codes are private invitations, not account
authentication or a cheat-proof security boundary. PeerJS's public signaling
service is an external dependency. No camera or microphone is requested.

Gameplay uses peer-to-peer WebRTC, not Netlify Functions. The default PeerJS
configuration supplies STUN, but this project does not provision a TURN relay.
Some restrictive NAT/firewall combinations will fail; hosting the static site
or running a Cloudflare tunnel cannot fix that. Verify the actual players'
networks before launch. Broader connectivity requires a separately provisioned
TURN service and client integration; never embed a provider's account secret
in a Vite environment variable or public bundle.
[PeerJS networking FAQ](https://peerjs.com/client/faq).

## Repeatable browser verification

Use the existing external Playwright installation (or install it outside this
repository as described in the architecture guide), with preview running:

```sh
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:4173 node tests/game-browser-smoke.cjs
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:4173 node tests/game-coop-smoke.cjs
```

The browser-only harness captures Phaser's instance before boot without
replacing application resources or exposing a production test global. These two
scripts work against both dev and compiled builds. Co-op uses the real public
PeerJS broker and WebRTC with a desktop host and touch-enabled guest. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for a different local Chromium installation.
Run the co-op scenario again with `GAME_URL` set to the deployed HTTPS origin.
Local same-machine browsers do not prove physical-device or cross-network NAT
compatibility. No live Netlify deployment is performed by these commands.

## Release notes and rollback

This release packages the existing solo and two-player game, its progression,
responsive controls and procedural sound effects for static hosting. It adds
checked Netlify builds and reproducible production browser checks.

After deployment, verify the title, loading, textures/audio, desktop/mobile
controls and invite flow on the final HTTPS URL. Check `_headers` delivery and
missing-asset 404s on Netlify. No live-host verification has occurred until this
step is run. Keep the previous ZIP/deploy available. If the release regresses,
restore the previous successful production deploy from Netlify's deploy history;
ask both players to reload and create a new room. Rooms cannot migrate between
versions. Review project and third-party licenses before public distribution.

Recorded results: [release validation](netlify-validation.md).
