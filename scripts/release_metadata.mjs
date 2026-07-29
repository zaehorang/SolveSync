import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function assertReleaseMetadata({
  packageJson,
  manifest,
  releaseLabel,
}) {
  const match =
    /^(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/.exec(packageJson.version);

  if (match === null) {
    throw new Error(
      "package.json version must use <major>.<minor>.<patch> or <major>.<minor>.<patch>-preview.<number>"
    );
  }

  const [, major, minor, patch, previewNumber] = match;
  const manifestVersionParts = [major, minor, patch];

  if (previewNumber !== undefined) {
    manifestVersionParts.push(previewNumber);
  }

  for (const part of manifestVersionParts) {
    if (
      !/^(0|[1-9]\d*)$/.test(part) ||
      Number(part) > 65535
    ) {
      throw new Error(`version component is invalid for Chrome: ${part}`);
    }
  }

  if (previewNumber === "0") {
    throw new Error("preview version number must be greater than zero");
  }

  const expectedManifestVersion =
    previewNumber === undefined
      ? `${major}.${minor}.${patch}`
      : `${major}.${minor}.${patch}.${previewNumber}`;

  if (
    previewNumber === undefined &&
    compareVersions(
      [Number(major), Number(minor), Number(patch)],
      [0, 1, 1]
    ) < 0
  ) {
    throw new Error(
      "the first stable version after the public preview must be 0.1.1 or newer"
    );
  }

  if (manifest.version !== expectedManifestVersion) {
    throw new Error(
      `manifest version ${manifest.version} must match package version ${packageJson.version} as ${expectedManifestVersion}`
    );
  }

  if (manifest.version_name !== packageJson.version) {
    throw new Error(
      `manifest version_name ${manifest.version_name} must match package version ${packageJson.version}`
    );
  }

  if (
    releaseLabel !== undefined &&
    releaseLabel !== `v${packageJson.version}`
  ) {
    throw new Error(
      `release label ${releaseLabel} must match package version as v${packageJson.version}`
    );
  }
}

function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function readRootReleaseMetadata(root) {
  const packageJson = readJson(resolve(root, "package.json"));
  const manifest = readJson(resolve(root, "manifest.json"));

  assertReleaseMetadata({ packageJson, manifest });

  return { packageJson, manifest };
}

export function collectManifestAssetPaths(manifest) {
  const paths = new Set([
    manifest.background?.service_worker,
    manifest.options_page,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ]);

  for (const contentScript of manifest.content_scripts ?? []) {
    for (const path of contentScript.js ?? []) {
      paths.add(path);
    }

    for (const path of contentScript.css ?? []) {
      paths.add(path);
    }
  }

  return [...paths].filter(
    (path) => typeof path === "string" && path.length > 0
  );
}
