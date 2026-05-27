import {
  isNormalizedError,
  isNormalizedErrorCode,
  type NormalizedError,
  type NormalizedErrorCode
} from "./errors";
import { isPlainRecord } from "./types";

const ERROR_DESCRIPTORS = {
  setup_required: {
    userMessage: "GitHub connection required.",
    retryable: false
  },
  auto_sync_disabled: {
    userMessage: "Auto Sync is off.",
    retryable: false
  },
  unsupported_language: {
    userMessage: "Unsupported language. Swift and Python3 are supported.",
    retryable: false
  },
  leetcode_auth_required: {
    userMessage: "LeetCode login required.",
    retryable: false
  },
  leetcode_fetch_failed: {
    userMessage: "Could not read the LeetCode submission.",
    retryable: true
  },
  github_auth_failed: {
    userMessage: "GitHub authentication failed.",
    retryable: false
  },
  github_token_expired: {
    userMessage: "GitHub token expired.",
    retryable: false
  },
  github_no_accessible_repos: {
    userMessage: "No accessible GitHub repositories found.",
    retryable: false
  },
  github_repo_not_found: {
    userMessage: "GitHub repository not found or not accessible.",
    retryable: false
  },
  github_branch_not_found: {
    userMessage: "GitHub branch not found.",
    retryable: false
  },
  github_default_branch_unavailable: {
    userMessage: "GitHub default branch is unavailable.",
    retryable: false
  },
  github_branch_create_failed: {
    userMessage: "Could not create the GitHub branch.",
    retryable: false
  },
  github_branch_protected: {
    userMessage: "GitHub branch is protected.",
    retryable: false
  },
  github_rate_limited: {
    userMessage: "GitHub rate limit reached.",
    retryable: true
  },
  github_commit_failed: {
    userMessage: "Could not commit the solution to GitHub.",
    retryable: true
  },
  github_conflict_failed: {
    userMessage: "GitHub branch changed during sync.",
    retryable: true
  },
  malformed_index: {
    userMessage: "LeetCode sync index is malformed.",
    retryable: false
  },
  network_failed: {
    userMessage: "Network request failed.",
    retryable: true
  }
} as const satisfies Record<
  NormalizedErrorCode,
  { userMessage: string; retryable: boolean }
>;

export function normalizeError(error: unknown): NormalizedError {
  if (isNormalizedError(error)) {
    return error;
  }

  const explicitCode = getExplicitErrorCode(error);
  if (explicitCode !== null) {
    return buildNormalizedError(explicitCode, getDebugMessage(error));
  }

  const status = getHttpStatus(error);
  const debugMessage = getDebugMessage(error);
  const searchableMessage = debugMessage?.toLowerCase() ?? "";

  if (status === 401) {
    return buildNormalizedError(
      searchableMessage.includes("expired") ? "github_token_expired" : "github_auth_failed",
      debugMessage
    );
  }

  if (status === 403) {
    if (searchableMessage.includes("rate limit")) {
      return buildNormalizedError("github_rate_limited", debugMessage);
    }

    if (searchableMessage.includes("protected")) {
      return buildNormalizedError("github_branch_protected", debugMessage);
    }

    return buildNormalizedError("github_auth_failed", debugMessage);
  }

  if (status === 429) {
    return buildNormalizedError("github_rate_limited", debugMessage);
  }

  if (status === 404) {
    return buildNormalizedError(
      searchableMessage.includes("branch")
        ? "github_branch_not_found"
        : "github_repo_not_found",
      debugMessage
    );
  }

  if (status === 409 || status === 422) {
    return buildNormalizedError("github_conflict_failed", debugMessage);
  }

  if (isNetworkLikeError(error, searchableMessage)) {
    return buildNormalizedError("network_failed", debugMessage);
  }

  return buildNormalizedError("github_commit_failed", debugMessage);
}

export function normalizeLeetCodeError(error: unknown): NormalizedError {
  if (isNormalizedError(error)) {
    return error;
  }

  const explicitCode = getExplicitErrorCode(error);
  if (explicitCode !== null) {
    return buildNormalizedError(explicitCode, getDebugMessage(error));
  }

  const status = getHttpStatus(error);
  const debugMessage = getDebugMessage(error);
  const searchableMessage = debugMessage?.toLowerCase() ?? "";

  if (
    status === 401 ||
    status === 403 ||
    searchableMessage.includes("login") ||
    searchableMessage.includes("auth") ||
    searchableMessage.includes("csrf")
  ) {
    return buildNormalizedError("leetcode_auth_required", debugMessage);
  }

  if (isNetworkLikeError(error, searchableMessage)) {
    return buildNormalizedError("network_failed", debugMessage);
  }

  return buildNormalizedError("leetcode_fetch_failed", debugMessage);
}

function buildNormalizedError(
  code: NormalizedErrorCode,
  debugMessage: string | null
): NormalizedError {
  const descriptor = ERROR_DESCRIPTORS[code];

  return {
    code,
    userMessage: descriptor.userMessage,
    debugMessage,
    retryable: descriptor.retryable
  };
}

function getExplicitErrorCode(error: unknown): NormalizedErrorCode | null {
  if (!isPlainRecord(error)) {
    return null;
  }

  return isNormalizedErrorCode(error.code) ? error.code : null;
}

function getHttpStatus(error: unknown): number | null {
  if (!isPlainRecord(error)) {
    return null;
  }

  if (typeof error.status === "number") {
    return error.status;
  }

  if (isPlainRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status;
  }

  return null;
}

function getDebugMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (isPlainRecord(error)) {
    if (typeof error.message === "string") {
      return error.message;
    }

    if (typeof error.debugMessage === "string") {
      return error.debugMessage;
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

function isNetworkLikeError(error: unknown, searchableMessage: string): boolean {
  return (
    (error instanceof TypeError && searchableMessage.includes("fetch")) ||
    searchableMessage.includes("network") ||
    searchableMessage.includes("failed to fetch")
  );
}
