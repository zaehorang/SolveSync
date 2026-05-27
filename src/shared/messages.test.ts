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
