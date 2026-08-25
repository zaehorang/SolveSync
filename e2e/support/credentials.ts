/** Live E2E가 쓰는 계정 정보.
 *
 * 값은 `.env`에서만 온다. 저장소에 들어가는 것은 `.env.example`의 키 이름뿐이고,
 * `.env`는 `.gitignore`에 있다. 여기서도 코드 어디에서도 값을 로그로 찍지 않는다 —
 * 캡처 fixture는 물론 Playwright의 실패 trace에도 남으면 안 된다.
 *
 * SWEA만 다룬다. LeetCode·Programmers는 Verification Profile에 쿠키가 남아
 * 재로그인이 필요 없고, LeetCode는 Cloudflare Turnstile이 붙어 있어 자동 로그인
 * 시도 자체가 bot 판정 위험이다.
 */

export interface Credentials {
  readonly id: string;
  readonly password: string;
}

/** 둘 다 채워져 있을 때만 돌려준다. 하나만 있는 상태는 설정 실수이므로
 * 반쪽짜리 로그인을 시도하지 않고 없는 것으로 본다 — 호출자는 수동 로그인
 * 대기로 넘어간다. */
export function readSweaCredentials(): Credentials | null {
  const id = process.env.E2E_SWEA_ID?.trim();
  const password = process.env.E2E_SWEA_PASSWORD?.trim();

  if (id === undefined || id === "" || password === undefined || password === "") {
    return null;
  }

  return { id, password };
}

/** redaction 대상으로 넘길 계정 문자열.
 *
 * SWEA는 로그인하면 header에 사용자 이름을 그리고, 그 DOM이 캡처에 섞여
 * 들어올 수 있다. 비밀번호는 화면에 뜰 일이 없지만 대상에 함께 넣는다 —
 * 안 새는 것을 확인하는 비용보다 넣어 두는 비용이 싸다. */
export function accountSecrets(): string[] {
  const credentials = readSweaCredentials();

  return credentials === null ? [] : [credentials.id, credentials.password];
}
