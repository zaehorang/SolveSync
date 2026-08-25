/** GitHub write 계층.
 *
 * 확장 options page에서 `content:accepted_detected`를 보내 orchestration 전
 * 구간을 태우고, **Verification Repository에 실제로 생긴 commit을 밖에서**
 * 확인한다. 플랫폼 page도 content script도 쓰지 않으므로 여기서 실패하면
 * 원인은 GitHub 쪽 경로 하나로 좁혀진다.
 *
 * `content:accepted_detected`는 sender가 content script인지 검사하지 않는다.
 * 이 계층은 그 느슨함에 의존한다. sender 검증을 조이면 함께 고쳐야 한다.
 *
 * secret이 없으면 통째로 건너뛴다. fork PR에서 자동으로 그렇게 된다.
 */
import { expect, test } from "@playwright/test";

import { getPlatformPolicy } from "../src/shared/platformPolicy";
import type { SyncHistoryEntry } from "../src/shared/types";
import { DRIVERS } from "./drivers";
import { loadExtension } from "./support/extension";
import {
  openExtensionPage,
  readSyncHistoryEntries,
  requireRuntimeData,
  seedGitHubAuthSession
} from "./support/extensionPage";
import {
  createRunBranch,
  deleteRunBranch,
  fetchCommit,
  fetchSyncRepository,
  readFileAtRef,
  readVerificationRepositoryConfig
} from "./support/verificationRepository";

/** `src/background/sync.ts`의 `AcceptedSyncOutcome` 중 이 계층이 보는 분기.
 *
 * background module을 직접 import하지 않는다. `e2e/tsconfig.json`은 chrome
 * 타입을 싣지 않아 background를 한 program에 넣으면 typecheck가 깨진다. */
type AcceptedSyncOutcome =
  | { kind: "recorded"; syncHistoryEntry: SyncHistoryEntry }
  | { kind: "duplicate_processed" }
  | { kind: "duplicate_in_flight" };

const config = readVerificationRepositoryConfig();

test.describe("GitHub write 계층", () => {
  test.skip(
    config === null,
    "E2E_GITHUB_TOKEN과 E2E_GITHUB_REPOSITORY가 없으면 건너뛴다."
  );

  // 확장 기동에 더해 GitHub 왕복이 여러 번 있다.
  test.setTimeout(120_000);

  // 합성 payload가 없는 플랫폼은 이 계층을 돌지 않는다. LeetCode가 그렇다 —
  // source 조회가 플랫폼 세션을 요구해 합성 event로는 GitHub까지 닿지 못한다.
  for (const driver of DRIVERS.filter((candidate) => candidate.syntheticPayload)) {
    test(`${driver.platform} Accepted payload가 Verification Repository에 commit된다`, async () => {
      if (config === null) {
        return;
      }

      const repository = await fetchSyncRepository(config);
      const branch = await createRunBranch(config, repository);
      const extension = await loadExtension();

      try {
        const page = await openExtensionPage(extension);

        await seedGitHubAuthSession(page, {
          accessToken: config.token,
          login: repository.owner
        });

        await requireRuntimeData(page, {
          type: "settings:write",
          payload: {
            update: {
              syncRepository: repository,
              syncBranch: branch,
              autoSyncEnabled: true
            }
          }
        });

        const payload = driver.syntheticPayload?.();

        if (payload === undefined) {
          throw new Error("합성 payload가 없는 드라이버는 여기 오지 않는다.");
        }

        const outcome = await requireRuntimeData<AcceptedSyncOutcome>(page, {
          type: "content:accepted_detected",
          payload
        });

        // 프로필이 실행마다 새로 만들어지므로 processed Sync Deduplication
        // Key가 비어 있다. 여기서 duplicate가 나오면 그 전제가 깨진 것이다.
        expect(outcome.kind).toBe("recorded");

        const entry =
          outcome.kind === "recorded" ? outcome.syncHistoryEntry : null;

        // 실패했다면 원인을 그대로 보여준다. status만 비교하면 무엇이
        // 막혔는지 로그에 남지 않는다.
        expect(
          { status: entry?.status, error: entry?.error?.code ?? null },
          JSON.stringify(entry?.error ?? null)
        ).toEqual({ status: "synced", error: null });

        const commitSha = entry?.commitSha ?? "";
        const solutionPath = entry?.solutionPath ?? "";

        expect(commitSha).not.toBe("");
        expect(solutionPath).not.toBe("");

        // storage에 남은 Sync History도 같은 것을 말해야 한다. 응답만 보면
        // service worker가 잠든 뒤 무엇이 남는지는 알 수 없다.
        const stored = await readSyncHistoryEntries(page);

        expect(
          stored.some(
            (candidate) =>
              candidate.status === "synced" && candidate.commitSha === commitSha
          )
        ).toBe(true);

        const policy = getPlatformPolicy(driver.platform);
        const commit = await fetchCommit(config, commitSha);

        // 한 commit이 세 파일을 함께 바꾼다. Solution README와 Solution
        // Catalog가 뒤처지면 projection이 깨진 상태로 남는다.
        expect(commit.changedPaths).toEqual(
          expect.arrayContaining([
            solutionPath,
            policy.solutionReadmePath,
            policy.solutionCatalogPath
          ])
        );

        const committedSolution = await readFileAtRef(
          config,
          solutionPath,
          branch.name
        );

        expect(committedSolution).not.toBeNull();

        // payload에 code가 있는 플랫폼은 그 code가 그대로 도달해야 한다.
        // LeetCode는 code가 background GraphQL에서 오므로 해당 없다.
        if ("code" in payload) {
          expect(committedSolution).toContain(payload.code.trim());
        }

        const catalog = await readFileAtRef(
          config,
          policy.solutionCatalogPath,
          branch.name
        );

        expect(catalog).not.toBeNull();
        expect(catalog ?? "").toContain(entry?.titleSlug ?? "");
      } finally {
        await extension.close();
        // 남기면 다음 실행이 쌓인 branch 위에서 돈다.
        await deleteRunBranch(config, branch.name);
      }
    });
  }
});
