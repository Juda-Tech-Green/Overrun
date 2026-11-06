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
