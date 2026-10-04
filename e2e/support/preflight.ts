/** E2E 실행 전에 필요한 준비물을 점검한다.
 *
 * 환경 변수의 값은 어떤 경로에서도 출력하지 않는다. 사전 점검은 키의 존재와
 * GitHub 응답 상태만 다룬다.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readVerificationRepositoryConfig } from "./verificationRepository";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export type PreflightMode =
  | "default"
  | "check"
  | "login"
  | "capture-swea"
  | "contract"
  | "live-submit";

export type PreflightStatus = "ready" | "missing" | "failed";

export type GitHubProbe =
  | { readonly kind: "ok" }
  | { readonly kind: "failed"; readonly status: number }
  | { readonly kind: "network-error" };

export type PreflightFetch = (
  input: string,
  init: RequestInit
) => Promise<Pick<Response, "status">>;

export interface PreflightObservations {
  readonly distManifestExists: boolean;
  readonly envFileExists: boolean;
  readonly liveSubmitKeyPresent: boolean;
  readonly playwrightChromiumInstalled: boolean;
  readonly verificationProfileExists: boolean;
  readonly githubTokenPresent: boolean;
  readonly githubRepositoryPresent: boolean;
  readonly githubConfigured: boolean;
  readonly githubProbe: GitHubProbe | null;
  readonly sweaIdPresent: boolean;
  readonly sweaPasswordPresent: boolean;
}

export interface PreflightItem {
  readonly id: "dist" | "env" | "live-submit" | "chromium" | "github" | "swea" | "profile";
  readonly label: string;
  readonly status: PreflightStatus;
  readonly action: string;
}

function isPresent(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

export function detectPreflightMode(env: NodeJS.ProcessEnv): PreflightMode {
  if (env.E2E_CHECK === "1") {
    return "check";
  }

  if (env.E2E_LIVE_SUBMIT === "1") {
    return "live-submit";
  }

  if (env.E2E_CONTRACT === "1") {
    return "contract";
  }

  if (env.E2E_CAPTURE_SWEA === "1") {
    return "capture-swea";
  }

  if (env.E2E_LOGIN === "1") {
    return "login";
  }

  return "default";
}

/** GitHub 응답의 상세 본문은 출력하지 않는다. */
export function assessGitHubProbe(status: number): GitHubProbe {
  return status === 200 ? { kind: "ok" } : { kind: "failed", status };
}

export function buildPreflightItems(
  mode: PreflightMode,
  observations: PreflightObservations
): PreflightItem[] {
  const items: PreflightItem[] = [
    observations.distManifestExists
      ? {
          id: "dist",
          label: "빌드 산출물",
          status: "ready",
          action: "dist/manifest.json을 확인했다."
        }
      : {
          id: "dist",
          label: "빌드 산출물",
          status: "missing",
          action: "npm run build 후 다시 실행해라. 확장을 로드하는 계층은 준비되지 않았다."
        }
  ];

  if (mode === "check") {
    items.push(envItem(observations), chromiumItem(observations), liveSubmitItem(observations));
  }

  if (mode === "default" || mode === "check" || mode === "live-submit") {
    items.push(githubItem(observations));
  }

  if (mode === "capture-swea" ||
    mode === "contract" ||
    mode === "check" ||
    mode === "live-submit"
  ) {
    items.push(sweaItem(observations));
  }

  if (mode === "login" || mode === "contract" || mode === "check" || mode === "live-submit") {
    items.push(profileItem(observations));
  }

  return items;
}

function envItem(observations: PreflightObservations): PreflightItem {
  return observations.envFileExists
    ? {
        id: "env",
        label: ".env",
        status: "ready",
        action: "현재 디렉터리에 .env가 있다."
      }
    : {
        id: "env",
        label: ".env",
        status: "missing",
        action:
          "현재 디렉터리에 .env가 없다. worktree라면 주 디렉터리의 .env를 복사해라(symlink가 아니라 복사)."
      };
}

/** 값은 보지 않고 키가 있는지만 본다. `npm run e2e`는 풀사이클 spec도 돌려서
 * 이 키가 셸이나 `.env`에 남아 있으면 확인 없이 실제 제출이 일어난다. */
function liveSubmitItem(observations: PreflightObservations): PreflightItem {
  return observations.liveSubmitKeyPresent
    ? {
        id: "live-submit",
        label: "E2E_LIVE_SUBMIT",
        status: "failed",
        action:
          "셸 환경이나 .env에 E2E_LIVE_SUBMIT이 남아 있다. 기본 e2e가 확인 없이 실제 제출할 수 있으니 지우고 실행해라."
      }
    : {
        id: "live-submit",
        label: "E2E_LIVE_SUBMIT",
        status: "ready",
        action: "설정돼 있지 않다. 기본 e2e가 실제 제출을 하지 않는다."
      };
}

