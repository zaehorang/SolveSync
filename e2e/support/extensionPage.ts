/** 확장 page에서 background로 메시지를 보내고 storage를 읽는다.
 *
 * service worker 안에서 `chrome.runtime.sendMessage`를 부르면 자기
 * `onMessage`로 돌아오지 않는다. 그래서 `runtime.ts`의 리스너를 태우려면
 * 확장의 다른 context가 필요하고, options page가 그 context다.
 *
 * `content:accepted_detected`는 sender가 content script인지 검사하지 않는다.
 * `externally_connectable`이 없어 외부 web page는 못 보내지만 같은 확장의 어느
 * context든 보낼 수 있고, **GitHub write 계층은 그 느슨함에 의존한다.**
 * 나중에 sender 검증을 조이면 이 support도 함께 고쳐야 한다.
 */
import type { Page } from "@playwright/test";

import { STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../../src/shared/storageSchema";
import type { GitHubAuthSession } from "../../src/shared/storageSchema";
import type { SyncHistoryEntry } from "../../src/shared/types";
import type { LoadedExtension } from "./extension";

/** page 안에서만 쓰는 확장 API. e2e tsconfig는 chrome 타입을 싣지 않는다.
 *
 * root tsconfig의 `types`에 chrome이 있지만 Playwright 타입과 한 program에
 * 섞을 수 없어 `e2e/tsconfig.json`이 이를 덮는다. 여기서 필요한 표면만 적는다. */
declare const chrome: {
  runtime: { sendMessage(message: unknown): Promise<unknown> };
  storage: {
    local: {
      get(keys: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

export interface RuntimeSuccess<T> {
  ok: true;
  data: T;
}

export interface RuntimeFailure {
  ok: false;
  error: { code: string; message: string };
}

export type RuntimeResponse<T> = RuntimeSuccess<T> | RuntimeFailure;

/** options page를 연다. 제품 번들 그대로이며 테스트 전용 page를 만들지 않는다. */
export async function openExtensionPage(
  extension: LoadedExtension
): Promise<Page> {
  const extensionId = await extension.extensionId();
  const page = await extension.context.newPage();

  await page.goto(`chrome-extension://${extensionId}/options/index.html`);

  return page;
}

export async function sendRuntimeMessage<T>(
  page: Page,
  message: unknown
): Promise<RuntimeResponse<T>> {
  return (await page.evaluate(
    async (payload) => chrome.runtime.sendMessage(payload),
    message
  )) as RuntimeResponse<T>;
}

/** 응답이 실패면 원인을 그대로 드러내며 던진다.
 *
 * `ok: false`를 조용히 통과시키면 다음 단계가 엉뚱한 곳에서 실패한다. */
export async function requireRuntimeData<T>(
  page: Page,
  message: unknown
): Promise<T> {
  const response = await sendRuntimeMessage<T>(page, message);

  if (!response.ok) {
    throw new Error(
      `runtime message가 실패했다: ${response.error.code} ${response.error.message}`
    );
  }

  return response.data;
}

export interface SeedGitHubAuthInput {
  accessToken: string;
  login: string;
}

/** GitHub auth session을 `chrome.storage.local`에 직접 심는다.
 *
 * `BackgroundRuntimeOptions.authManager` 주입은 프로덕션이 아닌 번들을 로드하게
 * 되어 이 계층의 전제를 깬다. 대신 제품 parser가 그대로 읽는 형태여야 하고,
 * 그것을 `auth-seed.spec.ts`가 `settings:read`로 고정한다.
 *
 * fine-grained token에는 refresh token이 없다. 만료를 먼 미래로 두어
 * `getAccessToken`의 refresh 분기에 들어가지 않게 한다. */
export async function seedGitHubAuthSession(
  page: Page,
  input: SeedGitHubAuthInput
): Promise<void> {
  const now = new Date();
  const farFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const session: GitHubAuthSession = {
    version: STORAGE_SCHEMA_VERSION,
    accessToken: input.accessToken,
    accessTokenExpiresAt: farFuture.toISOString(),
    // 비어 있으면 parser가 session 전체를 버린다. 이 값으로 refresh를 시도할
    // 일은 없다 — access token 만료가 먼 미래라 refresh 분기에 닿지 않는다.
    refreshToken: "verification-token-has-no-refresh-token",
    refreshTokenExpiresAt: farFuture.toISOString(),
    tokenType: "bearer",
    account: { id: 0, login: input.login, avatarUrl: null },
    updatedAt: now.toISOString()
  };

  await page.evaluate(
    async ({ key, value }) => chrome.storage.local.set({ [key]: value }),
    { key: STORAGE_KEYS.githubAuth, value: session as unknown }
  );
}

/** Sync History를 읽는다.
 *
 * service worker는 잠들었다 깨어나므로 evaluate로 심은 전역은 관측점이 될 수
 * 없다. `chrome.storage.local`에 남는 Sync History는 재시작에도 살아남고,
 * "메시지가 도달했다"보다 강한 것을 본다 — payload가 orchestration 끝까지
 * 온전한 형태로 갔는가. */
export async function readSyncHistoryEntries(
  page: Page
): Promise<SyncHistoryEntry[]> {
  const state = await page.evaluate(
    async (key) => (await chrome.storage.local.get(key))[key],
    STORAGE_KEYS.syncHistory
  );

  if (state === undefined || state === null || typeof state !== "object") {
    return [];
  }

  const entries = (state as { entries?: unknown }).entries;

  return Array.isArray(entries) ? (entries as SyncHistoryEntry[]) : [];
}
