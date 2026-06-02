import { describe, expect, it, vi } from "vitest";

import { normalizeError } from "../shared/errorNormalize";
import { createExtensionStorage, type StorageAreaAdapter } from "./storage";
import type {
  SyncBranch,
  ProblemMetadata,
  SyncRepository,
  RetryBundle,
  SyncDeduplicationKey
} from "../shared/types";
import type { LatestAcceptedSubmissionResult } from "./client/leetcode";
import type {
  CommitGitDataInput,
  CommitGitDataResult,
  ReadTextFileInput
} from "./client/github";
import {
  createSyncOrchestrator,
  type GitHubClientFactory,
  type SyncGitHubClient,
  type SyncLeetCodeClient
} from "./sync";

const expectedAcceptedDate = "2026-01-02";
const defaultAcceptedAt = makeLocalAcceptedAt(expectedAcceptedDate);

describe("background sync orchestrator", () => {
  it("records setup required without fetching LeetCode or committing", async () => {
    const harness = makeHarness();

    const outcome = await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(outcome.kind).toBe("recorded");
    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(0);
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["setup_required"]);
  });

  it("records Auto Sync off without fetching LeetCode or committing", async () => {
    const harness = makeHarness();
    await harness.saveSettings({ autoSyncEnabled: false });

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.leetcode.fetchLatestAcceptedSubmission).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(0);
    await expect(historyStatuses(harness.storage)).resolves.toEqual([
      "auto_sync_disabled"
    ]);
  });

  it("records unsupported languages without committing", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      unsupportedAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(0);
    const records = await harness.storage.listHistory();
    expect(records[0]).toMatchObject({
      status: "unsupported_language",
      language: "Java",
      supportedLanguage: null,
      problemTitle: "Two Sum"
    });
  });

  it("skips already processed identities without a duplicate commit", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.markProcessed(
      identity,
      {
        commitSha: "existing-commit",
        solutionPath: "leetcode/swift/0001_two_sum.swift"
      },
      "2026-01-01T00:00:00.000Z"
    );
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    const outcome = await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_processed",
      syncDeduplicationKey: identity
    });
    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listHistory()).resolves.toHaveLength(0);
  });

  it("skips identities that already have an in-flight lock", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.acquireInFlightLock(identity, "2026-01-01T00:00:00.000Z");
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    const outcome = await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_in_flight",
      syncDeduplicationKey: identity
    });
    expect(harness.github.commits).toHaveLength(0);
  });

  it("commits solution, marks processed, and appends success history", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("leetcode/README.md", "# Existing\n");
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(1);
    expect(await harness.storage.isProcessed(identity)).toBe(true);
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["synced"]);
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "leetcode/swift/0001_two_sum.swift",
      "leetcode/README.md",
      "leetcode/.leetcode-sync/index.json"
    ]);
    expect(
      harness.github.commits[0]?.files.find((file) => file.path === "leetcode/README.md")?.content
    ).toContain("# Existing");
    expect(committedContent(harness, "leetcode/README.md")).toContain(
      `| 1 | Two Sum | Easy | ${expectedAcceptedDate} |`
    );
    expect(committedJson(harness, "leetcode/.leetcode-sync/index.json")).toMatchObject({
      version: 2,
      activity: {
        days: {
          [expectedAcceptedDate]: {
            acceptedCount: 1,
            newProblemCount: 1
          }
        }
      },
      problems: [
        {
          firstAcceptedDate: expectedAcceptedDate,
          lastAcceptedDate: expectedAcceptedDate,
          languages: {
            swift: {
              lastAcceptedSourceId: identity.acceptedSourceId,
              firstAcceptedDate: expectedAcceptedDate,
              lastAcceptedDate: expectedAcceptedDate
            }
          }
        }
      ]
    });
  });

  it("commits Programmers snapshots with platform README and index files", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("programmers/README.md", "# Programmers\n");

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(1);
    expect(await harness.storage.isProcessed(programmersIdentity)).toBe(true);
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: programmers 120804 두 수의 곱 구하기 in swift"
    });
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "programmers/swift/120804_두_수의_곱_구하기.swift",
      "programmers/README.md",
      "programmers/.programmers-sync/index.json"
    ]);
    expect(
      harness.github.commits[0]?.files.find((file) => file.path === "programmers/README.md")
        ?.content
    ).toContain("<!-- PROGRAMMERS_TABLE_START -->");
    expect(committedContent(harness, "programmers/README.md")).toContain(
      `| 120804 | 두 수의 곱 구하기 | - | ${expectedAcceptedDate} |`
    );
    expect(committedJson(harness, "programmers/.programmers-sync/index.json")).toMatchObject({
      version: 2,
      activity: {
        days: {
          [expectedAcceptedDate]: {
            acceptedCount: 1,
            newProblemCount: 1
          }
        }
      },
      problems: [
        {
          firstAcceptedDate: expectedAcceptedDate,
          lastAcceptedDate: expectedAcceptedDate,
          languages: {
            swift: {
              lastAcceptedSourceId: programmersIdentity.acceptedSourceId,
              firstAcceptedDate: expectedAcceptedDate,
              lastAcceptedDate: expectedAcceptedDate
            }
          }
        }
      ]
    });
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["synced"]);
  });

  it("skips already processed Programmers identities without a duplicate commit", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());
    const outcome = await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_processed",
      syncDeduplicationKey: programmersIdentity
    });
    expect(harness.github.commits).toHaveLength(1);
  });

  it("skips Programmers identities that already have an in-flight lock", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.acquireInFlightLock(
      programmersIdentity,
      "2026-01-01T00:00:00.000Z"
    );

    const outcome = await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(outcome).toEqual({
      kind: "duplicate_in_flight",
      syncDeduplicationKey: programmersIdentity
    });
    expect(harness.github.commits).toHaveLength(0);
  });

  it("records unsupported Programmers languages without committing", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(
      makeProgrammersAcceptedDetected({
        language: "JavaScript"
      })
    );

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryPayloads()).resolves.toHaveLength(0);
    const records = await harness.storage.listHistory();
    expect(records[0]).toMatchObject({
      codingPlatform: "programmers",
      status: "unsupported_language",
      language: "JavaScript",
      supportedLanguage: null,
      problemTitle: "두 수의 곱 구하기"
    });
  });

  it("records Programmers extract failures without retry payloads", async () => {
    const harness = makeHarness();
    await harness.saveSettings();

    await harness.sync.handleAcceptedDetected(
      makeProgrammersAcceptedDetected({
        code: ""
      })
    );

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryPayloads()).resolves.toHaveLength(0);
    const records = await harness.storage.listHistory();
    expect(records[0]).toMatchObject({
      codingPlatform: "programmers",
      status: "failed",
      retryPayloadId: null,
      error: {
        code: "programmers_extract_failed"
      }
    });
  });

  it("does not store retry payloads when Programmers index cannot be parsed", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("programmers/.programmers-sync/index.json", "{not-json");

    await harness.sync.handleAcceptedDetected(makeProgrammersAcceptedDetected());

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryPayloads()).resolves.toHaveLength(0);
    const records = await harness.storage.listHistory();
    expect(records[0]).toMatchObject({
      codingPlatform: "programmers",
      status: "failed",
      retryPayloadId: null,
      error: {
        code: "malformed_index"
      }
    });
  });

  it("stores retry payloads for GitHub commit failures without marking processed", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.commitError = normalizeError({
      code: "github_commit_failed",
      message: "commit failed"
    });
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(await harness.storage.isProcessed(identity)).toBe(false);
    const payloads = await harness.storage.listRetryPayloads();
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      syncDeduplicationKey: identity,
      solutionPath: "leetcode/swift/0001_two_sum.swift",
      attempts: 0
    });
    const records = await harness.storage.listHistory();
    expect(records[0]).toMatchObject({
      status: "failed",
      retryPayloadId: payloads[0]?.id
    });
  });

  it("does not store retry payloads when commit files cannot be prepared", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    harness.github.files.set("leetcode/.leetcode-sync/index.json", "{not-json");
    harness.leetcode.fetchProblemMetadata.mockResolvedValue(problem);
    harness.leetcode.fetchLatestAcceptedSubmission.mockResolvedValue(
      syncableAcceptedSubmission()
    );

    await harness.sync.handleAcceptedDetected(makeAcceptedDetected());

    expect(harness.github.commits).toHaveLength(0);
    await expect(harness.storage.listRetryPayloads()).resolves.toHaveLength(0);
    const records = await harness.storage.listHistory();
    expect(records[0]).toMatchObject({
      status: "failed",
      retryPayloadId: null,
      error: {
        code: "malformed_index"
      }
    });
  });

  it("retries a saved payload, deletes it, and marks processed on success", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.saveRetryPayload(makeRetryPayload("retry-1"));

    await harness.sync.handleRetry("retry-1");

    expect(harness.leetcode.fetchProblemMetadata).not.toHaveBeenCalled();
    expect(harness.github.commits).toHaveLength(1);
    expect(await harness.storage.isProcessed(identity)).toBe(true);
    await expect(harness.storage.getRetryPayload("retry-1")).resolves.toBeNull();
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["synced"]);
  });

  it("retries a saved Programmers payload with the platform commit files", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.saveRetryPayload(makeProgrammersRetryPayload("retry-programmers"));

    await harness.sync.handleRetry("retry-programmers");

    expect(harness.github.commits).toHaveLength(1);
    expect(await harness.storage.isProcessed(programmersIdentity)).toBe(true);
    await expect(harness.storage.getRetryPayload("retry-programmers")).resolves.toBeNull();
    expect(harness.github.commits[0]).toMatchObject({
      message: "solve: programmers 120804 두 수의 곱 구하기 in swift"
    });
    expect(harness.github.commits[0]?.files.map((file) => file.path)).toEqual([
      "programmers/swift/120804_두_수의_곱_구하기.swift",
      "programmers/README.md",
      "programmers/.programmers-sync/index.json"
    ]);
  });

  it("keeps retry payloads and updates failure detail when retry fails", async () => {
    const harness = makeHarness();
    await harness.saveSettings();
    await harness.storage.saveRetryPayload(makeRetryPayload("retry-1"));
    harness.github.commitError = normalizeError({
      code: "github_commit_failed",
      message: "retry failed"
    });

    await harness.sync.handleRetry("retry-1");

    const payload = await harness.storage.getRetryPayload("retry-1");
    expect(payload).toMatchObject({
      attempts: 1,
      lastError: {
        code: "github_commit_failed"
      }
    });
    expect(await harness.storage.isProcessed(identity)).toBe(false);
    await expect(historyStatuses(harness.storage)).resolves.toEqual(["failed"]);
  });
});

