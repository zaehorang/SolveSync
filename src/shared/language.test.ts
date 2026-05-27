import { describe, expect, it } from "vitest";

import { buildSubmissionIdentity, mapLeetCodeLanguage } from "./language";

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

  it("builds the stable submission identity", () => {
    expect(
      buildSubmissionIdentity({
        submissionId: "123",
        titleSlug: "two-sum",
        language: "Swift"
      })
    ).toEqual({
      submissionId: "123",
      titleSlug: "two-sum",
      language: "swift"
    });
  });
});
