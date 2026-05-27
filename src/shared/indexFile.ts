import type {
  IsoDateString,
  LeetCodeDifficulty,
  ProblemMetadata,
  SupportedLanguage
} from "./types";
import { isPlainRecord, isSupportedLanguage } from "./types";

export const LEETCODE_SYNC_INDEX_VERSION = 1;

export interface LeetCodeSyncIndexLanguageEntry {
  solutionPath: string;
  lastSubmissionId: string;
  lastSyncedAt: IsoDateString;
}

export type LeetCodeSyncIndexLanguageMap = Partial<
  Record<SupportedLanguage, LeetCodeSyncIndexLanguageEntry>
>;

export interface LeetCodeSyncIndexProblem {
  problemId: string;
  frontendId: string;
  title: string;
  titleSlug: string;
  difficulty: LeetCodeDifficulty;
  url: string;
  lastSyncedAt: IsoDateString;
  languages: LeetCodeSyncIndexLanguageMap;
}

export interface LeetCodeSyncIndex {
  version: typeof LEETCODE_SYNC_INDEX_VERSION;
  problems: LeetCodeSyncIndexProblem[];
}

export interface IndexSubmissionInput extends ProblemMetadata {
  submissionId: string;
  language: SupportedLanguage;
}

export class MalformedIndexError extends Error {
  readonly code = "malformed_index";

  constructor(message: string) {
    super(message);
    this.name = "MalformedIndexError";
  }
}

export function createEmptyIndex(): LeetCodeSyncIndex {
  return {
    version: LEETCODE_SYNC_INDEX_VERSION,
    problems: []
  };
}

export function parseIndexJson(text: string): LeetCodeSyncIndex {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new MalformedIndexError(toDebugMessage(error));
  }

  if (!isLeetCodeSyncIndex(parsed)) {
    throw new MalformedIndexError("Malformed LeetCode sync index.");
  }

  return parsed;
}

export function mergeIndexEntry(
  index: LeetCodeSyncIndex,
  submission: IndexSubmissionInput,
  path: string,
  syncedAt: IsoDateString
): LeetCodeSyncIndex {
  const languageEntry: LeetCodeSyncIndexLanguageEntry = {
    solutionPath: path,
    lastSubmissionId: submission.submissionId,
    lastSyncedAt: syncedAt
  };

  const existingProblem = index.problems.find((entry) =>
    isSameProblem(entry, submission)
  );

  const nextProblem: LeetCodeSyncIndexProblem = {
    problemId: submission.problemId,
    frontendId: submission.frontendId,
    title: submission.title,
    titleSlug: submission.titleSlug,
    difficulty: submission.difficulty,
    url: submission.url,
    lastSyncedAt: syncedAt,
    languages: {
      ...(existingProblem?.languages ?? {}),
      [submission.language]: languageEntry
    }
  };

  const otherProblems = index.problems.filter((entry) => !isSameProblem(entry, submission));

  return {
    version: LEETCODE_SYNC_INDEX_VERSION,
    problems: [...otherProblems, nextProblem].sort(compareIndexProblems)
  };
}

export function isLeetCodeSyncIndex(value: unknown): value is LeetCodeSyncIndex {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    value.version === LEETCODE_SYNC_INDEX_VERSION &&
    Array.isArray(value.problems) &&
    value.problems.every(isLeetCodeSyncIndexProblem)
  );
}

export function compareIndexProblems(
  left: LeetCodeSyncIndexProblem,
  right: LeetCodeSyncIndexProblem
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
  left: Pick<LeetCodeSyncIndexProblem, "problemId" | "titleSlug">,
  right: Pick<IndexSubmissionInput, "problemId" | "titleSlug">
): boolean {
  return left.problemId === right.problemId || left.titleSlug === right.titleSlug;
}

function isLeetCodeSyncIndexProblem(value: unknown): value is LeetCodeSyncIndexProblem {
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
    isLeetCodeSyncIndexLanguageMap(value.languages)
  );
}

function isLeetCodeSyncIndexLanguageMap(
  value: unknown
): value is LeetCodeSyncIndexLanguageMap {
  if (!isPlainRecord(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([language, entry]) => isSupportedLanguage(language) && isLanguageEntry(entry)
  );
}

function isLanguageEntry(value: unknown): value is LeetCodeSyncIndexLanguageEntry {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.solutionPath === "string" &&
    typeof value.lastSubmissionId === "string" &&
    typeof value.lastSyncedAt === "string"
  );
}

function toDebugMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Index JSON could not be parsed.";
}
