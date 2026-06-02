import { isNormalizedError, type NormalizedError } from "./errors";

export type IsoDateString = string;

export type CodingPlatform = "leetcode" | "programmers";

export type SupportedLanguage = "swift" | "python3";

export type LeetCodeLanguage =
  | "Swift"
  | "Python3"
  | "Python"
  | "Java"
  | "C++"
  | "C"
  | "C#"
  | "JavaScript"
  | "TypeScript"
  | "Go"
  | "Kotlin"
  | "Rust"
  | "Ruby"
  | "PHP"
  | "Scala"
  | "Dart"
  | "Racket"
  | "Erlang"
  | "Elixir"
  | "Pandas"
  | (string & {});

export type LeetCodeDifficulty = "Easy" | "Medium" | "Hard" | (string & {});

export interface ProblemMetadata {
  problemId: string;
  frontendId: string;
  title: string;
  titleSlug: string;
  difficulty: LeetCodeDifficulty;
  url: string;
}

export interface AcceptedSubmission {
  acceptedSourceId: string;
  titleSlug: string;
  language: LeetCodeLanguage;
  code: string;
  acceptedAt: IsoDateString;
}

export interface SyncDeduplicationKey {
  codingPlatform: CodingPlatform;
  acceptedSourceId: string;
  titleSlug: string;
  language: SupportedLanguage;
}

export interface SyncRepository {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}

export interface SyncBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export type SyncStatus =
  | "setup_required"
  | "auto_sync_disabled"
  | "syncing"
  | "synced"
  | "unsupported_language"
  | "failed"
  | "retrying";

export interface SyncHistoryEntry {
  id: string;
  codingPlatform: CodingPlatform;
  status: SyncStatus;
  titleSlug: string;
  problemTitle: string | null;
  problemFrontendId: string | null;
  language: LeetCodeLanguage;
  supportedLanguage: SupportedLanguage | null;
  syncDeduplicationKey: SyncDeduplicationKey | null;
  repository: SyncRepository | null;
  branchName: string | null;
  solutionPath: string | null;
  commitSha: string | null;
  commitUrl: string | null;
  fileUrl: string | null;
  error: NormalizedError | null;
  retryPayloadId: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface RetryBundle {
  id: string;
  codingPlatform: CodingPlatform;
  syncDeduplicationKey: SyncDeduplicationKey;
  repository: SyncRepository;
  branch: SyncBranch;
  problem: ProblemMetadata;
  submission: AcceptedSubmission;
  solutionPath: string;
  solutionReadmePath: string;
  solutionCatalogPath: string;
  commitMessage: string;
  attempts: number;
  createdAt: IsoDateString;
  expiresAt: IsoDateString;
  lastError: NormalizedError | null;
}

export interface RetryBundleSummary {
  id: string;
  codingPlatform: CodingPlatform;
  syncDeduplicationKey: SyncDeduplicationKey;
  attempts: number;
  expiresAt: IsoDateString;
  lastError: NormalizedError | null;
}

/** @deprecated Transitional for this phase; use CodingPlatform. */
export type Platform = CodingPlatform;

/** @deprecated Transitional for this phase; use SyncDeduplicationKey. */
export type SubmissionIdentity = SyncDeduplicationKey;

/** @deprecated Transitional for this phase; use SyncRepository. */
export type RepositoryRef = SyncRepository;

/** @deprecated Transitional for this phase; use SyncBranch. */
export type BranchRef = SyncBranch;

/** @deprecated Transitional for this phase; use SyncHistoryEntry. */
export type SyncRecord = SyncHistoryEntry;

/** @deprecated Transitional for this phase; use RetryBundle. */
export type RetryPayload = RetryBundle;

/** @deprecated Transitional for this phase; use RetryBundleSummary. */
export type RetryPayloadSummary = RetryBundleSummary;

export function isSyncStatus(value: unknown): value is SyncStatus {
  return (
    value === "setup_required" ||
    value === "auto_sync_disabled" ||
    value === "syncing" ||
    value === "synced" ||
    value === "unsupported_language" ||
    value === "failed" ||
    value === "retrying"
  );
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "swift" || value === "python3";
}

export function isCodingPlatform(value: unknown): value is CodingPlatform {
  return value === "leetcode" || value === "programmers";
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSyncDeduplicationKey(
  value: unknown
): value is SyncDeduplicationKey {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isCodingPlatform(value.codingPlatform) &&
    typeof value.acceptedSourceId === "string" &&
    typeof value.titleSlug === "string" &&
    isSupportedLanguage(value.language)
  );
}

export function isSyncRepository(value: unknown): value is SyncRepository {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.owner === "string" &&
    typeof value.name === "string" &&
    typeof value.fullName === "string" &&
    typeof value.defaultBranch === "string" &&
    typeof value.private === "boolean" &&
    typeof value.htmlUrl === "string"
  );
}

export function isSyncBranch(value: unknown): value is SyncBranch {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.sha === "string" &&
    typeof value.protected === "boolean"
  );
}

export function isProblemMetadata(value: unknown): value is ProblemMetadata {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.problemId === "string" &&
    typeof value.frontendId === "string" &&
    typeof value.title === "string" &&
    typeof value.titleSlug === "string" &&
    typeof value.difficulty === "string" &&
    typeof value.url === "string"
  );
}

export function isAcceptedSubmission(value: unknown): value is AcceptedSubmission {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.acceptedSourceId === "string" &&
    typeof value.titleSlug === "string" &&
    typeof value.language === "string" &&
    typeof value.code === "string" &&
    typeof value.acceptedAt === "string"
  );
}

export function isSyncHistoryEntry(value: unknown): value is SyncHistoryEntry {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isCodingPlatform(value.codingPlatform) &&
    isSyncStatus(value.status) &&
    typeof value.titleSlug === "string" &&
    (typeof value.problemTitle === "string" || value.problemTitle === null) &&
    (typeof value.problemFrontendId === "string" || value.problemFrontendId === null) &&
    typeof value.language === "string" &&
    (isSupportedLanguage(value.supportedLanguage) || value.supportedLanguage === null) &&
    (isSyncDeduplicationKey(value.syncDeduplicationKey) ||
      value.syncDeduplicationKey === null) &&
    (isSyncRepository(value.repository) || value.repository === null) &&
    (typeof value.branchName === "string" || value.branchName === null) &&
    (typeof value.solutionPath === "string" || value.solutionPath === null) &&
    (typeof value.commitSha === "string" || value.commitSha === null) &&
    (typeof value.commitUrl === "string" || value.commitUrl === null) &&
    (typeof value.fileUrl === "string" || value.fileUrl === null) &&
    (isNormalizedError(value.error) || value.error === null) &&
    (typeof value.retryPayloadId === "string" || value.retryPayloadId === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function isRetryBundle(value: unknown): value is RetryBundle {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isCodingPlatform(value.codingPlatform) &&
    isSyncDeduplicationKey(value.syncDeduplicationKey) &&
    isSyncRepository(value.repository) &&
    isSyncBranch(value.branch) &&
    isProblemMetadata(value.problem) &&
    isAcceptedSubmission(value.submission) &&
    typeof value.solutionPath === "string" &&
    typeof value.solutionReadmePath === "string" &&
    typeof value.solutionCatalogPath === "string" &&
    typeof value.commitMessage === "string" &&
    typeof value.attempts === "number" &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 0 &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string" &&
    (isNormalizedError(value.lastError) || value.lastError === null)
  );
}
