import { describe, expect, it } from "vitest";

import type {
  NormalizedError,
  PublicSettingsState,
  RepositoryRef,
  RetryPayloadSummary,
  SyncRecord
} from "../shared";
import {
  buildHistoryDisplayModel,
  createAutoSyncToggleMessage,
  getFailureDetail,
  getSetupStatusView
} from "./index";

describe("popup state helpers", () => {
  it("sorts history records newest first for display", () => {
    const older = makeRecord({
      id: "older",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
    const newer = makeRecord({
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
      statusLabel: "Synced",
      timeLabel: "1m ago",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
      fileUrl:
        "https://github.com/octo/algorithms/blob/main/leetcode/swift/0001_two_sum.swift"
    });
  });

  it("shows retry only when the failed item still has a saved retry payload", () => {
    const failed = makeRecord({
      id: "failed",
      status: "failed",
      retryPayloadId: "retry-1",
      error: makeError("github_commit_failed", "Could not commit the solution.")
    });

    const withoutPayload = buildHistoryDisplayModel([failed], []);
    const withPayload = buildHistoryDisplayModel([failed], [
      makeRetryPayloadSummary("retry-1")
    ]);

    expect(withoutPayload.items[0]?.canRetry).toBe(false);
    expect(withPayload.items[0]?.canRetry).toBe(true);
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
    const failed = makeRecord({
      status: "failed",
      retryPayloadId: null,
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
        "Retry payload is unavailable. Check Options or submit again."
      ]
    });
  });

  it("explains unsupported language items without offering GitHub links", () => {
    const unsupported = makeRecord({
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
        selectedRepository: null
      })
    ).toMatchObject({
      label: "Repository required",
      detail: "Open Options and choose an owned repository.",
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

function makeRecord(overrides: Partial<SyncRecord> = {}): SyncRecord {
  const timestamp = "2026-01-01T00:00:00.000Z";

  return {
    id: "record-1",
    status: "synced",
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    problemFrontendId: "1",
    language: "Swift",
    supportedLanguage: "swift",
    identity: {
      submissionId: "123",
      titleSlug: "two-sum",
      language: "swift"
    },
    repository,
    branchName: "main",
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    commitSha: "commit-sha",
    commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
    fileUrl:
      "https://github.com/octo/algorithms/blob/main/leetcode/swift/0001_two_sum.swift",
    error: null,
    retryPayloadId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function makeRetryPayloadSummary(id: string): RetryPayloadSummary {
  return {
    id,
    identity: {
      submissionId: "123",
      titleSlug: "two-sum",
      language: "swift"
    },
    attempts: 0,
    expiresAt: "2026-01-08T00:00:00.000Z",
    lastError: null
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

function makePublicSettings(): PublicSettingsState {
  return {
    version: 1,
    hasGithubPat: true,
    selectedRepository: repository,
    selectedBranch: {
      name: "main",
      sha: "branch-sha",
      protected: false
    },
    autoSyncEnabled: true,
    connectionStatus: {
      code: "connected",
      checkedAt: "2026-01-01T00:00:00.000Z",
      error: null
    },
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

const repository: RepositoryRef = {
  owner: "octo",
  name: "algorithms",
  fullName: "octo/algorithms",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/octo/algorithms"
};
