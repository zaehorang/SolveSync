import { describe, expect, it, vi } from "vitest";

import { normalizeError } from "../shared/errorNormalize";
import { mergeReadmeManagedBlock, renderManagedReadmeTable } from "../shared/readme";
import { parseSolutionCatalogJson } from "../shared/solutionCatalog";
import { STORAGE_SCHEMA_VERSION } from "../shared/storageSchema";
import { createExtensionStorage, type StorageAreaAdapter } from "./storage";
import type {
  SyncBranch,
  ProblemMetadata,
  SyncRepository,
  RetryBundle,
  SyncDeduplicationKey,
  LeetCodeLanguage
} from "../shared/types";
import type { LatestAcceptedSubmissionResult } from "./client/leetcode";
import type {
  CommitGitDataInput,
  CommitGitDataResult,
  ReadTextFileInput
} from "./client/github";
import {
  createSyncOrchestrator,
  type GitHubClientFactory,
  type SyncGitHubClient,
  type SyncLeetCodeClient
} from "./sync";

const expectedAcceptedDate = "2026-01-02";
const defaultAcceptedAt = makeLocalAcceptedAt(expectedAcceptedDate);

describe("background sync orchestrator", () => {
  it("records setup required without fetching LeetCode or committing", async () => {
    const harness = makeHarness();

    const outcome = await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(outcome.kind).toBe("recorded");
    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(0);
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["setup_required"]);
  });

  it("records Auto Sync off without fetching LeetCode or committing", async () => {
    const harness = makeHarness();
    await harness.saveSettings({ autoSyncEnabled: false });

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.leetcode.fetchLatestAcceptedSubmission).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(0);
    await expect(historyStatuses(harness.storage)).resolves.toEqual([
      "auto_sync_disabled"
    ]);
  });

  it("records unsupported languages without committing", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      unsupportedAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      status: "unsupported_language",
      language: "Java",
      supportedLanguage: null,
      problemTitle: "Two Sum"
    });
  });

  it("skips already processed Sync Deduplication Keys without a duplicate commit", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.markSyncDeduplicationKeyProcessed(
      syncDeduplicationKey,
      {
        commitSha: "existing-commit",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      },
      "2026-01-01T00:00:00.000Z"
    );
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    const outcome = await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_processed",
      syncDeduplicationKey: syncDeduplicationKey
    });
    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listSyncHistoryEntries()).resolves.toHaveLength(0);
  });

  it("skips Sync Deduplication Keys that already have an in-flight lock", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.acquireSyncDeduplicationKeyLock(syncDeduplicationKey, "2026-01-01T00:00:00.000Z");
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    const outcome = await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_in_flight",
      syncDeduplicationKey: syncDeduplicationKey
    });
    expect(harness.github.commits).toHaveLength(0);
  });

  it("commits solution, marks processed, and appends success history", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("leetcode/README.md", "# Existing\n");
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: leetcode 1 Two Sum in swift (rev 1)"
    });
    expect(await harness.storage.hasProcessedSyncDeduplicationKey(syncDeduplicationKey)).toBe(true);
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["synced"]);
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "leetcode/swift/0001_two_sum.swift",
      "leetcode/README.md",
      "leetcode/.leetcode-sync/index.json"
    ]);
    expect(
      harness.github.commits[0]?.files.find((file) => file.path === "leetcode/README.md")?.content
    ).toContain("# Existing");
    expect(committedContent(harness, "leetcode/README.md")).toContain(
      `| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | Easy | ${expectedAcceptedDate} |`
    );
    expect(committedJson(harness, "leetcode/.leetcode-sync/index.json")).toMatchObject({
      version: 4,
      activity: {
        days: {
          [expectedAcceptedDate]: {
            acceptedCount: 1,
            newProblemCount: 1
          }
        }
      },
      problems: [
        {
          firstAcceptedDate: expectedAcceptedDate,
          lastAcceptedDate: expectedAcceptedDate,
          languages: {
            swift: {
              lastAcceptedSourceId: syncDeduplicationKey.acceptedSourceId,
              solutionRevisionNumber: 1,
              firstAcceptedDate: expectedAcceptedDate,
              lastAcceptedDate: expectedAcceptedDate
            }
          }
        }
      ]
    });
  });

  it("migrates a v3 LeetCode catalog and legacy README in the next Accepted commit", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    const beforeMarker = "# Existing\n\n수동 소개  \n";
    const afterMarker = "\n수동 꼬리말\n";
    harness.github.files.set(
      "leetcode/README.md",
      [
        beforeMarker + "<!-- LEETCODE_TABLE_START -->",
        "| # | Title | Difficulty | Solved | Swift | Python |",
        "| ---: | --- | --- | --- | --- | --- |",
        "| 1 | Two Sum | Easy | 2026-01-01 | [Swift](swift/0001_two_sum.swift) | [Python3](python/0001_two_sum.py) |",
        "<!-- LEETCODE_TABLE_END -->" + afterMarker
      ].join("\n")
    );
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(makeV3CatalogWithTwoLanguages())
    );
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission({ acceptedSourceId: "new-swift-source" })
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    const readme = committedContent(harness, "leetcode/README.md");
    const catalog = committedJson(
      harness,
      "leetcode/.leetcode-sync/index.json"
    ) as {
      version: number;
      problems: Array<{
        languages: Record<string, { solutionPath: string }>;
      }>;
    };
    expect(readme.startsWith(beforeMarker)).toBe(true);
    expect(readme.endsWith(afterMarker)).toBe(true);
    expect(readme).not.toContain("| Swift | Python |");
    expect(readme).toContain(
      "[Swift](swift/0001_two_sum.swift) · [Python3](python/0001_two_sum.py)"
    );
    expect(catalog.version).toBe(4);
    expect(catalog.problems[0]?.languages.swift?.solutionPath).toBe(
      "leetcode/swift/0001_two_sum.swift"
    );
    expect(catalog.problems[0]?.languages.python3?.solutionPath).toBe(
      "leetcode/python/0001_two_sum.py"
    );
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "leetcode/swift/0001_two_sum.swift",
      "leetcode/README.md",
      "leetcode/.leetcode-sync/index.json"
    ]);
  });

  it("commits Programmers Accepted Editor Snapshots with Solution README and Solution Catalog files", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("programmers/README.md", "# Programmers\n");

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(1);
    expect(await harness.storage.hasProcessedSyncDeduplicationKey(programmersSyncDeduplicationKey)).toBe(true);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: programmers 120804 두 수의 곱 구하기 in swift (rev 1)"
    });
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "programmers/swift/120804_두_수의_곱_구하기.swift",
      "programmers/README.md",
      "programmers/.programmers-sync/index.json"
    ]);
    expect(
      harness.github.commits[0]?.files.find((file) => file.path === "programmers/README.md")
        ?.content
    ).toContain("<!-- PROGRAMMERS_TABLE_START -->");
    expect(committedContent(harness, "programmers/README.md")).toContain(
      `| 120804 | [두 수의 곱 구하기](https://school.programmers.co.kr/learn/courses/30/lessons/120804) | ${expectedAcceptedDate} |`
    );
    expect(committedContent(harness, "programmers/README.md")).not.toContain(
      "Difficulty"
    );
    expect(committedJson(harness, "programmers/.programmers-sync/index.json")).toMatchObject({
      version: 4,
      activity: {
        days: {
          [expectedAcceptedDate]: {
            acceptedCount: 1,
            newProblemCount: 1
          }
        }
      },
      problems: [
        {
          difficulty: "-",
          firstAcceptedDate: expectedAcceptedDate,
          lastAcceptedDate: expectedAcceptedDate,
          languages: {
            swift: {
              lastAcceptedSourceId: programmersSyncDeduplicationKey.acceptedSourceId,
              solutionRevisionNumber: 1,
              firstAcceptedDate: expectedAcceptedDate,
              lastAcceptedDate: expectedAcceptedDate
            }
          }
        }
      ]
    });
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["synced"]);
  });

  it("drops the Difficulty column from an existing Programmers README while keeping every row", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    const beforeMarker = "# Programmers\n\n수동 소개  \n";
    const afterMarker = "\n수동 꼬리말\n";
    harness.github.files.set(
      "programmers/README.md",
      [
        `${beforeMarker}<!-- PROGRAMMERS_TABLE_START -->`,
        "| # | Title | Difficulty | Solved | Languages |",
        "| ---: | --- | --- | --- | --- |",
        "| 120803 | 두 수의 나눗셈 | - | 2026-01-01 | [Swift](swift/120803_두_수의_나눗셈.swift) |",
        `<!-- PROGRAMMERS_TABLE_END -->${afterMarker}`
      ].join("\n")
    );
    harness.github.files.set(
      "programmers/.programmers-sync/index.json",
      JSON.stringify(makeProgrammersCatalogWithPreviousProblem())
    );

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    const readme = committedContent(harness, "programmers/README.md");

    expect(readme.startsWith(beforeMarker)).toBe(true);
    expect(readme.endsWith(afterMarker)).toBe(true);
    expect(readme).not.toContain("Difficulty");
    expect(readme).toContain("| # | Title | Solved | Languages |");
    expect(readme).toContain(
      "| 120803 | [두 수의 나눗셈](https://school.programmers.co.kr/learn/courses/30/lessons/120803) | 2026-01-01 | [Swift](swift/120803_두_수의_나눗셈.swift) |"
    );
    expect(readme).toContain(
      `| 120804 | [두 수의 곱 구하기](https://school.programmers.co.kr/learn/courses/30/lessons/120804) | ${expectedAcceptedDate} | [Swift](swift/120804_두_수의_곱_구하기.swift) |`
    );
    expect(
      committedJson(harness, "programmers/.programmers-sync/index.json")
    ).toMatchObject({
      version: 4,
      problems: [{ frontendId: "120803", difficulty: "-" }, { frontendId: "120804" }]
    });
  });

  it("keeps two languages for the same Programmers problem in one README row", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    for (const file of harness.github.commits[0]?.files ?? []) {
      harness.github.files.set(file.path, file.content);
    }

    await harness.sync.handleAcceptedDetected(
      makeProgrammersAcceptedDetected({
        language: "Python3",
        code: "def solution(num1, num2):\n    return num1 * num2",
        pageUrl:
          "https://school.programmers.co.kr/learn/courses/30/lessons/120804?language=python3"
      })
    );

    expect(harness.github.commits).toHaveLength(2);
    const secondCommit = harness.github.commits[1];
    expect(secondCommit).toMatchObject({
      message: "solve: programmers 120804 두 수의 곱 구하기 in python3 (rev 1)"
    });
    expect(secondCommit?.files.map((file) => file.path)).toEqual([
      "programmers/python/120804_두_수의_곱_구하기.py",
      "programmers/README.md",
      "programmers/.programmers-sync/index.json"
    ]);
    expect(
      secondCommit?.files.find((file) => file.path === "programmers/README.md")
        ?.content
    ).toContain(
      "[Swift](swift/120804_두_수의_곱_구하기.swift) · [Python3](python/120804_두_수의_곱_구하기.py)"
    );
    expect(
      JSON.parse(
        secondCommit?.files.find(
          (file) => file.path === "programmers/.programmers-sync/index.json"
        )?.content ?? "{}"
      )
    ).toMatchObject({
      version: 4,
      activity: {
        days: {
          [expectedAcceptedDate]: {
            acceptedCount: 2,
            newProblemCount: 1
          }
        }
      },
      problems: [
        {
          languages: {
            swift: {
              solutionRevisionNumber: 1
            },
            python3: {
              solutionRevisionNumber: 1
            }
          }
        }
      ]
    });
  });

  it("skips already processed Programmers Sync Deduplication Keys without a duplicate commit", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());
    const outcome = await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_processed",
      syncDeduplicationKey: programmersSyncDeduplicationKey
    });
    expect(harness.github.commits).toHaveLength(1);
  });

  it("skips Programmers Sync Deduplication Keys that already have an in-flight lock", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.acquireSyncDeduplicationKeyLock(
      programmersSyncDeduplicationKey,
      "2026-01-01T00:00:00.000Z"
    );

    const outcome = await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_in_flight",
      syncDeduplicationKey: programmersSyncDeduplicationKey
    });
    expect(harness.github.commits).toHaveLength(0);
  });

  it("calculates #2 for the next sync after an existing v2 Catalog language entry", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(makeV2CatalogWithSwiftEntry(), null, 2)
    );
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission({
        acceptedSourceId: "987654321"
      })
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: leetcode 1 Two Sum in swift (rev 2)"
    });
    expect(committedJson(harness, "leetcode/.leetcode-sync/index.json")).toMatchObject({
      version: 4,
      problems: [
        {
          languages: {
            swift: {
              lastAcceptedSourceId: "987654321",
              solutionRevisionNumber: 2
            }
          }
        }
      ]
    });
  });

  it("keeps a different language for the same problem at #1", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(makeV2CatalogWithSwiftEntry(), null, 2)
    );
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission({
        acceptedSourceId: "python-accepted-source",
        language: "Python3",
        supportedLanguage: "python3",
        code: "class Solution:\n    pass\n"
      })
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: leetcode 1 Two Sum in python3 (rev 1)"
    });
    expect(harness.github.commits[0]?.files[0]).toMatchObject({
      path: "leetcode/python/0001_two_sum.py"
    });
    expect(committedJson(harness, "leetcode/.leetcode-sync/index.json")).toMatchObject({
      version: 4,
      problems: [
        {
          languages: {
            swift: {
              solutionRevisionNumber: 1
            },
            python3: {
              lastAcceptedSourceId: "python-accepted-source",
              solutionRevisionNumber: 1
            }
          }
        }
      ]
    });
  });

  it("records unsupported Programmers languages without committing", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(
      makeProgrammersAcceptedDetected({
        language: "Ruby"
      })
    );

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryBundles()).resolves.toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      codingPlatform: "programmers",
      status: "unsupported_language",
      language: "Ruby",
      supportedLanguage: null,
      problemTitle: "두 수의 곱 구하기"
    });
  });

  it("commits SWEA Accepted Editor Snapshots with Solution README and Solution Catalog files", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(makeSweaAcceptedDetected());

    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(1);
    expect(
      await harness.storage.hasProcessedSyncDeduplicationKey(sweaSyncDeduplicationKey)
    ).toBe(true);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: swea 1234 숫자 카드 in python3 (rev 1)"
    });
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "swea/python/1234_숫자_카드.py",
      "swea/README.md",
      "swea/.swea-sync/index.json"
    ]);
    expect(committedContent(harness, "swea/README.md")).toContain(
      "<!-- SWEA_TABLE_START -->"
    );
    expect(committedContent(harness, "swea/README.md")).toContain(
      `| 1234 | [숫자 카드](https://swexpertacademy.com/main/code/problem/problemDetail.do?contestProbId=AV13zZ7KAAACFAYh) | ${expectedAcceptedDate} |`
    );
    // SWEA Difficulty는 풀이 페이지에 없다. Programmers와 같은 처리다.
    expect(committedContent(harness, "swea/README.md")).not.toContain("Difficulty");
  });

  it("uses the SWEA contest problem id for the filename when the title has no number", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(
      makeSweaAcceptedDetected({
        problemNumber: ""
      })
    );

    expect(harness.github.commits[0]?.files[0]?.path).toBe(
      "swea/python/AV13zZ7KAAACFAYh_숫자_카드.py"
    );
  });

  it("records SWEA languages outside the registry as unsupported", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    // SWEA는 Swift를 제공하지 않는다. 다른 플랫폼 alias가 새어 들어오면 안 된다.
    await harness.sync.handleAcceptedDetected(
      makeSweaAcceptedDetected({
        language: "Swift"
      })
    );

    expect(harness.github.commits).toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      codingPlatform: "swea",
      status: "unsupported_language",
      supportedLanguage: null,
      problemTitle: "숫자 카드"
    });
  });

  it("records SWEA bridge failures as extract failures without Retry Bundles", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    // bridge 미주입, timeout, empty editor는 모두 empty code로 도착한다.
    await harness.sync.handleAcceptedDetected(
      makeSweaAcceptedDetected({
        code: ""
      })
    );

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryBundles()).resolves.toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      codingPlatform: "swea",
      status: "failed",
      retryBundleId: null,
      error: {
        code: "swea_extract_failed"
      }
    });
  });

  it("records Programmers extract failures without Retry Bundles", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(
      makeProgrammersAcceptedDetected({
        code: ""
      })
    );

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryBundles()).resolves.toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      codingPlatform: "programmers",
      status: "failed",
      retryBundleId: null,
      error: {
        code: "programmers_extract_failed"
      }
    });
  });

  it("does not store Retry Bundles when Programmers Solution Catalog cannot be parsed", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("programmers/.programmers-sync/index.json", "{not-json");

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryBundles()).resolves.toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      codingPlatform: "programmers",
      status: "failed",
      retryBundleId: null,
      error: {
        code: "malformed_index"
      }
    });
  });

  it("stores Retry Bundles for GitHub commit failures without marking processed", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.commitError = normalizeError({
      code: "github_commit_failed",
      message: "commit failed"
    });
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(await harness.storage.hasProcessedSyncDeduplicationKey(syncDeduplicationKey)).toBe(false);
    const bundles = await harness.storage.listRetryBundles();
    expect(bundles).toHaveLength(1);
    expect(bundles[0]).toMatchObject({
      syncDeduplicationKey: syncDeduplicationKey,
      solutionPath: "leetcode/swift/0001_two_sum.swift",
      attempts: 0
    });
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      status: "failed",
      retryBundleId: bundles[0]?.id
    });
  });

  it("does not store Retry Bundles when commit files cannot be prepared", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("leetcode/.leetcode-sync/index.json", "{not-json");
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryBundles()).resolves.toHaveLength(0);
    const records = await harness.storage.listSyncHistoryEntries();
    expect(records[0]).toMatchObject({
      status: "failed",
      retryBundleId: null,
      error: {
        code: "malformed_index"
      }
    });
  });

  it("retries a saved Retry Bundle, deletes it, and marks processed on success", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.saveRetryBundle(makeRetryBundle("retry-1"));

    await harness.sync.handleRetry("retry-1");

    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: leetcode 1 Two Sum in swift (rev 1)"
    });
    expect(await harness.storage.hasProcessedSyncDeduplicationKey(syncDeduplicationKey)).toBe(true);
    await expect(harness.storage.getRetryBundle("retry-1")).resolves.toBeNull();
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["synced"]);
  });

  it("recalculates retry commit messages from the latest Solution Catalog instead of the saved Retry Bundle message", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(
        makeV2CatalogWithSwiftEntry({
          lastAcceptedSourceId: "previous-accepted-source"
        }),
        null,
        2
      )
    );
    await harness.storage.saveRetryBundle(
      makeRetryBundle("retry-1", {
        commitMessage: "legacy retry message that must not be reused"
      })
    );

    await harness.sync.handleRetry("retry-1");

    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: leetcode 1 Two Sum in swift (rev 2)"
    });
    expect(committedJson(harness, "leetcode/.leetcode-sync/index.json")).toMatchObject({
      version: 4,
      problems: [
        {
          languages: {
            swift: {
              lastAcceptedSourceId: syncDeduplicationKey.acceptedSourceId,
              solutionRevisionNumber: 2
            }
          }
        }
      ]
    });
  });

  it("retries a saved Programmers Retry Bundle with the Coding Platform commit files", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.saveRetryBundle(makeProgrammersRetryBundle("retry-programmers"));

    await harness.sync.handleRetry("retry-programmers");

    expect(harness.github.commits).toHaveLength(1);
    expect(await harness.storage.hasProcessedSyncDeduplicationKey(programmersSyncDeduplicationKey)).toBe(true);
    await expect(harness.storage.getRetryBundle("retry-programmers")).resolves.toBeNull();
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: programmers 120804 두 수의 곱 구하기 in swift (rev 1)"
    });
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "programmers/swift/120804_두_수의_곱_구하기.swift",
      "programmers/README.md",
      "programmers/.programmers-sync/index.json"
    ]);
  });

  it("keeps Retry Bundles and updates failure detail when retry fails", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.saveRetryBundle(makeRetryBundle("retry-1"));
    harness.github.commitError = normalizeError({
      code: "github_commit_failed",
      message: "retry failed"
    });

    await harness.sync.handleRetry("retry-1");

    const bundle = await harness.storage.getRetryBundle("retry-1");
    expect(bundle).toMatchObject({
      attempts: 1,
      lastError: {
        code: "github_commit_failed"
      }
    });
    expect(await harness.storage.hasProcessedSyncDeduplicationKey(syncDeduplicationKey)).toBe(false);
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["failed"]);
  });

  it("cleans both Solution READMEs in one dedicated commit", async () => {
    const harness = makeHarness();
    const selectedBranch = { ...syncBranch, name: "solutions" };
    const leetcodeBefore = "# LeetCode\r\n\r\n수동 머리말  \r\n";
    const leetcodeAfter = "\r\n수동 꼬리말\r\n";
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(makeV3CatalogWithTwoLanguages())
    );
    harness.github.files.set(
      "leetcode/README.md",
      `${leetcodeBefore}<!-- LEETCODE_TABLE_START -->\nlegacy\n<!-- LEETCODE_TABLE_END -->${leetcodeAfter}`
    );
    harness.github.files.set(
      "programmers/.programmers-sync/index.json",
      JSON.stringify(makeProgrammersCatalogWithPreviousProblem())
    );
    harness.github.files.set(
      "programmers/README.md",
      "# Programmers\n\n<!-- PROGRAMMERS_TABLE_START -->\nlegacy\n<!-- PROGRAMMERS_TABLE_END -->\n"
    );

    const outcome = await harness.sync.cleanupRepository(
      syncRepository,
      selectedBranch
    );

    expect(outcome).toMatchObject({ kind: "committed", commitSha: "commit-sha" });
    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.commits[0]).toMatchObject({
      branchName: "solutions",
      message: "chore: README 표 형식을 정리한다"
    });
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "leetcode/README.md",
      "programmers/README.md"
    ]);
    const leetcodeReadme = committedContent(harness, "leetcode/README.md");
    expect(leetcodeReadme.startsWith(leetcodeBefore)).toBe(true);
    expect(leetcodeReadme.endsWith(leetcodeAfter)).toBe(true);
    expect(leetcodeReadme).toContain(
      "[Swift](swift/0001_two_sum.swift) · [Python3](python/0001_two_sum.py)"
    );
    expect(committedContent(harness, "programmers/README.md")).not.toContain(
      "Difficulty"
    );
    expect(harness.github.reads.every((read) => read.branchName === "solutions")).toBe(
      true
    );
  });

  it("ignores missing Catalogs and does not commit unchanged READMEs", async () => {
    const harness = makeHarness();
    const catalog = makeV3CatalogWithTwoLanguages();
    const currentReadme = mergeReadmeManagedBlock(
      null,
      renderManagedReadmeTable(parseSolutionCatalogJson(JSON.stringify(catalog)))
    );
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(catalog)
    );
    harness.github.files.set("leetcode/README.md", currentReadme);

    await expect(
      harness.sync.cleanupRepository(syncRepository, syncBranch)
    ).resolves.toEqual({ kind: "no_changes" });
    expect(harness.github.commits).toHaveLength(0);
  });

  it("fails cleanup when an existing Solution Catalog is malformed", async () => {
    const harness = makeHarness();
    harness.github.files.set("leetcode/.leetcode-sync/index.json", "{broken");

    await expect(
      harness.sync.cleanupRepository(syncRepository, syncBranch)
    ).rejects.toMatchObject({ code: "malformed_index" });
    expect(harness.github.commits).toHaveLength(0);
  });

  it("recomputes cleanup files when the branch changed during the commit", async () => {
    const harness = makeHarness();
    const leetcodeCatalog = makeV3CatalogWithTwoLanguages();
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(leetcodeCatalog)
    );
    harness.github.files.set("leetcode/README.md", "# Legacy\n");
    harness.github.files.set(
      "programmers/.programmers-sync/index.json",
      JSON.stringify(makeProgrammersCatalogWithPreviousProblem())
    );
    harness.github.files.set("programmers/README.md", "# Legacy\n");
    harness.github.commitErrorQueue.push(
      normalizeError({ code: "github_conflict_failed", message: "ref conflict" })
    );
    harness.github.beforeCommit = () => {
      // 다른 commit이 먼저 leetcode README 정리만 반영한 상황
      harness.github.files.set(
        "leetcode/README.md",
        mergeReadmeManagedBlock(
          null,
          renderManagedReadmeTable(
            parseSolutionCatalogJson(JSON.stringify(leetcodeCatalog))
          )
        )
      );
      harness.github.beforeCommit = null;
    };

    const outcome = await harness.sync.cleanupRepository(syncRepository, syncBranch);

    expect(outcome).toMatchObject({
      kind: "committed",
      paths: ["programmers/README.md"]
    });
    expect(harness.github.commits).toHaveLength(2);
    expect(harness.github.commits[1]?.files.map((file) => file.path)).toEqual([
      "programmers/README.md"
    ]);
  });

  it("does not commit when the conflict shows the cleanup already applied", async () => {
    const harness = makeHarness();
    const catalog = makeV3CatalogWithTwoLanguages();
    const cleanedReadme = mergeReadmeManagedBlock(
      null,
      renderManagedReadmeTable(parseSolutionCatalogJson(JSON.stringify(catalog)))
    );
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(catalog)
    );
    harness.github.files.set("leetcode/README.md", "# Legacy\n");
    harness.github.commitErrorQueue.push(
      normalizeError({ code: "github_conflict_failed", message: "ref conflict" })
    );
    harness.github.beforeCommit = () => {
      harness.github.files.set("leetcode/README.md", cleanedReadme);
      harness.github.beforeCommit = null;
    };

    await expect(
      harness.sync.cleanupRepository(syncRepository, syncBranch)
    ).resolves.toEqual({ kind: "no_changes" });
    // 실패한 첫 시도 하나뿐이고 재시도 commit은 만들지 않는다.
    expect(harness.github.commits).toHaveLength(1);
    expect(harness.github.files.get("leetcode/README.md")).toBe(cleanedReadme);
  });

  it("surfaces cleanup failures that are not branch conflicts", async () => {
    const harness = makeHarness();
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(makeV3CatalogWithTwoLanguages())
    );
    harness.github.files.set("leetcode/README.md", "# Legacy\n");
    harness.github.commitError = normalizeError({
      code: "github_commit_failed",
      message: "cleanup failed"
    });

    await expect(
      harness.sync.cleanupRepository(syncRepository, syncBranch)
    ).rejects.toMatchObject({ code: "github_commit_failed" });
    expect(harness.github.commits).toHaveLength(1);
  });

  it("does not create a second cleanup commit after applying the first result", async () => {
    const harness = makeHarness();
    harness.github.files.set(
      "leetcode/.leetcode-sync/index.json",
      JSON.stringify(makeV3CatalogWithTwoLanguages())
    );
    harness.github.files.set("leetcode/README.md", "# Legacy\n");

    await expect(
      harness.sync.cleanupRepository(syncRepository, syncBranch)
    ).resolves.toMatchObject({ kind: "committed" });
    await expect(
      harness.sync.cleanupRepository(syncRepository, syncBranch)
    ).resolves.toEqual({ kind: "no_changes" });
    expect(harness.github.commits).toHaveLength(1);
  });
});

