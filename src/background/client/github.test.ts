import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GitHubClient,
  buildGitHubCommitMessage,
  type GitHubFetch
} from "./github";
import type { GitTreeFile } from "../../shared/githubTree";

const PAT = "test-pat-placeholder";

describe("GitHub background client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads repositories across GitHub pagination", async () => {
    const fetchImpl = mockFetch(
      jsonResponse(
        [repoResponse("octo/alpha", "main")],
        200,
        {
          Link:
            '<https://api.github.com/user/repos?per_page=100&page=2>; rel="next"'
        }
      ),
      jsonResponse([repoResponse("octo/beta", "trunk")])
    );
    const client = makeClient(fetchImpl);

    const repositories = await client.listRepositories();

    expect(repositories.map((repository) => repository.fullName)).toEqual([
      "octo/alpha",
      "octo/beta"
    ]);
    expect(requestUrls(fetchImpl)).toEqual([
      "https://api.github.com/user/repos?affiliation=owner&sort=full_name&direction=asc&per_page=100&page=1",
      "https://api.github.com/user/repos?affiliation=owner&sort=full_name&direction=asc&per_page=100&page=2"
    ]);
  });

  it("uses the default fetch wrapper with the global fetch receiver", async () => {
    const fetchImpl = vi.fn(function (
      this: typeof globalThis,
      input: RequestInfo | URL
    ) {
      expect(this).toBe(globalThis);
      expect(String(input)).toBe(
        "https://api.github.test/user/repos?affiliation=owner&sort=full_name&direction=asc&per_page=100&page=1"
      );

      return Promise.resolve(jsonResponse([]));
    }) as unknown as GitHubFetch;
    vi.stubGlobal("fetch", fetchImpl);

    const client = new GitHubClient({
      pat: PAT,
      apiBaseUrl: "https://api.github.test"
    });

    await expect(client.listRepositories()).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("creates a branch from the repository default branch HEAD", async () => {
    const fetchImpl = mockFetch(
      jsonResponse(repoResponse("octo/algorithms", "main")),
      jsonResponse(refResponse("refs/heads/main", "default-sha")),
      jsonResponse(refResponse("refs/heads/leetcode-sync-test", "default-sha"), 201)
    );
    const client = makeClient(fetchImpl);

    const branch = await client.createBranch({
      owner: "octo",
      name: "algorithms",
      branchName: "leetcode-sync-test"
    });

    expect(branch).toMatchObject({
      name: "leetcode-sync-test",
      sha: "default-sha"
    });
    expect(requestMethods(fetchImpl)).toEqual(["GET", "GET", "POST"]);
    expect(requestBody(fetchImpl, 2)).toEqual({
      ref: "refs/heads/leetcode-sync-test",
      sha: "default-sha"
    });
  });

  it("runs connection test with read-only Git data requests", async () => {
    const fetchImpl = mockFetch(
      jsonResponse(repoResponse("octo/algorithms", "main")),
      jsonResponse(refResponse("refs/heads/main", "base-sha")),
      jsonResponse(commitResponse("base-sha", "base-tree-sha")),
      jsonResponse(treeResponse("base-tree-sha"))
    );
    const client = makeClient(fetchImpl);

    const result = await client.testConnection({
      owner: "octo",
      name: "algorithms",
      branchName: "main"
    });

    expect(result).toMatchObject({
      baseCommitSha: "base-sha",
      baseTreeSha: "base-tree-sha"
    });
    expect(requestMethods(fetchImpl)).toEqual(["GET", "GET", "GET", "GET"]);
  });

  it("uses Git Data API request order for a single commit", async () => {
    const fetchImpl = mockFetch(
      jsonResponse(refResponse("refs/heads/main", "base-sha")),
      jsonResponse(commitResponse("base-sha", "base-tree-sha")),
      jsonResponse(treeResponse("base-tree-sha")),
      jsonResponse({ sha: "solution-blob-sha" }, 201),
      jsonResponse({ sha: "readme-blob-sha" }, 201),
      jsonResponse({ sha: "index-blob-sha" }, 201),
      jsonResponse({ sha: "new-tree-sha" }, 201),
      jsonResponse(commitResponse("new-commit-sha", "new-tree-sha"), 201),
      jsonResponse(refResponse("refs/heads/main", "new-commit-sha"))
    );
    const client = makeClient(fetchImpl);

    const result = await client.commitFiles({
      owner: "octo",
      name: "algorithms",
      branchName: "main",
      message: "solve: leetcode 0001 two sum in swift",
      files: makeTreeFiles()
    });

    expect(result.commitSha).toBe("new-commit-sha");
    expect(requestMethods(fetchImpl)).toEqual([
      "GET",
      "GET",
      "GET",
      "POST",
      "POST",
      "POST",
      "POST",
      "POST",
      "PATCH"
    ]);
    expect(requestPaths(fetchImpl)).toEqual([
      "/repos/octo/algorithms/git/ref/heads/main",
      "/repos/octo/algorithms/git/commits/base-sha",
      "/repos/octo/algorithms/git/trees/base-tree-sha?recursive=1",
      "/repos/octo/algorithms/git/blobs",
      "/repos/octo/algorithms/git/blobs",
      "/repos/octo/algorithms/git/blobs",
      "/repos/octo/algorithms/git/trees",
      "/repos/octo/algorithms/git/commits",
      "/repos/octo/algorithms/git/refs/heads/main"
    ]);
    expect(requestBody(fetchImpl, 6)).toEqual({
      base_tree: "base-tree-sha",
      tree: [
        {
          path: "leetcode/swift/0001_two_sum.swift",
          mode: "100644",
          type: "blob",
          sha: "solution-blob-sha"
        },
        {
          path: "leetcode/README.md",
          mode: "100644",
          type: "blob",
          sha: "readme-blob-sha"
        },
        {
          path: "leetcode/.leetcode-sync/index.json",
          mode: "100644",
          type: "blob",
          sha: "index-blob-sha"
        }
      ]
    });
    expect(requestBody(fetchImpl, 7)).toEqual({
      message: "solve: leetcode 0001 two sum in swift",
      tree: "new-tree-sha",
      parents: ["base-sha"]
    });
  });

  it("retries a ref update conflict at most once with refreshed branch state", async () => {
    const onConflict = vi.fn(() => [
      {
        path: "leetcode/README.md",
        content: "# updated\n"
      }
    ]);
    const fetchImpl = mockFetch(
      jsonResponse(refResponse("refs/heads/main", "base-sha")),
      jsonResponse(commitResponse("base-sha", "base-tree-sha")),
      jsonResponse(treeResponse("base-tree-sha")),
      jsonResponse({ sha: "first-blob-sha" }, 201),
      jsonResponse({ sha: "first-tree-sha" }, 201),
      jsonResponse(commitResponse("first-commit-sha", "first-tree-sha"), 201),
      jsonResponse({ message: "Reference update failed" }, 409),
      jsonResponse(refResponse("refs/heads/main", "latest-sha")),
      jsonResponse(commitResponse("latest-sha", "latest-tree-sha")),
      jsonResponse(treeResponse("latest-tree-sha")),
      jsonResponse({ sha: "retry-blob-sha" }, 201),
      jsonResponse({ sha: "retry-tree-sha" }, 201),
      jsonResponse(commitResponse("retry-commit-sha", "retry-tree-sha"), 201),
      jsonResponse({ message: "Reference update failed again" }, 409)
    );
    const client = makeClient(fetchImpl);

    await expect(
      client.commitFiles({
        owner: "octo",
        name: "algorithms",
        branchName: "main",
        message: "solve: leetcode 0001 two sum in swift",
        files: [
          {
            path: "leetcode/README.md",
            content: "# old\n"
          }
        ],
        onConflict
      })
    ).rejects.toMatchObject({
      code: "github_conflict_failed"
    });

    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(
      requestMethods(fetchImpl).filter((method) => method === "PATCH")
    ).toHaveLength(2);
  });

  it("normalizes branch protected, rate limited, and auth failures", async () => {
    await expectProtectedBranchFailure();
    await expectRateLimitedFailure();
    await expectAuthFailure();
  });

  it("keeps the HTTP status in debug details when GitHub returns an empty error body", async () => {
    const fetchImpl = mockFetch(new Response("", { status: 500 }));
    const client = makeClient(fetchImpl);

    await expect(client.listRepositories()).rejects.toMatchObject({
      code: "github_commit_failed",
      debugMessage:
        "GET /user/repos?affiliation=owner&sort=full_name&direction=asc&per_page=100&page=1: GitHub request failed with status 500."
    });
  });

  it("builds the required solve commit message", () => {
    expect(
      buildGitHubCommitMessage({
        frontendId: "1",
        title: "Two Sum",
        language: "swift",
        solutionRevisionNumber: 1
      })
    ).toBe("solve: leetcode 0001 two sum in swift #1");

    expect(
      buildGitHubCommitMessage({
        codingPlatform: "programmers",
        frontendId: "120804",
        title: "두 수의 곱 구하기",
        language: "swift",
        solutionRevisionNumber: 3
      })
    ).toBe("solve: programmers 120804 두 수의 곱 구하기 in swift #3");
  });

  it("rejects invalid Solution Revision Numbers in solve commit messages", () => {
    for (const solutionRevisionNumber of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        buildGitHubCommitMessage({
          frontendId: "1",
          title: "Two Sum",
          language: "swift",
          solutionRevisionNumber
        })
      ).toThrow("Solution Revision Number must be a positive integer.");
    }
  });
});

