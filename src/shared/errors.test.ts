import { describe, expect, it } from "vitest";

import {
  NORMALIZED_ERROR_CODES,
  isNormalizedError,
  isNormalizedErrorCode
} from "./errors";

describe("normalized error contracts", () => {
  it("contains every architecture error code", () => {
    expect(NORMALIZED_ERROR_CODES).toEqual([
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
    ]);
  });

  it("guards known error codes and normalized errors", () => {
    expect(isNormalizedErrorCode("github_rate_limited")).toBe(true);
    expect(isNormalizedErrorCode("unexpected_error")).toBe(false);
    expect(
      isNormalizedError({
        code: "network_failed",
        userMessage: "Network failed.",
        debugMessage: null,
        retryable: true
      })
    ).toBe(true);
  });
});
