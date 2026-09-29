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

function withProblem(
  catalog: Parameters<typeof mergeSolutionCatalogEntry>[0],
  frontendId: string,
  title: string,
  acceptedDate: string
) {
  return mergeSolutionCatalogEntry(
    catalog,
    {
      problemId: frontendId,
      frontendId,
      title,
      titleSlug: `slug-${frontendId}`,
      difficulty: "Easy",
      url: `https://leetcode.com/problems/slug-${frontendId}/`,
      acceptedSourceId: `source-${frontendId}`,
      language: "swift"
    },
    `leetcode/swift/${frontendId}.swift`,
    `${acceptedDate}T04:00:00.000Z`,
    acceptedDate
  );
}

describe("README managed block", () => {
  it("renders rows newest solved first", () => {
    // 표는 풀이 기록이므로 최근에 푼 문제가 위에 온다. 정렬 키는 Solved cell이
    // 실제로 보여주는 first accepted date여야 표가 자기모순 없이 읽힌다.
    const catalog = withProblem(
      withProblem(
        withProblem(createEmptySolutionCatalog(), "10", "Oldest", "2026-05-01"),
        "20",
        "Newest",
        "2026-07-01"
      ),
      "30",
      "Middle",
      "2026-06-01"
    );
    const table = renderManagedReadmeTable(catalog);

    expect(table.indexOf("| 20 | [Newest]")).toBeLessThan(table.indexOf("| 30 | [Middle]"));
    expect(table.indexOf("| 30 | [Middle]")).toBeLessThan(table.indexOf("| 10 | [Oldest]"));
  });

  it("breaks same-day ties by problem number so re-renders are stable", () => {
    // first accepted date는 day 단위라 같은 날 푼 문제가 묶인다. tiebreak가
    // 없으면 재렌더마다 순서가 흔들려 의미 없는 diff가 생긴다.
    const catalog = withProblem(
      withProblem(createEmptySolutionCatalog(), "200", "Later Number", "2026-05-01"),
      "100",
      "Earlier Number",
      "2026-05-01"
    );
    const table = renderManagedReadmeTable(catalog);

    expect(table.indexOf("| 100 | [Earlier Number]")).toBeLessThan(
      table.indexOf("| 200 | [Later Number]")
    );
  });

  describe("same-day order by latest sync", () => {
    function syncedProblem(
      catalog: Parameters<typeof mergeSolutionCatalogEntry>[0],
      frontendId: string,
      acceptedDate: string,
      syncedAt: string,
      language: "swift" | "python3" = "swift"
    ) {
      return mergeSolutionCatalogEntry(
        catalog,
        {
          problemId: frontendId,
          frontendId,
          title: `Problem ${frontendId}`,
          titleSlug: `slug-${frontendId}`,
          difficulty: "Easy",
          url: `https://leetcode.com/problems/slug-${frontendId}/`,
          acceptedSourceId: `source-${frontendId}-${syncedAt}-${language}`,
          language
        },
        `leetcode/${language}/${frontendId}`,
        syncedAt,
        acceptedDate
      );
    }

    function rowOrder(table: string): string[] {
      return table
        .split("\n")
        .slice(2)
        .map((row) => row.split("|")[1].trim());
    }

    function corruptLastSyncedAt(
      catalog: ReturnType<typeof syncedProblem>,
      frontendId: string,
      value: unknown
    ) {
      return {
        ...catalog,
        problems: catalog.problems.map((problem) =>
          problem.frontendId === frontendId
            ? {
                ...problem,
                lastSyncedAt: value as string,
                languages: Object.fromEntries(
                  Object.entries(problem.languages).map(([key, entry]) => [
                    key,
                    { ...entry, lastSyncedAt: value as string }
                  ])
                )
              }
            : problem
        )
      } as typeof catalog;
    }

    const day = "2026-09-29";

    it("puts the most recently synced problem first within a day even with the largest number", () => {
      let catalog = syncedProblem(createEmptySolutionCatalog(), "42576", day, "2026-09-29T01:00:00.000Z");
      catalog = syncedProblem(catalog, "42888", day, "2026-09-29T02:00:00.000Z");
      catalog = syncedProblem(catalog, "157342", day, "2026-09-29T03:00:00.000Z");

      expect(rowOrder(renderManagedReadmeTable(catalog))).toEqual(["157342", "42888", "42576"]);
    });

    it("keeps date-descending order across days regardless of sync time", () => {
      let catalog = syncedProblem(createEmptySolutionCatalog(), "1", "2026-09-28", "2026-09-28T23:00:00.000Z");
      catalog = syncedProblem(catalog, "2", "2026-09-29", "2026-09-29T01:00:00.000Z");
      catalog = syncedProblem(catalog, "3", "2026-09-27", "2026-09-30T01:00:00.000Z");

      expect(rowOrder(renderManagedReadmeTable(catalog))).toEqual(["2", "1", "3"]);
    });

    it("breaks equal sync times by problem number", () => {
      const at = "2026-09-29T01:00:00.000Z";
      let catalog = syncedProblem(createEmptySolutionCatalog(), "300", day, at);
      catalog = syncedProblem(catalog, "100", day, at);
      catalog = syncedProblem(catalog, "200", day, at);

      expect(rowOrder(renderManagedReadmeTable(catalog))).toEqual(["100", "200", "300"]);
    });

    it("uses the latest sync among a problem's language entries", () => {
      let catalog = syncedProblem(createEmptySolutionCatalog(), "10", day, "2026-09-29T01:00:00.000Z");
      catalog = syncedProblem(catalog, "20", day, "2026-09-29T02:00:00.000Z");
      // 10번을 다른 언어로 나중에 다시 풀면 10번의 최댓값이 20번보다 늦어진다.
      catalog = syncedProblem(catalog, "10", day, "2026-09-29T03:00:00.000Z", "python3");

      expect(rowOrder(renderManagedReadmeTable(catalog))).toEqual(["10", "20"]);
    });

    it("sorts entries with missing or unparsable lastSyncedAt after parsable ones within the day", () => {
      let catalog = syncedProblem(createEmptySolutionCatalog(), "10", day, "2026-09-29T01:00:00.000Z");
      catalog = syncedProblem(catalog, "20", day, "2026-09-29T02:00:00.000Z");
      catalog = syncedProblem(catalog, "30", day, "2026-09-29T03:00:00.000Z");
      catalog = syncedProblem(catalog, "40", day, "2026-09-29T04:00:00.000Z");
      catalog = corruptLastSyncedAt(catalog, "40", undefined);
      catalog = corruptLastSyncedAt(catalog, "30", "not-a-date");

      // 파싱되는 값이 먼저, 누락과 파싱 불가는 같은 값으로 보고 번호 순으로 뒤에 둔다.
      expect(rowOrder(renderManagedReadmeTable(catalog))).toEqual(["20", "10", "30", "40"]);
    });

    it("renders the same order for Programmers and SWEA catalogs", () => {
      for (const platform of ["programmers", "swea"] as const) {
        let catalog = syncedProblem(createEmptySolutionCatalog(), "1", day, "2026-09-29T01:00:00.000Z");
        catalog = syncedProblem(catalog, "2", day, "2026-09-29T02:00:00.000Z");

        expect(rowOrder(renderManagedReadmeTable(catalog, platform))).toEqual(["2", "1"]);
      }
    });
  });

  it("links the title to the problem page", () => {
    const table = renderManagedReadmeTable(solutionCatalog);

    expect(table).toContain("[Two Sum](https://leetcode.com/problems/two-sum/)");
  });

  it("drops the language query Programmers leaves on the problem URL", () => {
    // Catalog의 url은 Accepted를 감지한 순간 보고 있던 page URL이라 그때의 언어가
    // `?language=python3`로 남는다. 문제를 가리키는 데 필요한 부분이 아니다.
    const catalog = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      {
        problemId: "12985",
        frontendId: "12985",
        title: "예상 대진표",
        titleSlug: "12985_예상_대진표",
        difficulty: "-",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/12985?language=cpp",
        acceptedSourceId: "programmers:12985:cpp:1",
        language: "cpp"
      },
      "programmers/cpp/12985_예상_대진표.cpp",
      "2026-08-23T04:00:00.000Z",
      "2026-08-23"
    );

    expect(renderManagedReadmeTable(catalog, "programmers")).toContain(
      "[예상 대진표](https://school.programmers.co.kr/learn/courses/30/lessons/12985)"
    );
  });

  it("builds a SWEA problem link from the contest problem id", () => {
    // SWEA는 Accepted를 감지하는 page가 문제와 무관한 solvingProblem.do라
    // Catalog의 url이 모든 문제에서 같다. 저장된 url로는 링크를 만들 수 없다.
    const catalog = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      {
        problemId: "AV5LrsUaDxcDFAXc",
        frontendId: "1859",
        title: "백만 장자 프로젝트",
        titleSlug: "1859_백만_장자_프로젝트",
        difficulty: "-",
        url: "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do",
        acceptedSourceId: "swea:AV5LrsUaDxcDFAXc:python3:1",
        language: "python3"
      },
      "swea/python/1859_백만_장자_프로젝트.py",
      "2026-08-18T04:00:00.000Z",
      "2026-08-18"
    );

    expect(renderManagedReadmeTable(catalog, "swea")).toContain(
      "[백만 장자 프로젝트](https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=AV5LrsUaDxcDFAXc)"
    );
  });

  it("renders a plain title when there is no usable problem URL", () => {
    const catalog = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      {
        problemId: "1",
        frontendId: "1",
        title: "Two Sum",
        titleSlug: "two-sum",
        difficulty: "Easy",
        url: "",
        acceptedSourceId: "100",
        language: "swift"
      },
      "leetcode/swift/0001_two_sum.swift",
      "2026-05-27T04:00:00.000Z",
      "2026-05-27"
    );

    expect(renderManagedReadmeTable(catalog)).toContain("| 1 | Two Sum | Easy |");
  });

  it("renders the expected columns and links", () => {
    const table = renderManagedReadmeTable(solutionCatalog);

    expect(table).toContain("| # | Title | Difficulty | Solved | Languages |");
    expect(table).toContain("| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | 2026-05-27 |");
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
      .find((line) => line.includes("| 1 | [Two Sum]"));

    expect(twoSumRow).toContain(
      "[Swift](swift/0001_two_sum.swift) · [Java](java/0001_two_sum.java)"
    );
    expect(twoSumRow?.split("|")).toHaveLength(7);
  });

  it("keeps MySQL and Oracle solutions of one problem side by side in registry order", () => {
    const base = {
      problemId: "59034",
      frontendId: "59034",
      title: "모든 레코드 조회하기",
      titleSlug: "59034",
      difficulty: "",
      url: "https://school.programmers.co.kr/learn/courses/30/lessons/59034"
    };
    // 등록 순서(mysql → oracle)와 반대로 넣어도 셀 순서는 registry를 따른다.
    const withOracle = mergeSolutionCatalogEntry(
      createEmptySolutionCatalog(),
      { ...base, acceptedSourceId: "1", language: "oracle" },
      "programmers/oracle/59034_모든_레코드_조회하기.sql",
      "2026-09-29T04:00:00.000Z",
      "2026-09-29"
    );
    const both = mergeSolutionCatalogEntry(
      withOracle,
      { ...base, acceptedSourceId: "2", language: "mysql" },
      "programmers/mysql/59034_모든_레코드_조회하기.sql",
      "2026-09-29T04:05:00.000Z",
      "2026-09-29"
    );

    expect(both.problems).toHaveLength(1);
    expect(Object.keys(both.problems[0]?.languages ?? {}).sort()).toEqual([
      "mysql",
      "oracle"
    ]);

    const row = renderManagedReadmeTable(both, "programmers")
      .split("\n")
      .find((line) => line.includes("59034"));

    expect(row).toMatch(/\[MySQL\]\(mysql\/59034_[^)]+\.sql\) · \[Oracle\]\(oracle\/59034_[^)]+\.sql\)/u);
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
    expect(table).toContain("| 120804 | [두 수의 곱 구하기](https://school.programmers.co.kr/learn/courses/30/lessons/120804) | 2026-05-27 |");
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
