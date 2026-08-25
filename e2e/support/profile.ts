/** Verification Profile.
 *
 * Live E2E가 쓰는 전용 Chrome user data directory다. 사용자의 상시 프로필과
 * 반드시 분리한다. Sync Deduplication Key 상태가 확장 설치 단위로 저장되므로
 * 이 분리가 실사용 동기화 오염을 막는 유일한 수단이다.
 *
 * 실제 Chrome을 쓰고 자동화 신호를 끈다. Playwright 번들 Chromium을 기본
 * 설정으로 띄우면 LeetCode의 Cloudflare Turnstile이 로그인을 막는다
 * (Error 600010). 실제 사람이 쓰는 브라우저와 같은 조건이어야 실제 page를
 * 상대할 수 있다.
 *
 * **캡처와 Contract Check는 확장 없이 띄운다.** 확장이 켜진 채로 실제 제출을
 * 하면 진짜 sync가 돌아 실사용 Sync Repository에 commit이 생기고 processed
 * Sync Deduplication Key까지 남는다. 그러면 나중에 같은 문제를 실제로 풀었을
 * 때 commit이 조용히 안 생긴다.
 */
import { chromium, type BrowserContext } from "@playwright/test";
import { cp, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** `.gitignore`에 있다. 로그인 세션이 들어 있어 절대 커밋하지 않는다. */
export const VERIFICATION_PROFILE_DIR = resolve(repoRoot, ".verification-profile");

export interface OpenProfileOptions {
  /** 로그인과 캡처는 사람이 보면서 해야 하므로 기본이 headed다. */
  headless?: boolean;
  /** 풀사이클만 확장을 로드한다. 캡처와 Contract Check는 로드하지 않는다. */
  withExtension?: boolean;
}

export async function openVerificationProfile(
  options: OpenProfileOptions = {}
): Promise<BrowserContext> {
  await mkdir(VERIFICATION_PROFILE_DIR, { recursive: true });

  const distPath = resolve(repoRoot, "dist");
  const withExtension = options.withExtension === true;
  const extensionArgs = withExtension
    ? [`--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`]
    : [];

  // **실제 Chrome은 `--load-extension`을 더 이상 받지 않는다**(2026-08-25
  // 실측: service worker가 영영 기동하지 않는다). 확장이 필요한 풀사이클만
  // Chromium으로 내려간다.
  //
  // 그때 원본 프로필을 쓰지 않고 복사본을 쓴다. 한 프로필 디렉터리를 Chrome과
  // Chromium이 번갈아 열면 프로필이 상해 로그인을 다시 해야 한다. 로그인은
  // 사람이 하는 일이므로 그 비용이 복사 비용보다 비싸다.
  const userDataDir = withExtension
    ? await copyProfile()
    : VERIFICATION_PROFILE_DIR;

  return chromium.launchPersistentContext(userDataDir, {
    // 번들 Chromium이 아니라 실제 Chrome을 쓴다. Cloudflare는 브라우저
    // 지문을 보고, 번들 Chromium은 그 자체로 흔한 자동화 신호다.
    channel: withExtension ? "chromium" : "chrome",
    headless: options.headless ?? false,
    viewport: null,
    // `--enable-automation`은 navigator.webdriver를 켜고 주소창에 자동화
    // 배너를 띄운다. 이 두 신호만으로도 Turnstile이 실패한다.
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled", ...extensionArgs]
  });
}

async function copyProfile(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "solvesync-profile-"));

  await cp(VERIFICATION_PROFILE_DIR, target, { recursive: true });

  return target;
}
