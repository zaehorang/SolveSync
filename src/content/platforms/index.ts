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

export interface PlatformAdapterDependencies {
  /** SWEA MAIN world bridge. 주입되지 않으면 empty code가 되어 background가
   * 실패로 기록한다 (ADR 0035). */
  requestSweaEditorCode?(): Promise<string | null>;
}

/** 공통 계약 테스트가 순회하는 목록이기도 하다. */
export function createPlatformAdapters(
  dependencies: PlatformAdapterDependencies = {}
): readonly PlatformAdapter[] {
  return [
    createLeetCodeAdapter(),
    createProgrammersAdapter(),
    createSweaAdapter({ requestEditorCode: dependencies.requestSweaEditorCode })
  ];
}

/** 지원하는 route를 찾지 못하면 null. 호출부는 지원하지 않는 page로 처리한다. */
export function resolveRoute(
  url: URL,
  doc: PlatformPageDocument,
  adapters: readonly PlatformAdapter[]
): ResolvedRoute | null {
  for (const adapter of adapters) {
    const route = adapter.resolveRoute(url, doc);

    if (route !== null) {
      return route;
    }
  }

  return null;
}
