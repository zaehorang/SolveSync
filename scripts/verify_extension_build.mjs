import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentScriptPath = resolve(root, "dist/content/index.js");
const manifestPath = resolve(root, "dist/manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const contentScript = readFileSync(contentScriptPath, "utf8");

const declaredContentScripts = manifest.content_scripts?.flatMap(
  (item) => item.js ?? []
);

if (!declaredContentScripts?.includes("content/index.js")) {
  throw new Error("manifest.json does not declare content/index.js");
}

if (/^\s*import\s/m.test(contentScript)) {
  throw new Error("content/index.js must not contain static ESM imports");
}

console.info("Extension build verified");
