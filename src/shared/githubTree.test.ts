import { describe, expect, it } from "vitest";

import { buildGitTreeFiles } from "./githubTree";
import { createEmptySolutionCatalog } from "./solutionCatalog";

describe("GitHub tree payload files", () => {
  it("includes solution, README, and Solution Catalog files for one commit", () => {
    const files = buildGitTreeFiles({
      solutionPath: "leetcode/swift/0001_two_sum.swift",
      solutionContent: "class Solution {}",
      solutionReadmePath: "leetcode/README.md",
      readmeContent: "# LeetCode Solutions\n",
      solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
      solutionCatalog: createEmptySolutionCatalog()
    });

    expect(files.map((file) => file.path)).toEqual([
      "leetcode/swift/0001_two_sum.swift",
      "leetcode/README.md",
      "leetcode/.leetcode-sync/index.json"
    ]);
    expect(files[0]?.content).toBe("class Solution {}");
    expect(files[2]?.content).toBe(
      '{\n  "version": 3,\n  "problems": [],\n  "activity": {\n    "days": {}\n  }\n}\n'
    );
  });
});