interface Harness {
  storage: ReturnType<typeof createExtensionStorage>;
  leetcode: SyncLeetCodeClient & {
    fetchProblemMetadata: ReturnType<typeof vi.fn>;
    fetchLatestAcceptedSubmission: ReturnType<typeof vi.fn>;
  };
  github: FakeGitHubClient;
  sync: ReturnType<typeof createSyncOrchestrator>;
  saveSettings(update?: { autoSyncEnabled?: boolean }): Promise<void>;
}

function makeHarness(): Harness {
  const storage = createExtensionStorage(createMemoryStorageArea());
  const leetcode = {
    fetchProblemMetadata: vi.fn(),
    fetchLatestAcceptedSubmission: vi.fn()
  } as Harness["leetcode"];
  const github = new FakeGitHubClient();
  const githubClientFactory: GitHubClientFactory = () => github;
  let id = 0;
  const sync = createSyncOrchestrator({
    storage,
    leetcode,
    githubClientFactory,
    broadcast: vi.fn(),
    now: () => "2026-01-01T00:00:00.000Z",
    createId: (prefix) => `${prefix}-${id++}`
  });

  return {
    storage,
    leetcode,
    github,
    sync,
    async saveSettings(update = {}) {
      await storage.saveSettings({
        githubPat: "test-pat-placeholder",
        selectedRepository: repository,
        selectedBranch: branch,
        autoSyncEnabled: update.autoSyncEnabled ?? true
      });
    }
  };
}

