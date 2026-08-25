/** SWEA 로그인.
 *
 * SWEA의 `SESSION` 쿠키는 만료 기한(`Expires`/`Max-Age`) 없이 발급된다
 * (2026-08-25 실측) — 브라우저 프로세스가 끝나면 사라지는 진짜 session
 * cookie다. LeetCode·Programmers처럼 한 번 로그인해 두고 나중에 캡처하는
 * 2단계 흐름이 통하지 않아 실행마다 로그인이 필요하다. 그 로그인을 사람이
 * 아니라 여기서 한다.
 *
 * 자격증명은 `.env`에서만 온다(`e2e/support/credentials.ts`). 값은 어디에도
 * 찍지 않는다 — 캡처 fixture는 물론 Playwright 실패 trace에도 남으면 안 된다.
 * 자격증명이 없거나 자동 로그인이 실패하면 사람이 직접 로그인할 때까지
 * 기다린다. 자동화가 깨져도 이전 흐름 그대로 쓸 수 있게 남긴 경로다.
 */
import type { Locator, Page } from "@playwright/test";

import { readSweaCredentials } from "../support/credentials";

const LOGIN_URL = "https://swexpertacademy.com/main/identity/anonymous/loginPage.do";

/** 사람이 로그인하기를 기다리는 상한. */
const MANUAL_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

/** 자동 로그인 후 이동을 기다리는 상한. */
const AUTO_LOGIN_TIMEOUT_MS = 30_000;

/** 로그인 page를 벗어났는지로 로그인 여부를 본다.
 *
 * 이미 로그인한 상태에서 `loginPage.do`를 열면 `/main/main.do`로 redirect된다
 * (2026-08-25 실측). header에 사용자 이름이 떴는지 보는 것보다 URL이 확실하다 —
 * header markup은 바뀌어도 이 redirect는 인증 자체의 결과다. */
function isLoggedIn(page: Page): boolean {
  return !new URL(page.url()).pathname.includes("loginPage");
}

/** 로그인 form의 입력 field를 찾는다.
 *
 * selector를 추측해 박지 않는다. 로그인된 상태에서는 `loginPage.do`가 곧바로
 * redirect돼 form을 실측할 수 없었다. 대신 보이는 `input[type=password]`를
 * 기준점으로 잡는다 — 로그인 page에 비밀번호 입력이 여럿일 이유가 없고,
 * 아이디 입력은 그 앞의 텍스트 입력이다. 이 구조는 markup이 바뀌어도 잘 견딘다. */
async function findLoginFields(
  page: Page
): Promise<{ id: Locator; password: Locator } | null> {
  const password = page.locator("input[type=password]:visible").first();

  if (!(await password.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return null;
  }

  const id = page.locator("input[type=text]:visible, input[type=email]:visible").first();

  if (!(await id.isVisible({ timeout: 5000 }).catch(() => false))) {
    return null;
  }

  return { id, password };
}

/** 로그인 상태를 보장한다. 이미 로그인되어 있으면 아무것도 하지 않는다. */
export async function ensureSweaLogin(page: Page): Promise<void> {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  if (isLoggedIn(page)) {
    console.info("[sweaLogin] 이미 로그인되어 있다.");
    return;
  }

  const credentials = readSweaCredentials();

  if (credentials === null) {
    console.info(
      "[sweaLogin] .env에 E2E_SWEA_ID/E2E_SWEA_PASSWORD가 없다. 직접 로그인해라. 로그인되면 자동으로 이어진다."
    );
    await waitForManualLogin(page);
    return;
  }

  const fields = await findLoginFields(page);

  if (fields === null) {
    console.info("[sweaLogin] 로그인 form을 찾지 못했다. 직접 로그인해라.");
    await waitForManualLogin(page);
    return;
  }

  // `fill`은 값을 로그로 남기지 않는다. 아래에서도 값을 찍지 않는다.
  await fields.id.fill(credentials.id);
  await fields.password.fill(credentials.password);
  await fields.password.press("Enter");

  const moved = await page
    .waitForURL(() => isLoggedIn(page), { timeout: AUTO_LOGIN_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);

  if (moved) {
    console.info("[sweaLogin] 자동 로그인했다.");
    return;
  }

  // 자동 로그인이 막히는 이유는 여러 가지다(자격증명 오류, 추가 인증, bot
  // 판정). 어느 쪽이든 사람이 개입하면 풀리므로 여기서 실패시키지 않는다.
  console.info("[sweaLogin] 자동 로그인이 통하지 않았다. 직접 로그인해라.");
  await waitForManualLogin(page);
}

async function waitForManualLogin(page: Page): Promise<void> {
  await page.waitForURL(() => isLoggedIn(page), { timeout: MANUAL_LOGIN_TIMEOUT_MS });
  console.info("[sweaLogin] 로그인 감지됨.");
}
