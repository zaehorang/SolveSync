/** Coding Platform 요청을 로컬 fixture로 가로챈다.
 *
 * URL은 실제 도메인 그대로라 manifest의 `content_scripts` match가 걸리고,
 * 네트워크는 나가지 않는다. 그래서 플랫폼 계정도 세션도 필요 없다.
 */
import type { BrowserContext } from "@playwright/test";

export interface ServedPage {
  /** 실제 도메인 URL. manifest match가 이 값에 걸린다. */
  url: string;
  html: string;
}

export async function servePage(
  context: BrowserContext,
  page: ServedPage
): Promise<void> {
  await context.route(page.url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: page.html
    });
  });

  // fixture page가 부르는 부가 요청은 전부 막는다. 하나라도 새어 나가면
  // 이 계층이 네트워크를 타지 않는다는 전제가 깨진다.
  await context.route("**", async (route) => {
    const requestUrl = route.request().url();

    if (requestUrl.startsWith("chrome-extension://") || requestUrl === page.url) {
      await route.fallback();
      return;
    }

    await route.abort();
  });
}
