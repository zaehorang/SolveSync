/** 풀사이클.
 *
 * **실제 계정으로 실제 채점 제출을 한다.** 되돌릴 수 없고 계정에 영구 기록이
 * 남는다. SWEA는 문제당 제출 상한이 99회다. 그래서 `E2E_LIVE_SUBMIT=1`이
 * 있을 때만 돌고, CI에는 배선하지 않는다.
 *
 * ```bash
 * E2E_LIVE_SUBMIT=1 npm run e2e:full-cycle
 * E2E_LIVE_PLATFORM=programmers E2E_LIVE_SUBMIT=1 npm run e2e:full-cycle
 * ```
 *
 * 이 계층만이 실증하는 것: 실제 플랫폼 DOM에서 실제 Accepted가 나고, 그것이
 * content script를 거쳐 실제 GitHub commit이 되는 전 구간. 앞의 세 계층은
 * 각자 그 일부만 본다.
 */
import { expect, test } from "@playwright/test";

import type { PublicSettingsState } from "../src/shared/storageSchema";
import {
  DRIVERS as CAPTURE_DRIVERS,
  readDryRunSample,
  readSolution
} from "./capture/drivers";
import { DRIVERS } from "./drivers";
import {
  openExtensionPage,
  requireRuntimeData,
  seedGitHubAuthSession,
  waitForSyncHistoryEntry
} from "./support/extensionPage";
import { openVerificationProfile } from "./support/profile";
import {
  createRunBranch,
  deleteRunBranch,
  fetchSyncRepository,
  readFileAtRef,
  readVerificationRepositoryConfig
} from "./support/verificationRepository";

const config = readVerificationRepositoryConfig();
const enabled = process.env.E2E_LIVE_SUBMIT === "1";
const only = process.env.E2E_LIVE_PLATFORM?.trim();

/** 코드에 붙일 주석 접두사. 실행마다 코드를 다르게 만들어야 한다.
 *
 * Programmers와 SWEA는 `acceptedSourceId`에 code hash가 들어간다. 코드가
 * 같으면 두 번째 실행이 중복으로 걸러져 commit이 생기지 않고, **그 통과는
 * 거짓이다.** */
const COMMENT_PREFIX: Record<string, string> = {
  py: "#",
  swift: "//",
  cpp: "//"
};

