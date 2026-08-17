import { afterEach, describe, expect, it, vi } from "vitest";

/** slug를 명시적으로 주입하고 모듈을 다시 읽는다.
 *
 * `githubAppConfig.ts`는 모듈 로드 시점에 `import.meta.env`를 읽으므로
 * stub만으로는 이미 캡처된 값이 바뀌지 않는다. ambient 환경에 기대면
 * `.env.local`이 있는 개발자 머신에서만 실패하는 테스트가 된다.
 */
async function loadWithSlug(slug: string) {
  vi.resetModules();
  vi.stubEnv("VITE_GITHUB_APP_SLUG", slug);

  return import("./githubAppConfig");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getGitHubAppInstallationUrl", () => {
  it("slug가 비어 있으면 null을 돌려준다", async () => {
    // Options가 설치 링크 대신 안내 문구로 분기할 수 있어야 한다.
    for (const slug of ["", "   "]) {
      const { getGitHubAppInstallationUrl } = await loadWithSlug(slug);
      expect(getGitHubAppInstallationUrl()).toBeNull();
    }
  });

  it("slug가 있으면 GitHub App 설치 URL을 조립한다", async () => {
    const { getGitHubAppInstallationUrl } = await loadWithSlug("solvesync");

    expect(getGitHubAppInstallationUrl()).toBe(
      "https://github.com/apps/solvesync/installations/new"
    );
  });

  it("slug 앞뒤 공백을 무시한다", async () => {
    const { getGitHubAppInstallationUrl } = await loadWithSlug("  solvesync  ");

    expect(getGitHubAppInstallationUrl()).toBe(
      "https://github.com/apps/solvesync/installations/new"
    );
  });

  it("slug를 URL 인코딩한다", async () => {
    // slug는 설정에서 오므로 경로를 벗어나는 값이 들어오면 안 된다.
    const { getGitHubAppInstallationUrl } = await loadWithSlug("a/../b");

    expect(getGitHubAppInstallationUrl()).toBe(
      "https://github.com/apps/a%2F..%2Fb/installations/new"
    );
  });
});