interface Harness {
  storage: ReturnType<typeof createExtensionStorage>;
  leetcode: SyncLeetCodeClient & {
    fetchProblemMetadata: ReturnType<typeof vi.fn>;
    fetchLatestAcceptedSubmission: ReturnType<typeof vi.fn>;
  };
  github: FakeGitHubClient;
  sync: ReturnType<typeof createSyncOrchestrator>;
  saveSettings(update?: { autoSyncEnabled?: boolean }): Promise<void>;
}

function makeHarness(): Harness {
  const storage = createExtensionStorage(createMemoryStorageArea());
  const leetcode = {
    fetchProblemMetadata: vi.fn(),
    fetchLatestAcceptedSubmission: vi.fn()
  } as Harness["leetcode"];
  const github = new FakeGitHubClient();
  const githubClientFactory: GitHubClientFactory = () => github;
  let id = 0;
  const sync = createSyncOrchestrator({
    storage,
    leetcode,
    githubClientFactory,
    broadcast: vi.fn(),
    now: () => "2026-01-01T00:00:00.000Z",
    createId: (prefix) => `${prefix}-${id++}`
  });

  return {
    storage,
    leetcode,
    github,
    sync,
    async saveSettings(update = {}) {
      await storage.saveSettings({
        syncRepository: syncRepository,
        syncBranch: syncBranch,
        autoSyncEnabled: update.autoSyncEnabled ?? true
      });
      await storage.saveGitHubAuth({
        version: STORAGE_SCHEMA_VERSION,
        accessToken: "test-access-token",
        accessTokenExpiresAt: "2026-01-01T08:00:00.000Z",
        refreshToken: "test-refresh-token",
        refreshTokenExpiresAt: "2026-07-01T00:00:00.000Z",
        tokenType: "bearer",
        account: {
          id: 1,
          login: "octo",
          avatarUrl: null
        },
        updatedAt: "2026-01-01T00:00:00.000Z"
      });
    }
  };
}

