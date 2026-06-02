import { isNormalizedError, type NormalizedError } from "./errors";

export type IsoDateString = string;

export type Platform = "leetcode" | "programmers";

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
  submissionId: string;
  titleSlug: string;
  language: LeetCodeLanguage;
  code: string;
  acceptedAt: IsoDateString;
}

export interface SubmissionIdentity {
  platform: Platform;
  submissionId: string;
  titleSlug: string;
  language: SupportedLanguage;
}

export interface RepositoryRef {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}

export interface BranchRef {
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

export interface SyncRecord {
  id: string;
  platform: Platform;
  status: SyncStatus;
  titleSlug: string;
  problemTitle: string | null;
  problemFrontendId: string | null;
  language: LeetCodeLanguage;
  supportedLanguage: SupportedLanguage | null;
  identity: SubmissionIdentity | null;
  repository: RepositoryRef | null;
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

export interface RetryPayload {
  id: string;
  platform: Platform;
  identity: SubmissionIdentity;
  repository: RepositoryRef;
  branch: BranchRef;
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

export interface RetryPayloadSummary {
  id: string;
  platform: Platform;
  identity: SubmissionIdentity;
  attempts: number;
  expiresAt: IsoDateString;
  lastError: NormalizedError | null;
}

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

export function isPlatform(value: unknown): value is Platform {
  return value === "leetcode" || value === "programmers";
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSubmissionIdentity(value: unknown): value is SubmissionIdentity {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isPlatform(value.platform) &&
    typeof value.submissionId === "string" &&
    typeof value.titleSlug === "string" &&
    isSupportedLanguage(value.language)
  );
}

export function isRepositoryRef(value: unknown): value is RepositoryRef {
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

export function isBranchRef(value: unknown): value is BranchRef {
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
    typeof value.submissionId === "string" &&
    typeof value.titleSlug === "string" &&
    typeof value.language === "string" &&
    typeof value.code === "string" &&
    typeof value.acceptedAt === "string"
  );
}

export function isSyncRecord(value: unknown): value is SyncRecord {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isPlatform(value.platform) &&
    isSyncStatus(value.status) &&
    typeof value.titleSlug === "string" &&
    (typeof value.problemTitle === "string" || value.problemTitle === null) &&
    (typeof value.problemFrontendId === "string" || value.problemFrontendId === null) &&
    typeof value.language === "string" &&
    (isSupportedLanguage(value.supportedLanguage) || value.supportedLanguage === null) &&
    (isSubmissionIdentity(value.identity) || value.identity === null) &&
    (isRepositoryRef(value.repository) || value.repository === null) &&
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

export function isRetryPayload(value: unknown): value is RetryPayload {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isPlatform(value.platform) &&
    isSubmissionIdentity(value.identity) &&
    isRepositoryRef(value.repository) &&
    isBranchRef(value.branch) &&
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
