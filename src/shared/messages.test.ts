import { describe, expect, it } from "vitest";

import {
  RUNTIME_MESSAGE_TYPES,
  RETRY_BUNDLES_READ_TYPE,
  SYNC_HISTORY_READ_TYPE,
  SYNC_HISTORY_UPDATED_TYPE,
  hasForbiddenMessageSecretKey,
  isRuntimeMessage,
  normalizeRuntimeMessage,
  type RuntimeMessage
} from "./messages";

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
        "settings:write",
        "github:repositories:list",
        "github:branches:list",
        "github:branch:create",
        "github:connection:test",
        "sync:retry",
        SYNC_HISTORY_READ_TYPE,
        RETRY_BUNDLES_READ_TYPE,
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
          version: 4,
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
  });
});