class FakeGitHubClient implements SyncGitHubClient {
  readonly commits: CommitGitDataInput[] = [];
  readonly reads: ReadTextFileInput[] = [];
  readonly files = new Map<string, string>();
  /** 앞에서부터 하나씩 소비되는 일회성 실패. 재시도 경로를 만들 때 쓴다. */
  readonly commitErrorQueue: unknown[] = [];
  commitError: unknown = null;
  beforeCommit: (() => void) | null = null;

  async readTextFile(input: ReadTextFileInput): Promise<string | null> {
    this.reads.push(input);
    return this.files.get(input.path) ?? null;
  }

  async commitFiles(input: CommitGitDataInput): Promise<CommitGitDataResult> {
    this.commits.push(input);
    this.beforeCommit?.();

    const queuedError = this.commitErrorQueue.shift();
    if (queuedError !== undefined) {
      throw queuedError;
    }

    if (this.commitError !== null) {
      throw this.commitError;
    }

    for (const file of input.files) {
      this.files.set(file.path, file.content);
    }

    return {
      repository: syncRepository,
      branch: {
        ...syncBranch,
        sha: "commit-sha"
      },
      baseCommitSha: "base-sha",
      baseTreeSha: "base-tree-sha",
      commitSha: "commit-sha",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
      fileUrls: Object.fromEntries(
        input.files.map((file) => [
          file.path,
          `https://github.com/octo/algorithms/blob/main/${file.path}`
        ])
      )
    };
  }
}

