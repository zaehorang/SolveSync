import { describe, expect, it } from "vitest";

import { buildSolutionPath } from "./paths";

const problem = {
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum"
};

describe("solution path generation", () => {
  it("builds Swift paths outside of the Xcode source folder", () => {
    const path = buildSolutionPath(problem, "swift");

    expect(path).toBe("leetcode/swift/0001_two_sum.swift");
    expect(path).not.toContain("swift/SwiftAlgorithm");
  });

  it("builds Python3 paths under the leetcode python folder", () => {
    expect(buildSolutionPath(problem, "python3")).toBe(
      "leetcode/python/0001_two_sum.py"
    );
  });
});
