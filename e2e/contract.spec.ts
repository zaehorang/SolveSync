/** Contract Check.
 *
 * 실제 page를 열어 **Adapter가 의존하는 것이 아직 거기 있는지**만 확인한다.
 * 제출하지 않는다. 그래서 되돌릴 것이 없고 자주 돌릴 수 있다.
 *
 * 이 계층이 잡지 못하는 것은 **Accepted 결과 DOM**이다. 그건 제출해야
 * 나타나므로 풀사이클의 몫이다.
 *
 * 실제 네트워크를 타므로 CI에 배선하지 않는다. 플랫폼이 죽거나 느린 날
 * 매 PR이 빨개지면 아무도 안 보게 된다.
 *
 * ```bash
 * npm run e2e:contract
 * ```
 */
import { test } from "@playwright/test";

import { DRIVERS as CAPTURE_DRIVERS } from "./capture/drivers";
import { ensureSweaLogin } from "./capture/sweaLogin";
import { isLoginPrompted, waitForManualLogin } from "./support/manualLogin";
import { DRIVERS } from "./drivers";
import { openVerificationProfile } from "./support/profile";

const enabled = process.env.E2E_CONTRACT === "1";

test.describe("Contract Check", () => {
  test.skip(!enabled, "npm run e2e:contract로만 실행한다. 실제 page를 연다.");

  // 실제 page 로딩이 느릴 수 있다.
  test.setTimeout(90_000);

  // `assertContract`가 없는 플랫폼은 건너뛴다. 로그인 세션이 있어야 문제
  // page가 열려 아직 실제 page를 재지 못한 곳들이다.
  for (const driver of DRIVERS.filter((candidate) => candidate.assertContract)) {
    test(`${driver.platform} 기준 문제의 계약이 유지된다`, async () => {
      // **확장을 켜지 않는다.** 확장이 켜진 채로 실제 page를 열면 진짜 sync가
      // 돌아 실사용 Sync Repository에 commit이 생길 수 있다.
      // **headed로 띄운다.** headless로는 Cloudflare가 `Just a moment...`
      // 확인 화면을 내주고 실제 page가 오지 않는다(2026-08-25 실측).
      // 그래서 이 계층은 사람의 기계에서 돈다. CI에 배선하지 않는 이유가
      // 자격증명만은 아니다.
      const context = await openVerificationProfile();

      try {
        const page = await context.newPage();

        // SWEA의 `SESSION` 쿠키는 브라우저 프로세스가 끝나면 사라진다. 이
        // 플랫폼만 실행마다 로그인해야 문제 page가 열린다.
        if (driver.platform === "swea") {
          await ensureSweaLogin(page);
        }

        await page.goto(driver.liveUrl(), { waitUntil: "domcontentloaded" });

        // headed여도 확인 화면이 한 번 스칠 수 있다. 넘어갈 때까지 기다린다.
        for (let i = 0; i < 30; i += 1) {
          if (!/just a moment/i.test(await page.title())) {
            break;
          }

          await page.waitForTimeout(2_000);
        }

        // editor가 뜰 때까지 기다린다. 고정 대기로 두면 느린 날 page가 덜
        // 그려진 상태를 계약 위반으로 오해한다. 제출 조작은 하지 않는다 —
        // `open`은 page를 열고 editor를 기다리기만 한다.
        // 세션이 만료됐으면 사람을 기다린다. 로그아웃 상태의 page를 그대로
        // 재면 "계약이 깨졌다"가 아니라 "로그인 화면을 쟀다"가 되어, 실제로는
        // 멀쩡한 selector가 사라진 것처럼 보고된다.
        if (await isLoginPrompted(page)) {
          await waitForManualLogin(page, driver.platform);
          await page.goto(driver.liveUrl(), { waitUntil: "domcontentloaded" });
        }

        await CAPTURE_DRIVERS[driver.platform].open(page);
        await page.waitForTimeout(2_000);

        await driver.assertContract?.(page);
      } finally {
        await context.close();
      }
    });
  }
});
