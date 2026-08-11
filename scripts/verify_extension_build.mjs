import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentScriptPath = resolve(root, "dist/content/index.js");
const manifestPath = resolve(root, "dist/manifest.json");
const publicEnv = loadEnv("production", root, "VITE_GITHUB_APP_");

for (const key of [
  "VITE_GITHUB_APP_CLIENT_ID",
  "VITE_GITHUB_APP_SLUG",
]) {
  if ((publicEnv[key]?.trim() ?? "").length === 0) {
    throw new Error(`production build 검증 실패: ${key} 설정이 비어 있습니다.`);
  }
}

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
