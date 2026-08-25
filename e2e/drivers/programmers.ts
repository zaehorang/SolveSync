/** Programmers Platform E2E Driver.
 *
 * 세 플랫폼 중 Sealed E2E의 가치가 가장 크다. 판정이 **computed style에
 * 의존하는 visibility**를 보므로 jsdom으로는 원리상 덮이지 않는다.
 */
import { expect, type Page } from "@playwright/test";

import type { AcceptedDetectedPayload } from "../../src/shared/messages";
import { BASE_PROBLEMS } from "../capture/baseProblems";
import type { PlatformE2EDriver, SealedFixture, SealedOutcome } from "./types";

const BASE_PROBLEM = BASE_PROBLEMS.programmers;

const COURSE_ID = "30";
const LESSON_ID = "120804";

/** 캡처의 `problem` 그대로다(2026-08-25). adapter가 `og:title`에서 읽는다. */
const PROBLEM_TITLE = "두 수의 곱 구하기 (코딩테스트 입문)";

/** 캡처에 쓴 언어. `fixtures/solutions/programmers.*.swift`와 같다. */
const LANGUAGE = "swift";

/** 실제 캡처에서 온 `.modal-title` text (2026-08-25, lesson 120804). */
const RESULT_TEXT: Record<SealedOutcome, string> = {
  accepted: "정답입니다!",
  rejected: "틀렸습니다!"
};


