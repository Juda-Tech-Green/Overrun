# Private two-player co-op

Open **CO-OP** in the game HUD. Player 1 selects **Host Game** and shares the
six-character room code or **Copy Invite Link**. Player 2 opens that link (the
`?room=CODE` query automatically joins), or enters the code in **Join**.
The room accepts one guest; a third connection is rejected. Both players see a
connection indicator and the other player's health label.

The host keeps its selected Survivor/Scholar character; the guest receives the
other character. Character switching is locked while connected. Friendly fire
is disabled: friendly projectiles only hit enemies, bosses and scenery. Loot,
crafting materials, the Portal Key and weapon ownership are shared. Kill balances,
first-aid kits, health, position, aiming, current weapon and magazines are individual.
The player landing the final hit receives the existing enemy reward (including
2 for a werewolf and 100 for the dragon). Vendor purchases spend the buyer's kills;
a first-aid purchase adds a kit only to the buyer, and healing consumes only that
player's stock. The host validates and stores the guest's personal balances;
ROOM_INIT and WORLD_SNAPSHOT carry those guest balances to the guest HUD/shop.
A new guest or a restarted/rejoined guest starts with zero kills and kits.
The host remains authoritative for purchases, recipes, drops, portal unlocks,
altar activations, enemy/boss AI and damage. Guest movement is predicted locally
and checked against the host's accepted movement bounds. Host snapshots correct
large discrepancies and authorized portal transitions.

The host and guest may occupy different zones. Enemy targeting and altar
proximity include both living players. The host world continues while one player
has an inventory/menu open; the menu only blocks that player's controls. Guest
shots consume a host-validated magazine/cooldown as well as the local predicted
magazine. Reload requests replenish the host's guest magazine after the normal
reload duration. Crafting and offerings are executed once against shared stock.

## Desktop + mobile over HTTPS

Install Node dependencies as usual:

```sh
npm ci
```

