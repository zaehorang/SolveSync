/** SWEA Platform E2E Driver.
 *
 * 실제 page 조작은 `e2e/capture/drivers.ts`가 갖는다. 제출 selector를 두 곳에
 * 두면 하나가 조용히 낡는다.
 */
import { expect, type Page } from "@playwright/test";

import type { AcceptedDetectedPayload } from "../../src/shared/messages";
import { BASE_PROBLEMS } from "../capture/baseProblems";
import type { PlatformE2EDriver, SealedFixture, SealedOutcome } from "./types";

const BASE_PROBLEM = BASE_PROBLEMS.swea;

/** 기준 문제 1206의 식별자. `baseProblems.ts`의 URL과 같은 문제다. */
const CONTEST_PROB_ID = "AV134DPqAA8CFAYh";

/** 실제 page의 `h3.problem_title` 그대로다(2026-08-26 실측). */
const PROBLEM_TITLE = "1206. [S/W 문제해결 기본] 1일차 - View";

/** SWEA 언어 select의 option value. `languageRegistry`가 `Y`를 python3로 읽는다.
 *
 * text에는 `PyPy 7.3.9` 같은 runtime 버전이 박혀 있어 adapter가 value를
 * 우선 쓴다. 뼈대도 실제 page와 같은 모양이어야 그 우선순위가 검증된다. */
const LANGUAGE_VALUE = "Y";

/** 실제 캡처에서 온 결과 layer text (2026-08-25, 문제 1206).
 *
 * 상수로 두되 캡처에 실재하는지는 공통 spec이 재생 전에 확인한다. 여기서
 * 지어내면 우리가 상상한 DOM으로 우리 adapter를 검증하는 순환이 된다. */
const RESULT_TEXT: Record<SealedOutcome, string> = {
  accepted: "축하합니다. Pass입니다.제출이 완료되었습니다.확인닫기",
  rejected:
    "오답채점용 input 파일로 채점한 결과 fail 입니다.(오답 :  10개의 테스트케이스 중 0개가 맞았습니다.)확인닫기"
};


export const sweaDriver: PlatformE2EDriver = {
  platform: "swea",

  fixture(): SealedFixture {
    return {
      url: BASE_PROBLEM.url,

      // route identity가 URL이 아니라 DOM에서 온다 (ADR 0036). 모든 문제가
      // 같은 URL을 쓰므로 `input#contestProbId`가 없으면 adapter가 이 page를
      // 지원 route로 보지 않는다.
      html: () =>
        [
          "<!doctype html>",
          '<html lang="ko">',
          "<head><meta charset=\"utf-8\"><title>SW Expert Academy</title></head>",
          "<body>",
          `<input type="hidden" id="contestProbId" value="${CONTEST_PROB_ID}">`,
          `<h3 class="problem_title">${PROBLEM_TITLE}</h3>`,
          `<select id="sel_lang"><option value="${LANGUAGE_VALUE}" selected>Python 3 (PyPy 7.3.9)</option></select>`,
          "</body>",
          "</html>"
        ].join("\n"),

      resultText: (outcome) => RESULT_TEXT[outcome],

      // 캡처에서 SWEA는 `childList` node 추가였다. layer 전체 text의 맨 앞에
      // 판정 접두사가 온다.
      async showResult(page, outcome) {
        await page.evaluate((text) => {
          const layer = document.createElement("div");

          layer.className = "swal2-container";
          layer.textContent = text;
          document.body.appendChild(layer);
        }, RESULT_TEXT[outcome]);
      }
    };
  },

  syntheticPayload(): AcceptedDetectedPayload {
    return {
      codingPlatform: "swea",
      contestProbId: CONTEST_PROB_ID,
      problemNumber: "1206",
      problemTitle: "View",
      // `languageRegistry`의 SWEA alias. 화면 표기 그대로 온다.
      language: "Python 3",
      // 실제 풀이가 아니다. GitHub write 계층이 보는 것은 payload의 code가
      // commit된 파일에 그대로 도달하는가뿐이다.
      code: [
        "def main():",
        '    print("solvesync verification")',
        "",
        "",
        "main()",
        ""
      ].join("\n"),
      pageUrl: BASE_PROBLEM.url,
      detectedAt: new Date().toISOString()
    };
  },

  liveUrl(): string {
    return BASE_PROBLEM.url;
  },

  /** route identity가 URL이 아니라 DOM에서 온다(ADR 0036). 모든 문제가 같은
   * URL을 쓰기 때문이다. 그래서 여기서 보는 것들이 사라지면 **어떤 문제인지
   * 알 수 없어 route 자체가 성립하지 않는다.** */
  async assertContract(page: Page): Promise<void> {
    const state = await page.evaluate(() => {
      const editorHost = document.querySelector(".CodeMirror");

      return {
        contestProbId:
          document.querySelector<HTMLInputElement>("input#contestProbId")?.value ??
          null,
        title:
          document
            .querySelector<HTMLElement>("h3.problem_title")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() ?? null,
        language:
          document.querySelector<HTMLSelectElement>("select#sel_lang")?.value ??
          null,
        editorHostPresent: editorHost !== null,
        // MAIN world bridge가 읽는 그 instance다. host element에 붙는다.
        editorInstance:
          editorHost !== null &&
          typeof (editorHost as { CodeMirror?: { getValue?: unknown } }).CodeMirror
            ?.getValue === "function"
      };
    });

    expect(
      state.contestProbId ?? "",
      "`input#contestProbId`가 없다. route를 확정할 수 없다."
    ).toBe(CONTEST_PROB_ID);

    // `{번호}. {제목}` 형식이다. 어긋나면 번호 없이 전체를 제목으로 둔다.
    expect(
      state.title ?? "",
      "`h3.problem_title`이 `{번호}. {제목}` 형식이 아니다."
    ).toMatch(/^\d+\s*\.\s*.+$/);

    expect(state.language ?? "", "`select#sel_lang`을 읽지 못했다.").not.toBe("");

    expect(state.editorHostPresent, "`.CodeMirror` host가 없다.").toBe(true);

    // bridge는 host element의 `CodeMirror` property에서 `getValue()`를
    // 부른다. property가 사라지면 code를 못 읽어 `swea_extract_failed`가 된다.
    expect(
      state.editorInstance,
      "`.CodeMirror` host에 editor instance가 없다. bridge가 code를 읽지 못한다."
    ).toBe(true);
  },

};
