import { describe, expect, it } from "vitest";

import type { NormalizedError } from "../shared/errors";
import type { SyncHistoryEntry } from "../shared/types";
import { createToastModel } from "./toast";

describe("content toast model", () => {
  it("maps setup required status to a localized Options action", () => {
    const model = createToastModel({
      status: "setup_required",
      syncHistoryEntry: null,
      error: error("setup_required", "GitHub connection required.")
    }, "ko");

    expect(model).toMatchObject({
      state: "setup_required",
      title: "GitHub 연결 필요",
      detail: "Options에서 저장소를 연결하세요.",
      tone: "warning",
      locale: "ko",
      dismissLabel: "닫기",
      autoDismissMs: null,
      actions: [
        {
          action: "open_options",
          label: "Options 열기",
          primary: true
        }
      ]
    });
  });

  it("maps Auto Sync off status to a short localized recovery toast", () => {
    const model = createToastModel({
      status: "auto_sync_disabled",
      syncHistoryEntry: makeRecord({
        status: "auto_sync_disabled"
      }),
      error: error("auto_sync_disabled", "Auto Sync is off.")
    }, "ko");

    expect(model).toMatchObject({
      state: "auto_sync_disabled",
      title: "Auto Sync 꺼짐",
      detail: "Commit이 생성되지 않았습니다.",
      tone: "warning",
      autoDismissMs: 7000,
      actions: [
        {
          action: "open_options",
          label: "Options 열기",
          primary: true
        }
      ]
    });
  });

  it("maps syncing and retrying states to progress toasts without actions", () => {
    const syncing = createToastModel({
      status: "syncing",
      syncHistoryEntry: makeRecord({
        status: "syncing"
      }),
      error: null
    });
    const retrying = createToastModel({
      status: "retrying",
      syncHistoryEntry: makeProgrammersRecord({
        status: "retrying"
      }),
      error: null
    }, "ko");

    expect(syncing).toMatchObject({
      state: "syncing",
      title: "Syncing to GitHub...",
      detail: "Two Sum in Swift",
      tone: "neutral",
      actions: [],
      autoDismissMs: null
    });
    expect(retrying).toMatchObject({
      state: "retrying",
      title: "Sync 재시도 중...",
      detail: "두 수의 곱 구하기, Swift",
      tone: "neutral",
      actions: [],
      autoDismissMs: null
    });
  });

  it("maps successful sync records to commit and file actions", () => {
    const model = createToastModel({
      status: "synced",
      syncHistoryEntry: makeRecord({
        status: "synced",
        commitUrl: "https://github.example/commit",
        fileUrl: "https://github.example/file"
      }),
      error: null
    });

    expect(model).toMatchObject({
      state: "synced",
      title: "Synced to GitHub",
      tone: "success",
      autoDismissMs: 5000,
      actions: [
        {
          action: "open_commit",
          label: "Commit",
          recordId: "record-1"
        },
        {
          action: "open_file",
          label: "File",
          recordId: "record-1"
        },
        {
          action: "dismiss",
          label: "Dismiss",
          recordId: null
        }
      ]
    });
  });

  it("renders Programmers synced records with commit and file actions", () => {
    const model = createToastModel({
      status: "synced",
      syncHistoryEntry: makeProgrammersRecord({
        status: "synced",
        commitUrl: "https://github.example/programmers-commit",
        fileUrl: "https://github.example/programmers-file"
      }),
      error: null
    });

    expect(model).toMatchObject({
      state: "synced",
      title: "Synced to GitHub",
      detail: "두 수의 곱 구하기 in Swift",
      tone: "success",
      actions: [
        {
          action: "open_commit",
          label: "Commit",
          recordId: "record-1"
        },
        {
          action: "open_file",
          label: "File",
          recordId: "record-1"
        },
        {
          action: "dismiss",
          label: "Dismiss",
          recordId: null
        }
      ]
    });
  });

  it("maps unsupported language status to a localized auto-dismiss toast", () => {
    const model = createToastModel({
      status: "unsupported_language",
      syncHistoryEntry: makeRecord({
        status: "unsupported_language",
        language: "JavaScript",
        supportedLanguage: null
      }),
      error: error("unsupported_language", "Unsupported language.")
    }, "ko");

    expect(model).toMatchObject({
      state: "unsupported_language",
      title: "미지원 언어",
      detail: "JavaScript 제출은 sync하지 않습니다.",
      tone: "warning",
      actions: [],
      autoDismissMs: 8000
    });
  });

  it("renders Programmers extraction failures without retry actions", () => {
    const model = createToastModel({
      status: "failed",
      syncHistoryEntry: makeProgrammersRecord({
        status: "failed",
        error: error(
          "programmers_extract_failed",
          "Could not read the Programmers editor code."
        )
      }),
      error: error(
        "programmers_extract_failed",
        "Could not read the Programmers editor code."
      )
    });

    expect(model).toMatchObject({
      state: "failed",
      title: "Sync failed",
      detail: "Could not read the Programmers editor code.",
      tone: "error",
      actions: []
    });
  });

  it("falls back to the platform label for incomplete Programmers records", () => {
    const model = createToastModel({
      status: "failed",
      syncHistoryEntry: makeProgrammersRecord({
        titleSlug: "",
        problemTitle: null,
        problemFrontendId: null,
        language: "Swift",
        supportedLanguage: null,
        error: error(
          "programmers_extract_failed",
          "Could not read the Programmers editor code."
        )
      }),
      error: error(
        "programmers_extract_failed",
        "Could not read the Programmers editor code."
      )
    });

    expect(model.detail).toBe("Could not read the Programmers editor code.");

    const syncing = createToastModel({
      status: "syncing",
      syncHistoryEntry: makeProgrammersRecord({
        titleSlug: "",
        problemTitle: null,
        problemFrontendId: null
      }),
      error: null
    });

    expect(syncing.detail).toBe("Programmers in Swift");
  });

  it("uses short user-facing errors without debug detail", () => {
    const model = createToastModel({
      status: "failed",
      syncHistoryEntry: makeRecord({
        status: "failed",
        error: error("github_commit_failed", "GitHub commit failed.", "stack trace")
      }),
      error: error("github_commit_failed", "GitHub commit failed.", "stack trace")
    });

    expect(model.title).toBe("Sync failed");
    expect(model.detail).toBe("GitHub commit failed.");
    expect(model.detail).not.toContain("stack trace");
    expect(model.actions).toMatchObject([
      {
        action: "open_options",
        label: "Open Options"
      }
    ]);
  });

  it("shows Retry only when a failed record has a retry payload", () => {
    const retryable = createToastModel({
      status: "failed",
      syncHistoryEntry: makeRecord({
        status: "failed",
        retryBundleId: "retry-1",
        error: error("github_commit_failed", "GitHub commit failed.")
      }),
      error: error("github_commit_failed", "GitHub commit failed.")
    }, "ko");
    const noPayload = createToastModel({
      status: "failed",
      syncHistoryEntry: makeRecord({
        status: "failed",
        retryBundleId: null,
        error: error("github_commit_failed", "GitHub commit failed.")
      }),
      error: error("github_commit_failed", "GitHub commit failed.")
    }, "ko");

    expect(retryable.actions).toMatchObject([
      {
        action: "retry",
        label: "재시도",
        recordId: "record-1",
        primary: true
      },
      {
        action: "open_options",
        label: "Options 열기",
        recordId: null,
        primary: false
      }
    ]);
    expect(noPayload.actions).toMatchObject([
      {
        action: "open_options",
        label: "Options 열기",
        primary: true
      }
    ]);
  });
});

function makeRecord(overrides: Partial<SyncHistoryEntry>): SyncHistoryEntry {
  return {
    id: "record-1",
    codingPlatform: "leetcode",
    status: "syncing",
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
    syncRepository: null,
    syncBranchName: "main",
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    commitSha: null,
    commitUrl: null,
    fileUrl: null,
    error: null,
    retryBundleId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function makeProgrammersRecord(overrides: Partial<SyncHistoryEntry>): SyncHistoryEntry {
  return makeRecord({
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

function error(
  code: NormalizedError["code"],
  userMessage: string,
  debugMessage: string | null = null
): NormalizedError {
  return {
    code,
    userMessage,
    debugMessage,
    retryable: false
  };
}
