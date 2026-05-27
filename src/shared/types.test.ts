import { describe, expect, it } from "vitest";

import {
  isPlatform,
  isBranchRef,
  isRepositoryRef,
  isSubmissionIdentity,
  isSupportedLanguage
} from "./types";

describe("shared domain type guards", () => {
  it("guards supported language values", () => {
    expect(isSupportedLanguage("swift")).toBe(true);
    expect(isSupportedLanguage("python3")).toBe(true);
    expect(isSupportedLanguage("javascript")).toBe(false);
  });

  it("guards supported platform values", () => {
    expect(isPlatform("leetcode")).toBe(true);
    expect(isPlatform("programmers")).toBe(true);
    expect(isPlatform("baekjoon")).toBe(false);
  });

  it("guards core GitHub and submission references", () => {
    expect(
      isSubmissionIdentity({
        platform: "leetcode",
        submissionId: "1",
        titleSlug: "two-sum",
        language: "swift"
      })
    ).toBe(true);
    expect(
      isSubmissionIdentity({
        submissionId: "1",
        titleSlug: "two-sum",
        language: "swift"
      })
    ).toBe(false);
    expect(
      isRepositoryRef({
        owner: "example",
        name: "solutions",
        fullName: "example/solutions",
        defaultBranch: "main",
        private: true,
        htmlUrl: "https://github.com/example/solutions"
      })
    ).toBe(true);
    expect(
      isBranchRef({
        name: "main",
        sha: "abc123",
        protected: false
      })
    ).toBe(true);
  });
});
