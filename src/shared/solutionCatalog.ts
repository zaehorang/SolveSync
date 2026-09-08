import type {
  IsoDateString,
  LeetCodeDifficulty,
  ProblemMetadata,
  SupportedLanguage
} from "./types";
import { isPlainRecord, isSupportedLanguage } from "./types";

export const SOLUTION_CATALOG_VERSION = 5;
const LEGACY_SOLUTION_CATALOG_VERSIONS = [1, 2, 3, 4];
/** v3부터 language entry가 Solution Revision Number를 갖는다. 그 이전은 다시 센다. */
const FIRST_REVISION_AWARE_CATALOG_VERSION = 3;

export interface SolutionCatalogLanguageEntry {
  solutionPath: string;
  lastAcceptedSourceId: string;
  solutionRevisionNumber: number;
  lastSyncedAt: IsoDateString;
  firstAcceptedDate: IsoDateString;
  lastAcceptedDate: IsoDateString;
}

export type SolutionCatalogLanguageMap = Partial<
  Record<SupportedLanguage, SolutionCatalogLanguageEntry>
>;

export interface SolutionCatalogProblem {
  problemId: string;
  frontendId: string;
  title: string;
  titleSlug: string;
  difficulty: LeetCodeDifficulty;
  url: string;
  lastSyncedAt: IsoDateString;
  firstAcceptedDate: IsoDateString;
  lastAcceptedDate: IsoDateString;
  languages: SolutionCatalogLanguageMap;
}

export interface SolutionCatalog {
  version: typeof SOLUTION_CATALOG_VERSION;
  problems: SolutionCatalogProblem[];
}

export interface SolutionCatalogAcceptedSourceInput extends ProblemMetadata {
  acceptedSourceId: string;
  language: SupportedLanguage;
}

export class MalformedSolutionCatalogError extends Error {
  readonly code = "malformed_index";

  constructor(message: string) {
    super(message);
    this.name = "MalformedSolutionCatalogError";
  }
}

export function createEmptySolutionCatalog(): SolutionCatalog {
  return {
    version: SOLUTION_CATALOG_VERSION,
    problems: []
  };
}

export function parseSolutionCatalogJson(text: string): SolutionCatalog {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new MalformedSolutionCatalogError(toDebugMessage(error));
  }

  const catalog = normalizeSolutionCatalog(parsed);

  if (catalog === null) {
    throw new MalformedSolutionCatalogError("Malformed Solution Catalog.");
  }

  return catalog;
}

export function mergeSolutionCatalogEntry(
  catalog: SolutionCatalog,
  acceptedSource: SolutionCatalogAcceptedSourceInput,
  path: string,
  syncedAt: IsoDateString,
  acceptedDate: IsoDateString
): SolutionCatalog {
  return mergeSolutionCatalogEntryWithResult(
    catalog,
    acceptedSource,
    path,
    syncedAt,
    acceptedDate
  ).catalog;
}