function createMemoryStorageArea(seed: Record<string, unknown> = {}): StorageAreaAdapter {
  let data = cloneRecord(seed);

  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys === null || keys === undefined) {
        return cloneRecord(data);
      }

      if (typeof keys === "string") {
        return { [keys]: cloneValue(data[keys]) };
      }

      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, cloneValue(data[key])]));
      }

      return {
        ...cloneRecord(keys),
        ...Object.fromEntries(
          Object.keys(keys)
            .filter((key) => key in data)
            .map((key) => [key, cloneValue(data[key])])
        )
      };
    },
    async set(items: Record<string, unknown>) {
      data = {
        ...data,
        ...cloneRecord(items)
      };
    },
    async remove(keys: string | string[]) {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];

      for (const key of keysToRemove) {
        delete data[key];
      }
    }
  };
}

const syncRepository: SyncRepository = {
  owner: "octo",
  name: "algorithms",
  fullName: "octo/algorithms",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/octo/algorithms"
};

const syncBranch: SyncBranch = {
  name: "main",
  sha: "base-sha",
  protected: false
};

const problem: ProblemMetadata = {
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  url: "https://leetcode.com/problems/two-sum/"
};

const syncDeduplicationKey: SyncDeduplicationKey = {
  codingPlatform: "leetcode",
  acceptedSourceId: "123456789",
  titleSlug: "two-sum",
  language: "swift"
};