function chromiumItem(observations: PreflightObservations): PreflightItem {
  return observations.playwrightChromiumInstalled
    ? {
        id: "chromium",
        label: "Playwright Chromium",
        status: "ready",
        action: "번들 Chromium이 설치돼 있다."
      }
    : {
        id: "chromium",
        label: "Playwright Chromium",
        status: "missing",
        action: "npx playwright install chromium 후 다시 실행해라. 기본 E2E와 풀사이클이 이것으로 확장을 로드한다."
      };
}

function githubItem(observations: PreflightObservations): PreflightItem {
  if (!observations.githubConfigured) {
    const action =
      observations.githubTokenPresent && observations.githubRepositoryPresent
        ? "E2E_GITHUB_REPOSITORY는 owner/name 형식으로 설정해라."
        : "E2E_GITHUB_TOKEN과 E2E_GITHUB_REPOSITORY를 모두 설정해라.";

    return {
      id: "github",
      label: "GitHub write",
      status: "missing",
      action
    };
  }

  if (observations.githubProbe?.kind === "ok") {
    return {
      id: "github",
      label: "GitHub write",
      status: "ready",
      action: "Verification Repository를 읽을 수 있다. 쓰기 권한은 실제 GitHub write 계층에서 확인한다."
    };
  }

  const detail =
    observations.githubProbe?.kind === "failed"
      ? `HTTP ${observations.githubProbe.status}`
      : "네트워크 오류";

  return {
    id: "github",
    label: "GitHub write",
    status: "failed",
    action: `Verification Repository 확인 실패(${detail})다. token, repository 이름, 접근 권한을 확인해라.`
  };
}

function sweaItem(observations: PreflightObservations): PreflightItem {
  if (observations.sweaIdPresent && observations.sweaPasswordPresent) {
    return {
      id: "swea",
      label: "SWEA 자동 로그인",
      status: "ready",
      action: "E2E_SWEA_ID와 E2E_SWEA_PASSWORD를 확인했다."
    };
  }

  return {
    id: "swea",
    label: "SWEA 자동 로그인",
    status: "missing",
    action: "E2E_SWEA_ID와 E2E_SWEA_PASSWORD가 없거나 한쪽만 있다. 기존처럼 수동 로그인을 기다린다."
  };
}

function profileItem(observations: PreflightObservations): PreflightItem {
  if (observations.verificationProfileExists) {
    return {
      id: "profile",
      label: "Verification Profile",
      status: "ready",
      action: ".verification-profile/이 있다. 쿠키 유효성은 실제 page에서 확인한다."
    };
  }

  return {
    id: "profile",
    label: "Verification Profile",
    status: "missing",
    action: ".verification-profile/이 없다. 기존처럼 브라우저에서 수동 로그인을 기다린다."
  };
}

export function formatPreflight(mode: PreflightMode, items: readonly PreflightItem[]): string {
  const statusLabel: Record<PreflightStatus, string> = {
    ready: "준비됨",
    missing: "누락",
    failed: "확인 실패"
  };
  const modeLabel: Record<PreflightMode, string> = {
    default: "기본 E2E",
    check: "환경 점검",
    login: "로그인",
    "capture-swea": "SWEA 캡처",
    contract: "Contract Check",
    "live-submit": "풀사이클"
  };

  return [
    `[preflight] ${modeLabel[mode]} 사전 점검`,
    ...items.map(
      (item) => `[preflight] ${item.label}: ${statusLabel[item.status]} — ${item.action}`
    )
  ].join("\n");
}

async function probeGitHubRepository(
  config: NonNullable<ReturnType<typeof readVerificationRepositoryConfig>>,
  fetcher: PreflightFetch
): Promise<GitHubProbe> {
  try {
    const response = await fetcher(
      `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.name)}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${config.token}`,
          "x-github-api-version": "2022-11-28"
        },
        signal: AbortSignal.timeout(5_000)
      }
    );

    return assessGitHubProbe(response.status);
  } catch {
    return { kind: "network-error" };
  }
}

export async function collectPreflightObservations(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: PreflightFetch = fetch
): Promise<PreflightObservations> {
  const githubTokenPresent = isPresent(env.E2E_GITHUB_TOKEN);
  const githubRepositoryPresent = isPresent(env.E2E_GITHUB_REPOSITORY);
  const githubConfig = readVerificationRepositoryConfig(env);

  return {
    distManifestExists: existsSync(resolve(repoRoot, "dist/manifest.json")),
    envFileExists: existsSync(resolve(repoRoot, ".env")),
    liveSubmitKeyPresent: env.E2E_LIVE_SUBMIT !== undefined,
    playwrightChromiumInstalled: existsSync(chromium.executablePath()),
    verificationProfileExists: existsSync(resolve(repoRoot, ".verification-profile")),
    githubTokenPresent,
    githubRepositoryPresent,
    githubConfigured: githubConfig !== null,
    githubProbe:
      githubConfig === null ? null : await probeGitHubRepository(githubConfig, fetcher),
    sweaIdPresent: isPresent(env.E2E_SWEA_ID),
    sweaPasswordPresent: isPresent(env.E2E_SWEA_PASSWORD)
  };
}
