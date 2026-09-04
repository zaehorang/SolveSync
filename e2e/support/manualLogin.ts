/** 로그인이 풀렸을 때 사람을 기다린다.
 *
 * 세션이 만료되면 실행을 실패시키는 대신 창을 띄운 채 멈추고, 사람이 로그인하면
 * 그대로 이어서 진행한다. 실패시키면 사람이 로그인하고 명령을 다시 치는 두
 * 단계가 되는데, 실제 제출 계층은 한 번 세우는 비용이 크다.
 *
 * **자동 로그인은 SWEA에만 있고 나머지 둘에는 두지 않는다.** 편의의 문제가
 * 아니라 각 사이트의 사정이다.
 *
 * - SWEA: `SESSION` 쿠키가 만료 기한 없이 발급되는 진짜 session cookie라
 *   브라우저가 꺼지면 사라진다(2026-08-25 실측). 실행마다 로그인이 필요해
 *   `e2e/capture/sweaLogin.ts`가 `.env`의 자격증명으로 대신 로그인한다.
 * - Programmers: 검증 계정이 Google 로그인이다. 자동화하려면 Google의 인증
 *   흐름을 타야 하고 거기서 2단계 인증과 bot 판정에 걸린다. **시도하지
 *   않는다.**
 * - LeetCode: Cloudflare Turnstile이 붙어 있어 자동 입력 자체가 bot 판정
 *   위험이다. 한 번 걸리면 그 계정으로 도는 캡처·Contract Check·풀사이클이
 *   전부 막히므로, 얻는 것보다 잃는 것이 크다.
 *
 * 그래서 둘은 Verification Profile의 쿠키로 살고, 그 쿠키가 만료됐을 때
 * 여기서 사람을 기다린다.
 */
import type { Page } from "@playwright/test";

/** 사람이 로그인하기를 기다리는 상한. `sweaLogin`과 같은 값이다.
 *
 * 부르는 쪽이 자기 test 상한을 이 값에 맞춰 늘려야 한다. Playwright는 test
 * timeout에서 context를 통째로 죽이므로, test 상한이 이보다 짧으면 사람이
 * 로그인하는 도중에 브라우저가 사라진다. */
export const MANUAL_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const POLL_INTERVAL_MS = 2000;

/** page가 로그인을 요구하는지 본다. 재지 못하면 `null`이다.
 *
 * selector 대신 본문 text로 본다. 세 사이트의 로그인 화면 markup이 서로 다르고
 * 바뀌기도 하는데, "로그인하라"는 말은 어느 화면에나 있다.
 *
 * **재지 못한 것과 로그인을 요구하지 않는 것을 구분한다.** navigation이 진행
 * 중이면 `evaluate`는 execution context 파기로 던지는데, 그것을 "로그인 요구
 * 없음"으로 접으면 로그인 폼을 제출한 직후가 완료로 판정된다. 그 순간 host는
 * 아직 원래 host이므로(LeetCode 로그인은 같은 host 안에서 끝난다) 대기가
 * 로그인 도중에 끝나 버린다. */
async function readLoginPrompt(page: Page): Promise<boolean | null> {
  return page
    .evaluate(() => /로그인|log in|sign in/i.test(document.body.innerText))
    .catch(() => null);
}

/** 로그인을 요구하는지 본다. 재지 못하면 요구하지 않는 것으로 본다.
 *
 * 이쪽은 문 앞의 판정이라 재지 못한 경우 그대로 진행시킨다. 진행해서 실제로
 * 로그아웃 상태였다면 뒤의 단언이 큰 소리로 실패한다. 대기 loop의 완료
 * 판정과는 요구가 다르다 — 그쪽은 `readLoginPrompt`를 직접 쓴다. */
export async function isLoginPrompted(page: Page): Promise<boolean> {
  return (await readLoginPrompt(page)) === true;
}

/** 로그인을 요구하면 사람이 로그인할 때까지 기다린다.
 *
 * 기다리는 동안 page를 건드리지 않는다. Google 로그인처럼 다른 host로 나갔다
 * 오는 흐름이 있어, 중간에 문제 page로 되돌리면 로그인 흐름이 끊긴다. 그래서
 * **원래 host로 돌아왔고 더 이상 로그인을 요구하지 않을 때**를 완료로 본다.
 *
 * 돌아온 뒤에는 호출한 쪽이 문제 page를 다시 열어야 한다. 로그인 흐름이
 * 어디로 보낼지 모르기 때문이다. */
export async function waitForManualLogin(
  page: Page,
  platform: string,
  timeoutMs: number = MANUAL_LOGIN_TIMEOUT_MS
): Promise<boolean> {
  const host = new URL(page.url()).host;

  console.info(
    `[manualLogin] ${platform} 세션이 없거나 만료됐다. 열린 창에서 직접 로그인해라. 로그인하면 자동으로 이어진다 (최대 ${Math.round(
      timeoutMs / 60_000
    )}분).`
  );

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await page.waitForTimeout(POLL_INTERVAL_MS);

    const back = new URL(page.url()).host === host;
    // 재지 못한 동안은 완료로 보지 않는다. 로그인 흐름 한가운데일 수 있다.
    const prompted = await readLoginPrompt(page);

    if (back && prompted === false) {
      console.info(`[manualLogin] ${platform} 로그인 감지됨. 이어서 진행한다.`);
      return true;
    }
  }

  console.info(`[manualLogin] ${platform} 로그인을 기다리다 시간이 다 됐다.`);
  return false;
}
