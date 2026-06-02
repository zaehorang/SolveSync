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
});
