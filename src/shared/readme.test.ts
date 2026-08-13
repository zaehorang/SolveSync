import { describe, expect, it } from "vitest";

import {
  createEmptySolutionCatalog,
  mergeSolutionCatalogEntry
} from "./solutionCatalog";
import {
  PROGRAMMERS_README_TABLE_END_MARKER,
  PROGRAMMERS_README_TABLE_START_MARKER,
  README_TABLE_END_MARKER,
  README_TABLE_START_MARKER,
  buildInitialReadme,
  mergeReadmeManagedBlock,
  renderManagedReadmeTable
} from "./readme";

const solutionCatalog = mergeSolutionCatalogEntry(
  mergeSolutionCatalogEntry(
    createEmptySolutionCatalog(),
    {
      problemId: "2",
      frontendId: "2",
      title: "Add Two Numbers",
      titleSlug: "add-two-numbers",
      difficulty: "Medium",
      url: "https://leetcode.com/problems/add-two-numbers/",
      acceptedSourceId: "200",
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
    acceptedSourceId: "100",
    language: "swift"
  },
  "leetcode/swift/0001_two_sum.swift",
  "2026-05-27T04:05:00.000Z",
  "2026-05-27"
);

describe("README managed block", () => {
  it("renders rows sorted by numeric problem id", () => {
    const table = renderManagedReadmeTable(solutionCatalog);

    expect(table).toContain("| # | Title | Difficulty | Solved | Languages |");
    expect(table.indexOf("| 1 | Two Sum")).toBeLessThan(
      table.indexOf("| 2 | Add Two Numbers")
    );
    expect(table).toContain("| 1 | Two Sum | Easy | 2026-05-27 |");
    expect(table).toContain("[Swift](swift/0001_two_sum.swift)");
    expect(table).toContain("[Python3](python/0002_add_two_numbers.py)");
  });

  it("renders every solution for one problem in a single Languages cell", () => {
    const javaCatalog = mergeSolutionCatalogEntry(
      solutionCatalog,
      {
        problemId: "1",
        frontendId: "1",
        title: "Two Sum",
        titleSlug: "two-sum",
        difficulty: "Easy",
        url: "https://leetcode.com/problems/two-sum/",
        acceptedSourceId: "101",
        language: "java"
      },
      "leetcode/java/0001_two_sum.java",
      "2026-05-28T04:05:00.000Z",
      "2026-05-28"
    );
    const table = renderManagedReadmeTable(javaCatalog);
    const twoSumRow = table
      .split("\n")
      .find((line) => line.includes("| 1 | Two Sum"));

    expect(twoSumRow).toContain(
      "[Swift](swift/0001_two_sum.swift) · [Java](java/0001_two_sum.java)"
    );
    expect(twoSumRow?.split("|")).toHaveLength(7);
  });

  it("replaces only the existing managed marker block", () => {
    const table = renderManagedReadmeTable(solutionCatalog);
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
    const programmersCatalog = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      {
        problemId: "120804",
        frontendId: "120804",
        title: "두 수의 곱 구하기",
        titleSlug: "120804",
        difficulty: "-",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        acceptedSourceId: "programmers:120804:swift:abc",
        language: "swift"
      },
      "programmers/swift/120804_두_수의_곱_구하기.swift",
      "2026-05-27T04:05:00.000Z",
      "2026-05-27"
    );
    const table = renderManagedReadmeTable(programmersCatalog, "programmers");
    const readme = buildInitialReadme(table, "programmers");

    expect(table).toContain("| # | Title | Solved | Languages |");
    expect(table).not.toContain("Difficulty");
    expect(table).toContain("| 120804 | 두 수의 곱 구하기 | 2026-05-27 |");
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

  it("migrates a legacy LeetCode table without changing content outside markers", () => {
    const before = "# Custom\n\n수동 소개  \n";
    const after = "\n수동 꼬리말\n";
    const legacyTable = [
      "| # | Title | Difficulty | Solved | Swift | Python |",
      "| ---: | --- | --- | --- | --- | --- |",
      "| 1 | Two Sum | Easy | 2026-05-27 | [Swift](swift/0001_two_sum.swift) | - |"
    ].join("\n");
    const existing = `${before}${README_TABLE_START_MARKER}\n${legacyTable}\n${README_TABLE_END_MARKER}${after}`;
    const table = renderManagedReadmeTable(solutionCatalog);
    const merged = mergeReadmeManagedBlock(existing, table);

    expect(merged.slice(0, before.length)).toBe(before);
    expect(merged.slice(-after.length)).toBe(after);
    expect(merged).not.toContain("| Swift | Python |");
    expect(merged).toContain("| # | Title | Difficulty | Solved | Languages |");
  });

  it("renders the same managed README repeatedly", () => {
    const table = renderManagedReadmeTable(solutionCatalog);
    const first = mergeReadmeManagedBlock(null, table);
    const second = mergeReadmeManagedBlock(first, table);

    expect(second).toBe(first);
  });
});
