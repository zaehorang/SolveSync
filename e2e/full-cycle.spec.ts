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
import { ensureSweaLogin } from "./capture/sweaLogin";
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
  sweepStaleRunBranches,
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
/** 채점 출력 비교 전 표시상의 차이를 없앤다.
 *
 * SWEA의 TEST 결과 패널은 숫자 사이 공백을 **비분리 공백(U+00A0)** 으로
 * 그린다(2026-08-26 실측). 예제 파일은 일반 공백이라 그대로 비교하면 값이
 * 같은데도 다르다고 나오고, 그러면 dry-run 문이 정상 코드를 막는다. */
function normalizeJudgeOutput(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n").trim();
}

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

  test.beforeAll(async () => {
    if (config === null) {
      return;
    }

    const swept = await sweepStaleRunBranches(config);

    if (swept.length > 0) {
      console.info(`[full-cycle] 끊긴 실행이 남긴 branch ${swept.length}개를 치웠다.`);
    }
  });

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

        // SWEA의 `SESSION` 쿠키는 만료 기한 없이 발급되는 진짜 session
        // cookie라 브라우저 프로세스가 끝나면 사라진다. 다른 둘과 달리
        // "미리 로그인해 두기"가 통하지 않아 실행마다 여기서 로그인한다.
        // 자격증명은 `.env`에서만 오고 값은 어디에도 찍지 않는다.
        if (driver.platform === "swea") {
          await ensureSweaLogin(page);
          console.info("[full-cycle] SWEA 로그인 완료");
        }

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

        // **가상 스크롤이 실제로 생겼는지 잰다.** SWEA editor는 CodeMirror이고
        // 화면에 보이는 줄만 DOM에 그린다. bridge는 DOM이 아니라 editor
        // instance의 `getValue()`를 부르므로 화면 밖 줄도 와야 하는데, 풀이가
        // 짧아 전부 렌더되면 그 전제는 검증되지 않은 채 통과한다. 여기서
        // 렌더된 줄이 전체보다 적은 것을 확인해야 아래의 줄 수 단언이 의미를
        // 갖는다. code 원문은 남기지 않고 줄 수만 남긴다.
        if (driver.platform === "swea") {
          const editorLines = await page.evaluate(() => {
            const host = document.querySelector(".CodeMirror") as
              | (Element & { CodeMirror?: { getValue(): string } })
              | null;
            const value = host?.CodeMirror?.getValue() ?? null;

            return {
              total: value === null ? null : value.split("\n").length,
              rendered: document.querySelectorAll(".CodeMirror-line").length
            };
          });

          console.info(
            `[full-cycle] SWEA editor 줄 수: 전체 ${editorLines.total ?? "?"}, 렌더 ${editorLines.rendered}`
          );

          // 제출 상한이 99회다. 몇 회를 썼는지 실행마다 남겨 두면 나중에
          // 남은 여유를 사람이 page를 열지 않고도 안다. selector를 짚지 않고
          // page 문구에서 읽는다 — 못 읽어도 제출을 막지 않는다.
          const quota = await page.evaluate(() => {
            const match = document.body.innerText.match(
              /제출\s*횟수[^\d]*(\d+)\s*\/\s*(\d+)/
            );

            return match === null ? null : `${match[1]}/${match[2]}`;
          });

          console.info(`[full-cycle] SWEA 제출횟수(제출 전): ${quota ?? "읽지 못했다"}`);

          expect(
            editorLines.total,
            "editor instance에서 code를 읽지 못했다."
          ).not.toBeNull();

          expect(
            editorLines.rendered,
            `가상 스크롤이 생기지 않았다. 전체 ${editorLines.total ?? "?"}줄이 모두 렌더돼 화면 밖 줄을 검증하지 못한다. 검증용 풀이를 더 길게 만들어라.`
          ).toBeLessThan(editorLines.total ?? 0);
        }

        // 제출 앞의 두 번째 문. 채점 없이 먼저 돌려 예제와 대조한다.
        // 지원하는 플랫폼만 있다 — SWEA가 여기 해당하고, 제출 상한이 있어
        // 그 값이 가장 크다.
        if (captureDriver.dryRun !== undefined) {
          const sample = await readDryRunSample(driver.platform);
          const output = await captureDriver.dryRun(page, sample.input);

          // 무엇이 달랐는지 함께 남긴다. 이건 우리 검증용 코드의 출력이지
          // 사용자 데이터가 아니다.
          expect(
            normalizeJudgeOutput(output),
            `dry-run 출력이 예제와 다르다. 제출하지 않는다. 받은=${JSON.stringify(
              normalizeJudgeOutput(output).slice(0, 200)
            )}`
          ).toBe(normalizeJudgeOutput(sample.expected));
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
          const diagnosis = await page.evaluate(() => {
            const controls = [
              ...document.querySelectorAll("button,[role='button'],a")
            ]
              .filter((element) =>
                /^(submit|제출)$/i.test(
                  (element.textContent ?? "").replace(/\s+/g, " ").trim()
                )
              )
              .map((element) => {
                const rect = element.getBoundingClientRect();
                const top = document.elementFromPoint(
                  rect.left + rect.width / 2,
                  rect.top + rect.height / 2
                );

                return {
                  tag: element.tagName.toLowerCase(),
                  size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                  disabled: (element as HTMLButtonElement).disabled ?? null,
                  가려짐: !(top === element || element.contains(top))
                };
              });

            return {
              url: location.href,
              로그인유도: /로그인|log in|sign in/i.test(document.body.innerText),
              제출control: controls
            };
          });

          throw new Error(
            diagnosis.로그인유도
              ? `30초 안에 제출하지 못했고 page가 로그인을 요구한다. Verification Profile에 다시 로그인해라 (npm run e2e:login). url=${diagnosis.url}`
              : `30초 안에 제출하지 못했다. url=${diagnosis.url} 제출control=${JSON.stringify(
                  diagnosis.제출control
                )}`
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

        // **잘리지 않았는가.** Programmers와 SWEA는 editor snapshot이 그대로
        // commit되므로 줄 수가 정확히 같아야 한다. nonce 포함만 보면 nonce가
        // 마지막 줄이라 앞이 잘려도 통과한다 — SWEA editor는 화면에 보이는
        // 줄만 DOM에 그리므로 이것이 실제 위험이다. LeetCode는 code가
        // background GraphQL에서 오므로 여기 해당하지 않는다.
        //
        // 전문 비교(`toBe(code)`)로 조이지 않는다. editor는 입력을 조용히
        // 바꾸고(auto-indent) 그러면 정상 실행이 깨진다. 줄 수는 그 변형을
        // 견디면서 잘림은 잡는 자리다.
        //
        // **SWEA에서만 실제로 돌려봤다**(2026-08-26). Programmers 경로는 code가
        // `textarea#code`에서 오는데 그쪽이 마지막 빈 줄을 다르게 다루는지
        // 아직 확인하지 않았다. 다음 Programmers 풀사이클이 여기서 깨지면
        // 그때가 첫 실측이다.
        if (driver.platform !== "leetcode") {
          expect(
            (committed ?? "").split("\n").length,
            "commit된 줄 수가 넣은 코드와 다르다. editor code가 잘렸을 수 있다."
          ).toBe(code.split("\n").length);
        }
      } finally {
        await context.close();
        await deleteRunBranch(config, branch.name);
      }
    });
  }
});
