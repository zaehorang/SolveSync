export const NORMALIZED_ERROR_CODES = [
  "setup_required",
  "auto_sync_disabled",
  "unsupported_language",
  "leetcode_auth_required",
  "leetcode_fetch_failed",
  "github_auth_failed",
  "github_token_expired",
  "github_no_accessible_repos",
  "github_repo_not_found",
  "github_branch_not_found",
  "github_default_branch_unavailable",
  "github_branch_create_failed",
  "github_branch_protected",
  "github_rate_limited",
  "github_commit_failed",
  "github_conflict_failed",
  "malformed_index",
  "network_failed"
] as const;

export type NormalizedErrorCode = (typeof NORMALIZED_ERROR_CODES)[number];

export interface NormalizedError {
  code: NormalizedErrorCode;
  userMessage: string;
  debugMessage: string | null;
  retryable: boolean;
}

export function isNormalizedErrorCode(value: unknown): value is NormalizedErrorCode {
  return (
    typeof value === "string" &&
    (NORMALIZED_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function isNormalizedError(value: unknown): value is NormalizedError {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNormalizedErrorCode(value.code) &&
    typeof value.userMessage === "string" &&
    (typeof value.debugMessage === "string" || value.debugMessage === null) &&
    typeof value.retryable === "boolean"
  );
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
