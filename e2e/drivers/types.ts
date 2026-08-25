/** Platform E2E Driver 계약.
 *
 * 공통 spec이 이 인터페이스만 보고 세 플랫폼을 같은 시나리오로 돌린다.
 * 플랫폼별 spec을 세 번 쓰지 않기 위한 구조이며, 새 Coding Platform은
 * 드라이버 하나로 검증 계층 전체에 붙는다.
 *
 * TODO(Phase 3): 공통 spec과 support를 만든다.
 * TODO(Phase 4): 플랫폼별 구현체를 만든다.
 * `docs/plans/e2e/`를 따른다.
 */
import type { Page } from "@playwright/test";

import type { AcceptedDetectedPayload, CodingPlatform } from "../../src/shared";

export type SealedOutcome = "accepted" | "rejected";

/** Sealed E2E가 실제 도메인 URL로 fulfill할 page와 결과 재생.
 *
 * **캡처는 DOM snapshot이 아니라 mutation 기록이다.** 게다가 mutation의
 * `target`에 node 경로가 없어(`{kind, name}`뿐) 기록을 그대로 되감을 수 없다.
 * 그래서 fixture가 주는 것은 **실제 page에서 온 판정 text**이고, 뼈대는
 * 드라이버가 최소한으로 짓는다. 상상한 값이 판정에 들어가지 않는 것이
 * 이 분담의 목적이므로 `resultText`는 반드시 캡처에 실재해야 하고,
 * 공통 spec이 그것을 먼저 확인한 뒤에야 재생한다.
 */
export interface SealedFixture {
  /** manifest match가 걸려야 하므로 실제 도메인이다. */
  readonly url: string;

  /** 최소 뼈대. Adapter가 route를 확정하는 데 필요한 element만 담는다. */
  html(): string;

  /** 캡처에서 온 판정 text. `e2e/fixtures/{platform}/{outcome}.json`에
   * 실재하는 문자열이어야 한다. */
  resultText(outcome: SealedOutcome): string;

  /** 그 text를 실제 page가 하던 방식으로 나타나게 한다.
   *
   * 플랫폼마다 방식이 다르다 — SWEA는 node 추가, LeetCode는 대기 text의
   * 제자리 교체, Programmers는 내용과 visibility가 서로 다른 batch로 온다.
   * **Programmers에서 두 batch를 하나로 합치면 판정이 성립하지 않는다.** */
  showResult(page: Page, outcome: SealedOutcome): Promise<void>;
}

export interface PlatformE2EDriver {
  readonly platform: CodingPlatform;

  /** Sealed E2E 입력. */
  fixture(): SealedFixture;

  /** GitHub write 계층이 확장 options page에서 보낼 합성 payload.
   *
   * 플랫폼 page 없이 orchestration 전 구간을 태운다. */
  syntheticPayload(): AcceptedDetectedPayload;

  /** Contract Check와 풀사이클이 여는 기준 문제 URL.
   *
   * 플랫폼마다 고정한다. 같은 문제로 반복해야 결과를 비교할 수 있고,
   * 실사용 풀이와 겹치지 않아야 Sync Deduplication Key가 오염되지 않는다. */
  liveUrl(): string;

  /** Contract Check. 제출하지 않고 Adapter가 의존하는 DOM 도달 가능성만
   * 확인한다. selector가 사라졌을 때 어느 플랫폼의 무엇이 깨졌는지
   * 식별 가능한 형태로 실패해야 한다. */
  assertContract(page: Page): Promise<void>;

  /** 풀사이클의 실제 제출. 제품이 쓰지 않는 selector는 여기에만 있다.
   *
   * `E2E_LIVE_SUBMIT=1`과 사용자 승인이 있을 때만 호출된다. 실사용 계정에
   * 영구 기록이 남고 SWEA는 문제당 제출 상한이 99회다.
   *
   * Programmers와 SWEA는 `acceptedSourceId`에 code hash가 들어가므로
   * 반복 실행 시 code가 매번 달라야 한다. 같으면 중복으로 걸러져 commit이
   * 생기지 않고, 그 통과는 거짓이다. */
  submit(page: Page, code: string): Promise<void>;
}
