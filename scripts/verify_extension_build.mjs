import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import {
  assertReleaseMetadata,
  collectManifestAssetPaths,
  readJson,
} from "./release_metadata.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentScriptPath = resolve(root, "dist/content/index.js");
const manifestPath = resolve(root, "dist/manifest.json");

const packageJson = readJson(resolve(root, "package.json"));
const sourceManifest = readJson(resolve(root, "manifest.json"));
const manifest = readJson(manifestPath);
const contentScript = readFileSync(contentScriptPath, "utf8");

assertReleaseMetadata({ packageJson, manifest });

if (JSON.stringify(manifest) !== JSON.stringify(sourceManifest)) {
  throw new Error("dist/manifest.json must match the source manifest.json");
}

const declaredContentScripts = manifest.content_scripts?.flatMap(
  (item) => item.js ?? []
);

if (!declaredContentScripts?.includes("content/index.js")) {
  throw new Error("manifest.json does not declare content/index.js");
}

try {
  new Script(contentScript, { filename: "content/index.js" });
} catch (error) {
  throw new Error(
    `content/index.js must be a valid classic script: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

for (const assetPath of [
  ...collectManifestAssetPaths(manifest),
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt",
]) {
  if (
    assetPath.startsWith("/") ||
    assetPath.split("/").includes("..") ||
    !existsSync(resolve(root, "dist", assetPath)) ||
    !statSync(resolve(root, "dist", assetPath)).isFile()
  ) {
    throw new Error(`manifest or release asset is missing: ${assetPath}`);
  }
}

if (manifest.minimum_chrome_version !== "102") {
  throw new Error("manifest minimum_chrome_version must be 102");
}

for (const permission of ["alarms", "storage"]) {
  if (!manifest.permissions?.includes(permission)) {
    throw new Error(`manifest permissions must include ${permission}`);
  }
}

console.info("Extension build verified");
