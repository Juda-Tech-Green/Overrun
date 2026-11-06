# CLI setup and execution

Use Node22.12+ (24 recommended). Install the matching0.5 local tarballs together from a stable location inside the consumer repository, such as vendor/pixelforge/:

```sh
npm install --ignore-scripts ./vendor/pixelforge/pixelforge-core-0.5.0.tgz ./vendor/pixelforge/pixelforge-exporters-0.5.0.tgz ./vendor/pixelforge/pixelforge-cli-0.5.0.tgz ./vendor/pixelforge/pixelforge-phaser-0.5.0.tgz
```

Normal installation resolves third-party dependencies online. --offline additionally requires a populated compatible npm cache; archives do not bundle those dependencies. Verify SHA256SUMS through the provider's verifier/trusted channel; checksums detect corruption, do not authenticate publishers. Do not save a dependency pointing to an unrelated sibling source checkout, substitute a similarly named public package, or force legacy-peer-deps. Inspect the host Phaser version before installing its adapter. Build source using npm ci then npm run pack:release; no dist bootstrap workaround is needed.

Exact invocation: `node node_modules/@pixelforge/cli/dist/index.js`; local npm scripts can use pixelforge. Windows node_modules/.bin/pixelforge.cmd and POSIX node_modules/.bin/pixelforge are equivalent; no Bash/global installation required.

Discover with --help, operations list, operations describe NAME (or --example), and inspect FILE --summary. Use selectors/pagination rather than dense source reads. init accepts --palette FILE (RGBA tuples; index0 transparent); default remains transparent/white. setPixel stays strict, shapes clip. apply reports operation index/targets/canvas ranges on failure and atomically preserves outputs.

Run scripts/check-environment.mjs, validate-project.mjs FILE and validate-export.mjs BUNDLE FILE from the consumer directory. Helpers resolve installed CLI/core from that cwd. See [production workflow](production-workflow.md) for contact/diff/check/build-assets and managed --replace. Runtime errors and successful commands are JSON; failures exit nonzero. Public registry publication is not implied by these local artifacts.
