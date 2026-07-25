import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(extensionRoot, "dist/extension.cjs");

await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(extensionRoot, "src/extension.ts")],
  outfile: output,
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  sourcesContent: false,
  logLevel: "info",
});
