/** Verification Profile 로그인.
 *
 * ```bash
 * npm run e2e:login
 * ```
 *
 * 브라우저를 띄우고 사람이 세 플랫폼에 로그인할 때까지 기다린다. 세션은
 * `.verification-profile/`에 남아 이후 캡처와 Contract Check가 재사용한다.
 * 로그인은 자동화하지 않는다. 자격증명을 저장소나 CI에 두지 않기 때문이다.
 *
 * 확장 없이 뜬다. 로그인 단계에서 확장이 붙을 이유가 없다.
 */
import { test } from "@playwright/test";

import { BASE_PROBLEMS } from "./baseProblems";
import { openVerificationProfile } from "../support/profile";

/** SWEA의 로그인 페이지는 `/main/login.do`가 아니다. 그 경로는 200을 주지만
 * 본문이 비어 있어(`Content-Length: 0`) 빈 화면만 뜬다. 메인 페이지의
 * `login()`이 실제로 보내는 곳은 아래 경로다. */
const LOGIN_URLS = [
  "https://leetcode.com/accounts/login/",
  "https://school.programmers.co.kr/intro",
  "https://swexpertacademy.com/main/identity/anonymous/loginPage.do"
];

test.describe("Verification Profile", () => {
  test.skip(process.env.E2E_LOGIN !== "1", "npm run e2e:login으로만 실행한다.");
  test.setTimeout(30 * 60 * 1000);

  test("세 플랫폼에 로그인한다", async () => {
    const context = await openVerificationProfile();

    for (const url of LOGIN_URLS) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }

    console.info("[login] 세 탭에서 로그인해라. 끝나면 브라우저를 닫으면 된다.");
    console.info("[login] 세션은 .verification-profile/에 남는다 (gitignore).");

    for (const problem of Object.values(BASE_PROBLEMS)) {
      console.info(`[login] 기준 문제: ${problem.label} — ${problem.url}`);
    }

    // 사람이 브라우저를 닫으면 끝난다.
    await context.waitForEvent("close", { timeout: 29 * 60 * 1000 });
  });
});
