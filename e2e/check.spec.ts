/** 환경 점검. `npm run e2e:check`로만 의미가 있다.
 *
 * 사전 점검은 `globalSetup`이 출력한다. 이 spec은 Playwright가 globalSetup을
 * 돌릴 test 하나를 갖게 할 뿐 아무것도 하지 않는다.
 */
import { test } from "@playwright/test";

test("환경 점검", () => {
  test.skip(process.env.E2E_CHECK !== "1", "npm run e2e:check로만 실행한다.");
});
