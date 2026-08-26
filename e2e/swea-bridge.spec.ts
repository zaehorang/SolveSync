/** SWEA bridge가 code를 못 읽을 때의 수렴.
 *
 * bridge가 깨졌을 때 **조용히 빈 파일이 commit되지 않는 것**이 이 spec의
 * 값이다. `resolveSweaSource`는 code가 비어 있으면 `swea_extract_failed`를
 * 돌려주고, 그 수렴이 실제 확장에서 일어나는지를 여기서 본다.
 *
 * Sealed 뼈대를 그대로 쓴다. 실제 page도 네트워크도 필요 없다 —
 * `resolveSweaSource`가 GitHub 호출 **앞에서** 끝나기 때문이다. 대신
 * `sealed.spec.ts`와 달리 auth와 settings를 심어야 한다. 심지 않으면
 * `setup_required`에서 멈춰 source 해석까지 오지 않는다. token은 아무 값이어도
 * 된다.
 *
 * **이 spec이 실증하는 조건은 "bridge는 살아 있지만 editor instance가 없을
 * 때"다.** manifest가 항상 주입하는 진짜 bridge 미주입 상태가 아니다. 그래서
 * 재생 전에 bridge가 실제로 응답하는 것을 먼저 확인한다 — 확인하지 않으면
 * bundle이 통째로 빠져도 같은 결과가 나와 이 spec이 아무것도 구분하지 못한다.
 */
import { expect, test } from "@playwright/test";

import {
  SWEA_BRIDGE_REQUEST_SOURCE,
  SWEA_BRIDGE_RESPONSE_SOURCE
} from "../src/content/sweaBridgeProtocol";
import type { SyncBranch, SyncRepository } from "../src/shared/types";
import { sweaDriver } from "./drivers/swea";
import { loadExtension } from "./support/extension";
import { capturedRecordingContains } from "./support/capturedResult";
import {
  openExtensionPage,
  requireRuntimeData,
  seedGitHubAuthSession,
  waitForSyncHistoryEntry
} from "./support/extensionPage";
import { servePage } from "./support/route";

/** 합성 설정. GitHub 호출까지 가지 않으므로 실재하지 않아도 된다.
 *
 * 그래도 실사용 저장소로 착각할 이름은 쓰지 않는다. 이 spec이 나중에 GitHub를
 * 타게 바뀌면 그 이름이 그대로 대상이 된다. */
const SYNTHETIC_REPOSITORY: SyncRepository = {
  owner: "solvesync-verification",
  name: "swea-bridge-failure",
  fullName: "solvesync-verification/swea-bridge-failure",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/solvesync-verification/swea-bridge-failure"
};

const SYNTHETIC_BRANCH: SyncBranch = {
  name: "main",
  sha: "0000000000000000000000000000000000000000",
  protected: false
};

test.describe("SWEA bridge 실패 수렴", () => {
  test("editor instance가 없으면 swea_extract_failed로 끝난다", async () => {
    const fixture = sweaDriver.fixture();

    // 재생하기 전에 판정 text가 캡처에 실재하는지 본다. Sealed와 같은 이유다.
    expect(
      capturedRecordingContains("swea", "accepted", fixture.resultText("accepted")),
      "판정 text가 캡처에 없다. 플랫폼이 문구를 바꿨다면 캡처부터 다시 돌린다."
    ).toBe(true);

    const extension = await loadExtension();

    try {
      const extensionPage = await openExtensionPage(extension);

      await seedGitHubAuthSession(extensionPage, {
        // GitHub 호출까지 가지 않는다. 값은 parser를 통과하기만 하면 된다.
        accessToken: "swea-bridge-failure-has-no-github-call",
        login: SYNTHETIC_REPOSITORY.owner
      });

      await requireRuntimeData(extensionPage, {
        type: "settings:write",
        payload: {
          update: {
            syncRepository: SYNTHETIC_REPOSITORY,
            syncBranch: SYNTHETIC_BRANCH,
            autoSyncEnabled: true
          }
        }
      });

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

      // **무엇을 검증하고 있는지 못 박는다.** `page.evaluate`는 MAIN world에서
      // 돌므로 bridge와 같은 world다. 여기서 응답이 오면 bundle은 주입돼
      // 동작하고 있고, `code: null`은 editor instance가 없어서다. 이 확인이
      // 없으면 bundle이 통째로 빠져도 이 spec은 그대로 통과한다.
      const probe = await page.evaluate(
        async ({ requestSource, responseSource, timeoutMs }) =>
          new Promise<{ responded: boolean; code: string | null }>((resolve) => {
            const nonce = "solvesync-e2e-bridge-probe";
            const timer = setTimeout(() => {
              window.removeEventListener("message", onMessage);
              resolve({ responded: false, code: null });
            }, timeoutMs);

            function onMessage(event: MessageEvent): void {
              const data = event.data as {
                source?: unknown;
                nonce?: unknown;
                code?: unknown;
              } | null;

              if (
                event.source !== window ||
                data === null ||
                typeof data !== "object" ||
                data.source !== responseSource ||
                data.nonce !== nonce
              ) {
                return;
              }

              clearTimeout(timer);
              window.removeEventListener("message", onMessage);
              resolve({
                responded: true,
                code: typeof data.code === "string" ? data.code : null
              });
            }

            window.addEventListener("message", onMessage);
            window.postMessage(
              { source: requestSource, nonce },
              window.location.origin
            );
          }),
        {
          requestSource: SWEA_BRIDGE_REQUEST_SOURCE,
          responseSource: SWEA_BRIDGE_RESPONSE_SOURCE,
          timeoutMs: 3_000
        }
      );

      expect(
        probe.responded,
        "MAIN world bridge가 응답하지 않는다. bundle이 주입되지 않았다면 이 spec은 의도한 조건을 검증하지 못한다."
      ).toBe(true);

      // 뼈대에 `.CodeMirror` host가 없으므로 bridge는 읽을 instance를 찾지
      // 못한다. 이것이 이 spec이 만드는 조건이다.
      expect(probe.code, "editor instance가 없는데 code가 왔다.").toBeNull();

      await fixture.showResult(page, "accepted");

      const entry = await waitForSyncHistoryEntry(
        extensionPage,
        (candidate) =>
          candidate.codingPlatform === "swea" && candidate.status !== "syncing"
      );

      // 실패했다면 무엇이 대신 기록됐는지 그대로 보여준다. code만 비교하면
      // `setup_required`로 멈춘 것과 구분되지 않는다.
      expect(
        { status: entry.status, error: entry.error?.code ?? null },
        JSON.stringify(entry.error ?? null)
      ).toEqual({ status: "failed", error: "swea_extract_failed" });

      // 빈 파일이 commit되지 않았다는 것이 이 항목의 값이다.
      expect(entry.commitSha).toBeNull();
      expect(entry.solutionPath).toBeNull();
    } finally {
      await extension.close();
    }
  });
});
