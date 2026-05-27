import type { NormalizedError } from "./errors";

export type IsoDateString = string;

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
  identity: SubmissionIdentity;
  repository: RepositoryRef;
  branch: BranchRef;
  problem: ProblemMetadata;
  submission: AcceptedSubmission;
  solutionPath: string;
  readmePath: "README.md";
  indexPath: ".leetcode-sync/index.json";
  commitMessage: string;
  attempts: number;
  createdAt: IsoDateString;
  expiresAt: IsoDateString;
  lastError: NormalizedError | null;
}

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "swift" || value === "python3";
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSubmissionIdentity(value: unknown): value is SubmissionIdentity {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
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
