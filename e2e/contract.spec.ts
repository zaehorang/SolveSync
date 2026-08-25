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

        await page.goto(driver.liveUrl(), { waitUntil: "domcontentloaded" });

        // headed여도 확인 화면이 한 번 스칠 수 있다. 넘어갈 때까지 기다린다.
        for (let i = 0; i < 30; i += 1) {
          if (!/just a moment/i.test(await page.title())) {
            break;
          }

          await page.waitForTimeout(2_000);
        }

        // 사용자 데이터가 그려질 시간을 준다. 클릭하지 않는다.
        await page.waitForTimeout(5_000);

        await driver.assertContract?.(page);
      } finally {
        await context.close();
      }
    });
  }
});
