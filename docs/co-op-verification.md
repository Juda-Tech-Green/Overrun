# Co-op verification record

Verified on 2026-11-05 with Phaser 4.0.0, PeerJS 1.5.5, Chromium and cloudflared
2026.10.7. Runtime artwork was preserved. The accidentally removed asset loading,
Drowner integration, projectile depth and simulation guards were restored before
final consumer checks.

## Requirement evidence

| Requirement | Authoritative evidence |
| --- | --- |
| Static deployment, no custom backend/database | PeerJS client dependency and dynamic browser import; default public signaling broker; Vite production bundle; no game API/server/database introduced |
| Two-player private rooms | Six-character cryptographic room codes, protocol-scoped peer IDs; real native Host/Join UI and actual third-peer rejection |
| Invite URL auto-join and copy | Real browser Clipboard API on HTTPS; `?room=CODE` guest boot; manual mobile text input/Join also exercised |
| Public broker + WebRTC channel | Real `new Peer()` / `new Peer(roomId)` default broker in the browser test; no fake peers, signaling server or mocked DataChannel in the integration test |
| Opposite characters and remote health | Desktop Survivor/mobile Scholar assignment and remote sprite/health assertions; host ignores forged guest hp/skin in unit coverage |
| Host authority | Guest AI/spawn/damage/drop owner guards; actual guest shot kills a host enemy; shared loot/craft/portal/altar actions applied on the host |
| World synchronization | ROOM_INIT includes seed/difficulty/skins, live world and exact static layout; geometry/tile equality checked; 20Hz snapshots and 30Hz player update scheduling in NetworkSystem |
| Interpolation and presentation | Guest remote-player/entity interpolation, replicated directional animations, boss bar, altar states and hostile projectile rotation/tint; rendered host/mobile captures reviewed |
| Personal kills and kits (2026-11-05) | Final shooter alone receives kills; buyer alone pays and receives kits; native mobile healing preserves host kits; personal HUDs and zero guest resources after reconnect checked by real PeerJS/WebRTC smoke on localhost. Typecheck, 90 unit tests and production build pass. |
| Shared progression | Guest collection updates both inventories; guest crafts key, unlocks portal, changes zone independently, summons Drowners and offers materials to summon the real boss |
| Both weapons and individual magazines | Real guest rifle hit; guest shotgun purchase leaves host on rifle; guest shotgun consumption and authoritative reload both checked |
| Friendly fire disabled | No friendly projectile/player damage registrations; replicated host shot leaves guest hp and guest ammunition unchanged |
| Mobile ergonomics | Native touch controls and real DOM input; room buttons measure at least 48px; existing multitouch, aid, vendor, menu and orientation suite passes |
| Local modals during co-op | Host inventory does not pause shared physics; host AI dispatch continues while its local control phase is blocked |
| Reset and cleanup | Two guest restart/rejoins destroy old Peer objects and retain one DOM HUD; Leave returns to solo; two host restarts leave no Peer object; unit reset is idempotent |
| HTTPS tunnel workflow | Actual temporary trycloudflare.com HTTPS origin served the game and completed the full real-broker co-op scenario; exact 8080 commands/fallbacks documented in co-op.md |
| Existing game behavior | Desktop, native mobile, aim/collision and progression smoke suites all pass after restoration |

## Commands and artifacts

Static checks:

```sh
npm run typecheck
npm test
npm run build
```

The final Node suite contains 86 tests. New coverage includes packet bounds,
trusted guest state, firing limits, event deduplication, binary optional-field
handling, guest simulation suppression, reliable actions under backpressure,
remote damage and cleanup.

Browser checks used the existing external Playwright installation:

```sh
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:8094 node tests/game-browser-smoke.cjs
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:8094 node tests/game-mobile-smoke.cjs
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:8094 node tests/game-aim-smoke.cjs
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=http://127.0.0.1:8094 node tests/game-progression-smoke.cjs
NODE_PATH=/tmp/pixelforge-mobile-tools/node_modules \
  GAME_URL=https://YOUR-LIVE.trycloudflare.com node tests/game-coop-smoke.cjs
```

The live tunnel was launched against the test server on 8094 with HTTP/2; normal
usage defaults to 8080 through the npm helpers. Its URL is temporary and is not
embedded in application configuration. Co-op screenshots are under
`/tmp/pixelforge-coop-smoke` (room-panel.png, host.png, guest-mobile.png).

The browser scenario uses controlled encounters for reproducible combat and
freezes unrelated AI for specific UI assertions. It tests two browser contexts
on a real secure tunnel, including mobile touch emulation, rather than two
physical devices. Physical-phone ergonomics, Safari/Firefox and arbitrary
cross-network NAT combinations remain manual checks. Default STUN cannot solve
all network restrictions; see the PeerJS FAQ linked from co-op.md. There is no
host migration or persistence beyond the host's open session.