const programmersCode = [
  "func solution(_ num1: Int, _ num2: Int) -> Int {",
  "  num1 * num2",
  "}"
].join("\n");

const sweaCode = [
  "T = int(input())",
  "for tc in range(1, T + 1):",
  "    print(f'#{tc} {sum(map(int, input().split()))}')"
].join("\n");

const sweaSyncDeduplicationKey: SyncDeduplicationKey = {
  codingPlatform: "swea",
  // 식별은 contestProbId로 한다. 파일명 번호와 다른 값이다.
  acceptedSourceId: `swea:AV13zZ7KAAACFAYh:python3:${buildShortCodeHash(sweaCode)}`,
  titleSlug: "1234_숫자_카드",
  language: "python3"
};

function makeSweaAcceptedDetected(
  overrides: Partial<{
    contestProbId: string;
    problemNumber: string;
    problemTitle: string;
    language: string;
    code: string;
    pageUrl: string;
    detectedAt: string;
  }> = {}
) {
  return {
    codingPlatform: "swea" as const,
    contestProbId: overrides.contestProbId ?? "AV13zZ7KAAACFAYh",
    problemNumber: overrides.problemNumber ?? "1234",
    problemTitle: overrides.problemTitle ?? "숫자 카드",
    // select#sel_lang의 option value code다.
    language: overrides.language ?? "Y",
    code: overrides.code ?? sweaCode,
    pageUrl:
      overrides.pageUrl ??
      "https://swexpertacademy.com/main/solvingProblem/solvingProblem.do",
    detectedAt: overrides.detectedAt ?? defaultAcceptedAt
  };
}

