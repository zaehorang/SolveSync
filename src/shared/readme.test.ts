import { describe, expect, it } from "vitest";

import { createEmptyIndex, mergeIndexEntry } from "./indexFile";
import {
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
    "python/leetcode/0002_add_two_numbers.py",
    "2026-05-27T04:00:00.000Z"
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
  "swift/leetcode/0001_two_sum.swift",
  "2026-05-27T04:05:00.000Z"
);

describe("README managed block", () => {
  it("renders rows sorted by numeric problem id", () => {
    const table = renderManagedReadmeTable(index);

    expect(table).toContain("| # | Title | Difficulty | Swift | Python |");
    expect(table.indexOf("| 1 | Two Sum")).toBeLessThan(
      table.indexOf("| 2 | Add Two Numbers")
    );
    expect(table).toContain("[Swift](swift/leetcode/0001_two_sum.swift)");
    expect(table).toContain("[Python](python/leetcode/0002_add_two_numbers.py)");
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
});
