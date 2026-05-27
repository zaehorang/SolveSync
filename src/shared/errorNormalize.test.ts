import { describe, expect, it } from "vitest";

import { MalformedIndexError } from "./indexFile";
import { normalizeError } from "./errorNormalize";

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
    expect(normalizeError(new MalformedIndexError("bad index")).code).toBe(
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
});
