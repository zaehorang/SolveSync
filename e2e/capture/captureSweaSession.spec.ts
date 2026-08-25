/** SWEA 전용 로그인+연속 캡처.
 *
 * ```bash
 * npm run e2e:capture:swea
 * ```
 *
 * SWEA의 `SESSION` 쿠키는 만료 기한(`Expires`/`Max-Age`) 없이 발급된다
 * (2026-08-25 실측) — 브라우저 프로세스가 완전히 종료되면 사라지는 진짜
 * session cookie다. LeetCode·Programmers처럼 "먼저 `npm run e2e:login`으로
 * 로그인해 두고 나중에 `npm run e2e:capture`로 캡처"하는 2단계 흐름이
 * 통하지 않는다 — 로그인 창을 닫는 순간 세션이 사라진다.
 *
 * 그래서 이 spec은 로그인과 정답·오답 캡처를 **같은 브라우저 프로세스 안에서**
 * 끝낸다. `.env`에 계정이 있으면 로그인까지 자동으로 하므로 사람이 할 일이
 * 없고, 없으면 사람이 로그인할 때까지 기다린다.
 */
import { test } from "@playwright/test";

import { accountSecrets } from "../support/credentials";
import { openVerificationProfile } from "../support/profile";
import { armRecorder } from "./recorder";
import { registerSecrets } from "./redact";
import { runCapture, WATCH } from "./runCapture";
import { ensureSweaLogin } from "./sweaLogin";

test.describe("SWEA 로그인+캡처", () => {
  test.skip(process.env.E2E_CAPTURE_SWEA !== "1", "npm run e2e:capture:swea로만 실행한다.");
  test.setTimeout(10 * 60 * 1000);

  test("로그인 후 같은 세션에서 정답·오답을 캡처한다", async () => {
    // 로그인하면 SWEA header가 사용자 이름을 그린다. 캡처를 시작하기 전에
    // 계정 문자열을 redaction 대상으로 등록해 fixture에 남지 않게 한다.
    registerSecrets(accountSecrets());

    const context = await openVerificationProfile();
    const page = await context.newPage();

    await armRecorder(page, {
      watchSelector: WATCH.swea?.selector,
      watchTitleSelector: WATCH.swea?.titleSelector
    });

    await ensureSweaLogin(page);

    await runCapture(page, "swea", "accepted");
    await runCapture(page, "swea", "rejected");

    await context.close();
  });
});