const programmersSyncDeduplicationKey: SyncDeduplicationKey = {
  codingPlatform: "programmers",
  acceptedSourceId: `programmers:120804:swift:${buildShortCodeHash(programmersCode)}`,
  titleSlug: "120804_두_수의_곱_구하기",
  language: "swift"
};

function makeAcceptedDetected() {
  return {
    codingPlatform: "leetcode" as const,
    titleSlug: "two-sum",
    pageUrl: "https://leetcode.com/problems/two-sum/",
    detectedAt: "2026-01-01T00:00:00.000Z"
  };
}

function makeProgrammersAcceptedDetected(
  overrides: Partial<{
    courseId: string;
    lessonId: string;
    problemTitle: string;
    language: string;
    code: string;
    pageUrl: string;
    detectedAt: string;
  }> = {}
) {
  return {
    codingPlatform: "programmers" as const,
    courseId: overrides.courseId ?? "30",
    lessonId: overrides.lessonId ?? "120804",
    problemTitle: overrides.problemTitle ?? "두 수의 곱 구하기",
    language: overrides.language ?? "Swift",
    code: overrides.code ?? programmersCode,
    pageUrl:
      overrides.pageUrl ??
      "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
    detectedAt: overrides.detectedAt ?? defaultAcceptedAt
  };
}

