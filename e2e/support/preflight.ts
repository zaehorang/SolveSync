/** E2E 실행 전에 필요한 준비물을 점검한다.
 *
 * 환경 변수의 값은 어떤 경로에서도 출력하지 않는다. 사전 점검은 키의 존재와
 * GitHub 응답 상태만 다룬다.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readVerificationRepositoryConfig } from "./verificationRepository";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export type PreflightMode =
  | "default"
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
  readonly verificationProfileExists: boolean;
  readonly githubTokenPresent: boolean;
  readonly githubRepositoryPresent: boolean;
  readonly githubConfigured: boolean;
  readonly githubProbe: GitHubProbe | null;
  readonly sweaIdPresent: boolean;
  readonly sweaPasswordPresent: boolean;
}

export interface PreflightItem {
  readonly id: "dist" | "github" | "swea" | "profile";
  readonly label: string;
  readonly status: PreflightStatus;
  readonly action: string;
}

function isPresent(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

export function detectPreflightMode(env: NodeJS.ProcessEnv): PreflightMode {
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

  if (mode === "default" || mode === "live-submit") {
    items.push(githubItem(observations));
  }

  if (mode === "capture-swea" || mode === "contract" || mode === "live-submit") {
    items.push(sweaItem(observations));
  }

  if (mode === "login" || mode === "contract" || mode === "live-submit") {
    items.push(profileItem(observations));
  }

  return items;
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
