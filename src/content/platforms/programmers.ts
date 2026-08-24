/** Programmers Coding Platform Adapter.
 *
 * TODO(Phase 2): 구현한다. `docs/plans/e2e/phase-2-adapters.md`를 따른다.
 *
 * 지금은 항상 null을 돌려주는 미구현 상태다. 실수로 배선되더라도 지원하지
 * 않는 route로 취급되어 event가 만들어지지 않는다. 현재 동작은
 * `acceptedDetectionController.ts`가 그대로 담당하고 있다.
 */
import type { PlatformAdapter, PlatformPageDocument, ResolvedRoute } from "./types";

export function createProgrammersAdapter(): PlatformAdapter {
  return {
    platform: "programmers",
    resolveRoute(_url: URL, _doc: PlatformPageDocument): ResolvedRoute | null {
      return null;
    }
  };
}