function syncableAcceptedSubmission(
  overrides: Partial<{
    acceptedSourceId: string;
    language: string;
    supportedLanguage: SyncDeduplicationKey["language"];
    code: string;
  }> = {}
): LatestAcceptedSubmissionResult {
  const supportedLanguage = overrides.supportedLanguage ?? syncDeduplicationKey.language;
  const acceptedSourceId =
    overrides.acceptedSourceId ?? syncDeduplicationKey.acceptedSourceId;
  const nextSyncDeduplicationKey: SyncDeduplicationKey = {
    ...syncDeduplicationKey,
    acceptedSourceId,
    language: supportedLanguage
  };

  return {
    syncable: true,
    supportedLanguage,
    syncDeduplicationKey: nextSyncDeduplicationKey,
    submittedAt: "2026-01-01T00:00:00.000Z",
    submission: {
      acceptedSourceId,
      titleSlug: syncDeduplicationKey.titleSlug,
      language: (overrides.language ?? "Swift") as LeetCodeLanguage,
      code: overrides.code ?? "class Solution {}",
      acceptedAt: defaultAcceptedAt
    }
  };
}

function unsupportedAcceptedSubmission(): LatestAcceptedSubmissionResult {
  return {
    syncable: false,
    supportedLanguage: null,
    syncDeduplicationKey: null,
    submittedAt: "2026-01-01T00:00:00.000Z",
    submission: {
      acceptedSourceId: "987654321",
      titleSlug: "two-sum",
      language: "Java",
      code: "class Solution {}",
      acceptedAt: defaultAcceptedAt
    }
  };
}