export const programmersDriver: PlatformE2EDriver = {
  platform: "programmers",

  fixture(): SealedFixture {
    return {
      url: BASE_PROBLEM.url,

      // 뼈대의 초기 상태는 캡처의 `watchedBefore`와 같다 — `modal fade`,
      // `aria-hidden="true"`, computed `display: none`. 그 `display`가
      // 실제 stylesheet에서 오는 것이 중요하다. inline으로 두면 adapter가
      // 보는 것이 computed style이 아니게 된다.
      html: () =>
        [
          "<!doctype html>",
          '<html lang="ko">',
          "<head>",
          '<meta charset="utf-8">',
          `<meta property="og:title" content="${PROBLEM_TITLE}">`,
          "<title>프로그래머스</title>",
          "<style>.modal { display: none; }</style>",
          "</head>",
          "<body>",
          `<select name="language"><option value="${LANGUAGE}" selected>Swift</option></select>`,
          '<textarea id="code">func solution(_ a: Int, _ b: Int) -> Int { a * b }</textarea>',
          '<div class="modal fade" id="modal-dialog" tabindex="-1" role="dialog" aria-hidden="true">',
          '<div class="modal-title"></div>',
          "</div>",
          "</body>",
          "</html>"
        ].join("\n"),

      resultText: (outcome) => RESULT_TEXT[outcome],

      /** **두 batch로 나눠 재생한다.**
       *
       * 캡처가 그랬다 — batch N에서 `.modal-title`이 채워지지만 root는 아직
       * `display: none`이고, batch N+1에서 visibility만 바뀐다.
       *
       * **합치면 테스트가 약해진다.** 합쳐도 통과한다(2026-08-25 실측) —
       * 한 batch 안에 둘이 함께 오면 adapter가 그 자리에서 전이를 만든다.
       * 그래서 합친 재생은 state를 batch 사이에 들고 가지 않는 구현도
       * 통과시킨다. 실제 page가 하는 대로 나눠야 그 구조를 검증한다. */
      async showResult(page: Page, outcome: SealedOutcome): Promise<void> {
        await page.evaluate((text) => {
          const title = document.querySelector("#modal-dialog .modal-title");

          if (title === null) {
            throw new Error("뼈대에 .modal-title이 없다.");
          }

          title.textContent = text;
        }, RESULT_TEXT[outcome]);

        // MutationObserver batch 경계를 만든다. 같은 tick에 이어 붙이면
        // 두 변경이 한 batch로 들어온다.
        await page.waitForTimeout(50);

        await page.evaluate(() => {
          const root = document.querySelector("#modal-dialog");

          if (root === null) {
            throw new Error("뼈대에 #modal-dialog가 없다.");
          }

          // 캡처의 `watchedAfter` 그대로다.
          root.className = "modal fade show";
          root.removeAttribute("aria-hidden");
          root.setAttribute("aria-modal", "true");
          root.setAttribute("style", "display: block;");
        });
      }
    };
  },

  syntheticPayload(): AcceptedDetectedPayload {
    return {
      codingPlatform: "programmers",
      courseId: COURSE_ID,
      lessonId: LESSON_ID,
      problemTitle: PROBLEM_TITLE,
      language: LANGUAGE,
      // 실제 풀이가 아니다. payload의 code가 commit된 파일에 그대로
      // 도달하는가만 본다.
      code: "func solution(_ a: Int, _ b: Int) -> Int {\n    a * b\n}\n",
      pageUrl: BASE_PROBLEM.url,
      detectedAt: new Date().toISOString()
    };
  },

  liveUrl(): string {
    return BASE_PROBLEM.url;
  },

  /** Adapter가 의존하는 셋을 본다. 제출하지 않으므로 결과 modal의 **내용**은
   * 볼 수 없다 — 그건 풀사이클의 몫이다. 여기서 답하는 것은 "판정이 걸릴
   * 자리와 code 출처가 아직 있는가"다. */
  async assertContract(page: Page): Promise<void> {
    const state = await page.evaluate(() => {
      const root = document.querySelector("#modal-dialog");
      const style = root === null ? null : getComputedStyle(root);
      const textarea = document.querySelector<HTMLTextAreaElement>("textarea#code");

      return {
        rootPresent: root !== null,
        rootDisplay: style?.display ?? null,
        // 제출 전에는 **속이 비어 있다**(2026-08-26 실측: `innerHTML.length`가
        // 0이다). `.modal-title`은 결과가 올 때 함께 만들어진다. 그래서 여기서
        // 그 존재를 요구하면 안 된다 — adapter도 판정 시점에만 읽는다.
        acceptedTitleVisible:
          root?.querySelector(".modal-title")?.textContent?.trim() ===
          "정답입니다!",
        codeLength: textarea?.value.length ?? -1,
        // adapter의 후보 목록을 그대로 따라간다(`extractProgrammersRawLanguage`).
        // 하나만 보면 **실제 page가 쓰는 것이 그 하나가 아닐 때** 계약이
        // 멀쩡한데도 실패한다 — 실제로 이 page는 여섯 번째 후보인
        // `[data-language].active`를 쓴다(2026-08-26 실측).
        language: (() => {
          const selectors = [
            'select[name="language"]',
            "select#language",
            'select[name="language_id"]',
            'input[name="language"]',
            '[data-language][aria-selected="true"]',
            "[data-language].active"
          ];

          for (const selector of selectors) {
            const node = document.querySelector(selector);

            if (node === null) {
              continue;
            }

            const value =
              node.getAttribute("data-language") ??
              (node as HTMLInputElement).value ??
              node.textContent;

            if (typeof value === "string" && value.trim().length > 0) {
              return `${selector} → ${value.trim()}`;
            }
          }

          return null;
        })()
      };
    });

    // presentation root는 **이미 존재하던 node**다. 캡처 첫 batch부터
    // `present: true`이고 `display: none`으로 대기한다. 사라지면 판정이
    // 걸릴 자리가 없다.
    expect(state.rootPresent, "`#modal-dialog`가 없다.").toBe(true);
    expect(
      state.acceptedTitleVisible,
      "제출 전인데 Accepted title이 이미 있다. 첫 전이가 성립하지 않는다."
    ).toBe(false);

    // 제출 전이므로 숨어 있어야 한다. 보이는 상태로 시작하면 첫 전이가
    // `inactive → acceptedVisible`이 되지 않는다.
    expect(
      state.rootDisplay,
      "제출 전인데 `#modal-dialog`가 보인다. 전이 판정의 전제가 깨진다."
    ).toBe("none");

    // code 출처. 값이 editor와 함께 갱신되는 것은 캡처가 실증했다.
    expect(
      state.codeLength,
      "`textarea#code`가 없거나 비어 있다. extraction failure로 간다."
    ).toBeGreaterThan(0);

    expect(
      state.language ?? "",
      "언어를 읽을 수 있는 element가 후보 목록에 하나도 없다."
    ).not.toBe("");
  },

};
