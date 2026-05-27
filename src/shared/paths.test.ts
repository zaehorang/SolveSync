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

    expect(path).toBe("swift/leetcode/0001_two_sum.swift");
    expect(path).not.toContain("swift/SwiftAlgorithm");
  });

  it("builds Python3 paths under the python leetcode folder", () => {
    expect(buildSolutionPath(problem, "python3")).toBe(
      "python/leetcode/0001_two_sum.py"
    );
  });
});