`npm run tunnel` uses an existing `cloudflared` installation when available.
On Linux, it automatically downloads the [official Cloudflare binary](https://developers.cloudflare.com/tunnel/downloads/)
once to `~/.cache/pixelforge/cloudflared` (or `$XDG_CACHE_HOME/pixelforge/cloudflared`).
No sudo, PATH changes or `untun` package are required. Other operating systems
should install cloudflared first using the official downloads above.

Terminal 1, from this repository:

```sh
npm run dev:tunnel
```

This runs Vite on `http://127.0.0.1:8080` with a strict port, so it fails clearly
if another process already occupies 8080. The usual equivalent is
`npm run dev -- --host 127.0.0.1 --port 8080 --strictPort`.

Terminal 2:

```sh
npm run tunnel
# Equivalent:
cloudflared tunnel --url http://127.0.0.1:8080
```

If QUIC/UDP is blocked on the development computer, use:

```sh
npm run tunnel -- --protocol http2
```

The `untun@0.2.2` executable can be interpreted as shell code on this system;
use the repository launcher above instead.
If you deliberately choose a different Vite port, use the same port in `--url`.
Vite allows the `.trycloudflare.com` hostname family, without disabling host checks.

1. Wait for `cloudflared` to print its `https://…trycloudflare.com` URL.
2. Open that **HTTPS URL on the desktop**, then CO-OP → Host Game.
3. Copy the invite link after the room starts waiting for Player 2.
4. Open the invite on the phone. A manual code works too, using the same HTTPS
   origin. The left joystick moves, the right aims, FIRE shoots, AID heals and
   the bottom E button interacts. Inventory uses Backpack.
5. Move on each device and confirm the remote sprite follows; shoot an enemy,
   collect a drop and confirm both inventories change. Craft a key, unlock the
   portal and offer the four materials at the Dragon Altar.
6. Keep the desktop host open and active. Stop the tunnel with Ctrl+C when done.

Quick Tunnels provide temporary HTTPS URLs without an account/domain; the URL
expires when the process stops. They serve the web app, not the gameplay channel.
See [Cloudflare's Quick Tunnel guide](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Static Netlify deployment

Build with `npm run build`; publish `dist/` on Netlify as before. There are no
Netlify Functions, game servers, room databases or saved room records. Invite
links only add a query parameter to the existing static page.

PeerJS 1.5.5 uses its default public cloud broker for signaling. After negotiation,
gameplay travels over a WebRTC DataChannel. We use typed plain-object packets
with PeerJS BinaryPack serialization because its JSON serializer rejects large
initial-world messages; BinaryPack supports PeerJS's built-in chunking. The
protocol remains the documented ROOM_INIT, PLAYER_UPDATE, WORLD_SNAPSHOT,
SHOOT_EVENT and INTERACT_EVENT shape, with version/sequence fields added.
See [PeerJS's API](https://peerjs.com/client/api/peer) and
[signaling/NAT FAQ](https://peerjs.com/client/faq).

No microphone/camera permission is used. HTTPS makes the deployment, clipboard
and mobile browser context consistent. A tunnel does **not** bypass restrictive
WebRTC NAT/firewalls. Some network pairs require a TURN relay, which this default
broker-only setup does not provision. Test the actual desktop/phone networks;
connection timeout/error states provide Retry/Leave through the room panel.

## Protocol and ownership

| Owner | Contract |
| --- | --- |
| `NetworkSystem` | PeerJS/session lifecycle, two seats, room links, 30Hz player updates, 20Hz snapshots, remote player/health and host request dispatch |
| `NetworkWorldSystem` | Initial tiles/scenery/collision geometry, stable per-object IDs, host entity snapshots, guest replicas/interpolation and shared inventory state |
| `NetworkActionsSystem` | Host-side action range/health/material checks; altar, loot, portal, crafting, purchases, healing and reload requests |
| `CoopRoomSystem` | Native DOM dialog/input, 48px buttons, clipboard, connection HUD and explicit DOM/listener cleanup |
| `network-protocol.ts` | Bounded runtime validation, room codes, packet types and interpolation helper |

Host snapshots include enemies, boss, hostile projectiles, altar animations,
ground drops, shared progress and the guest's authoritative state. Initial seed
and difficulty metadata accompany the actual static layout; collision geometry
is copied directly rather than assuming both independently randomized worlds
match. Decoration animation phases may differ. The guest interpolates toward
snapshots and never runs enemy AI, spawn callbacks, boss damage or drop rewards.
The host validates guest shot origins, cooldowns, ammunition and shotgun ownership.
Events are deduplicated independently of replaceable state updates so a newer
position packet cannot accidentally discard an action.

No host migration or persistent rooms are provided. A disconnected guest freezes
its replicated world and can Leave to start solo. The host can accept a new guest.
Scene shutdown closes/removes connection and peer listeners, destroys the peer,
removes remote colliders and DOM controls, and clears replicas/timers. Restarting
from an invite URL renegotiates with the host and respawns the guest; restarting
the host ends that room and resets its run. Leave removes `?room` before the guest
returns to solo. Async peer creation is generation-checked against stale results.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Real two-peer smoke test (uses the default public broker, not a mock signaling
server). Use an already running local server or your current tunnel URL:

```sh
# One-time test tooling outside the repository, matching existing smoke scripts:
npm install --prefix /tmp/pixelforge-mobile-tools playwright --no-audit --no-fund
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=https://YOUR-CURRENT.trycloudflare.com node tests/game-coop-smoke.cjs
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if Chromium is installed elsewhere.
The script exercises desktop hosting, URL auto-join on a touch-enabled guest,
geometry equality, movement both ways, authoritative health, guest shooting and
shared pickup/crafting/portal/altar actions, third-seat rejection, leave and
restarts. Captures go to `/tmp/pixelforge-coop-smoke`. It controls encounter
placement for reliable combat assertions. Existing single-player desktop, mobile,
aim and progression smoke scripts remain relevant and use the same tooling.
Physical-device ergonomics and all NAT/network combinations require manual testing.
