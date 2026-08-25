/** 캡처 실행기.
 *
 * ```bash
 * CAPTURE_PLATFORM=programmers CAPTURE_OUTCOME=accepted npm run e2e:capture
 * ```
 *
 * Verification Profile을 **확장 없이** 열고, 기준 문제 page에 recorder를
 * 무장한 뒤 제출하고, 결과가 멎으면 `e2e/fixtures/{platform}/`에 남긴다.
 * 환경 변수가 없으면 건너뛰므로 일반 `npm run e2e`에 섞여도 된다.
 *
 * 제출까지 자동으로 한다. selector는 [`drivers.ts`](drivers.ts)에 있고 전부
 * 실제 page에서 확인한 것이다. 실제 캡처 절차는 [`runCapture.ts`](runCapture.ts)에
 * 있다 — SWEA는 세션이 브라우저 재시작에서 살아남지 않아(실측) 로그인과
 * 캡처를 한 세션에서 잇는 `captureSweaSession.spec.ts`가 같은 절차를 쓴다.
 */
import { test } from "@playwright/test";

import type { CodingPlatform } from "../../src/shared";
import { openVerificationProfile } from "../support/profile";
import type { CaptureOutcome } from "./drivers";
import { armRecorder } from "./recorder";
import { runCapture, WATCH } from "./runCapture";

const platform = process.env.CAPTURE_PLATFORM as CodingPlatform | undefined;
const outcome = (process.env.CAPTURE_OUTCOME ?? "accepted") as CaptureOutcome;

test.describe("Accepted DOM 캡처", () => {
  test.skip(
    platform === undefined,
    "CAPTURE_PLATFORM이 없으면 캡처하지 않는다. 실제 제출이 필요한 작업이다."
  );
  // 채점이 오래 걸리는 플랫폼이 있다.
  test.setTimeout(10 * 60 * 1000);

  test("기준 문제의 제출 결과를 fixture로 남긴다", async () => {
    if (platform === undefined) {
      return;
    }

    const watch = WATCH[platform];
    const context = await openVerificationProfile();

    try {
      const page = await context.newPage();

      await armRecorder(page, {
        watchSelector: watch?.selector,
        watchTitleSelector: watch?.titleSelector,
        // LeetCode는 idle 상태에서도 <head>에 style tag가 계속 삽입돼(실측
        // 약 30개/초) 배경 잡음이 grading 신호와 섞인다. fixture가 무한정
        // 커지지 않도록 node당 HTML을 더 짧게 자른다.
        maxHtmlLength: 1000
      });

      await runCapture(page, platform, outcome);
    } finally {
      await context.close();
    }
  });
});
