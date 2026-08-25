/** Sealed E2E.
 *
 * 실제 도메인 URL로 최소 뼈대 page를 띄우고 **캡처에서 온 판정 text**를
 * 그대로 나타나게 한 뒤, 프로덕션 content script가 그것을 Accepted로 읽어
 * background orchestration까지 보내는지 본다.
 *
 * 관측점은 Sync History다. `onMessage`를 후킹하지 않는다 — service worker는
 * 잠들었다 깨어나므로 evaluate로 심은 전역이 날아간다. Sync History는
 * `chrome.storage.local`에 남아 재시작에도 살아남고, "메시지가 도달했다"보다
 * 강한 것을 본다: payload가 orchestration까지 온전한 형태로 갔는가.
 *
 * **GitHub를 설정하지 않고 돌린다.** 그러면 `setup_required` entry가 남고
 * 거기에 platform·problem·language가 들어 있다. 네트워크를 타지 않으므로
 * secret 없이 fork PR에서도 돈다.
 */
import { expect, test } from "@playwright/test";

import { DRIVERS } from "./drivers";
import { loadExtension } from "./support/extension";
import { capturedRecordingContains } from "./support/capturedResult";
import {
  openExtensionPage,
  readSyncHistoryEntries,
  waitForSyncHistoryEntry
} from "./support/extensionPage";
import { servePage } from "./support/route";

/** 실패 결과에서 event가 0회인 것을 확인하기 위한 대기.
 *
 * 억제 창이 700ms이고 SWEA는 code 요청이 bridge를 한 번 왕복한다. 그보다
 * 넉넉해야 "아직 안 온 것"을 "안 오는 것"으로 잘못 읽지 않는다. */
const NO_EVENT_GRACE_MS = 3_000;

for (const driver of DRIVERS) {
  test.describe(`${driver.platform} Sealed E2E`, () => {
    test("Accepted 결과가 Sync History까지 도달한다", async () => {
      const fixture = driver.fixture();

      // 재생하기 전에 판정 text가 캡처에 실재하는지 본다. 이것이 없으면
      // 상상한 문자열로 우리 adapter를 검증하는 순환이 된다.
      expect(
        capturedRecordingContains(
          driver.platform,
          "accepted",
          fixture.resultText("accepted")
        ),
        "판정 text가 캡처에 없다. 플랫폼이 문구를 바꿨다면 캡처부터 다시 돌린다."
      ).toBe(true);

      const extension = await loadExtension();

      try {
        const extensionPage = await openExtensionPage(extension);

        await servePage(extension.context, {
          url: fixture.url,
          html: fixture.html()
        });

        const page = await extension.context.newPage();
        const contentScriptLoaded = page.waitForEvent("console", {
          predicate: (message) => message.text().includes("content script loaded"),
          timeout: 10_000
        });

        await page.goto(fixture.url);
        await contentScriptLoaded;

        await fixture.showResult(page, "accepted");

        const entry = await waitForSyncHistoryEntry(
          extensionPage,
          (candidate) => candidate.codingPlatform === driver.platform
        );

        // GitHub를 설정하지 않았으므로 여기까지 온 것이 정상 경로다.
        expect(entry.status).toBe("setup_required");
        expect(entry.problemTitle ?? "").not.toBe("");
        expect(entry.titleSlug).not.toBe("");
      } finally {
        await extension.close();
      }
    });

    test("실패 결과에서는 event가 생기지 않는다", async () => {
      const fixture = driver.fixture();

      expect(
        capturedRecordingContains(
          driver.platform,
          "rejected",
          fixture.resultText("rejected")
        ),
        "실패 text가 캡처에 없다. 캡처부터 다시 돌린다."
      ).toBe(true);

      // 두 신호가 겹치지 않는 것을 여기서 못 박는다. 실패 text가 Accepted
      // 판정에 걸리면 사용자는 틀린 풀이가 commit되는 것을 보게 된다.
      expect(fixture.resultText("rejected")).not.toBe(
        fixture.resultText("accepted")
      );

      const extension = await loadExtension();

      try {
        const extensionPage = await openExtensionPage(extension);

        await servePage(extension.context, {
          url: fixture.url,
          html: fixture.html()
        });

        const page = await extension.context.newPage();
        const contentScriptLoaded = page.waitForEvent("console", {
          predicate: (message) => message.text().includes("content script loaded"),
          timeout: 10_000
        });

        await page.goto(fixture.url);
        await contentScriptLoaded;

        await fixture.showResult(page, "rejected");
        await page.waitForTimeout(NO_EVENT_GRACE_MS);

        expect(await readSyncHistoryEntries(extensionPage)).toEqual([]);
      } finally {
        await extension.close();
      }
    });
  });
}