async function expectProtectedBranchFailure(): Promise<void> {
  const fetchImpl = mockFetch(
    jsonResponse(refResponse("refs/heads/main", "base-sha")),
    jsonResponse(commitResponse("base-sha", "base-tree-sha")),
    jsonResponse(treeResponse("base-tree-sha")),
    jsonResponse({ sha: "blob-sha" }, 201),
    jsonResponse({ sha: "tree-sha" }, 201),
    jsonResponse(commitResponse("commit-sha", "tree-sha"), 201),
    jsonResponse({ message: "Protected branch update failed" }, 403)
  );
  const client = makeClient(fetchImpl);

  await expect(
    client.commitFiles({
      owner: "octo",
      name: "algorithms",
      branchName: "main",
      message: "solve: leetcode 0001 two sum in swift",
      files: [
        {
          path: "leetcode/README.md",
          content: "# README\n"
        }
      ]
    })
  ).rejects.toMatchObject({
    code: "github_branch_protected",
    retryable: false
  });
}

async function expectRateLimitedFailure(): Promise<void> {
  const fetchImpl = mockFetch(
    jsonResponse(
      {
        message: "API rate limit exceeded"
      },
      403,
      {
        "X-RateLimit-Remaining": "0"
      }
    )
  );
  const client = makeClient(fetchImpl);

  await expect(client.listRepositories()).rejects.toMatchObject({
    code: "github_rate_limited",
    retryable: true
  });
}

