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

/** Sealed E2E가 실제 도메인 URL로 fulfill할 캡처 기반 page.
 *
 * 손으로 지은 fixture를 쓰지 않는다. adapter와 fixture를 같은 사람이
 * 상상해서 만들면 둘이 함께 틀리고, 그때 테스트는 통과한다. */
export interface SealedFixture {
  /** manifest match가 걸려야 하므로 실제 도메인이다. */
  readonly url: string;
  /** 제출 전 상태. */
  readonly idle: string;
  /** Accepted 결과가 나타난 상태. */
  readonly accepted: string;
  /** 실패 결과가 나타난 상태. event가 0회여야 한다. */
  readonly rejected: string;
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
