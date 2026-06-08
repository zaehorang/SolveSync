import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_UI_LANGUAGE,
  STORAGE_SCHEMA_VERSION,
  type NormalizedError,
  type PublicSettingsState,
  type RetryBundleSummary,
  type SyncHistoryEntry,
  type SyncRepository
} from "../shared";
import {
  buildHistoryDisplayModel,
  createAutoSyncToggleMessage,
  getFailureDetail,
  getSetupStatusView
} from "./index";
import {
  createPopupRuntimeFixture,
  makePopupEmptyHistoryFixture,
  renderPopupStaticQaFixture
} from "./fixtures/runtimeFixture";

describe("popup state helpers", () => {
  it("sorts Sync History entries newest first for display", () => {
    const older = makeSyncHistoryEntry({
      id: "older",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const newer = makeSyncHistoryEntry({
      id: "newer",
      updatedAt: "2026-01-01T00:03:00.000Z"
    });

    const model = buildHistoryDisplayModel(
      [older, newer],
      [],
      Date.parse("2026-01-01T00:04:00.000Z")
    );

    expect(model.items.map((item) => item.id)).toEqual(["newer", "older"]);
    expect(model.entryCount).toBe(2);
    expect(model.items[0]).toMatchObject({
      title: "1. Two Sum",
      platformLabel: "LeetCode",
      meta: "LeetCode / 1m ago",
      entryMeta: "1m ago",
      languageLabel: "Swift",
      statusLabel: "Synced",
      timeLabel: "1m ago",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
      fileUrl:
        "https://github.com/octo/algorithms/blob/main/leetcode/swift/0001_two_sum.swift"
    });
    expect(model.groups[0]).toMatchObject({
      meta: "LeetCode / 1m ago"
    });
    expect(model.items[0]?.meta).not.toContain("octo/algorithms@main");
    expect(model.items[0]?.entryMeta).not.toContain("octo/algorithms@main");
    expect(model.groups[0]?.meta).not.toContain("octo/algorithms@main");
    expect(Object.prototype.hasOwnProperty.call(model.groups[0], "languageBadges")).toBe(
      false
    );
  });

  it("shows retry only when the failed item still has a saved Retry Bundle", () => {
    const failed = makeSyncHistoryEntry({
      id: "failed",
      status: "failed",
      retryBundleId: "retry-1",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });

    const withoutPayload = buildHistoryDisplayModel([failed], []);
    const withPayload = buildHistoryDisplayModel([failed], [
      makeRetryBundleSummary("retry-1")
    ]);

    expect(withoutPayload.items[0]?.canRetry).toBe(false);
    expect(withoutPayload.items[0]?.recoveryHint).toBe(
      "Retry Bundle is unavailable. Check Options or submit again."
    );
    expect(withPayload.items[0]?.canRetry).toBe(true);
    expect(withPayload.items[0]?.recoveryHint).toBeNull();
  });

  it("batches adjacent retryable failures with the same error code and summary in a problem group", () => {
    const newerFailure = makeSyncHistoryEntry({
      id: "newer-failure",
      status: "failed",
      updatedAt: "2026-01-01T00:04:00.000Z",
      commitUrl: null,
      fileUrl: null,
      retryBundleId: "retry-newer",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });
    const olderFailure = makeSyncHistoryEntry({
      id: "older-failure",
      language: "Python3",
      supportedLanguage: "python3",
      status: "failed",
      updatedAt: "2026-01-01T00:03:00.000Z",
      commitUrl: null,
      fileUrl: null,
      solutionPath: "leetcode/python/0001_two_sum.py",
      syncDeduplicationKey: {
        codingPlatform: "leetcode",
        acceptedSourceId: "456",
        titleSlug: "two-sum",
        language: "python3"
      },
      retryBundleId: "retry-older",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });

    const model = buildHistoryDisplayModel(
      [olderFailure, newerFailure],
      [makeRetryBundleSummary("retry-newer"), makeRetryBundleSummary("retry-older")],
      Date.parse("2026-01-01T00:05:00.000Z")
    );

    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]?.errorBatches).toEqual([
      {
        id: "leetcode:1:error-batch:0",
        count: 2,
        summary: "2 failed · Could not commit the solution.",
        retryBundleIds: ["retry-newer", "retry-older"],
        entryIds: ["newer-failure", "older-failure"]
      }
    ]);
  });

  it("does not batch failures when error code, summary, or retryability differ", () => {
    const sameSummaryDifferentCode = buildHistoryDisplayModel(
      [
        makeSyncHistoryEntry({
          id: "commit-failure",
          status: "failed",
          updatedAt: "2026-01-01T00:04:00.000Z",
          retryBundleId: "retry-commit",
          error: makeError("github_commit_failed", "Shared failure.")
        }),
        makeSyncHistoryEntry({
          id: "conflict-failure",
          status: "failed",
          updatedAt: "2026-01-01T00:03:00.000Z",
          retryBundleId: "retry-conflict",
          error: {
            ...makeError("github_conflict_failed", "Shared failure."),
            retryable: true
          }
        })
      ],
      [
        makeRetryBundleSummary("retry-commit"),
        makeRetryBundleSummary("retry-conflict")
      ],
      Date.parse("2026-01-01T00:05:00.000Z")
    );
    const differentSummary = buildHistoryDisplayModel(
      [
        makeSyncHistoryEntry({
          id: "summary-a",
          status: "failed",
          updatedAt: "2026-01-01T00:04:00.000Z",
          retryBundleId: "retry-summary-a",
          error: makeError("github_commit_failed", "First failure.")
        }),
        makeSyncHistoryEntry({
          id: "summary-b",
          status: "failed",
          updatedAt: "2026-01-01T00:03:00.000Z",
          retryBundleId: "retry-summary-b",
          error: makeError("github_commit_failed", "Second failure.")
        })
      ],
      [
        makeRetryBundleSummary("retry-summary-a"),
        makeRetryBundleSummary("retry-summary-b")
      ],
      Date.parse("2026-01-01T00:05:00.000Z")
    );
    const unavailableRetry = buildHistoryDisplayModel(
      [
        makeSyncHistoryEntry({
          id: "retryable",
          status: "failed",
          updatedAt: "2026-01-01T00:04:00.000Z",
          retryBundleId: "retry-available",
          error: makeError("github_commit_failed", "Shared failure.")
        }),
        makeSyncHistoryEntry({
          id: "not-retryable",
          status: "failed",
          updatedAt: "2026-01-01T00:03:00.000Z",
          retryBundleId: "retry-unavailable",
          error: {
            ...makeError("github_commit_failed", "Shared failure."),
            retryable: false
          }
        })
      ],
      [
        makeRetryBundleSummary("retry-available"),
        makeRetryBundleSummary("retry-unavailable")
      ],
      Date.parse("2026-01-01T00:05:00.000Z")
    );

    expect(sameSummaryDifferentCode.groups[0]?.errorBatches).toEqual([]);
    expect(differentSummary.groups[0]?.errorBatches).toEqual([]);
    expect(unavailableRetry.groups[0]?.errorBatches).toEqual([]);
  });

  it("groups repeated same-platform problem entries while preserving language actions", () => {
    const failedSwift = makeSyncHistoryEntry({
      id: "swift-failed",
      status: "failed",
      updatedAt: "2026-01-01T00:04:00.000Z",
      commitUrl: null,
      fileUrl: null,
      retryBundleId: "retry-1",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });
    const syncedPython = makeSyncHistoryEntry({
      id: "python-synced",
      language: "Python3",
      supportedLanguage: "python3",
      solutionPath: "leetcode/python/0001_two_sum.py",
      fileUrl:
        "https://github.com/octo/algorithms/blob/main/leetcode/python/0001_two_sum.py",
      syncDeduplicationKey: {
        codingPlatform: "leetcode",
        acceptedSourceId: "456",
        titleSlug: "two-sum",
        language: "python3"
      },
      updatedAt: "2026-01-01T00:03:00.000Z"
    });

    const model = buildHistoryDisplayModel(
      [syncedPython, failedSwift],
      [makeRetryBundleSummary("retry-1")],
      Date.parse("2026-01-01T00:05:00.000Z")
    );

    expect(model.entryCount).toBe(2);
    expect(model.items).toHaveLength(2);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]).toMatchObject({
      title: "1. Two Sum",
      platformLabel: "LeetCode",
      meta: "LeetCode / 1m ago"
    });
    expect(Object.prototype.hasOwnProperty.call(model.groups[0], "languageBadges")).toBe(
      false
    );
    expect(model.groups[0]?.entries.map((entry) => entry.id)).toEqual([
      "swift-failed",
      "python-synced"
    ]);
    expect(model.groups[0]?.entries.map((entry) => entry.languageLabel)).toEqual([
      "Swift",
      "Python3"
    ]);
    expect(model.groups[0]?.meta).not.toContain("octo/algorithms@main");
    expect(model.groups[0]?.entries.map((entry) => entry.entryMeta)).toEqual([
      "1m ago",
      "2m ago"
    ]);
    expect(model.groups[0]?.entries[0]).toMatchObject({
      statusLabel: "Failed",
      canRetry: true,
      retryBundleId: "retry-1"
    });
    expect(model.groups[0]?.entries[1]).toMatchObject({
      languageLabel: "Python3",
      statusLabel: "Synced",
      fileUrl:
        "https://github.com/octo/algorithms/blob/main/leetcode/python/0001_two_sum.py"
    });
  });

  it("shows only the latest row for each problem language in a history group", () => {
    const newerSwift = makeSyncHistoryEntry({
      id: "swift-newer",
      updatedAt: "2026-01-01T00:04:00.000Z",
      commitSha: "commit-sha-newer",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha-newer"
    });
    const syncedPython = makeSyncHistoryEntry({
      id: "python-synced",
      language: "Python3",
      supportedLanguage: "python3",
      solutionPath: "leetcode/python/0001_two_sum.py",
      fileUrl:
        "https://github.com/octo/algorithms/blob/main/leetcode/python/0001_two_sum.py",
      syncDeduplicationKey: {
        codingPlatform: "leetcode",
        acceptedSourceId: "456",
        titleSlug: "two-sum",
        language: "python3"
      },
      updatedAt: "2026-01-01T00:03:00.000Z"
    });
    const olderSwift = makeSyncHistoryEntry({
      id: "swift-older",
      updatedAt: "2026-01-01T00:02:00.000Z",
      commitSha: "commit-sha-older",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha-older"
    });

    const model = buildHistoryDisplayModel(
      [olderSwift, syncedPython, newerSwift],
      [],
      Date.parse("2026-01-01T00:05:00.000Z")
    );

    expect(model.entryCount).toBe(3);
    expect(model.items.map((item) => item.id)).toEqual([
      "swift-newer",
      "python-synced",
      "swift-older"
    ]);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]?.entries.map((entry) => entry.id)).toEqual([
      "swift-newer",
      "python-synced"
    ]);
    expect(model.groups[0]?.entries[0]).toMatchObject({
      languageLabel: "Swift",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha-newer"
    });
  });

  it("does not render duplicate same-language failure rows or batches", () => {
    const newerFailure = makeSyncHistoryEntry({
      id: "swift-failure-newer",
      status: "failed",
      updatedAt: "2026-01-01T00:04:00.000Z",
      commitUrl: null,
      fileUrl: null,
      retryBundleId: "retry-newer",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });
    const olderFailure = makeSyncHistoryEntry({
      id: "swift-failure-older",
      status: "failed",
      updatedAt: "2026-01-01T00:03:00.000Z",
      commitUrl: null,
      fileUrl: null,
      retryBundleId: "retry-older",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });

    const model = buildHistoryDisplayModel(
      [olderFailure, newerFailure],
      [makeRetryBundleSummary("retry-newer"), makeRetryBundleSummary("retry-older")],
      Date.parse("2026-01-01T00:05:00.000Z")
    );

    expect(model.groups[0]?.entries.map((entry) => entry.id)).toEqual([
      "swift-failure-newer"
    ]);
    expect(model.groups[0]?.errorBatches).toEqual([]);
  });

  it("keeps syncing and retrying history badges on the progress tone", () => {
    const syncing = makeSyncHistoryEntry({
      id: "syncing",
      status: "syncing"
    });
    const retrying = makeSyncHistoryEntry({
      id: "retrying",
      status: "retrying",
      updatedAt: "2026-01-01T00:01:00.000Z"
    });

    const model = buildHistoryDisplayModel([syncing, retrying], []);

    expect(model.items.map((item) => item.tone)).toEqual(["progress", "progress"]);
  });

  it("shows the platform label for Programmers history items", () => {
    const programmers = makeProgrammersSyncHistoryEntry({
      id: "programmers-entry",
      updatedAt: "2026-01-01T00:03:00.000Z"
    });

    const model = buildHistoryDisplayModel(
      [programmers],
      [],
      Date.parse("2026-01-01T00:04:00.000Z")
    );

    expect(model.items[0]).toMatchObject({
      platformLabel: "Programmers",
      title: "120804. 두 수의 곱 구하기",
      meta: "Programmers / 1m ago",
      languageLabel: "Swift"
    });
  });

  it("creates the Auto Sync settings update message", () => {
    expect(createAutoSyncToggleMessage(true)).toEqual({
      type: "settings:write",
      payload: {
        update: {
          autoSyncEnabled: true
        }
      }
    });
  });

  it("maps failure detail to summary and technical lines", () => {
    const failed = makeSyncHistoryEntry({
      status: "failed",
      retryBundleId: null,
      error: {
        ...makeError("github_branch_protected", "GitHub branch is protected."),
        debugMessage: "Protected branch update rejected."
      }
    });

    expect(getFailureDetail(failed)).toEqual({
      summary: "GitHub branch is protected.",
      detailLines: [
        "Code: github_branch_protected",
        "Detail: Protected branch update rejected.",
        "Retry Bundle is unavailable. Check Options or submit again."
      ]
    });
  });

  it("localizes Korean setup, history, and failure labels", () => {
    const setup = getSetupStatusView(
      {
        ...makePublicSettings(),
        syncRepository: null
      },
      "ko"
    );
    const failed = makeProgrammersSyncHistoryEntry({
      status: "failed",
      retryBundleId: null,
      updatedAt: "2026-01-01T00:03:00.000Z",
      error: {
        ...makeError(
          "programmers_extract_failed",
          "Programmers editor code를 읽지 못했습니다."
        ),
        debugMessage: "textarea#code value is empty."
      }
    });
    const model = buildHistoryDisplayModel(
      [failed],
      [],
      Date.parse("2026-01-01T00:04:00.000Z"),
      "ko"
    );

    expect(setup).toMatchObject({
      label: "Sync Repository 필요",
      detail: "Options에서 Sync Repository를 선택하세요.",
      tone: "warning"
    });
    expect(model.items[0]).toMatchObject({
      statusLabel: "실패",
      meta: "Programmers / 1분 전",
      languageLabel: "Swift",
      failure: {
        summary: "Programmers editor code를 읽지 못했습니다.",
        detailLines: [
          "Code: programmers_extract_failed",
          "Detail: textarea#code value is empty.",
          "GitHub commit 데이터가 생성되지 않아 재시도할 수 없습니다."
        ]
      }
    });
  });

  it("marks Programmers extraction failures as not retryable", () => {
    const failed = makeProgrammersSyncHistoryEntry({
      status: "failed",
      retryBundleId: null,
      error: makeError(
        "programmers_extract_failed",
        "Could not read the Programmers editor code."
      )
    });

    const model = buildHistoryDisplayModel([failed], []);

    expect(model.items[0]).toMatchObject({
      statusLabel: "Failed",
      canRetry: false,
      recoveryHint: "Retry is unavailable because no GitHub commit data was created.",
      failure: {
        summary: "Could not read the Programmers editor code.",
        detailLines: [
          "Code: programmers_extract_failed",
          "Retry is unavailable because no GitHub commit data was created."
        ]
      }
    });
  });

  it("explains unsupported language items without offering GitHub links", () => {
    const unsupported = makeSyncHistoryEntry({
      status: "unsupported_language",
      language: "Java",
      supportedLanguage: null,
      commitUrl: null,
      fileUrl: null,
      error: makeError(
        "unsupported_language",
        "Unsupported language. Swift and Python3 are supported."
      )
    });

    const model = buildHistoryDisplayModel([unsupported], []);

    expect(model.items[0]).toMatchObject({
      statusLabel: "Unsupported language",
      unsupportedReason: "No commit was created. Swift and Python3 are supported.",
      commitUrl: null,
      fileUrl: null,
      canRetry: false
    });
  });

  it("keeps non-overlapping top controls and batch recovery CSS contracts", () => {
    const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
    const statusCardRule = css.match(/\.status-card\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(statusCardRule).toContain("position: static");
    expect(css).not.toContain("position: sticky");
    expect(css).toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).not.toContain("100vw");
    expect(css).toContain(".controls-panel");
    expect(css).toContain(".popup-switch-row");
    expect(css).toContain(".popup-switch-control");
    expect(css).toMatch(
      /\.popup-switch-row input:checked \+ \.popup-switch-control\s*\{/s
    );
    expect(css).toMatch(/\.summary-row\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.summary-row dd\s*\{[^}]*min-width:\s*0/s);
    expect(css).toContain(".history-problem-group");
    expect(css).toContain(".history-problem-header");
    expect(css).toContain(".history-entry-list");
    expect(css).toContain(".history-entry-row");
    expect(css).toContain(".history-language-row");
    expect(css).toContain(".history-entry-main");
    expect(css).toContain(".history-entry-actions");
    expect(css).toContain(".history-entry-links");
    expect(css).toContain(".history-entry-footer");
    expect(css).toContain(".history-link-pill");
    expect(css).toMatch(/\.history-link\s*\{[^}]*min-height:\s*32px/s);
    expect(css).toContain(".history-batch-list");
    expect(css).toContain(".history-error-batch");
    expect(css).toContain(".history-retry-all-button");
  });

  it("keeps Auto Sync as a native checkbox wrapped by its label", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toMatch(
      /<label class="popup-switch-row" for="auto-sync-toggle">[\s\S]*<input id="auto-sync-toggle" type="checkbox" \/>/
    );
    expect(html).toContain(
      '<span class="popup-switch-control" aria-hidden="true"></span>'
    );
  });

  it("summarizes setup state from public settings", () => {
    expect(getSetupStatusView(null)).toMatchObject({
      label: "Loading settings",
      tone: "neutral"
    });

    expect(
      getSetupStatusView({
        ...makePublicSettings(),
        syncRepository: null
      })
    ).toMatchObject({
      label: "Sync Repository required",
      detail: "Open Options and choose a Sync Repository.",
      tone: "warning"
    });

    expect(
      getSetupStatusView({
        ...makePublicSettings(),
        connectionStatus: {
          code: "no_accessible_repositories",
          checkedAt: "2026-01-01T00:00:00.000Z",
          error: null
        }
      })
    ).toMatchObject({
      label: "No owned repositories",
      tone: "warning"
    });

    expect(
      getSetupStatusView({
        ...makePublicSettings(),
        autoSyncEnabled: false
      })
    ).toMatchObject({
      label: "Auto Sync off",
      tone: "warning"
    });
  });

  it("provides a test-only Chrome runtime fixture for Popup data loading", () => {
    const fixture = createPopupRuntimeFixture();
    fixture.install();

    try {
      const responses: unknown[] = [];

      chrome.runtime.sendMessage({ type: "settings:read" }, (response) => {
        responses.push(response);
      });
      chrome.runtime.sendMessage(
        {
          type: "sync-history:read",
          payload: {
            limit: 20
          }
        },
        (response) => {
          responses.push(response);
        }
      );
      chrome.runtime.sendMessage({ type: "retry-bundles:read" }, (response) => {
        responses.push(response);
      });
      void chrome.runtime.openOptionsPage();

      expect(fixture.sentMessages.map((message) => message.type)).toEqual([
        "settings:read",
        "sync-history:read",
        "retry-bundles:read"
      ]);
      expect(fixture.optionPageOpenCount).toBe(1);
      expect(responses).toHaveLength(3);
      expect(responses).toEqual([
        expect.objectContaining({ ok: true }),
        expect.objectContaining({ ok: true }),
        expect.objectContaining({ ok: true })
      ]);
    } finally {
      fixture.uninstall();
    }
  });

  it("renders meaningful static Popup QA content from the runtime fixture", () => {
    const fixture = createPopupRuntimeFixture();
    const html = renderPopupStaticQaFixture(
      fixture.settings,
      fixture.syncHistoryEntries,
      fixture.retryBundles
    );

    expect(html).toContain("Ready to sync");
    expect(html).toContain(
      "solvesync-fixture/algorithm-sync-sandbox-with-a-very-long-repository-name-for-popup-qa"
    );
    expect(html).toContain(
      "release/chrome-web-store-prelaunch-popup-runtime-fixture-with-long-branch-name"
    );
    expect(html).toContain(
      "1368. Minimum Cost to Make at Least One Valid Path in a Grid With Extra Long Title"
    );
    expect(html).toContain("120804. 두 수의 곱 구하기");
    expect(html).toContain("Swift");
    expect(html).toContain("Python3");
    expect(html).toContain("Commit");
    expect(html).toContain("File");
  });

  it("renders the quiet empty Sync History fixture copy", () => {
    const fixture = makePopupEmptyHistoryFixture();
    const html = renderPopupStaticQaFixture(
      fixture.settings,
      fixture.syncHistoryEntries,
      fixture.retryBundles
    );

    expect(html).toContain("0 syncs");
    expect(html).toContain("Accepted submissions will appear here after sync runs.");
    expect(html).not.toContain("history-item");
  });

  it("renders retryable failure rows and Retry all without exposing revision text", () => {
    const fixture = createPopupRuntimeFixture();
    const html = renderPopupStaticQaFixture(
      fixture.settings,
      fixture.syncHistoryEntries,
      fixture.retryBundles
    );

    expect(html).toContain("2 failed · Could not commit the solution.");
    expect(html).toContain("history-retry-all-button");
    expect(html.match(/>Retry</g)?.length).toBe(2);
    expect(html.match(/>Retry all</g)?.length).toBe(1);
    expect(html).not.toMatch(/Solution Revision Number/i);
    expect(html).not.toMatch(/solutionRevisionNumber/);
  });
});

