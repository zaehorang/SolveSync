import { describe, expect, it } from "vitest";

import {
  RUNTIME_MESSAGE_TYPES,
  hasForbiddenMessageSecretKey,
  isRuntimeMessage,
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
        "history:read",
        "retry-payloads:read",
        "sync:status",
        "history:updated"
      ])
    );
  });

  it("supports platform-discriminated accepted detected messages", () => {
    const leetcodeMessage: RuntimeMessage = {
      type: "content:accepted_detected",
      payload: {
        platform: "leetcode",
        titleSlug: "two-sum",
        pageUrl: "https://leetcode.com/problems/two-sum/",
        detectedAt: "2026-01-01T00:00:00.000Z"
      }
    };
    const programmersMessage: RuntimeMessage = {
      type: "content:accepted_detected",
      payload: {
        platform: "programmers",
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

  it("accepts typed content toast retry actions without exposing retry payload code", () => {
    const message: RuntimeMessage = {
      type: "content:toast_action",
      payload: {
        action: "retry",
        recordId: "record-1"
      }
    };

    expect(isRuntimeMessage(message)).toBe(true);
    expect(JSON.stringify(message)).not.toContain("class Solution");
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
