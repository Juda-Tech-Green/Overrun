import { environment, cliRun, report } from "./runtime.mjs";
await report(async () => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw new Error("Use Node22.12+");
  const { cli, require } = environment(),
    warnings = [];
  let phaser = null,
    adapter = null,
    adapterPeerRange = null;
  try {
    phaser = require("phaser/package.json").version;
  } catch {
    warnings.push(
      "No Phaser installation detected; engine integration checks were not performed",
    );
  }
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const main = require.resolve("@pixelforge/phaser");
    const metadata = JSON.parse(
      await fs.readFile(
        path.resolve(path.dirname(main), "../package.json"),
        "utf8",
      ),
    );
    adapter = metadata.version;
    adapterPeerRange = metadata.peerDependencies?.phaser ?? null;
  } catch {
    if (phaser) warnings.push("PixelForge Phaser adapter not installed");
  }
  const supported =
    phaser && /^\d+\.\d+\.\d+$/.test(phaser)
      ? (/^3\./.test(phaser) && Number(phaser.split(".")[1]) >= 90) ||
        (/^4\./.test(phaser) &&
          (Number(phaser.split(".")[1]) > 2 ||
            (Number(phaser.split(".")[1]) === 2 &&
              Number(phaser.split(".")[2]) >= 1)))
      : null;
  const peerCompatible =
    adapterPeerRange === "^3.90.0 || ^4.2.1"
      ? supported
      : adapterPeerRange === "^3.90.0"
        ? phaser
          ? /^3\./.test(phaser) && Number(phaser.split(".")[1]) >= 90
          : null
        : null;
  if (
    adapterPeerRange &&
    !["^3.90.0 || ^4.2.1", "^3.90.0"].includes(adapterPeerRange)
  )
    warnings.push(
      "Unknown adapter peer range; inspect its package metadata before integration",
    );
  if (phaser && (!supported || peerCompatible === false))
    warnings.push(
      "Host Phaser version is outside the adapter peer range; use a separately verified native workflow, do not force incompatible peers",
    );
  return {
    node: process.versions.node,
    cli,
    version: cliRun(cli, ["--version"]).trim(),
    phaser,
    adapter,
    adapterPeerRange,
    adapterPeerCompatible: peerCompatible,
    exactEngineVersionsExercised: ["3.90.0", "4.2.1"],
    warnings,
    artifacts: [],
  };
});