class FakeGitHubClient implements SyncGitHubClient {
  readonly commits: CommitGitDataInput[] = [];
  readonly files = new Map<string, string>();
  commitError: unknown = null;

  async readTextFile(input: ReadTextFileInput): Promise<string | null> {
    return this.files.get(input.path) ?? null;
  }

  async commitFiles(input: CommitGitDataInput): Promise<CommitGitDataResult> {
    this.commits.push(input);

    if (this.commitError !== null) {
      throw this.commitError;
    }

    return {
      repository,
      branch: {
        ...branch,
        sha: "commit-sha"
      },
      baseCommitSha: "base-sha",
      baseTreeSha: "base-tree-sha",
      commitSha: "commit-sha",
      commitUrl: "https://github.com/octo/algorithms/commit/commit-sha",
      fileUrls: Object.fromEntries(
        input.files.map((file) => [
          file.path,
          `https://github.com/octo/algorithms/blob/main/${file.path}`
        ])
      )
    };
  }
}

function createMemoryStorageArea(seed: Record<string, unknown> = {}): StorageAreaAdapter {
  let data = cloneRecord(seed);

  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys === null || keys === undefined) {
        return cloneRecord(data);
      }

      if (typeof keys === "string") {
        return { [keys]: cloneValue(data[keys]) };
      }

      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, cloneValue(data[key])]));
      }

      return {
        ...cloneRecord(keys),
        ...Object.fromEntries(
          Object.keys(keys)
            .filter((key) => key in data)
            .map((key) => [key, cloneValue(data[key])])
        )
      };
    },
    async set(items: Record<string, unknown>) {
      data = {
        ...data,
        ...cloneRecord(items)
      };
    },
    async remove(keys: string | string[]) {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];

      for (const key of keysToRemove) {
        delete data[key];
      }
    }
  };
}

