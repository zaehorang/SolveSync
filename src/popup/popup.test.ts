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
    expect(model.items[0]).toMatchObject({
      title: "1. Two Sum",
      platformLabel: "LeetCode",
      meta: "LeetCode / Swift / 1m ago / octo/algorithms@main",
      statusLabel: "Synced",
      timeLabel: "1m ago",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
      fileUrl:
        "https://github.com/octo/algorithms/blob/main/leetcode/swift/0001_two_sum.swift"
    });
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
    expect(withPayload.items[0]?.canRetry).toBe(true);
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
      meta: "Programmers / Swift / 1m ago / octo/algorithms@main"
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
      meta: "Programmers / Swift / 1분 전 / octo/algorithms@main",
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
