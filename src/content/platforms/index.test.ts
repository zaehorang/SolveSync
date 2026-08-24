import { describe, expect, it } from "vitest";

import { PLATFORM_ADAPTERS, resolveRoute } from "./index";
import type { PlatformAdapter, PlatformObservation, ResolvedRoute } from "./types";

const emptyDocument = { querySelector: () => null };

function stubAdapter(
  platform: PlatformAdapter["platform"],
  route: ResolvedRoute | null
): PlatformAdapter {
  return {
    platform,
    resolveRoute: () => route
  };
}

function stubRoute(platform: PlatformAdapter["platform"], key: string): ResolvedRoute {
  return {
    platform,
    key,
    observe: (): PlatformObservation => ({
      targets: () => [],
      detect: () => null
    })
  };
}

describe("resolveRoute", () => {
  it("첫 번째로 route를 확정한 adapter의 결과를 돌려준다", () => {
    const expected = stubRoute("programmers", "programmers:1:2");

    const resolved = resolveRoute(new URL("https://example.test/"), emptyDocument, [
      stubAdapter("leetcode", null),
      stubAdapter("programmers", expected),
      stubAdapter("swea", stubRoute("swea", "swea:9999"))
    ]);

    expect(resolved).toBe(expected);
  });

  it("어느 adapter도 route를 확정하지 못하면 null이다", () => {
    const resolved = resolveRoute(new URL("https://example.test/"), emptyDocument, [
      stubAdapter("leetcode", null),
      stubAdapter("programmers", null)
    ]);

    expect(resolved).toBeNull();
  });

  it("세 Coding Platform이 모두 등록되어 있다", () => {
    expect(PLATFORM_ADAPTERS.map((adapter) => adapter.platform)).toEqual([
      "leetcode",
      "programmers",
      "swea"
    ]);
  });
});