function makeSyncHistoryEntry(
  overrides: Partial<SyncHistoryEntry> = {}
): SyncHistoryEntry {
  const timestamp = "2026-01-01T00:00:00.000Z";

  return {
    id: "entry-1",
    codingPlatform: "leetcode",
    status: "synced",
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    problemFrontendId: "1",
    language: "Swift",
    supportedLanguage: "swift",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: "123",
      titleSlug: "two-sum",
      language: "swift"
    },
    syncRepository,
    syncBranchName: "main",
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    commitSha: "commit-sha",
    commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
    fileUrl:
      "https://github.com/octo/algorithms/blob/main/leetcode/swift/0001_two_sum.swift",
    error: null,
    retryBundleId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function makeRetryBundleSummary(id: string): RetryBundleSummary {
  return {
    id,
    codingPlatform: "leetcode",
    syncDeduplicationKey: {
      codingPlatform: "leetcode",
      acceptedSourceId: "123",
      titleSlug: "two-sum",
      language: "swift"
    },
    attempts: 0,
    expiresAt: "2026-01-08T00:00:00.000Z",
    lastError: null
  };
}

function makeProgrammersSyncHistoryEntry(
  overrides: Partial<SyncHistoryEntry> = {}
): SyncHistoryEntry {
  return makeSyncHistoryEntry({
    codingPlatform: "programmers",
    titleSlug: "120804_두_수의_곱_구하기",
    problemTitle: "두 수의 곱 구하기",
    problemFrontendId: "120804",
    language: "Swift",
    supportedLanguage: "swift",
    syncDeduplicationKey: {
      codingPlatform: "programmers",
      acceptedSourceId: "programmers:120804:swift:abc1234",
      titleSlug: "120804_두_수의_곱_구하기",
      language: "swift"
    },
    solutionPath: "programmers/swift/120804_두_수의_곱_구하기.swift",
    commitUrl: "https://github.com/octo/algorithms/commit/programmers-sha",
    fileUrl:
      "https://github.com/octo/algorithms/blob/main/programmers/swift/120804_두_수의_곱_구하기.swift",
    ...overrides
  });
}

function makeError(
  code: NormalizedError["code"],
  userMessage: string
): NormalizedError {
  return {
    code,
    userMessage,
    debugMessage: null,
    retryable: code === "github_commit_failed"
  };
}

function makePublicSettings(): PublicSettingsState {
  return {
    version: STORAGE_SCHEMA_VERSION,
    hasGithubPat: true,
    syncRepository: syncRepository,
    syncBranch: {
      name: "main",
      sha: "branch-sha",
      protected: false
    },
    autoSyncEnabled: true,
    uiLanguage: DEFAULT_UI_LANGUAGE,
    connectionStatus: {
      code: "connected",
      checkedAt: "2026-01-01T00:00:00.000Z",
      error: null
    },
    updatedAt: "2026-01-01T00:00:00.000Z"
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
