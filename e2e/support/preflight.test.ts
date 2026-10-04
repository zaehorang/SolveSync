import { describe, expect, it } from "vitest";

import {
  assessGitHubProbe,
  buildPreflightItems,
  collectPreflightObservations,
  detectPreflightMode,
  formatPreflight,
  type PreflightObservations
} from "./preflight";
import { preflightFailure } from "../globalSetup";

const token = "test-token-value";

const missingGitHubCases: Array<{ label: string; env: NodeJS.ProcessEnv }> = [
  { label: "변수가 없을 때", env: {} },
  { label: "빈 token일 때", env: { E2E_GITHUB_TOKEN: "" } },
  {
    label: "공백 token일 때",
    env: { E2E_GITHUB_TOKEN: "   ", E2E_GITHUB_REPOSITORY: "owner/repository" }
  },
  {
    label: "슬래시 없는 repository일 때",
    env: { E2E_GITHUB_TOKEN: token, E2E_GITHUB_REPOSITORY: "repository" }
  },
  {
    label: "빈 name일 때",
    env: { E2E_GITHUB_TOKEN: token, E2E_GITHUB_REPOSITORY: "owner/" }
  },
  { label: "repository가 한쪽만 있을 때", env: { E2E_GITHUB_TOKEN: token } }
];

function observations(
  overrides: Partial<PreflightObservations> = {}
): PreflightObservations {
  return {
    distManifestExists: true,
    envFileExists: true,
    liveSubmitKeyPresent: false,
    playwrightChromiumInstalled: true,
    verificationProfileExists: true,
    githubTokenPresent: true,
    githubRepositoryPresent: true,
    githubConfigured: true,
    githubProbe: { kind: "ok" },
    sweaIdPresent: true,
    sweaPasswordPresent: true,
    ...overrides
  };
}

