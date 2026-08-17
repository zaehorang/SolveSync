import { describe, expect, it } from "vitest";

import { getLanguagePathPolicy, getPlatformPolicy } from "./platformPolicy";

describe("platform policy", () => {
  it("describes LeetCode paths, markers, and labels", () => {
    const policy = getPlatformPolicy("leetcode");

    expect(policy.codingPlatform).toBe("leetcode");
    expect(policy.rootFolder).toBe("leetcode");
    expect(policy.solutionReadmePath).toBe("leetcode/README.md");
    expect(policy.solutionCatalogPath).toBe("leetcode/.leetcode-sync/index.json");
    expect(policy.readmeMarkers).toEqual({
      start: "<!-- LEETCODE_TABLE_START -->",
      end: "<!-- LEETCODE_TABLE_END -->"
    });
    expect(policy.initialReadmeTitle).toBe("LeetCode Solutions");
    expect(policy.commitPlatformLabel).toBe("leetcode");
    expect(getLanguagePathPolicy("leetcode", "swift")).toEqual({
      folder: "leetcode/swift",
      extension: "swift"
    });
  });

  it("describes Programmers paths, markers, and labels", () => {
    const policy = getPlatformPolicy("programmers");

    expect(policy.codingPlatform).toBe("programmers");
    expect(policy.rootFolder).toBe("programmers");
    expect(policy.solutionReadmePath).toBe("programmers/README.md");
    expect(policy.solutionCatalogPath).toBe(
      "programmers/.programmers-sync/index.json"
    );
    expect(policy.readmeIncludesDifficulty).toBe(false);
    expect(policy.readmeMarkers).toEqual({
      start: "<!-- PROGRAMMERS_TABLE_START -->",
      end: "<!-- PROGRAMMERS_TABLE_END -->"
    });
    expect(policy.initialReadmeTitle).toBe("Programmers Solutions");
    expect(policy.commitPlatformLabel).toBe("programmers");
    expect(getLanguagePathPolicy("programmers", "python3")).toEqual({
      folder: "programmers/python",
      extension: "py"
    });
  });

  it("describes SWEA paths, markers, and labels", () => {
    const policy = getPlatformPolicy("swea");

    expect(policy.codingPlatform).toBe("swea");
    expect(policy.rootFolder).toBe("swea");
    expect(policy.solutionReadmePath).toBe("swea/README.md");
    expect(policy.solutionCatalogPath).toBe("swea/.swea-sync/index.json");
    // Difficulty(D1~D7)는 풀이 페이지에 없다. 이것 때문에 추가 요청을 만들지 않는다.
    expect(policy.readmeIncludesDifficulty).toBe(false);
    expect(policy.readmeMarkers).toEqual({
      start: "<!-- SWEA_TABLE_START -->",
      end: "<!-- SWEA_TABLE_END -->"
    });
    expect(policy.initialReadmeTitle).toBe("SW Expert Academy Solutions");
    expect(policy.commitPlatformLabel).toBe("swea");
    expect(getLanguagePathPolicy("swea", "python3")).toEqual({
      folder: "swea/python",
      extension: "py"
    });
  });
});
