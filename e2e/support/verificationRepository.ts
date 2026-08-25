/** Verification Repository를 상대하는 하네스 쪽 GitHub 호출.
 *
 * 제품 코드가 아니라 하네스가 쓰는 경로다. 제품이 만든 commit을 **밖에서**
 * 확인해야 검증이 성립하므로 같은 client를 재사용하지 않는다.
 *
 * 대상은 전용 Verification Repository다. 사용자 Sync Repository를 쓰지 않는다.
 * 실행마다 고유 branch를 만들고 끝나면 지워 동시 PR이 서로를 밟지 않는다.
 * 제품이 branch를 만드는 것이 아니므로 자동 생성 금지 규칙은 그대로다.
 */
import { randomUUID } from "node:crypto";

import type { SyncBranch, SyncRepository } from "../../src/shared/types";

const API_ROOT = "https://api.github.com";

/** 하네스가 만드는 branch의 접두사. 이 접두사가 아니면 지우지 않는다. */
const RUN_BRANCH_PREFIX = "e2e/";

export interface VerificationRepositoryConfig {
  readonly token: string;
  readonly owner: string;
  readonly name: string;
}

/** 환경 변수가 없으면 `null`. 그때 GitHub write 계층은 통째로 건너뛴다.
 *
 * 기본값을 두지 않는다. 실수로 실사용 저장소를 대상으로 삼을 경로 자체를
 * 없애는 것이 이 계층의 전제다. */
export function readVerificationRepositoryConfig(): VerificationRepositoryConfig | null {
  const token = process.env.E2E_GITHUB_TOKEN?.trim() ?? "";
  const repository = process.env.E2E_GITHUB_REPOSITORY?.trim() ?? "";
  const [owner, name] = repository.split("/");

  if (token.length === 0 || owner === undefined || name === undefined) {
    return null;
  }

  if (owner.length === 0 || name.length === 0) {
    return null;
  }

  return { token, owner, name };
}

async function callGitHub(
  config: VerificationRepositoryConfig,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers
    }
  });
}

/** 실패 본문에 token이 섞일 일은 없지만, 던지는 쪽에서 경로와 상태만 남긴다. */
async function requireOk(response: Response, what: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`${what} 실패: HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchSyncRepository(
  config: VerificationRepositoryConfig
): Promise<SyncRepository> {
  const body = (await requireOk(
    await callGitHub(config, `/repos/${config.owner}/${config.name}`),
    "Verification Repository 조회"
  )) as {
    owner: { login: string };
    name: string;
    full_name: string;
    default_branch: string;
    private: boolean;
    html_url: string;
  };

  return {
    owner: body.owner.login,
    name: body.name,
    fullName: body.full_name,
    defaultBranch: body.default_branch,
    private: body.private,
    htmlUrl: body.html_url
  };
}

/** 실행마다 고유 branch를 default branch 끝에서 딴다. */
export async function createRunBranch(
  config: VerificationRepositoryConfig,
  repository: SyncRepository
): Promise<SyncBranch> {
  const head = (await requireOk(
    await callGitHub(
      config,
      `/repos/${config.owner}/${config.name}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`
    ),
    "default branch ref 조회"
  )) as { object: { sha: string } };

  const name = `${RUN_BRANCH_PREFIX}${randomUUID()}`;

  await requireOk(
    await callGitHub(config, `/repos/${config.owner}/${config.name}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: head.object.sha })
    }),
    "실행 branch 생성"
  );

  return { name, sha: head.object.sha, protected: false };
}

/** 하네스가 만든 branch만 지운다.
 *
 * 접두사 검사는 형식이 아니라 안전장치다. 여기에 default branch 이름이
 * 흘러 들어오는 경로가 생기면 저장소가 통째로 날아간다. */
export async function deleteRunBranch(
  config: VerificationRepositoryConfig,
  branchName: string
): Promise<void> {
  if (!branchName.startsWith(RUN_BRANCH_PREFIX)) {
    throw new Error(
      `하네스가 만들지 않은 branch는 지우지 않는다: ${branchName}`
    );
  }

  const response = await callGitHub(
    config,
    `/repos/${config.owner}/${config.name}/git/refs/heads/${encodeURIComponent(branchName)}`,
    { method: "DELETE" }
  );

  // 이미 없으면 그것으로 목적은 달성됐다.
  if (!response.ok && response.status !== 404 && response.status !== 422) {
    throw new Error(`실행 branch 삭제 실패: HTTP ${response.status}`);
  }
}

/** 파일 내용을 읽는다. 없으면 `null`. */
export async function readFileAtRef(
  config: VerificationRepositoryConfig,
  path: string,
  ref: string
): Promise<string | null> {
  const response = await callGitHub(
    config,
    `/repos/${config.owner}/${config.name}/contents/${path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}?ref=${encodeURIComponent(ref)}`
  );

  if (response.status === 404) {
    return null;
  }

  const body = (await requireOk(response, `파일 조회 (${path})`)) as {
    content?: string;
    encoding?: string;
  };

  if (typeof body.content !== "string" || body.encoding !== "base64") {
    throw new Error(`파일 내용을 읽을 수 없다: ${path}`);
  }

  return Buffer.from(body.content, "base64").toString("utf8");
}

export interface CommitSummary {
  readonly sha: string;
  readonly message: string;
  readonly changedPaths: string[];
}

export async function fetchCommit(
  config: VerificationRepositoryConfig,
  sha: string
): Promise<CommitSummary> {
  const body = (await requireOk(
    await callGitHub(
      config,
      `/repos/${config.owner}/${config.name}/commits/${encodeURIComponent(sha)}`
    ),
    "commit 조회"
  )) as {
    sha: string;
    commit: { message: string };
    files?: { filename: string }[];
  };

  return {
    sha: body.sha,
    message: body.commit.message,
    changedPaths: (body.files ?? []).map((file) => file.filename)
  };
}

/** 실행이 강제로 끊겨 남은 branch를 치운다.
 *
 * 정리는 `finally`에 있지만 test timeout이나 프로세스 강제 종료는 그것을
 * 건너뛴다(2026-08-26 실측: 그렇게 4개가 남아 있었다). 그래서 시작할 때 한 번
 * 쓸어낸다.
 *
 * **나이 제한을 둔다.** 지금 도는 다른 실행의 branch를 지우면 그 실행이
 * 조용히 깨진다. 로컬과 CI가 같은 저장소를 쓰므로 실제로 겹칠 수 있다. */
export async function sweepStaleRunBranches(
  config: VerificationRepositoryConfig,
  olderThanMs = 2 * 60 * 60 * 1000
): Promise<string[]> {
  const branches = (await requireOk(
    await callGitHub(config, `/repos/${config.owner}/${config.name}/branches?per_page=100`),
    "branch 목록 조회"
  )) as { name: string; commit: { sha: string } }[];

  const swept: string[] = [];
  const deadline = Date.now() - olderThanMs;

  for (const branch of branches) {
    if (!branch.name.startsWith(RUN_BRANCH_PREFIX)) {
      continue;
    }

    const commit = (await requireOk(
      await callGitHub(
        config,
        `/repos/${config.owner}/${config.name}/commits/${branch.commit.sha}`
      ),
      "commit 시각 조회"
    )) as { commit: { committer: { date: string } } };

    if (Date.parse(commit.commit.committer.date) > deadline) {
      continue;
    }

    await deleteRunBranch(config, branch.name);
    swept.push(branch.name);
  }

  return swept;
}
