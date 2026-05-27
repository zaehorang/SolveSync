import {
  compareIndexProblems,
  parseProblemNumber,
  type LeetCodeSyncIndex,
  type LeetCodeSyncIndexProblem
} from "./indexFile";

export const README_TABLE_START_MARKER = "<!-- LEETCODE_TABLE_START -->";
export const README_TABLE_END_MARKER = "<!-- LEETCODE_TABLE_END -->";

export function renderManagedReadmeTable(index: LeetCodeSyncIndex): string {
  const rows = [...index.problems].sort(compareIndexProblems).map(renderProblemRow);

  return [
    "| # | Title | Difficulty | Swift | Python |",
    "| ---: | --- | --- | --- | --- |",
    ...rows
  ].join("\n");
}

export function mergeReadmeManagedBlock(
  existingReadme: string | null | undefined,
  table: string
): string {
  if (existingReadme === null || existingReadme === undefined || existingReadme === "") {
    return buildInitialReadme(table);
  }

  const block = buildManagedBlock(table);
  const startIndex = existingReadme.indexOf(README_TABLE_START_MARKER);
  const endIndex = existingReadme.indexOf(README_TABLE_END_MARKER);

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const before = existingReadme.slice(0, startIndex);
    const after = existingReadme.slice(endIndex + README_TABLE_END_MARKER.length);

    return `${before}${block}${after}`;
  }

  return `${existingReadme.replace(/\s*$/u, "")}\n\n${block}\n`;
}

export function buildInitialReadme(table: string): string {
  return `# LeetCode Solutions\n\n${buildManagedBlock(table)}\n`;
}

function buildManagedBlock(table: string): string {
  return `${README_TABLE_START_MARKER}\n${table.trimEnd()}\n${README_TABLE_END_MARKER}`;
}

function renderProblemRow(problem: LeetCodeSyncIndexProblem): string {
  const swiftPath = problem.languages.swift?.solutionPath ?? null;
  const pythonPath = problem.languages.python3?.solutionPath ?? null;

  return [
    renderProblemNumber(problem.frontendId),
    escapeMarkdownTableCell(problem.title),
    escapeMarkdownTableCell(problem.difficulty),
    renderSolutionLink("Swift", swiftPath),
    renderSolutionLink("Python", pythonPath)
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

function renderSolutionLink(label: string, path: string | null): string {
  if (path === null) {
    return "-";
  }

  return `[${label}](${encodeMarkdownLinkDestination(toReadmeRelativePath(path))})`;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function encodeMarkdownLinkDestination(path: string): string {
  return path.replace(/\)/g, "%29").replace(/\s/g, "%20");
}

function toReadmeRelativePath(path: string): string {
  return path.startsWith("leetcode/") ? path.slice("leetcode/".length) : path;
}
