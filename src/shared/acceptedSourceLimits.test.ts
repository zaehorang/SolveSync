import { describe, expect, it } from "vitest";

import {
  MAX_ACCEPTED_CODE_BYTES,
  acceptedCodeByteLength,
  isAcceptedCodeWithinLimit,
  isAcceptedTitleWithinLimit
} from "./acceptedSourceLimits";

describe("Accepted source limits", () => {
  it("uses UTF-8 bytes and accepts the exact code boundary", () => {
    expect(isAcceptedCodeWithinLimit("a".repeat(MAX_ACCEPTED_CODE_BYTES))).toBe(
      true
    );
    expect(
      isAcceptedCodeWithinLimit("a".repeat(MAX_ACCEPTED_CODE_BYTES + 1))
    ).toBe(false);
    expect(acceptedCodeByteLength("🙂")).toBe(4);
  });

  it("rejects blank code and counts titles by Unicode code point", () => {
    expect(isAcceptedCodeWithinLimit(" \n\t")).toBe(false);
    expect(isAcceptedTitleWithinLimit("🙂".repeat(300))).toBe(true);
    expect(isAcceptedTitleWithinLimit("🙂".repeat(301))).toBe(false);
  });
});
