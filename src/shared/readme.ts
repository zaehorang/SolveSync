import {
  compareSolutionCatalogProblems,
  parseProblemNumber,
  type SolutionCatalog,
  type SolutionCatalogProblem
} from "./solutionCatalog";
import { getPlatformPolicy, type PlatformPolicy } from "./platformPolicy";
import type { CodingPlatform } from "./types";
import {
  getLanguageDefinition,
  SUPPORTED_LANGUAGE_KEYS
} from "./languageRegistry";

export const README_TABLE_START_MARKER = "<!-- LEETCODE_TABLE_START -->";
export const README_TABLE_END_MARKER = "<!-- LEETCODE_TABLE_END -->";
export const PROGRAMMERS_README_TABLE_START_MARKER =
  "<!-- PROGRAMMERS_TABLE_START -->";
export const PROGRAMMERS_README_TABLE_END_MARKER = "<!-- PROGRAMMERS_TABLE_END -->";

export function renderManagedReadmeTable(
  solutionCatalog: SolutionCatalog,
  codingPlatform: CodingPlatform = "leetcode"
): string {
  const policy = getPlatformPolicy(codingPlatform);
  const rows = [...solutionCatalog.problems]
    .sort(compareReadmeRows)
    .map((problem) => renderProblemRow(problem, policy));

  const headers = policy.readmeIncludesDifficulty
    ? ["#", "Title", "Difficulty", "Solved", "Languages"]
    : ["#", "Title", "Solved", "Languages"];
  const alignments = policy.readmeIncludesDifficulty
    ? ["---:", "---", "---", "---", "---"]
    : ["---:", "---", "---", "---"];

  return [renderTableRow(headers), renderTableRow(alignments), ...rows].join("\n");
}

/** README 표의 행 순서.
 *
 * Catalog의 `problems` 배열은 문제 번호 오름차순으로 두고(diff를 작게 유지한다)
 * 날짜 정렬은 렌더 시점에만 한다. 정렬 키를 Solved cell이 실제로 보여주는
 * first accepted date로 잡아야 표가 자기모순 없이 읽힌다. last accepted date로
 * 잡으면 재제출한 옛 문제가 위로 올라오는데 표시된 날짜는 그대로라 정렬이
 * 깨져 보인다.
 *
 * first accepted date는 day 단위라 같은 날 푼 문제가 묶인다. tiebreak를 문제
 * 번호로 고정해야 재렌더마다 순서가 흔들려 의미 없는 commit이 생기지 않는다.
 */
function compareReadmeRows(
  left: SolutionCatalogProblem,
  right: SolutionCatalogProblem
): number {
  if (left.firstAcceptedDate !== right.firstAcceptedDate) {
    return left.firstAcceptedDate < right.firstAcceptedDate ? 1 : -1;
  }

  return compareSolutionCatalogProblems(left, right);
}

export function mergeReadmeManagedBlock(
  existingReadme: string | null | undefined,
  table: string,
  codingPlatform: CodingPlatform = "leetcode"
): string {
  const policy = getPlatformPolicy(codingPlatform);

  if (existingReadme === null || existingReadme === undefined || existingReadme === "") {
    return buildInitialReadme(table, codingPlatform);
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
  codingPlatform: CodingPlatform = "leetcode"
): string {
  const policy = getPlatformPolicy(codingPlatform);

  return `# ${policy.initialReadmeTitle}\n\n${buildManagedBlock(table, policy)}\n`;
}

function buildManagedBlock(table: string, policy: PlatformPolicy): string {
  return `${policy.readmeMarkers.start}\n${table.trimEnd()}\n${policy.readmeMarkers.end}`;
}

function renderProblemRow(
  problem: SolutionCatalogProblem,
  policy: PlatformPolicy
): string {
  const cells = [
    renderProblemNumber(problem.frontendId),
    escapeMarkdownTableCell(problem.title),
    ...(policy.readmeIncludesDifficulty
      ? [escapeMarkdownTableCell(problem.difficulty)]
      : []),
    escapeMarkdownTableCell(problem.firstAcceptedDate),
    renderLanguageLinks(problem, policy)
  ];

  return renderTableRow(cells);
}

function renderTableRow(cells: string[]): string {
  return cells
    .map((cell) => ` ${cell} `)
    .join("|")
    .replace(/^/u, "|")
    .replace(/$/u, "|");
}

function renderLanguageLinks(
  problem: SolutionCatalogProblem,
  policy: PlatformPolicy
): string {
  const links = SUPPORTED_LANGUAGE_KEYS.flatMap((language) => {
    const path = problem.languages[language]?.solutionPath;

    return path === undefined
      ? []
      : [renderSolutionLink(getLanguageDefinition(language).displayName, path, policy)];
  });

  return links.length === 0 ? "-" : links.join(" · ");
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
