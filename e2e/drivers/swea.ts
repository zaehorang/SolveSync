/** SWEA Platform E2E Driver.
 *
 * Phase 3은 GitHub write 계층이 쓰는 부분만 채운다. Sealed fixture와 실제
 * page 조작은 Phase 1의 캡처와 Phase 4의 실측이 있어야 하고, 추측한 selector를
 * 여기 박는 것이 이 검증 계층이 없애려는 문제 그 자체다.
 */
import type { Page } from "@playwright/test";

import type { AcceptedDetectedPayload } from "../../src/shared/messages";
import { BASE_PROBLEMS } from "../capture/baseProblems";
import type { PlatformE2EDriver, SealedFixture, SealedOutcome } from "./types";

const BASE_PROBLEM = BASE_PROBLEMS.swea;

/** 기준 문제 1206의 식별자. `baseProblems.ts`의 URL과 같은 문제다. */
const CONTEST_PROB_ID = "AV134DPqAA8CFAYh";

const PROBLEM_TITLE = "1206. View";

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

function notImplemented(what: string): never {
  throw new Error(`${what}는 Phase 4에서 실제 page를 보고 확정한다.`);
}

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

  // `assertContract`를 아직 두지 않는다. 이 플랫폼은 로그인 세션이 있어야
  // 문제 page가 열려 실제 page를 재지 못했다. 추측한 selector를 여기 박는
  // 것이 이 계층이 없애려는 문제 그 자체다.

  async submit(_page: Page, _code: string): Promise<void> {
    notImplemented("SWEA 자동 제출");
  }
};
