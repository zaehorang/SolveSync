import { describe, expect, it } from "vitest";

import {
  isCodingPlatform,
  isSyncBranch,
  isSyncRepository,
  isSyncDeduplicationKey,
  isSyncHistoryEntry,
  isSupportedLanguage
} from "./types";

describe("shared domain type guards", () => {
  it("guards supported language values", () => {
    expect(isSupportedLanguage("swift")).toBe(true);
    expect(isSupportedLanguage("python3")).toBe(true);
    expect(isSupportedLanguage("javascript")).toBe(false);
  });

  it("guards supported platform values", () => {
    expect(isCodingPlatform("leetcode")).toBe(true);
    expect(isCodingPlatform("programmers")).toBe(true);
    expect(isCodingPlatform("baekjoon")).toBe(false);
  });

  it("guards core GitHub and sync deduplication key references", () => {
    expect(
      isSyncDeduplicationKey({
        codingPlatform: "leetcode",
        acceptedSourceId: "1",
        titleSlug: "two-sum",
        language: "swift"
      })
    ).toBe(true);
    expect(
      isSyncDeduplicationKey({
        submissionId: "1",
        titleSlug: "two-sum",
        language: "swift"
      })
    ).toBe(false);
    expect(
      isSyncRepository({
        owner: "example",
        name: "solutions",
        fullName: "example/solutions",
        defaultBranch: "main",
        private: true,
        htmlUrl: "https://github.com/example/solutions"
      })
    ).toBe(true);
    expect(
      isSyncBranch({
        name: "main",
        sha: "abc123",
        protected: false
      })
    ).toBe(true);
  });

  it("accepts v4 Sync History shape and rejects legacy-only shape", () => {
    expect(
      isSyncHistoryEntry({
        id: "record-1",
        codingPlatform: "leetcode",
        status: "synced",
        titleSlug: "two-sum",
        problemTitle: "Two Sum",
        problemFrontendId: "1",
        language: "Swift",
        supportedLanguage: "swift",
        syncDeduplicationKey: {
          codingPlatform: "leetcode",
          acceptedSourceId: "123",
          titleSlug: "two-sum",
          language: "swift"
        },
        repository: null,
        branchName: null,
        solutionPath: "leetcode/swift/0001_two_sum.swift",
        commitSha: "commit-sha",
        commitUrl: null,
        fileUrl: null,
        error: null,
        retryPayloadId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      })
    ).toBe(true);

    expect(
      isSyncHistoryEntry({
        id: "record-legacy",
        platform: "leetcode",
        status: "synced",
        titleSlug: "two-sum",
        problemTitle: "Two Sum",
        problemFrontendId: "1",
        language: "Swift",
        supportedLanguage: "swift",
        identity: {
          platform: "leetcode",
          submissionId: "123",
          titleSlug: "two-sum",
          language: "swift"
        },
        repository: null,
        branchName: null,
        solutionPath: "leetcode/swift/0001_two_sum.swift",
        commitSha: "commit-sha",
        commitUrl: null,
        fileUrl: null,
        error: null,
        retryPayloadId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      })
    ).toBe(false);
  });
});
