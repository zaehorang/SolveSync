/** Coding Platform Adapter registry.
 *
 * 새 Coding Platform은 구현체 하나와 이 배열 한 줄로 추가된다. 이전에는
 * `platform === "..."` 분기 12곳을 찾아 고쳐야 했다.
 */
import { createLeetCodeAdapter } from "./leetcode";
import { createProgrammersAdapter } from "./programmers";
import { createSweaAdapter } from "./swea";
import type { PlatformAdapter, PlatformPageDocument, ResolvedRoute } from "./types";

export * from "./types";

/** 공통 계약 테스트가 순회하는 목록이기도 하다. */
export const PLATFORM_ADAPTERS: readonly PlatformAdapter[] = [
  createLeetCodeAdapter(),
  createProgrammersAdapter(),
  createSweaAdapter()
];

/** 지원하는 route를 찾지 못하면 null. 호출부는 unsupported로 처리한다. */
export function resolveRoute(
  url: URL,
  doc: PlatformPageDocument,
  adapters: readonly PlatformAdapter[] = PLATFORM_ADAPTERS
): ResolvedRoute | null {
  for (const adapter of adapters) {
    const route = adapter.resolveRoute(url, doc);

    if (route !== null) {
      return route;
    }
  }

  return null;
}
