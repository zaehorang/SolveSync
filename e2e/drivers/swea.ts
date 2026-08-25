/** SWEA Platform E2E Driver.
 *
 * Phase 3은 GitHub write 계층이 쓰는 부분만 채운다. Sealed fixture와 실제
 * page 조작은 Phase 1의 캡처와 Phase 4의 실측이 있어야 하고, 추측한 selector를
 * 여기 박는 것이 이 검증 계층이 없애려는 문제 그 자체다.
 */
import type { Page } from "@playwright/test";

import type { AcceptedDetectedPayload } from "../../src/shared/messages";
import { BASE_PROBLEMS } from "../capture/baseProblems";
import type { PlatformE2EDriver, SealedFixture } from "./types";

const BASE_PROBLEM = BASE_PROBLEMS.swea;

/** 기준 문제 1206의 식별자. `baseProblems.ts`의 URL과 같은 문제다. */
const CONTEST_PROB_ID = "AV134DPqAA8CFAYh";

function notImplemented(what: string): never {
  throw new Error(`${what}는 Phase 4에서 실제 page를 보고 확정한다.`);
}

export const sweaDriver: PlatformE2EDriver = {
  platform: "swea",

  fixture(): SealedFixture {
    return notImplemented("SWEA Sealed fixture");
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

  async assertContract(_page: Page): Promise<void> {
    notImplemented("SWEA Contract Check");
  },

  async submit(_page: Page, _code: string): Promise<void> {
    notImplemented("SWEA 자동 제출");
  }
};
