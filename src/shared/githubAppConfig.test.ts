import { describe, expect, it } from "vitest";

import { getGitHubAppInstallationUrl } from "./githubAppConfig";

describe("getGitHubAppInstallationUrl", () => {
  it("slug가 설정되지 않았으면 null을 돌려준다", () => {
    // 테스트 환경에는 VITE_GITHUB_APP_SLUG가 없다. 설정이 비어 있을 때
    // 조립된 URL 대신 null이 나와야 Options가 안내 문구로 분기할 수 있다.
    expect(getGitHubAppInstallationUrl()).toBeNull();
  });

  it("null이거나 GitHub App 설치 URL 형식이다", () => {
    // 환경변수가 주입된 빌드에서도 계약은 같다. 이 테스트는 slug가 있든
    // 없든 통과해야 하며, 잘못 조립된 경로를 잡는다.
    const url = getGitHubAppInstallationUrl();

    if (url !== null) {
      expect(url).toMatch(
        /^https:\/\/github\.com\/apps\/[^/]+\/installations\/new$/u
      );
    }
  });
});
