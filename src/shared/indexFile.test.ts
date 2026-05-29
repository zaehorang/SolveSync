import { describe, expect, it } from "vitest";

import {
  MalformedIndexError,
  createEmptyIndex,
  mergeIndexEntry,
  parseIndexJson
} from "./indexFile";

const syncedAt = "2026-05-27T04:00:00.000Z";
const acceptedDate = "2026-05-27";

const twoSumSwift = {
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  url: "https://leetcode.com/problems/two-sum/",
  submissionId: "100",
  language: "swift" as const
};

describe("LeetCode sync index", () => {
  it("creates an empty versioned index", () => {
    expect(createEmptyIndex()).toEqual({
      version: 1,
      problems: [],
      activity: {
        days: {}
      }
    });
  });

  it("merges a new entry and overwrites the same problem language", () => {
    const first = mergeIndexEntry(
      createEmptyIndex(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );
    const second = mergeIndexEntry(
      first,
      { ...twoSumSwift, submissionId: "101" },
      "leetcode/swift/0001_two_sum.swift",
      "2026-05-28T04:05:00.000Z",
      "2026-05-28"
    );

    expect(second.problems).toHaveLength(1);
    expect(second.problems[0]).toMatchObject({
      firstAcceptedDate: "2026-05-27",
      lastAcceptedDate: "2026-05-28"
    });
    expect(second.problems[0]?.languages.swift).toEqual({
      solutionPath: "leetcode/swift/0001_two_sum.swift",
      lastSubmissionId: "101",
      lastSyncedAt: "2026-05-28T04:05:00.000Z",
      firstAcceptedDate: "2026-05-27",
      lastAcceptedDate: "2026-05-28"
    });
    expect(second.activity.days).toEqual({
      "2026-05-27": {
        acceptedCount: 1,
        newProblemCount: 1
      },
      "2026-05-28": {
        acceptedCount: 1,
        newProblemCount: 0
      }
    });
  });

  it("preserves another language for the same problem", () => {
    const withSwift = mergeIndexEntry(
      createEmptyIndex(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );
    const withPython = mergeIndexEntry(
      withSwift,
      { ...twoSumSwift, submissionId: "102", language: "python3" },
      "leetcode/python/0001_two_sum.py",
      "2026-05-28T04:10:00.000Z",
      "2026-05-28"
    );

    expect(withPython.problems).toHaveLength(1);
    expect(withPython.problems[0]?.languages.swift?.lastSubmissionId).toBe("100");
    expect(withPython.problems[0]?.languages.python3?.solutionPath).toBe(
      "leetcode/python/0001_two_sum.py"
    );
    expect(withPython.problems[0]).toMatchObject({
      firstAcceptedDate: "2026-05-27",
      lastAcceptedDate: "2026-05-28"
    });
    expect(withPython.problems[0]?.languages.python3).toMatchObject({
      firstAcceptedDate: "2026-05-28",
      lastAcceptedDate: "2026-05-28"
    });
    expect(withPython.activity.days["2026-05-28"]).toEqual({
      acceptedCount: 1,
      newProblemCount: 0
    });
  });

  it("does not increment activity for the same problem language submission id", () => {
    const first = mergeIndexEntry(
      createEmptyIndex(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );
    const second = mergeIndexEntry(
      first,
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      "2026-05-28T04:05:00.000Z",
      "2026-05-28"
    );

    expect(second.activity.days).toEqual({
      "2026-05-27": {
        acceptedCount: 1,
        newProblemCount: 1
      }
    });
    expect(second.problems[0]?.languages.swift).toMatchObject({
      lastSyncedAt: syncedAt,
      firstAcceptedDate: "2026-05-27",
      lastAcceptedDate: "2026-05-27"
    });
  });

  it("parses a valid index and rejects malformed JSON", () => {
    const index = mergeIndexEntry(
      createEmptyIndex(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );

    expect(parseIndexJson(JSON.stringify(index))).toEqual(index);
    expect(() => parseIndexJson("{")).toThrow(MalformedIndexError);
    expect(() => parseIndexJson(JSON.stringify({ version: 1, problems: [] }))).toThrow(
      MalformedIndexError
    );
  });
});
