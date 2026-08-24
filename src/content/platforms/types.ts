/** Coding Platform Adapter 계약.
 *
 * 한 Coding Platform의 관찰과 해석만 담는다. 억제 창, route generation과
 * 전달은 event controller가 소유하며 여기에 들어오지 않는다.
 *
 * 세 플랫폼의 Accepted 전이 판정은 파라미터가 아니라 방식으로 다르다.
 * LeetCode와 SWEA는 mutation 기반 무상태, Programmers는 presentation
 * 상태기계다. 그래서 `observeKind` 같은 구분 필드를 두지 않는다. 필드로
 * 나누면 controller가 다시 분기하게 되어 나눈 의미가 없어진다.
 * 자세한 차이는 `docs/platforms/README.md`의 "Accepted 감지가 갈리는 세 층".
 */
import type { AcceptedDetectedMessage, CodingPlatform } from "../../shared";

/** route를 확정하는 데 필요한 최소 document 표면 (ADR 0036).
 *
 * SWEA는 모든 문제가 같은 URL을 쓰므로 URL만으로 route를 알 수 없다. */
export type PlatformPageDocument = Pick<Document, "querySelector">;

/** 관찰과 source 수집에 필요한 document 표면. */
export type PlatformObservationDocument = Pick<
  Document,
  "body" | "documentElement" | "querySelector" | "title"
>;

/** observer에 걸 대상 하나. Programmers만 둘을 쓴다. */
export interface ObserveTarget {
  readonly node: Node;
  readonly init: MutationObserverInit;
}

/** Accepted Signal.
 *
 * fresh Accepted 전이를 확정한 시점에 캡처한 불변 snapshot이다. 조립에
 * 필요한 값을 전부 들고 있으므로 `toMessage`는 DOM을 다시 읽지 않는다
 * (ADR 0034). 이 계약이 주석이 아니라 closure로 보장되는 것이 이 모양을
 * 고른 이유다.
 */
export interface AcceptedSignal {
  /** 전이를 확정한 시각. 조립 시점이 아니다. */
  readonly detectedAt: string;
  /** SWEA만 Promise를 돌려준다.
   *
   * 일률적으로 Promise를 쓰지 않는 이유는 전달이 microtask로 밀리기
   * 때문이다. 밀리는 사이 page가 사라지면 event가 통째로 없어져 실패
   * 기록조차 남지 않는다 (ADR 0037). */
  toMessage(): AcceptedDetectedMessage | Promise<AcceptedDetectedMessage>;
}

/** 이번 batch를 판정하는 시점의 값. route key가 같아도 URL은 다를 수 있고,
 * 시각은 조립 시점이 아니라 전이 확정 시점이어야 한다 (ADR 0034). */
export interface DetectContext {
  readonly pageUrl: string;
  /** 전이를 확정한 시각. signal을 만들 때만 호출한다. mutation batch마다
   * 부르면 신호가 없는 대부분의 batch에서도 시각을 만들게 된다. */
  now(): string;
}

/** 이 관찰이 어떤 경위로 만들어졌는가.
 *
 * 같은 플랫폼 안에서의 route 이동과 다른 플랫폼에서의 진입은 presentation
 * state를 다르게 다뤄야 한다. 현재 Programmers만 이 값을 구분하며 나머지는
 * 무시한다. `otherPlatform`에서 진입 batch를 판정하지 않는 것이 현재 동작이고,
 * 그것이 `docs/investigations/`의 SPA 복귀 누락 후보와 닿아 있다. 리팩터링에서
 * 무심코 바꾸지 않기 위해 계약으로 드러낸다. */
export type RouteTransition = "startup" | "samePlatform" | "otherPlatform";

/** route 하나에 대한 관찰. route가 바뀌면 controller가 새로 만든다.
 *
 * reset 메서드를 두지 않는 이유가 이것이다. 새로 만들면 "route 변경 시
 * state 폐기"가 reset의 완전성에 기대지 않고 구조로 보장된다. */
export interface PlatformObservation {
  /** 현재 걸어야 할 대상. 값이 바뀌면 controller가 다시 건다. */
  targets(): readonly ObserveTarget[];
  /** 억제 여부와 무관하게 매 batch 호출된다. Programmers의 visibility
   * lifecycle이 억제 중에도 전진해야 re-arm이 맞기 때문이다. */
  detect(
    records: readonly MutationRecord[],
    context: DetectContext
  ): AcceptedSignal | null;
}

/** 확정된 route. key와 관찰 생성만 밖으로 내보내고 플랫폼별 route 데이터는
 * closure 안에 남긴다. 그래서 controller가 route 타입을 알 필요가 없다. */
export interface ResolvedRoute {
  readonly platform: CodingPlatform;
  /** 이 값이 바뀌면 controller가 관찰을 폐기하고 새로 만든다. */
  readonly key: string;
  observe(
    doc: PlatformObservationDocument,
    transition: RouteTransition
  ): PlatformObservation;
}

export interface PlatformAdapter {
  readonly platform: CodingPlatform;
  /** 이 URL과 DOM이 해당 플랫폼의 지원 route가 아니면 null. */
  resolveRoute(url: URL, doc: PlatformPageDocument): ResolvedRoute | null;
}
