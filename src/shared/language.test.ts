import { describe, expect, it } from "vitest";

import {
  buildSyncDeduplicationKey,
  mapLeetCodeLanguage,
  mapProgrammersLanguage
} from "./language";

describe("LeetCode language mapping", () => {
  it("maps platform labels to supported languages", () => {
    expect(mapLeetCodeLanguage("Swift")).toBe("swift");
    expect(mapLeetCodeLanguage("swift")).toBe("swift");
    expect(mapLeetCodeLanguage("Python3")).toBe("python3");
    expect(mapLeetCodeLanguage("Python 3")).toBe("python3");
    expect(mapLeetCodeLanguage("JavaScript")).toBe("javascript");
    expect(mapLeetCodeLanguage("C++")).toBe("cpp");
    expect(mapLeetCodeLanguage("TypeScript")).toBe("typescript");
    expect(mapLeetCodeLanguage("Kotlin")).toBe("kotlin");
    expect(mapLeetCodeLanguage("Go")).toBe("go");
    expect(mapLeetCodeLanguage("Rust")).toBe("rust");
  });

  it("returns null for unsupported languages", () => {
    expect(mapLeetCodeLanguage("Python")).toBeNull();
    expect(mapLeetCodeLanguage("Ruby")).toBeNull();
  });

  it("maps Programmers raw language labels to supported languages", () => {
    expect(mapProgrammersLanguage("Swift")).toBe("swift");
    expect(mapProgrammersLanguage("swift")).toBe("swift");
    expect(mapProgrammersLanguage("Python3")).toBe("python3");
    expect(mapProgrammersLanguage("Python 3")).toBe("python3");
    expect(mapProgrammersLanguage("Python")).toBeNull();
    expect(mapProgrammersLanguage("JavaScript")).toBe("javascript");
    expect(mapProgrammersLanguage("Java")).toBe("java");
    expect(mapProgrammersLanguage("C++")).toBe("cpp");
    expect(mapProgrammersLanguage("Kotlin")).toBe("kotlin");
    expect(mapProgrammersLanguage("Go")).toBe("go");
    expect(mapProgrammersLanguage("Rust")).toBe("rust");
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
