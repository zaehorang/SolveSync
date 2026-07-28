import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8")
);
const releaseLabel = process.argv[2] ?? `v${packageJson.version}`;
const publicEnv = loadEnv("production", root, "VITE_GITHUB_APP_");

if (!/^[0-9A-Za-z][0-9A-Za-z.-]*$/.test(releaseLabel)) {
  throw new Error(
    "Release label must contain only letters, numbers, dots, and hyphens"
  );
}

const distDirectory = resolve(root, "dist");
const artifactsDirectory = resolve(root, "artifacts");
const archivePath = resolve(
  artifactsDirectory,
  `solvesync-${releaseLabel}.zip`
);

for (const key of [
  "VITE_GITHUB_APP_CLIENT_ID",
  "VITE_GITHUB_APP_SLUG",
]) {
  const value = publicEnv[key]?.trim() ?? "";

  if (value.length === 0 || value.startsWith("replace-with-")) {
    throw new Error(`${key} must be configured before packaging`);
  }
}

const builtJavaScript = readTextFiles(distDirectory, ".js").join("\n");

for (const key of [
  "VITE_GITHUB_APP_CLIENT_ID",
  "VITE_GITHUB_APP_SLUG",
]) {
  if (!builtJavaScript.includes(publicEnv[key].trim())) {
    throw new Error(`${key} is not embedded in the extension build`);
  }
}

mkdirSync(artifactsDirectory, { recursive: true });
rmSync(archivePath, { force: true });

const zipResult = spawnSync(
  "zip",
  ["-X", "-q", "-r", archivePath, "."],
  {
    cwd: distDirectory,
    encoding: "utf8",
  }
);

if (zipResult.error) {
  throw zipResult.error;
}

if (zipResult.status !== 0) {
  throw new Error(zipResult.stderr.trim() || "Failed to create Chrome ZIP");
}

const listResult = spawnSync("unzip", ["-Z1", archivePath], {
  encoding: "utf8",
});

if (listResult.error) {
  throw listResult.error;
}

if (listResult.status !== 0) {
  throw new Error(listResult.stderr.trim() || "Failed to inspect Chrome ZIP");
}

const entries = listResult.stdout
  .split(/\r?\n/)
  .map((entry) => entry.replace(/^\.\//, ""))
  .filter(Boolean);

const requiredEntries = ["manifest.json", "content/index.js"];

for (const requiredEntry of requiredEntries) {
  if (!entries.includes(requiredEntry)) {
    throw new Error(`Chrome ZIP is missing ${requiredEntry}`);
  }
}

const forbiddenPathParts = new Set([
  ".git",
  ".env",
  ".env.local",
  ".DS_Store",
  "__MACOSX",
  "artifacts",
  "coverage",
  "docs",
  "node_modules",
  "src",
]);

for (const entry of entries) {
  const pathParts = entry.split("/").filter(Boolean);

  if (pathParts[0] === "dist") {
    throw new Error("Chrome ZIP must contain dist contents at its root");
  }

  if (
    pathParts.some(
      (part) => forbiddenPathParts.has(part) || part.startsWith(".env")
    )
  ) {
    throw new Error(`Chrome ZIP contains forbidden path: ${entry}`);
  }
}

const archiveSize = statSync(archivePath).size;

if (archiveSize === 0) {
  throw new Error("Chrome ZIP is empty");
}

console.info(
  `Chrome ZIP verified: artifacts/${basename(archivePath)} (${archiveSize} bytes, ${entries.length} entries)`
);

function readTextFiles(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return readTextFiles(entryPath, extension);
    }

    return entry.name.endsWith(extension)
      ? [readFileSync(entryPath, "utf8")]
      : [];
  });
}
