import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import path from "node:path";

const outfile = path.resolve("scripts/.ingest.mjs");

await build({
  entryPoints: ["scripts/ingest.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  packages: "external",
});

await import(pathToFileURL(outfile).href);
