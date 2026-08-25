/** LeetCode Platform E2E Driver.
 *
 * 셋 중 Sealed가 가장 얇은 것이 정상이다. code가 DOM이 아니라 background
 * GraphQL에서 오므로 Sealed의 종료점은 Sync History 도달까지이고, 그 아래는
 * `src/background/client/leetcode.test.ts`가 덮는다.
 */
import { expect, type Page } from "@playwright/test";

import {
  extractTitleSlugFromPathname,
  isAcceptedResultText
} from "../../src/content/platforms/leetcode";

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

/** 판정이 보는 것과 같은 단위로 page text를 모은다.
 *
 * `mutationText.ts`가 leaf text를 후보로 삼으므로 여기서도 자식 없는
 * element의 text만 본다. 길이 상한도 같은 값을 쓴다. */
async function collectLeafTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const texts: string[] = [];

    for (const element of document.body.querySelectorAll("*")) {
      if (element.children.length > 0) {
        continue;
      }

      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();

      if (text.length > 0 && text.length <= 180) {
        texts.push(text);
      }
    }

    return [...new Set(texts)];
  });
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

  /** 이 플랫폼의 Adapter에는 **selector가 하나도 없다.** route는 URL에서,
   * 판정은 mutation 안의 text에서, code는 background GraphQL에서 온다.
   * 그래서 확인할 것도 selector 도달이 아니라 **판정 규칙이 실제 page의
   * 문구와 아직 맞물려 있는가**다.
   *
   * `/problems/{titleSlug}`는 공개라 로그인이 필요 없다. 셋 중 가장 싸다. */
  async assertContract(page: Page): Promise<void> {
    // ① route가 실제 URL에서 확정되는가. SPA가 `/description/`을 덧붙이는
    //    것을 실측했으므로(2026-08-25) 그것도 통과해야 한다.
    const titleSlug = extractTitleSlugFromPathname(new URL(page.url()).pathname);

    expect(titleSlug, `route를 확정하지 못했다: ${page.url()}`).toBe(TITLE_SLUG);

    const texts = await collectLeafTexts(page);

    // ② page가 진짜로 떴는가. bot 차단 화면이면 아래 단언들이 전부 공허하게
    //    통과한다. 문제 제목이 없으면 그 상태로 본다.
    //
    //    실패 메시지에 실제로 본 것을 담는다. "제목이 없다"만으로는 차단인지
    //    page 구조 변경인지 구분할 수 없고, 그 구분이 이 계층의 핵심이다.
    //    Cloudflare 차단은 `Just a moment...` 제목으로 온다(2026-08-25 실측).
    expect(
      texts.some((text) => /two sum/i.test(text)),
      `문제 제목이 없다. document.title=${JSON.stringify(
        await page.title()
      )} leaf=${texts.length}개 앞부분=${JSON.stringify(texts.slice(0, 5))}`
    ).toBe(true);

    // ③ 제외 pattern이 실제 copy와 아직 맞물리는가. `Acceptance Rate`가
    //    사라지거나 문구가 바뀌면 제외가 조용히 무력해진다.
    const genericCopy = texts.filter((text) => /acceptance rate/i.test(text));

    expect(
      genericCopy.length,
      "`Acceptance Rate` copy가 없다. 제외 pattern이 실제 page와 어긋났을 수 있다."
    ).toBeGreaterThan(0);

    for (const text of genericCopy) {
      expect(
        isAcceptedResultText(text),
        `일반 copy가 결과로 분류된다: ${text}`
      ).toBe(false);
    }

    // ④ 제출 전 page에 결과 형식 text가 있으면 안 된다. 있다면 그것은
    //    판정이 결과 panel 밖 어딘가에도 걸린다는 뜻이다.
    const resultShaped = texts.filter((text) =>
      /\baccepted\b\s+\d+\s*\/\s*\d+\s+testcases?\s+passed\b/i.test(text)
    );

    expect(
      resultShaped,
      "제출하지 않았는데 결과 형식 text가 page에 있다."
    ).toEqual([]);

    // ⑤ 풀이 완료 badge 개수를 남긴다. 단언하지 않는다 — 있어도 정상이고
    //    없어도 정상이다. 조사 메모의 근거가 최신인지 보는 눈금이다.
    //    docs/investigations/LEETCODE_SOLVED_BADGE_FALSE_ACCEPTED.md
    const soloAccepted = texts.filter((text) => /^accepted$/i.test(text));

    console.info(
      `[contract] leetcode 단독 \`Accepted\` leaf: ${soloAccepted.length}개`
    );
  },

  async submit(_page: Page, _code: string): Promise<void> {
    notImplemented("LeetCode 자동 제출");
  }
};
