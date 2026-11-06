import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw new Error("Use Node22.12+");
  const require = createRequire(resolve("package.json"));
  const main = require.resolve("@pixelforge/cli/package.json");
  const metadata = JSON.parse(await readFile(main, "utf8"));
  if (metadata.version !== "0.6.0")
    throw new Error(
      `Audio skill requires PixelForge0.6.0, found ${metadata.version}`,
    );
  for (const name of ["audio-core", "audio-exporters"]) {
    const entry = require.resolve(`@pixelforge/${name}`);
    const p = JSON.parse(
      await readFile(resolve(dirname(entry), "../package.json"), "utf8"),
    );
    if (p.version !== metadata.version)
      throw new Error(`Mismatched ${name} version`);
  }
  const cli = resolve(dirname(main), "dist/index.js");
  const result = spawnSync(
    process.execPath,
    [cli, "audio", "operations", "list"],
    { encoding: "utf8", timeout: 10000 },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || "Audio CLI discovery failed");
  const operations = JSON.parse(result.stdout).operations;
  if (!operations.includes("addVoice") || !operations.includes("setOde"))
    throw new Error("Incomplete audio command capability");
  console.log(
    JSON.stringify({
      ok: true,
      node: process.version,
      version: metadata.version,
      cli,
      operations,
      hostActivation: "not verified",
    }),
  );
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}
