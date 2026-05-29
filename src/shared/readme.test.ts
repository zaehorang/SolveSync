import { describe, expect, it } from "vitest";

import { createEmptyIndex, mergeIndexEntry } from "./indexFile";
import {
  PROGRAMMERS_README_TABLE_END_MARKER,
  PROGRAMMERS_README_TABLE_START_MARKER,
  README_TABLE_END_MARKER,
  README_TABLE_START_MARKER,
  buildInitialReadme,
  mergeReadmeManagedBlock,
  renderManagedReadmeTable
} from "./readme";

const index = mergeIndexEntry(
  mergeIndexEntry(
    createEmptyIndex(),
    {
      problemId: "2",
      frontendId: "2",
      title: "Add Two Numbers",
      titleSlug: "add-two-numbers",
      difficulty: "Medium",
      url: "https://leetcode.com/problems/add-two-numbers/",
      submissionId: "200",
      language: "python3"
    },
    "leetcode/python/0002_add_two_numbers.py",
    "2026-05-27T04:00:00.000Z",
    "2026-05-27"
  ),
  {
    problemId: "1",
    frontendId: "1",
    title: "Two Sum",
    titleSlug: "two-sum",
    difficulty: "Easy",
    url: "https://leetcode.com/problems/two-sum/",
    submissionId: "100",
    language: "swift"
  },
  "leetcode/swift/0001_two_sum.swift",
  "2026-05-27T04:05:00.000Z",
  "2026-05-27"
);

describe("README managed block", () => {
  it("renders rows sorted by numeric problem id", () => {
    const table = renderManagedReadmeTable(index);

    expect(table).toContain("| # | Title | Difficulty | Solved | Swift | Python |");
    expect(table.indexOf("| 1 | Two Sum")).toBeLessThan(
      table.indexOf("| 2 | Add Two Numbers")
    );
    expect(table).toContain("| 1 | Two Sum | Easy | 2026-05-27 |");
    expect(table).toContain("[Swift](swift/0001_two_sum.swift)");
    expect(table).toContain("[Python](python/0002_add_two_numbers.py)");
  });

  it("replaces only the existing managed marker block", () => {
    const table = renderManagedReadmeTable(index);
    const merged = mergeReadmeManagedBlock(
      [
        "# Custom README",
        "",
        "Keep this introduction.",
        README_TABLE_START_MARKER,
        "old table",
        README_TABLE_END_MARKER,
        "",
        "Keep this footer."
      ].join("\n"),
      table
    );

    expect(merged).toContain("Keep this introduction.");
    expect(merged).toContain("Keep this footer.");
    expect(merged).not.toContain("old table");
    expect(merged).toContain(table);
  });

  it("appends a marker block when the README has no markers", () => {
    const merged = mergeReadmeManagedBlock("# Existing\n\nManual notes.\n", "table");

    expect(merged).toBe(
      [
        "# Existing",
        "",
        "Manual notes.",
        "",
        README_TABLE_START_MARKER,
        "table",
        README_TABLE_END_MARKER,
        ""
      ].join("\n")
    );
  });

  it("builds a minimal README when no README exists", () => {
    const readme = buildInitialReadme("table");

    expect(readme).toContain("# LeetCode Solutions");
    expect(readme).toContain(README_TABLE_START_MARKER);
    expect(readme).toContain(README_TABLE_END_MARKER);
    expect(mergeReadmeManagedBlock(null, "table")).toBe(readme);
  });

  it("uses Programmers markers and relative solution links when policy is provided", () => {
    const programmersIndex = mergeIndexEntry(
      createEmptyIndex(),
      {
        problemId: "120804",
        frontendId: "120804",
        title: "두 수의 곱 구하기",
        titleSlug: "120804",
        difficulty: "-",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        submissionId: "programmers:120804:swift:abc",
        language: "swift"
      },
      "programmers/swift/120804_두_수의_곱_구하기.swift",
      "2026-05-27T04:05:00.000Z",
      "2026-05-27"
    );
    const table = renderManagedReadmeTable(programmersIndex, "programmers");
    const readme = buildInitialReadme(table, "programmers");

    expect(table).toContain("| 120804 | 두 수의 곱 구하기 | - | 2026-05-27 |");
    expect(table).toContain("[Swift](swift/120804_두_수의_곱_구하기.swift)");
    expect(readme).toContain("# Programmers Solutions");
    expect(readme).toContain(PROGRAMMERS_README_TABLE_START_MARKER);
    expect(readme).toContain(PROGRAMMERS_README_TABLE_END_MARKER);
  });

  it("replaces only the Programmers marker block", () => {
    const merged = mergeReadmeManagedBlock(
      [
        "# Custom",
        README_TABLE_START_MARKER,
        "leetcode table",
        README_TABLE_END_MARKER,
        PROGRAMMERS_README_TABLE_START_MARKER,
        "old programmers table",
        PROGRAMMERS_README_TABLE_END_MARKER
      ].join("\n"),
      "new programmers table",
      "programmers"
    );

    expect(merged).toContain("leetcode table");
    expect(merged).not.toContain("old programmers table");
    expect(merged).toContain("new programmers table");
  });
});