const repository: SyncRepository = {
  owner: "octo",
  name: "algorithms",
  fullName: "octo/algorithms",
  defaultBranch: "main",
  private: true,
  htmlUrl: "https://github.com/octo/algorithms"
};

const branch: SyncBranch = {
  name: "main",
  sha: "base-sha",
  protected: false
};

const problem: ProblemMetadata = {
  problemId: "1",
  frontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  url: "https://leetcode.com/problems/two-sum/"
};

const identity: SyncDeduplicationKey = {
  codingPlatform: "leetcode",
  acceptedSourceId: "123456789",
  titleSlug: "two-sum",
  language: "swift"
};

const programmersCode = [
  "func solution(_ num1: Int, _ num2: Int) -> Int {",
  "  num1 * num2",
  "}"
].join("\n");

const programmersIdentity: SyncDeduplicationKey = {
  codingPlatform: "programmers",
  acceptedSourceId: `programmers:120804:swift:${buildShortCodeHash(programmersCode)}`,
  titleSlug: "120804_두_수의_곱_구하기",
  language: "swift"
};

function makeAcceptedDetected() {
  return {
    codingPlatform: "leetcode" as const,
    titleSlug: "two-sum",
    pageUrl: "https://leetcode.com/problems/two-sum/",
    detectedAt: "2026-01-01T00:00:00.000Z"
  };
}