export function mergeSolutionCatalogEntryWithResult(
  catalog: SolutionCatalog,
  acceptedSource: SolutionCatalogAcceptedSourceInput,
  path: string,
  syncedAt: IsoDateString,
  acceptedDate: IsoDateString
): { catalog: SolutionCatalog; solutionRevisionNumber: number } {
  const existingProblem = catalog.problems.find((entry) =>
    isSameProblem(entry, acceptedSource)
  );
  const existingLanguageEntry = existingProblem?.languages[acceptedSource.language];
  /* Catalog에 이미 이 `acceptedSourceId`가 있으면 **이 Accepted는 이미 Sync Branch에
   * 써졌다**는 뜻이다. Sync Deduplication Key가 Accepted 하나를 식별하므로(ADR 0041)
   * 같은 값이 두 번 나오는 경로는 하나뿐이다 — commit은 성공했는데 processed 기록이
   * 남지 않아(service worker 종료, 응답 유실) Retry Bundle로 다시 올라오는 경우다.
   * 그때 revision을 또 올리면 하나의 Accepted가 `(rev 1)`과 `(rev 2)` 두 commit으로
   * 남는다. 번호는 Sync Branch에 실제 반영된 revision을 뜻하므로(ADR 0027) 여기서는
   * 세지 않는다.
   *
   * 이 분기는 "같은 code"가 아니라 "같은 Accepted"를 막는다. 사용자가 같은 풀이를
   * 다시 제출하면 다른 Accepted라 다른 값이 오고, 그때는 아래에서 번호가 증가한다. */
  const isAlreadyCommittedAcceptedSource =
    existingLanguageEntry?.lastAcceptedSourceId === acceptedSource.acceptedSourceId;
  const solutionRevisionNumber =
    existingLanguageEntry === undefined
      ? 1
      : isAlreadyCommittedAcceptedSource
        ? existingLanguageEntry.solutionRevisionNumber
        : existingLanguageEntry.solutionRevisionNumber + 1;
  const languageEntry: SolutionCatalogLanguageEntry = {
    solutionPath: path,
    lastAcceptedSourceId: acceptedSource.acceptedSourceId,
    solutionRevisionNumber,
    lastSyncedAt: isAlreadyCommittedAcceptedSource
      ? existingLanguageEntry?.lastSyncedAt ?? syncedAt
      : syncedAt,
    firstAcceptedDate: existingLanguageEntry?.firstAcceptedDate ?? acceptedDate,
    lastAcceptedDate: isAlreadyCommittedAcceptedSource
      ? existingLanguageEntry?.lastAcceptedDate ?? acceptedDate
      : acceptedDate
  };

  const nextProblem: SolutionCatalogProblem = {
    problemId: acceptedSource.problemId,
    frontendId: acceptedSource.frontendId,
    title: acceptedSource.title,
    titleSlug: acceptedSource.titleSlug,
    difficulty: acceptedSource.difficulty,
    url: acceptedSource.url,
    lastSyncedAt: isAlreadyCommittedAcceptedSource
      ? existingProblem?.lastSyncedAt ?? syncedAt
      : syncedAt,
    firstAcceptedDate: existingProblem?.firstAcceptedDate ?? acceptedDate,
    lastAcceptedDate: isAlreadyCommittedAcceptedSource
      ? existingProblem?.lastAcceptedDate ?? acceptedDate
      : acceptedDate,
    languages: {
      ...(existingProblem?.languages ?? {}),
      [acceptedSource.language]: languageEntry
    }
  };

  const otherProblems = catalog.problems.filter((entry) =>
    !isSameProblem(entry, acceptedSource)
  );

  const nextCatalog: SolutionCatalog = {
    version: SOLUTION_CATALOG_VERSION,
    problems: [...otherProblems, nextProblem].sort(compareSolutionCatalogProblems)
  };

  return {
    catalog: nextCatalog,
    solutionRevisionNumber
  };
}

export function isSolutionCatalog(value: unknown): value is SolutionCatalog {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    value.version === SOLUTION_CATALOG_VERSION &&
    Array.isArray(value.problems) &&
    value.problems.every(isSolutionCatalogProblem)
  );
}

export function compareSolutionCatalogProblems(
  left: SolutionCatalogProblem,
  right: SolutionCatalogProblem
): number {
  const leftNumber = parseProblemNumber(left.frontendId);
  const rightNumber = parseProblemNumber(right.frontendId);

  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  if (leftNumber !== null && rightNumber === null) {
    return -1;
  }

  if (leftNumber === null && rightNumber !== null) {
    return 1;
  }

  return left.titleSlug.localeCompare(right.titleSlug);
}

