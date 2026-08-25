import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** 검증 하네스 설정.
 *
 * 확장을 unpacked로 로드해야 하므로 각 spec이 직접 persistent context를
 * 띄운다. Playwright의 기본 browser fixture는 쓰지 않는다.
 */

// SWEA 자동 로그인이 쓰는 계정 정보를 `.env`에서 읽는다. `engines`가 Node
// `>=24`라 `process.loadEnvFile`을 의존성 없이 쓸 수 있다. 파일이 없어도
// 실패하지 않는다 — 자격증명이 없으면 수동 로그인 대기로 떨어진다.
const envFile = resolve(import.meta.dirname, ".env");

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  testDir: "e2e",
  // Vitest가 도는 `*.test.ts`를 Playwright가 다시 집지 않게 한다.
  testMatch: "**/*.spec.ts",
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
