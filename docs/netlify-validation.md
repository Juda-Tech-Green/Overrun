# Netlify release validation — 2026-11-05

Environment: Linux, Node 24.21.0, Chromium via Playwright. No live Netlify deploy.

| Check | Result |
| --- | --- |
| Isolated `npm ci` with lockfile and vendored 0.6.0 archives | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm test` | PASS, 94 tests, exit 0 |
| `npm run build` | PASS, exit 0 |
| `npm audit` (all dependencies) | PASS, zero vulnerabilities, exit 0 |
| Desktop smoke against compiled build on port 4173 | PASS, combat/shop/boss and two restarts, exit 0 |
| Real PeerJS/WebRTC co-op smoke against compiled build | PASS, touch guest, shared progression, separate kills/kits, third-seat rejection, leave/rejoin and restarts, exit 0 |
| Native multitouch smoke against development server | PASS, landscape/portrait, controls/modals and two restarts, exit 0 |
| Netlify TOML parse, local archive presence, ZIP integrity and exact dist equivalence | PASS |
| Live Netlify headers, HTTPS and invite flow | NOT RUN, site not deployed |
| Physical devices, other browser engines, cross-network/NAT combinations | NOT RUN |

The first production co-op attempt reached gameplay assertions but failed at a
development-only import in the third-seat test. The harness now uses the shipped
network owner's peer factory; the complete production scenario passed afterward.
No application code was changed to expose test state.

Logs are local to this machine: `/tmp/overrun-release-check.log`,
`/tmp/overrun-clean-install.log`, `/tmp/overrun-production-browser.log`,
`/tmp/overrun-production-coop.log`, `/tmp/overrun-mobile.log`.
Co-op captures: `/tmp/pixelforge-coop-smoke`; mobile captures:
`/tmp/pixelforge-mobile-smoke`. Guest co-op rendering was visually inspected.

Upload bundle: `release/overrun-netlify.zip` (6,300,720 bytes).
SHA-256: `9d1f1319ba1c279cbe484f05567900f192ffa9938b9faa04cd51c7680f11bf4e`.
The bundle contains `index.html` and `_headers` at its root.

See [release steps and remaining live checks](netlify-release.md).


## Git-only release check

A fresh temporary directory was populated from existing tracked files plus
unignored new files, respecting working-tree deletions. It contained 1,104 files
(11.47 MiB), no TODO folder and no ignored large sprite sources. `npm ci` and
`npm run release:check` both exited 0: TypeScript, 94 tests and production build
passed. Tests/generator now use the included audio inventory reference, and
.gitignore explicitly includes the HUD source used by regression assertions.
Logs: `/tmp/overrun-git-install.log` and `/tmp/overrun-git-release.log`.

A filename and credential-pattern scan of the proposed current file set found
no sensitive filename candidates or credential matches in 907 text files. No
tracked files bypass the current ignore rules. This is a scoped pattern scan,
not an exhaustive secret or historical Git audit. No commit or push was made.


## Remote co-op investigation — 2026-11-05

The user reported a Brave/Linux host in Colombia and Chrome/Windows 10 guest in
Pakistan, while two Brave tabs on the host computer worked. The exact geographic
pair is not available to this test environment.

- Manual live Netlify UI test: host and invite guest connected successfully.
- Live fault injection: signaling disconnect left Copy Invite enabled/code visible;
  the new readiness assertion failed on that production version as expected.
- Separate Brave host + Chromium guest on the live site connected and progressed
  through combat, personal shopping and ammunition checks; the initial full run
  timed out at a zero-duration reload key press. This is partial live coverage,
  not a complete live pass.
- Local relay-only probe with shipped PeerJS defaults: no connection and zero relay
  candidates within 20 seconds. This does not establish a worldwide provider
  outage or prove the cause of the reported `peer-unavailable` response.
- Revised build: TypeScript, 105 tests and production build passed. Endpoint tests
  cover optional configuration, origins/methods, provider-host validation, malformed
  responses, failure handling and API-key redaction. Client tests cover ICE input,
  fallbacks and abort cleanup. No real provider API key was used.
- Full revised-build Brave-host/separate-Chromium-guest co-op smoke passed,
  including injected signaling loss/same-room recovery, combat/progression,
  third-seat rejection, purchases/healing, leave/rejoin and scene restarts.

Current logs: `/tmp/overrun-coop-fix-check.log`,
`/tmp/overrun-live-recovery-baseline.log`, `/tmp/overrun-live-brave.log`,
`/tmp/overrun-relay-probe.log`, `/tmp/overrun-final-coop.log`.
The Metered endpoint is prepared but inactive until the user configures their own
provider host/API key in Netlify's Functions environment and deploys this revision.
No commit, push, provider signup, paid service or live deployment was performed.
Actual provider authentication, deployed Function/rate-limit behavior, forced-relay
success and Colombia-to-Pakistan compatibility remain unverified.

Final desktop smoke against the revised production build also passed, including
combat, boss overlap and two restarts (`/tmp/overrun-final-browser.log`). Earlier
concurrent browser runs timed out on reload/restart assertions; final sequential
runs passed. This is bounded smoke evidence, not exhaustive network reliability.