function makeProgrammersRetryBundle(id: string): RetryBundle {
  return {
    id,
    codingPlatform: "programmers",
    syncDeduplicationKey: programmersSyncDeduplicationKey,
    syncRepository,
    syncBranch,
    problem: {
      problemId: "120804",
      frontendId: "120804",
      title: "두 수의 곱 구하기",
      titleSlug: programmersSyncDeduplicationKey.titleSlug,
      difficulty: "-",
      url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804"
    },
    submission: {
      acceptedSourceId: programmersSyncDeduplicationKey.acceptedSourceId,
      titleSlug: programmersSyncDeduplicationKey.titleSlug,
      language: "Swift",
      code: programmersCode,
      acceptedAt: "2026-01-01T00:00:00.000Z"
    },
    solutionPath: "programmers/swift/120804_두_수의_곱_구하기.swift",
    solutionReadmePath: "programmers/README.md",
    solutionCatalogPath: "programmers/.programmers-sync/index.json",
    commitMessage: "solve: programmers 120804 두 수의 곱 구하기 in swift",
    attempts: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    lastError: null
  };
}

function makeRetryBundle(
  id: string,
  overrides: Partial<Pick<RetryBundle, "commitMessage">> = {}
): RetryBundle {
  return {
    id,
    codingPlatform: "leetcode",
    syncDeduplicationKey: syncDeduplicationKey,
    syncRepository,
    syncBranch,
    problem,
    submission: syncableAcceptedSubmission().submission,
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    solutionReadmePath: "leetcode/README.md",
    solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
    commitMessage: overrides.commitMessage ?? "solve: leetcode 0001 two sum in swift",
    attempts: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    lastError: null
  };
}

function makeV2CatalogWithSwiftEntry(
  overrides: Partial<{
    lastAcceptedSourceId: string;
  }> = {}
): unknown {
  return {
    version: 2,
    activity: {
      days: {
        "2026-01-01": {
          acceptedCount: 1,
          newProblemCount: 1
        }
      }
    },
    problems: [
      {
        ...problem,
        lastSyncedAt: "2026-01-01T00:00:00.000Z",
        firstAcceptedDate: "2026-01-01",
        lastAcceptedDate: "2026-01-01",
        languages: {
          swift: {
            solutionPath: "leetcode/swift/0001_two_sum.swift",
            lastAcceptedSourceId:
              overrides.lastAcceptedSourceId ?? "123456789",
            lastSyncedAt: "2026-01-01T00:00:00.000Z",
            firstAcceptedDate: "2026-01-01",
            lastAcceptedDate: "2026-01-01"
          }
        }
      }
    ]
  };
}

function makeProgrammersCatalogWithPreviousProblem(): unknown {
  return {
    version: 4,
    activity: {
      days: {
        "2026-01-01": { acceptedCount: 1, newProblemCount: 1 }
      }
    },
    problems: [
      {
        problemId: "120803",
        frontendId: "120803",
        title: "두 수의 나눗셈",
        titleSlug: "120803",
        difficulty: "-",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/120803",
        lastSyncedAt: "2026-01-01T00:00:00.000Z",
        firstAcceptedDate: "2026-01-01",
        lastAcceptedDate: "2026-01-01",
        languages: {
          swift: {
            solutionPath: "programmers/swift/120803_두_수의_나눗셈.swift",
            lastAcceptedSourceId: "legacy-programmers-source",
            solutionRevisionNumber: 1,
            lastSyncedAt: "2026-01-01T00:00:00.000Z",
            firstAcceptedDate: "2026-01-01",
            lastAcceptedDate: "2026-01-01"
          }
        }
      }
    ]
  };
}

function makeV3CatalogWithTwoLanguages(): unknown {
  const languageEntry = (solutionPath: string, lastAcceptedSourceId: string) => ({
    solutionPath,
    lastAcceptedSourceId,
    solutionRevisionNumber: 1,
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
    firstAcceptedDate: "2026-01-01",
    lastAcceptedDate: "2026-01-01"
  });

  return {
    version: 3,
    activity: {
      days: {
        "2026-01-01": { acceptedCount: 2, newProblemCount: 1 }
      }
    },
    problems: [
      {
        ...problem,
        lastSyncedAt: "2026-01-01T00:00:00.000Z",
        firstAcceptedDate: "2026-01-01",
        lastAcceptedDate: "2026-01-01",
        languages: {
          swift: languageEntry(
            "leetcode/swift/0001_two_sum.swift",
            "legacy-swift-source"
          ),
          python3: languageEntry(
            "leetcode/python/0001_two_sum.py",
            "legacy-python-source"
          )
        }
      }
    ]
  };
}

function buildShortCodeHash(code: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

async function historyStatuses(
  storage: ReturnType<typeof createExtensionStorage>
): Promise<string[]> {
  return (await storage.listSyncHistoryEntries()).map((record) => record.status);
}

function committedContent(harness: Harness, path: string): string {
  const file = harness.github.commits[0]?.files.find((entry) => entry.path === path);

  expect(file).toBeDefined();

  return file?.content ?? "";
}

function committedJson(harness: Harness, path: string): unknown {
  return JSON.parse(committedContent(harness, path)) as unknown;
}

function makeLocalAcceptedAt(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const hour = new Date().getTimezoneOffset() > 0 ? 23 : 0;

  return new Date(year, month - 1, day, hour, 30).toISOString();
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
