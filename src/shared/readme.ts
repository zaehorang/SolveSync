import {
  compareSolutionCatalogProblems,
  parseProblemNumber,
  type SolutionCatalog,
  type SolutionCatalogProblem
} from "./solutionCatalog";
import { getPlatformPolicy, type PlatformPolicy } from "./platformPolicy";
import type { Platform } from "./types";

export const README_TABLE_START_MARKER = "<!-- LEETCODE_TABLE_START -->";
export const README_TABLE_END_MARKER = "<!-- LEETCODE_TABLE_END -->";
export const PROGRAMMERS_README_TABLE_START_MARKER =
  "<!-- PROGRAMMERS_TABLE_START -->";
export const PROGRAMMERS_README_TABLE_END_MARKER = "<!-- PROGRAMMERS_TABLE_END -->";

export function renderManagedReadmeTable(
  solutionCatalog: SolutionCatalog,
  platform: Platform = "leetcode"
): string {
  const policy = getPlatformPolicy(platform);
  const rows = [...solutionCatalog.problems]
    .sort(compareSolutionCatalogProblems)
    .map((problem) => renderProblemRow(problem, policy));

  return [
    "| # | Title | Difficulty | Solved | Swift | Python |",
    "| ---: | --- | --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

export function mergeReadmeManagedBlock(
  existingReadme: string | null | undefined,
  table: string,
  platform: Platform = "leetcode"
): string {
  const policy = getPlatformPolicy(platform);

  if (existingReadme === null || existingReadme === undefined || existingReadme === "") {
    return buildInitialReadme(table, platform);
  }

  const block = buildManagedBlock(table, policy);
  const startIndex = existingReadme.indexOf(policy.readmeMarkers.start);
  const endIndex = existingReadme.indexOf(policy.readmeMarkers.end);

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const before = existingReadme.slice(0, startIndex);
    const after = existingReadme.slice(endIndex + policy.readmeMarkers.end.length);

    return `${before}${block}${after}`;
  }

  return `${existingReadme.replace(/\s*$/u, "")}\n\n${block}\n`;
}

export function buildInitialReadme(
  table: string,
  platform: Platform = "leetcode"
): string {
  const policy = getPlatformPolicy(platform);

  return `# ${policy.initialReadmeTitle}\n\n${buildManagedBlock(table, policy)}\n`;
}

function buildManagedBlock(table: string, policy: PlatformPolicy): string {
  return `${policy.readmeMarkers.start}\n${table.trimEnd()}\n${policy.readmeMarkers.end}`;
}

function renderProblemRow(
  problem: SolutionCatalogProblem,
  policy: PlatformPolicy
): string {
  const swiftPath = problem.languages.swift?.solutionPath ?? null;
  const pythonPath = problem.languages.python3?.solutionPath ?? null;

  return [
    renderProblemNumber(problem.frontendId),
    escapeMarkdownTableCell(problem.title),
    escapeMarkdownTableCell(problem.difficulty),
    escapeMarkdownTableCell(problem.firstAcceptedDate),
    renderSolutionLink("Swift", swiftPath, policy),
    renderSolutionLink("Python", pythonPath, policy)
  ]
    .map((cell) => ` ${cell} `)
    .join("|")
    .replace(/^/u, "|")
    .replace(/$/u, "|");
}

function renderProblemNumber(frontendId: string): string {
  const numeric = parseProblemNumber(frontendId);
  return numeric === null ? escapeMarkdownTableCell(frontendId) : String(numeric);
}

function renderSolutionLink(
  label: string,
  path: string | null,
  policy: PlatformPolicy
): string {
  if (path === null) {
    return "-";
  }

  return `[${label}](${encodeMarkdownLinkDestination(
    toReadmeRelativePath(path, policy)
  )})`;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function encodeMarkdownLinkDestination(path: string): string {
  return path.replace(/\)/g, "%29").replace(/\s/g, "%20");
}

function toReadmeRelativePath(path: string, policy: PlatformPolicy): string {
  const prefix = `${policy.rootFolder}/`;

  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
