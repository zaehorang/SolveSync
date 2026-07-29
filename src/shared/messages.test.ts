import { describe, expect, it } from "vitest";

import {
  RUNTIME_MESSAGE_TYPES,
  RETRY_BUNDLES_READ_TYPE,
  SYNC_HISTORY_READ_TYPE,
  SYNC_HISTORY_UPDATED_TYPE,
  hasForbiddenMessageSecretKey,
  isRuntimeMessagePayloadTooLarge,
  isRuntimeMessage,
  normalizeRuntimeMessage,
  type RuntimeMessage
} from "./messages";
import { STORAGE_SCHEMA_VERSION } from "./storageSchema";

describe("runtime message contracts", () => {
  it("keeps scaffold messages valid for existing entry points", () => {
    const message: RuntimeMessage = {
      type: "scaffold:ready",
      surface: "content"
    };

    expect(isRuntimeMessage(message)).toBe(true);
    expect(RUNTIME_MESSAGE_TYPES).toContain("scaffold:ready");
  });

  it("includes required message categories", () => {
    expect(RUNTIME_MESSAGE_TYPES).toEqual(
      expect.arrayContaining([
        "content:accepted_detected",
        "content:toast_action",
        "settings:read",
        "ui:locale:read",
        "settings:write",
        "github:auth:start",
        "github:auth:read",
        "github:auth:poll",
        "github:auth:disconnect",
        "github:installation:open",
        "github:repositories:list",
        "github:branches:list",
        "github:branch:create",
        "github:connection:test",
        "sync:retry",
        SYNC_HISTORY_READ_TYPE,
        RETRY_BUNDLES_READ_TYPE,
        "storage:retry-bundles:clear",
        "storage:clear-all",
        "sync:status",
        SYNC_HISTORY_UPDATED_TYPE
      ])
    );
  });

  it("normalizes legacy Sync History and Retry Bundle message aliases", () => {
    expect(
      normalizeRuntimeMessage({
        type: "history:read",
        payload: {
          limit: 20
        }
      })
    ).toEqual({
      type: SYNC_HISTORY_READ_TYPE,
      payload: {
        limit: 20
      }
    });
    expect(
      normalizeRuntimeMessage({
        type: "retry-payloads:read"
      })
    ).toEqual({
      type: RETRY_BUNDLES_READ_TYPE
    });
    expect(
      normalizeRuntimeMessage({
        type: "sync:retry",
        payload: {
          retryPayloadId: "retry-1"
        }
      })
    ).toEqual({
      type: "sync:retry",
      payload: {
        retryBundleId: "retry-1"
      }
    });
    expect(
      normalizeRuntimeMessage({
        type: "history:updated",
        payload: {
          history: {
            version: 4,
            entries: []
          }
        }
      })
    ).toEqual({
      type: SYNC_HISTORY_UPDATED_TYPE,
      payload: {
        syncHistory: {
          version: STORAGE_SCHEMA_VERSION,
          entries: []
        }
      }
    });
  });

  it("supports coding platform-discriminated accepted detected messages", () => {
    const leetcodeMessage: RuntimeMessage = {
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "leetcode",
        titleSlug: "two-sum",
        pageUrl: "https://leetcode.com/problems/two-sum/",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    };
    const programmersMessage: RuntimeMessage = {
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "programmers",
        courseId: "30",
        lessonId: "120804",
        problemTitle: "두 수의 곱 구하기",
        language: "Swift",
        code: "import Foundation\n",
        pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    };

    expect(isRuntimeMessage(leetcodeMessage)).toBe(true);
    expect(isRuntimeMessage(programmersMessage)).toBe(true);
  });

  it("enforces Accepted metadata limits and detects oversized UTF-8 code", () => {
    const makeProgrammersMessage = (overrides: Record<string, unknown> = {}) => ({
      type: "content:accepted_detected",
      payload: {
        codingPlatform: "programmers",
        courseId: "30",
        lessonId: "120804",
        problemTitle: "🙂".repeat(300),
        language: "Swift",
        code: "🙂".repeat(65_536),
        pageUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
        detectedAt: "2026-01-01T00:00:00.000Z",
        ...overrides
      }
    });

    expect(isRuntimeMessage(makeProgrammersMessage())).toBe(true);
    expect(
      isRuntimeMessage(
        makeProgrammersMessage({
          problemTitle: "🙂".repeat(301)
        })
      )
    ).toBe(false);
    const oversizedCodeMessage = makeProgrammersMessage({
      code: `${"🙂".repeat(65_536)}a`
    });
    expect(isRuntimeMessage(oversizedCodeMessage)).toBe(true);
    expect(isRuntimeMessagePayloadTooLarge(oversizedCodeMessage)).toBe(true);
    expect(
      isRuntimeMessage(
        makeProgrammersMessage({
          pageUrl: `https://school.programmers.co.kr/${"a".repeat(2_048)}`
        })
      )
    ).toBe(false);
  });

  it("rejects malformed message-specific payloads", () => {
    expect(
      isRuntimeMessage({
        type: "settings:write",
        payload: {
          update: {
            autoSyncEnabled: "yes"
          }
        }
      })
    ).toBe(false);
    expect(
      isRuntimeMessage({
        type: "github:branch:create",
        payload: {
          repository: {
            owner: "octo",
            name: "algorithms",
            fullName: "octo/algorithms",
            defaultBranch: "main",
            private: false,
            htmlUrl: "https://github.com/octo/algorithms"
          },
          branchName: "../invalid"
        }
      })
    ).toBe(false);
    expect(
      isRuntimeMessage({
        type: "content:toast_action",
        payload: {
          action: "retry",
          retryBundleId: 123
        }
      })
    ).toBe(false);
  });

  it("accepts typed content toast retry actions without exposing retry bundle code", () => {
    const message: RuntimeMessage = {
      type: "content:toast_action",
      payload: {
        action: "retry",
        syncHistoryEntryId: "entry-1",
        retryBundleId: "retry-1"
      }
    };

    expect(isRuntimeMessage(message)).toBe(true);
    expect(JSON.stringify(message)).not.toContain("class Solution");
  });

  it("normalizes legacy content toast action entry ids", () => {
    expect(
      normalizeRuntimeMessage({
        type: "content:toast_action",
        payload: {
          action: "open_commit",
          recordId: "entry-1"
        }
      })
    ).toEqual({
      type: "content:toast_action",
      payload: {
        action: "open_commit",
        syncHistoryEntryId: "entry-1",
        retryBundleId: null
      }
    });
  });

  it("rejects runtime messages with secret-bearing payload keys", () => {
    const unsafeMessage = {
      type: "settings:write",
      payload: {
        update: {
          githubPat: "redacted-local-value"
        }
      }
    };

    expect(hasForbiddenMessageSecretKey(unsafeMessage)).toBe(true);
    expect(isRuntimeMessage(unsafeMessage)).toBe(false);
    expect(
      hasForbiddenMessageSecretKey({
        type: "github:auth:poll",
        payload: {
          accessToken: "redacted",
          refreshToken: "redacted",
          deviceCode: "redacted"
        }
      })
    ).toBe(true);
  });
});
