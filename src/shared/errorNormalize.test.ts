import { describe, expect, it } from "vitest";

import { MalformedSolutionCatalogError } from "./solutionCatalog";
import { normalizeError, normalizeLeetCodeError } from "./errorNormalize";

describe("error normalization", () => {
  it("passes through already normalized errors", () => {
    const normalized = {
      code: "network_failed" as const,
      userMessage: "Network failed.",
      debugMessage: null,
      retryable: true
    };

    expect(normalizeError(normalized)).toBe(normalized);
  });

  it("normalizes explicit domain error codes", () => {
    expect(normalizeError({ code: "unsupported_language" }).code).toBe(
      "unsupported_language"
    );
    expect(normalizeError({ code: "github_no_accessible_repos" })).toMatchObject({
      code: "github_no_accessible_repos",
      userMessage: "No owned GitHub repositories found."
    });
    expect(normalizeError({ code: "programmers_extract_failed" })).toMatchObject({
      code: "programmers_extract_failed",
      userMessage: "Could not read the Programmers editor code.",
      retryable: false
    });
    expect(normalizeError(new MalformedSolutionCatalogError("bad catalog")).code).toBe(
      "malformed_index"
    );
  });

  it("normalizes common GitHub and network failures", () => {
    expect(normalizeError({ status: 403, message: "API rate limit exceeded" })).toMatchObject({
      code: "github_rate_limited",
      retryable: true
    });
    expect(normalizeError({ status: 429, message: "Too Many Requests" })).toMatchObject({
      code: "github_rate_limited",
      retryable: true
    });
    expect(normalizeError({ status: 404, message: "Branch not found" }).code).toBe(
      "github_branch_not_found"
    );
    expect(normalizeError(new TypeError("Failed to fetch")).code).toBe(
      "network_failed"
    );
  });

  it("normalizes LeetCode auth, fetch, and network failures", () => {
    expect(normalizeLeetCodeError({ status: 403, message: "Please login" })).toMatchObject({
      code: "leetcode_auth_required",
      retryable: false
    });
    expect(normalizeLeetCodeError({ status: 500, message: "Bad response" })).toMatchObject({
      code: "leetcode_fetch_failed",
      retryable: true
    });
    expect(normalizeLeetCodeError(new TypeError("Failed to fetch")).code).toBe(
      "network_failed"
    );
  });
});
