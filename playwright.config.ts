import { defineConfig } from "@playwright/test";

/** 검증 하네스 설정.
 *
 * 확장을 unpacked로 로드해야 하므로 각 spec이 직접 persistent context를
 * 띄운다. Playwright의 기본 browser fixture는 쓰지 않는다.
 */
export default defineConfig({
  testDir: "e2e",
  // 확장 로드와 service worker 기동이 있어 단위 테스트보다 느리다.
  timeout: 30_000,
  // 같은 프로필과 같은 Verification Repository를 여럿이 동시에 쓰면
  // 서로를 밟는다.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI === "true" ? "github" : "list",
  use: {
    trace: "retain-on-failure"
  }
});
