import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import {
  assertReleaseMetadata,
  collectManifestAssetPaths,
  readJson,
} from "./release_metadata.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJson = readJson(resolve(root, "package.json"));
const sourceManifest = readJson(resolve(root, "manifest.json"));
const releaseLabel = process.argv[2] ?? `v${packageJson.version}`;
const publicEnv = loadEnv("production", root, "VITE_GITHUB_APP_");

assertReleaseMetadata({
  packageJson,
  manifest: sourceManifest,
  releaseLabel,
});

const distDirectory = resolve(root, "dist");
const artifactsDirectory = resolve(root, "artifacts");
const archivePath = resolve(
  artifactsDirectory,
  `SolveSync-${releaseLabel}.zip`
);
const distManifest = readJson(resolve(distDirectory, "manifest.json"));

assertReleaseMetadata({
  packageJson,
  manifest: distManifest,
  releaseLabel,
});

if (JSON.stringify(distManifest) !== JSON.stringify(sourceManifest)) {
  throw new Error("dist/manifest.json must match the source manifest.json");
}

for (const key of [
  "VITE_GITHUB_APP_CLIENT_ID",
  "VITE_GITHUB_APP_SLUG",
]) {
  const value = publicEnv[key]?.trim() ?? "";

  if (value.length === 0 || value.startsWith("replace-with-")) {
    throw new Error(`${key} must be configured before packaging`);
  }
}

const files = listFiles(distDirectory);
const builtJavaScript = files
  .filter((file) => file.name.endsWith(".js"))
  .map((file) => file.data.toString("utf8"))
  .join("\n");
const packagedText = files
  .map((file) => file.data.toString("utf8"))
  .join("\n");

for (const [label, pattern] of [
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
]) {
  if (pattern.test(packagedText)) {
    throw new Error(`Chrome ZIP contains a value that resembles a ${label}`);
  }
}

for (const key of [
  "VITE_GITHUB_APP_CLIENT_ID",
  "VITE_GITHUB_APP_SLUG",
]) {
  if (!builtJavaScript.includes(publicEnv[key].trim())) {
    throw new Error(`${key} is not embedded in the extension build`);
  }
}

const requiredEntries = new Set([
  ...collectManifestAssetPaths(distManifest),
  "manifest.json",
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt",
]);
const entries = files.map((file) => file.name);

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

  if (entry.endsWith(".map")) {
    throw new Error(`Chrome ZIP must not contain source maps: ${entry}`);
  }
}

const archive = createDeterministicZip(files);
const archiveEntries = readCentralDirectoryEntries(archive);

if (JSON.stringify(archiveEntries) !== JSON.stringify(entries)) {
  throw new Error("Chrome ZIP central directory does not match dist files");
}

mkdirSync(artifactsDirectory, { recursive: true });
writeFileSync(archivePath, archive);

const archiveSize = statSync(archivePath).size;

if (archiveSize === 0) {
  throw new Error("Chrome ZIP is empty");
}

console.info(
  `Chrome ZIP verified: artifacts/${basename(archivePath)} (${archiveSize} bytes, ${entries.length} entries)`
);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return listFiles(entryPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      return [
        {
          name: relative(distDirectory, entryPath).split(sep).join("/"),
          data: readFileSync(entryPath),
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function createDeterministicZip(zipFiles) {
  if (zipFiles.length > 0xffff) {
    throw new Error("ZIP64 archives are not supported");
  }

  const localRecords = [];
  const centralRecords = [];
  let localOffset = 0;

  for (const file of zipFiles) {
    const name = Buffer.from(file.name, "utf8");
    const checksum = crc32(file.data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x0021, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, name, file.data]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x0021, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(file.data.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralRecords.push(Buffer.concat([centralHeader, name]));

    localOffset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(zipFiles.length, 8);
  endOfCentralDirectory.writeUInt16LE(zipFiles.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localRecords,
    centralDirectory,
    endOfCentralDirectory,
  ]);
}

function readCentralDirectoryEntries(archive) {
  const endOffset = archive.length - 22;

  if (endOffset < 0 || archive.readUInt32LE(endOffset) !== 0x06054b50) {
    throw new Error("Chrome ZIP has no valid end-of-central-directory record");
  }

  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Chrome ZIP has an invalid central-directory record");
    }

    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    entries.push(archive.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function crc32(data) {
  let value = 0xffffffff;

  for (const byte of data) {
    value ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }

  return (value ^ 0xffffffff) >>> 0;
}
