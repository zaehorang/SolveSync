import { describe, expect, it } from "vitest";

import type { NormalizedError } from "../shared/errors";
import type { SyncRecord } from "../shared/types";
import { createToastModel } from "./toast";

describe("content toast model", () => {
  it("maps setup required status to an Options action", () => {
    const model = createToastModel({
      status: "setup_required",
      record: null,
      error: error("setup_required", "GitHub connection required.")
    });

    expect(model).toMatchObject({
      state: "setup_required",
      title: "GitHub connection required",
      tone: "warning",
      actions: [
        {
          action: "open_options",
          label: "Open Options"
        }
      ]
    });
  });

  it("maps successful sync records to commit and file actions", () => {
    const model = createToastModel({
      status: "synced",
      record: makeRecord({
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
        }
      ]
    });
  });

  it("renders Programmers synced records with commit and file actions", () => {
    const model = createToastModel({
      status: "synced",
      record: makeProgrammersRecord({
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
        }
      ]
    });
  });

  it("renders Programmers extraction failures without retry actions", () => {
    const model = createToastModel({
      status: "failed",
      record: makeProgrammersRecord({
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
      record: makeProgrammersRecord({
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
      record: makeProgrammersRecord({
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
      record: makeRecord({
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
});

function makeRecord(overrides: Partial<SyncRecord>): SyncRecord {
  return {
    id: "record-1",
    platform: "leetcode",
    status: "syncing",
    titleSlug: "two-sum",
    problemTitle: "Two Sum",
    problemFrontendId: "1",
    language: "Swift",
    supportedLanguage: "swift",
    identity: {
      platform: "leetcode",
      submissionId: "123",
      titleSlug: "two-sum",
      language: "swift"
    },
    repository: null,
    branchName: "main",
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    commitSha: null,
    commitUrl: null,
    fileUrl: null,
    error: null,
    retryPayloadId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function makeProgrammersRecord(overrides: Partial<SyncRecord>): SyncRecord {
  return makeRecord({
    platform: "programmers",
    titleSlug: "120804_두_수의_곱_구하기",
    problemTitle: "두 수의 곱 구하기",
    problemFrontendId: "120804",
    language: "Swift",
    supportedLanguage: "swift",
    identity: {
      platform: "programmers",
      submissionId: "programmers:120804:swift:abc1234",
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
