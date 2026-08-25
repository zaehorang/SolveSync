/** 하네스가 심는 storage 상태가 제품 parser를 그대로 통과하는지 본다.
 *
 * GitHub write 계층은 `chrome.storage.local`에 auth session을 직접 쓴다.
 * `BackgroundRuntimeOptions.authManager` 주입은 프로덕션이 아닌 번들을
 * 로드하게 되어 이 계층의 전제를 깨기 때문이다. 대가는 **storage schema가
 * 바뀌면 하네스가 조용히 어긋난다**는 것이고, 이 spec이 그것을 막는다.
 *
 * secret이 필요 없다. 심는 token은 GitHub에 쓰이지 않고 parser만 통과한다.
 */
import { expect, test } from "@playwright/test";

import type { PublicSettingsState } from "../src/shared/storageSchema";
import type { SyncBranch, SyncRepository } from "../src/shared/types";
import { loadExtension } from "./support/extension";
import {
  openExtensionPage,
  requireRuntimeData,
  seedGitHubAuthSession
} from "./support/extensionPage";

const REPOSITORY: SyncRepository = {
  owner: "solvesync-verification",
  name: "seed-only",
  fullName: "solvesync-verification/seed-only",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/solvesync-verification/seed-only"
};

const BRANCH: SyncBranch = {
  name: "e2e/seed-only",
  sha: "0".repeat(40),
  protected: false
};

test("심은 GitHub auth session을 제품이 연결된 상태로 읽는다", async () => {
  const extension = await loadExtension();

  try {
    const page = await openExtensionPage(extension);

    await seedGitHubAuthSession(page, {
      accessToken: "seed-only-token-never-sent-to-github",
      login: "solvesync-verification"
    });

    const settings = await requireRuntimeData<PublicSettingsState>(page, {
      type: "settings:read"
    });

    // parser가 session을 버리면 여기서 false가 된다. schema가 바뀌면
    // 하네스가 아니라 이 단언이 먼저 깨진다.
    expect(settings.isGithubConnected).toBe(true);
    expect(settings.githubAccount?.login).toBe("solvesync-verification");
  } finally {
    await extension.close();
  }
});

test("settings:write로 심은 Sync Repository와 branch가 그대로 돌아온다", async () => {
  const extension = await loadExtension();

  try {
    const page = await openExtensionPage(extension);

    // storage를 손으로 쓰지 않고 제품 경로로 심는다. schema가 바뀌면 제품과
    // 함께 바뀐다.
    const written = await requireRuntimeData<PublicSettingsState>(page, {
      type: "settings:write",
      payload: {
        update: {
          syncRepository: REPOSITORY,
          syncBranch: BRANCH,
          autoSyncEnabled: true
        }
      }
    });

    expect(written.syncRepository).toEqual(REPOSITORY);
    expect(written.syncBranch).toEqual(BRANCH);
    expect(written.autoSyncEnabled).toBe(true);

    const read = await requireRuntimeData<PublicSettingsState>(page, {
      type: "settings:read"
    });

    expect(read.syncRepository).toEqual(REPOSITORY);
    expect(read.syncBranch).toEqual(BRANCH);
  } finally {
    await extension.close();
  }
});
