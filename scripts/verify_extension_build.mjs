import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(root, "dist/manifest.json");
const distDirectory = resolve(root, "dist");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const requiredLocaleFiles = [
  "_locales/en/messages.json",
  "_locales/ko/messages.json"
];

for (const localeFile of requiredLocaleFiles) {
  if (!existsSync(resolve(distDirectory, localeFile))) {
    throw new Error(`Extension build is missing ${localeFile}`);
  }
}

const allowedRootEntries = new Set([
  "_locales",
  "assets",
  "background",
  "content",
  "icons",
  "manifest.json",
  "options",
  "popup"
]);

for (const entry of readdirSync(distDirectory)) {
  if (!allowedRootEntries.has(entry)) {
    throw new Error(`Extension build contains unsupported path: ${entry}`);
  }
}

const declaredContentScripts = manifest.content_scripts?.flatMap(
  (item) => item.js ?? []
);

// content/index.js는 isolated world, content/sweaEditorBridge.js는 MAIN world
// bridge(ADR 0035)다. 둘 다 classic script라 static ESM import가 남으면 안 된다.
const requiredBundles = ["content/index.js", "content/sweaEditorBridge.js"];

for (const bundle of requiredBundles) {
  if (!declaredContentScripts?.includes(bundle)) {
    throw new Error(`manifest.json does not declare ${bundle}`);
  }

  const source = readFileSync(resolve(root, "dist", bundle), "utf8");

  if (/^\s*import\s/m.test(source)) {
    throw new Error(`${bundle} must not contain static ESM imports`);
  }
}

const bridgeDeclaration = manifest.content_scripts?.find((item) =>
  item.js?.includes("content/sweaEditorBridge.js")
);

if (bridgeDeclaration?.world !== "MAIN") {
  throw new Error("content/sweaEditorBridge.js must be declared with world MAIN");
}

console.info("Extension build verified");
