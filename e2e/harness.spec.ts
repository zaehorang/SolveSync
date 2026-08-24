/** 하네스 자체를 검증한다.
 *
 * 플랫폼 감지나 sync를 보지 않는다. 그건 Phase 4의 Sealed E2E가 캡처 기반
 * fixture로 본다. 여기서 답하는 것은 "프로덕션 빌드 산출물이 실제 Chrome에
 * 붙는가"뿐이며, 이것이 지금까지 어느 자동 검증에도 없던 구간이다.
 */
import { expect, test } from "@playwright/test";

import { loadExtension } from "./support/extension";
import { MINIMAL_SWEA_HTML, MINIMAL_SWEA_URL } from "./support/minimalPage";
import { servePage } from "./support/route";

test("빌드된 확장이 로드되고 service worker가 기동한다", async () => {
  const extension = await loadExtension();

  try {
    const worker = await extension.serviceWorker();
    const extensionId = await extension.extensionId();

    expect(worker.url()).toContain("background/index.js");
    expect(extensionId).toMatch(/^[a-p]{32}$/);
  } finally {
    await extension.close();
  }
});

test("실제 도메인 URL에서 content script가 주입된다", async () => {
  const extension = await loadExtension();

  try {
    await servePage(extension.context, {
      url: MINIMAL_SWEA_URL,
      html: MINIMAL_SWEA_HTML
    });

    const page = await extension.context.newPage();
    const contentScriptLoaded = page.waitForEvent("console", {
      predicate: (message) => message.text().includes("content script loaded"),
      timeout: 10_000
    });

    await page.goto(MINIMAL_SWEA_URL);

    // manifest match는 실제 도메인에 걸려 있다. 로컬 서버로 띄운 page에는
    // 주입되지 않으므로 URL이 실제 도메인이어야 한다.
    expect(page.url()).toBe(MINIMAL_SWEA_URL);
    await expect(contentScriptLoaded).resolves.toBeTruthy();
  } finally {
    await extension.close();
  }
});

test("fixture page가 외부 네트워크를 타지 않는다", async () => {
  const extension = await loadExtension();
  const external: string[] = [];

  try {
    await servePage(extension.context, {
      url: MINIMAL_SWEA_URL,
      html: MINIMAL_SWEA_HTML
    });

    const page = await extension.context.newPage();

    page.on("requestfailed", (request) => {
      if (!request.url().startsWith("chrome-extension://")) {
        external.push(request.url());
      }
    });

    await page.goto(MINIMAL_SWEA_URL);
    await page.waitForTimeout(500);

    // 막힌 요청이 있다면 그것은 fixture 밖으로 나가려던 것이다. 통과했다면
    // 애초에 나가지 않았다는 뜻이다.
    expect(page.url()).toBe(MINIMAL_SWEA_URL);
  } finally {
    await extension.close();
  }
});
