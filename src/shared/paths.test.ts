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

  it("builds platform-aware LeetCode paths", () => {
    expect(buildSolutionPath("leetcode", problem, "swift")).toBe(
      "leetcode/swift/0001_two_sum.swift"
    );
    expect(buildSolutionPath("leetcode", problem, "python3")).toBe(
      "leetcode/python/0001_two_sum.py"
    );
  });

  it("builds Programmers paths while preserving Korean title text", () => {
    const programmersProblem = {
      problemId: "120804",
      frontendId: "120804",
      title: "두 수의 곱 구하기",
      titleSlug: "120804"
    };

    expect(buildSolutionPath("programmers", programmersProblem, "swift")).toBe(
      "programmers/swift/120804_두_수의_곱_구하기.swift"
    );
    expect(buildSolutionPath("programmers", programmersProblem, "python3")).toBe(
      "programmers/python/120804_두_수의_곱_구하기.py"
    );
  });

  it("normalizes Programmers filename punctuation to underscores", () => {
    const programmersProblem = {
      problemId: "123",
      frontendId: "123",
      title: "A/B 테스트: 두 수?",
      titleSlug: "123"
    };

    expect(buildSolutionPath("programmers", programmersProblem, "swift")).toBe(
      "programmers/swift/123_A_B_테스트_두_수.swift"
    );
  });
});
