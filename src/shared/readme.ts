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
 * 날짜 정렬은 렌더 시점에만 한다. 1차 키는 Solved cell이 실제로 보여주는 first
 * accepted date 내림차순이다. last accepted date로 잡으면 재제출한 옛 문제가
 * 위로 올라오는데 표시된 날짜는 그대로라 정렬이 깨져 보인다.
 *
 * first accepted date는 day 단위라 같은 날 푼 문제가 묶인다. 그 안에서는 문제의
 * language entry들 중 가장 최근 `lastSyncedAt`이 늦은 것을 위에 둔다. 방금 푼
 * 문제가 번호가 크다는 이유로 그날 묶음의 맨 아래로 가면 안 되기 때문이다.
 * `lastSyncedAt`은 새 commit이 생길 때만 바뀌므로(이미 Catalog에 있는 Accepted를
 * 건너뛰면 그대로다) 재렌더만으로 순서가 흔들려 의미 없는 commit이 생기지 않는다.
 * 부작용으로 같은 날 먼저 푼 문제를 다시 제출하면 그날 묶음의 맨 위로 올라온다.
 *
 * Catalog parser는 `lastSyncedAt`이 문자열이기만 하면 통과시킨다. 그래서 값이 누락된
 * entry는 parser가 malformed_index로 거부해 여기까지 오지 않지만, `not-a-date` 같은
 * 파싱 불가 문자열은 여기까지 올 수 있다. 어느 경우든 가장 오래된 것으로 보아
 * 파싱되는 것 뒤에 두고, 그들끼리는 문제 번호로 tiebreak한다. 누락 처리는 정책이
 * 아니라 비교를 전순서로 유지하기 위한 방어다.
 */
function compareReadmeRows(
  left: SolutionCatalogProblem,
  right: SolutionCatalogProblem
): number {
  if (left.firstAcceptedDate !== right.firstAcceptedDate) {
    return left.firstAcceptedDate < right.firstAcceptedDate ? 1 : -1;
  }

  const leftSyncedAt = latestSyncedAtMs(left);
  const rightSyncedAt = latestSyncedAtMs(right);

  if (leftSyncedAt !== rightSyncedAt) {
    return rightSyncedAt - leftSyncedAt;
  }

  return compareSolutionCatalogProblems(left, right);
}

/** 문제의 language entry 중 가장 늦은 `lastSyncedAt`(ms). 없거나 파싱 불가면 -Infinity. */
function latestSyncedAtMs(problem: SolutionCatalogProblem): number {
  let latest = Number.NEGATIVE_INFINITY;

  for (const entry of Object.values(problem.languages)) {
    const syncedAtMs = Date.parse(entry?.lastSyncedAt ?? "");

    if (!Number.isNaN(syncedAtMs) && syncedAtMs > latest) {
      latest = syncedAtMs;
    }
  }

  return latest;
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
    renderProblemTitle(problem, policy),
    ...(policy.readmeIncludesDifficulty
      ? [escapeMarkdownTableCell(problem.difficulty)]
      : []),
    escapeMarkdownTableCell(problem.firstAcceptedDate),
    renderLanguageLinks(problem, policy)
  ];

  return renderTableRow(cells);
}

/** 제목 cell. 문제 page URL이 있으면 링크를 건다.
 *
 * link text 안의 `[`, `]`를 escape한다. SWEA 제목은 `[모의 SW 역량테스트] 등산로
 * 조성`처럼 대괄호로 시작하는 경우가 흔하다. CommonMark는 균형 잡힌 대괄호를
 * 허용하지만 escape해두면 파서 해석에 기대지 않아도 된다.
 */
function renderProblemTitle(
  problem: SolutionCatalogProblem,
  policy: PlatformPolicy
): string {
  const title = escapeMarkdownTableCell(problem.title);
  const url = policy.buildProblemUrl(problem);

  if (url.length === 0) {
    return title;
  }

  const linkText = title.replace(/\[/g, "\\[").replace(/\]/g, "\\]");

  return `[${linkText}](${encodeMarkdownLinkDestination(url)})`;
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
