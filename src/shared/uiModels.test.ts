import { describe, expect, it } from "vitest";

import type { NormalizedError } from "./errors";
import {
  createToastViewModel,
  getConnectionStatusView,
  getFailureDetailView,
  getSetupStatusView,
  getSyncStatusLabel,
  getSyncStatusTone
} from "./uiModels";
import {
  STORAGE_SCHEMA_VERSION,
  type PublicSettingsState
} from "./storageSchema";
import type { SyncHistoryEntry, SyncRepository } from "./types";

describe("shared UI models", () => {
  it("maps connection status labels and details by locale", () => {
    const error = makeError("github_auth_failed", "GitHub authentication failed.");

    expect(getConnectionStatusView("en", "connected")).toMatchObject({
      label: "Connected",
      detail: null,
      tone: "success"
    });
    expect(getConnectionStatusView("ko", "no_accessible_repositories")).toMatchObject({
      label: "본인 저장소 없음",
      detail: "Token에 본인 소유 저장소가 포함되어 있는지 확인하세요.",
      tone: "warning"
    });
    expect(getConnectionStatusView("en", "auth_failed", error)).toMatchObject({
      label: "Auth failed",
      detail: "GitHub authentication failed.",
      tone: "error"
    });
  });

  it("summarizes setup state by locale", () => {
    expect(getSetupStatusView("en", null)).toMatchObject({
      label: "Loading settings",
      tone: "neutral"
    });
    expect(
      getSetupStatusView("ko", {
        ...makePublicSettings(),
        syncRepository: null
      })
    ).toMatchObject({
      label: "Sync Repository 필요",
      detail: "Options에서 Sync Repository를 선택하세요.",
      tone: "warning"
    });
    expect(
      getSetupStatusView("en", {
        ...makePublicSettings(),
        autoSyncEnabled: false
      })
    ).toMatchObject({
      label: "Auto Sync off",
      detail:
        "Configured for octo/algorithms / main. Accepted submissions will not create commits.",
      tone: "warning"
    });
  });

  it("maps sync status labels and tones by locale", () => {
    expect(getSyncStatusLabel("en", "unsupported_language")).toBe(
      "Unsupported language"
    );
    expect(getSyncStatusLabel("ko", "unsupported_language")).toBe("미지원 언어");
    expect(getSyncStatusTone("synced")).toBe("success");
    expect(getSyncStatusTone("failed")).toBe("error");
  });

  it("builds localized failure detail lines", () => {
    const failed = makeSyncHistoryEntry({
      status: "failed",
      retryBundleId: null,
      error: {
        ...makeError("github_branch_protected", "GitHub branch is protected."),
        debugMessage: "Protected branch update rejected."
      }
    });

    expect(getFailureDetailView("en", failed)).toEqual({
      summary: "GitHub branch is protected.",
      detailLines: [
        "Code: github_branch_protected",
        "Detail: Protected branch update rejected.",
        "Retry Bundle is unavailable. Check Options or submit again."
      ]
    });
    const programmersFailure = getFailureDetailView(
      "ko",
      makeSyncHistoryEntry({
        status: "failed",
        retryBundleId: null,
        error: makeError(
          "programmers_extract_failed",
          "Could not read the Programmers editor code."
        )
      })
    );

    expect(programmersFailure?.detailLines).toContain(
      "GitHub commit 데이터가 생성되지 않아 재시도할 수 없습니다."
    );
  });

  it("builds localized toast actions and stable product labels", () => {
    const synced = createToastViewModel("ko", {
      status: "synced",
      syncHistoryEntry: makeProgrammersSyncHistoryEntry({
        status: "synced",
        commitUrl: "https://github.example/commit",
        fileUrl: "https://github.example/file"
      }),
      error: null
    });

    expect(synced).toMatchObject({
      title: "GitHub에 동기화됨",
      detail: "두 수의 곱 구하기, Swift",
      tone: "success",
      actions: [
        {
          action: "open_commit",
          label: "Commit",
          syncHistoryEntryId: "entry-1",
          retryBundleId: null
        },
        {
          action: "open_file",
          label: "File",
          syncHistoryEntryId: "entry-1",
          retryBundleId: null
        },
        {
          action: "dismiss",
          label: "닫기",
          syncHistoryEntryId: null,
          retryBundleId: null
        }
      ]
    });

    const setup = createToastViewModel("en", {
      status: "setup_required",
      syncHistoryEntry: null,
      error: makeError("setup_required", "GitHub connection required.")
    });

    expect(setup.actions).toMatchObject([
      {
        action: "open_options",
        label: "Open Options",
        primary: true
      }
    ]);
  });

  it("shows retry action only when the toast input marks retry available", () => {
    const retryable = createToastViewModel("ko", {
      status: "failed",
      syncHistoryEntry: makeSyncHistoryEntry({
        status: "failed",
        retryBundleId: "retry-1",
        error: makeError("github_commit_failed", "Could not commit the solution.")
      }),
      error: makeError("github_commit_failed", "Could not commit the solution."),
      canRetry: true
    });
    const notRetryable = createToastViewModel("ko", {
      status: "failed",
      syncHistoryEntry: makeSyncHistoryEntry({
        status: "failed",
        retryBundleId: "retry-1",
        error: makeError("github_commit_failed", "Could not commit the solution.")
      }),
      error: makeError("github_commit_failed", "Could not commit the solution."),
      canRetry: false
    });

    expect(retryable.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "retry",
          label: "재시도",
          syncHistoryEntryId: "entry-1",
          retryBundleId: "retry-1"
        })
      ])
    );
    expect(notRetryable.actions.map((action) => action.label)).not.toContain("재시도");
  });
});

function makeSyncHistoryEntry(
  overrides: Partial<SyncHistoryEntry> = {}
): SyncHistoryEntry {
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
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
    ...overrides
  });
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
    uiLanguage: "system",
    connectionStatus: {
      code: "connected",
      checkedAt: "2026-01-01T00:00:00.000Z",
      error: null
    },
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
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

const syncRepository: SyncRepository = {
  owner: "octo",
  name: "algorithms",
  fullName: "octo/algorithms",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/octo/algorithms"
};