function makeProgrammersAcceptedDetected(
  overrides: Partial<{
    courseId: string;
    lessonId: string;
    problemTitle: string;
    language: string;
    code: string;
    pageUrl: string;
    detectedAt: string;
  }> = {}
) {
  return {
    codingPlatform: "programmers" as const,
    courseId: overrides.courseId ?? "30",
    lessonId: overrides.lessonId ?? "120804",
    problemTitle: overrides.problemTitle ?? "두 수의 곱 구하기",
    language: overrides.language ?? "Swift",
    code: overrides.code ?? programmersCode,
    pageUrl:
      overrides.pageUrl ??
      "https://school.programmers.co.kr/learn/courses/30/lessons/120804",
    detectedAt: overrides.detectedAt ?? defaultAcceptedAt
  };
}

function syncableAcceptedSubmission(): LatestAcceptedSubmissionResult {
  return {
    syncable: true,
    supportedLanguage: "swift",
    syncDeduplicationKey: identity,
    submittedAt: "2026-01-01T00:00:00.000Z",
    submission: {
      acceptedSourceId: identity.acceptedSourceId,
      titleSlug: identity.titleSlug,
      language: "Swift",
      code: "class Solution {}",
      acceptedAt: defaultAcceptedAt
    }
  };
}

function unsupportedAcceptedSubmission(): LatestAcceptedSubmissionResult {
  return {
    syncable: false,
    supportedLanguage: null,
    syncDeduplicationKey: null,
    submittedAt: "2026-01-01T00:00:00.000Z",
    submission: {
      acceptedSourceId: "987654321",
      titleSlug: "two-sum",
      language: "Java",
      code: "class Solution {}",
      acceptedAt: defaultAcceptedAt
    }
  };
}

function makeProgrammersRetryPayload(id: string): RetryBundle {
  return {
    id,
    codingPlatform: "programmers",
    syncDeduplicationKey: programmersIdentity,
    repository,
    branch,
    problem: {
      problemId: "120804",
      frontendId: "120804",
      title: "두 수의 곱 구하기",
      titleSlug: programmersIdentity.titleSlug,
      difficulty: "-",
      url: "https://school.programmers.co.kr/learn/courses/30/lessons/120804"
    },
    submission: {
      acceptedSourceId: programmersIdentity.acceptedSourceId,
      titleSlug: programmersIdentity.titleSlug,
      language: "Swift",
      code: programmersCode,
      acceptedAt: "2026-01-01T00:00:00.000Z"
    },
    solutionPath: "programmers/swift/120804_두_수의_곱_구하기.swift",
    solutionReadmePath: "programmers/README.md",
    solutionCatalogPath: "programmers/.programmers-sync/index.json",
    commitMessage: "solve: programmers 120804 두 수의 곱 구하기 in swift",
    attempts: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    lastError: null
  };
}

function makeRetryPayload(id: string): RetryBundle {
  return {
    id,
    codingPlatform: "leetcode",
    syncDeduplicationKey: identity,
    repository,
    branch,
    problem,
    submission: syncableAcceptedSubmission().submission,
    solutionPath: "leetcode/swift/0001_two_sum.swift",
    solutionReadmePath: "leetcode/README.md",
    solutionCatalogPath: "leetcode/.leetcode-sync/index.json",
    commitMessage: "solve: leetcode 0001 two sum in swift",
    attempts: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    lastError: null
  };
}

function buildShortCodeHash(code: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

async function historyStatuses(
  storage: ReturnType<typeof createExtensionStorage>
): Promise<string[]> {
  return (await storage.listHistory()).map((record) => record.status);
}

function committedContent(harness: Harness, path: string): string {
  const file = harness.github.commits[0]?.files.find((entry) => entry.path === path);

  expect(file).toBeDefined();

  return file?.content ?? "";
}

function committedJson(harness: Harness, path: string): unknown {
  return JSON.parse(committedContent(harness, path)) as unknown;
}

function makeLocalAcceptedAt(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const hour = new Date().getTimezoneOffset() > 0 ? 23 : 0;

  return new Date(year, month - 1, day, hour, 30).toISOString();
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
