import { describe, expect, it } from "vitest";

import { buildGitTreeFiles } from "./githubTree";
import { createEmptyIndex } from "./indexFile";

describe("GitHub tree payload files", () => {
  it("includes solution, README, and index files for one commit", () => {
    const files = buildGitTreeFiles({
      solutionPath: "leetcode/swift/0001_two_sum.swift",
      solutionContent: "class Solution {}",
      readmePath: "leetcode/README.md",
      readmeContent: "# LeetCode Solutions\n",
      indexPath: "leetcode/.leetcode-sync/index.json",
      index: createEmptyIndex()
    });

    expect(files.map((file) => file.path)).toEqual([
      "leetcode/swift/0001_two_sum.swift",
      "leetcode/README.md",
      "leetcode/.leetcode-sync/index.json"
    ]);
    expect(files[0]?.content).toBe("class Solution {}");
    expect(files[2]?.content).toBe('{\n  "version": 1,\n  "problems": []\n}\n');
  });
});
