import { describe, expect, it } from "vitest";

import {
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

  it("guards core GitHub and submission references", () => {
    expect(
      isSubmissionIdentity({
        submissionId: "1",
        titleSlug: "two-sum",
        language: "swift"
      })
    ).toBe(true);
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