export function parseProblemNumber(raw: string): number | null {
  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

function isSameProblem(
  left: Pick<SolutionCatalogProblem, "problemId" | "titleSlug">,
  right: Pick<SolutionCatalogAcceptedSourceInput, "problemId" | "titleSlug">
): boolean {
  return left.problemId === right.problemId || left.titleSlug === right.titleSlug;
}

function normalizeSolutionCatalog(value: unknown): SolutionCatalog | null {
  if (isSolutionCatalog(value)) {
    return value;
  }

  if (
    !isPlainRecord(value) ||
    !LEGACY_SOLUTION_CATALOG_VERSIONS.includes(value.version as number)
  ) {
    return null;
  }

  if (!Array.isArray(value.problems)) {
    return null;
  }

  // v5에서 activity를 지웠으므로 legacy 파일이 무엇을 담고 있든 읽지 않고 버린다.
  const problems = value.problems.map((problem) =>
    normalizeSolutionCatalogProblem(
      problem,
      (value.version as number) >= FIRST_REVISION_AWARE_CATALOG_VERSION
    )
  );

  if (problems.some((problem) => problem === null)) {
    return null;
  }

  return {
    version: SOLUTION_CATALOG_VERSION,
    problems: (problems as SolutionCatalogProblem[]).sort(compareSolutionCatalogProblems)
  };
}

function normalizeSolutionCatalogProblem(
  value: unknown,
  preserveRevision: boolean
): SolutionCatalogProblem | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const languages = preserveRevision
    ? value.languages
    : normalizeSolutionCatalogLanguageMap(value.languages);
  const candidate = {
    ...value,
    languages
  };

  return isSolutionCatalogProblem(candidate) ? candidate : null;
}

function isSolutionCatalogProblem(value: unknown): value is SolutionCatalogProblem {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.problemId === "string" &&
    typeof value.frontendId === "string" &&
    typeof value.title === "string" &&
    typeof value.titleSlug === "string" &&
    typeof value.difficulty === "string" &&
    typeof value.url === "string" &&
    typeof value.lastSyncedAt === "string" &&
    typeof value.firstAcceptedDate === "string" &&
    typeof value.lastAcceptedDate === "string" &&
    isSolutionCatalogLanguageMap(value.languages)
  );
}

function isSolutionCatalogLanguageMap(
  value: unknown
): value is SolutionCatalogLanguageMap {
  if (!isPlainRecord(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([language, entry]) => isSupportedLanguage(language) && isLanguageEntry(entry)
  );
}

function normalizeSolutionCatalogLanguageMap(
  value: unknown
): SolutionCatalogLanguageMap | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const entries: Array<[string, SolutionCatalogLanguageEntry | null]> =
    Object.entries(value).map(([language, entry]) => [
      language,
      normalizeLanguageEntry(entry)
    ]);

  if (
    entries.some(
      ([language, entry]) => !isSupportedLanguage(language) || entry === null
    )
  ) {
    return null;
  }

  return Object.fromEntries(entries) as SolutionCatalogLanguageMap;
}

function normalizeLanguageEntry(value: unknown): SolutionCatalogLanguageEntry | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const {
    lastSubmissionId: legacyLastSubmissionId,
    lastAcceptedSourceId,
    ...rest
  } = value;
  const candidate = {
    ...rest,
    lastAcceptedSourceId:
      typeof lastAcceptedSourceId === "string"
        ? lastAcceptedSourceId
        : legacyLastSubmissionId,
    solutionRevisionNumber: 1
  };

  return isLanguageEntry(candidate) ? candidate : null;
}

function isLanguageEntry(value: unknown): value is SolutionCatalogLanguageEntry {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.solutionPath === "string" &&
    typeof value.lastAcceptedSourceId === "string" &&
    isPositiveInteger(value.solutionRevisionNumber) &&
    typeof value.lastSyncedAt === "string" &&
    typeof value.firstAcceptedDate === "string" &&
    typeof value.lastAcceptedDate === "string"
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function toDebugMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Solution Catalog JSON could not be parsed.";
}
