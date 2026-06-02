import { describe, expect, it } from "vitest";

import {
  buildSyncDeduplicationKey,
  mapLeetCodeLanguage,
  mapProgrammersLanguage
} from "./language";

describe("LeetCode language mapping", () => {
  it("maps Swift and Python3 to supported languages", () => {
    expect(mapLeetCodeLanguage("Swift")).toBe("swift");
    expect(mapLeetCodeLanguage("swift")).toBe("swift");
    expect(mapLeetCodeLanguage("Python3")).toBe("python3");
    expect(mapLeetCodeLanguage("Python 3")).toBe("python3");
  });

  it("returns null for unsupported languages", () => {
    expect(mapLeetCodeLanguage("JavaScript")).toBeNull();
    expect(mapLeetCodeLanguage("Python")).toBeNull();
  });

  it("maps Programmers raw language labels to supported languages", () => {
    expect(mapProgrammersLanguage("Swift")).toBe("swift");
    expect(mapProgrammersLanguage("swift")).toBe("swift");
    expect(mapProgrammersLanguage("Python3")).toBe("python3");
    expect(mapProgrammersLanguage("Python 3")).toBe("python3");
    expect(mapProgrammersLanguage("Python")).toBeNull();
    expect(mapProgrammersLanguage("JavaScript")).toBeNull();
  });

  it("builds the stable Sync Deduplication Key", () => {
    expect(
      buildSyncDeduplicationKey({
        codingPlatform: "leetcode",
        acceptedSourceId: "123",
        titleSlug: "two-sum",
        language: "Swift"
      })
    ).toEqual({
      codingPlatform: "leetcode",
      acceptedSourceId: "123",
      titleSlug: "two-sum",
      language: "swift"
    });
  });
});
