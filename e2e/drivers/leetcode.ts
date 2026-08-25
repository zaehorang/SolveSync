/** LeetCode Platform E2E Driver.
 *
 * 셋 중 Sealed가 가장 얇은 것이 정상이다. code가 DOM이 아니라 background
 * GraphQL에서 오므로 Sealed의 종료점은 Sync History 도달까지이고, 그 아래는
 * `src/background/client/leetcode.test.ts`가 덮는다.
 */
import type { Page } from "@playwright/test";

import { BASE_PROBLEMS } from "../capture/baseProblems";
import type { PlatformE2EDriver, SealedFixture, SealedOutcome } from "./types";

const BASE_PROBLEM = BASE_PROBLEMS.leetcode;

const TITLE_SLUG = "two-sum";

/** 판정이 오기 전 자리를 지키는 text. 캡처에서 이 값이 제자리에서 바뀌었다. */
const PENDING_TEXT = "Judging...";

/** 실제 캡처에서 온 판정 text (2026-08-25, Two Sum). */
const RESULT_TEXT: Record<SealedOutcome, string> = {
  accepted: "Accepted",
  rejected: "Wrong Answer"
};

function notImplemented(what: string): never {
  throw new Error(`${what}는 실제 page를 보고 확정한다.`);
}

export const leetcodeDriver: PlatformE2EDriver = {
  platform: "leetcode",

  fixture(): SealedFixture {
    return {
      url: BASE_PROBLEM.url,

      // page에 일반 copy를 함께 둔다. `Accepted`는 짧은 단어라 문제 page
      // 어디에나 나타나고, 실제로 캡처 중에 통계 copy가 판정보다 먼저 걸려
      // `Judging...` 상태의 fixture가 만들어진 적이 있다. 뼈대에 그 copy가
      // 없으면 이 계층은 그 오탐을 영영 보지 못한다.
      html: () =>
        [
          "<!doctype html>",
          '<html lang="en">',
          '<head><meta charset="utf-8"><title>Two Sum - LeetCode</title></head>',
          "<body>",
          "<p>Acceptance Rate 56.1%</p>",
          "<p>Accepted 23,208,748/40M</p>",
          `<div data-e2e="result"><span>${PENDING_TEXT}</span></div>`,
          "</body>",
          "</html>"
        ].join("\n"),

      resultText: (outcome) => RESULT_TEXT[outcome],

      /** 캡처에서 LeetCode는 **node 추가가 아니라 대기 text의 제자리 교체**다.
       *
       * `characterData` mutation의 `oldValue`가 판정 전 문구여야 adapter가
       * "이번 mutation이 만들어낸 Accepted"로 읽는다. node를 새로 넣으면
       * 실제 page가 하지 않는 방식으로 통과시키게 된다. */
      async showResult(page: Page, outcome: SealedOutcome): Promise<void> {
        await page.evaluate((text) => {
          const node = document.querySelector('[data-e2e="result"] span')
            ?.firstChild;

          if (node === null || node === undefined) {
            throw new Error("뼈대에 대기 text node가 없다.");
          }

          node.nodeValue = text;
        }, RESULT_TEXT[outcome]);
      }
    };
  },

  // `syntheticPayload`를 두지 않는다. code도 제목도 background가 GraphQL로
  // 조회하고 그 조회에는 플랫폼 로그인 세션과 실제 제출 기록이 필요하다.
  // 합성 payload로는 `leetcode_fetch_failed`로 끝난다(2026-08-25 실측).
  // 이 플랫폼의 GitHub write 경로는 풀사이클이 실증한다.

  liveUrl(): string {
    return BASE_PROBLEM.url;
  },

  async assertContract(_page: Page): Promise<void> {
    notImplemented("LeetCode Contract Check");
  },

  async submit(_page: Page, _code: string): Promise<void> {
    notImplemented("LeetCode 자동 제출");
  }
};