test.describe("풀사이클", () => {
  test.skip(
    !enabled || config === null,
    "E2E_LIVE_SUBMIT=1과 Verification Repository 설정이 있을 때만 돈다. 실제 제출이다."
  );

  // 실제 채점은 오래 걸린다. LeetCode는 대기열에 들어가기도 한다.
  test.setTimeout(10 * 60 * 1000);

  for (const driver of DRIVERS) {
    test(`${driver.platform} 실제 Accepted가 실제 commit이 된다`, async () => {
      test.skip(
        only !== undefined && only.length > 0 && only !== driver.platform,
        `E2E_LIVE_PLATFORM=${only}만 돌린다.`
      );

      if (config === null) {
        return;
      }

      const captureDriver = CAPTURE_DRIVERS[driver.platform];
      const repository = await fetchSyncRepository(config);
      const branch = await createRunBranch(config, repository);
      const context = await openVerificationProfile({ withExtension: true });
        console.info("[full-cycle] 프로필 복사와 브라우저 기동 완료");

      try {
        const worker =
          context.serviceWorkers()[0] ??
          (await context.waitForEvent("serviceworker"));
        const extensionId = new URL(worker.url()).host;
        console.info("[full-cycle] service worker 기동");
        const extensionPage = await openExtensionPage({
          context,
          extensionId: async () => extensionId
        });

        await seedGitHubAuthSession(extensionPage, {
          accessToken: config.token,
          login: repository.owner
        });

        const settings = await requireRuntimeData<PublicSettingsState>(
          extensionPage,
          {
            type: "settings:write",
            payload: {
              update: {
                syncRepository: repository,
                syncBranch: branch,
                autoSyncEnabled: true
              }
            }
          }
        );

        // **제출 전 마지막 문.** 여기서부터는 실제 제출이고 확장이 실제로
        // commit한다. 대상이 Verification Repository가 아니면 사용자의 실사용
        // Sync Repository에 쓰게 된다. 그 실수는 되돌릴 수 없다.
        expect(
          settings.syncRepository?.fullName,
          "대상이 Verification Repository가 아니다. 제출하지 않는다."
        ).toBe(`${config.owner}/${config.name}`);
        expect(settings.syncBranch?.name).toBe(branch.name);
        console.info("[full-cycle] 설정 주입과 대상 확인 완료");

        const page = await context.newPage();

        await captureDriver.open(page);
        console.info("[full-cycle] 문제 page 열림");

        // **제출 앞의 세 번째 문: 로그인.** 로그아웃 상태면 editor도 제출
        // control도 없고, Playwright의 click과 wait는 test timeout까지
        // 조용히 기다린다(2026-08-25 실측: 10분을 그렇게 썼다). 무엇이
        // 문제인지 곧바로 말하게 한다.
        const loginPrompted = await page.evaluate(() =>
          /로그인|log in|sign in/i.test(document.body.innerText)
        );

        expect(
          loginPrompted,
          `page가 로그인을 요구한다. Verification Profile의 ${driver.platform} 세션이 없거나 만료됐다. \`npm run e2e:login\`으로 로그인한 뒤 다시 돌려라. url=${page.url()}`
        ).toBe(false);

        const prefix = COMMENT_PREFIX[captureDriver.extension] ?? "//";
        const nonce = new Date().toISOString();
        const code = `${await readSolution(
          driver.platform,
          "accepted"
        )}\n${prefix} solvesync full-cycle ${nonce}\n`;

        await captureDriver.writeSolution(page, code);
        console.info("[full-cycle] 코드 입력 완료");

        // 제출 앞의 두 번째 문. 채점 없이 먼저 돌려 예제와 대조한다.
        // 지원하는 플랫폼만 있다 — SWEA가 여기 해당하고, 제출 상한이 있어
        // 그 값이 가장 크다.
        if (captureDriver.dryRun !== undefined) {
          const sample = await readDryRunSample(driver.platform);
          const output = await captureDriver.dryRun(page, sample.input);

          expect(
            output.trim(),
            "dry-run 출력이 예제와 다르다. 제출하지 않는다."
          ).toBe(sample.expected);
        }

        // **제출 앞의 세 번째 문: 로그인.** 로그아웃 상태면 제출 control이
        // 아예 없고, 그러면 click이 actionability를 기다리며 test timeout까지
        // 조용히 멈춘다(2026-08-25 실측: 10분을 그렇게 썼다). 무엇이 문제인지
        // 곧바로 말하게 한다.
        // Playwright의 click은 기본적으로 test timeout까지 기다린다. 여기서
        // 그러면 진단이 10분 뒤에야 나온다. 제한을 걸어 먼저 끊는다.
        const submitted = captureDriver.submit(page);
        const timedOut = Symbol("timeout");

        await Promise.race([
          submitted,
          new Promise((resolve) => setTimeout(() => resolve(timedOut), 30_000))
        ]).then(async (result) => {
          if (result !== timedOut) {
            return;
          }
          const diagnosis = await page.evaluate(() => ({
            url: location.href,
            로그인유도: /로그인|log in|sign in/i.test(document.body.innerText)
          }));

          throw new Error(
            diagnosis.로그인유도
              ? `30초 안에 제출하지 못했고 page가 로그인을 요구한다. Verification Profile에 다시 로그인해라 (npm run e2e:login). url=${diagnosis.url}`
              : `30초 안에 제출하지 못했다. 제출 control의 selector가 바뀌었을 수 있다. url=${diagnosis.url}`
          );
        });
        console.info("[full-cycle] 제출 버튼 눌림");

        const entry = await waitForSyncHistoryEntry(
          extensionPage,
          (candidate) =>
            candidate.codingPlatform === driver.platform &&
            candidate.status !== "syncing",
          3 * 60 * 1000
        );

        expect(
          { status: entry.status, error: entry.error?.code ?? null },
          JSON.stringify(entry.error ?? null)
        ).toEqual({ status: "synced", error: null });

        const committed = await readFileAtRef(
          config,
          entry.solutionPath ?? "",
          branch.name
        );

        expect(committed).not.toBeNull();

        // 방금 제출한 그 코드인가. 세 플랫폼 모두에 적용된다 — LeetCode도
        // background가 GraphQL로 가져오는 것이 방금 제출한 그 source다.
        // stale Accepted를 재사용하면 여기서 드러난다.
        expect(committed).toContain(nonce);
      } finally {
        await context.close();
        await deleteRunBranch(config, branch.name);
      }
    });
  }
});