async function expectAuthFailure(): Promise<void> {
  const fetchImpl = mockFetch(jsonResponse({ message: "Bad credentials" }, 401));
  const client = makeClient(fetchImpl);

  await expect(
    client.listBranches({
      owner: "octo",
      name: "algorithms"
    })
  ).rejects.toMatchObject({
    code: "github_auth_failed",
    retryable: false
  });
}

function makeClient(fetchImpl: GitHubFetch): GitHubClient {
  return new GitHubClient({
    pat: PAT,
    fetchImpl
  });
}

function makeTreeFiles(): GitTreeFile[] {
  return [
    {
      path: "leetcode/swift/0001_two_sum.swift",
      content: "class Solution {}"
    },
    {
      path: "leetcode/README.md",
      content: "# README\n"
    },
    {
      path: "leetcode/.leetcode-sync/index.json",
      content: "{}\n"
    }
  ];
}

function mockFetch(...responses: Response[]): GitHubFetch {
  const fetchImpl = vi.fn(async () => {
    const response = responses.shift();

    if (response === undefined) {
      throw new Error("Unexpected fetch call.");
    }

    return response;
  });

  return fetchImpl as unknown as GitHubFetch;
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

function repoResponse(fullName: string, defaultBranch: string): unknown {
  const [owner, name] = fullName.split("/");

  return {
    owner: {
      login: owner
    },
    name,
    full_name: fullName,
    default_branch: defaultBranch,
    private: true,
    html_url: `https://github.com/${fullName}`
  };
}

function refResponse(ref: string, sha: string): unknown {
  return {
    ref,
    object: {
      sha,
      type: "commit"
    }
  };
}

function commitResponse(sha: string, treeSha: string): unknown {
  return {
    sha,
    html_url: `https://github.com/octo/algorithms/commit/${sha}`,
    tree: {
      sha: treeSha
    }
  };
}

function treeResponse(sha: string): unknown {
  return {
    sha,
    tree: []
  };
}

function requestUrls(fetchImpl: GitHubFetch): string[] {
  return fetchCalls(fetchImpl).map(([url]) => String(url));
}

function requestPaths(fetchImpl: GitHubFetch): string[] {
  return requestUrls(fetchImpl).map((url) => {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  });
}

function requestMethods(fetchImpl: GitHubFetch): string[] {
  return fetchCalls(fetchImpl).map(([, init]) => init?.method ?? "GET");
}

function requestBody(fetchImpl: GitHubFetch, callIndex: number): unknown {
  const init = fetchCalls(fetchImpl)[callIndex]?.[1];

  if (typeof init?.body !== "string") {
    return null;
  }

  return JSON.parse(init.body) as unknown;
}

function fetchCalls(fetchImpl: GitHubFetch): Array<[RequestInfo | URL, RequestInit | undefined]> {
  return vi.mocked(fetchImpl).mock.calls as Array<
    [RequestInfo | URL, RequestInit | undefined]
  >;
}
