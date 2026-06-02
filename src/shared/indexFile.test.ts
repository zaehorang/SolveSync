import { describe, expect, it } from "vitest";

import {
  MalformedSolutionCatalogError,
  createEmptySolutionCatalog,
  mergeSolutionCatalogEntry,
  parseSolutionCatalogJson
} from "./solutionCatalog";

const syncedAt = "2026-05-27T04:00:00.000Z";
const acceptedDate = "2026-05-27";

const twoSumSwift = {
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  url: "https://leetcode.com/problems/two-sum/",
  acceptedSourceId: "100",
  language: "swift" as const
};

describe("Solution Catalog", () => {
  it("creates an empty versioned catalog", () => {
    expect(createEmptySolutionCatalog()).toEqual({
      version: 2,
      problems: [],
      activity: {
        days: {}
      }
    });
  });

  it("merges a new entry and overwrites the same problem language", () => {
    const first = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );
    const second = mergeSolutionCatalogEntry(
      first,
      { ...twoSumSwift, acceptedSourceId: "101" },
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
      lastAcceptedSourceId: "101",
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
    const withSwift = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );
    const withPython = mergeSolutionCatalogEntry(
      withSwift,
      { ...twoSumSwift, acceptedSourceId: "102", language: "python3" },
      "leetcode/python/0001_two_sum.py",
      "2026-05-28T04:10:00.000Z",
      "2026-05-28"
    );

    expect(withPython.problems).toHaveLength(1);
    expect(withPython.problems[0]?.languages.swift?.lastAcceptedSourceId).toBe("100");
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

  it("does not increment activity for the same problem language accepted source id", () => {
    const first = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );
    const second = mergeSolutionCatalogEntry(
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

  it("parses a valid catalog and rejects malformed JSON", () => {
    const catalog = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );

    expect(parseSolutionCatalogJson(JSON.stringify(catalog))).toEqual(catalog);
    expect(() => parseSolutionCatalogJson("{")).toThrow(MalformedSolutionCatalogError);
    expect(() =>
      parseSolutionCatalogJson(JSON.stringify({ version: 2, problems: [] }))
    ).toThrow(MalformedSolutionCatalogError);
  });

  it("normalizes v1 lastSubmissionId language entries to v2 lastAcceptedSourceId", () => {
    const parsed = parseSolutionCatalogJson(
      JSON.stringify({
        version: 1,
        problems: [
          {
            problemId: "1",
            frontendId: "1",
            title: "Two Sum",
            titleSlug: "two-sum",
            difficulty: "Easy",
            url: "https://leetcode.com/problems/two-sum/",
            lastSyncedAt: syncedAt,
            firstAcceptedDate: acceptedDate,
            lastAcceptedDate: acceptedDate,
            languages: {
              swift: {
                solutionPath: "leetcode/swift/0001_two_sum.swift",
                lastSubmissionId: "legacy-100",
                lastSyncedAt: syncedAt,
                firstAcceptedDate: acceptedDate,
                lastAcceptedDate: acceptedDate
              }
            }
          }
        ],
        activity: {
          days: {
            [acceptedDate]: {
              acceptedCount: 1,
              newProblemCount: 1
            }
          }
        }
      })
    );

    expect(parsed).toMatchObject({
      version: 2,
      problems: [
        {
          languages: {
            swift: {
              lastAcceptedSourceId: "legacy-100"
            }
          }
        }
      ]
    });
    expect(JSON.stringify(parsed)).not.toContain("lastSubmissionId");
  });

  it("writes v2 lastAcceptedSourceId without lastSubmissionId", () => {
    const catalog = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      twoSumSwift,
      "leetcode/swift/0001_two_sum.swift",
      syncedAt,
      acceptedDate
    );

    const serialized = JSON.stringify(catalog);

    expect(serialized).toContain("lastAcceptedSourceId");
    expect(serialized).not.toContain("lastSubmissionId");
    expect(catalog.version).toBe(2);
  });
});