describe("E2E 사전 점검", () => {
  it("기본 실행에는 확장 산출물과 GitHub write만 표시한다", () => {
    const items = buildPreflightItems("default", observations());

    expect(items.map((item) => item.id)).toEqual(["dist", "github"]);
  });

  it("환경 점검은 모든 항목을 표시하고 누락마다 해결책을 남긴다", () => {
    const items = buildPreflightItems(
      "check",
      observations({ envFileExists: false, playwrightChromiumInstalled: false })
    );

    expect(items.map((item) => item.id)).toEqual([
      "dist",
      "env",
      "chromium",
      "live-submit",
      "github",
      "swea",
      "profile"
    ]);
    expect(items.find((item) => item.id === "env")?.status).toBe("missing");
    expect(items.find((item) => item.id === "chromium")?.action).toContain(
      "playwright install"
    );
    expect(detectPreflightMode({ E2E_CHECK: "1" })).toBe("check");
  });

  it("환경 점검은 E2E_LIVE_SUBMIT 키가 남아 있으면 실패로 표시한다", async () => {
    const items = buildPreflightItems("check", observations({ liveSubmitKeyPresent: true }));

    expect(items.find((item) => item.id === "live-submit")?.status).toBe("failed");

    const found = await collectPreflightObservations({ E2E_LIVE_SUBMIT: "" }, async () => ({
      status: 200
    }));

    expect(found.liveSubmitKeyPresent).toBe(true);
  });

  it("로그인·SWEA 캡처·Contract Check·풀사이클에 관련 항목만 표시한다", () => {
    expect(buildPreflightItems("login", observations()).map((item) => item.id)).toEqual([
      "dist",
      "profile"
    ]);
    expect(buildPreflightItems("capture-swea", observations()).map((item) => item.id)).toEqual([
      "dist",
      "swea"
    ]);
    expect(buildPreflightItems("contract", observations()).map((item) => item.id)).toEqual([
      "dist",
      "swea",
      "profile"
    ]);
    expect(buildPreflightItems("live-submit", observations()).map((item) => item.id)).toEqual([
      "dist",
      "github",
      "swea",
      "profile"
    ]);
  });

  it("dist와 환경 변수 반쪽 설정을 누락으로 표시한다", () => {
    const items = buildPreflightItems(
      "live-submit",
      observations({
        distManifestExists: false,
        githubTokenPresent: false,
        githubConfigured: false,
        sweaPasswordPresent: false
      })
    );

    expect(items.find((item) => item.id === "dist")?.status).toBe("missing");
    expect(items.find((item) => item.id === "github")?.status).toBe("missing");
    expect(items.find((item) => item.id === "swea")?.status).toBe("missing");
  });

  it.each([
    [200, "ok"],
    [401, "failed"],
    [403, "failed"],
    [404, "failed"]
  ] as const)("GitHub HTTP %i를 %s로 판정한다", (status, kind) => {
    expect(assessGitHubProbe(status)).toEqual({ kind, ...(kind === "ok" ? {} : { status }) });
  });

  it("네트워크 오류를 확인 실패로 표시한다", () => {
    const items = buildPreflightItems(
      "default",
      observations({ githubProbe: { kind: "network-error" } })
    );

    expect(items.find((item) => item.id === "github")?.status).toBe("failed");
  });

  it.each(missingGitHubCases)("$label GitHub 설정을 누락으로 판정하고 fetch하지 않는다", async ({ env }) => {
    let called = false;
    const result = await collectPreflightObservations(env, async () => {
      called = true;
      return new Response(null, { status: 200 });
    });

    const github = buildPreflightItems("default", result).find(
      (item) => item.id === "github"
    );

    expect(called).toBe(false);
    expect(github?.status).toBe("missing");
  });

  it("잘못된 repository 형식에는 owner/name 안내를 남긴다", async () => {
    const result = await collectPreflightObservations(
      { E2E_GITHUB_TOKEN: token, E2E_GITHUB_REPOSITORY: "repository" },
      async () => new Response(null, { status: 200 })
    );
    const github = buildPreflightItems("default", result).find(
      (item) => item.id === "github"
    );

    expect(github?.action).toContain("owner/name");
    expect(result.githubProbe).toBeNull();
  });

  it.each([
    [200, "ok"],
    [401, "failed"]
  ] as const)("수집한 GitHub HTTP %i 결과를 %s로 출력하고 token을 숨긴다", async (status, kind) => {
    const result = await collectPreflightObservations(
      {
        E2E_GITHUB_TOKEN: token,
        E2E_GITHUB_REPOSITORY: "owner/repository"
      },
      async (_input, init) => {
        expect(init.headers).toEqual(
          expect.objectContaining({ authorization: `Bearer ${token}` })
        );
        return new Response(null, { status });
      }
    );
    const items = buildPreflightItems("live-submit", result);
    const output = formatPreflight("live-submit", items);

    expect(result.githubProbe?.kind).toBe(kind);
    expect(output).not.toContain(token);
    expect(preflightFailure("live-submit", items) ?? "").not.toContain(token);
  });

  it("fetch 오류를 network-error로 수렴하고 token을 숨긴다", async () => {
    const result = await collectPreflightObservations(
      {
        E2E_GITHUB_TOKEN: token,
        E2E_GITHUB_REPOSITORY: "owner/repository"
      },
      async (_input, init) => {
        expect(init.headers).toEqual(
          expect.objectContaining({ authorization: `Bearer ${token}` })
        );
        throw new Error("network failed");
      }
    );
    const items = buildPreflightItems("live-submit", result);

    expect(result.githubProbe).toEqual({ kind: "network-error" });
    expect(formatPreflight("live-submit", items)).not.toContain(token);
    expect(preflightFailure("live-submit", items)).not.toContain(token);
  });

  it("풀사이클에서만 준비되지 않은 GitHub write를 중단 사유로 만든다", () => {
    const items = buildPreflightItems(
      "live-submit",
      observations({ githubProbe: { kind: "failed", status: 401 } })
    );

    expect(preflightFailure("default", items)).toBeNull();
    expect(preflightFailure("live-submit", items)).toContain("풀사이클을 시작하지 않는다");
  });
});
