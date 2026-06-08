import { describe, expect, it } from "vitest";

import {
  createPopupRuntimeFixture,
  makePopupEmptyHistoryFixture,
  renderPopupStaticQaFixture
} from "./runtimeFixture";

describe("popup runtime fixture", () => {
  it("renders long content, retry states, and empty history test fixtures", () => {
    const richFixture = createPopupRuntimeFixture();
    const richHtml = renderPopupStaticQaFixture(
      richFixture.settings,
      richFixture.syncHistoryEntries,
      richFixture.retryBundles
    );
    const emptyFixture = makePopupEmptyHistoryFixture();
    const emptyHtml = renderPopupStaticQaFixture(
      emptyFixture.settings,
      emptyFixture.syncHistoryEntries,
      emptyFixture.retryBundles
    );

    expect(richHtml).toContain("history-retry-all-button");
    expect(richHtml).toContain("Minimum Cost to Make at Least One Valid Path");
    expect(richHtml).not.toMatch(/Solution Revision Number/i);
    expect(emptyHtml).toContain("Accepted submissions will appear here after sync runs.");
  });
});
