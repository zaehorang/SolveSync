import type {
  IsoDateString,
  LeetCodeDifficulty,
  ProblemMetadata,
  SupportedLanguage
} from "./types";
import { isPlainRecord, isSupportedLanguage } from "./types";

export const SOLUTION_CATALOG_VERSION = 3;
const LEGACY_SOLUTION_CATALOG_V1_VERSION = 1;
const LEGACY_SOLUTION_CATALOG_V2_VERSION = 2;

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

export interface SolutionCatalogActivityDay {
  acceptedCount: number;
  newProblemCount: number;
}

export interface SolutionCatalogActivity {
  days: Record<string, SolutionCatalogActivityDay>;
}

export interface SolutionCatalog {
  version: typeof SOLUTION_CATALOG_VERSION;
  problems: SolutionCatalogProblem[];
  activity: SolutionCatalogActivity;
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
    problems: [],
    activity: {
      days: {}
    }
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
  const isDuplicateAcceptedSource =
    existingLanguageEntry?.lastAcceptedSourceId === acceptedSource.acceptedSourceId;
  const solutionRevisionNumber =
    existingLanguageEntry === undefined
      ? 1
      : isDuplicateAcceptedSource
        ? existingLanguageEntry.solutionRevisionNumber
        : existingLanguageEntry.solutionRevisionNumber + 1;
  const languageEntry: SolutionCatalogLanguageEntry = {
    solutionPath: path,
    lastAcceptedSourceId: acceptedSource.acceptedSourceId,
    solutionRevisionNumber,
    lastSyncedAt: isDuplicateAcceptedSource
      ? existingLanguageEntry?.lastSyncedAt ?? syncedAt
      : syncedAt,
    firstAcceptedDate: existingLanguageEntry?.firstAcceptedDate ?? acceptedDate,
    lastAcceptedDate: isDuplicateAcceptedSource
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
    lastSyncedAt: isDuplicateAcceptedSource
      ? existingProblem?.lastSyncedAt ?? syncedAt
      : syncedAt,
    firstAcceptedDate: existingProblem?.firstAcceptedDate ?? acceptedDate,
    lastAcceptedDate: isDuplicateAcceptedSource
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
    problems: [...otherProblems, nextProblem].sort(compareSolutionCatalogProblems),
    activity: mergeActivity(
      catalog.activity,
      acceptedDate,
      !isDuplicateAcceptedSource,
      existingProblem === undefined
    )
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
    value.problems.every(isSolutionCatalogProblem) &&
    isSolutionCatalogActivity(value.activity)
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
    (value.version !== LEGACY_SOLUTION_CATALOG_V1_VERSION &&
      value.version !== LEGACY_SOLUTION_CATALOG_V2_VERSION)
  ) {
    return null;
  }

  if (!Array.isArray(value.problems) || !isSolutionCatalogActivity(value.activity)) {
    return null;
  }

  const problems = value.problems.map(normalizeSolutionCatalogProblem);

  if (problems.some((problem) => problem === null)) {
    return null;
  }

  return {
    version: SOLUTION_CATALOG_VERSION,
    problems: (problems as SolutionCatalogProblem[]).sort(compareSolutionCatalogProblems),
    activity: value.activity
  };
}

function normalizeSolutionCatalogProblem(value: unknown): SolutionCatalogProblem | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const languages = normalizeSolutionCatalogLanguageMap(value.languages);
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

function isSolutionCatalogActivity(
  value: unknown
): value is SolutionCatalogActivity {
  if (!isPlainRecord(value) || !isPlainRecord(value.days)) {
    return false;
  }

  return Object.entries(value.days).every(
    ([date, day]) => typeof date === "string" && isActivityDay(day)
  );
}

function isActivityDay(value: unknown): value is SolutionCatalogActivityDay {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.acceptedCount) &&
    isNonNegativeInteger(value.newProblemCount)
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

function mergeActivity(
  activity: SolutionCatalogActivity,
  acceptedDate: IsoDateString,
  shouldIncrementAccepted: boolean,
  shouldIncrementNewProblem: boolean
): SolutionCatalogActivity {
  const days = { ...activity.days };

  if (!shouldIncrementAccepted && !shouldIncrementNewProblem) {
    return { days };
  }

  const existingDay = days[acceptedDate] ?? {
    acceptedCount: 0,
    newProblemCount: 0
  };

  days[acceptedDate] = {
    acceptedCount:
      existingDay.acceptedCount + (shouldIncrementAccepted ? 1 : 0),
    newProblemCount:
      existingDay.newProblemCount + (shouldIncrementNewProblem ? 1 : 0)
  };

  return { days };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function toDebugMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Solution Catalog JSON could not be parsed.";
}
